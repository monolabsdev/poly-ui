use sqlx::{sqlite::SqliteConnectOptions, sqlite::SqlitePoolOptions, Row, SqlitePool};
use std::{str::FromStr, time::Duration};
use tauri::{AppHandle, Manager, Runtime};

/// Opens local SQLite file, builds shared pool, runs bundled migrations.
pub async fn init_db<R: Runtime>(app: &AppHandle<R>) -> Result<SqlitePool, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;

    let db_path = app_dir.join("chat.db");
    let db_url = format!("sqlite:{}", db_path.to_string_lossy());

    let options = SqliteConnectOptions::from_str(&db_url)
        .map_err(|e| e.to_string())?
        .create_if_missing(true)
        .busy_timeout(Duration::from_secs(10))
        .foreign_keys(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await
        .map_err(|e| e.to_string())?;

    ensure_conversations_schema(&pool).await?;
    run_migrations(&pool).await?;

    ensure_users_schema(&pool).await?;
    ensure_sessions_schema(&pool).await?;
    ensure_provider_schema(&pool).await?;

    // Remove stale rows from earlier provider types.
    sqlx::query("DELETE FROM provider_configs WHERE provider_type NOT IN ('OllamaLocal', 'OpenAICompatible')")
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    // Ensure the default OllamaLocal row exists
    sqlx::query(
        r#"
        INSERT OR IGNORE INTO provider_configs (provider_type, enabled, ollama_host, priority)
        VALUES ('OllamaLocal', 1, 'http://127.0.0.1:11434', 0)
        "#,
    )
    .execute(&pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        r#"
        INSERT OR IGNORE INTO provider_configs (provider_type, enabled, api_base_url, priority)
        VALUES ('OpenAICompatible', 0, 'https://api.openai.com/v1', 1)
        "#,
    )
    .execute(&pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(pool)
}

async fn ensure_provider_schema(pool: &SqlitePool) -> Result<(), String> {
    for column in ["api_key", "api_base_url"] {
        let exists = sqlx::query(
            "SELECT COUNT(*) FROM pragma_table_info('provider_configs') WHERE name = ?",
        )
        .bind(column)
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?
        .get::<i64, _>(0)
            > 0;

        if !exists {
            sqlx::query(&format!(
                "ALTER TABLE provider_configs ADD COLUMN {column} TEXT"
            ))
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

async fn ensure_conversations_schema(pool: &SqlitePool) -> Result<(), String> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            title TEXT,
            createdAt TEXT,
            updatedAt TEXT,
            isArchived INTEGER DEFAULT 0,
            userId TEXT DEFAULT ''
        )",
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            conversationId TEXT,
            role TEXT,
            content TEXT,
            createdAt TEXT,
            attachments TEXT,
            model TEXT,
            provider TEXT,
            thinking TEXT,
            thinkingDuration REAL,
            webSearch TEXT
        )",
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    let has_websearch = sqlx::query(
        "SELECT COUNT(*) FROM pragma_table_info('messages') WHERE name = 'webSearch'",
    )
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?
    .get::<i64, _>(0)
        > 0;

    if !has_websearch {
        sqlx::query("ALTER TABLE messages ADD COLUMN webSearch TEXT")
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }

    let has_provider = sqlx::query(
        "SELECT COUNT(*) FROM pragma_table_info('messages') WHERE name = 'provider'",
    )
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?
    .get::<i64, _>(0)
        > 0;

    if !has_provider {
        sqlx::query("ALTER TABLE messages ADD COLUMN provider TEXT")
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversationId)")
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(createdAt)")
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updatedAt)")
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_conversations_archived ON conversations(isArchived)",
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(userId)")
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

async fn run_migrations(pool: &SqlitePool) -> Result<(), String> {
    let migrator = sqlx::migrate!("./src/db/migrations");

    if let Err(error) = migrator.run(pool).await {
        let message = error.to_string();

        if !message.contains("previously applied but has been modified") {
            return Err(message);
        }

        // Dev repair: these migrations were edited after being applied.
        // Keep the existing schema and record the bundled checksums.
        const REPAIRABLE_VERSIONS: [i64; 4] = [
            20260501000000,
            20260509000000,
            20260510000000,
            20260531000000,
        ];

        for migration in migrator
            .iter()
            .filter(|migration| REPAIRABLE_VERSIONS.contains(&migration.version))
        {
            sqlx::query("UPDATE _sqlx_migrations SET checksum = ? WHERE version = ?")
                .bind(migration.checksum.as_ref())
                .bind(migration.version)
                .execute(pool)
                .await
                .map_err(|e| e.to_string())?;
        }
        // Dev repair: migrations were edited during development. Removing
        // stale checksums lets sqlx record the current files and continue.
        sqlx::query("DELETE FROM _sqlx_migrations WHERE version IN (?, ?, ?, ?)")
            .bind(20260501000000_i64)
            .bind(20260509000000_i64)
            .bind(20260510000000_i64)
            .bind(20260531000000_i64)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;

        return migrator.run(pool).await.map_err(|e| e.to_string());
    }

    Ok(())
}

async fn ensure_users_schema(pool: &SqlitePool) -> Result<(), String> {
    let columns = sqlx::query("PRAGMA table_info(users)")
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    let has_integer_id = columns.iter().any(|column| {
        let name: String = column.get("name");
        let column_type: String = column.get("type");
        name == "id" && column_type.eq_ignore_ascii_case("INTEGER")
    });
    let has_name = columns.iter().any(|column| {
        let name: String = column.get("name");
        name == "name"
    });

    if has_integer_id && has_name {
        return Ok(());
    }

    sqlx::query("ALTER TABLE users RENAME TO users_legacy")
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query(
        "CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            passwordHash TEXT,
            fullName TEXT,
            status TEXT NOT NULL DEFAULT 'Active',
            avatarUrl TEXT,
            createdAt TEXT NOT NULL DEFAULT (datetime('now')),
            updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
        )",
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT OR IGNORE INTO users (name, email, passwordHash, fullName, status, avatarUrl, createdAt, updatedAt)
         SELECT
            COALESCE(NULLIF(fullName, ''), email),
            email,
            passwordHash,
            fullName,
            COALESCE(status, 'Active'),
            avatarUrl,
            COALESCE(createdAt, datetime('now')),
            COALESCE(updatedAt, datetime('now'))
         FROM users_legacy
         WHERE email IS NOT NULL",
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query("DROP TABLE users_legacy")
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    recreate_sessions_table(pool).await?;

    Ok(())
}

async fn ensure_sessions_schema(pool: &SqlitePool) -> Result<(), String> {
    let columns = sqlx::query("PRAGMA table_info(sessions)")
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    if columns.is_empty() {
        recreate_sessions_table(pool).await?;
        return Ok(());
    }

    let has_integer_user_id = columns.iter().any(|column| {
        let name: String = column.get("name");
        let column_type: String = column.get("type");
        name == "userId" && column_type.eq_ignore_ascii_case("INTEGER")
    });

    if !has_integer_user_id {
        recreate_sessions_table(pool).await?;
    }

    Ok(())
}

async fn recreate_sessions_table(pool: &SqlitePool) -> Result<(), String> {
    sqlx::query("DROP TABLE IF EXISTS sessions")
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query(
        "CREATE TABLE sessions (
            id TEXT PRIMARY KEY,
            userId INTEGER NOT NULL,
            token TEXT NOT NULL UNIQUE,
            expiresAt TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        )",
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

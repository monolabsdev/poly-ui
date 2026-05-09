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

    run_migrations(&pool).await?;

    ensure_users_schema(&pool).await?;
    ensure_sessions_schema(&pool).await?;

    // Proactive seeding for provider_configs if empty
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM provider_configs")
        .fetch_one(&pool)
        .await
        .map_err(|e| e.to_string())?;

    println!("[Database] provider_configs row count: {}", count);

    if count == 0 {
        println!("[Database] Seeding default provider configs...");
        sqlx::query(
            r#"
            INSERT OR IGNORE INTO provider_configs (provider_type, enabled, ollama_host, priority)
            VALUES ('OllamaLocal', 1, 'http://127.0.0.1:11434', 0)
            "#
        )
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

        sqlx::query(
            r#"
            INSERT OR IGNORE INTO provider_configs (provider_type, enabled, priority)
            VALUES ('OllamaAPI', 0, 1)
            "#
        )
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    }

    println!("[Database] Initialization complete.");
    Ok(pool)
}

async fn run_migrations(pool: &SqlitePool) -> Result<(), String> {
    let migrator = sqlx::migrate!("./src/db/migrations");

    match migrator.run(pool).await {
        Ok(()) => Ok(()),
        Err(error) => {
            let message = error.to_string();

            if !message.contains("previously applied but has been modified") {
                return Err(message);
            }

            // Dev repair: this branch exists because migrations were edited 
            // during development. Migration SQL is idempotent, so removing the
            // stale checksum lets sqlx record the current file and continue.
            sqlx::query("DELETE FROM _sqlx_migrations WHERE version IN (?, ?)")
                .bind(20260501000000_i64)
                .bind(20260509000000_i64)
                .execute(pool)
                .await
                .map_err(|e| e.to_string())?;

            migrator.run(pool).await.map_err(|e| e.to_string())
        }
    }
}

async fn ensure_users_schema(pool: &SqlitePool) -> Result<(), String> {
    let columns = sqlx::query("PRAGMA table_info(users)")
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut has_integer_id = false;
    let mut has_name = false;

    for column in columns {
        let name: String = column.get("name");
        let column_type: String = column.get("type");

        if name == "id" && column_type.eq_ignore_ascii_case("INTEGER") {
            has_integer_id = true;
        }

        if name == "name" {
            has_name = true;
        }
    }

    if has_integer_id && has_name {
        return Ok(());
    }

    // Upgrade older auth table shape into required local users table.
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

    let mut has_integer_user_id = false;
    for column in columns {
        let name: String = column.get("name");
        let column_type: String = column.get("type");

        if name == "userId" && column_type.eq_ignore_ascii_case("INTEGER") {
            has_integer_user_id = true;
        }
    }

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

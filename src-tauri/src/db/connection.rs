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
    ensure_folders_schema(&pool).await?;
    run_migrations(&pool).await?;

    // Remove stale rows from earlier provider types.
    sqlx::query("DELETE FROM provider_configs WHERE provider_type NOT IN ('OllamaLocal', 'OpenAICompatible')")
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    ensure_default_provider_configs(&pool, "").await?;

    Ok(pool)
}

pub async fn ensure_default_provider_configs(
    pool: &SqlitePool,
    account_id: &str,
) -> Result<(), String> {
    let account_id = normalize_provider_account_id(account_id);

    sqlx::query(
        r#"
        INSERT INTO provider_configs (account_id, provider_type, enabled, ollama_host, priority)
        SELECT ?1, 'OllamaLocal', 1, 'http://127.0.0.1:11434', 0
        WHERE NOT EXISTS (
            SELECT 1 FROM provider_configs
            WHERE account_id = ?1 AND provider_type = 'OllamaLocal'
        )
        "#,
    )
    .bind(&account_id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        r#"
        INSERT INTO provider_configs (account_id, provider_type, enabled, api_base_url, priority)
        SELECT ?1, 'OpenAICompatible', 0, 'https://api.openai.com/v1', 1
        WHERE NOT EXISTS (
            SELECT 1 FROM provider_configs
            WHERE account_id = ?1
              AND provider_type = 'OpenAICompatible'
              AND api_base_url = 'https://api.openai.com/v1'
        )
        "#,
    )
    .bind(&account_id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

pub fn normalize_provider_account_id(account_id: &str) -> String {
    account_id.trim().to_string()
}

async fn ensure_conversations_schema(pool: &SqlitePool) -> Result<(), String> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            title TEXT,
            createdAt TEXT,
            updatedAt TEXT,
            isArchived INTEGER DEFAULT 0,
            userId TEXT DEFAULT '',
            folderId TEXT
        )",
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    let has_folder_id = sqlx::query(
        "SELECT COUNT(*) FROM pragma_table_info('conversations') WHERE name = 'folderId'",
    )
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?
    .get::<i64, _>(0)
        > 0;

    if !has_folder_id {
        sqlx::query("ALTER TABLE conversations ADD COLUMN folderId TEXT")
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }

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
            webSearch TEXT,
            agent TEXT
        )",
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    let has_websearch =
        sqlx::query("SELECT COUNT(*) FROM pragma_table_info('messages') WHERE name = 'webSearch'")
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

    let has_provider =
        sqlx::query("SELECT COUNT(*) FROM pragma_table_info('messages') WHERE name = 'provider'")
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

    let has_agent =
        sqlx::query("SELECT COUNT(*) FROM pragma_table_info('messages') WHERE name = 'agent'")
            .fetch_one(pool)
            .await
            .map_err(|e| e.to_string())?
            .get::<i64, _>(0)
            > 0;

    if !has_agent {
        sqlx::query("ALTER TABLE messages ADD COLUMN agent TEXT")
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

async fn ensure_folders_schema(pool: &SqlitePool) -> Result<(), String> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS folders (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            parentId TEXT,
            backgroundImage TEXT,
            systemPrompt TEXT,
            contextFiles TEXT,
            userId TEXT DEFAULT '',
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL
        )",
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    for column in [
        "parentId TEXT",
        "backgroundImage TEXT",
        "systemPrompt TEXT",
        "contextFiles TEXT",
        "userId TEXT DEFAULT ''",
    ] {
        let name = column.split_whitespace().next().unwrap();
        let exists =
            sqlx::query("SELECT COUNT(*) FROM pragma_table_info('folders') WHERE name = ?")
                .bind(name)
                .fetch_one(pool)
                .await
                .map_err(|e| e.to_string())?
                .get::<i64, _>(0)
                > 0;

        if !exists {
            sqlx::query(&format!("ALTER TABLE folders ADD COLUMN {column}"))
                .execute(pool)
                .await
                .map_err(|e| e.to_string())?;
        }
    }

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_folders_user ON folders(userId)")
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

async fn run_migrations(pool: &SqlitePool) -> Result<(), String> {
    let migrator = sqlx::migrate!("./src/db/migrations");
    migrator.run(pool).await.map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn default_provider_configs_seed_per_account() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();

        sqlx::query(
            r#"
            CREATE TABLE provider_configs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id TEXT NOT NULL DEFAULT '',
                provider_type TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                ollama_host TEXT,
                ollama_api_key TEXT,
                ollama_api_base_url TEXT,
                api_key TEXT,
                api_base_url TEXT,
                preset TEXT,
                headers TEXT,
                model_suggestions TEXT,
                priority INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
            "#,
        )
        .execute(&pool)
        .await
        .unwrap();

        ensure_default_provider_configs(&pool, "account-a")
            .await
            .unwrap();
        ensure_default_provider_configs(&pool, "account-a")
            .await
            .unwrap();

        let account_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM provider_configs WHERE account_id = 'account-a'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();

        assert_eq!(account_count, 2);
    }
}

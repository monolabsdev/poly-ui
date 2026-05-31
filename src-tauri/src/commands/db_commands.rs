use crate::AppState;
use serde::Serialize;
use tauri::State;

#[derive(Serialize)]
pub struct SqlResult {
    pub success: bool,
    pub message: String,
    pub rows_affected: Option<u64>,
}

#[tauri::command]
pub async fn clear_database(state: State<'_, AppState>) -> Result<SqlResult, String> {
    let pool = &state.db;
    for table in &["messages", "conversations", "sessions", "users"] {
        let sql = format!("DELETE FROM {}", table);
        sqlx::raw_sql(&sql)
            .execute(pool)
            .await
            .map_err(|e| format!("Failed to clear table '{}': {}", table, e))?;
    }
    Ok(SqlResult {
        success: true,
        message: "All user data cleared (messages, conversations, sessions, users).".into(),
        rows_affected: None,
    })
}

#[cfg(feature = "dev-sql-console")]
#[tauri::command]
pub async fn execute_sql(state: State<'_, AppState>, sql: String) -> Result<SqlResult, String> {
    let pool = &state.db;
    let trimmed = sql.trim().to_uppercase();

    if trimmed.starts_with("SELECT") || trimmed.starts_with("PRAGMA") || trimmed.starts_with("EXPLAIN") {
        let rows = sqlx::query(&sql)
            .fetch_all(pool)
            .await
            .map_err(|e| format!("Query error: {e}"))?;

        if rows.is_empty() {
            return Ok(SqlResult { success: true, message: "Query returned 0 rows.".into(), rows_affected: None });
        }

        Ok(SqlResult { success: true, message: format!("Query returned {} rows.", rows.len()), rows_affected: None })
    } else {
        let result = sqlx::raw_sql(&sql)
            .execute(pool)
            .await
            .map_err(|e| format!("Execute error: {e}"))?;

        Ok(SqlResult { success: true, message: "Query executed successfully.".into(), rows_affected: Some(result.rows_affected()) })
    }
}

#[cfg(not(feature = "dev-sql-console"))]
#[tauri::command]
pub async fn execute_sql(_state: State<'_, AppState>, _sql: String) -> Result<SqlResult, String> {
    Err("SQL console is disabled in this build.".to_string())
}

use crate::AppState;
use serde::Serialize;
use sqlx::Row;
use sqlx::Column;
use tauri::State;

#[derive(Serialize)]
pub struct SqlResult {
    pub success: bool,
    pub message: String,
    pub rows_affected: Option<u64>,
    pub columns: Option<Vec<String>>,
    pub rows: Option<Vec<Vec<serde_json::Value>>>,
}

#[tauri::command]
pub async fn clear_database(state: State<'_, AppState>) -> Result<SqlResult, String> {
    let pool = &state.db;

    for table in &["messages", "conversations", "sessions", "users"] {
        let sql = format!("DELETE FROM {}", table);
        sqlx::raw_sql(&sql).execute(pool).await.map_err(|e| {
            format!("Failed to clear table '{}': {}", table, e)
        })?;
    }

    Ok(SqlResult {
        success: true,
        message: "All user data cleared (messages, conversations, sessions, users).".into(),
        rows_affected: None,
        columns: None,
        rows: None,
    })
}

fn row_val(row: &sqlx::sqlite::SqliteRow, i: usize) -> serde_json::Value {
    if let Ok(s) = row.try_get::<String, usize>(i) {
        return serde_json::Value::String(s);
    }
    if let Ok(n) = row.try_get::<i64, usize>(i) {
        return serde_json::Value::Number(serde_json::Number::from(n));
    }
    if let Ok(n) = row.try_get::<f64, usize>(i) {
        if let Some(num) = serde_json::Number::from_f64(n) {
            return serde_json::Value::Number(num);
        }
    }
    serde_json::Value::Null
}

#[tauri::command]
pub async fn execute_sql(state: State<'_, AppState>, sql: String) -> Result<SqlResult, String> {
    let pool = &state.db;
    let trimmed = sql.trim().to_uppercase();

    if trimmed.starts_with("SELECT")
        || trimmed.starts_with("PRAGMA")
        || trimmed.starts_with("EXPLAIN")
    {
        let rows = sqlx::query(&sql)
            .fetch_all(pool)
            .await
            .map_err(|e| format!("Query error: {}", e))?;

        if rows.is_empty() {
            return Ok(SqlResult {
                success: true,
                message: "Query returned 0 rows.".into(),
                rows_affected: None,
                columns: Some(vec![]),
                rows: Some(vec![]),
            });
        }

        let columns: Vec<String> = rows[0].columns().iter().map(|c| c.name().into()).collect();
        let mut result_rows: Vec<Vec<serde_json::Value>> = Vec::new();

        for row in &rows {
            let mut row_vals: Vec<serde_json::Value> = Vec::new();
            for i in 0..columns.len() {
                row_vals.push(row_val(row, i));
            }
            result_rows.push(row_vals);
        }

        Ok(SqlResult {
            success: true,
            message: format!("Query returned {} rows.", result_rows.len()),
            rows_affected: None,
            columns: Some(columns),
            rows: Some(result_rows),
        })
    } else {
        let result = sqlx::raw_sql(&sql)
            .execute(pool)
            .await
            .map_err(|e| format!("Execute error: {}", e))?;

        Ok(SqlResult {
            success: true,
            message: "Query executed successfully.".into(),
            rows_affected: Some(result.rows_affected()),
            columns: None,
            rows: None,
        })
    }
}

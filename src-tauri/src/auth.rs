use crate::AppState;
use bcrypt::{hash, verify, DEFAULT_COST};
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use tauri::{command, State};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct User {
    pub id: String,
    pub email: String,
    #[serde(rename = "fullName")]
    pub full_name: Option<String>,
    pub status: String,
    #[serde(rename = "avatarUrl")]
    pub avatar_url: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthResponse {
    pub user: User,
    pub token: String,
}

#[command]
pub async fn auth_signup(
    state: State<'_, AppState>,
    email: String,
    password: String,
    full_name: Option<String>,
) -> Result<AuthResponse, String> {
    let pool = &state.db;
    let email = email.trim().to_lowercase();
    let display_name = full_name.clone().unwrap_or_else(|| email.clone());

    // Check if user exists
    let existing = sqlx::query("SELECT id FROM users WHERE email = ?")
        .bind(&email)
        .fetch_optional(pool)
        .await
        .map_err(|e| e.to_string())?;

    if existing.is_some() {
        return Err("User already exists".to_string());
    }

    let password_hash = hash(password, DEFAULT_COST).map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    let result = sqlx::query(
        "INSERT INTO users (name, email, passwordHash, fullName, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&display_name)
    .bind(&email)
    .bind(&password_hash)
    .bind(&full_name)
    .bind("Active")
    .bind(&now)
    .bind(&now)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    let user_id = result.last_insert_rowid();
    let user = User {
        id: user_id.to_string(),
        email,
        full_name,
        status: "Active".to_string(),
        avatar_url: None,
        created_at: now.clone(),
        updated_at: now.clone(),
    };

    let session_id = Uuid::new_v4().to_string();
    let token = Uuid::new_v4().to_string();
    let expires_at = (Utc::now() + Duration::days(30)).to_rfc3339();

    sqlx::query(
        "INSERT INTO sessions (id, userId, token, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(session_id)
    .bind(user_id)
    .bind(&token)
    .bind(expires_at)
    .bind(now)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;

    Ok(AuthResponse { user, token })
}

#[command]
pub async fn auth_login(
    state: State<'_, AppState>,
    email: String,
    password: String,
) -> Result<AuthResponse, String> {
    let pool = &state.db;
    let email = email.trim().to_lowercase();

    let row = sqlx::query(
        "SELECT id, email, passwordHash, fullName, status, avatarUrl, createdAt, updatedAt FROM users WHERE email = ?",
    )
    .bind(email)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "Invalid email or password".to_string())?;

    let password_hash: Option<String> = row.get("passwordHash");
    let password_hash = password_hash.ok_or_else(|| "Invalid email or password".to_string())?;

    if !verify(password, &password_hash).map_err(|e| e.to_string())? {
        return Err("Invalid email or password".to_string());
    }

    let user = User {
        id: row.get::<i64, _>("id").to_string(),
        email: row.get("email"),
        full_name: row.get("fullName"),
        status: row
            .get::<Option<String>, _>("status")
            .unwrap_or_else(|| "Active".to_string()),
        avatar_url: row.get("avatarUrl"),
        created_at: row
            .get::<Option<String>, _>("createdAt")
            .unwrap_or_default(),
        updated_at: row
            .get::<Option<String>, _>("updatedAt")
            .unwrap_or_default(),
    };

    let session_id = Uuid::new_v4().to_string();
    let token = Uuid::new_v4().to_string();
    let user_id = row.get::<i64, _>("id");
    let now = Utc::now().to_rfc3339();
    let expires_at = (Utc::now() + Duration::days(30)).to_rfc3339();

    sqlx::query(
        "INSERT INTO sessions (id, userId, token, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(session_id)
    .bind(user_id)
    .bind(&token)
    .bind(expires_at)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(AuthResponse { user, token })
}

#[command]
pub async fn auth_logout(
    state: State<'_, AppState>,
    token: String,
) -> Result<(), String> {
    let pool = &state.db;

    sqlx::query("DELETE FROM sessions WHERE token = ?")
        .bind(&token)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[command]
pub async fn auth_get_current_user(
    state: State<'_, AppState>,
    token: String,
) -> Result<User, String> {
    println!("[auth] auth_get_current_user - token: {}", token);
    let pool = &state.db;
    println!("[auth] pool acquired");

    let now = Utc::now().to_rfc3339();
    let row = sqlx::query(
        "SELECT u.id, u.email, u.fullName, u.status, u.avatarUrl, u.createdAt, u.updatedAt 
         FROM users u 
         JOIN sessions s ON u.id = s.userId 
         WHERE s.token = ? AND s.expiresAt > ?",
    )
    .bind(token)
    .bind(now)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        println!("[auth] fetch_optional error: {}", e);
        e.to_string()
    })?
    .ok_or_else(|| {
        println!("[auth] session expired or not found");
        "Session expired".to_string()
    })?;

    println!("[auth] user retrieved: {}", row.get::<String, _>("email"));

    Ok(User {
        id: row.get::<i64, _>("id").to_string(),
        email: row.get("email"),
        full_name: row.get("fullName"),
        status: row
            .get::<Option<String>, _>("status")
            .unwrap_or_else(|| "Active".to_string()),
        avatar_url: row.get("avatarUrl"),
        created_at: row
            .get::<Option<String>, _>("createdAt")
            .unwrap_or_default(),
        updated_at: row
            .get::<Option<String>, _>("updatedAt")
            .unwrap_or_default(),
    })
}

#[command]
pub async fn auth_update_status(
    state: State<'_, AppState>,
    token: String,
    status: String,
) -> Result<(), String> {
    let pool = &state.db;
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        "UPDATE users SET status = ?, updatedAt = ? WHERE id = (SELECT userId FROM sessions WHERE token = ?)",
    )
    .bind(status)
    .bind(now)
    .bind(token)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

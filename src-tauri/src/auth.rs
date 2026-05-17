use crate::AppState;
use bcrypt::{hash, verify, DEFAULT_COST};
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use sqlx::SqlitePool;
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

#[derive(Debug)]
pub enum AuthError {
    UserExists,
    InvalidCredentials,
    SessionExpired,
    DbError(String),
}

impl From<sqlx::Error> for AuthError {
    fn from(e: sqlx::Error) -> Self {
        AuthError::DbError(e.to_string())
    }
}

impl From<bcrypt::BcryptError> for AuthError {
    fn from(e: bcrypt::BcryptError) -> Self {
        AuthError::DbError(e.to_string())
    }
}

async fn create_session(
    executor: impl sqlx::Executor<'_, Database = sqlx::Sqlite>,
    user_id: i64,
) -> Result<(String, String), AuthError> {
    let session_id = Uuid::new_v4().to_string();
    let token = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let expires_at = (Utc::now() + Duration::days(30)).to_rfc3339();

    sqlx::query(
        "INSERT INTO sessions (id, userId, token, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&session_id)
    .bind(user_id)
    .bind(&token)
    .bind(&expires_at)
    .bind(&now)
    .execute(executor)
    .await?;

    Ok((token, expires_at))
}

pub async fn signup(
    pool: &SqlitePool,
    email: &str,
    password: &str,
    full_name: Option<&str>,
) -> Result<AuthResponse, AuthError> {
    let email = email.trim().to_lowercase();
    let display_name = full_name.unwrap_or(&email).to_string();

    let existing = sqlx::query("SELECT id FROM users WHERE email = ?")
        .bind(&email)
        .fetch_optional(pool)
        .await?;

    if existing.is_some() {
        return Err(AuthError::UserExists);
    }

    let password_hash = hash(password, DEFAULT_COST)?;
    let now = Utc::now().to_rfc3339();

    let mut tx = pool.begin().await?;

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
    .await?;

    let user_id = result.last_insert_rowid();
    let user = User {
        id: user_id.to_string(),
        email: email.clone(),
        full_name: full_name.map(String::from),
        status: "Active".to_string(),
        avatar_url: None,
        created_at: now.clone(),
        updated_at: now.clone(),
    };

    let (token, _) = create_session(&mut *tx, user_id).await?;

    tx.commit().await?;

    Ok(AuthResponse { user, token })
}

pub async fn login(
    pool: &SqlitePool,
    email: &str,
    password: &str,
) -> Result<AuthResponse, AuthError> {
    let email = email.trim().to_lowercase();

    let row = sqlx::query(
        "SELECT id, email, passwordHash, fullName, status, avatarUrl, createdAt, updatedAt FROM users WHERE email = ?",
    )
    .bind(&email)
    .fetch_optional(pool)
    .await?
    .ok_or(AuthError::InvalidCredentials)?;

    let password_hash: Option<String> = row.get("passwordHash");
    let password_hash = password_hash.ok_or(AuthError::InvalidCredentials)?;

    if !verify(password, &password_hash)? {
        return Err(AuthError::InvalidCredentials);
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
    let user_id = row.get::<i64, _>("id");

    let (token, _) = create_session(pool, user_id).await?;

    Ok(AuthResponse { user, token })
}

pub async fn logout(pool: &SqlitePool, token: &str) -> Result<(), AuthError> {
    sqlx::query("DELETE FROM sessions WHERE token = ?")
        .bind(token)
        .execute(pool)
        .await?;

    Ok(())
}

pub async fn get_current_user(pool: &SqlitePool, token: &str) -> Result<User, AuthError> {
    let now = Utc::now().to_rfc3339();

    let row = sqlx::query(
        "SELECT u.id, u.email, u.fullName, u.status, u.avatarUrl, u.createdAt, u.updatedAt
         FROM users u
         JOIN sessions s ON u.id = s.userId
         WHERE s.token = ? AND s.expiresAt > ?",
    )
    .bind(token)
    .bind(&now)
    .fetch_optional(pool)
    .await?
    .ok_or(AuthError::SessionExpired)?;

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

pub async fn update_status(pool: &SqlitePool, token: &str, status: &str) -> Result<(), AuthError> {
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        "UPDATE users SET status = ?, updatedAt = ? WHERE id = (SELECT userId FROM sessions WHERE token = ?)",
    )
    .bind(status)
    .bind(&now)
    .bind(token)
    .execute(pool)
    .await?;

    Ok(())
}

#[command]
pub async fn auth_signup(
    state: State<'_, AppState>,
    email: String,
    password: String,
    full_name: Option<String>,
) -> Result<AuthResponse, String> {
    signup(&state.db, &email, &password, full_name.as_deref())
        .await
        .map_err(|e| match e {
            AuthError::UserExists => "User already exists".to_string(),
            AuthError::InvalidCredentials => "Invalid credentials".to_string(),
            AuthError::SessionExpired => "Session expired".to_string(),
            AuthError::DbError(msg) => msg,
        })
}

#[command]
pub async fn auth_login(
    state: State<'_, AppState>,
    email: String,
    password: String,
) -> Result<AuthResponse, String> {
    login(&state.db, &email, &password)
        .await
        .map_err(|e| match e {
            AuthError::UserExists => "User already exists".to_string(),
            AuthError::InvalidCredentials => "Invalid email or password".to_string(),
            AuthError::SessionExpired => "Session expired".to_string(),
            AuthError::DbError(msg) => msg,
        })
}

#[command]
pub async fn auth_logout(state: State<'_, AppState>, token: String) -> Result<(), String> {
    logout(&state.db, &token).await.map_err(|e| match e {
        AuthError::DbError(msg) => msg,
        _ => "Logout failed".to_string(),
    })
}

#[command]
pub async fn auth_get_current_user(
    state: State<'_, AppState>,
    token: String,
) -> Result<User, String> {
    get_current_user(&state.db, &token)
        .await
        .map_err(|e| match e {
            AuthError::SessionExpired => "Session expired".to_string(),
            AuthError::DbError(msg) => msg,
            _ => "Failed to get user".to_string(),
        })
}

#[command]
pub async fn auth_update_status(
    state: State<'_, AppState>,
    token: String,
    status: String,
) -> Result<(), String> {
    update_status(&state.db, &token, &status)
        .await
        .map_err(|e| match e {
            AuthError::DbError(msg) => msg,
            _ => "Failed to update status".to_string(),
        })
}

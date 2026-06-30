use crate::AppState;
use bcrypt::{hash, verify, DEFAULT_COST};
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use sqlx::SqlitePool;
use tauri::{command, State};
use tokio::task;
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
    EmailInUse,
    InvalidCredentials,
    InvalidInput(String),
    WeakPassword,
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
    validate_email(&email)?;
    validate_new_password(password)?;
    let full_name = normalize_display_name(full_name)?;
    let display_name = full_name.clone().unwrap_or_else(|| email.clone());

    let existing = sqlx::query("SELECT id FROM users WHERE email = ?")
        .bind(&email)
        .fetch_optional(pool)
        .await?;

    if existing.is_some() {
        return Err(AuthError::UserExists);
    }

    let password = password.to_string();
    let password_hash = task::spawn_blocking(move || hash(password, DEFAULT_COST))
        .await
        .map_err(|e| AuthError::DbError(e.to_string()))??;
    let now = Utc::now().to_rfc3339();

    let mut tx = pool.begin().await?;

    let result = sqlx::query(
        "INSERT INTO users (name, email, passwordHash, fullName, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&display_name)
    .bind(&email)
    .bind(&password_hash)
    .bind(full_name.as_deref())
    .bind("Active")
    .bind(&now)
    .bind(&now)
    .execute(&mut *tx)
    .await?;

    let user_id = result.last_insert_rowid();
    let user = User {
        id: user_id.to_string(),
        email: email.clone(),
        full_name,
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

    let password = password.to_string();
    let password_hash_for_verify = password_hash.clone();
    let password_valid = task::spawn_blocking(move || verify(password, &password_hash_for_verify))
        .await
        .map_err(|e| AuthError::DbError(e.to_string()))??;

    if !password_valid {
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

pub async fn update_profile(
    pool: &SqlitePool,
    token: &str,
    email: &str,
    full_name: Option<&str>,
    avatar_url: Option<&str>,
) -> Result<User, AuthError> {
    let now = Utc::now().to_rfc3339();
    let email = email.trim().to_lowercase();
    validate_email(&email)?;

    let full_name = normalize_display_name(full_name)?;
    let avatar_url = normalize_avatar(avatar_url)?;
    let display_name = full_name.clone().unwrap_or_else(|| email.clone());

    let row = sqlx::query("SELECT userId FROM sessions WHERE token = ? AND expiresAt > ?")
        .bind(token)
        .bind(&now)
        .fetch_optional(pool)
        .await?
        .ok_or(AuthError::SessionExpired)?;
    let user_id: i64 = row.get("userId");

    let existing = sqlx::query("SELECT id FROM users WHERE email = ? AND id != ?")
        .bind(&email)
        .bind(user_id)
        .fetch_optional(pool)
        .await?;
    if existing.is_some() {
        return Err(AuthError::EmailInUse);
    }

    match sqlx::query(
        "UPDATE users SET name = ?, email = ?, fullName = ?, avatarUrl = ?, updatedAt = ? WHERE id = ?",
    )
    .bind(display_name)
    .bind(&email)
    .bind(full_name)
    .bind(avatar_url)
    .bind(&now)
    .bind(user_id)
    .execute(pool)
    .await
    {
        Ok(_) => {}
        Err(error) if is_unique_email_error(&error) => return Err(AuthError::EmailInUse),
        Err(error) => return Err(error.into()),
    }

    user_by_id(pool, user_id).await
}

pub async fn change_password(
    pool: &SqlitePool,
    token: &str,
    current_password: &str,
    new_password: &str,
) -> Result<(), AuthError> {
    validate_new_password(new_password)?;
    let now = Utc::now().to_rfc3339();
    let row = sqlx::query(
        "SELECT u.id, u.passwordHash
         FROM users u
         JOIN sessions s ON u.id = s.userId
         WHERE s.token = ? AND s.expiresAt > ?",
    )
    .bind(token)
    .bind(&now)
    .fetch_optional(pool)
    .await?
    .ok_or(AuthError::SessionExpired)?;

    let user_id: i64 = row.get("id");
    let password_hash: Option<String> = row.get("passwordHash");
    let password_hash = password_hash.ok_or(AuthError::InvalidCredentials)?;
    let current_password = current_password.to_string();
    let password_hash_for_verify = password_hash.clone();
    let password_valid =
        task::spawn_blocking(move || verify(current_password, &password_hash_for_verify))
            .await
            .map_err(|e| AuthError::DbError(e.to_string()))??;
    if !password_valid {
        return Err(AuthError::InvalidCredentials);
    }

    let new_password = new_password.to_string();
    let new_hash = task::spawn_blocking(move || hash(new_password, DEFAULT_COST))
        .await
        .map_err(|e| AuthError::DbError(e.to_string()))??;

    let mut tx = pool.begin().await?;
    sqlx::query("UPDATE users SET passwordHash = ?, updatedAt = ? WHERE id = ?")
        .bind(new_hash)
        .bind(&now)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("DELETE FROM sessions WHERE userId = ? AND token != ?")
        .bind(user_id)
        .bind(token)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;

    Ok(())
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

/// Verifies that the caller is allowed to act on `account_id`.
///
/// `account_id` values that don't correspond to a registered user (guest IDs,
/// which are client-generated UUIDs never written to the `users` table) are
/// allowed through unchanged, since guests have no server-side account to
/// protect. Account IDs that do belong to a registered user require a valid,
/// unexpired session token for that same user — callers must not be able to
/// read or modify another account's data by simply naming its ID.
pub async fn authorize_account(
    pool: &SqlitePool,
    token: Option<&str>,
    account_id: &str,
) -> Result<(), AuthError> {
    let Ok(numeric_id) = account_id.parse::<i64>() else {
        return Ok(());
    };

    let is_registered_user = sqlx::query("SELECT 1 FROM users WHERE id = ?")
        .bind(numeric_id)
        .fetch_optional(pool)
        .await?
        .is_some();

    if !is_registered_user {
        return Ok(());
    }

    let token = token.ok_or(AuthError::SessionExpired)?;
    let user = get_current_user(pool, token).await?;

    if user.id != account_id {
        return Err(AuthError::InvalidCredentials);
    }

    Ok(())
}

pub async fn update_status(pool: &SqlitePool, token: &str, status: &str) -> Result<(), AuthError> {
    let now = Utc::now().to_rfc3339();

    let result = sqlx::query(
        "UPDATE users SET status = ?, updatedAt = ?
         WHERE id = (SELECT userId FROM sessions WHERE token = ? AND expiresAt > ?)",
    )
    .bind(status)
    .bind(&now)
    .bind(token)
    .bind(&now)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AuthError::SessionExpired);
    }

    Ok(())
}

async fn user_by_id(pool: &SqlitePool, user_id: i64) -> Result<User, AuthError> {
    let row = sqlx::query(
        "SELECT id, email, fullName, status, avatarUrl, createdAt, updatedAt FROM users WHERE id = ?",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;

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

fn validate_email(email: &str) -> Result<(), AuthError> {
    let valid = email.len() <= 254
        && email.contains('@')
        && !email.starts_with('@')
        && !email.ends_with('@')
        && !email.chars().any(char::is_whitespace);
    if valid {
        Ok(())
    } else {
        Err(AuthError::InvalidInput(
            "Enter a valid email address".to_string(),
        ))
    }
}

fn validate_new_password(password: &str) -> Result<(), AuthError> {
    let length = password.len();
    if (8..=128).contains(&length) {
        Ok(())
    } else {
        Err(AuthError::WeakPassword)
    }
}

fn normalize_display_name(value: Option<&str>) -> Result<Option<String>, AuthError> {
    let Some(value) = value.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(None);
    };
    if value.chars().count() <= 120 {
        Ok(Some(value.to_string()))
    } else {
        Err(AuthError::InvalidInput(
            "Display name must be 120 characters or fewer".to_string(),
        ))
    }
}

fn normalize_avatar(value: Option<&str>) -> Result<Option<String>, AuthError> {
    let Some(value) = value.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(None);
    };
    let lower = value.to_lowercase();
    let valid_remote =
        value.len() <= 2048 && (lower.starts_with("https://") || lower.starts_with("http://"));
    let valid_local = value.len() <= 3_000_000
        && [
            "data:image/jpeg;base64,",
            "data:image/png;base64,",
            "data:image/webp;base64,",
            "data:image/gif;base64,",
            "data:image/avif;base64,",
        ]
        .iter()
        .any(|prefix| lower.starts_with(prefix));
    if valid_remote || valid_local {
        Ok(Some(value.to_string()))
    } else {
        Err(AuthError::InvalidInput(
            "Profile picture must be a supported local image".to_string(),
        ))
    }
}

fn is_unique_email_error(error: &sqlx::Error) -> bool {
    error
        .as_database_error()
        .and_then(|error| error.constraint())
        .is_some_and(|constraint| constraint.eq_ignore_ascii_case("users.email"))
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
            AuthError::EmailInUse => "Email is already in use".to_string(),
            AuthError::InvalidCredentials => "Invalid credentials".to_string(),
            AuthError::InvalidInput(msg) => msg,
            AuthError::WeakPassword => "Password must be 8 to 128 characters".to_string(),
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
            AuthError::EmailInUse => "Email is already in use".to_string(),
            AuthError::InvalidCredentials => "Invalid email or password".to_string(),
            AuthError::InvalidInput(msg) => msg,
            AuthError::WeakPassword => "Password must be 8 to 128 characters".to_string(),
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
pub async fn auth_update_profile(
    state: State<'_, AppState>,
    token: String,
    email: String,
    full_name: Option<String>,
    avatar_url: Option<String>,
) -> Result<User, String> {
    update_profile(
        &state.db,
        &token,
        &email,
        full_name.as_deref(),
        avatar_url.as_deref(),
    )
    .await
    .map_err(|e| match e {
        AuthError::EmailInUse => "Email is already in use".to_string(),
        AuthError::InvalidInput(msg) => msg,
        AuthError::SessionExpired => "Session expired".to_string(),
        AuthError::DbError(msg) => msg,
        _ => "Failed to update profile".to_string(),
    })
}

#[command]
pub async fn auth_change_password(
    state: State<'_, AppState>,
    token: String,
    current_password: String,
    new_password: String,
) -> Result<(), String> {
    change_password(&state.db, &token, &current_password, &new_password)
        .await
        .map_err(|e| match e {
            AuthError::InvalidCredentials => "Current password is incorrect".to_string(),
            AuthError::WeakPassword => "Password must be 8 to 128 characters".to_string(),
            AuthError::SessionExpired => "Session expired".to_string(),
            AuthError::DbError(msg) => msg,
            _ => "Failed to change password".to_string(),
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

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn pool() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::raw_sql(include_str!(
            "db/migrations/20260501000000_create_users.sql"
        ))
        .execute(&pool)
        .await
        .unwrap();
        sqlx::raw_sql(include_str!(
            "db/migrations/20260501001000_recreate_sessions_integer_user_id.sql"
        ))
        .execute(&pool)
        .await
        .unwrap();
        pool
    }

    #[tokio::test]
    async fn update_profile_normalizes_email_and_avatar() {
        let pool = pool().await;
        let auth = signup(&pool, "Person@Example.COM", "password-1", Some("Person"))
            .await
            .unwrap();

        let updated = update_profile(
            &pool,
            &auth.token,
            "New@Example.COM",
            Some("New Name"),
            Some("https://example.com/avatar.png"),
        )
        .await
        .unwrap();

        assert_eq!(updated.email, "new@example.com");
        assert_eq!(updated.full_name.as_deref(), Some("New Name"));
        assert_eq!(
            updated.avatar_url.as_deref(),
            Some("https://example.com/avatar.png")
        );
    }

    #[tokio::test]
    async fn update_profile_rejects_duplicate_email() {
        let pool = pool().await;
        let auth = signup(&pool, "one@example.com", "password-1", None)
            .await
            .unwrap();
        signup(&pool, "two@example.com", "password-2", None)
            .await
            .unwrap();

        let error = update_profile(&pool, &auth.token, "two@example.com", None, None)
            .await
            .unwrap_err();

        assert!(matches!(error, AuthError::EmailInUse));
    }

    #[tokio::test]
    async fn update_profile_rejects_non_http_avatar() {
        let pool = pool().await;
        let auth = signup(&pool, "person@example.com", "password-1", None)
            .await
            .unwrap();

        let error = update_profile(
            &pool,
            &auth.token,
            "person@example.com",
            None,
            Some("file:///secret.png"),
        )
        .await
        .unwrap_err();

        assert!(matches!(error, AuthError::InvalidInput(_)));
    }

    #[tokio::test]
    async fn update_profile_accepts_local_image_data_url() {
        let pool = pool().await;
        let auth = signup(&pool, "person@example.com", "password-1", None)
            .await
            .unwrap();

        let updated = update_profile(
            &pool,
            &auth.token,
            "person@example.com",
            None,
            Some("data:image/png;base64,aGVsbG8="),
        )
        .await
        .unwrap();

        assert_eq!(
            updated.avatar_url.as_deref(),
            Some("data:image/png;base64,aGVsbG8=")
        );
    }

    #[tokio::test]
    async fn change_password_requires_current_password_and_updates_hash() {
        let pool = pool().await;
        let auth = signup(&pool, "person@example.com", "password-1", None)
            .await
            .unwrap();

        let error = change_password(&pool, &auth.token, "wrong-password", "password-2")
            .await
            .unwrap_err();
        assert!(matches!(error, AuthError::InvalidCredentials));

        change_password(&pool, &auth.token, "password-1", "password-2")
            .await
            .unwrap();
        assert!(login(&pool, "person@example.com", "password-1")
            .await
            .is_err());
        assert!(login(&pool, "person@example.com", "password-2")
            .await
            .is_ok());
    }
}

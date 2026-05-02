use crate::repository::user_repository::{User, UserRepository};
use sqlx::SqlitePool;

/// Business layer. Validate input before touching storage.
pub struct UserService;

impl UserService {
    pub async fn create(pool: &SqlitePool, name: String, email: String) -> Result<User, String> {
        let (name, email) = validate_user_input(name, email)?;
        UserRepository::create(pool, &name, &email)
            .await
            .map_err(map_sqlx_error)
    }

    pub async fn list(pool: &SqlitePool) -> Result<Vec<User>, String> {
        UserRepository::list(pool).await.map_err(map_sqlx_error)
    }

    pub async fn get(pool: &SqlitePool, id: i64) -> Result<User, String> {
        if id <= 0 {
            return Err("User id must be positive".to_string());
        }

        UserRepository::get_by_id(pool, id)
            .await
            .map_err(map_sqlx_error)
    }

    pub async fn update(
        pool: &SqlitePool,
        id: i64,
        name: String,
        email: String,
    ) -> Result<User, String> {
        if id <= 0 {
            return Err("User id must be positive".to_string());
        }

        let (name, email) = validate_user_input(name, email)?;
        UserRepository::update(pool, id, &name, &email)
            .await
            .map_err(map_sqlx_error)
    }

    pub async fn delete(pool: &SqlitePool, id: i64) -> Result<(), String> {
        if id <= 0 {
            return Err("User id must be positive".to_string());
        }

        UserRepository::delete(pool, id)
            .await
            .map_err(map_sqlx_error)
    }
}

fn validate_user_input(name: String, email: String) -> Result<(String, String), String> {
    let name = name.trim().to_string();
    let email = email.trim().to_lowercase();

    if name.is_empty() {
        return Err("Name is required".to_string());
    }

    if !email.contains('@') {
        return Err("Valid email is required".to_string());
    }

    Ok((name, email))
}

fn map_sqlx_error(error: sqlx::Error) -> String {
    match error {
        sqlx::Error::RowNotFound => "User not found".to_string(),
        sqlx::Error::Database(db_error) => db_error.message().to_string(),
        other => other.to_string(),
    }
}

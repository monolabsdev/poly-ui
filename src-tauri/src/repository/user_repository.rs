use serde::Serialize;
use sqlx::{Row, SqlitePool};

#[derive(Debug, Clone, Serialize)]
pub struct User {
    pub id: i64,
    pub name: String,
    pub email: String,
}

/// Database-only layer. SQL stays here.
pub struct UserRepository;

impl UserRepository {
    pub async fn create(pool: &SqlitePool, name: &str, email: &str) -> Result<User, sqlx::Error> {
        let result = sqlx::query("INSERT INTO users (name, email) VALUES (?, ?)")
            .bind(name)
            .bind(email)
            .execute(pool)
            .await?;

        Self::get_by_id(pool, result.last_insert_rowid()).await
    }

    pub async fn list(pool: &SqlitePool) -> Result<Vec<User>, sqlx::Error> {
        let rows = sqlx::query("SELECT id, name, email FROM users ORDER BY id DESC")
            .fetch_all(pool)
            .await?;

        Ok(rows.into_iter().map(row_to_user).collect())
    }

    pub async fn get_by_id(pool: &SqlitePool, id: i64) -> Result<User, sqlx::Error> {
        let row = sqlx::query("SELECT id, name, email FROM users WHERE id = ?")
            .bind(id)
            .fetch_one(pool)
            .await?;

        Ok(row_to_user(row))
    }

    pub async fn update(
        pool: &SqlitePool,
        id: i64,
        name: &str,
        email: &str,
    ) -> Result<User, sqlx::Error> {
        sqlx::query(
            "UPDATE users SET name = ?, email = ?, updatedAt = datetime('now') WHERE id = ?",
        )
        .bind(name)
        .bind(email)
        .bind(id)
        .execute(pool)
        .await?;

        Self::get_by_id(pool, id).await
    }

    pub async fn delete(pool: &SqlitePool, id: i64) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM users WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;

        Ok(())
    }
}

fn row_to_user(row: sqlx::sqlite::SqliteRow) -> User {
    User {
        id: row.get("id"),
        name: row.get("name"),
        email: row.get("email"),
    }
}

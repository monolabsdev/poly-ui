use std::fmt::{Display, Formatter, Result as FmtResult};

#[derive(Debug)]
#[allow(dead_code)]
pub enum AppError {
    Db(String),
    Provider(String),
    Network(String),
    Parse(String),
    NotFound(String),
    Cancelled,
    Message(String),
}

impl Display for AppError {
    fn fmt(&self, f: &mut Formatter<'_>) -> FmtResult {
        match self {
            AppError::Db(msg) => write!(f, "Database error: {msg}"),
            AppError::Provider(msg) => write!(f, "{msg}"),
            AppError::Network(msg) => write!(f, "Network error: {msg}"),
            AppError::Parse(msg) => write!(f, "Parse error: {msg}"),
            AppError::NotFound(msg) => write!(f, "Not found: {msg}"),
            AppError::Cancelled => write!(f, "Operation cancelled"),
            AppError::Message(msg) => write!(f, "{msg}"),
        }
    }
}

impl From<sqlx::Error> for AppError {
    fn from(e: sqlx::Error) -> Self {
        AppError::Db(e.to_string())
    }
}

impl From<String> for AppError {
    fn from(msg: String) -> Self {
        AppError::Message(msg)
    }
}

impl From<&str> for AppError {
    fn from(msg: &str) -> Self {
        AppError::Message(msg.to_string())
    }
}

use std::fmt::{Display, Formatter, Result as FmtResult};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MemoryError {
    ProviderUnavailable(String),
    InvalidEndpoint(String),
    AuthenticationFailure,
    UnsupportedModel(String),
    StructuredOutputFailure(String),
    EmbeddingFailure(String),
    StorageFailure(String),
    Timeout,
    InvalidMemoryOperation(String),
    ScopeMismatch(String),
    SensitiveDataRejected(String),
    NotFound(String),
}

impl Display for MemoryError {
    fn fmt(&self, f: &mut Formatter<'_>) -> FmtResult {
        match self {
            MemoryError::ProviderUnavailable(message) => {
                write!(f, "Memory provider unavailable: {message}")
            }
            MemoryError::InvalidEndpoint(message) => {
                write!(f, "Invalid memory endpoint: {message}")
            }
            MemoryError::AuthenticationFailure => {
                write!(f, "Memory provider authentication failed")
            }
            MemoryError::UnsupportedModel(model) => {
                write!(f, "Memory model is unsupported: {model}")
            }
            MemoryError::StructuredOutputFailure(message) => {
                write!(f, "Memory structured output failed: {message}")
            }
            MemoryError::EmbeddingFailure(message) => {
                write!(f, "Memory embedding failed: {message}")
            }
            MemoryError::StorageFailure(message) => write!(f, "Memory storage failed: {message}"),
            MemoryError::Timeout => write!(f, "Memory request timed out"),
            MemoryError::InvalidMemoryOperation(message) => {
                write!(f, "Invalid memory operation: {message}")
            }
            MemoryError::ScopeMismatch(message) => write!(f, "Memory scope mismatch: {message}"),
            MemoryError::SensitiveDataRejected(message) => {
                write!(f, "Sensitive memory data rejected: {message}")
            }
            MemoryError::NotFound(message) => write!(f, "Memory not found: {message}"),
        }
    }
}

impl From<sqlx::Error> for MemoryError {
    fn from(error: sqlx::Error) -> Self {
        MemoryError::StorageFailure(error.to_string())
    }
}

impl From<serde_json::Error> for MemoryError {
    fn from(error: serde_json::Error) -> Self {
        MemoryError::StorageFailure(error.to_string())
    }
}

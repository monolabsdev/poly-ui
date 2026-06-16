use crate::memory::error::MemoryError;
use crate::memory::types::{MemoryRecord, MemorySyncOperation};
use async_trait::async_trait;

#[derive(Debug, Clone)]
pub struct MemorySyncRequest {
    pub provider: String,
    pub operation: MemorySyncOperation,
    pub record: Option<MemoryRecord>,
    pub local_memory_id: Option<String>,
}

#[async_trait]
pub trait MemorySyncProvider: Send + Sync {
    async fn sync(&self, request: MemorySyncRequest) -> Result<(), MemoryError>;
}

#[derive(Debug, Clone, Default)]
pub struct DisabledMemorySyncProvider;

#[async_trait]
impl MemorySyncProvider for DisabledMemorySyncProvider {
    async fn sync(&self, _request: MemorySyncRequest) -> Result<(), MemoryError> {
        Ok(())
    }
}

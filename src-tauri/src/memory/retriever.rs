use crate::memory::error::MemoryError;
use crate::memory::types::{MemoryRecallQuery, MemoryRecord};
use async_trait::async_trait;

#[async_trait]
pub trait MemoryRetriever: Send + Sync {
    async fn recall(&self, query: MemoryRecallQuery) -> Result<Vec<MemoryRecord>, MemoryError>;
}

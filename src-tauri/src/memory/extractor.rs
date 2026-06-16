use crate::memory::error::MemoryError;
use crate::memory::types::{MemoryOperation, MemoryTurnInput};
use async_trait::async_trait;

#[async_trait]
pub trait MemoryExtractor: Send + Sync {
    async fn extract(&self, input: MemoryTurnInput) -> Result<Vec<MemoryOperation>, MemoryError>;
}

#[derive(Debug, Clone, Default)]
pub struct DisabledMemoryExtractor;

#[async_trait]
impl MemoryExtractor for DisabledMemoryExtractor {
    async fn extract(&self, _input: MemoryTurnInput) -> Result<Vec<MemoryOperation>, MemoryError> {
        Ok(Vec::new())
    }
}

use crate::memory::context::DefaultMemoryContextBuilder;
use crate::memory::context::MemoryContextBuilder;
use crate::memory::error::MemoryError;
use crate::memory::extractor::{DisabledMemoryExtractor, MemoryExtractor};
use crate::memory::filter::{DeterministicSensitiveDataFilter, SensitiveDataFilter};
use crate::memory::processing::completed_turn_id;
use crate::memory::repository::{MemoryRepository, SqliteMemoryRepository};
use crate::memory::types::{
    MemoryCategory, MemoryCompletedTurnInput, MemoryCompletedTurnRecordInput, MemoryListQuery,
    MemoryOperation, MemoryOperationKind, MemoryOperationResult, MemoryProcessingRecord,
    MemoryRecallQuery, MemoryRecord, MemoryScope, MemoryScopeOwner, MemorySearchQuery,
    MemorySettings, MemoryTurnInput, MemoryUpdateInput, ProcessingState,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{Row, SqlitePool};

#[derive(Clone)]
pub struct MemoryService {
    pool: SqlitePool,
    repository: SqliteMemoryRepository,
    sensitive_filter: DeterministicSensitiveDataFilter,
    context_builder: DefaultMemoryContextBuilder,
    extractor: DisabledMemoryExtractor,
}

impl MemoryService {
    pub fn new(pool: SqlitePool) -> Self {
        Self {
            repository: SqliteMemoryRepository::new(pool.clone()),
            pool,
            sensitive_filter: DeterministicSensitiveDataFilter,
            context_builder: DefaultMemoryContextBuilder,
            extractor: DisabledMemoryExtractor,
        }
    }

    pub async fn get_settings(&self, owner_id: &str) -> Result<MemorySettings, MemoryError> {
        self.repository.get_settings(owner_id).await
    }

    pub async fn update_settings(
        &self,
        settings: MemorySettings,
    ) -> Result<MemorySettings, MemoryError> {
        self.repository.update_settings(settings).await
    }

    pub async fn list(&self, query: MemoryListQuery) -> Result<Vec<MemoryRecord>, MemoryError> {
        self.repository.list(query).await
    }

    pub async fn search(&self, query: MemorySearchQuery) -> Result<Vec<MemoryRecord>, MemoryError> {
        self.repository.search(query).await
    }

    pub async fn update(&self, input: MemoryUpdateInput) -> Result<MemoryRecord, MemoryError> {
        if let Some(value) = input.value.as_ref() {
            self.reject_sensitive_json(value)?;
        }
        if let Some(summary) = input.summary.as_deref() {
            self.reject_sensitive_text(summary)?;
        }
        self.repository.update_memory(input).await
    }

    pub async fn delete(&self, owner_id: &str, memory_id: &str) -> Result<(), MemoryError> {
        let provider = self.sync_provider_for_owner(owner_id).await?;
        self.repository
            .delete_memory(owner_id, memory_id, provider.as_deref())
            .await
    }

    pub async fn clear_scope(
        &self,
        owner_id: &str,
        scope: MemoryScope,
        scope_owner_id: Option<&str>,
    ) -> Result<(), MemoryError> {
        let provider = self.sync_provider_for_owner(owner_id).await?;
        self.repository
            .clear_scope(owner_id, scope, scope_owner_id, provider.as_deref())
            .await
    }

    pub async fn clear_all(&self, owner_id: &str) -> Result<(), MemoryError> {
        let provider = self.sync_provider_for_owner(owner_id).await?;
        self.repository
            .clear_all(owner_id, provider.as_deref())
            .await
    }

    pub async fn remember_message(
        &self,
        input: MemoryRememberMessageInput,
    ) -> Result<Vec<MemoryOperationResult>, MemoryError> {
        self.reject_sensitive_json(&input.value)?;
        self.reject_sensitive_text(&input.summary)?;
        let provider = self.sync_provider_for_owner(&input.owner_id).await?;
        let operation = MemoryOperation {
            operation: MemoryOperationKind::Add,
            memory_id: None,
            scope: input.scope,
            scope_owner_id: input.scope_owner_id,
            category: input.category,
            canonical_key: input.canonical_key,
            value: Some(input.value),
            summary: Some(input.summary),
            confidence: Some(input.confidence.unwrap_or(0.85)),
            importance: Some(input.importance.unwrap_or(0.7)),
            source_chat_id: input.source_chat_id,
            source_message_ids: input.source_message_ids,
        };
        self.repository
            .apply_operations(&input.owner_id, vec![operation], provider.as_deref())
            .await
    }

    pub async fn forget_message(&self, input: MemoryForgetMessageInput) -> Result<(), MemoryError> {
        if let Some(memory_id) = input.memory_id {
            return self.delete(&input.owner_id, &memory_id).await;
        }
        let canonical_key = input.canonical_key.ok_or_else(|| {
            MemoryError::InvalidMemoryOperation(
                "forget requires memory id or canonical key".to_string(),
            )
        })?;
        let provider = self.sync_provider_for_owner(&input.owner_id).await?;
        let operation = MemoryOperation {
            operation: MemoryOperationKind::Delete,
            memory_id: None,
            scope: input.scope,
            scope_owner_id: input.scope_owner_id,
            category: MemoryCategory::Other,
            canonical_key: Some(canonical_key),
            value: None,
            summary: None,
            confidence: None,
            importance: None,
            source_chat_id: input.source_chat_id,
            source_message_ids: input.source_message_ids,
        };
        self.repository
            .apply_operations(&input.owner_id, vec![operation], provider.as_deref())
            .await?;
        Ok(())
    }

    pub async fn enqueue_completed_turn(
        &self,
        input: MemoryCompletedTurnInput,
    ) -> Result<MemoryProcessingRecord, MemoryError> {
        let settings = self.get_settings(&input.owner_id).await?;
        if !settings.enabled || !settings.automatic_extraction {
            return Ok(skipped_processing_record(
                &input,
                "memory is disabled or automatic extraction is off",
            ));
        }
        let mut record_input = self.load_completed_turn(input).await?;
        if record_input.skip_reason.is_none()
            && self
                .reject_sensitive_text(&record_input.user_content)
                .or_else(|_| self.reject_sensitive_text(&record_input.assistant_content))
                .is_err()
        {
            record_input.skip_reason = Some("turn contains sensitive data".to_string());
        }
        self.repository.enqueue_completed_turn(record_input).await
    }

    pub async fn process_completed_turn(
        &self,
        input: MemoryCompletedTurnInput,
    ) -> Result<MemoryProcessingRecord, MemoryError> {
        let queued = self.enqueue_completed_turn(input).await?;
        if !matches!(
            queued.state,
            ProcessingState::Pending | ProcessingState::Failed
        ) {
            return Ok(queued);
        }
        self.process_queued_turn(&queued.turn_id).await
    }

    pub async fn process_queued_turn(
        &self,
        turn_id: &str,
    ) -> Result<MemoryProcessingRecord, MemoryError> {
        let Some(claimed) = self.repository.claim_processing_turn(turn_id).await? else {
            return self
                .repository
                .get_processing_turn(turn_id)
                .await?
                .ok_or_else(|| MemoryError::NotFound(turn_id.to_string()));
        };

        let settings = self.get_settings(&claimed.owner_id).await?;
        if !settings.enabled || !settings.automatic_extraction {
            return self
                .repository
                .finish_processing_turn(
                    turn_id,
                    ProcessingState::Skipped,
                    Some("memory is disabled or automatic extraction is off"),
                )
                .await;
        }

        let record_input = self
            .load_completed_turn(MemoryCompletedTurnInput {
                owner_id: claimed.owner_id.clone(),
                conversation_id: claimed.conversation_id.clone(),
                user_message_id: claimed.user_message_id.clone(),
                assistant_message_id: claimed.assistant_message_id.clone(),
            })
            .await?;

        if let Some(reason) = record_input.skip_reason.as_deref() {
            return self
                .repository
                .finish_processing_turn(turn_id, ProcessingState::Skipped, Some(reason))
                .await;
        }

        if self
            .reject_sensitive_text(&record_input.user_content)
            .or_else(|_| self.reject_sensitive_text(&record_input.assistant_content))
            .is_err()
        {
            return self
                .repository
                .finish_processing_turn(
                    turn_id,
                    ProcessingState::Skipped,
                    Some("turn contains sensitive data"),
                )
                .await;
        }

        let scopes = self.enabled_scopes(
            &record_input.owner_id,
            record_input.project_scope_owner_id.as_deref(),
            record_input.chat_scope_owner_id.as_deref(),
            record_input.agent_scope_owner_id.as_deref(),
            &settings,
        );

        if scopes.is_empty() {
            return self
                .repository
                .finish_processing_turn(
                    turn_id,
                    ProcessingState::Skipped,
                    Some("no enabled memory scopes matched this turn"),
                )
                .await;
        }

        let turn = MemoryTurnInput {
            owner_id: record_input.owner_id.clone(),
            conversation_id: record_input.conversation_id.clone(),
            user_message_id: record_input.user_message_id.clone(),
            assistant_message_id: record_input.assistant_message_id.clone(),
            user_content: record_input.user_content.clone(),
            assistant_content: record_input.assistant_content.clone(),
            scopes: scopes.clone(),
        };

        let operations = match self.extractor.extract(turn).await {
            Ok(operations) => operations,
            Err(error) => {
                log::warn!("Memory extraction failed for turn {turn_id}: {error}");
                return self
                    .repository
                    .finish_processing_turn(
                        turn_id,
                        ProcessingState::Failed,
                        Some("memory extraction failed"),
                    )
                    .await;
            }
        };

        if operations.is_empty() {
            return self
                .repository
                .finish_processing_turn(turn_id, ProcessingState::Completed, None)
                .await;
        }

        let operations = self.prepare_extracted_operations(&record_input, &scopes, operations)?;
        let provider = self.sync_provider_for_owner(&record_input.owner_id).await?;
        if let Err(error) = self
            .repository
            .apply_operations(&record_input.owner_id, operations, provider.as_deref())
            .await
        {
            log::warn!("Memory canonical write failed for turn {turn_id}: {error}");
            return self
                .repository
                .finish_processing_turn(
                    turn_id,
                    ProcessingState::Failed,
                    Some("memory canonical write failed"),
                )
                .await;
        }

        self.repository
            .finish_processing_turn(turn_id, ProcessingState::Completed, None)
            .await
    }

    pub async fn build_context_for_chat(
        &self,
        owner_id: &str,
        conversation_id: &str,
        query: &str,
    ) -> Result<String, MemoryError> {
        let owner_id = owner_id.trim();
        if owner_id.is_empty() {
            return Ok(String::new());
        }
        let settings = self.get_settings(owner_id).await?;
        if !settings.enabled {
            return Ok(String::new());
        }

        let Some(conversation) = self.load_conversation(conversation_id).await? else {
            if !settings.allow_temporary_recall {
                return Ok(String::new());
            }
            let scopes = self.enabled_scopes(owner_id, None, None, None, &settings);
            let records = self
                .repository
                .recall(MemoryRecallQuery {
                    owner_id: owner_id.to_string(),
                    query: query.to_string(),
                    scopes,
                    limit: settings.retrieval_limit,
                    token_budget: settings.token_budget,
                })
                .await?;
            return Ok(self
                .context_builder
                .build_context(&records, settings.token_budget as usize));
        };

        let scopes = self.enabled_scopes(
            owner_id,
            conversation.folder_id.as_deref(),
            Some(conversation.id.as_str()),
            None,
            &settings,
        );
        let records = self
            .repository
            .recall(MemoryRecallQuery {
                owner_id: owner_id.to_string(),
                query: query.to_string(),
                scopes,
                limit: settings.retrieval_limit,
                token_budget: settings.token_budget,
            })
            .await?;
        Ok(self
            .context_builder
            .build_context(&records, settings.token_budget as usize))
    }

    pub async fn test_connection(
        &self,
        owner_id: &str,
    ) -> Result<MemoryConnectionTestResult, MemoryError> {
        let settings = self.get_settings(owner_id).await?;
        let ok = !settings.enabled || settings.provider == "disabled";
        Ok(MemoryConnectionTestResult {
            ok,
            provider: settings.provider,
            locality: settings.locality,
            message: if ok {
                "Native memory storage ready".to_string()
            } else {
                "External memory provider is not implemented in this build".to_string()
            },
        })
    }

    async fn sync_provider_for_owner(&self, owner_id: &str) -> Result<Option<String>, MemoryError> {
        let settings = self.get_settings(owner_id).await?;
        Ok(settings
            .enabled
            .then_some(settings.provider)
            .filter(|provider| provider != "disabled"))
    }

    fn prepare_extracted_operations(
        &self,
        turn: &MemoryCompletedTurnRecordInput,
        scopes: &[MemoryScopeOwner],
        operations: Vec<MemoryOperation>,
    ) -> Result<Vec<MemoryOperation>, MemoryError> {
        operations
            .into_iter()
            .map(|mut operation| {
                if !scopes.iter().any(|scope| {
                    scope.scope == operation.scope
                        && scope.scope_owner_id == operation.scope_owner_id
                }) {
                    return Err(MemoryError::ScopeMismatch(format!(
                        "{}:{}",
                        operation.scope, operation.scope_owner_id
                    )));
                }
                if let Some(value) = operation.value.as_ref() {
                    self.reject_sensitive_json(value)?;
                }
                if let Some(summary) = operation.summary.as_deref() {
                    self.reject_sensitive_text(summary)?;
                }
                if operation.source_chat_id.is_none() {
                    operation.source_chat_id = Some(turn.conversation_id.clone());
                }
                if operation.source_message_ids.is_empty() {
                    operation.source_message_ids = vec![
                        turn.user_message_id.clone(),
                        turn.assistant_message_id.clone(),
                    ];
                }
                Ok(operation)
            })
            .collect()
    }

    async fn load_completed_turn(
        &self,
        input: MemoryCompletedTurnInput,
    ) -> Result<MemoryCompletedTurnRecordInput, MemoryError> {
        let conversation = self.load_conversation(&input.conversation_id).await?;
        let Some(conversation) = conversation else {
            return Ok(MemoryCompletedTurnRecordInput {
                owner_id: input.owner_id.clone(),
                conversation_id: input.conversation_id,
                user_message_id: input.user_message_id,
                assistant_message_id: input.assistant_message_id,
                user_scope_owner_id: Some(input.owner_id),
                project_scope_owner_id: None,
                chat_scope_owner_id: None,
                agent_scope_owner_id: None,
                skip_reason: Some("conversation is not persisted".to_string()),
                user_content: String::new(),
                assistant_content: String::new(),
                assistant_status: None,
            });
        };

        let user = self
            .load_message(&input.conversation_id, &input.user_message_id)
            .await?;
        let assistant = self
            .load_message(&input.conversation_id, &input.assistant_message_id)
            .await?;

        let skip_reason = match (&user, &assistant) {
            (None, _) => Some("user message is not persisted".to_string()),
            (_, None) => Some("assistant message is not persisted".to_string()),
            (Some(user), _) if user.role != "user" => {
                Some("user message id does not reference a user message".to_string())
            }
            (_, Some(assistant)) if assistant.role != "assistant" => {
                Some("assistant message id does not reference an assistant message".to_string())
            }
            (_, Some(assistant)) if assistant.status.as_deref() != Some("complete") => {
                Some("assistant message was not completed successfully".to_string())
            }
            _ => None,
        };

        let agent_scope_owner_id = assistant
            .as_ref()
            .and_then(|message| message.agent_id.clone());
        let assistant_content = assistant
            .as_ref()
            .map(|message| message.content.clone())
            .unwrap_or_default();
        let assistant_status = assistant
            .as_ref()
            .and_then(|message| message.status.clone());

        Ok(MemoryCompletedTurnRecordInput {
            owner_id: input.owner_id.clone(),
            conversation_id: input.conversation_id,
            user_message_id: input.user_message_id,
            assistant_message_id: input.assistant_message_id,
            user_scope_owner_id: Some(input.owner_id),
            project_scope_owner_id: conversation.folder_id,
            chat_scope_owner_id: Some(conversation.id),
            agent_scope_owner_id,
            skip_reason,
            user_content: user.map(|message| message.content).unwrap_or_default(),
            assistant_content,
            assistant_status,
        })
    }

    async fn load_conversation(
        &self,
        conversation_id: &str,
    ) -> Result<Option<PersistedConversation>, MemoryError> {
        let row = sqlx::query("SELECT id, folderId FROM conversations WHERE id = ?1")
            .bind(conversation_id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(row.map(|row| PersistedConversation {
            id: row.get("id"),
            folder_id: row.get("folderId"),
        }))
    }

    async fn load_message(
        &self,
        conversation_id: &str,
        message_id: &str,
    ) -> Result<Option<PersistedMessage>, MemoryError> {
        let row = sqlx::query(
            "SELECT id, role, content, status, agent FROM messages WHERE id = ?1 AND conversationId = ?2",
        )
        .bind(message_id)
        .bind(conversation_id)
        .fetch_optional(&self.pool)
        .await?;
        Ok(row.map(|row| {
            let agent_json: Option<String> = row.get("agent");
            PersistedMessage {
                role: row.get("role"),
                content: row.get("content"),
                status: row.get("status"),
                agent_id: agent_json.and_then(|value| extract_agent_scope_id(&value)),
            }
        }))
    }

    fn enabled_scopes(
        &self,
        owner_id: &str,
        project_id: Option<&str>,
        chat_id: Option<&str>,
        agent_id: Option<&str>,
        settings: &MemorySettings,
    ) -> Vec<MemoryScopeOwner> {
        let mut scopes = Vec::new();
        if settings.enable_user_memory {
            scopes.push(MemoryScopeOwner {
                scope: MemoryScope::User,
                scope_owner_id: owner_id.to_string(),
            });
        }
        if settings.enable_project_memory {
            if let Some(project_id) = project_id.filter(|value| !value.trim().is_empty()) {
                scopes.push(MemoryScopeOwner {
                    scope: MemoryScope::Project,
                    scope_owner_id: project_id.to_string(),
                });
            }
        }
        if settings.enable_chat_memory {
            if let Some(chat_id) = chat_id.filter(|value| !value.trim().is_empty()) {
                scopes.push(MemoryScopeOwner {
                    scope: MemoryScope::Chat,
                    scope_owner_id: chat_id.to_string(),
                });
            }
        }
        if settings.enable_agent_memory {
            if let Some(agent_id) = agent_id.filter(|value| !value.trim().is_empty()) {
                scopes.push(MemoryScopeOwner {
                    scope: MemoryScope::Agent,
                    scope_owner_id: agent_id.to_string(),
                });
            }
        }
        scopes
    }

    fn reject_sensitive_json(&self, value: &Value) -> Result<(), MemoryError> {
        self.reject_sensitive_text(&value.to_string())
    }

    fn reject_sensitive_text(&self, text: &str) -> Result<(), MemoryError> {
        let result = self.sensitive_filter.inspect(text);
        if result.rejected {
            let kinds = result
                .findings
                .iter()
                .map(|finding| finding.kind.as_str())
                .collect::<Vec<_>>()
                .join(", ");
            return Err(MemoryError::SensitiveDataRejected(kinds));
        }
        Ok(())
    }
}

fn skipped_processing_record(
    input: &MemoryCompletedTurnInput,
    reason: &str,
) -> MemoryProcessingRecord {
    let now = Utc::now();
    MemoryProcessingRecord {
        turn_id: completed_turn_id(
            &input.conversation_id,
            &input.user_message_id,
            &input.assistant_message_id,
        ),
        owner_id: input.owner_id.clone(),
        conversation_id: input.conversation_id.clone(),
        user_message_id: input.user_message_id.clone(),
        assistant_message_id: input.assistant_message_id.clone(),
        state: crate::memory::types::ProcessingState::Skipped,
        attempts: 0,
        last_error: Some(reason.to_string()),
        created_at: now,
        updated_at: now,
        completed_at: Some(now),
    }
}

#[derive(Debug, Clone)]
struct PersistedConversation {
    id: String,
    folder_id: Option<String>,
}

#[derive(Debug, Clone)]
struct PersistedMessage {
    role: String,
    content: String,
    status: Option<String>,
    agent_id: Option<String>,
}

fn extract_agent_scope_id(agent_json: &str) -> Option<String> {
    let value = serde_json::from_str::<Value>(agent_json).ok()?;
    value
        .get("workspaceSelection")
        .and_then(|selection| {
            selection
                .get("projectId")
                .or_else(|| selection.get("chatId"))
                .and_then(Value::as_str)
        })
        .map(str::to_string)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryRememberMessageInput {
    pub owner_id: String,
    pub scope: MemoryScope,
    pub scope_owner_id: String,
    pub category: MemoryCategory,
    pub canonical_key: Option<String>,
    pub value: Value,
    pub summary: String,
    pub confidence: Option<f32>,
    pub importance: Option<f32>,
    pub source_chat_id: Option<String>,
    pub source_message_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryForgetMessageInput {
    pub owner_id: String,
    pub memory_id: Option<String>,
    pub scope: MemoryScope,
    pub scope_owner_id: String,
    pub canonical_key: Option<String>,
    pub source_chat_id: Option<String>,
    pub source_message_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryRelatedQuery {
    pub owner_id: String,
    pub message_id: Option<String>,
    pub query: Option<String>,
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryConnectionTestResult {
    pub ok: bool,
    pub provider: String,
    pub locality: String,
    pub message: String,
}

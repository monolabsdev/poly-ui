use crate::memory::service::MemoryService;
use crate::memory::service::{
    MemoryConnectionTestResult, MemoryForgetMessageInput, MemoryRelatedQuery,
    MemoryRememberMessageInput,
};
use crate::memory::types::{
    MemoryCompletedTurnInput, MemoryListQuery, MemoryProcessingRecord, MemoryRecord, MemoryScope,
    MemorySearchQuery, MemorySettings, MemoryUpdateInput,
};
use crate::AppState;

fn service(state: &tauri::State<'_, AppState>) -> MemoryService {
    MemoryService::new(state.db.clone())
}

#[tauri::command]
pub async fn memory_get_settings(
    state: tauri::State<'_, AppState>,
    owner_id: String,
) -> Result<MemorySettings, String> {
    service(&state)
        .get_settings(&owner_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn memory_update_settings(
    state: tauri::State<'_, AppState>,
    settings: MemorySettings,
) -> Result<MemorySettings, String> {
    service(&state)
        .update_settings(settings)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn memory_test_connection(
    state: tauri::State<'_, AppState>,
    owner_id: String,
) -> Result<MemoryConnectionTestResult, String> {
    service(&state)
        .test_connection(&owner_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn memory_list(
    state: tauri::State<'_, AppState>,
    query: MemoryListQuery,
) -> Result<Vec<MemoryRecord>, String> {
    service(&state)
        .list(query)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn memory_search(
    state: tauri::State<'_, AppState>,
    query: MemorySearchQuery,
) -> Result<Vec<MemoryRecord>, String> {
    service(&state)
        .search(query)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn memory_update(
    state: tauri::State<'_, AppState>,
    input: MemoryUpdateInput,
) -> Result<MemoryRecord, String> {
    service(&state)
        .update(input)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn memory_delete(
    state: tauri::State<'_, AppState>,
    owner_id: String,
    memory_id: String,
) -> Result<(), String> {
    service(&state)
        .delete(&owner_id, &memory_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn memory_clear_scope(
    state: tauri::State<'_, AppState>,
    owner_id: String,
    scope: MemoryScope,
    scope_owner_id: Option<String>,
) -> Result<(), String> {
    service(&state)
        .clear_scope(&owner_id, scope, scope_owner_id.as_deref())
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn memory_clear_all(
    state: tauri::State<'_, AppState>,
    owner_id: String,
) -> Result<(), String> {
    service(&state)
        .clear_all(&owner_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn memory_remember_message(
    state: tauri::State<'_, AppState>,
    input: MemoryRememberMessageInput,
) -> Result<Vec<crate::memory::types::MemoryOperationResult>, String> {
    service(&state)
        .remember_message(input)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn memory_forget_message(
    state: tauri::State<'_, AppState>,
    input: MemoryForgetMessageInput,
) -> Result<(), String> {
    service(&state)
        .forget_message(input)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn memory_get_related(
    state: tauri::State<'_, AppState>,
    query: MemoryRelatedQuery,
) -> Result<Vec<MemoryRecord>, String> {
    let search = MemorySearchQuery {
        owner_id: query.owner_id,
        query: query.query.or(query.message_id).unwrap_or_default(),
        scope: None,
        scope_owner_id: None,
        category: None,
        include_inactive: false,
        include_deleted: false,
        limit: query.limit,
    };
    service(&state)
        .search(search)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn memory_enqueue_completed_turn(
    state: tauri::State<'_, AppState>,
    input: MemoryCompletedTurnInput,
) -> Result<MemoryProcessingRecord, String> {
    service(&state)
        .process_completed_turn(input)
        .await
        .map_err(|error| error.to_string())
}

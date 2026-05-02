use crate::{services::user_service::UserService, AppState};
use serde::Deserialize;
use tauri::State;

use crate::repository::user_repository::User;

#[derive(Debug, Deserialize)]
pub struct CreateUserRequest {
    pub name: String,
    pub email: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateUserRequest {
    pub id: i64,
    pub name: String,
    pub email: String,
}

/// Tauri command layer. Convert invoke payloads into service calls.
#[tauri::command]
pub async fn create_user(
    state: State<'_, AppState>,
    payload: CreateUserRequest,
) -> Result<User, String> {
    UserService::create(&state.db, payload.name, payload.email).await
}

#[tauri::command]
pub async fn list_users(state: State<'_, AppState>) -> Result<Vec<User>, String> {
    UserService::list(&state.db).await
}

#[tauri::command]
pub async fn get_user(state: State<'_, AppState>, id: i64) -> Result<User, String> {
    UserService::get(&state.db, id).await
}

#[tauri::command]
pub async fn update_user(
    state: State<'_, AppState>,
    payload: UpdateUserRequest,
) -> Result<User, String> {
    UserService::update(&state.db, payload.id, payload.name, payload.email).await
}

#[tauri::command]
pub async fn delete_user(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    UserService::delete(&state.db, id).await
}

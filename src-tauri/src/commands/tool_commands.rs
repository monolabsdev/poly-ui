use crate::AppState;
use crate::tools::{ToolApprovalResponse, ToolDefinition};

#[tauri::command]
pub async fn list_tools(state: tauri::State<'_, AppState>) -> Result<Vec<ToolDefinition>, String> {
    Ok(state.tool_registry.list_tools().await)
}

#[tauri::command]
pub async fn toggle_tool(
    state: tauri::State<'_, AppState>,
    name: String,
) -> Result<Option<bool>, String> {
    Ok(state.tool_registry.toggle_tool(&name).await)
}

#[tauri::command]
pub async fn approve_tool(
    state: tauri::State<'_, AppState>,
    response: ToolApprovalResponse,
) -> Result<(), String> {
    let pending = {
        let mut approvals = state.pending_approvals.lock().map_err(|e| e.to_string())?;
        approvals.remove(&response.invocation_id)
    };

    let Some(pending) = pending else {
        return Ok(());
    };

    if response.always_allow && response.approved {
        state
            .tool_registry
            .set_always_allowed(&pending.tool_name, true)
            .await;
    }

    let _ = pending.sender.send(response.approved);

    Ok(())
}

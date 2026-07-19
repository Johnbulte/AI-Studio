use std::{sync::Arc, time::{SystemTime, UNIX_EPOCH}};

use futures_util::StreamExt;
use tauri::{AppHandle, Emitter, State};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use crate::{
  auth,
  gateway::{self, parse_sse_event},
  media::{self, MediaPollState},
  models::{AppError, ChatEvent, ChatStartArgs, ChatStartResult, ConversationSummary, ImageGenerationArgs, LoginArgs, MediaConfig, MediaEvent, MediaRunSummary, MediaStartResult, MessageRecord, SaveMediaConfigArgs, ServerConfig, SessionSnapshot, VideoGenerationArgs},
  state::{AppState, SessionData},
  storage,
};

fn timestamp() -> String {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|duration| duration.as_millis().to_string())
    .unwrap_or_else(|_| "0".to_string())
}

fn unauthorized_error() -> AppError {
  AppError::new("unauthorized", "登录状态已失效，请重新登录", false)
}

fn require_session(state: &AppState) -> Result<SessionData, AppError> {
  state.current_session()?.ok_or_else(unauthorized_error)
}

fn require_config(state: &AppState) -> Result<ServerConfig, AppError> {
  let config = state.config()?;
  crate::models::validate_server_config(&config.base_url, &config.chat_model)
}

fn require_media_credentials(state: &AppState) -> Result<(crate::models::MediaConfigInput, String), AppError> {
  let config = crate::models::validate_media_config(&state.media_config()?)?;
  let api_key = auth::load_duomi_api_key()?
    .filter(|api_key| !api_key.trim().is_empty())
    .ok_or_else(|| AppError::new("media_api_key_missing", "请先在设置中填写多米 API Key", false))?;
  Ok((config, api_key))
}

async fn refresh_session(state: &AppState, config: &ServerConfig, refresh_token: &str) -> Result<SessionData, AppError> {
  let response = auth::refresh(&state.http, &config.base_url, refresh_token).await?;
  let tokens = auth::tokens_from_response(&response);
  auth::save_tokens(&tokens)?;
  let session = SessionData { tokens, user: response.user };
  {
    let database = state.database()?;
    storage::save_user(&database, &session.user)?;
  }
  state.set_session(Some(session.clone()))?;
  Ok(session)
}

#[tauri::command]
pub fn load_server_config(state: State<'_, AppState>) -> Result<ServerConfig, AppError> {
  state.config()
}

#[tauri::command]
pub fn save_server_config(state: State<'_, AppState>, config: ServerConfig) -> Result<ServerConfig, AppError> {
  let config = crate::models::validate_server_config(&config.base_url, &config.chat_model)?;
  {
    let database = state.database()?;
    storage::save_server_config(&database, &config)?;
  }
  state.set_config(config.clone())?;
  Ok(config)
}

#[tauri::command]
pub fn load_media_config(state: State<'_, AppState>) -> Result<MediaConfig, AppError> {
  let config = crate::models::validate_media_config(&state.media_config()?)?;
  Ok(MediaConfig {
    base_url: config.base_url,
    image_model: config.image_model,
    video_model: config.video_model,
    api_key_configured: auth::load_duomi_api_key()?.is_some_and(|api_key| !api_key.trim().is_empty()),
  })
}

#[tauri::command]
pub fn save_media_config(state: State<'_, AppState>, args: SaveMediaConfigArgs) -> Result<MediaConfig, AppError> {
  let config = crate::models::validate_media_config(&args.config)?;
  if let Some(api_key) = args.api_key {
    if api_key.trim().is_empty() {
      auth::clear_duomi_api_key()?;
    } else {
      auth::save_duomi_api_key(&api_key)?;
    }
  }
  {
    let database = state.database()?;
    storage::save_media_config(&database, &config)?;
  }
  state.set_media_config(config.clone())?;
  load_media_config(state)
}

#[tauri::command]
pub async fn login(state: State<'_, AppState>, args: LoginArgs) -> Result<SessionSnapshot, AppError> {
  if args.email.trim().is_empty() || args.password.is_empty() {
    return Err(AppError::new("invalid_credentials", "邮箱和密码不能为空", false));
  }
  let config = require_config(&state)?;
  let response = auth::login(&state.http, &config.base_url, &args).await?;
  let tokens = auth::tokens_from_response(&response);
  auth::save_tokens(&tokens)?;
  let session = SessionData { tokens, user: response.user };
  {
    let database = state.database()?;
    storage::save_user(&database, &session.user)?;
  }
  state.set_session(Some(session.clone()))?;
  Ok(SessionSnapshot { authenticated: true, user: Some(session.user) })
}

#[tauri::command]
pub async fn restore_session(state: State<'_, AppState>) -> Result<SessionSnapshot, AppError> {
  let Some(tokens) = auth::load_tokens()? else {
    return Ok(SessionSnapshot { authenticated: false, user: None });
  };
  let config = match require_config(&state) {
    Ok(config) => config,
    Err(_) => {
      let _ = auth::clear_tokens();
      return Ok(SessionSnapshot { authenticated: false, user: None });
    }
  };
  let session = match refresh_session(&state, &config, &tokens.refresh_token).await {
    Ok(session) => session,
    Err(_) => {
      let _ = auth::clear_tokens();
      state.set_session(None)?;
      return Ok(SessionSnapshot { authenticated: false, user: None });
    }
  };
  Ok(SessionSnapshot { authenticated: true, user: Some(session.user) })
}

#[tauri::command]
pub async fn logout(state: State<'_, AppState>) -> Result<(), AppError> {
  if let (Ok(Some(session)), Ok(config)) = (state.current_session(), state.config()) {
    let _ = auth::logout(&state.http, &config.base_url, &session.tokens.access_token).await;
  }
  auth::clear_tokens()?;
  state.set_session(None)
}

#[tauri::command]
pub async fn test_connection(state: State<'_, AppState>) -> Result<(), AppError> {
  let config = require_config(&state)?;
  let session = require_session(&state)?;
  match gateway::test_connection(&state.http, &config, &session.tokens.access_token).await {
    Ok(()) => Ok(()),
    Err(error) if error.code == "unauthorized" => {
      let refreshed = refresh_session(&state, &config, &session.tokens.refresh_token).await?;
      gateway::test_connection(&state.http, &config, &refreshed.tokens.access_token).await
    }
    Err(error) => Err(error),
  }
}

#[tauri::command]
pub fn list_conversations(state: State<'_, AppState>) -> Result<Vec<ConversationSummary>, AppError> {
  let database = state.database()?;
  storage::list_conversations(&database)
}

#[tauri::command]
pub fn load_conversation(state: State<'_, AppState>, conversation_id: String) -> Result<Vec<MessageRecord>, AppError> {
  let database = state.database()?;
  storage::load_messages(&database, &conversation_id)
}

#[tauri::command]
pub fn create_conversation(state: State<'_, AppState>, title: String) -> Result<String, AppError> {
  let database = state.database()?;
  storage::create_conversation(&database, &title)
}

#[tauri::command]
pub fn list_media_runs(state: State<'_, AppState>) -> Result<Vec<MediaRunSummary>, AppError> {
  let database = state.database()?;
  storage::list_media_runs(&database)
}

fn emit_event(app: &AppHandle, name: &str, event: ChatEvent) {
  let _ = app.emit(name, event);
}

fn save_assistant_message(state: &AppState, conversation_id: &str, message_id: &str, content: &str, status: &str, error: Option<AppError>) {
  if let Ok(database) = state.database() {
    let _ = storage::save_message(
      &database,
      conversation_id,
      &MessageRecord {
        id: message_id.to_string(),
        role: "assistant".to_string(),
        content: content.to_string(),
        status: status.to_string(),
        error,
        created_at: timestamp(),
      },
    );
  }
}

async fn run_chat(
  app: AppHandle,
  state: AppState,
  config: ServerConfig,
  session: SessionData,
  args: ChatStartArgs,
  request_id: String,
  conversation_id: String,
  message_id: String,
  cancellation: CancellationToken,
) {
  let response = match gateway::open_chat_stream(&state.http, &config, &session.tokens.access_token, &args.messages).await {
    Ok(response) => response,
    Err(error) if error.code == "unauthorized" => match refresh_session(&state, &config, &session.tokens.refresh_token).await {
      Ok(refreshed) => match gateway::open_chat_stream(&state.http, &config, &refreshed.tokens.access_token, &args.messages).await {
        Ok(response) => response,
        Err(error) => {
          save_assistant_message(&state, &conversation_id, &message_id, "", "failed", Some(error.clone()));
          emit_event(&app, "ai://chat/failed", ChatEvent { request_id: request_id.clone(), conversation_id, message_id, delta: None, cancelled: false, error: Some(error) });
          remove_cancellation(&state, &request_id);
          return;
        }
      },
      Err(error) => {
        save_assistant_message(&state, &conversation_id, &message_id, "", "failed", Some(error.clone()));
        emit_event(&app, "ai://chat/failed", ChatEvent { request_id: request_id.clone(), conversation_id, message_id, delta: None, cancelled: false, error: Some(error) });
        remove_cancellation(&state, &request_id);
        return;
      }
    },
    Err(error) => {
      save_assistant_message(&state, &conversation_id, &message_id, "", "failed", Some(error.clone()));
      emit_event(&app, "ai://chat/failed", ChatEvent { request_id: request_id.clone(), conversation_id, message_id, delta: None, cancelled: false, error: Some(error) });
      remove_cancellation(&state, &request_id);
      return;
    }
  };

  let mut stream = response.bytes_stream();
  let mut buffer = String::new();
  let mut content = String::new();
  let mut completed = false;

  loop {
    tokio::select! {
      _ = cancellation.cancelled() => {
        save_assistant_message(&state, &conversation_id, &message_id, &content, "cancelled", None);
        emit_event(&app, "ai://chat/completed", ChatEvent { request_id: request_id.clone(), conversation_id: conversation_id.clone(), message_id: message_id.clone(), delta: None, cancelled: true, error: None });
        remove_cancellation(&state, &request_id);
        return;
      }
      next = stream.next() => {
        match next {
          Some(Ok(bytes)) => {
            buffer.push_str(&String::from_utf8_lossy(&bytes));
            while let Some((position, separator_length)) = gateway::next_sse_event_boundary(&buffer) {
              let raw_event = buffer[..position].replace("\r\n", "\n");
              buffer.drain(..position + separator_length);
              match parse_sse_event(&raw_event) {
                Ok(Some(crate::models::ParsedChatEvent::Delta(delta))) => {
                  content.push_str(&delta);
                  emit_event(&app, "ai://chat/delta", ChatEvent { request_id: request_id.clone(), conversation_id: conversation_id.clone(), message_id: message_id.clone(), delta: Some(delta), cancelled: false, error: None });
                }
                Ok(Some(crate::models::ParsedChatEvent::Done)) => {
                  completed = true;
                  break;
                }
                Ok(None) => {}
                Err(error) => {
                  save_assistant_message(&state, &conversation_id, &message_id, &content, "failed", Some(error.clone()));
                  emit_event(&app, "ai://chat/failed", ChatEvent { request_id: request_id.clone(), conversation_id: conversation_id.clone(), message_id: message_id.clone(), delta: None, cancelled: false, error: Some(error) });
                  remove_cancellation(&state, &request_id);
                  return;
                }
              }
            }
            if completed { break; }
          }
          Some(Err(error)) => {
            let app_error = AppError::new("network_error", format!("读取 AI 响应失败：{error}"), true);
            save_assistant_message(&state, &conversation_id, &message_id, &content, "failed", Some(app_error.clone()));
            emit_event(&app, "ai://chat/failed", ChatEvent { request_id: request_id.clone(), conversation_id: conversation_id.clone(), message_id: message_id.clone(), delta: None, cancelled: false, error: Some(app_error) });
            remove_cancellation(&state, &request_id);
            return;
          }
          None => break,
        }
      }
    }
  }

  if content.trim().is_empty() {
    let error = AppError::new("empty_response", "AI 返回了空消息", true);
    save_assistant_message(&state, &conversation_id, &message_id, &content, "failed", Some(error.clone()));
    emit_event(&app, "ai://chat/failed", ChatEvent { request_id: request_id.clone(), conversation_id: conversation_id.clone(), message_id: message_id.clone(), delta: None, cancelled: false, error: Some(error) });
  } else {
    save_assistant_message(&state, &conversation_id, &message_id, &content, "completed", None);
    emit_event(&app, "ai://chat/completed", ChatEvent { request_id: request_id.clone(), conversation_id: conversation_id.clone(), message_id: message_id.clone(), delta: None, cancelled: false, error: None });
  }
  remove_cancellation(&state, &request_id);
}

fn remove_cancellation(state: &AppState, request_id: &str) {
  if let Ok(mut cancellations) = state.cancellations.lock() {
    cancellations.remove(request_id);
  }
}

fn emit_media_event(app: &AppHandle, event_name: &str, event: MediaEvent) {
  let _ = app.emit(event_name, event);
}

fn finish_media_run(state: &AppState, request_id: &str, status: &str, error: Option<&AppError>, result_url: Option<&str>) {
  if let Ok(database) = state.database() {
    let _ = storage::finish_request_run(&database, request_id, status, error.map(|value| value.code.as_str()), result_url);
  }
}

async fn run_image_generation(
  app: AppHandle,
  state: Arc<AppState>,
  config: crate::models::MediaConfigInput,
  api_key: String,
  request_id: String,
  task_id: String,
  cancellation: CancellationToken,
) {
  for _ in 0..150 {
    tokio::select! {
      _ = cancellation.cancelled() => {
        finish_media_run(&state, &request_id, "cancelled", None, None);
        emit_media_event(&app, "ai://media/updated", MediaEvent { request_id: request_id.clone(), task_id: task_id.clone(), kind: "image".to_string(), status: "cancelled".to_string(), progress: None, result_url: None, error: None });
        remove_cancellation(&state, &request_id);
        return;
      }
      _ = tokio::time::sleep(std::time::Duration::from_secs(2)) => {}
    }

    match media::poll_image_task(&state.http, &config, &api_key, &task_id).await {
      Ok(MediaPollState::Pending { progress }) => {
        emit_media_event(&app, "ai://media/updated", MediaEvent { request_id: request_id.clone(), task_id: task_id.clone(), kind: "image".to_string(), status: "running".to_string(), progress, result_url: None, error: None });
      }
      Ok(MediaPollState::Succeeded { result_url }) => {
        finish_media_run(&state, &request_id, "completed", None, Some(&result_url));
        emit_media_event(&app, "ai://media/completed", MediaEvent { request_id: request_id.clone(), task_id: task_id.clone(), kind: "image".to_string(), status: "completed".to_string(), progress: Some(100), result_url: Some(result_url), error: None });
        remove_cancellation(&state, &request_id);
        return;
      }
      Ok(MediaPollState::Failed { message, retryable }) => {
        let error = AppError::new("media_generation_failed", message, retryable);
        finish_media_run(&state, &request_id, "failed", Some(&error), None);
        emit_media_event(&app, "ai://media/failed", MediaEvent { request_id: request_id.clone(), task_id: task_id.clone(), kind: "image".to_string(), status: "failed".to_string(), progress: None, result_url: None, error: Some(error) });
        remove_cancellation(&state, &request_id);
        return;
      }
      Err(error) => {
        finish_media_run(&state, &request_id, "failed", Some(&error), None);
        emit_media_event(&app, "ai://media/failed", MediaEvent { request_id: request_id.clone(), task_id: task_id.clone(), kind: "image".to_string(), status: "failed".to_string(), progress: None, result_url: None, error: Some(error) });
        remove_cancellation(&state, &request_id);
        return;
      }
    }
  }
  let error = AppError::new("media_timeout", "多米 API 任务轮询超时，请稍后重试", true);
  finish_media_run(&state, &request_id, "failed", Some(&error), None);
  emit_media_event(&app, "ai://media/failed", MediaEvent { request_id: request_id.clone(), task_id, kind: "image".to_string(), status: "failed".to_string(), progress: None, result_url: None, error: Some(error) });
  remove_cancellation(&state, &request_id);
}

async fn run_video_generation(
  app: AppHandle,
  state: Arc<AppState>,
  config: crate::models::MediaConfigInput,
  api_key: String,
  request_id: String,
  task_id: String,
  cancellation: CancellationToken,
) {
  for _ in 0..150 {
    tokio::select! {
      _ = cancellation.cancelled() => {
        finish_media_run(&state, &request_id, "cancelled", None, None);
        emit_media_event(&app, "ai://media/updated", MediaEvent { request_id: request_id.clone(), task_id: task_id.clone(), kind: "video".to_string(), status: "cancelled".to_string(), progress: None, result_url: None, error: None });
        remove_cancellation(&state, &request_id);
        return;
      }
      _ = tokio::time::sleep(std::time::Duration::from_secs(2)) => {}
    }

    match media::poll_video_task(&state.http, &config, &api_key, &task_id).await {
      Ok(MediaPollState::Pending { progress }) => {
        emit_media_event(&app, "ai://media/updated", MediaEvent { request_id: request_id.clone(), task_id: task_id.clone(), kind: "video".to_string(), status: "running".to_string(), progress, result_url: None, error: None });
      }
      Ok(MediaPollState::Succeeded { result_url }) => {
        finish_media_run(&state, &request_id, "completed", None, Some(&result_url));
        emit_media_event(&app, "ai://media/completed", MediaEvent { request_id: request_id.clone(), task_id: task_id.clone(), kind: "video".to_string(), status: "completed".to_string(), progress: Some(100), result_url: Some(result_url), error: None });
        remove_cancellation(&state, &request_id);
        return;
      }
      Ok(MediaPollState::Failed { message, retryable }) => {
        let error = AppError::new("media_generation_failed", message, retryable);
        finish_media_run(&state, &request_id, "failed", Some(&error), None);
        emit_media_event(&app, "ai://media/failed", MediaEvent { request_id: request_id.clone(), task_id: task_id.clone(), kind: "video".to_string(), status: "failed".to_string(), progress: None, result_url: None, error: Some(error) });
        remove_cancellation(&state, &request_id);
        return;
      }
      Err(error) => {
        finish_media_run(&state, &request_id, "failed", Some(&error), None);
        emit_media_event(&app, "ai://media/failed", MediaEvent { request_id: request_id.clone(), task_id: task_id.clone(), kind: "video".to_string(), status: "failed".to_string(), progress: None, result_url: None, error: Some(error) });
        remove_cancellation(&state, &request_id);
        return;
      }
    }
  }
  let error = AppError::new("media_timeout", "多米 API 任务轮询超时，请稍后重试", true);
  finish_media_run(&state, &request_id, "failed", Some(&error), None);
  emit_media_event(&app, "ai://media/failed", MediaEvent { request_id: request_id.clone(), task_id, kind: "video".to_string(), status: "failed".to_string(), progress: None, result_url: None, error: Some(error) });
  remove_cancellation(&state, &request_id);
}

#[tauri::command]
pub async fn start_image_generation(app: AppHandle, state: State<'_, AppState>, args: ImageGenerationArgs) -> Result<MediaStartResult, AppError> {
  let (config, api_key) = require_media_credentials(&state)?;
  let task_id = media::create_image_task(&state.http, &config, &api_key, &args).await?;
  let request_id = Uuid::new_v4().to_string();
  {
    let database = state.database()?;
    storage::create_request_run(&database, &request_id, "image", "submitted")?;
  }
  let cancellation = CancellationToken::new();
  state.cancellations.lock().map_err(|_| AppError::new("state_error", "生成任务状态不可用", true))?.insert(request_id.clone(), cancellation.clone());
  let state_for_task = Arc::new(state.inner().clone());
  tauri::async_runtime::spawn(run_image_generation(app, state_for_task, config, api_key, request_id.clone(), task_id.clone(), cancellation));
  Ok(MediaStartResult { request_id, task_id, kind: "image".to_string() })
}

#[tauri::command]
pub async fn start_video_generation(app: AppHandle, state: State<'_, AppState>, args: VideoGenerationArgs) -> Result<MediaStartResult, AppError> {
  let (config, api_key) = require_media_credentials(&state)?;
  let task_id = media::create_video_task(&state.http, &config, &api_key, &args).await?;
  let request_id = Uuid::new_v4().to_string();
  {
    let database = state.database()?;
    storage::create_request_run(&database, &request_id, "video", "submitted")?;
  }
  let cancellation = CancellationToken::new();
  state.cancellations.lock().map_err(|_| AppError::new("state_error", "生成任务状态不可用", true))?.insert(request_id.clone(), cancellation.clone());
  let state_for_task = Arc::new(state.inner().clone());
  tauri::async_runtime::spawn(run_video_generation(app, state_for_task, config, api_key, request_id.clone(), task_id.clone(), cancellation));
  Ok(MediaStartResult { request_id, task_id, kind: "video".to_string() })
}

#[tauri::command]
pub fn cancel_media_generation(state: State<'_, AppState>, request_id: String) -> Result<(), AppError> {
  let cancellation = state.cancellations
    .lock()
    .map_err(|_| AppError::new("state_error", "生成任务状态不可用", true))?
    .get(&request_id)
    .cloned();
  if let Some(cancellation) = cancellation {
    cancellation.cancel();
  }
  Ok(())
}

#[tauri::command]
pub async fn start_chat(app: AppHandle, state: State<'_, AppState>, args: ChatStartArgs) -> Result<ChatStartResult, AppError> {
  let config = require_config(&state)?;
  let session = require_session(&state)?;
  if args.messages.is_empty() {
    return Err(AppError::new("invalid_request", "消息不能为空", false));
  }
  let last_user_message = args.messages.iter().rev().find(|message| message.role == "user").ok_or_else(|| {
    AppError::new("invalid_request", "至少需要一条用户消息", false)
  })?;
  let conversation_id = if let Some(conversation_id) = args.conversation_id.clone() {
    conversation_id
  } else {
    let database = state.database()?;
    storage::create_conversation(&database, &last_user_message.content.chars().take(30).collect::<String>())?
  };
  let user_message_id = Uuid::new_v4().to_string();
  {
    let database = state.database()?;
    storage::save_message(&database, &conversation_id, &MessageRecord {
      id: user_message_id,
      role: "user".to_string(),
      content: last_user_message.content.clone(),
      status: "completed".to_string(),
      error: None,
      created_at: timestamp(),
    })?;
  }

  let request_id = Uuid::new_v4().to_string();
  let assistant_message_id = Uuid::new_v4().to_string();
  let cancellation = CancellationToken::new();
  state.cancellations
    .lock()
    .map_err(|_| AppError::new("state_error", "生成任务状态不可用", true))?
    .insert(request_id.clone(), cancellation.clone());
  let state_for_task = state.inner().clone();
  let app_for_task = app.clone();
  tauri::async_runtime::spawn(run_chat(
    app_for_task,
    state_for_task,
    config,
    session,
    args,
    request_id.clone(),
    conversation_id.clone(),
    assistant_message_id.clone(),
    cancellation,
  ));

  Ok(ChatStartResult { request_id, conversation_id, message_id: assistant_message_id })
}

#[tauri::command]
pub fn cancel_chat(state: State<'_, AppState>, request_id: String) -> Result<(), AppError> {
  let cancellation = state.cancellations
    .lock()
    .map_err(|_| AppError::new("state_error", "生成任务状态不可用", true))?
    .get(&request_id)
    .cloned();
  if let Some(cancellation) = cancellation {
    cancellation.cancel();
  }
  Ok(())
}

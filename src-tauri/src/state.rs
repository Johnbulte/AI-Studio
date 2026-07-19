use std::{collections::HashMap, fs, path::Path, sync::{Arc, Mutex}};

use reqwest::Client;
use rusqlite::Connection;
use tokio_util::sync::CancellationToken;

use crate::{auth::AuthTokens, models::{AppError, MediaConfigInput, ServerConfig, UserSummary}, storage};

#[derive(Debug, Clone)]
pub struct SessionData {
  pub tokens: AuthTokens,
  pub user: UserSummary,
}

#[derive(Clone)]
pub struct AppState {
  pub http: Client,
  pub config: Arc<Mutex<ServerConfig>>,
  pub media_config: Arc<Mutex<MediaConfigInput>>,
  pub session: Arc<Mutex<Option<SessionData>>>,
  pub db: Arc<Mutex<Connection>>,
  pub cancellations: Arc<Mutex<HashMap<String, CancellationToken>>>,
}

impl AppState {
  pub fn open(database_path: &Path) -> Result<Self, AppError> {
    if let Some(parent) = database_path.parent() {
      fs::create_dir_all(parent)
        .map_err(|error| AppError::new("storage_error", format!("无法创建应用数据目录：{error}"), true))?;
    }
    let connection = Connection::open(database_path)
      .map_err(|error| AppError::new("storage_error", format!("无法打开本地数据库：{error}"), true))?;
    storage::initialize_db(&connection)?;
    let config = storage::load_server_config(&connection)?.unwrap_or_default();
    let media_config = storage::load_media_config(&connection)?.unwrap_or_default();

    Ok(Self {
      http: Client::new(),
      config: Arc::new(Mutex::new(config)),
      media_config: Arc::new(Mutex::new(media_config)),
      session: Arc::new(Mutex::new(None)),
      db: Arc::new(Mutex::new(connection)),
      cancellations: Arc::new(Mutex::new(HashMap::new())),
    })
  }

  pub fn config(&self) -> Result<ServerConfig, AppError> {
    self.config
      .lock()
      .map(|config| config.clone())
      .map_err(|_| AppError::new("state_error", "应用状态不可用", true))
  }

  pub fn set_config(&self, config: ServerConfig) -> Result<(), AppError> {
    self.config
      .lock()
      .map(|mut current| *current = config)
      .map_err(|_| AppError::new("state_error", "应用状态不可用", true))
  }

  pub fn media_config(&self) -> Result<MediaConfigInput, AppError> {
    self.media_config
      .lock()
      .map(|config| config.clone())
      .map_err(|_| AppError::new("state_error", "媒体配置状态不可用", true))
  }

  pub fn set_media_config(&self, config: MediaConfigInput) -> Result<(), AppError> {
    self.media_config
      .lock()
      .map(|mut current| *current = config)
      .map_err(|_| AppError::new("state_error", "媒体配置状态不可用", true))
  }

  pub fn database(&self) -> Result<std::sync::MutexGuard<'_, Connection>, AppError> {
    self.db
      .lock()
      .map_err(|_| AppError::new("state_error", "本地数据库状态不可用", true))
  }

  pub fn current_session(&self) -> Result<Option<SessionData>, AppError> {
    self.session
      .lock()
      .map(|session| session.clone())
      .map_err(|_| AppError::new("state_error", "登录状态不可用", true))
  }

  pub fn set_session(&self, session: Option<SessionData>) -> Result<(), AppError> {
    self.session
      .lock()
      .map(|mut current| *current = session)
      .map_err(|_| AppError::new("state_error", "登录状态不可用", true))
  }
}

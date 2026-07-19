use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AppError {
  pub code: String,
  pub message: String,
  pub retryable: bool,
}

impl AppError {
  pub fn new(code: impl Into<String>, message: impl Into<String>, retryable: bool) -> Self {
    Self {
      code: code.into(),
      message: message.into(),
      retryable,
    }
  }
}

impl std::fmt::Display for AppError {
  fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    write!(formatter, "{}: {}", self.code, self.message)
  }
}

impl std::error::Error for AppError {}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ChatMessage {
  pub role: String,
  pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct ServerConfig {
  pub base_url: String,
  pub chat_model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MediaConfigInput {
  pub base_url: String,
  pub image_model: String,
  pub video_model: String,
}

impl Default for MediaConfigInput {
  fn default() -> Self {
    Self {
      base_url: "https://duomiapi.com".to_string(),
      image_model: "gpt-image-2".to_string(),
      video_model: "doubao-seedance-2-0-260128".to_string(),
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MediaConfig {
  pub base_url: String,
  pub image_model: String,
  pub video_model: String,
  pub api_key_configured: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SaveMediaConfigArgs {
  pub config: MediaConfigInput,
  pub api_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ImageGenerationArgs {
  pub prompt: String,
  pub aspect_ratio: String,
  pub count: u8,
  pub references: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct VideoGenerationArgs {
  pub prompt: String,
  pub mode: String,
  pub aspect_ratio: String,
  pub duration: u8,
  pub resolution: String,
  pub references: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MediaStartResult {
  pub request_id: String,
  pub task_id: String,
  pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MediaRunSummary {
  pub request_id: String,
  pub kind: String,
  pub status: String,
  pub result_url: Option<String>,
  pub started_at: String,
  pub finished_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MediaEvent {
  pub request_id: String,
  pub task_id: String,
  pub kind: String,
  pub status: String,
  pub progress: Option<u8>,
  pub result_url: Option<String>,
  pub error: Option<AppError>,
}

pub fn validate_server_config(base_url: &str, chat_model: &str) -> Result<ServerConfig, AppError> {
  let normalized_url = base_url.trim().trim_end_matches('/');
  let parsed_url = reqwest::Url::parse(normalized_url)
    .map_err(|_| AppError::new("invalid_config", "服务地址格式无效", false))?;
  if !matches!(parsed_url.scheme(), "http" | "https") || parsed_url.host_str().is_none() {
    return Err(AppError::new("invalid_config", "服务地址必须使用 HTTP 或 HTTPS", false));
  }

  let normalized_model = chat_model.trim();
  if normalized_model.is_empty() {
    return Err(AppError::new("invalid_config", "聊天模型不能为空", false));
  }

  Ok(ServerConfig {
    base_url: normalized_url.to_string(),
    chat_model: normalized_model.to_string(),
  })
}

pub fn validate_media_config(config: &MediaConfigInput) -> Result<MediaConfigInput, AppError> {
  let normalized_url = config.base_url.trim().trim_end_matches('/');
  let parsed_url = reqwest::Url::parse(normalized_url)
    .map_err(|_| AppError::new("invalid_config", "多米 API 地址格式无效", false))?;
  if !matches!(parsed_url.scheme(), "http" | "https") || parsed_url.host_str().is_none() {
    return Err(AppError::new("invalid_config", "多米 API 地址必须使用 HTTP 或 HTTPS", false));
  }
  let image_model = config.image_model.trim();
  if image_model.is_empty() {
    return Err(AppError::new("invalid_config", "图片模型不能为空", false));
  }
  let video_model = config.video_model.trim();
  if video_model.is_empty() {
    return Err(AppError::new("invalid_config", "视频模型不能为空", false));
  }
  Ok(MediaConfigInput {
    base_url: normalized_url.to_string(),
    image_model: image_model.to_string(),
    video_model: video_model.to_string(),
  })
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UserSummary {
  pub id: String,
  pub email: String,
  #[serde(default)]
  pub display_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SessionSnapshot {
  pub authenticated: bool,
  pub user: Option<UserSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ConversationSummary {
  pub id: String,
  pub title: String,
  pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MessageRecord {
  pub id: String,
  pub role: String,
  pub content: String,
  pub status: String,
  pub error: Option<AppError>,
  pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChatStartArgs {
  pub conversation_id: Option<String>,
  pub messages: Vec<ChatMessage>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChatStartResult {
  pub request_id: String,
  pub conversation_id: String,
  pub message_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChatEvent {
  pub request_id: String,
  pub conversation_id: String,
  pub message_id: String,
  pub delta: Option<String>,
  pub cancelled: bool,
  pub error: Option<AppError>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LoginArgs {
  pub email: String,
  pub password: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ParsedChatEvent {
  Delta(String),
  Done,
}

#[cfg(test)]
mod tests {
  use super::validate_server_config;

  #[test]
  fn accepts_https_server_and_model() {
    let config = validate_server_config("https://gateway.example.com/", "creative-model").unwrap();
    assert_eq!(config.base_url, "https://gateway.example.com");
    assert_eq!(config.chat_model, "creative-model");
  }

  #[test]
  fn rejects_server_without_http_scheme() {
    let error = validate_server_config("gateway.example.com", "creative-model").unwrap_err();
    assert_eq!(error.code, "invalid_config");
  }

  #[test]
  fn rejects_empty_model() {
    let error = validate_server_config("https://gateway.example.com", " ").unwrap_err();
    assert_eq!(error.code, "invalid_config");
  }
}

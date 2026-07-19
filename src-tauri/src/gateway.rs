use reqwest::{Client, Response};
use serde::Serialize;

use crate::{auth::status_error, models::{AppError, ChatMessage, ParsedChatEvent, ServerConfig}};

pub fn parse_sse_event(payload: &str) -> Result<Option<ParsedChatEvent>, AppError> {
  let data = payload
    .lines()
    .filter_map(|line| line.strip_prefix("data:"))
    .map(str::trim)
    .collect::<Vec<_>>()
    .join("\n");

  if data.is_empty() {
    return Ok(None);
  }
  if data == "[DONE]" {
    return Ok(Some(ParsedChatEvent::Done));
  }

  let value: serde_json::Value = serde_json::from_str(&data)
    .map_err(|error| AppError::new("invalid_sse", format!("无法解析流式响应：{error}"), true))?;
  Ok(value
    .pointer("/choices/0/delta/content")
    .and_then(serde_json::Value::as_str)
    .map(|content| ParsedChatEvent::Delta(content.to_string())))
}

pub fn next_sse_event_boundary(buffer: &str) -> Option<(usize, usize)> {
  if let Some(position) = buffer.find("\r\n\r\n") {
    return Some((position, 4));
  }
  buffer.find("\n\n").map(|position| (position, 2))
}

fn endpoint(config: &ServerConfig, path: &str) -> String {
  format!("{}{}", config.base_url.trim_end_matches('/'), path)
}

pub async fn test_connection(client: &Client, config: &ServerConfig, access_token: &str) -> Result<(), AppError> {
  let response = client
    .get(endpoint(config, "/v1/models"))
    .bearer_auth(access_token)
    .send()
    .await
    .map_err(|error| AppError::new("network_error", format!("无法连接 AI 服务：{error}"), true))?;
  if response.status().is_success() {
    return Ok(());
  }
  let status = response.status();
  let body = response.text().await.unwrap_or_default();
  Err(status_error(status, &body))
}

#[derive(Serialize)]
struct ChatRequest<'a> {
  model: &'a str,
  messages: &'a [ChatMessage],
  stream: bool,
}

pub async fn open_chat_stream(
  client: &Client,
  config: &ServerConfig,
  access_token: &str,
  messages: &[ChatMessage],
) -> Result<Response, AppError> {
  let response = client
    .post(endpoint(config, "/v1/chat/completions"))
    .bearer_auth(access_token)
    .header("accept", "text/event-stream")
    .json(&ChatRequest { model: &config.chat_model, messages, stream: true })
    .send()
    .await
    .map_err(|error| AppError::new("network_error", format!("无法连接 AI 服务：{error}"), true))?;
  if response.status().is_success() {
    return Ok(response);
  }
  let status = response.status();
  let body = response.text().await.unwrap_or_default();
  Err(status_error(status, &body))
}

#[cfg(test)]
mod tests {
  use super::{next_sse_event_boundary, parse_sse_event};
  use crate::models::ParsedChatEvent;

  #[test]
  fn parses_incremental_chat_content() {
    let event = parse_sse_event(r#"data: {"choices":[{"delta":{"content":"你好"}}]}"#).unwrap();
    assert_eq!(event, Some(ParsedChatEvent::Delta("你好".to_string())));
  }

  #[test]
  fn recognizes_done_marker() {
    let event = parse_sse_event("data: [DONE]").unwrap();
    assert_eq!(event, Some(ParsedChatEvent::Done));
  }

  #[test]
  fn ignores_events_without_text_delta() {
    let event = parse_sse_event(r#"data: {"choices":[{"delta":{"role":"assistant"}}]}"#).unwrap();
    assert_eq!(event, None);
  }

  #[test]
  fn rejects_malformed_sse_json() {
    let error = parse_sse_event("data: {not-json}").unwrap_err();
    assert_eq!(error.code, "invalid_sse");
    assert!(error.retryable);
  }

  #[test]
  fn finds_lf_and_crlf_event_boundaries() {
    assert_eq!(next_sse_event_boundary("data: one\n\ndata: two"), Some((9, 2)));
    assert_eq!(next_sse_event_boundary("data: one\r\n\r\ndata: two"), Some((9, 4)));
  }
}

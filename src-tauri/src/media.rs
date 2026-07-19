use reqwest::{Client, StatusCode};
use serde_json::{json, Value};

use crate::{auth::status_error, models::{AppError, ImageGenerationArgs, MediaConfigInput, VideoGenerationArgs}};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MediaPollState {
  Pending { progress: Option<u8> },
  Succeeded { result_url: String },
  Failed { message: String, retryable: bool },
}

fn endpoint(config: &MediaConfigInput, path: &str) -> String {
  format!("{}{}", config.base_url.trim_end_matches('/'), path)
}

fn business_error(value: &Value) -> Option<AppError> {
  let code = value.get("code").and_then(Value::as_i64).unwrap_or(0);
  if code == 0 || code == 200 || value.get("code").is_none() {
    return None;
  }
  let message = value
    .get("msg")
    .or_else(|| value.get("message"))
    .and_then(Value::as_str)
    .filter(|message| !message.trim().is_empty())
    .unwrap_or("多米 API 请求失败");
  Some(AppError::new("media_api_error", message, false))
}

fn response_error(status: StatusCode, body: &str) -> AppError {
  if let Ok(value) = serde_json::from_str::<Value>(body) {
    if let Some(message) = value
      .get("msg")
      .or_else(|| value.get("message"))
      .and_then(Value::as_str)
      .filter(|message| !message.trim().is_empty())
    {
      let retryable = status == StatusCode::TOO_MANY_REQUESTS || status.is_server_error();
      return AppError::new(if status == StatusCode::UNAUTHORIZED { "unauthorized" } else { "media_api_error" }, message, retryable);
    }
  }
  status_error(status, body)
}

async fn send_json(request: reqwest::RequestBuilder) -> Result<Value, AppError> {
  let response = request.send().await.map_err(|error| AppError::new("network_error", format!("无法连接多米 API：{error}"), true))?;
  let status = response.status();
  let body = response.text().await.map_err(|error| AppError::new("network_error", format!("无法读取多米 API 响应：{error}"), true))?;
  if !status.is_success() {
    return Err(response_error(status, &body));
  }
  let value = serde_json::from_str::<Value>(&body)
    .map_err(|error| AppError::new("invalid_response", format!("多米 API 响应格式无效：{error}"), true))?;
  if let Some(error) = business_error(&value) {
    return Err(error);
  }
  Ok(value)
}

fn task_id(value: &Value) -> Result<String, AppError> {
  value
    .get("id")
    .or_else(|| value.pointer("/data/task_id"))
    .or_else(|| value.pointer("/data/id"))
    .and_then(Value::as_str)
    .filter(|id| !id.trim().is_empty())
    .map(str::to_string)
    .ok_or_else(|| AppError::new("invalid_response", "多米 API 没有返回任务 ID", true))
}

pub fn parse_image_create_task_id(value: &Value) -> Result<String, AppError> {
  task_id(value)
}

pub fn parse_video_create_task_id(value: &Value) -> Result<String, AppError> {
  task_id(value)
}

fn status(value: &Value) -> String {
  value
    .get("state")
    .or_else(|| value.get("status"))
    .or_else(|| value.pointer("/data/state"))
    .and_then(Value::as_str)
    .unwrap_or("processing")
    .to_ascii_lowercase()
}

fn progress(value: &Value) -> Option<u8> {
  value
    .get("progress")
    .or_else(|| value.pointer("/data/progress"))
    .and_then(Value::as_u64)
    .and_then(|value| u8::try_from(value).ok())
}

fn failure_message(value: &Value) -> String {
  value
    .get("msg")
    .or_else(|| value.get("message"))
    .or_else(|| value.pointer("/data/msg"))
    .or_else(|| value.pointer("/data/task_status_msg"))
    .and_then(Value::as_str)
    .filter(|message| !message.trim().is_empty())
    .unwrap_or("多米 API 生成失败")
    .to_string()
}

fn failed_status(value: &Value) -> bool {
  matches!(status(value).as_str(), "failed" | "failure" | "error" | "cancelled" | "canceled")
}

fn succeeded_status(value: &Value) -> bool {
  matches!(status(value).as_str(), "succeeded" | "success" | "succeed" | "completed" | "complete" | "done")
}

pub fn parse_image_poll(value: &Value) -> Result<MediaPollState, AppError> {
  if failed_status(value) {
    return Ok(MediaPollState::Failed { message: failure_message(value), retryable: false });
  }
  if succeeded_status(value) {
    let image_url = value
      .pointer("/data/images/0/url")
      .or_else(|| value.pointer("/data/data/images/0/url"))
      .and_then(Value::as_str)
      .filter(|url| !url.trim().is_empty())
      .ok_or_else(|| AppError::new("empty_result", "多米 API 返回了空图片结果", true))?;
    return Ok(MediaPollState::Succeeded { result_url: image_url.to_string() });
  }
  Ok(MediaPollState::Pending { progress: progress(value) })
}

pub fn parse_video_poll(value: &Value) -> Result<MediaPollState, AppError> {
  if failed_status(value) {
    return Ok(MediaPollState::Failed { message: failure_message(value), retryable: false });
  }
  if succeeded_status(value) {
    let video_url = value
      .pointer("/content/video_url")
      .or_else(|| value.pointer("/data/content/video_url"))
      .or_else(|| value.pointer("/data/task_result/videos/0/url"))
      .and_then(Value::as_str)
      .filter(|url| !url.trim().is_empty())
      .ok_or_else(|| AppError::new("empty_result", "多米 API 返回了空视频结果", true))?;
    return Ok(MediaPollState::Succeeded { result_url: video_url.to_string() });
  }
  Ok(MediaPollState::Pending { progress: progress(value) })
}

fn image_size(aspect_ratio: &str) -> &'static str {
  match aspect_ratio {
    "4:3" => "1536x1024",
    "3:4" => "1024x1536",
    "16:9" => "1536x864",
    "9:16" => "864x1536",
    _ => "1024x1024",
  }
}

pub async fn create_image_task(client: &Client, config: &MediaConfigInput, api_key: &str, args: &ImageGenerationArgs) -> Result<String, AppError> {
  if args.prompt.trim().is_empty() {
    return Err(AppError::new("invalid_request", "图片提示词不能为空", false));
  }
  let mut body = json!({
    "model": config.image_model,
    "prompt": args.prompt,
    "size": image_size(&args.aspect_ratio),
    "n": args.count.clamp(1, 4),
  });
  if !args.references.is_empty() {
    body["image"] = json!(args.references);
  }
  let response = send_json(
    client
      .post(endpoint(config, "/v1/images/generations?async=true"))
      .header("Authorization", api_key)
      .json(&body),
  ).await?;
  parse_image_create_task_id(&response)
}

pub async fn poll_image_task(client: &Client, config: &MediaConfigInput, api_key: &str, task_id: &str) -> Result<MediaPollState, AppError> {
  let response = send_json(
    client.get(endpoint(config, &format!("/v1/tasks/{task_id}"))).header("Authorization", api_key),
  ).await?;
  parse_image_poll(&response)
}

pub async fn create_video_task(client: &Client, config: &MediaConfigInput, api_key: &str, args: &VideoGenerationArgs) -> Result<String, AppError> {
  if args.prompt.trim().is_empty() {
    return Err(AppError::new("invalid_request", "视频提示词不能为空", false));
  }
  let ratio = args.aspect_ratio.split_whitespace().next().unwrap_or("16:9");
  let mut content = vec![json!({ "type": "text", "text": args.prompt })];
  for reference in &args.references {
    content.push(json!({
      "type": "image_url",
      "image_url": { "url": reference },
      "role": "reference_image"
    }));
  }
  let body = json!({
    "model": config.video_model,
    "content": content,
    "generate_audio": true,
    "ratio": ratio,
    "duration": args.duration.clamp(4, 12),
    "resolution": args.resolution.to_ascii_lowercase(),
    "watermark": false,
  });
  let response = send_json(
    client
      .post(endpoint(config, "/api/v3/contents/generations/tasks"))
      .header("Authorization", api_key)
      .json(&body),
  ).await?;
  parse_video_create_task_id(&response)
}

pub async fn poll_video_task(client: &Client, config: &MediaConfigInput, api_key: &str, task_id: &str) -> Result<MediaPollState, AppError> {
  let response = send_json(
    client.get(endpoint(config, &format!("/api/v3/contents/generations/tasks/{task_id}"))).header("Authorization", api_key),
  ).await?;
  parse_video_poll(&response)
}

#[cfg(test)]
mod tests {
  use std::{io::{Read, Write}, net::TcpListener, thread};

  use reqwest::Client;
  use serde_json::json;

  use super::{create_image_task, create_video_task, parse_image_create_task_id, parse_image_poll, parse_video_create_task_id, parse_video_poll, MediaPollState};
  use crate::models::{ImageGenerationArgs, MediaConfigInput, VideoGenerationArgs};

  fn mock_response(body: &'static str) -> (String, thread::JoinHandle<String>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let address = format!("http://{}", listener.local_addr().unwrap());
    let handle = thread::spawn(move || {
      let (mut stream, _) = listener.accept().unwrap();
      let mut request = Vec::new();
      let mut chunk = [0_u8; 4096];
      loop {
        let count = stream.read(&mut chunk).unwrap();
        if count == 0 { break; }
        request.extend_from_slice(&chunk[..count]);
        if request.windows(4).any(|window| window == b"\r\n\r\n") { break; }
      }
      let headers_end = request.windows(4).position(|window| window == b"\r\n\r\n").map(|position| position + 4).unwrap_or(request.len());
      let content_length = String::from_utf8_lossy(&request[..headers_end])
        .lines()
        .find_map(|line| line.to_ascii_lowercase().strip_prefix("content-length:").map(|value| value.trim().parse::<usize>().unwrap_or(0)))
        .unwrap_or(0);
      while request.len() < headers_end + content_length {
        let count = stream.read(&mut chunk).unwrap();
        if count == 0 { break; }
        request.extend_from_slice(&chunk[..count]);
      }
      let response = format!("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body);
      stream.write_all(response.as_bytes()).unwrap();
      String::from_utf8_lossy(&request).to_string()
    });
    (address, handle)
  }

  #[test]
  fn parses_image_create_task_id() {
    assert_eq!(parse_image_create_task_id(&json!({ "id": "image-task-1" })).unwrap(), "image-task-1");
    assert_eq!(parse_image_create_task_id(&json!({ "data": { "task_id": "image-task-2" } })).unwrap(), "image-task-2");
  }

  #[test]
  fn parses_image_success_url_and_progress() {
    let state = parse_image_poll(&json!({
      "id": "image-task-1",
      "state": "succeeded",
      "progress": 100,
      "data": { "images": [{ "url": "https://cdn.example.com/image.png" }] }
    })).unwrap();
    assert_eq!(state, MediaPollState::Succeeded { result_url: "https://cdn.example.com/image.png".to_string() });
  }

  #[test]
  fn parses_video_create_task_id_and_success_url() {
    assert_eq!(parse_video_create_task_id(&json!({ "data": { "task_id": "video-task-1" } })).unwrap(), "video-task-1");
    let state = parse_video_poll(&json!({
      "id": "video-task-1",
      "status": "succeeded",
      "content": { "video_url": "https://cdn.example.com/video.mp4" }
    })).unwrap();
    assert_eq!(state, MediaPollState::Succeeded { result_url: "https://cdn.example.com/video.mp4".to_string() });
  }

  #[test]
  fn maps_failed_media_tasks_to_retryable_errors() {
    let state = parse_image_poll(&json!({ "state": "failed", "msg": "余额不足" })).unwrap();
    assert_eq!(state, MediaPollState::Failed { message: "余额不足".to_string(), retryable: false });
  }

  #[tokio::test]
  async fn sends_image_request_with_api_key_and_async_path() {
    let (base_url, server) = mock_response(r#"{"id":"image-task-1"}"#);
    let response = create_image_task(
      &Client::new(),
      &MediaConfigInput { base_url, image_model: "gpt-image-2".to_string(), video_model: "video-model".to_string() },
      "duomi-secret",
      &ImageGenerationArgs { prompt: "一只猫".to_string(), aspect_ratio: "1:1".to_string(), count: 2, references: vec![] },
    ).await.unwrap();
    let request = server.join().unwrap();
    assert_eq!(response, "image-task-1");
    assert!(request.starts_with("POST /v1/images/generations?async=true HTTP/1.1"));
    assert!(request.to_ascii_lowercase().contains("authorization: duomi-secret"));
    assert!(request.contains("\"prompt\":\"一只猫\""));
  }

  #[tokio::test]
  async fn sends_seedance_request_with_reference_images() {
    let (base_url, server) = mock_response(r#"{"data":{"task_id":"video-task-1"}}"#);
    let response = create_video_task(
      &Client::new(),
      &MediaConfigInput { base_url, image_model: "image-model".to_string(), video_model: "seedance-model".to_string() },
      "duomi-secret",
      &VideoGenerationArgs { prompt: "镜头推进".to_string(), mode: "图生视频".to_string(), aspect_ratio: "16:9 (横屏)".to_string(), duration: 6, resolution: "1080P".to_string(), references: vec!["data:image/png;base64,abc".to_string()] },
    ).await.unwrap();
    let request = server.join().unwrap();
    assert_eq!(response, "video-task-1");
    assert!(request.starts_with("POST /api/v3/contents/generations/tasks HTTP/1.1"));
    assert!(request.to_ascii_lowercase().contains("authorization: duomi-secret"));
    assert!(request.contains("\"role\":\"reference_image\""));
  }
}

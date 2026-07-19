use keyring::Entry;
use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};

use crate::models::{AppError, LoginArgs, UserSummary};

const KEYRING_SERVICE: &str = "ai-studio-os";
const ACCESS_TOKEN_KEY: &str = "access-token";
const REFRESH_TOKEN_KEY: &str = "refresh-token";
const DUOMI_API_KEY: &str = "duomi-api-key";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AuthTokens {
  pub access_token: String,
  pub refresh_token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AuthResponse {
  #[serde(alias = "access_token")]
  pub access_token: String,
  #[serde(alias = "refresh_token")]
  pub refresh_token: String,
  #[serde(default, alias = "expires_at")]
  pub expires_at: Option<String>,
  pub user: UserSummary,
}

fn keyring_entry(key: &str) -> Result<Entry, AppError> {
  Entry::new(KEYRING_SERVICE, key)
    .map_err(|error| AppError::new("keyring_error", format!("系统安全存储不可用：{error}"), false))
}

pub fn load_tokens() -> Result<Option<AuthTokens>, AppError> {
  let access = keyring_entry(ACCESS_TOKEN_KEY)?.get_password().ok();
  let refresh = keyring_entry(REFRESH_TOKEN_KEY)?.get_password().ok();
  Ok(match (access, refresh) {
    (Some(access_token), Some(refresh_token)) => Some(AuthTokens { access_token, refresh_token }),
    _ => None,
  })
}

pub fn save_tokens(tokens: &AuthTokens) -> Result<(), AppError> {
  keyring_entry(ACCESS_TOKEN_KEY)?
    .set_password(&tokens.access_token)
    .map_err(|error| AppError::new("keyring_error", format!("无法保存登录凭证：{error}"), false))?;
  keyring_entry(REFRESH_TOKEN_KEY)?
    .set_password(&tokens.refresh_token)
    .map_err(|error| AppError::new("keyring_error", format!("无法保存刷新凭证：{error}"), false))?;
  Ok(())
}

pub fn clear_tokens() -> Result<(), AppError> {
  for key in [ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY] {
    let entry = keyring_entry(key)?;
    let _ = entry.delete_credential();
  }
  Ok(())
}

pub fn load_duomi_api_key() -> Result<Option<String>, AppError> {
  Ok(keyring_entry(DUOMI_API_KEY)?.get_password().ok())
}

pub fn save_duomi_api_key(api_key: &str) -> Result<(), AppError> {
  keyring_entry(DUOMI_API_KEY)?
    .set_password(api_key.trim())
    .map_err(|error| AppError::new("keyring_error", format!("无法保存多米 API Key：{error}"), false))
}

pub fn clear_duomi_api_key() -> Result<(), AppError> {
  let entry = keyring_entry(DUOMI_API_KEY)?;
  let _ = entry.delete_credential();
  Ok(())
}

fn endpoint(base_url: &str, path: &str) -> String {
  format!("{}{}", base_url.trim_end_matches('/'), path)
}

pub(crate) fn status_error(status: StatusCode, body: &str) -> AppError {
  let code = match status {
    StatusCode::UNAUTHORIZED => "unauthorized",
    StatusCode::TOO_MANY_REQUESTS => "rate_limited",
    StatusCode::BAD_REQUEST | StatusCode::UNPROCESSABLE_ENTITY => "invalid_request",
    _ if status.is_server_error() => "server_error",
    _ => "http_error",
  };
  let message = serde_json::from_str::<serde_json::Value>(body)
    .ok()
    .and_then(|value| value.get("message").and_then(serde_json::Value::as_str).map(str::to_string))
    .filter(|value| !value.trim().is_empty())
    .unwrap_or_else(|| format!("服务请求失败（{}）", status.as_u16()));
  AppError::new(code, message, status == StatusCode::TOO_MANY_REQUESTS || status.is_server_error())
}

async fn send_json<T: Serialize, R: for<'de> Deserialize<'de>>(
  request: reqwest::RequestBuilder,
  body: &T,
) -> Result<R, AppError> {
  let response = request.json(body).send().await.map_err(|error| {
    AppError::new("network_error", format!("无法连接服务：{error}"), true)
  })?;
  let status = response.status();
  let text = response.text().await.map_err(|error| {
    AppError::new("network_error", format!("无法读取服务响应：{error}"), true)
  })?;
  if !status.is_success() {
    return Err(status_error(status, &text));
  }
  serde_json::from_str(&text).map_err(|error| {
    AppError::new("invalid_response", format!("服务响应格式无效：{error}"), true)
  })
}

pub async fn login(client: &Client, base_url: &str, args: &LoginArgs) -> Result<AuthResponse, AppError> {
  send_json(
    client.post(endpoint(base_url, "/auth/login")),
    args,
  )
  .await
}

pub async fn refresh(client: &Client, base_url: &str, refresh_token: &str) -> Result<AuthResponse, AppError> {
  #[derive(Serialize)]
  struct RefreshBody<'a> { refresh_token: &'a str }
  send_json(
    client.post(endpoint(base_url, "/auth/refresh")),
    &RefreshBody { refresh_token },
  )
  .await
}

pub async fn logout(client: &Client, base_url: &str, access_token: &str) -> Result<(), AppError> {
  let response = client
    .post(endpoint(base_url, "/auth/logout"))
    .bearer_auth(access_token)
    .send()
    .await
    .map_err(|error| AppError::new("network_error", format!("无法连接服务：{error}"), true))?;
  if response.status().is_success() || response.status() == StatusCode::UNAUTHORIZED {
    return Ok(());
  }
  let status = response.status();
  let body = response.text().await.unwrap_or_default();
  Err(status_error(status, &body))
}

pub fn tokens_from_response(response: &AuthResponse) -> AuthTokens {
  AuthTokens {
    access_token: response.access_token.clone(),
    refresh_token: response.refresh_token.clone(),
  }
}

#[cfg(test)]
mod tests {
  use std::{io::{Read, Write}, net::TcpListener, thread};

  use super::{status_error, AuthResponse};
  use reqwest::{Client, StatusCode};

  fn mock_response(body: &'static str) -> (String, thread::JoinHandle<String>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let address = format!("http://{}", listener.local_addr().unwrap());
    let handle = thread::spawn(move || {
      let (mut stream, _) = listener.accept().unwrap();
      let mut request = Vec::new();
      let mut chunk = [0_u8; 1024];
      loop {
        let count = stream.read(&mut chunk).unwrap();
        if count == 0 { break; }
        request.extend_from_slice(&chunk[..count]);
        if request.windows(4).any(|window| window == b"\r\n\r\n") { break; }
      }
      let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.len(), body
      );
      stream.write_all(response.as_bytes()).unwrap();
      String::from_utf8_lossy(&request).to_string()
    });
    (address, handle)
  }

  #[test]
  fn maps_unauthorized_response_to_non_retryable_auth_error() {
    let error = status_error(StatusCode::UNAUTHORIZED, r#"{"message":"邮箱或密码错误"}"#);
    assert_eq!(error.code, "unauthorized");
    assert!(!error.retryable);
    assert_eq!(error.message, "邮箱或密码错误");
  }

  #[test]
  fn maps_rate_limit_to_retryable_error() {
    let error = status_error(StatusCode::TOO_MANY_REQUESTS, "");
    assert_eq!(error.code, "rate_limited");
    assert!(error.retryable);
  }

  #[test]
  fn parses_camel_case_auth_response() {
    let response: AuthResponse = serde_json::from_str(r#"{
      "accessToken":"access-1",
      "refreshToken":"refresh-1",
      "user":{"id":"u1","email":"user@example.com","displayName":"用户"}
    }"#).unwrap();
    assert_eq!(response.access_token, "access-1");
    assert_eq!(response.refresh_token, "refresh-1");
    assert_eq!(response.user.email, "user@example.com");
  }

  #[test]
  fn sends_login_request_and_parses_response() {
    let (base_url, server) = mock_response(r#"{"accessToken":"access-1","refreshToken":"refresh-1","user":{"id":"u1","email":"user@example.com","displayName":"用户"}}"#);
    let runtime = tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
    let response = runtime.block_on(super::login(
      &Client::new(),
      &base_url,
      &crate::models::LoginArgs { email: "user@example.com".to_string(), password: "password123".to_string() },
    )).unwrap();
    let request = server.join().unwrap();
    assert!(request.starts_with("POST /auth/login HTTP/1.1"));
    assert!(request.contains("\"email\":\"user@example.com\""));
    assert_eq!(response.access_token, "access-1");
  }

  #[test]
  fn sends_refresh_token_request() {
    let (base_url, server) = mock_response(r#"{"accessToken":"access-2","refreshToken":"refresh-2","user":{"id":"u1","email":"user@example.com","displayName":"用户"}}"#);
    let runtime = tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
    let response = runtime.block_on(super::refresh(&Client::new(), &base_url, "refresh-1")).unwrap();
    let request = server.join().unwrap();
    assert!(request.starts_with("POST /auth/refresh HTTP/1.1"));
    assert!(request.contains("\"refresh_token\":\"refresh-1\""));
    assert_eq!(response.refresh_token, "refresh-2");
  }
}

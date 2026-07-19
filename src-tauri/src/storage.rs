use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, Connection};
use uuid::Uuid;

use crate::models::{AppError, ConversationSummary, MediaConfigInput, MediaRunSummary, MessageRecord, ServerConfig, UserSummary};

fn storage_error(error: rusqlite::Error) -> AppError {
  AppError::new("storage_error", format!("本地数据操作失败：{error}"), true)
}

fn now_timestamp() -> String {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|duration| duration.as_millis().to_string())
    .unwrap_or_else(|_| "0".to_string())
}

pub fn initialize_db(connection: &Connection) -> Result<(), AppError> {
  connection
    .execute_batch(
      "
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        display_name TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        archived INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        status TEXT NOT NULL,
        error_code TEXT,
        error_message TEXT,
        error_retryable INTEGER,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS request_runs (
        id TEXT PRIMARY KEY,
        conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        error_code TEXT,
        result_url TEXT,
        started_at TEXT NOT NULL,
        finished_at TEXT
      );
      CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id, created_at);
      ",
    )
    .map_err(storage_error)?;

  let has_result_url = connection
    .prepare("PRAGMA table_info(request_runs)")
    .map_err(storage_error)?
    .query_map([], |row| row.get::<_, String>(1))
    .map_err(storage_error)?
    .collect::<Result<Vec<_>, _>>()
    .map_err(storage_error)?
    .iter()
    .any(|column| column == "result_url");
  if !has_result_url {
    connection
      .execute("ALTER TABLE request_runs ADD COLUMN result_url TEXT", [])
      .map_err(storage_error)?;
  }
  Ok(())
}

pub fn create_request_run(connection: &Connection, id: &str, kind: &str, status: &str) -> Result<(), AppError> {
  connection
    .execute(
      "INSERT OR REPLACE INTO request_runs (id, kind, status, started_at) VALUES (?1, ?2, ?3, ?4)",
      params![id, kind, status, now_timestamp()],
    )
    .map_err(storage_error)?;
  Ok(())
}

pub fn finish_request_run(connection: &Connection, id: &str, status: &str, error_code: Option<&str>, result_url: Option<&str>) -> Result<(), AppError> {
  connection
    .execute(
      "UPDATE request_runs SET status = ?1, error_code = ?2, result_url = ?3, finished_at = ?4 WHERE id = ?5",
      params![status, error_code, result_url, now_timestamp(), id],
    )
    .map_err(storage_error)?;
  Ok(())
}

pub fn list_media_runs(connection: &Connection) -> Result<Vec<MediaRunSummary>, AppError> {
  let mut statement = connection
    .prepare(
      "SELECT id, kind, status, result_url, started_at, finished_at
       FROM request_runs WHERE kind IN ('image', 'video') ORDER BY started_at DESC LIMIT 50",
    )
    .map_err(storage_error)?;
  let rows = statement
    .query_map([], |row| {
      Ok(MediaRunSummary {
        request_id: row.get(0)?,
        kind: row.get(1)?,
        status: row.get(2)?,
        result_url: row.get(3)?,
        started_at: row.get(4)?,
        finished_at: row.get(5)?,
      })
    })
    .map_err(storage_error)?;
  rows.collect::<Result<Vec<_>, _>>().map_err(storage_error)
}

pub fn load_server_config(connection: &Connection) -> Result<Option<ServerConfig>, AppError> {
  let mut statement = connection
    .prepare("SELECT value FROM app_config WHERE key = 'server_config'")
    .map_err(storage_error)?;
  let mut rows = statement.query([]).map_err(storage_error)?;
  let Some(row) = rows.next().map_err(storage_error)? else {
    return Ok(None);
  };
  let value: String = row.get(0).map_err(storage_error)?;
  serde_json::from_str(&value)
    .map(Some)
    .map_err(|error| AppError::new("storage_error", format!("服务配置读取失败：{error}"), true))
}

pub fn save_server_config(connection: &Connection, config: &ServerConfig) -> Result<(), AppError> {
  let value = serde_json::to_string(config)
    .map_err(|error| AppError::new("storage_error", format!("服务配置保存失败：{error}"), true))?;
  connection
    .execute(
      "INSERT INTO app_config (key, value) VALUES ('server_config', ?1)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      params![value],
    )
    .map_err(storage_error)?;
  Ok(())
}

pub fn load_media_config(connection: &Connection) -> Result<Option<MediaConfigInput>, AppError> {
  let mut statement = connection
    .prepare("SELECT value FROM app_config WHERE key = 'media_config'")
    .map_err(storage_error)?;
  let mut rows = statement.query([]).map_err(storage_error)?;
  let Some(row) = rows.next().map_err(storage_error)? else {
    return Ok(None);
  };
  let value: String = row.get(0).map_err(storage_error)?;
  serde_json::from_str(&value)
    .map(Some)
    .map_err(|error| AppError::new("storage_error", format!("多米配置读取失败：{error}"), true))
}

pub fn save_media_config(connection: &Connection, config: &MediaConfigInput) -> Result<(), AppError> {
  let value = serde_json::to_string(config)
    .map_err(|error| AppError::new("storage_error", format!("多米配置保存失败：{error}"), true))?;
  connection
    .execute(
      "INSERT INTO app_config (key, value) VALUES ('media_config', ?1)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      params![value],
    )
    .map_err(storage_error)?;
  Ok(())
}

pub fn save_user(connection: &Connection, user: &UserSummary) -> Result<(), AppError> {
  connection
    .execute(
      "INSERT INTO users (id, email, display_name, updated_at) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(id) DO UPDATE SET email = excluded.email, display_name = excluded.display_name, updated_at = excluded.updated_at",
      params![user.id, user.email, user.display_name, now_timestamp()],
    )
    .map_err(storage_error)?;
  Ok(())
}

pub fn create_conversation(connection: &Connection, title: &str) -> Result<String, AppError> {
  let id = Uuid::new_v4().to_string();
  let timestamp = now_timestamp();
  let title = if title.trim().is_empty() { "新对话" } else { title.trim() };
  connection
    .execute(
      "INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?1, ?2, ?3, ?3)",
      params![id, title, timestamp],
    )
    .map_err(storage_error)?;
  Ok(id)
}

pub fn save_message(connection: &Connection, conversation_id: &str, message: &MessageRecord) -> Result<(), AppError> {
  let error_values = message.error.as_ref().map(|error| {
    (error.code.clone(), error.message.clone(), i64::from(error.retryable))
  });
  connection
    .execute(
      "INSERT OR REPLACE INTO messages
        (id, conversation_id, role, content, status, error_code, error_message, error_retryable, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
      params![
        message.id,
        conversation_id,
        message.role,
        message.content,
        message.status,
        error_values.as_ref().map(|value| &value.0),
        error_values.as_ref().map(|value| &value.1),
        error_values.as_ref().map(|value| value.2),
        message.created_at,
      ],
    )
    .map_err(storage_error)?;
  connection
    .execute(
      "UPDATE conversations SET updated_at = ?1 WHERE id = ?2",
      params![now_timestamp(), conversation_id],
    )
    .map_err(storage_error)?;
  Ok(())
}

pub fn list_conversations(connection: &Connection) -> Result<Vec<ConversationSummary>, AppError> {
  let mut statement = connection
    .prepare("SELECT id, title, updated_at FROM conversations WHERE archived = 0 ORDER BY updated_at DESC")
    .map_err(storage_error)?;
  let rows = statement
    .query_map([], |row| {
      Ok(ConversationSummary {
        id: row.get(0)?,
        title: row.get(1)?,
        updated_at: row.get(2)?,
      })
    })
    .map_err(storage_error)?;
  rows.collect::<Result<Vec<_>, _>>().map_err(storage_error)
}

pub fn load_messages(connection: &Connection, conversation_id: &str) -> Result<Vec<MessageRecord>, AppError> {
  let mut statement = connection
    .prepare(
      "SELECT id, role, content, status, error_code, error_message, error_retryable, created_at
       FROM messages WHERE conversation_id = ?1 ORDER BY created_at ASC, id ASC",
    )
    .map_err(storage_error)?;
  let rows = statement
    .query_map(params![conversation_id], |row| {
      let error_code: Option<String> = row.get(4)?;
      let error = error_code.map(|code| AppError {
        code,
        message: row.get(5).unwrap_or_else(|_| "消息生成失败".to_string()),
        retryable: row.get::<_, Option<i64>>(6).unwrap_or(Some(0)).unwrap_or(0) != 0,
      });
      Ok(MessageRecord {
        id: row.get(0)?,
        role: row.get(1)?,
        content: row.get(2)?,
        status: row.get(3)?,
        error,
        created_at: row.get(7)?,
      })
    })
    .map_err(storage_error)?;
  rows.collect::<Result<Vec<_>, _>>().map_err(storage_error)
}

#[cfg(test)]
mod tests {
  use rusqlite::Connection;

  use super::{create_conversation, create_request_run, finish_request_run, initialize_db, list_conversations, list_media_runs, load_media_config, load_messages, save_media_config, save_message, save_server_config};
  use crate::models::{MediaConfigInput, MessageRecord, ServerConfig};

  #[test]
  fn stores_and_loads_conversation_messages() {
    let connection = Connection::open_in_memory().unwrap();
    initialize_db(&connection).unwrap();
    let conversation_id = create_conversation(&connection, "春季新品").unwrap();
    save_message(
      &connection,
      &conversation_id,
      &MessageRecord {
        id: "message-1".to_string(),
        role: "user".to_string(),
        content: "帮我写方案".to_string(),
        status: "completed".to_string(),
        error: None,
        created_at: "2026-07-18T00:00:00Z".to_string(),
      },
    )
    .unwrap();

    let conversations = list_conversations(&connection).unwrap();
    assert_eq!(conversations.len(), 1);
    assert_eq!(conversations[0].title, "春季新品");
    assert_eq!(load_messages(&connection, &conversation_id).unwrap().len(), 1);
  }

  #[test]
  fn local_database_does_not_store_access_or_refresh_tokens() {
    let connection = Connection::open_in_memory().unwrap();
    initialize_db(&connection).unwrap();
    save_server_config(&connection, &ServerConfig { base_url: "https://gateway.example.com".to_string(), chat_model: "gpt-4o-mini".to_string() }).unwrap();
    let values = connection
      .prepare("SELECT value FROM app_config")
      .unwrap()
      .query_map([], |row| row.get::<_, String>(0))
      .unwrap()
      .collect::<Result<Vec<_>, _>>()
      .unwrap();
    assert!(values.iter().all(|value| !value.contains("access-token") && !value.contains("refresh-token")));
  }

  #[test]
  fn stores_media_config_without_api_key() {
    let connection = Connection::open_in_memory().unwrap();
    initialize_db(&connection).unwrap();
    save_media_config(&connection, &MediaConfigInput::default()).unwrap();
    let config = load_media_config(&connection).unwrap().unwrap();
    assert_eq!(config.image_model, "gpt-image-2");
    let values = connection
      .prepare("SELECT value FROM app_config")
      .unwrap()
      .query_map([], |row| row.get::<_, String>(0))
      .unwrap()
      .collect::<Result<Vec<_>, _>>()
      .unwrap();
    assert!(values.iter().all(|value| !value.contains("duomi-api-key")));
  }

  #[test]
  fn stores_and_lists_media_runs_with_result_urls() {
    let connection = Connection::open_in_memory().unwrap();
    initialize_db(&connection).unwrap();
    create_request_run(&connection, "request-1", "image", "submitted").unwrap();
    finish_request_run(&connection, "request-1", "completed", None, Some("https://cdn.example.com/image.png")).unwrap();
    let runs = list_media_runs(&connection).unwrap();
    assert_eq!(runs.len(), 1);
    assert_eq!(runs[0].result_url.as_deref(), Some("https://cdn.example.com/image.png"));
  }
}

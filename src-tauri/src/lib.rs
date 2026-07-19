mod auth;
mod commands;
mod gateway;
mod media;
mod models;
mod state;
mod storage;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      use tauri::Manager;
      let data_dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
      let database_path = data_dir.join("ai-studio.sqlite");
      let state = state::AppState::open(&database_path).map_err(|error| error.to_string())?;
      app.manage(state);
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      commands::load_server_config,
      commands::save_server_config,
      commands::load_media_config,
      commands::save_media_config,
      commands::login,
      commands::restore_session,
      commands::logout,
      commands::test_connection,
      commands::list_conversations,
      commands::load_conversation,
      commands::create_conversation,
      commands::list_media_runs,
      commands::start_chat,
      commands::cancel_chat,
      commands::start_image_generation,
      commands::start_video_generation,
      commands::cancel_media_generation,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
  #[test]
  fn config_keeps_the_window_resizable_with_a_usable_minimum() {
    let config: serde_json::Value = serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
    let window = &config["app"]["windows"][0];

    assert_eq!(window["width"], 1440);
    assert_eq!(window["height"], 1024);
    assert_eq!(window["minWidth"], 1024);
    assert_eq!(window["minHeight"], 720);
    assert_eq!(window["resizable"], true);
    assert_eq!(window["decorations"], false);
    assert_eq!(window["transparent"], true);
    assert_eq!(window["shadow"], false);
  }

}

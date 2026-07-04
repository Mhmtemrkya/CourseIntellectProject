// Oturum şifreleme anahtarı bu servis adı altında OS keychain'inde tutulur.
const KEYCHAIN_SERVICE: &str = "com.courseintellect.desktop";

fn keychain_entry(account: &str) -> Result<keyring::Entry, String> {
  keyring::Entry::new(KEYCHAIN_SERVICE, account).map_err(|err| err.to_string())
}

#[tauri::command]
fn keychain_get(account: String) -> Result<Option<String>, String> {
  match keychain_entry(&account)?.get_password() {
    Ok(value) => Ok(Some(value)),
    Err(keyring::Error::NoEntry) => Ok(None),
    Err(err) => Err(err.to_string()),
  }
}

#[tauri::command]
fn keychain_set(account: String, value: String) -> Result<(), String> {
  keychain_entry(&account)?
    .set_password(&value)
    .map_err(|err| err.to_string())
}

#[tauri::command]
fn keychain_delete(account: String) -> Result<(), String> {
  match keychain_entry(&account)?.delete_credential() {
    Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
    Err(err) => Err(err.to_string()),
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_deep_link::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_http::init())
    .invoke_handler(tauri::generate_handler![
      keychain_get,
      keychain_set,
      keychain_delete
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

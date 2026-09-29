#[tauri::command]
async fn fetch_makers_url(url: String) -> Result<String, String> {
    // Only allow makerselectronics.com domain for strict security
    if !url.starts_with("https://makerselectronics.com/") {
        return Err("Security Error: Only makerselectronics.com URLs are permitted".to_string());
    }

    let client = reqwest::Client::builder()
        .user_agent("MAKERS-POS-Desktop/1.0")
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client.get(&url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let status = resp.status();
    if !status.is_success() {
        return Err(format!("HTTP Error {}: {}", status.as_u16(), status.canonical_reason().unwrap_or("Unknown")));
    }

    let body = resp.text().await.map_err(|e| format!("Failed to read response body: {}", e))?;
    Ok(body)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_sql::Builder::default().build())
    .invoke_handler(tauri::generate_handler![fetch_makers_url])
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
    .expect("error while building tauri application");
}


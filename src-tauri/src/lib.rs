use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[tauri::command]
async fn fetch_makers_url(url: String) -> Result<String, String> {
    // Only allow makerselectronics.com domain for strict security
    if !url.starts_with("https://makerselectronics.com/") && !url.starts_with("https://www.makerselectronics.com/") {
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

#[tauri::command]
async fn download_makers_image(
    app: tauri::AppHandle,
    image_url: String,
    save_filename: String,
) -> Result<String, String> {
    // Only allow makerselectronics.com domain for strict security
    if !image_url.starts_with("https://makerselectronics.com/") && !image_url.starts_with("https://www.makerselectronics.com/") {
        return Err("Security Error: Only makerselectronics.com image URLs are permitted".to_string());
    }

    // Determine target directory: %APPDATA%/com.makers.pos/product_images/
    let base_dir: PathBuf = match app.path().app_data_dir() {
        Ok(dir) => dir,
        Err(_) => {
            if let Ok(appdata) = std::env::var("APPDATA") {
                PathBuf::from(appdata).join("com.makers.pos")
            } else {
                std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")).join("data")
            }
        }
    };

    let target_dir = base_dir.join("product_images");
    if let Err(e) = fs::create_dir_all(&target_dir) {
        return Err(format!("Failed to create product_images directory: {}", e));
    }

    let clean_filename = save_filename.replace(['\\', '/', ':', '*', '?', '"', '<', '>', '|'], "_");
    let file_path = target_dir.join(&clean_filename);

    let client = reqwest::Client::builder()
        .user_agent("MAKERS-POS-Desktop/1.0")
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client.get(&image_url)
        .send()
        .await
        .map_err(|e| format!("Network error downloading image: {}", e))?;

    let status = resp.status();
    if !status.is_success() {
        return Err(format!("HTTP Error {}: Failed to download image", status.as_u16()));
    }

    let bytes = resp.bytes().await.map_err(|e| format!("Failed to read image bytes: {}", e))?;
    fs::write(&file_path, bytes).map_err(|e| format!("Failed to write image file: {}", e))?;

    let abs_path_str = file_path.to_string_lossy().to_string();
    Ok(abs_path_str)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_sql::Builder::default().build())
    .invoke_handler(tauri::generate_handler![fetch_makers_url, download_makers_image])
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



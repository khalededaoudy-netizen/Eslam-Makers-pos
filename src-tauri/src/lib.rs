use std::fs;
use std::path::PathBuf;
use std::process::Command;
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

fn is_allowed_makers_image_domain(url: &str) -> bool {
    let lower = url.to_lowercase();
    // Official MAKERS domains
    if lower.starts_with("https://makerselectronics.com/") 
        || lower.starts_with("https://www.makerselectronics.com/")
        || lower.starts_with("http://makerselectronics.com/")
        || lower.starts_with("http://www.makerselectronics.com/") {
        return true;
    }
    // WordPress CDN / Photon CDN (i0.wp.com, i1.wp.com, etc. used by Automattic/Pressable hosting)
    if lower.starts_with("https://i0.wp.com/")
        || lower.starts_with("https://i1.wp.com/")
        || lower.starts_with("https://i2.wp.com/")
        || lower.starts_with("https://i3.wp.com/")
        || lower.starts_with("https://wp.com/") {
        return true;
    }
    // Gravatar and other WordPress image assets
    if lower.starts_with("https://secure.gravatar.com/") || lower.starts_with("https://gravatar.com/") {
        return true;
    }
    false
}

#[tauri::command]
async fn download_makers_image(
    app: tauri::AppHandle,
    image_url: String,
    save_filename: String,
) -> Result<String, String> {
    if !is_allowed_makers_image_domain(&image_url) {
        return Err(format!("Security Error: Domain for image URL '{}' is not permitted", image_url));
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
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;

    // Prepare candidate URLs:
    // If it's a makerselectronics.com upload, direct requests are blocked by Pressable _hcc anti-bot challenge (403),
    // but the official WordPress Photon CDN (i0.wp.com) serves the file with 200 OK.
    let mut candidate_urls = Vec::new();
    if image_url.contains("makerselectronics.com/wp-content/uploads/") && !image_url.contains("i0.wp.com") {
        let photon_url = image_url
            .replace("https://makerselectronics.com/", "https://i0.wp.com/makerselectronics.com/")
            .replace("https://www.makerselectronics.com/", "https://i0.wp.com/makerselectronics.com/")
            .replace("http://makerselectronics.com/", "https://i0.wp.com/makerselectronics.com/");
        candidate_urls.push(photon_url);
    }
    candidate_urls.push(image_url.clone());

    let mut last_err = String::new();
    for url in candidate_urls {
        match client.get(&url)
            .header("Accept", "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8")
            .header("Referer", "https://makerselectronics.com/")
            .send()
            .await 
        {
            Ok(resp) => {
                let status = resp.status();
                if status.is_success() {
                    match resp.bytes().await {
                        Ok(bytes) => {
                            if !bytes.is_empty() {
                                if let Err(e) = fs::write(&file_path, bytes) {
                                    return Err(format!("Failed to write image file: {}", e));
                                }
                                let abs_path_str = file_path.to_string_lossy().to_string();
                                return Ok(abs_path_str);
                            } else {
                                last_err = format!("Empty bytes received from {}", url);
                            }
                        }
                        Err(e) => {
                            last_err = format!("Failed to read image bytes from {}: {}", url, e);
                        }
                    }
                } else {
                    last_err = format!("HTTP Error {} from {}", status.as_u16(), url);
                }
            }
            Err(e) => {
                last_err = format!("Network error downloading from {}: {}", url, e);
            }
        }
    }

    Err(format!("Failed to download image: {}", last_err))
}

#[tauri::command]
async fn list_printers() -> Result<Vec<String>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let output = Command::new("powershell")
            .creation_flags(CREATE_NO_WINDOW)
            .args(&[
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                "Add-Type -AssemblyName System.Drawing; [System.Drawing.Printing.PrinterSettings]::InstalledPrinters",
            ])
            .output()
            .map_err(|e| format!("Failed to execute powershell: {}", e))?;

        if !output.status.success() {
            return Err(format!(
                "Failed to list printers: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let printers: Vec<String> = stdout
            .lines()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        Ok(printers)
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(vec!["Default".to_string()])
    }
}

#[tauri::command]
async fn get_default_printer() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let output = Command::new("powershell")
            .creation_flags(CREATE_NO_WINDOW)
            .args(&[
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                "(Get-CimInstance Win32_Printer -Filter 'Default = True').Name",
            ])
            .output()
            .map_err(|e| format!("Failed to query default printer: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let def = stdout.trim().to_string();
        if def.is_empty() {
            Ok("Default".to_string())
        } else {
            Ok(def)
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok("Default".to_string())
    }
}

#[tauri::command]
async fn print_receipt_image(
    image_base64: String,
    printer_name: Option<String>,
    paper_width: Option<String>,
) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let clean_base64 = if let Some(idx) = image_base64.find(',') {
            &image_base64[idx + 1..]
        } else {
            &image_base64
        };

        let temp_dir = std::env::temp_dir();
        let file_name = format!(
            "makers_receipt_{}_{}.png",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis(),
            std::process::id()
        );
        let img_path = temp_dir.join(&file_name);
        let debug_img_path = temp_dir.join("makers_receipt_last_debug.png");

        use base64::Engine;
        let decoded_bytes = base64::engine::general_purpose::STANDARD
            .decode(clean_base64.trim())
            .map_err(|e| format!("Invalid base64 image: {}", e))?;

        fs::write(&img_path, &decoded_bytes)
            .map_err(|e| format!("Failed to write temporary receipt image: {}", e))?;
        let _ = fs::write(&debug_img_path, &decoded_bytes);

        let img_path_str = img_path.to_string_lossy().to_string();
        let debug_path_str = debug_img_path.to_string_lossy().to_string();
        println!("[print_receipt_image] Saved receipt debug image to: {}", debug_path_str);
        let target_printer = printer_name.unwrap_or_default();
        let paper_type = paper_width.unwrap_or_else(|| "80mm".to_string());

        let ps_script = format!(
            r#"$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$imagePath = '{}'
$targetPrinter = '{}'
$paperType = '{}'

if (-not (Test-Path $imagePath)) {{
    throw "Image file not found: $imagePath"
}}

$img = [System.Drawing.Image]::FromFile($imagePath)
$doc = New-Object System.Drawing.Printing.PrintDocument

if ($targetPrinter -and $targetPrinter.Trim() -ne '' -and $targetPrinter -ne 'Default') {{
    $doc.PrinterSettings.PrinterName = $targetPrinter
}}

if (-not $doc.PrinterSettings.IsValid) {{
    $img.Dispose()
    throw "Printer '$targetPrinter' is not valid or inaccessible"
}}

$doc.PrintController = New-Object System.Drawing.Printing.StandardPrintController
$doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
$doc.OriginAtMargins = $false

# Standard dimensions in hundredths of an inch
# 80mm roll = 315 (printable width ~ 70mm = 275)
# 58mm roll = 228 (printable width ~ 47mm = 185)
$paperWidth = 315
$destW = 275.0
if ($paperType -eq '58mm') {{
    $paperWidth = 228
    $destW = 185.0
}}

# Compute destination height preserving aspect ratio
$destH = [float](($img.Height / [float]$img.Width) * $destW)

# Set page height dynamically matching the image + small safety buffer (20 hundredths of an inch = ~5mm)
$paperHeight = [int]($destH + 20)
if ($paperHeight -lt 100) {{ $paperHeight = 100 }}

try {{
    $customPaperSize = New-Object System.Drawing.Printing.PaperSize("Receipt", [int]$paperWidth, [int]$paperHeight)
    $doc.DefaultPageSettings.PaperSize = $customPaperSize
}} catch {{}}

$doc.add_PrintPage({{
    param($sender, $e)
    try {{
        # Center printable content on physical roll paper accounting for driver's HardMarginX
        $physLeft = [float](($paperWidth - $destW) / 2.0)
        $hardMarginX = [float]$e.PageSettings.HardMarginX
        $x = [Math]::Max(0.0, [float]($physLeft - $hardMarginX))
        $y = 0.0

        [Console]::WriteLine("PRINT_LOG: PaperWidth=$paperWidth, PaperHeight=$paperHeight, destW=$destW, destH=$destH, HardMarginX=$hardMarginX, X=$x, ImgPx=$($img.Width)x$($img.Height), ImgDpi=$($img.HorizontalResolution)")

        $e.Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $e.Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $e.Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

        $destRect = New-Object System.Drawing.RectangleF([float]$x, [float]$y, [float]$destW, [float]$destH)
        $e.Graphics.DrawImage($img, $destRect)
        $e.HasMorePages = $false
    }}
    catch {{
        $e.Cancel = $true
        throw $_
    }}
}})

$doc.Print()
$doc.Dispose()
$img.Dispose()
"#,
            img_path_str.replace('\\', "\\\\").replace('\'', "''"),
            target_printer.replace('\'', "''"),
            paper_type.replace('\'', "''")
        );

        let output = Command::new("powershell")
            .creation_flags(CREATE_NO_WINDOW)
            .args(&[
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                &ps_script,
            ])
            .output();

        let _ = fs::remove_file(&img_path);

        match output {
            Ok(out) => {
                let stdout = String::from_utf8_lossy(&out.stdout);
                if !stdout.trim().is_empty() {
                    println!("[print_receipt_image] {}", stdout.trim());
                }
                if !out.status.success() {
                    let err_msg = String::from_utf8_lossy(&out.stderr);
                    return Err(format!("Print execution failed: {}", err_msg.trim()));
                }
                Ok("Printed successfully".to_string())
            }
            Err(e) => Err(format!("Failed to start print process: {}", e)),
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Direct printing is only supported on Windows".to_string())
    }
}

#[tauri::command]
async fn open_cash_drawer(printer_name: Option<String>) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let target_printer = printer_name.unwrap_or_default();

        let ps_script = format!(
            r#"$ErrorActionPreference = 'Stop'
$targetPrinter = '{}'

if (-not $targetPrinter -or $targetPrinter.Trim() -eq '' -or $targetPrinter -eq 'Default') {{
    $defObj = Get-CimInstance Win32_Printer -Filter 'Default = True' -ErrorAction SilentlyContinue
    if ($defObj) {{
        $targetPrinter = $defObj.Name
    }} else {{
        $first = Get-CimInstance Win32_Printer | Select-Object -First 1
        if ($first) {{ $targetPrinter = $first.Name }}
    }}
}}

if (-not $targetPrinter -or $targetPrinter.Trim() -eq '') {{
    throw 'No valid printer found to kick cash drawer'
}}

$drawerCode = @'
using System;
using System.Runtime.InteropServices;
public class CashDrawerKickHelper {{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA {{
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }}
    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);
    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static bool Kick(string printerName) {{
        IntPtr hPrinter = IntPtr.Zero;
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "Kick Cash Drawer";
        di.pDataType = "RAW";
        if (OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {{
            if (StartDocPrinter(hPrinter, 1, di)) {{
                if (StartPagePrinter(hPrinter)) {{
                    byte[] pulse = new byte[] {{ 27, 112, 0, 25, 250, 27, 112, 1, 25, 250 }};
                    IntPtr pBytes = Marshal.AllocCoTaskMem(pulse.Length);
                    Marshal.Copy(pulse, 0, pBytes, pulse.Length);
                    int written = 0;
                    WritePrinter(hPrinter, pBytes, pulse.Length, out written);
                    Marshal.FreeCoTaskMem(pBytes);
                    EndPagePrinter(hPrinter);
                }}
                EndDocPrinter(hPrinter);
            }}
            ClosePrinter(hPrinter);
            return true;
        }}
        return false;
    }}
}}
'@

try {{
    if (-not ([System.Management.Automation.PSTypeName]'CashDrawerKickHelper').Type) {{
        Add-Type -TypeDefinition $drawerCode
    }}
    $success = [CashDrawerKickHelper]::Kick($targetPrinter)
    if (-not $success) {{
        throw "Could not send kick pulse to printer '$targetPrinter'"
    }}
}} catch {{
    throw "Cash drawer kick error: $_"
}}
"#,
            target_printer.replace('\'', "''")
        );

        let output = Command::new("powershell")
            .creation_flags(CREATE_NO_WINDOW)
            .args(&[
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                &ps_script,
            ])
            .output();

        match output {
            Ok(out) => {
                if !out.status.success() {
                    let err_msg = String::from_utf8_lossy(&out.stderr);
                    return Err(format!("Drawer kick failed: {}", err_msg.trim()));
                }
                Ok("Cash drawer opened successfully".to_string())
            }
            Err(e) => Err(format!("Failed to start drawer kick process: {}", e)),
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Cash drawer opening is only supported on Windows".to_string())
    }
}

#[tauri::command]
async fn print_receipt_raw(
    bytes_base64: String,
    printer_name: Option<String>,
) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let clean_base64 = if let Some(idx) = bytes_base64.find(',') {
            &bytes_base64[idx + 1..]
        } else {
            &bytes_base64
        };

        let temp_dir = std::env::temp_dir();
        let file_name = format!(
            "makers_raw_print_{}_{}.bin",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis(),
            std::process::id()
        );
        let raw_path = temp_dir.join(&file_name);
        let debug_raw_path = temp_dir.join("makers_receipt_last_raw.bin");

        use base64::Engine;
        let decoded_bytes = base64::engine::general_purpose::STANDARD
            .decode(clean_base64.trim())
            .map_err(|e| format!("Invalid base64 raw print stream: {}", e))?;

        let byte_count = decoded_bytes.len();
        fs::write(&raw_path, &decoded_bytes)
            .map_err(|e| format!("Failed to write temporary raw print file: {}", e))?;
        let _ = fs::write(&debug_raw_path, &decoded_bytes);

        let raw_path_str = raw_path.to_string_lossy().to_string();
        let debug_path_str = debug_raw_path.to_string_lossy().to_string();
        println!("[print_receipt_raw] Spooling {} bytes RAW (saved debug copy to {})", byte_count, debug_path_str);
        let target_printer = printer_name.unwrap_or_default();

        let ps_script = format!(
            r#"$ErrorActionPreference = 'Stop'
$targetPrinter = '{}'
$rawFilePath = '{}'

if (-not (Test-Path $rawFilePath)) {{
    throw "Raw print file not found: $rawFilePath"
}}

if (-not $targetPrinter -or $targetPrinter.Trim() -eq '' -or $targetPrinter -eq 'Default') {{
    $defObj = Get-CimInstance Win32_Printer -Filter 'Default = True' -ErrorAction SilentlyContinue
    if ($defObj) {{
        $targetPrinter = $defObj.Name
    }} else {{
        $first = Get-CimInstance Win32_Printer | Select-Object -First 1
        if ($first) {{ $targetPrinter = $first.Name }}
    }}
}}

if (-not $targetPrinter -or $targetPrinter.Trim() -eq '') {{
    throw 'No valid printer found for RAW printing'
}}

$rawPrinterCode = @'
using System;
using System.IO;
using System.Runtime.InteropServices;

public class RawPrinterHelper {{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA {{
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }}

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static int SendFile(string printerName, string filePath) {{
        byte[] bytes = File.ReadAllBytes(filePath);
        if (bytes.Length == 0) {{
            return 0;
        }}

        IntPtr hPrinter = IntPtr.Zero;
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "MAKERS Thermal Receipt";
        di.pDataType = "RAW";

        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {{
            int err = Marshal.GetLastWin32Error();
            throw new Exception("OpenPrinter failed for '" + printerName + "' with error code " + err);
        }}

        int totalWritten = 0;
        try {{
            if (!StartDocPrinter(hPrinter, 1, di)) {{
                int err = Marshal.GetLastWin32Error();
                throw new Exception("StartDocPrinter failed with error code " + err);
            }}

            try {{
                if (!StartPagePrinter(hPrinter)) {{
                    int err = Marshal.GetLastWin32Error();
                    throw new Exception("StartPagePrinter failed with error code " + err);
                }}

                try {{
                    IntPtr pBytes = Marshal.AllocCoTaskMem(bytes.Length);
                    try {{
                        Marshal.Copy(bytes, 0, pBytes, bytes.Length);
                        int written = 0;
                        int offset = 0;
                        int remaining = bytes.Length;

                        while (remaining > 0) {{
                            IntPtr currentPtr = new IntPtr(pBytes.ToInt64() + offset);
                            if (!WritePrinter(hPrinter, currentPtr, remaining, out written) || written <= 0) {{
                                int err = Marshal.GetLastWin32Error();
                                throw new Exception("WritePrinter failed with error code " + err + " after writing " + totalWritten + " of " + bytes.Length + " bytes");
                            }}
                            totalWritten += written;
                            offset += written;
                            remaining -= written;
                        }}
                    }} finally {{
                        Marshal.FreeCoTaskMem(pBytes);
                    }}
                }} finally {{
                    EndPagePrinter(hPrinter);
                }}
            }} finally {{
                EndDocPrinter(hPrinter);
            }}
        }} finally {{
            ClosePrinter(hPrinter);
        }}

        return totalWritten;
    }}
}}
'@

try {{
    if (-not ([System.Management.Automation.PSTypeName]'RawPrinterHelper').Type) {{
        Add-Type -TypeDefinition $rawPrinterCode
    }}
    $written = [RawPrinterHelper]::SendFile($targetPrinter, $rawFilePath)
    Write-Output "RAW_PRINT_SUCCESS: Printer=$targetPrinter, BytesTotal=$($bytes.Length), BytesWritten=$written"
}} catch {{
    throw "RAW printing error on '$targetPrinter': $_"
}}
"#,
            target_printer.replace('\'', "''"),
            raw_path_str.replace('\\', "\\\\").replace('\'', "''")
        );

        let output = Command::new("powershell")
            .creation_flags(CREATE_NO_WINDOW)
            .args(&[
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                &ps_script,
            ])
            .output();

        let _ = fs::remove_file(&raw_path);

        match output {
            Ok(out) => {
                let stdout = String::from_utf8_lossy(&out.stdout);
                if !stdout.trim().is_empty() {
                    println!("[print_receipt_raw] {}", stdout.trim());
                }
                if !out.status.success() {
                    let err_msg = String::from_utf8_lossy(&out.stderr);
                    return Err(format!("RAW print failed: {}", err_msg.trim()));
                }
                Ok(format!("Printed {} bytes RAW successfully", byte_count))
            }
            Err(e) => Err(format!("Failed to execute RAW print command: {}", e)),
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("RAW direct printing is only supported on Windows".to_string())
    }
}

#[derive(serde::Deserialize)]
pub struct TransactionStatement {
    pub sql: String,
    pub values: Vec<serde_json::Value>,
}

#[derive(serde::Serialize)]
pub struct TransactionResult {
    pub success: bool,
    pub rows_affected: u64,
}

#[tauri::command]
async fn execute_sql_transaction(
    app: tauri::AppHandle,
    statements: Vec<TransactionStatement>,
) -> Result<TransactionResult, String> {
    if statements.is_empty() {
        return Ok(TransactionResult {
            success: true,
            rows_affected: 0,
        });
    }

    use sqlx::Connection;
    use sqlx::sqlite::{SqliteConnectOptions, SqliteConnection, SqliteJournalMode, SqliteSynchronous};

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

    let db_path = base_dir.join("makers_pos.db");

    let connect_opts = SqliteConnectOptions::new()
        .filename(&db_path)
        .create_if_missing(true)
        .busy_timeout(std::time::Duration::from_millis(15000))
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal);

    let mut conn = SqliteConnection::connect_with(&connect_opts)
        .await
        .map_err(|e| format!("Failed to connect to database for transaction: {}", e))?;

    let mut tx = conn.begin().await.map_err(|e| format!("Failed to begin transaction: {}", e))?;

    let mut total_rows = 0;

    for stmt in statements {
        let mut query = sqlx::query(&stmt.sql);
        for val in stmt.values {
            match val {
                serde_json::Value::Null => {
                    query = query.bind(Option::<String>::None);
                }
                serde_json::Value::Bool(b) => {
                    query = query.bind(if b { 1i64 } else { 0i64 });
                }
                serde_json::Value::Number(num) => {
                    if let Some(i) = num.as_i64() {
                        query = query.bind(i);
                    } else if let Some(f) = num.as_f64() {
                        query = query.bind(f);
                    } else {
                        query = query.bind(num.to_string());
                    }
                }
                serde_json::Value::String(s) => {
                    query = query.bind(s);
                }
                serde_json::Value::Array(_) | serde_json::Value::Object(_) => {
                    query = query.bind(val.to_string());
                }
            }
        }

        let res = query.execute(&mut *tx).await.map_err(|e| {
            format!("Transaction SQL execution error on '{}': {}", stmt.sql, e)
        })?;
        total_rows += res.rows_affected();
    }

    tx.commit().await.map_err(|e| format!("Failed to commit transaction: {}", e))?;

    Ok(TransactionResult {
        success: true,
        rows_affected: total_rows,
    })
}

#[tauri::command]
async fn open_external_url(url: String) -> Result<(), String> {
    let trimmed = url.trim();
    if !trimmed.starts_with("https://") && !trimmed.starts_with("http://") && !trimmed.starts_with("mailto:") {
        return Err("Security Error: Only http, https and mailto URLs can be opened externally".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let status = Command::new("cmd")
            .creation_flags(CREATE_NO_WINDOW)
            .args(&["/C", "start", "", trimmed])
            .status()
            .map_err(|e| format!("Failed to launch default browser on Windows: {}", e))?;

        if !status.success() {
            return Err(format!("Windows shell start command exited with status: {:?}", status.code()));
        }
    }

    #[cfg(target_os = "macos")]
    {
        let status = Command::new("open")
            .arg(trimmed)
            .status()
            .map_err(|e| format!("Failed to launch default browser on macOS: {}", e))?;

        if !status.success() {
            return Err(format!("macOS open command exited with status: {:?}", status.code()));
        }
    }

    #[cfg(target_os = "linux")]
    {
        let status = Command::new("xdg-open")
            .arg(trimmed)
            .status()
            .map_err(|e| format!("Failed to launch default browser on Linux: {}", e))?;

        if !status.success() {
            return Err(format!("Linux xdg-open command exited with status: {:?}", status.code()));
        }
    }

    Ok(())
}

#[tauri::command]
async fn get_backup_dir(app: tauri::AppHandle) -> Result<String, String> {
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

    let backup_dir = base_dir.join("backups");
    if let Err(e) = fs::create_dir_all(&backup_dir) {
        return Err(format!("Failed to create backups directory: {}", e));
    }

    Ok(backup_dir.to_string_lossy().to_string())
}

#[tauri::command]
async fn check_path_accessible(path: String) -> Result<bool, String> {
    let target = PathBuf::from(path.trim());
    if !target.exists() || !target.is_dir() {
        return Ok(false);
    }

    let test_file = target.join(".pos_backup_check.tmp");
    match fs::write(&test_file, b"check") {
        Ok(_) => {
            let _ = fs::remove_file(&test_file);
            Ok(true)
        }
        Err(_) => Ok(false),
    }
}

#[tauri::command]
async fn copy_backup_to_secondary(
    source_path: String,
    secondary_dir: String,
    filename: String,
) -> Result<String, String> {
    let source = PathBuf::from(source_path.trim());
    if !source.exists() {
        return Err(format!("Source backup file does not exist: {}", source.display()));
    }

    let target_dir = PathBuf::from(secondary_dir.trim());
    if let Err(e) = fs::create_dir_all(&target_dir) {
        return Err(format!("Failed to ensure target directory: {}", e));
    }

    let clean_filename = filename.replace(['\\', '/', ':', '*', '?', '"', '<', '>', '|'], "_");
    let dest_path = target_dir.join(&clean_filename);

    fs::copy(&source, &dest_path).map_err(|e| {
        format!("Failed to copy backup to secondary location: {}", e)
    })?;

    Ok(dest_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn delete_backup_file(file_path: String) -> Result<bool, String> {
    let path = PathBuf::from(file_path.trim());
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("Failed to delete backup file: {}", e))?;
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
async fn append_app_log(
    app: tauri::AppHandle,
    level: String,
    message: String,
    date: String,
) -> Result<(), String> {
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

    let logs_dir = base_dir.join("logs");
    if let Err(e) = fs::create_dir_all(&logs_dir) {
        return Err(format!("Failed to create logs dir: {}", e));
    }

    let clean_date = date.replace(['\\', '/', ':', '*', '?', '"', '<', '>', '|'], "-");
    let filename = format!("app_{}.log", clean_date);
    let file_path = logs_dir.join(filename);

    use std::io::Write;
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&file_path)
        .map_err(|e| format!("Failed to open log file: {}", e))?;

    writeln!(file, "[{}] {}", level.to_uppercase(), message)
        .map_err(|e| format!("Failed to write log line: {}", e))?;

    Ok(())
}

#[tauri::command]
async fn save_temp_image(
    base64: String,
    filename: String,
) -> Result<String, String> {
    use base64::{engine::general_purpose, Engine};

    let bytes = general_purpose::STANDARD
        .decode(&base64)
        .map_err(|e| e.to_string())?;

    let temp_dir = std::env::temp_dir().join("MAKERS_POS");
    if !temp_dir.exists() {
        fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;
    }

    let file_path = temp_dir.join(&filename);
    fs::write(&file_path, bytes).map_err(|e| e.to_string())?;

    Ok(file_path.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_sql::Builder::default().build())
    .invoke_handler(tauri::generate_handler![
        fetch_makers_url,
        download_makers_image,
        list_printers,
        get_default_printer,
        print_receipt_image,
        print_receipt_raw,
        open_cash_drawer,
        execute_sql_transaction,
        open_external_url,
        save_temp_image,
        get_backup_dir,
        check_path_accessible,
        copy_backup_to_secondary,
        delete_backup_file,
        append_app_log
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
    .expect("error while building tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_check_path_accessible_valid() {
        tauri::async_runtime::block_on(async {
            let temp_dir = std::env::temp_dir();
            let accessible = check_path_accessible(temp_dir.to_string_lossy().to_string()).await.unwrap();
            assert!(accessible, "Temp dir should be accessible");
        });
    }

    #[test]
    fn test_check_path_accessible_invalid() {
        tauri::async_runtime::block_on(async {
            let accessible = check_path_accessible("Z:\\invalid_path".to_string()).await.unwrap();
            assert!(!accessible, "Z:\\invalid_path should NOT be accessible");
        });
    }

    #[test]
    fn test_copy_backup_to_secondary() {
        tauri::async_runtime::block_on(async {
            let base_temp = std::env::temp_dir().join("makers_backup_test_suite");
            let _ = fs::create_dir_all(&base_temp);

            let src_file = base_temp.join("auto_backup_test.db");
            fs::write(&src_file, b"MOCK_SQLITE_BACKUP_DATA").unwrap();

            let sec_dir = base_temp.join("secondary_dest");
            let dest_path_str = copy_backup_to_secondary(
                src_file.to_string_lossy().to_string(),
                sec_dir.to_string_lossy().to_string(),
                "auto_backup_2026-10-06.db".to_string(),
            ).await.unwrap();

            let dest_file = PathBuf::from(dest_path_str);
            assert!(dest_file.exists(), "Destination backup file must exist");
            let content = fs::read(&dest_file).unwrap();
            assert_eq!(content, b"MOCK_SQLITE_BACKUP_DATA");

            // Cleanup
            let _ = fs::remove_dir_all(&base_temp);
        });
    }

    #[test]
    fn test_delete_backup_file() {
        tauri::async_runtime::block_on(async {
            let temp_file = std::env::temp_dir().join("test_deletable_file.db");
            fs::write(&temp_file, b"data").unwrap();
            assert!(temp_file.exists());

            let deleted = delete_backup_file(temp_file.to_string_lossy().to_string()).await.unwrap();
            assert!(deleted);
            assert!(!temp_file.exists());
        });
    }
}

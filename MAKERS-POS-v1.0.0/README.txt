================================================================================
MAKERS POS — Professional Point of Sale & Retail Management System
Version: 1.0.0 (Official Release Candidate)
Target OS: Microsoft Windows 10 / Windows 11 (64-bit)
Architecture: x86_64 Local-First Desktop Application
================================================================================

1. ABOUT MAKERS POS
-------------------
MAKERS POS is a high-performance, offline-first point of sale and store management
desktop application engineered specifically for retail stores, electronics component
distributors, and commercial retail operations. Built with Tauri 2.x, Rust, and an
embedded SQLite database engine, it delivers zero-latency operations with maximum
data reliability and security.

Key Capabilities:
- Fullscreen / Maximized zero-jump desktop launch experience.
- Fast POS Cashier with Barcode Scanner & Rapid Product Search.
- Barcode Label & Sticker Generator (EAN-13, Code128, custom label dimensions).
- Redesigned Thermal Receipt Printing (80mm & 58mm Xprinter XP-80C / ESC/POS)
  with dynamic cutter margin compensation.
- MAKERS Catalog 1-Click Search & Importer with 4-stage duplicate detection.
- Product & Component Catalog Management with Category / Brand / Unit taxonomies.
- Multi-channel Inventory & Stock Movement Auditing with low-stock alerts.
- Supplier Purchasing & Purchase Order lifecycle management.
- Customer Credit Accounts & Ledger Tracking.
- Resellable (restocked) vs Damaged (scrapped) Returns Processing.
- Operating Expenses & Shift Cash Drawer Reconciliation.
- Executive Business Reports & Financial Analytics.
- Robust Transactional Backup & Automated Snapshot Recovery.


2. SYSTEM REQUIREMENTS
----------------------
- Operating System: Windows 10 (version 1809+) or Windows 11 (64-bit)
- Processor: Intel / AMD Dual Core 2.0 GHz or higher
- RAM: 4 GB minimum (8 GB recommended)
- Storage: 200 MB free disk space for application + database storage
- Display: 1280x800 minimum screen resolution (1920x1080 recommended)
- Prerequisites: Microsoft Edge WebView2 Runtime (Pre-installed on Windows 10/11)
  * Note: Node.js, Python, or external database servers are NOT required.


3. LAUNCHING THE APPLICATION
----------------------------
1. Double-click "MAKERS POS.exe" to start the application.
2. The application opens directly in a clean maximized desktop window.
3. The embedded database initializes automatically on first run.
4. No terminal window or background developer server will appear.


4. INITIAL LOGIN & SECURITY RECOMMENDATION
------------------------------------------
Default Administrator Account:
  - Username: admin
  - Default Password: admin123

CRITICAL SECURITY NOTICE:
Immediately upon first login, navigate to "Settings" -> "Users" and update the
administrator password to a strong, secure passphrase.


5. HARDWARE INTEGRATION
-----------------------
- Thermal Receipt Printers:
  Supports standard 80mm and 58mm ESC/POS thermal printers including Xprinter XP-80C,
  Rongta, Epson, and Windows Spooler-compatible printers. Set paper width in Settings.
- Barcode Scanners:
  Supports standard USB and Bluetooth HID barcode scanners (Code128, EAN-13, UPC).
  Configure scanner in keyboard emulation mode with standard "Enter" terminating suffix.
- Barcode Sticker Printers:
  Supports standard thermal label printers (50x25mm, 40x30mm, 60x40mm, 38x25mm).


6. DATABASE & BACKUP SAFETY
---------------------------
- The active SQLite database is stored locally in:
  %APPDATA%\com.makers.pos\makers_pos.db
- Backups are generated manually or automatically via "Settings" -> "Database & Backups".
- Before every database restore, an emergency snapshot is created automatically.


7. BASIC TROUBLESHOOTING
------------------------
- App fails to start: Ensure Microsoft Edge WebView2 runtime is installed and updated.
- Receipts printing full page: Check printer properties in Windows and ensure paper size is set to 80mm/58mm Roll.
- Barcode scanner not adding items: Verify barcode scanner has "Enter" suffix enabled in its configuration barcode sheet.
================================================================================

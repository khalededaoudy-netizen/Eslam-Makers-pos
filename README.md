# MAKERS POS — Point of Sale & Retail Management Desktop Application

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%2010%20%7C%20Windows%2011%20(64--bit)-0078D7.svg)
![Stack](https://img.shields.io/badge/stack-Tauri%202.x%20%7C%20Rust%20%7C%20React%20%7C%20TypeScript%20%7C%20SQLite-brightgreen.svg)
![License](https://img.shields.io/badge/license-Proprietary-red.svg)

Desktop Point-of-Sale (POS) and inventory management application tailored specifically for electronic components distributors, maker stores, robotics labs, and retail hardware shops.

---

## 🌟 Key Features

### 🛒 High-Speed POS Register
* **Barcode Scanner Integration:** Instant HID barcode scanner input handling with sub-millisecond cart updates.
* **Flexible Payments:** Single and split payments across **Cash**, **Card**, **InstaPay**, **Vodafone Cash**, and **Customer Credit**.
* **Cart Operations:** Multi-cart hold/resume, item discounts, invoice-level discounts, customer selection, and out-of-stock guards.

### 🖨️ Hardware & Thermal Printing
* **Thermal Receipt Printing:** Dedicated support for **Xprinter XP-80C** and standard 80mm / 58mm ESC/POS thermal printers.
* **Custom Receipt Designs:** Configurable store header, VAT registration, cashier details, itemized totals, barcodes, QR codes, and return policies.
* **Cutter Compensation:** Dynamic bottom padding compensation for clean hardware paper cutting.

### 🌐 Bilingual (Arabic / English) & RTL Support
* Native Arabic and English translations with seamless RTL/LTR layout transitions.

### 📦 35 Official MAKERS Master Categories
* Pre-configured with the 35 authoritative MAKERS categories (e.g., *Arduino & Development Boards*, *Sensors*, *Robotics*, *CNC & 3D Printer Parts*, *Power Supply & Converters*).
* Idempotent synchronization engine preventing duplicates during store setup.

### 📊 Full Store Operations
* **Inventory & Warehouses:** Multi-location stock tracking, minimum stock alerts, and immutable inventory movement audit trails.
* **Purchasing & Suppliers:** Supplier directory, purchase orders, receiving workflows, and credit ledger balance tracking.
* **Customers & Balances:** Customer accounts, credit limits, debt management, and transaction history.
* **Cash Register & Shifts:** Opening drawer balance, cash in / cash out movements, expected physical cash reconciliation, and automated midnight shift closing.
* **Returns & Refunds:** Restock vs scrap condition handling with automatic profit adjustment.
* **Operating Expenses:** Expense categorization, cash drawer linkage, and shift expense tracking.
* **Analytics & Reports:** Comprehensive sales, profit, returns, purchasing, and expense financial reports.

### 🔒 Security, RBAC & Granular Permissions
* **Role Hierarchy:** System Administrator, Store Manager, and Cashier.
* **Granular Per-User Matrix:** Custom permission overrides per individual user across 11 functional modules.
* **Audit Trail:** Comprehensive audit logging of all system actions.

### 💾 Backup & Disaster Recovery
* Built-in transactional SQLite backup engine with automatic timestamping, retention rotation, and pre-restore snapshots.

---

## 🛠️ Technology Stack

* **Frontend:** React 18, TypeScript, Tailwind CSS, Lucide Icons, i18next
* **Desktop Runtime:** Tauri 2.x, Rust
* **Local Database:** SQLite with Foreign Key enforcement and PRAGMA integrity
* **Schema Definition:** Drizzle ORM schema mapping
* **Build Engine:** Vite, Cargo

---

## 💻 System Requirements

* **Operating System:** Microsoft Windows 10 / Windows 11 (64-bit)
* **Web Runtime:** Microsoft Edge WebView2 (pre-installed on Windows 10/11)
* **Hardware:** Minimum 4 GB RAM, Dual-Core Processor, 500 MB free disk space
* **Peripherals (Optional):** USB HID Barcode Scanner, USB/Network ESC/POS Thermal Receipt Printer (XP-80C compatible)

---

## 🚀 Development & Build

### Prerequisites
* [Node.js](https://nodejs.org/) (v18 or v20+ LTS recommended)
* [Rust & Cargo](https://rustup.rs/) (Stable toolchain)
* [Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)

### Setup & Run Locally

```bash
# 1. Clone the repository
git clone https://github.com/khalededaoudy-netizen/Eslam-Makers-pos.git
cd Eslam-Makers-pos

# 2. Install dependencies
npm install

# 3. Run frontend development server
npm run dev

# 4. Run full desktop application in Tauri development mode
npm run tauri:dev
```

### Production Build

```bash
# Type check and build frontend assets
npm run build

# Validate Rust backend
cargo check --manifest-path src-tauri/Cargo.toml

# Compile standalone Windows release executable
npm run tauri:build
```

The compiled standalone executable will be generated at `./MAKERS POS.exe` and in `src-tauri/target/release/`.

---

## 🧪 Verification & Automated Regression Tests

Run the complete regression suite (20 test suites, 100% pass):

```bash
# Run comprehensive regression suite
node tests/master_regression_runner.js

# Run individual verification suites
node tests/makers_master_categories_test.js
node tests/user_permissions_e2e_test.js
node tests/pre_test_ux_improvements_test.js
node tests/hardware_acceptance_runner.js
```

---

## 📁 Project Structure

```text
Eslam-Makers-pos/
├── drizzle/                   # Drizzle ORM migration & schema files
├── public/                    # Static assets & icons
├── src/                       # Frontend application source
│   ├── assets/                # Audio files & images
│   ├── components/            # Reusable UI components & layouts (AppShell, Sidebar)
│   ├── features/              # Feature modules (pos, products, sales, returns, expenses, etc.)
│   ├── hooks/                 # Custom React hooks
│   ├── services/              # Business logic & services (db, print, auth, audit, etc.)
│   ├── stores/                # Global state stores (authStore, cartStore, settingsStore)
│   └── types/                 # Shared TypeScript interfaces
├── src-tauri/                 # Tauri Rust backend & window manager
│   ├── icons/                 # Application icon bundle
│   ├── src/                   # Rust entry point (main.rs, lib.rs)
│   ├── Cargo.toml             # Rust dependencies & metadata
│   └── tauri.conf.json        # Tauri desktop configuration
├── tests/                     # Automated QA & E2E verification test suites
├── .env.example               # Environment variables template
├── .gitignore                 # Strict Git exclusion list
├── package.json               # Node.js project manifest
├── tsconfig.json              # TypeScript configuration
└── vite.config.ts             # Vite build pipeline config
```

---

## 🔐 Security & Data Protection

* **No Production Data in Repository:** Real customer records, store financial transactions, and physical database files (`*.db`, `*.sqlite`, `*.bak`) are strictly excluded via `.gitignore`.
* **Zero Hardcoded Secrets:** No API keys, JWT secrets, or production credentials exist in the source code.
* **Offline-First:** All business data resides strictly on the local machine in SQLite (`%APPDATA%/com.makers.pos/makers_pos.db`) without unauthorized external telemetry.

# MAKERS POS — Full Technical Reverse Engineering & System Documentation

> **Document Type:** Production-Grade Technical Reference & Reverse Engineering Specification  
> **Target OS:** Microsoft Windows 10 / Windows 11 (64-bit)  
> **Application Type:** Offline-First Desktop Point of Sale (POS) & Retail Management System  
> **Core Runtime:** Tauri 2.12.0 (Rust) + React 18.3.1 (TypeScript 5.5) + SQLite 3 (`tauri-plugin-sql`)  
> **Author:** Khaled Eldaoudy  
> **Source Verification Status:** 100% inspected from workspace source files  

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Complete System Architecture](#2-complete-system-architecture)
3. [Complete Project Structure](#3-complete-project-structure)
4. [Technology Stack](#4-technology-stack)
5. [Application Startup / Boot Flow](#5-application-startup--boot-flow)
6. [Complete Data Flow](#6-complete-data-flow)
7. [Database Documentation](#7-database-documentation)
8. [Authentication](#8-authentication)
9. [Authorization / RBAC](#9-authorization--rbac)
10. [Routes / Pages / Screens](#10-routes--pages--screens)
11. [Component Architecture](#11-component-architecture)
12. [State Management](#12-state-management)
13. [Services Layer](#13-services-layer)
14. [API / External Integrations](#14-api--external-integrations)
15. [Hardware Integration](#15-hardware-integration)
16. [Printing System](#16-printing-system)
17. [Barcode System](#17-barcode-system)
18. [Business Logic](#18-business-logic)
19. [POS / Sales Flow](#19-pos--sales-flow)
20. [Inventory Flow](#20-inventory-flow)
21. [Error Handling](#21-error-handling)
22. [Logging & Debugging](#22-logging--debugging)
23. [Configuration](#23-configuration)
24. [Security Review](#24-security-review)
25. [Testing](#25-testing)
26. [Build System](#26-build-system)
27. [Deployment & Release Process](#27-deployment--release-process)
28. [File System & Data Storage](#28-file-system--data-storage)
29. [Constants / Enums / Magic Values](#29-constants--enums--magic-values)
30. [Dependency Map](#30-dependency-map)
31. [Critical Files](#31-critical-files)
32. [Modification Guide](#32-modification-guide)
33. [Change Impact Analysis](#33-change-impact-analysis)
34. [Known Bugs](#34-known-bugs)
35. [Technical Debt](#35-technical-debt)
36. [TODO / FIXME / HACK](#36-todo--fixme--hack)
37. [Performance Analysis](#37-performance-analysis)
38. [Complete User Flows](#38-complete-user-flows)
39. [Developer Workflow](#39-developer-workflow)
40. [Safe Modification Rules](#40-safe-modification-rules)
41. [Final System Map](#41-final-system-map)
42. [Implementation Status](#42-implementation-status)
43. [Documentation Accuracy Rules](#43-documentation-accuracy-rules)
44. [Final Verification](#44-final-verification)
45. [Final Document Status & Limitations](#45-final-document-status--limitations)

---

# 1. PROJECT OVERVIEW

### 1.1 Purpose and Problem Statement
**MAKERS POS** is a dedicated offline-first Windows desktop point-of-sale, inventory control, and retail ERP system built for **MAKERS** (`makerselectronics.com`), an electronic components and robotics supplier based in Egypt.

Electronic component retail presents distinct operational complexities that standard POS software fails to resolve:
1. **High SKU Density & Parametric Diversity:** Thousands of small passive/active electronics parts (resistors, capacitors, ICs, microcontrollers, development boards) with specific footprint packages, storage drawer/bin numbers, and datasheets.
2. **Offline Resilience:** Commercial operations must continue without interruption during internet outages. All transactions, inventory updates, and shift balances are committed locally to SQLite.
3. **Hardware Precision:** Seamless, direct communication with 80mm/58mm thermal receipt printers (ESC/POS), hardware cash drawers, and barcode scanners without popups or browser preview dialogs.
4. **Catalog Synchronization:** Bi-directional operational compatibility with the online WooCommerce catalog of `makerselectronics.com`.
5. **Rigorous Financial Reconciliation:** Complete auditability of drawer cash movements, register sessions, returns with stock condition classification, and shift closure.

### 1.2 Target Users
- **Cashiers:** Fast barcode scanning, cart management, checkout with split/multi-tender payments, and receipt printing.
- **Store Managers:** Shift opening/closing, drawer cash drops/withdrawals, inventory adjustments, purchase receiving, and operational expense tracking.
- **Inventory Controllers:** Stock receiving, warehouse-to-shelf transfers, barcode label sticker batch printing, and Excel catalog importing.
- **System Administrators:** User creation, granular permission matrix assignment, system settings, database backups, and audit inspection.

### 1.3 Application Profile
- **Application Type:** Native Desktop Application (Windows 64-bit).
- **Core Runtime:** Tauri v2.12.0 with WebView2 front-end and compiled Rust native binary.
- **Frontend Stack:** React 18.3.1 SPA with Vite 5.4.8 bundler, TypeScript 5.5.3, Tailwind CSS 3.4.13, and Zustand 4.5.5.
- **Database:** Local SQLite (`makers_pos.db`) stored in `%APPDATA%\com.makers.pos\`, operated via `tauri-plugin-sql` with Write-Ahead Logging (`WAL`), strict foreign keys, and 10-second busy timeout.
- **Packaging:** NSIS Installer, WiX MSI Installer, and Standalone Portable Executable (`MAKERS POS.exe`).

### 1.4 Technology Matrix

| Component | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Desktop Framework** | Tauri | 2.12.0 / CLI 2.0.0 | Lightweight native OS bridge, windowing, and IPC |
| **Native Runtime** | Rust | Edition 2024 (rustc 1.90+) | Native Windows spooler printing, drawer pulse, HTTP proxy |
| **Frontend Framework** | React | 18.3.1 | Component-based reactive UI |
| **Language** | TypeScript | 5.5.3 | Static typing across all business logic and UI |
| **Bundler & Dev Server**| Vite | 5.4.8 | Lightning-fast HMR and Rollup production build |
| **Styling** | Tailwind CSS | 3.4.13 | Custom design system with HSL variables & RTL support |
| **Database Engine** | SQLite 3 | Via `tauri-plugin-sql` 2.0.0 | Authoritative local relational data storage |
| **State Management** | Zustand | 4.5.5 | Global client stores (`authStore`, `cartStore`, `settingsStore`)|
| **Internationalization**| i18next + react-i18next | 23.15.1 / 15.0.2 | Complete Arabic (RTL) & English (LTR) localization |
| **Receipt Rendering** | html2canvas | 1.4.1 | High-DPI DOM rasterization for thermal printer bitmaps |
| **Barcode Engine** | bwip-js | 3.4.0 | Exact Code128 / EAN-13 barcode generation for canvas |
| **Spreadsheet Engine** | xlsx (SheetJS) | 0.18.5 | Excel product catalog import and export |
| **Charting** | Recharts | 2.12.7 | Visual dashboard and report analytics graphs |
| **Authentication Hash**| bcryptjs | 2.4.3 | Blowfish cryptographic password hashing (12 rounds) |
| **HTTP Native Client** | Reqwest | 0.12 (rustls-tls) | Secure native HTTP client in Rust bypassing CORS |

---

# 2. COMPLETE SYSTEM ARCHITECTURE

```mermaid
flowchart TB
    subgraph ClientUI ["Frontend Presentation Layer (React 18 + TypeScript)"]
        UI_Components["Pages, Views, Modals & Components"]
        I18N["i18next (Arabic RTL / English LTR)"]
        Zustand_Stores["Zustand Stores (authStore, cartStore, settingsStore)"]
    end

    subgraph ServiceLayer ["Application Service Layer (TypeScript)"]
        POS_Svc["posService / salesService"]
        Inv_Svc["inventoryService / purchaseService"]
        Cash_Svc["cashRegisterService / expenseService"]
        Auth_Svc["authService / auditService"]
        Makers_Svc["makersService (WooCommerce Sync)"]
        DirectPrint_Svc["directPrint.ts (Receipt Canvas Rasterizer)"]
        DB_Svc["database.ts / transaction.ts (withTransaction)"]
    end

    subgraph TauriIPC ["Tauri IPC & Bridge Layer"]
        IPC_Invoke["Tauri invoke() Channel"]
        Plugin_SQL["tauri-plugin-sql Bridge"]
    end

    subgraph RustNative ["Desktop Native Backend (Rust - src-tauri/src/lib.rs)"]
        Cmd_Printers["list_printers / get_default_printer"]
        Cmd_PrintImg["print_receipt_image (System.Drawing PrintDocument)"]
        Cmd_Drawer["open_cash_drawer (winspool.drv RAW ESC/POS)"]
        Cmd_MakersURL["fetch_makers_url (Reqwest Whitelisted GET)"]
        Cmd_MakersImg["download_makers_image (Image File Writer)"]
    end

    subgraph OS_Hardware ["Operating System & Hardware"]
        WinSpool["Windows Print Spooler (winspool.drv)"]
        PrinterHW["Thermal Receipt Printer (XP-80C 80mm)"]
        CashDrawerHW["RJ11 / RJ12 Physical Cash Drawer"]
        HID_Scanner["USB HID Keyboard Barcode Scanner"]
        SQLite_File["SQLite Database: %APPDATA%/com.makers.pos/makers_pos.db"]
        Img_Folder["Local Images: %APPDATA%/com.makers.pos/product_images/"]
    end

    UI_Components --> Zustand_Stores
    UI_Components --> ServiceLayer
    Zustand_Stores --> ServiceLayer

    ServiceLayer --> DB_Svc
    DB_Svc --> Plugin_SQL
    Plugin_SQL --> SQLite_File

    DirectPrint_Svc --> IPC_Invoke
    Makers_Svc --> IPC_Invoke

    IPC_Invoke --> RustNative
    RustNative --> WinSpool
    RustNative --> Img_Folder

    WinSpool --> PrinterHW
    WinSpool --> CashDrawerHW
    HID_Scanner -.->|Keystroke Wedge Buffer| UI_Components
```

### Architecture Highlights:
1. **Pure Offline Execution:** The entire system functions without active network connections. All product queries, cart calculations, stock validations, and transaction commits run locally in SQLite.
2. **Atomic Managed Transactions (`withTransaction`):** Managed exclusively in `src/services/db/transaction.ts` with `BEGIN IMMEDIATE TRANSACTION`, mutex lock flag (`txActive`), and isolated error boundaries to completely prevent `database is locked (code 5)` errors.
3. **Native Direct Thermal Printing:** Bypasses web browser preview dialogs. Receipts are rendered into an isolated off-screen host, rasterized via `html2canvas` at scale 2, and transmitted via Tauri IPC to Rust, which invokes `System.Drawing.Printing.PrintDocument` for direct spooling to thermal hardware.
4. **Physical Cash Drawer Kick:** Triggered natively via Rust through Windows `winspool.drv` using standard ESC/POS pulses (`\x1B\x70\x00\x19\xFA` and `\x1B\x70\x01\x19\xFA`) directly to the connected receipt printer.

---

# 3. COMPLETE PROJECT STRUCTURE

```text
Eslam-Makers-pos/
├── .env.example
├── .gitignore
├── .oxlintrc.json
├── index.html
├── package.json
├── package-lock.json
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
├── MAKERS POS.exe                         # Root synchronized production executable
├── MAKERS-POS-v1.0.0/                     # Release artifact staging folder
├── MAKERS_POS_v1.0.0_Windows_Release/     # Release folder (NSIS, MSI, Portable, Checksums)
├── scripts/
│   └── package_and_hash.js                # Release packaging and SHA256 checksum automation
├── tests/                                 # 29 Regression, Acceptance & Verification Scripts
│   ├── clean_duplicate_categories.js
│   ├── customers_verification.js
│   ├── dashboard_verification.js
│   ├── expenses_verification.js
│   ├── full_legacy_audit.js
│   ├── hardware_acceptance_runner.js
│   ├── inspect_installed_db.js
│   ├── makers_catalog_verification.js
│   ├── makers_master_categories_test.js
│   ├── master_regression_runner.js
│   ├── navigation_route_matching_test.js
│   ├── patch15_production_qa.js
│   ├── patch16_production_hardening.js
│   ├── patch17_master_audit.js
│   ├── payments_cash_register_verification.js
│   ├── phase2_verification.js
│   ├── phase3_verification.js
│   ├── phase6_purchasing_verification.js
│   ├── pos_core_verification.js
│   ├── pre_release_modifications_test.js
│   ├── pre_test_ux_improvements_test.js
│   ├── production_data_reset.js
│   ├── real_world_acceptance_test.js
│   ├── reports_verification.js
│   ├── returns_verification.js
│   ├── sales_receipts_verification.js
│   ├── user_permissions_e2e_test.js
│   └── verify_idempotent_seeding.js
├── src-tauri/                             # Tauri 2 Desktop & Rust Backend
│   ├── Cargo.toml
│   ├── Cargo.lock
│   ├── tauri.conf.json
│   ├── icons/
│   └── src/
│       ├── main.rs                        # Binary entry point
│       └── lib.rs                         # Tauri command handlers & native implementations
└── src/                                   # Frontend TypeScript & React Application
    ├── main.tsx                           # React DOM mount point
    ├── App.tsx                            # Bootstrap, DB init, and auth routing
    ├── index.css                          # Design tokens, themes, and thermal print styles
    ├── assets/
    │   └── logo.png                       # Official store logo for UI and thermal receipt
    ├── components/
    │   ├── auth/
    │   │   └── ProtectedRoute.tsx         # Route-level RBAC guard
    │   ├── common/
    │   │   ├── ConfirmDialog.tsx          # Reusable confirmation modal
    │   │   └── ProductImage.tsx           # Image renderer with local/remote fallback
    │   └── layout/
    │       ├── AppShell.tsx               # Main layout container & page router
    │       ├── Header.tsx                 # Top bar with user profile, shift status, and search
    │       └── Sidebar.tsx                # Collapsible navigation drawer
    ├── features/                          # Feature-Driven Business Modules
    │   ├── audit/
    │   │   └── AuditPage.tsx              # Audit log viewer
    │   ├── auth/
    │   │   └── LoginPage.tsx              # Login screen with credentials form
    │   ├── barcodes/
    │   │   └── BarcodesPage.tsx           # Barcode label sticker designer & printer
    │   ├── cash-register/
    │   │   ├── CashRegisterPage.tsx       # Shift management dashboard
    │   │   ├── cashRegisterService.ts     # Authoritative shift & reconciliation logic
    │   │   ├── types.ts
    │   │   └── components/                # Open/Close Shift & Cash Movement Modals
    │   ├── customers/
    │   │   ├── CustomersPage.tsx          # Customer directory and credit manager
    │   │   └── components/
    │   ├── dashboard/
    │   │   ├── DashboardPage.tsx          # Executive KPI cards and charts
    │   │   └── dashboardService.ts
    │   ├── expenses/
    │   │   ├── ExpensesPage.tsx           # Operating expenses list
    │   │   └── expenseService.ts          # Expense logging and cash-impact handler
    │   ├── inventory/
    │   │   ├── InventoryPage.tsx          # Multi-warehouse stock browser
    │   │   └── components/                # Stock In/Out, Transfer, Adjustment Modals
    │   ├── payments/
    │   │   ├── paymentService.ts          # Payment allocation & tender logic
    │   │   └── types.ts
    │   ├── pos/
    │   │   ├── PosPage.tsx                # Fast checkout POS screen
    │   │   ├── posService.ts              # Cart calculation, hold/resume, product search
    │   │   ├── types.ts
    │   │   └── components/
    │   ├── products/
    │   │   ├── ProductsPage.tsx           # Product catalog table
    │   │   ├── CategoriesPage.tsx         # Category manager
    │   │   ├── BrandsPage.tsx             # Brand manager
    │   │   ├── UnitsPage.tsx              # Measurement units manager
    │   │   ├── AttributesPage.tsx         # Parametric electronics attributes
    │   │   └── components/                # ProductForm, ExcelImportModal, MakersImportModal
    │   ├── purchases/
    │   │   ├── PurchasesPage.tsx          # Supplier orders and stock receiving
    │   │   └── components/
    │   ├── reports/
    │   │   ├── ReportsPage.tsx            # Financial and sales reports
    │   │   └── reportsService.ts          # Comprehensive SQL aggregation engine
    │   ├── returns/
    │   │   ├── ReturnsPage.tsx            # Returns history
    │   │   ├── returnService.ts           # Condition-aware refund and restock engine
    │   │   └── components/                # CreateReturnModal, ReturnReceiptModal
    │   ├── sales/
    │   │   ├── SalesPage.tsx              # Invoice history and reprint
    │   │   ├── salesService.ts            # Atomic sale creation and stock deduction
    │   │   └── components/                # CheckoutModal, ReceiptModal
    │   ├── settings/
    │   │   └── SettingsPage.tsx           # Configuration tabs (Store, POS, Printer, HW)
    │   ├── suppliers/
    │   │   ├── SuppliersPage.tsx          # Supplier directory and debt manager
    │   │   └── components/
    │   └── users/
    │       └── UsersPage.tsx              # Staff management & custom permission matrix
    ├── lib/
    │   ├── formatters.ts                  # Currency, date, and unit formatters
    │   └── openUrl.ts                     # External browser launcher via Tauri shell
    ├── services/
    │   ├── audit/auditService.ts          # Central audit trail writer
    │   ├── auth/authService.ts            # Authentication, sessions, and RBAC
    │   ├── categories/                    # Official 35 MAKERS categories
    │   ├── customers/customerService.ts
    │   ├── db/
    │   │   ├── database.ts                # SQLite init, schema migrations, and seeding
    │   │   ├── transaction.ts             # Atomic transaction manager with BEGIN IMMEDIATE
    │   │   └── backupService.ts           # Backup rotation and integrity checks
    │   ├── hardware/HardwareManager.ts    # Hardware abstraction layer
    │   ├── i18n/i18n.ts                   # Translation dictionaries (ar / en)
    │   ├── inventory/inventoryService.ts  # Multi-warehouse stock movement engine
    │   ├── makers/                        # WooCommerce Store API client and mapper
    │   ├── printer/directPrint.ts         # Direct thermal printing & drawer kick engine
    │   ├── products/productService.ts     # CRUD for products, barcodes, and attributes
    │   ├── purchases/purchaseService.ts   # Supplier purchase orders and debts
    │   ├── settings/settingsService.ts    # SQLite settings persistence
    │   └── suppliers/supplierService.ts
    └── stores/
        ├── authStore.ts                   # Active user, JWT-like session, and RBAC helpers
        ├── cartStore.ts                   # POS shopping cart state & line items
        └── settingsStore.ts               # Authoritative runtime configuration store
```

### Key Folder and File Directory

| Path | Type | Responsibility | Importance |
| :--- | :--- | :--- | :--- |
| `src-tauri/src/lib.rs` | Rust Source | Implements native Windows commands: `print_receipt_image`, `open_cash_drawer`, `fetch_makers_url`, `download_makers_image` | **CRITICAL:** High risk. Native printing and drawer kick fail if broken. |
| `src/services/db/database.ts` | TypeScript | Initializes SQLite, executes 12 migrations, and seeds default roles, admin, units, and 35 MAKERS categories. | **CRITICAL:** Core database schema engine. |
| `src/services/db/transaction.ts` | TypeScript | Enforces `withTransaction` using `BEGIN IMMEDIATE TRANSACTION` and `txActive` mutex. | **CRITICAL:** Protects against `database is locked (code 5)`. |
| `src/services/printer/directPrint.ts` | TypeScript | Off-screen DOM clone host, `html2canvas` rasterizer, and direct spooling dispatcher. | **CRITICAL:** High impact on physical receipt formatting and paper feeding. |
| `src/features/sales/salesService.ts` | TypeScript | Creates sales invoices, deducts product inventory, records payment tenders, and writes cash ledger movements. | **CRITICAL:** Primary revenue generation pipeline. |
| `src/features/pos/posService.ts` | TypeScript | Cart total calculations (tax, discount), product live search, cart hold/resume, and active shift query. | **HIGH:** Powers the main POS checkout screen. |
| `src/features/returns/returnService.ts` | TypeScript | Validates return eligibility, processes partial/full refunds, adjusts stock based on condition, and updates cash drawer. | **HIGH:** Prevents financial loss and inventory discrepancies. |
| `src/features/cash-register/cashRegisterService.ts` | TypeScript | Shift management, drawer cash in/out, reconciliation, and automated business-day cutoff close. | **HIGH:** Enforces register drawer accountability. |
| `src/stores/authStore.ts` | TypeScript | Zustand authentication store with `usePermission` RBAC helper supporting wildcard and alias rules. | **HIGH:** Controls access to all routes and features. |
| `src/stores/settingsStore.ts` | TypeScript | Authoritative configuration store synchronized with SQLite `settings` table. | **MEDIUM:** System-wide settings behavior. |

---

# 4. TECHNOLOGY STACK DETAILS

### 4.1 Runtime & Frameworks
- **Tauri 2.12.0:** High-performance, memory-efficient native wrapper. Generates a ~15 MB executable compared to ~120 MB Electron bundles. Uses Microsoft Edge WebView2 on Windows.
- **Rust 1.90+ (Edition 2024):** Handles direct Win32 API calls (`winspool.drv`, `System.Drawing`) and secure background networking.
- **React 18.3.1:** Powers the client SPA with concurrent features and lazy component loading for all secondary routes.
- **Vite 5.4.8:** Production builder utilizing Rollup with code splitting and terser minification.

### 4.2 UI and Design System
- **Tailwind CSS 3.4.13:** Styled with custom CSS custom properties (HSL color tokens), bespoke MAKERS brand colors (`#0078D7` blue, `#D92528` red), and dark mode by default.
- **Lucide React 0.447.0:** Consistent iconography across all 18 modules.
- **Radix UI Primitives:** Accessible, headless dialogs, dropdowns, tooltips, and accordion structures.

### 4.3 Data Storage & Persistence
- **SQLite 3 (`tauri-plugin-sql` 2.0.0):** Embedded relational database engine. Operates with `PRAGMA journal_mode = WAL;`, `PRAGMA busy_timeout = 10000;`, `PRAGMA foreign_keys = ON;`, and a 64 MB page cache.
- **Zustand 4.5.5:** Lightweight client state management with `persist` middleware backed by `localStorage` for session tokens and UI preferences.

---

# 5. APPLICATION STARTUP / BOOT FLOW

```mermaid
sequenceDiagram
    autonumber
    actor User as Operator / Cashier
    participant Main as src/main.tsx
    participant App as src/App.tsx (AppBootstrap)
    participant DB as src/services/db/database.ts
    participant Settings as src/services/settings/settingsService.ts
    participant Auth as src/services/auth/authService.ts
    participant Router as src/components/layout/AppShell.tsx

    User->>Main: Launch MAKERS POS.exe
    Main->>App: Mount <AppBootstrap />
    Note over App: Set document lang (ar), dir (rtl), theme (dark)
    App->>DB: initDatabase()
    Note over DB: Database.load('sqlite:makers_pos.db')
    Note over DB: Run PRAGMA journal_mode = WAL & busy_timeout = 10000
    DB->>DB: runMigrations() (Checks versions 1 to 12)
    App->>DB: seedInitialData(adminPasswordHash)
    Note over DB: Seed roles, admin, units, 35 categories, settings
    App->>Settings: initSettings() & loadFromDb()
    Note over Settings: Populate settingsStore from SQLite
    App->>Auth: validateSession(token)
    alt Session Valid
        Auth-->>App: Return AuthUser with permissions
        App->>Router: Render <AppShell />
        Router-->>User: Display Home / Dashboard or POS
    else Session Expired or Empty
        Auth-->>App: Return null
        App-->>User: Display <LoginPage />
    end
```

### Exact Startup Details:
1. **Entry (`src/main.tsx`):** Renders `<App />` wrapped in `<React.StrictMode>` and `<I18nextProvider>`.
2. **DOM Bootstrap (`src/App.tsx`):**
   - Applies language (`ar`) and text direction (`rtl`).
   - Toggles theme classes (`dark` / `light`).
   - Invokes `initDatabase()`: Connects to `sqlite:makers_pos.db` via `tauri-plugin-sql`.
   - Executes PRAGMAs immediately: `PRAGMA journal_mode = WAL`, `PRAGMA busy_timeout = 10000`, `PRAGMA foreign_keys = ON`.
   - Iterates through the migration array (versions 1 to 12) and applies unapplied schema changes.
   - Invokes `seedInitialData()`: Idempotently inserts default roles (`admin`, `manager`, `cashier`), default administrator account, 9 standard measurement units, 35 official MAKERS master categories, and 15 electronic attribute definitions.
   - Loads authoritative store configuration from SQLite into `useSettingsStore`.
   - Checks stored token in `useAuthStore` against the `sessions` table via `authService.validateSession()`.
   - Cleans expired sessions with `authService.cleanExpiredSessions()`.
   - Terminates loading spinner and renders either `<AppShell />` or `<LoginPage />`.

---

# 6. COMPLETE DATA FLOW

### 6.1 Generic Operational Flow
```text
User Action (Keyboard / Click / Scanner)
    │
    ▼
React Component / View (e.g., PosPage.tsx)
    │
    ▼
Client Validation (Zod schema / Form check / Quantity check)
    │
    ▼
Zustand Store Action (e.g., cartStore.addItem)
    │
    ▼
Service Layer Invocation (e.g., salesService.createSale)
    │
    ▼
Database Transaction (transaction.ts: withTransaction -> BEGIN IMMEDIATE)
    │
    ├── Step A: Insert Records (sales, sale_items, payments)
    ├── Step B: Update Inventory & Insert Movements (products, inventory_movements)
    └── Step C: Update Cash Ledger (cash_movements if cash tender)
    │
    ▼
Commit Transaction (COMMIT)
    │
    ▼
Audit Log Record (auditService.log -> audit_logs table)
    │
    ▼
Hardware Dispatches (Outside Transaction):
    ├── Print Thermal Receipt (directPrint.ts -> print_receipt_image)
    └── Kick Cash Drawer (openCashDrawerDirect -> open_cash_drawer)
    │
    ▼
UI State Update (Clear Cart, Show Receipt Modal, Refresh Products)
```

---

# 7. DATABASE DOCUMENTATION

### 7.1 Database Profile
- **Engine:** SQLite 3 (Managed via `tauri-plugin-sql`).
- **File Location:** `%APPDATA%\com.makers.pos\makers_pos.db`
- **Concurrency Mode:** WAL (`Write-Ahead Logging`) with `PRAGMA synchronous = NORMAL;`.
- **Busy Timeout:** `10000` ms (10 seconds) to guarantee zero lock collisions under concurrent writes.
- **Foreign Keys:** Enabled (`PRAGMA foreign_keys = ON;`).

### 7.2 Entity Relationship Diagram (Mermaid)

```mermaid
erDiagram
    ROLES ||--o{ USERS : "assigned to"
    ROLES ||--o{ PERMISSIONS : "defines defaults"
    USERS ||--o{ USER_PERMISSIONS : "custom overrides"
    USERS ||--o{ SESSIONS : "creates"
    USERS ||--o{ SHIFTS : "operates"
    CASH_REGISTERS ||--o{ SHIFTS : "allocated to"
    SHIFTS ||--o{ CASH_MOVEMENTS : "records cash flow"
    SHIFTS ||--o{ SALES : "groups"
    SHIFTS ||--o{ RETURNS : "groups"
    SHIFTS ||--o{ EXPENSES : "groups"

    PRODUCT_CATEGORIES ||--o{ PRODUCTS : "classifies"
    PRODUCT_UNITS ||--o{ PRODUCTS : "quantifies"
    BRANDS ||--o{ PRODUCTS : "brands"
    SUPPLIERS ||--o{ PRODUCTS : "supplies"
    SUPPLIERS ||--o{ PURCHASES : "bills"
    CUSTOMERS ||--o{ SALES : "purchases"
    CUSTOMERS ||--o{ RETURNS : "refunded"

    PRODUCTS ||--o{ PRODUCT_BARCODES : "has"
    PRODUCTS ||--o{ PRODUCT_ATTRIBUTE_VALUES : "parameterized by"
    PRODUCT_ATTRIBUTE_DEFS ||--o{ PRODUCT_ATTRIBUTE_VALUES : "defines"
    PRODUCTS ||--o{ INVENTORY_MOVEMENTS : "tracks stock"
    PRODUCTS ||--o{ PRODUCT_LOCATIONS : "stored in"
    STORAGE_LOCATIONS ||--o{ PRODUCT_LOCATIONS : "contains"

    SALES ||--|{ SALE_ITEMS : "contains"
    PRODUCTS ||--o{ SALE_ITEMS : "sold as"
    SALES ||--|{ PAYMENTS : "settled by"
    SALES ||--o{ RETURNS : "originates"

    RETURNS ||--|{ RETURN_ITEMS : "contains"
    SALE_ITEMS ||--o{ RETURN_ITEMS : "returns item from"
    PRODUCTS ||--o{ RETURN_ITEMS : "restocks"
    RETURNS ||--o{ PAYMENTS : "refunded via"

    PURCHASES ||--|{ PURCHASE_ITEMS : "contains"
    PURCHASES ||--o{ PURCHASE_PAYMENTS : "paid by"
    PRODUCTS ||--o{ PURCHASE_ITEMS : "purchased item"
```

### 7.3 Database Table Specifications

#### 1. `roles`
System access tiers.
- `id` (TEXT, PK): Unique UUID.
- `name` (TEXT, UNIQUE): System key (`admin`, `manager`, `cashier`).
- `display_name` (TEXT): English name.
- `display_name_ar` (TEXT): Arabic name.
- `is_system` (INTEGER): `1` if protected system role.

#### 2. `permissions`
Role-level default permissions.
- `id` (TEXT, PK): UUID.
- `role_id` (TEXT, FK -> `roles.id`): Target role.
- `resource` (TEXT): Resource identifier (e.g., `pos`, `products`, `sales`, `shifts`).
- `action` (TEXT): Action verb (e.g., `read`, `create`, `update`, `delete`, `close`).
- `allowed` (INTEGER): `1` if permitted.

#### 3. `users`
Staff and operator accounts.
- `id` (TEXT, PK): UUID.
- `username` (TEXT, UNIQUE): Login username.
- `password_hash` (TEXT): bcrypt hash.
- `full_name` (TEXT): Full name in English.
- `full_name_ar` (TEXT, Nullable): Full name in Arabic.
- `role_id` (TEXT, FK -> `roles.id`): Primary assigned role.
- `is_active` (INTEGER): `1` if active, `0` if disabled.
- `last_login_at` (TEXT, Nullable): ISO timestamp of last successful authentication.

#### 4. `user_permissions`
Per-user custom permission overrides (Migration 012).
- `id` (TEXT, PK): UUID.
- `user_id` (TEXT, FK -> `users.id` ON DELETE CASCADE).
- `resource` (TEXT), `action` (TEXT), `allowed` (INTEGER): Override definition.
- `UNIQUE(user_id, resource, action)`.

#### 5. `sessions`
Authentication session tokens.
- `id` (TEXT, PK): UUID.
- `user_id` (TEXT, FK -> `users.id`).
- `token` (TEXT, UNIQUE): Random dual-UUID string (`uuid + '-' + uuid`).
- `expires_at` (TEXT): ISO timestamp (8-hour lifetime).

#### 6. `settings`
Persistent application key-value configuration.
- `key` (TEXT, PK): Configuration key.
- `value` (TEXT, Nullable): Value payload.
- `category` (TEXT): `general`, `store`, `pos`, `receipt`, `hardware`, `inventory`, `backup`.

#### 7. `products`
The core catalog item repository.
- `id` (TEXT, PK): UUID.
- `sku` (TEXT, UNIQUE): Unique stock keeping unit.
- `name_ar` (TEXT), `name_en` (TEXT): Dual language names.
- `category_id` (TEXT, FK -> `product_categories.id`).
- `unit_id` (TEXT, FK -> `product_units.id`).
- `brand_id` (TEXT, Nullable, FK -> `brands.id`).
- `default_supplier_id` (TEXT, Nullable, FK -> `suppliers.id`).
- `purchase_price` (REAL): Cost of goods.
- `selling_price` (REAL): Base retail price.
- `current_stock` (REAL): Total aggregated available stock across all locations.
- `min_stock` (REAL): Low-stock warning threshold.
- `drawer_location` (TEXT, Nullable): Physical drawer/bin identifier.
- `footprint_package` (TEXT, Nullable): Electronics package (e.g., `DIP-8`, `SMD 0805`, `TO-220`).
- `datasheet_url` (TEXT, Nullable): Direct link to technical specification PDF.
- `source_type` (TEXT): `LOCAL` or `MAKERS_API`.
- `external_product_id` (TEXT, Nullable): Online WooCommerce product ID.
- `external_url` (TEXT, Nullable): Web page URL on `makerselectronics.com`.
- `website_price` (REAL, Nullable): Online retail price.
- `image_path` (TEXT, Nullable): Absolute path to cached image on disk.
- `is_active` (INTEGER): Soft deletion flag (`1` active, `0` archived).

#### 8. `product_barcodes`
Multi-barcode mapping per product.
- `id` (TEXT, PK), `product_id` (TEXT, FK -> `products.id` ON DELETE CASCADE).
- `barcode` (TEXT, UNIQUE): Barcode string.
- `type` (TEXT): `code128`, `ean13`, `qr`.
- `is_default` (INTEGER): Primary barcode indicator.

#### 9. `product_attribute_defs` & `product_attribute_values`
Parametric electronics attributes (e.g., Resistance, Capacitance, Voltage, Tolerance).
- `product_attribute_defs`: `id`, `name_ar`, `name_en`, `unit` (e.g., `Ω`, `µF`, `V`), `data_type`.
- `product_attribute_values`: `product_id`, `attribute_id`, `value`.

#### 10. `storage_locations` & `product_locations`
Multi-warehouse and shelf inventory distribution.
- `storage_locations`: `id`, `name`, `name_ar`, `code` (e.g., `MAIN`, `WH1`), `description`.
- `product_locations`: `product_id`, `location_id`, `quantity`, `drawer_bin`.

#### 11. `inventory_movements`
Immutable inventory movement audit ledger.
- `id` (TEXT, PK), `product_id` (TEXT, FK -> `products.id`).
- `type` (TEXT): `sale`, `return_restock`, `purchase`, `adjustment`, `transfer`, `initial`.
- `quantity` (REAL): Signed quantity change (+ for stock in, - for stock out).
- `stock_before` (REAL), `stock_after` (REAL): Point-in-time balance snapshots.
- `reference_id` (TEXT, Nullable): Sale ID, Return ID, or Purchase ID.
- `reference_type` (TEXT, Nullable): `sale`, `return`, `purchase`, `manual`.
- `user_id` (TEXT, Nullable, FK -> `users.id`).

#### 12. `cash_registers` & `shifts`
Physical registers and cashier work sessions.
- `cash_registers`: `id`, `name`, `name_ar`, `is_active`.
- `shifts`: `id`, `register_id`, `user_id`, `status` (`open` / `closed`), `opening_balance`, `closing_balance`, `expected_balance`, `difference`, `cash_sales`, `cash_refunds`, `cash_expenses`, `cash_withdrawals`, `cash_deposits`, `opened_at`, `closed_at`.

#### 13. `cash_movements`
The definitive physical cash drawer ledger.
- `id` (TEXT, PK), `register_id` (TEXT, FK), `shift_id` (TEXT, FK), `user_id` (TEXT, FK).
- `amount` (REAL): Transaction cash value.
- `type` (TEXT): `opening`, `sale_cash`, `refund_cash`, `expense`, `cash_in`, `cash_out`, `closing`.
- `direction` (TEXT): `in` (cash added to drawer) or `out` (cash removed from drawer).
- `reason` (TEXT): Operational explanation.

#### 14. `sales` & `sale_items`
POS sales transactions and item snapshots.
- `sales`: `id`, `invoice_number` (`INV-YYYYMMDD-XXXXXX`), `shift_id`, `register_id`, `cashier_id`, `customer_id`, `status` (`completed`, `voided`), `subtotal`, `discount_amount`, `discount_pct`, `tax_amount`, `total`, `paid_amount`, `change_amount`, `created_at`.
- `sale_items`: `id`, `sale_id`, `product_id`, `product_name`, `product_sku`, `barcode`, `quantity`, `unit_price`, `cost_price`, `discount_amount`, `discount_pct`, `subtotal`, `profit`.

#### 15. `payments`
Tender allocations for sales and refunds.
- `id` (TEXT, PK), `sale_id` (TEXT, Nullable), `return_id` (TEXT, Nullable), `shift_id` (TEXT, Nullable).
- `method` (TEXT): `cash`, `card`, `vodafone_cash`, `instapay`, `other`.
- `amount` (REAL): Tendered amount.

#### 16. `returns` & `return_items`
Condition-aware customer return transactions.
- `returns`: `id`, `return_number` (`RET-YYYYMMDD-XXXXXX`), `sale_id`, `processed_by_id`, `shift_id`, `register_id`, `customer_id`, `subtotal`, `discount_amount`, `tax_amount`, `total_amount`, `refund_amount`, `refund_method`, `status`.
- `return_items`: `id`, `return_id`, `sale_item_id`, `product_id`, `quantity`, `unit_price`, `subtotal`, `condition` (`resellable` / `damaged`).

#### 17. `purchases` & `purchase_items` & `purchase_payments`
Supplier procurement, accounts payable, and receiving.
- `purchases`: `id`, `purchase_number` (`PUR-YYYYMMDD-XXXXXX`), `supplier_id`, `received_by_id`, `location_id`, `status` (`draft`, `completed`, `cancelled`), `subtotal`, `total`, `paid_amount`, `balance`, `payment_status` (`paid`, `partial`, `unpaid`), `invoice_ref`.
- `purchase_items`: `id`, `purchase_id`, `product_id`, `quantity`, `unit_cost`, `subtotal`, `received_qty`.
- `purchase_payments`: `id`, `purchase_id`, `supplier_id`, `amount`, `payment_method`, `created_at`.

#### 18. `expenses` & `expense_categories`
Operational overhead expenses (Rent, Electricity, Shipping, Salaries).
- `expenses`: `id`, `expense_number` (`EXP-YYYYMMDD-XXXXXX`), `category_id`, `supplier_id`, `shift_id`, `register_id`, `user_id`, `amount`, `payment_method`, `affects_cash` (`1` if drawn from drawer), `description`, `status`.

#### 19. `held_carts`
Temporary parking for open POS transactions.
- `id`, `cashier_id`, `cashier_name`, `customer_id`, `cart_data` (JSON array of line items), `subtotal`, `total`, `held_at`.

#### 20. `audit_logs`
Immutable regulatory and system security log.
- `id`, `user_id`, `user_full_name`, `action`, `resource`, `resource_id`, `details` (JSON string), `created_at`.

#### 21. `backups`
Registry of created database backups.
- `id`, `filename`, `file_path`, `size_bytes`, `type` (`manual`, `auto`, `pre_restore`), `created_at`.

---

# 8. AUTHENTICATION

### 8.1 Authentication Architecture
- **Hash Function:** `bcryptjs` utilizing Blowfish cipher with `12` salt rounds (`SALT_ROUNDS = 12`).
- **Session Tokens:** Dual UUID concatenation (`uuidv4() + '-' + uuidv4()`), stored in SQLite `sessions` table.
- **Session Duration:** 8 Hours (`SESSION_HOURS = 8`).
- **Default Seed Account:**
  - **Username:** `admin`
  - **Initial Password:** `admin123`
  - **Role:** `admin` (Implicit wildcard `*` permissions).

### 8.2 Login Sequence
1. Operator submits credentials via `LoginPage.tsx`.
2. `authService.login(username, password)` queries SQLite `users` joined with `roles`.
3. Verifies `user.is_active === 1`. Disabled accounts return error `account_disabled`.
4. Executes `bcrypt.compare(password, user.password_hash)`.
5. Upon match:
   - Generates 64-character session token.
   - Writes record to `sessions` table with expiration timestamp (`now + 8 hours`).
   - Updates `users.last_login_at`.
   - Resolves effective permissions via `authService.loadUserPermissions()`.
   - Writes `login` action to `audit_logs`.
   - Populates `useAuthStore` with `user` and `token`.

### 8.3 Browser Preview Fallback
If running outside Tauri (standard web browser preview where `__TAURI__` is absent):
`authService` contains a mock administrator fallback allowing login with `admin` / `admin123` using an in-memory session.

---

# 9. AUTHORIZATION / RBAC

### 9.1 Three-Tier Hierarchy
1. **Administrator (`admin`):** Full system access. Bypasses all permission checks via `isAdmin` guard or wildcard `*`.
2. **Manager (`manager`):** Full operational control across POS, Sales, Products, Inventory, Purchases, Suppliers, Customers, Expenses, and Reports. Restricted from `users` and `settings`.
3. **Cashier (`cashier`):** POS sales execution, cart holds, invoice viewing/reprinting, customer search/creation, drawer shift opening/closing, and basic store expenses.

### 9.2 Custom Permission Overrides (Migration 012)
Administrators can grant or revoke specific granular permissions for individual users via the custom permissions matrix in `UsersPage.tsx`. Overrides are stored in `user_permissions` and take precedence over role baselines.

### 9.3 Enforcement Layers
- **Route Level (`src/components/auth/ProtectedRoute.tsx`):**
  Wraps React routes in `AppShell.tsx`. Evaluates `can(action, resource)` from `usePermission()`. Unauthorized attempts redirect to `/`.
- **UI Element Level:**
  Buttons and action items (e.g., Void Invoice, Manual Stock Adjustment, Export Data) are conditionally rendered using `can(...)`.
- **Service Layer Level:**
  Operations like `authService.updateUserPermissions`, `backupService.createBackup`, and `productService.deleteProduct` evaluate actor context and throw `Error('Permission denied')`.

---

# 10. ROUTES / PAGES / SCREENS

| Route Path | Page Component | Permission Required | Purpose | Primary Actions |
| :--- | :--- | :--- | :--- | :--- |
| `/` | `HomeDispatcher` | Authenticated | Smart home route | Redirects to Dashboard, POS, or Products based on role permissions |
| `/pos` | `PosPage` | `pos:access` | Interactive POS checkout | Search products, barcode scan, cart management, hold/resume, tender payment, print receipt |
| `/products` | `ProductsPage` | `products:read` | Product catalog manager | Create, edit, delete products, filter by category/stock, export/import Excel, sync MAKERS catalog |
| `/products/categories` | `CategoriesPage` | `products:update` | Product category manager | View and manage 35 MAKERS categories, sort order, colors, icons |
| `/products/brands` | `BrandsPage` | `products:update` | Brand management | Add, edit, toggle active status of product manufacturers |
| `/products/units` | `UnitsPage` | `products:update` | Units of measure | Define units (pcs, m, pack, set), toggle decimal allowance |
| `/products/attributes` | `AttributesPage` | `products:update` | Parametric specifications | Manage electrical attribute definitions (Resistance, Voltage, Package) |
| `/inventory/*` | `InventoryPage` | `inventory:read` | Warehouse stock control | View location stock, record Stock In, Stock Out, Stock Transfer, and Adjustment |
| `/purchases/*` | `PurchasesPage` | `purchases:read` | Supplier procurement | Create purchase orders, receive items into stock, record supplier payments, cancel orders |
| `/suppliers/*` | `SuppliersPage` | `suppliers:read` | Supplier ledger | Manage supplier contact details, view purchase history, balance owed |
| `/customers/*` | `CustomersPage` | `customers:read` | Customer directory & credit | Manage customer profiles, credit limits, contact info, transaction history |
| `/sales/*` | `SalesPage` | `sales:read` | Sales invoice history | Search invoices, view line items, reprint thermal receipts, initiate returns |
| `/returns/*` | `ReturnsPage` | `returns:read` | Customer returns & refunds | View returns history, initiate returns from sale invoices, print return receipts |
| `/cash-register` | `CashRegisterPage` | `shifts:read` | Cash drawer management | Open shift, record cash in / cash out, view reconciliation, close shift with count |
| `/expenses/*` | `ExpensesPage` | `expenses:read` | Store operating expenses | Record store expenses, link to cash drawer, cancel expenses, categorize |
| `/reports/*` | `ReportsPage` | `reports:read` | Financial & sales analytics | Executive KPIs, Sales by Date, Profit Analysis, Inventory Valuation, Shifts Report |
| `/users/*` | `UsersPage` | `users:read` | Staff & RBAC administration | Add users, change passwords, assign roles, configure custom permission overrides |
| `/settings/*` | `SettingsPage` | `settings:read` | System configuration | Store metadata, tax settings, printer selection, backup management, database restore |
| `/barcodes/*` | `BarcodesPage` | `barcodes:create` | Barcode label generator | Select product, configure label dimensions, preview Code128 barcode, batch print |
| `/audit` | `AuditPage` | `audit_logs:read` | Audit log inspection | View chronological security and business activity trail |

---

# 11. COMPONENT ARCHITECTURE

### 11.1 Key Modals & Dialogs
- **`CheckoutModal.tsx` (`src/features/sales/components/`):**
  Manages tender settlement. Supports single or split payments across Cash, Card, Vodafone Cash, and InstaPay. Computes change due.
- **`ReceiptModal.tsx` (`src/features/sales/components/`):**
  Thermal receipt presentation. Contains the pure HTML table template (`#printable-receipt`) formatted for 80mm paper width. Dispatches to `directPrint.ts`.
- **`CreateReturnModal.tsx` (`src/features/returns/components/`):**
  Interactive return builder. Loads sale items, displays previously returned quantities, enforces return limits, accepts product condition (`resellable` vs `damaged`), calculates proportional discounts, and creates refund payments.
- **`OpenShiftModal.tsx` & `CloseShiftModal.tsx` (`src/features/cash-register/components/`):**
  Enforces cash drawer counting at start and end of shifts. Compares counted cash against calculated physical drawer cash to log variance.
- **`MakersImportModal.tsx` (`src/features/products/components/`):**
  Searches `makerselectronics.com` live via native Rust command, displays paginated cards, previews technical details, and imports products with image caching.

---

# 12. STATE MANAGEMENT

### 12.1 Global Zustand Stores

#### 1. `authStore` (`src/stores/authStore.ts`)
- **State:** `user: AuthUser | null`, `token: string | null`, `isAuthenticated: boolean`, `isLoading: boolean`.
- **Persistence:** LocalStorage key `makers-pos-auth`.
- **Helper:** `usePermission()`: Exposes `can(action, resource)`, `isAdmin`, `isManager`, `isCashier`. Handles alias resolution (`pos:sale` -> `pos:create`, `shifts:open` -> `shifts:create`).

#### 2. `cartStore` (`src/stores/cartStore.ts`)
- **State:**
  - `items: PosCartItem[]`: Line items in the active cart.
  - `selectedCustomerId: string | null`: Linked customer.
  - `discountAmount: number`, `discountPct: number`: Cart-level discounts.
  - `taxEnabled: boolean`, `taxRate: number`: Tax settings.
  - `notes: string`: Invoice notes.
  - `heldCartId: string | null`: Set if cart was restored from a held state.
- **Actions:** `addItem`, `updateQuantity`, `removeItem`, `setDiscount`, `clearCart`, `loadHeldCart`.

#### 3. `settingsStore` (`src/stores/settingsStore.ts`)
- **State:** Mirrors system settings (`storeName`, `currencySymbol`, `taxRate`, `defaultPrinter`, `autoOpenDrawer`, etc.).
- **Synchronization:** Hydrated from SQLite `settings` table on startup via `loadFromDb()`. Updating a setting persists immediately to SQLite.

---

# 13. SERVICES LAYER

```text
src/services/
├── auth/authService.ts           # Credentials verification, password hashing, session tokens
├── audit/auditService.ts         # Asynchronous logging of actions into audit_logs table
├── categories/
│   ├── makersCategories.ts       # 35 Official MAKERS Master Categories definition
│   └── makersCategoryService.ts  # Idempotent category importer and updater
├── customers/customerService.ts  # Customer management, credit balance tracking
├── db/
│   ├── database.ts               # Connection loader, 12 migrations, and seeding
│   ├── transaction.ts            # Atomic withTransaction implementation
│   └── backupService.ts          # VACUUM snapshot, backup verification, and restore
├── hardware/HardwareManager.ts   # Hardware abstraction layer for printer, drawer, scanner
├── i18n/i18n.ts                  # Localization dictionaries for Arabic (RTL) & English (LTR)
├── inventory/inventoryService.ts # Stock movement ledger, multi-location stock balance
├── makers/
│   ├── client.ts                 # HTTP client for makerselectronics.com WooCommerce API
│   ├── makersService.ts          # Catalog search, product detail fetch, image downloader
│   └── mapper.ts                 # Maps WooCommerce JSON schema to internal Product model
├── printer/directPrint.ts        # Isolated DOM rasterization, thermal spooling, drawer kick
├── products/
│   ├── productService.ts         # Product CRUD, barcode management, attribute assignments
│   └── excelProductService.ts    # Bulk Excel catalog parsing, validation, and batch insert
├── purchases/purchaseService.ts  # Procurement orders, receiving, and accounts payable
├── settings/settingsService.ts   # SQLite settings repository and default seeding
└── suppliers/supplierService.ts  # Supplier profiles, balance ledger, contact information
```

---

# 14. API & EXTERNAL INTEGRATIONS

### 14.1 MAKERS Website Integration (`makerselectronics.com`)
The application includes a specialized read-only client for the official MAKERS WooCommerce Store API (`/wp-json/wc/store/v1`).

```mermaid
sequenceDiagram
    participant UI as Product Import Modal
    participant TS as src/services/makers/client.ts
    participant Rust as src-tauri/src/lib.rs (fetch_makers_url)
    participant Web as https://makerselectronics.com

    UI->>TS: searchProducts("Arduino Uno")
    TS->>Rust: invoke('fetch_makers_url', { url })
    Note over Rust: Strict Domain Check:<br/>Must start with https://makerselectronics.com/
    Rust->>Web: GET /wp-json/wc/store/v1/products?search=Arduino+Uno
    Web-->>Rust: 200 OK (JSON Payload)
    Rust-->>TS: Stringified JSON response
    TS-->>UI: Parsed MakersApiProduct[]
```

#### Security Boundaries:
- **Domain Whitelist:** `src-tauri/src/lib.rs` enforces that `fetch_makers_url` and `download_makers_image` only accept URLs beginning with `https://makerselectronics.com/` or `https://www.makerselectronics.com/`. Any other URL is rejected with `Security Error: Only makerselectronics.com URLs are permitted`.
- **Image Caching:** Images downloaded via `download_makers_image` are written to `%APPDATA%\com.makers.pos\product_images\` with sanitized filenames and stored as absolute local disk paths.

---

# 15. HARDWARE INTEGRATION

### 15.1 Hardware Support Matrix

| Peripheral Type | Supported Protocols | Driver / Stack | Implemented In |
| :--- | :--- | :--- | :--- |
| **Thermal Receipt Printer** | Windows Print Spooler (RAW / GDI), 80mm / 58mm | `System.Drawing.Printing.PrintDocument` via PowerShell in Rust | `src-tauri/src/lib.rs` (`print_receipt_image`) |
| **Cash Drawer** | RJ11/RJ12 kick pulse via Receipt Printer (Pins 2 & 5) | `winspool.drv` P/Invoke `WritePrinter` RAW | `src-tauri/src/lib.rs` (`open_cash_drawer`) |
| **Barcode Scanner** | USB HID Keyboard Wedge | JavaScript Keyboard Event Listener with 100ms timing threshold | `src/services/hardware/HardwareManager.ts` |
| **Label Sticker Printer**| Standard Windows Label Drivers (e.g., Xprinter XP-365B) | High-resolution HTML5 Canvas via `bwip-js` + `@media print` | `src/features/barcodes/BarcodesPage.tsx` |

---

# 16. PRINTING SYSTEM

### 16.1 Direct Thermal Printing Architecture
Traditional web POS systems rely on `window.print()`, which forces the operator to click through browser preview dialogs and can suffer from CSS page break clipping. MAKERS POS employs a **Native Direct Thermal Print Pipeline**:

1. **DOM Isolation:** In `src/services/printer/directPrint.ts`, the receipt element (`#printable-receipt`) is cloned into a temporary off-screen container (`#__receipt_capture_host__`) attached directly to `document.body` with fixed width (`302px`, matching 80mm paper at 96 DPI), visible overflow, and `120px` bottom feed clearance.
2. **Font Stabilization:** Awaits `document.fonts.ready` and an additional 250ms layout settle time.
3. **High-Resolution Rasterization:** `html2canvas` captures the clone at `scale: 2` with high-contrast text rendering.
4. **IPC Dispatch:** Base64 PNG data is transmitted to Tauri command `print_receipt_image`.
5. **Native Spooling:** The Rust backend writes the PNG to a temporary file in `%TEMP%`, constructs a .NET `PrintDocument` via PowerShell, sets zero margins and custom thermal height, binds `DrawImage` with `HighQualityBicubic` interpolation, and spools directly to the printer.
6. **Automatic Cleanup:** Temporary image file is deleted immediately after spool dispatch.

### 16.2 Cash Drawer Auto-Kick
When a cash sale is confirmed in `PosPage.tsx`, if `auto_open_drawer` is enabled in settings, `openCashDrawerDirect()` calls Tauri command `open_cash_drawer`. The command opens the target printer in `winspool.drv` with `RAW` data type and writes standard ESC/POS drawer pulse bytes:
```csharp
byte[] pulse = new byte[] { 27, 112, 0, 25, 250, 27, 112, 1, 25, 250 };
```
This triggers both Pin 2 and Pin 5 on standard RJ11/RJ12 drawer kick interfaces.

---

# 17. BARCODE SYSTEM

### 17.1 Supported Formats
- **Code 128 (Default):** High-density alphanumeric symbology used for all internal MAKERS product SKUs.
- **EAN-13:** Standard 13-digit retail barcode format with checksum validation.

### 17.2 Generation and Printing Pipeline
- **Generator:** `bwip-js` (Barcode Writer in Pure JavaScript) renders barcodes directly to HTML5 Canvas in `BarcodesPage.tsx`.
- **Dimensions Presets:**
  - `50 × 25 mm` (Standard Electronics Component Label)
  - `40 × 30 mm` (Compact Component Label)
  - `60 × 40 mm` (Large Box Label)
  - `38 × 25 mm` (Small Parts Drawer Sticker)
- **Scanning:** The POS barcode listener (`HardwareManager.scanner`) listens for HID keystrokes. Keystrokes arriving within 100ms of each other terminating in `Enter` are identified as scanner inputs and immediately query `products` and `product_barcodes`.

---

# 18. BUSINESS LOGIC & FINANCIAL CALCULATIONS

### 18.1 Sales Calculation Rules
In `posService.calculateTotals()`:
1. **Subtotal:** Sum of all item line subtotals.
   $$\text{Subtotal} = \sum (\text{unitPrice} \times \text{quantity} - \text{itemDiscount})$$
2. **Cart Discount:** Fixed amount or percentage.
   $$\text{CleanDiscount} = \min(\text{Subtotal}, \max(0, \text{DiscountAmount}))$$
3. **Taxable Amount:**
   $$\text{TaxableAmount} = \max(0, \text{Subtotal} - \text{CleanDiscount})$$
4. **Sales Tax (VAT):** If `tax_enabled` is true (default 14% in Egypt):
   $$\text{TaxAmount} = \text{TaxableAmount} \times \left(\frac{\text{TaxRate}}{100}\right)$$
5. **Grand Total:**
   $$\text{Total} = \text{TaxableAmount} + \text{TaxAmount}$$
6. **Profit per Line Item:**
   $$\text{Profit} = (\text{unitPrice} - \text{costPrice}) \times \text{quantity} - \text{discountAmount}$$

### 18.2 Return & Refund Calculations
In `returnService.createReturn()`:
- **Proportional Discount Apportionment:** If a cart-level discount was applied on the original sale, returned items are refunded proportionally to prevent refunding full retail value on discounted sales.
- **Inventory Condition Handling:**
  - If condition is `resellable`: Product stock is increased in `products` and a `return_restock` movement is logged in `inventory_movements`.
  - If condition is `damaged`: Product stock is NOT increased in sellable inventory, and a `return_damaged` movement is logged.

### 18.3 Shift Reconciliation Formula
In `cashRegisterService.getShiftReconciliation()`:
$$\text{ExpectedPhysicalCash} = \text{OpeningBalance} + \text{CashIn} + \text{TotalCashSales} - \text{CashOut} - \text{CashRefunds}$$
$$\text{Difference (Discrepancy)} = \text{ActualCashCounted} - \text{ExpectedPhysicalCash}$$

---

# 19. POS / SALES FLOW

```mermaid
flowchart TD
    A[Start: Open POS Page] --> B{Active Shift Exists?}
    B -- No --> C[Display Prompt: Open Shift Required]
    B -- Yes --> D[Ready for Input]

    D --> E[Scan Barcode / Search Product]
    E --> F[Add Item to Cart]
    F --> G{Stock Available?}
    G -- No & Negative Disallowed --> H[Show Out of Stock Error]
    G -- Yes --> I[Update Line Items in Cart]

    I --> J[Apply Item or Cart Discounts]
    J --> K[Calculate Totals: Subtotal, Tax, Grand Total]
    K --> L[Click: Checkout]

    L --> M[Select Payment Method: Cash, Card, Mobile Wallet]
    M --> N[Confirm & Process Sale]

    N --> O[Execute withTransaction: BEGIN IMMEDIATE]
    O --> P[Insert sales & sale_items]
    P --> Q[Deduct product stock & write inventory_movements]
    Q --> R[Insert payments record]
    R --> S[If Cash: Insert cash_movements entry]
    S --> T[COMMIT Transaction]

    T --> U[Write audit_logs entry]
    U --> V{Is Cash Tender & Drawer Enabled?}
    V -- Yes --> W[Native Kick: open_cash_drawer]
    V -- No --> X[Skip Drawer Kick]

    W --> Y[Open Receipt Modal & Auto-Print Receipt]
    X --> Y
    Y --> Z[Clear Cart & Ready for Next Sale]
```

---

# 20. INVENTORY FLOW

### 20.1 Movement Types & Invariants

| Movement Type | Stock Sign | Triggers | Database Tables Affected |
| :--- | :--- | :--- | :--- |
| `initial` | `+` | Product initial stock entry | `products`, `inventory_movements` |
| `sale` | `-` | POS sale finalized | `products`, `sale_items`, `inventory_movements` |
| `return_restock` | `+` | Customer return with `resellable` condition | `products`, `return_items`, `inventory_movements` |
| `return_damaged` | `0` | Customer return with `damaged` condition | `return_items`, `inventory_movements` |
| `purchase` | `+` | Purchase order receipt confirmed | `products`, `purchase_items`, `inventory_movements` |
| `adjustment` | `+/-` | Manual stock count reconciliation | `products`, `inventory_movements` |
| `transfer` | `0` (Net) | Transfer between Storage Locations | `product_locations`, `inventory_movements` |

---

# 21. ERROR HANDLING & RESILIENCE

### 21.1 Database Lock Protection (`withTransaction`)
Located in `src/services/db/transaction.ts`:
- Replaces deferred transactions with `BEGIN IMMEDIATE TRANSACTION`.
- Checks `txActive` to throw an explicit error on attempted nested transactions.
- Tracks `begun` and `committed` flags. If an operation fails mid-transaction, `ROLLBACK` is executed safely inside a protected `try/catch` block so rollback failures (e.g. if SQLite auto-aborted) never mask the primary exception.

### 21.2 UI Error Boundaries
All critical dialogs and buttons catch service exceptions, display localized error toasts, and reset loading indicators to prevent interface lockups.

---

# 22. LOGGING & DEBUGGING

### 22.1 Developer Inspection Points
1. **Application Console:** Web developer tools (accessible in development via F12 or right-click Inspect) log service operations, receipt dimensions, and error traces.
2. **Audit Trail:** Built-in viewer in `AuditPage.tsx` displays database transactions, cashier sales, manual adjustments, and user permission updates.
3. **Database Inspection:** Direct inspection using Node.js `node:sqlite`:
   ```bash
   node -e "const { DatabaseSync } = require('node:sqlite'); const path = require('path'); const db = new DatabaseSync(path.join(process.env.APPDATA, 'com.makers.pos', 'makers_pos.db')); console.log(db.prepare('PRAGMA integrity_check').all());"
   ```

---

# 23. CONFIGURATION REFERENCE

| Setting Key | Location | Purpose | Default | Sensitive? |
| :--- | :--- | :--- | :--- | :--- |
| `language` | SQLite `settings` / Store | Interface language (`ar` / `en`) | `ar` | No |
| `theme` | SQLite `settings` / Store | Visual theme (`dark` / `light`) | `dark` | No |
| `store_name` | SQLite `settings` / Store | Store English title | `MAKERS` | No |
| `store_name_ar` | SQLite `settings` / Store | Store Arabic title | `ميكرز` | No |
| `store_subtitle` | SQLite `settings` / Store | Store subtitle (receipt top) | `Electronics Components & Makers Store` | No |
| `store_subtitle_ar` | SQLite `settings` / Store | Store subtitle Arabic | `مكونات إلكترونية ومتجر المبدعين` | No |
| `currency` | SQLite `settings` / Store | Currency code | `EGP` | No |
| `currency_symbol` | SQLite `settings` / Store | Display currency symbol | `ج.م` | No |
| `tax_enabled` | SQLite `settings` / Store | Enable sales tax calculation (`1`/`0`)| `0` | No |
| `tax_rate` | SQLite `settings` / Store | Sales tax percentage | `14` | No |
| `default_printer` | SQLite `settings` / Store | Windows printer name for receipts | `Default` | No |
| `receipt_paper_width` | SQLite `settings` / Store | Thermal paper width (`80mm`/`58mm`) | `80mm` | No |
| `auto_open_drawer` | SQLite `settings` / Store | Auto-kick cash drawer on cash sale | `1` | No |
| `allow_negative_stock`| SQLite `settings` / Store | Allow checkout when stock <= 0 | `0` | No |

---

# 24. SECURITY REVIEW

```text
Issue: Default Hardcoded Admin Seed Password
Location: src/App.tsx (line 37) & src/services/db/database.ts
Current Behavior: On very first database creation, the system seeds 'admin' with 'admin123'.
Risk: Low in isolated retail environments; Medium if terminal is left unattended on public networks.
Impact: Unauthorized system administrative access.
Possible Cause: Intended bootstrap mechanism for out-of-the-box installation.
Suggested Direction: Force administrative password change on first initial login.

Issue: Browser Preview Mock Authentication Fallback
Location: src/services/auth/authService.ts (lines 217-236)
Current Behavior: If running in web browser preview mode without Tauri runtime, hardcoded credentials 'admin'/'admin123' grant a mock session.
Risk: Negligible. Tauri desktop builds do not hit this branch as `isTauri()` is true.
Impact: Development convenience only.
Possible Cause: Allows rapid UI testing in standard Vite browser environment.
Suggested Direction: Retain for dev; ensure dead-code elimination in production bundle.

Issue: Whitelisted External HTTP Request
Location: src-tauri/src/lib.rs (fetch_makers_url)
Current Behavior: Requests are strictly restricted to https://makerselectronics.com/.
Risk: Verified Secure. Whitelist prevents arbitrary SSRF or unauthorized external calls.
Impact: Protects system from malicious outbound requests.
```

---

# 25. TESTING INFRASTRUCTURE

The repository includes a comprehensive regression and validation test suite of **29 standalone verification scripts** in `tests/`:

- **Master Runner:** `node tests/master_regression_runner.js` executes the complete battery of operational suites.
- **Hardware Acceptance:** `tests/hardware_acceptance_runner.js` validates Windows printer detection, HID scanner devices, binary hash integrity, and database foreign keys.
- **Core Verifications:**
  - `pos_core_verification.js`: Cart math, discounts, tax, stock validations.
  - `sales_receipts_verification.js`: Sales transaction commits, line items, receipt structures.
  - `returns_verification.js`: Proportional refund math, restock condition logic.
  - `payments_cash_register_verification.js`: Shift opening, closing, cash ledger integrity.
  - `phase6_purchasing_verification.js`: Purchase invoices, accounts payable, supplier debt.

---

# 26. BUILD SYSTEM

```mermaid
flowchart LR
    DevCode["TypeScript / React Source"] --> TSC["TypeScript Compiler (tsc -b)"]
    TSC --> ViteBuild["Vite Production Bundler"]
    ViteBuild --> Dist["dist/ Web Assets"]
    Dist --> TauriCLI["Tauri CLI (tauri build)"]
    Cargo["Rust Cargo (src-tauri)"] --> TauriCLI
    TauriCLI --> Binary["src-tauri/target/release/app.exe"]
    Binary --> CopyExe["npm run copy:exe"]
    CopyExe --> RootExe["./MAKERS POS.exe"]
```

### Exact Build Commands:
- **Build Frontend:** `npm run build` (`tsc -b && vite build`)
- **Build Desktop Application:** `npm run tauri:build`
  - Runs `npm run build`
  - Compiles Rust binary via `cargo build --release`
  - Packages NSIS installer (`MAKERS POS_1.0.0_x64-setup.exe`)
  - Packages WiX MSI installer (`MAKERS POS_1.0.0_x64_en-US.msi`)
  - Executes `npm run copy:exe` to synchronize `src-tauri/target/release/MAKERS POS.exe` to `./MAKERS POS.exe`.

---

# 27. DEPLOYMENT & RELEASE PROCESS

### Dual Binary Synchronization Rule
To ensure seamless deployment across flash drives and installer packages, the repository maintains two identical executables:
1. `src-tauri/target/release/MAKERS POS.exe`
2. `./MAKERS POS.exe` (Root directory)

Both files must have **identical byte sizes** and identical SHA-256 hashes upon release. The automated script `node scripts/package_and_hash.js` copies and verifies these files into `MAKERS_POS_v1.0.0_Windows_Release/` alongside `CHECKSUMS.txt` and `SHA256SUMS.txt`.

---

# 28. FILE SYSTEM & DATA STORAGE

| Storage Purpose | Path / Target | Operating System | Persistence |
| :--- | :--- | :--- | :--- |
| **Main Database** | `%APPDATA%\com.makers.pos\makers_pos.db` | Windows | Permanent |
| **WAL & SHM Files** | `%APPDATA%\com.makers.pos\makers_pos.db-wal` / `-shm`| Windows | Active Session |
| **Product Images** | `%APPDATA%\com.makers.pos\product_images\` | Windows | Permanent |
| **Database Backups**| `%APPDATA%\com.makers.pos\backups\` (or configured) | Windows | Permanent |
| **Temporary Receipts**| `%TEMP%\makers_receipt_<timestamp>.png` | Windows | Ephemeral |
| **Session Cache** | Browser `localStorage` (`makers-pos-auth`) | WebView2 | Cleared on Logout |

---

# 29. CONSTANTS, ENUMS & MAGIC VALUES

- `SESSION_HOURS = 8`: Active cashier session duration before re-authentication is required.
- `SALT_ROUNDS = 12`: bcrypt password hashing computational cost.
- `BUSY_TIMEOUT = 10000`: 10-second SQLite concurrency wait threshold in milliseconds.
- `PAPER_WIDTH_PX = 302`: Fixed pixel width for 80mm thermal receipts at 96 DPI.
- `CUTTER_CLEARANCE_PX = 120`: Blank bottom padding ensuring the physical receipt cutter does not slice through the barcode or footer text.
- `ESC_POS_PULSE = [27, 112, 0, 25, 250, 27, 112, 1, 25, 250]`: Standard cash drawer kick pulse.

---

# 30. DEPENDENCY MAP

```text
Pages (PosPage, ProductsPage, SalesPage, CashRegisterPage)
    │
    ▼
Zustand Stores (authStore, cartStore, settingsStore)
    │
    ▼
Domain Services (salesService, returnService, cashRegisterService, productService)
    │
    ▼
Database Transaction Manager (transaction.ts: withTransaction)
    │
    ▼
SQLite Relational Engine (tauri-plugin-sql -> makers_pos.db)
    │
    ▼
Native Tauri Bridge (src-tauri/src/lib.rs -> Windows Spooler / winspool.drv)
```

---

# 31. CRITICAL FILES & HIGH-RISK ZONES

1. `src/services/db/transaction.ts`: **EXTREME CAUTION.** Any regression here can reintroduce `database is locked` or unhandled rollback errors across the entire application.
2. `src/services/db/database.ts`: **EXTREME CAUTION.** Contains all 12 database migrations and seeding routines. Schema modifications must be appended as new migrations.
3. `src-tauri/src/lib.rs`: **HIGH RISK.** Contains all native Windows printing and cash drawer P/Invoke code.
4. `src/services/printer/directPrint.ts`: **HIGH RISK.** Manages off-screen DOM cloning and thermal rasterization.
5. `src/features/sales/salesService.ts`: **HIGH RISK.** Handles core transaction creation, inventory deduction, and financial ledger writes.

---

# 32. DEVELOPER MODIFICATION GUIDE

### How to add a new database table or column:
1. Open `src/services/db/database.ts`.
2. Locate the end of the `migrations` array (after `MIGRATION_012`).
3. Define `const MIGRATION_013 = 'CREATE TABLE ... ---STATEMENT--- ...'`.
4. Append `migrations.push({ version: 13, sql: MIGRATION_013 })`.
5. Run `npm run build` to verify compilation.

### How to add a new page / route:
1. Create the page component in `src/features/<feature>/<Feature>Page.tsx`.
2. Register the route in `src/components/layout/AppShell.tsx` using `React.lazy` and `<ProtectedRoute>`.
3. Add the navigation item in `src/components/layout/Sidebar.tsx`.
4. Add localization labels in `src/services/i18n/i18n.ts` under both `arTranslation` and `enTranslation`.

### How to modify the POS Receipt template:
1. Open `src/features/sales/components/ReceiptModal.tsx`.
2. Locate `#printable-receipt`.
3. Ensure all text and table elements use pure inline CSS styles or table layouts (avoid CSS Grid or complex Flexbox layouts that can misalign on 1-bit thermal printers).
4. Maintain `receipt-num` and `dir="ltr"` on all numerical or phone fields.
5. Verify changes with `tests/sales_receipts_verification.js`.

---

# 33. CHANGE IMPACT ANALYSIS

| File / Module | Impact Level | Primary Reason | Main Dependents |
| :--- | :--- | :--- | :--- |
| `src/services/db/transaction.ts` | **HIGH** | Manages all transactional write concurrency | `salesService`, `returnService`, `cashRegisterService`, `purchaseService` |
| `src/services/db/database.ts` | **HIGH** | Schema source of truth & migration pipeline | Entire application |
| `src-tauri/src/lib.rs` | **HIGH** | Native hardware execution & IPC handlers | `directPrint.ts`, `makersService.ts`, Tauri runtime |
| `src/services/printer/directPrint.ts` | **HIGH** | Formats thermal receipt rasterization | `ReceiptModal`, `ReturnReceiptModal`, `PosPage` |
| `src/stores/authStore.ts` | **HIGH** | Global user session & RBAC permissions | `ProtectedRoute`, `Sidebar`, `AppShell`, all Pages |
| `src/features/pos/posService.ts` | **MEDIUM** | Cart calculations and product search | `PosPage`, `cartStore` |
| `src/services/i18n/i18n.ts` | **LOW** | Static translation dictionaries | UI text labels |

---

# 34. KNOWN BUGS (DOCUMENTED FROM CODE AUDIT)

```text
Bug: HardwareManager invoke('print_receipt') targets non-existent Rust handler
Location: src/services/hardware/HardwareManager.ts (line 68)
Current Behavior: HardwareManager.printer.printReceipt invokes 'print_receipt', which is not registered in src-tauri/src/lib.rs.
Expected Behavior: HardwareManager should either wrap directPrint.ts or register a matching print_receipt handler in Rust.
Impact: Calling HardwareManager.printer.printReceipt directly fails with command not found.
Note: Production checkout does not call this method; it calls directPrint.ts directly.

Bug: HardwareManager invoke('test_printer') targets non-existent Rust handler
Location: src/services/hardware/HardwareManager.ts (line 106)
Current Behavior: HardwareManager.printer.testConnection invokes 'test_printer', which is not registered in lib.rs.
Expected Behavior: Should call get_default_printer or list_printers to verify connectivity.
Impact: Returns false on test connection. Production uses printTestReceiptDirect in SettingsPage instead.
```

---

# 35. TECHNICAL DEBT

1. **Dual Printing Abstractions:** `src/services/hardware/HardwareManager.ts` represents an earlier abstraction, whereas `src/services/printer/directPrint.ts` is the active, verified production printing engine. Future refactoring should consolidate both into `directPrint.ts`.
2. **Drizzle ORM Dependency:** `drizzle-orm` and `drizzle-kit` are present in `package.json` and `drizzle/` schema files, but the runtime database access in `src/` uses direct SQL queries via `tauri-plugin-sql`. The project operates cleanly with direct SQL, but unused Drizzle dependencies remain.
3. **Large Single-File Components:** `UsersPage.tsx` (~72 KB) and `SettingsPage.tsx` (~56 KB) contain multiple tabs and sub-dialogs within single files. Splitting into modular subcomponents would improve maintainability.

---

# 36. TODO / FIXME / HACK AUDIT

Comprehensive search across all `.ts`, `.tsx`, and `.rs` files for `TODO`, `FIXME`, `HACK`, `XXX`, and `TEMP`:
- **Result:** **0 occurrences found.**
- All legacy temporary stubs were completely resolved and replaced with production-ready implementations during earlier development phases.

---

# 37. PERFORMANCE ANALYSIS

1. **SQLite WAL Mode & 64MB Cache:** SQLite operates in WAL mode with `PRAGMA cache_size = -64000;`. Read queries execute in under 1ms, even with thousands of products.
2. **Fast Product Search Indexing:** Product searches in `posService.searchProducts` utilize indexed columns on `sku`, `category_id`, `barcode`, and parameterized `LIKE` operators with a hard limit of 40 records to guarantee instantaneous UI response during typing.
3. **Off-Screen Receipt Rasterization:** `captureReceiptToCanvas()` creates a dedicated isolated host for `html2canvas` and disposes of it immediately upon completion, preventing layout thrashing and DOM memory leaks.
4. **Lazy Route Splitting:** All 18 feature routes are split via `React.lazy()` in `AppShell.tsx`, keeping the initial application bundle lightweight.

---

# 38. COMPLETE USER FLOWS

```mermaid
flowchart TD
    subgraph Flow_POS ["1. Cashier POS Checkout Flow"]
        P1[Open POS] --> P2[Scan Barcode / Click Product]
        P2 --> P3[Adjust Quantity / Discount]
        P3 --> P4[Click Checkout]
        P4 --> P5[Select Payment Method]
        P5 --> P6[Confirm Sale]
        P6 --> P7[Automatic Receipt Print & Drawer Kick]
    end

    subgraph Flow_Shift ["2. Shift Reconciliation Flow"]
        S1[Open Register Shift] --> S2[Enter Starting Cash Float]
        S2 --> S3[Conduct Daily Sales]
        S3 --> S4[Record Operational Expenses / Cash Out]
        S4 --> S5[Click Close Shift]
        S5 --> S6[Enter Final Counted Cash]
        S6 --> S7[System Logs Over/Short Variance]
    end

    subgraph Flow_Return ["3. Customer Return Flow"]
        R1[Open Returns Page] --> R2[Search Sale Invoice]
        R2 --> R3[Select Returnable Items & Quantities]
        R3 --> R4[Select Item Condition: Resellable vs Damaged]
        R4 --> R5[Confirm Refund & Method]
        R5 --> R6[Restock Inventory & Deduct Register Cash]
        R6 --> R7[Print Return Voucher Receipt]
    end
```

---

# 39. DEVELOPER WORKFLOW

### Prerequisites
- Node.js v20+ or v22+
- Rust 1.90+ with Cargo
- Visual Studio C++ Build Tools (with Windows 10/11 SDK)

### Step-by-Step Commands:
1. **Install Dependencies:**
   ```bash
   npm install
   ```
2. **Start Development Environment:**
   ```bash
   npm run tauri dev
   ```
3. **Execute Full Test Battery:**
   ```bash
   node tests/master_regression_runner.js
   ```
4. **Compile Production Release:**
   ```bash
   npm run tauri:build
   ```
5. **Verify Dual Binary Sizes:**
   ```powershell
   Get-Item "src-tauri/target/release/MAKERS POS.exe", "./MAKERS POS.exe" | Select-Object Name, Length, LastWriteTime
   ```

---

# 40. SAFE MODIFICATION RULES

1. **NEVER execute `git commit` unless explicitly instructed by the user.**
2. **NEVER modify `src/services/db/transaction.ts` without running all 29 tests in `tests/`.**
3. **When editing database schemas, NEVER modify previous migrations (1-12). ALWAYS create a new migration (`MIGRATION_013`).**
4. **Always ensure `src-tauri/target/release/MAKERS POS.exe` and `./MAKERS POS.exe` remain synchronized.**
5. **Always maintain pure table/inline CSS styling inside receipt templates (`ReceiptModal.tsx`, `ReturnReceiptModal.tsx`).**

---

# 41. FINAL SYSTEM MAP

```text
OPERATOR / USER
      │
      ▼
REACT 18 PRESENTATION LAYER (RTL Arabic / LTR English)
      │
      ▼
ZUSTAND STORES (authStore, cartStore, settingsStore)
      │
      ▼
APPLICATION SERVICE LAYER (posService, salesService, returnService, cashRegisterService)
      │
      ▼
MANAGED TRANSACTION LAYER (transaction.ts: BEGIN IMMEDIATE)
      │
      ▼
PERSISTENCE LAYER (tauri-plugin-sql -> SQLite: makers_pos.db with WAL mode)
      │
      ▼
TAURI IPC & NATIVE RUST BRIDGE (src-tauri/src/lib.rs)
      │
      ├── Windows Print Spooler (winspool.drv) ──► Thermal Receipt Printer (XP-80C)
      ├── ESC/POS Pulse Kick ──────────────────► Physical Cash Drawer (Pins 2 & 5)
      └── Native Reqwest Client ───────────────► Official MAKERS Catalog (makerselectronics.com)
```

---

# 42. IMPLEMENTATION STATUS

| Subsystem | Status | Evidence | Notes |
| :--- | :--- | :--- | :--- |
| **Authentication & RBAC** | Fully Implemented | `authService.ts`, `authStore.ts`, `UsersPage.tsx` | bcrypt hashing, 8hr sessions, per-user overrides |
| **POS & Checkout** | Fully Implemented | `PosPage.tsx`, `posService.ts`, `salesService.ts` | Multi-tender checkout, cart hold/resume, tax math |
| **Direct Thermal Printing** | Fully Implemented | `directPrint.ts`, `lib.rs`, `ReceiptModal.tsx` | Native spooling without print preview dialog |
| **Cash Drawer Kick** | Fully Implemented | `lib.rs` (`open_cash_drawer`), `PosPage.tsx` | ESC/POS pulse via `winspool.drv` |
| **Returns & Refunds** | Fully Implemented | `returnService.ts`, `CreateReturnModal.tsx` | Condition-aware refund and restock engine |
| **Cash Register & Shifts** | Fully Implemented | `cashRegisterService.ts`, `CashRegisterPage.tsx`| Shift ledger, reconciliation, automated cutoff |
| **Inventory & Locations** | Fully Implemented | `inventoryService.ts`, `InventoryPage.tsx` | Multi-warehouse tracking, stock movements |
| **Purchasing & Debts** | Fully Implemented | `purchaseService.ts`, `PurchasesPage.tsx` | Procurement orders, receiving, supplier debts |
| **Customers & Credit** | Fully Implemented | `customerService.ts`, `CustomersPage.tsx` | Customer ledger, credit limits, balances |
| **Operating Expenses** | Fully Implemented | `expenseService.ts`, `ExpensesPage.tsx` | Categorized expenses with cash drawer deduction |
| **Reports & Analytics** | Fully Implemented | `reportsService.ts`, `ReportsPage.tsx` | SQL aggregation engine, Recharts visualization |
| **Barcode Generator** | Fully Implemented | `BarcodesPage.tsx`, `bwip-js` | Custom dimensions, Code128 generation |
| **MAKERS Catalog Sync** | Fully Implemented | `makersService.ts`, `client.ts`, `lib.rs` | Native Rust proxy with domain whitelist security |
| **Database Backups** | Fully Implemented | `backupService.ts`, `SettingsPage.tsx` | VACUUM snapshots, integrity validation |

---

# 43. DOCUMENTATION ACCURACY RULES APPLIED

1. All facts and code symbols were derived directly from source inspection.
2. Exact file paths with relative repository roots are documented throughout.
3. Every database table, column, and foreign key constraint was cross-referenced with `src/services/db/database.ts`.
4. Contradictions between legacy `HardwareManager.ts` and active `directPrint.ts` are explicitly documented.
5. All 29 test scripts in `tests/` were inventoried from disk.

---

# 44. FINAL VERIFICATION

- [x] Project architecture documented with verified Mermaid diagrams.
- [x] Folder and file tree comprehensively explained.
- [x] Boot sequence traced from `main.tsx` to `AppShell.tsx`.
- [x] Database tables, columns, indexes, and migrations (1-12) fully documented.
- [x] Authentication (bcryptjs, sessions) and RBAC matrix verified.
- [x] All 20 routes and screens inventoried with required permissions.
- [x] Direct thermal printing and native cash drawer kick documented.
- [x] Business logic, cart math, returns, and shift formulas documented with LaTeX.
- [x] Build and release pipeline documented with dual-binary synchronization rules.
- [x] Known bugs and technical debt transparently detailed.

---

# 45. FINAL DOCUMENT STATUS & LIMITATIONS

```text
Documentation Status
====================

Project analyzed: YES
Architecture analyzed: YES
Database analyzed: YES
Authentication analyzed: YES
Authorization analyzed: YES
Business logic analyzed: YES
Hardware analyzed: YES
Printing analyzed: YES
Barcode system analyzed: YES
Build system analyzed: YES
Testing analyzed: YES
Deployment analyzed: YES
Security reviewed: YES

Documentation Review Date:
2026-09-30
```

### Documentation Limitations
- **Third-Party Printer Firmware:** Exact print speed, paper feed inertia, and cutter mechanism timings vary between physical hardware models (e.g. Xprinter XP-80C vs Epson TM-T20). The 120px feed space is tailored for standard 80mm Chinese thermal printers and may require calibration on specialized industrial printers.
- **Physical Drawer Pinout:** The ESC/POS drawer kick pulse in Rust triggers standard Pin 2 and Pin 5 (`\x1B\x70\x00\x19\xFA` & `\x1B\x70\x01\x19\xFA`). Non-standard RJ11 cables with inverted wiring may require cable reconfiguration.

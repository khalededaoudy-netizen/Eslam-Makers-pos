# دليل النسخ الاحتياطي التلقائي لمتجر MAKERS POS
# Auto Backup Guide for Store Owners

---

## 🇸🇦 الدليل بالعربية (Arabic Guide)

### 1. نظرة عامة على النظام (Overview)
تم تزويد نظام **MAKERS POS** بنظام حماية متكامل للبيانات يعتمد استراتيجية النسخ المزدوج (Dual-Location Backup):
1. **الموقع المحلي الإجباري دائمًا (Local Mandatory)**:
   - يحفظ تلقائيًا في مسار بيانات التطبيق الآمن:
     `%APPDATA%\com.makers.pos\backups\`
   - يحتفظ بآخر **30 نسخة** يومية مع تدوير وحذف النسخ القديمة تلقائيًا.
2. **الموقع الثانوي السحابي / الخارجي (Secondary Cloud/USB - اختياري)**:
   - يتيح لك تحديد أي مجلد على جهازك يقوم بنسخ ملف قاعدة البيانات إليه تلقائيًا بمجرد إتمام النسخ اليومي.
   - **بدون أي تعقيدات أو مفاتيح API أو OAuth**: يعمل ببساطة مع برامج المزامنة المكتبية (مثل Google Drive Desktop أو OneDrive) أو وحدات التخزين الخارجية (فلاش ميموري USB).

---

### 2. كيفية ربط Google Drive أو OneDrive (خطوة بخطوة)

#### أ) باستخدام Google Drive للكمبيوتر (Google Drive for Desktop):
1. قم بتثبيت تطبيق **Google Drive for Desktop** على جهاز الكمبيوتر.
2. سينشئ البرنامج قرصاً أو مجلداً على جهازك (غالباً `G:\My Drive\` أو مسار مشابه).
3. أنشئ مجلداً جديداً بداخله وسمّه: `POS Backups`.
4. انسخ مسار هذا المجلد (مثلاً: `G:\My Drive\POS Backups`).
5. افتح **MAKERS POS** وانتقل إلى **الإعدادات > النسخ الاحتياطي**.
6. الصق المسار في حقل **"موقع الحفظ الثانوي"** واضغط على زر **"فحص المسار"**.
7. عند ظهور علامة الصح الخضراء، اضغط **"حفظ إعدادات النسخ الاحتياطي"**.
8. **النتيجة**: سيقوم البرنامج تلقائياً يومياً بنسخ ملف البيانات إلى هذا المجلد، وسيقوم Google Drive برفعه إلى السحابة فوراً في الخلفية!

#### ب) باستخدام Microsoft OneDrive:
1. افتح مجلد OneDrive على جهازك (مثلاً: `C:\Users\<اسم_المستخدم>\OneDrive`).
2. أنشئ مجلداً جديداً: `POS Backups`.
3. انسخ المسار والصقه في إعدادات التطبيق واضغط **"حفظ إعدادات النسخ"**.

#### ج) باستخدام فلاشة USB أو هارد خارجي:
1. ضع مسار الفلاشة، مثلاً: `E:\MakersBackups`.
2. في حال كانت الفلاشة موصولة بالجهاز وقت النسخ، سيتم الحفظ عليها فوراً. وإن لم تكن موصولة، سيكتفي النظام بحفظ النسخة المحلية بدون أي تعطيل للنظام!

---

### 3. استعادة البيانات في حالات الطوارئ (Restore Process)
1. من شاشة **الإعدادات > النسخ الاحتياطي**، توجه إلى جدول **سجل النسخ الاحتياطية**.
2. اختر النسخة المراد استعادتها واضغط **"استعادة"**.
3. **أمان مضاعف**: يقوم النظام تلقائياً بإنشاء **نسخة طوارئ مسبقة (Emergency Pre-Restore Snapshot)** قبل بدء الاستعادة، حتى لا تفقد أي بيانات قيد التسجيل.
4. يتحقق النظام من سلامة ملف SQLite (`PRAGMA integrity_check`) قبل وبعد الاستعادة للتأكد من عدم وجود أي تلف.

---

### 4. استكشاف الأخطاء والدعم الفني عن بُعد (Troubleshooting)
- في حال واجهت أي مشكلة، توجه إلى شاشة النسخ الاحتياطي واضغط على زر **"سجل التشخيص"**.
- سيتم تحميل ملف JSON يحتوي على سجل الأحداث ومحاولات النسخ بدون أي كلمات سر أو بيانات سرية.
- يمكنك إرسال هذا الملف لمسؤول الدعم الفني لتشخيص الخلل بدقة.

---

## 🇬🇧 English Guide

### 1. Dual-Location Backup Architecture
1. **Local (Mandatory)**: Saved to `%APPDATA%\com.makers.pos\backups\` (Keeps latest 30 daily snapshots, automatically pruned).
2. **Secondary (Optional)**: Automatically copies each backup to any directory synced with Google Drive Desktop, OneDrive, or a USB drive.

### 2. Setting Up Cloud Sync (Google Drive / OneDrive)
1. Install **Google Drive for Desktop** or ensure **OneDrive** is running.
2. Create a folder named `POS Backups` in your Google Drive or OneDrive directory.
3. In **MAKERS POS**, navigate to **Settings > Database & Backup**.
4. Paste the folder path into the **Secondary Location** field.
5. Click **Test Path** to confirm write access, then click **Save Backup Settings**.
6. **Result**: Daily backups are saved locally and copied to Google Drive/OneDrive, which syncs them to the cloud automatically with zero OAuth or API key setup.

### 3. Safe Restores with Emergency Snapshots
- Restoring creates an automatic emergency pre-restore snapshot.
- PRAGMA integrity check ensures zero database corruption.
- Full audit log recorded for all restore operations.

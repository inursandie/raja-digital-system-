# PRD: RAJA Digital System v1.0

## Problem Statement
Airport taxi cooperative dashboard untuk 100-1000 driver Grab di Bandara Soekarno-Hatta. Sistem manajemen SIJ (Surat Ijin Jalan) dengan tracking harian, deteksi mismatch, dan laporan keuangan per shift.

---

## Architecture
- **Backend**: FastAPI + MongoDB (Motor async)
- **Frontend**: React 19 + Tailwind CSS + Custom SVG Charts + Framer Motion
- **Auth**: JWT Bearer token (PyJWT + bcrypt)
- **Timezone**: Asia/Jakarta (zoneinfo)
- **Data Seed**: Auto-seed on startup if empty

---

## User Personas
1. **Admin Shift 1** (Admin1, Admin2): Akses 07:00-17:00, Input SIJ, lihat data shift sendiri
2. **Admin Shift 2** (Admin3, Admin4): Akses 17:00-07:00, Input SIJ, lihat data shift sendiri  
3. **SuperAdmin**: Full access, semua shift, analytics lengkap

### Test Accounts
| User | Email | Password | Role |
|------|-------|----------|------|
| Admin 1 | admin1@raja.id | admin123 | admin |
| Admin 2 | admin2@raja.id | admin123 | admin |
| Admin 3 | admin3@raja.id | admin123 | admin |
| Admin 4 | admin4@raja.id | admin123 | admin |
| Super Admin | superadmin@raja.id | superadmin123 | superadmin |

---

## Core Requirements (Static)
- [x] Login role-based dengan deteksi shift otomatis dari jam login
- [x] Admin Dashboard: KPI per shift (SIJ, Revenue, Driver Aktif) + mismatch list
- [x] SuperAdmin Dashboard: Full analytics, 3 charts, ranking driver, suspend
- [x] Input SIJ dengan searchable driver input, date picker (7 hari ke depan), sheets 1-7, QRIS ref
- [x] Thermal printer support (58mm ESC/POS commands + browser print fallback)
- [x] Unique transaction_id per driver per hari (prevent duplicate)
- [x] Drivers Management: Search, edit, suspend/aktifkan
- [x] Audit Log: Daily mismatch table + CSV export
- [x] Auto-refresh dashboard 30 detik
- [x] Sample data: 50 drivers, 200 SIJ transactions, 5 mismatch drivers

---

## What's Been Implemented

### 2026-02-22 - List SIJ Feature
**New Page** (`/app/frontend/src/pages/SIJList.jsx`):
- ✅ Halaman riwayat transaksi SIJ yang dapat diakses Admin & SuperAdmin
- ✅ Pencarian berdasarkan nama driver (real-time filtering)
- ✅ Filter tanggal dengan calendar picker
- ✅ Tabel dengan pagination (15 per halaman)
- ✅ Modal detail dengan informasi lengkap SIJ
- ✅ Tombol cetak ulang: Cetak Browser + Download ESC/POS

**Navigation Update** (`/app/frontend/src/components/Layout.jsx`):
- ✅ Menu "List SIJ" ditambahkan di sidebar untuk Admin & SuperAdmin

**Backend Update** (`/app/backend/server.py`):
- ✅ GET /api/sij mendukung parameter `include_void` untuk melihat transaksi void

### 2026-02-22 - P0 Features Complete
**New SIJ Input Features** (`/app/frontend/src/pages/SIJInput.jsx`):
- ✅ Searchable driver input dengan real-time filtering (name, ID, plate, phone)
- ✅ Date picker untuk tanggal SIJ (hari ini hingga 7 hari ke depan)
- ✅ Sheet selection dengan button selector (1-7)
- ✅ Thermal printer ESC/POS commands (.bin download)
- ✅ Browser print fallback dengan receipt layout 58mm

**Dashboard Fix** (`/app/frontend/src/pages/SuperAdminDashboard.jsx`):
- ✅ Fixed bar chart "Revenue per Admin" - converted from SVG to progress bar style
- ✅ All charts now render correctly: SIJ per Shift, Revenue per Admin, Tren SIJ 7 Hari

**Backend Update** (`/app/backend/server.py`):
- ✅ POST /api/sij now accepts optional `date` parameter (YYYY-MM-DD format)
- ✅ Date validation: must be between today and 7 days ahead

### 2026-02-22 - MVP v1.0
**Backend** (`/app/backend/server.py`):
- Auth: POST /api/auth/login, GET /api/auth/me
- Drivers: GET /api/drivers, GET /api/drivers/active, PUT /api/drivers/{id}, PATCH suspend/activate
- SIJ: POST /api/sij (with date param), GET /api/sij, PATCH /api/sij/{id}/void
- Dashboard: GET /api/dashboard/admin, GET /api/dashboard/superadmin
- Audit: GET /api/audit, GET /api/audit/export (CSV)
- Startup seed: 5 users, 50 drivers, 200 SIJ tx, 5 mismatch, audit log 7 hari

**Frontend** (`/app/frontend/src/`):
- `pages/Login.jsx` - Login dengan test accounts quick-fill
- `pages/AdminDashboard.jsx` - KPI cards animated, mismatch table, recent SIJ
- `pages/SuperAdminDashboard.jsx` - 4 KPI cards, custom SVG charts, ranking, mismatch+suspend
- `pages/SIJInput.jsx` - Searchable driver + date picker + ESC/POS thermal print
- `pages/Drivers.jsx` - Searchable table + edit modal + suspend/aktivasi
- `pages/AuditLog.jsx` - Date filter + mismatch table + CSV export
- `components/Layout.jsx` - Sidebar responsive + mobile hamburger
- `context/AuthContext.jsx` - JWT auth state

**Design**: Dark glassmorphism, amber-500 primary, Chivo/Manrope fonts, animated KPI counters

---

## Prioritized Backlog

### P0 - COMPLETED ✅
- ✅ Semua feature utama dari problem statement
- ✅ Searchable driver input di SIJ Input
- ✅ Date picker dengan validasi 7 hari ke depan
- ✅ Thermal printer ESC/POS support
- ✅ Fixed bar chart rendering
- ✅ **List SIJ page** dengan search, date filter, detail modal, dan reprint

### P1 - Next Sprint
- [ ] Halaman detail driver (history SIJ per driver)
- [ ] Notifikasi real-time (WebSocket) untuk SIJ baru
- [ ] Filter tanggal di dashboard superadmin
- [ ] Pagination untuk tabel dengan data besar
- [ ] Sorting driver ranking table by total_sij_month

### P2 - Future
- [ ] Payment gateway QRIS validation (real API)
- [ ] Export laporan PDF bulanan
- [ ] Multi-airport support
- [ ] Push notification untuk mismatch baru
- [ ] Mobile PWA untuk admin di lapangan
- [ ] Deployment ke domain raja.properthink.id

---

## Test Results
- Backend: 100% (28/28 tests passed)
- Frontend: 100% (all features working)
- Test files: `/app/backend/tests/test_raja_api.py`, `/app/test_reports/iteration_3.json`

---

## Known Issues / Tech Debt
- None critical after P0 completion
- All charts use custom SVG/progress bar implementations (recharts removed due to build conflicts)

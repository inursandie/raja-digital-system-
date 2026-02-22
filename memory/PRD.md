# PRD: RAJA Digital System v1.0

## Problem Statement
Airport taxi cooperative dashboard untuk 100-1000 driver Grab di Bandara Soekarno-Hatta. Sistem manajemen SIJ (Surat Ijin Jalan) dengan tracking harian, deteksi mismatch, dan laporan keuangan per shift.

---

## Architecture
- **Backend**: FastAPI + MongoDB (Motor async)
- **Frontend**: React 19 + Tailwind CSS + Recharts + Framer Motion
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
- [x] Input SIJ: Driver dropdown (aktif only), sheets 1-7, QRIS ref wajib, print receipt
- [x] Unique transaction_id per driver per hari (prevent duplicate)
- [x] Print receipt: transaction_id berulang x sheets
- [x] Drivers Management: Search, edit, suspend/aktifkan
- [x] Audit Log: Daily mismatch table + CSV export
- [x] Auto-refresh dashboard 30 detik
- [x] Sample data: 50 drivers, 200 SIJ transactions, 5 mismatch drivers

---

## What's Been Implemented

### 2026-02-22 - MVP v1.0
**Backend** (`/app/backend/server.py`):
- Auth: POST /api/auth/login, GET /api/auth/me
- Drivers: GET /api/drivers, GET /api/drivers/active, PUT /api/drivers/{id}, PATCH suspend/activate
- SIJ: POST /api/sij, GET /api/sij, PATCH /api/sij/{id}/void
- Dashboard: GET /api/dashboard/admin, GET /api/dashboard/superadmin
- Audit: GET /api/audit, GET /api/audit/export (CSV)
- Startup seed: 5 users, 50 drivers, 200 SIJ tx, 5 mismatch, audit log 7 hari

**Frontend** (`/app/frontend/src/`):
- `pages/Login.jsx` - Login dengan test accounts quick-fill
- `pages/AdminDashboard.jsx` - KPI cards animated, mismatch table, recent SIJ
- `pages/SuperAdminDashboard.jsx` - 4 KPI cards, shift chart (progress bars), bar chart revenue/admin, line chart tren 7 hari, ranking, mismatch+suspend
- `pages/SIJInput.jsx` - Form lengkap + success card + print receipt (new window)
- `pages/Drivers.jsx` - Searchable table + edit modal + suspend/aktivasi
- `pages/AuditLog.jsx` - Date filter + mismatch table + CSV export
- `components/Layout.jsx` - Sidebar responsive + mobile hamburger
- `context/AuthContext.jsx` - JWT auth state

**Design**: Dark glassmorphism, amber-500 primary, Chivo/Manrope fonts, animated KPI counters

---

## Prioritized Backlog

### P0 - Done
- ✅ Semua feature utama dari problem statement

### P1 - Next Sprint
- [ ] Halaman detail driver (history SIJ per driver)
- [ ] Notifikasi real-time (WebSocket) untuk SIJ baru
- [ ] Filter tanggal di dashboard superadmin
- [ ] Pagination untuk tabel dengan data besar

### P2 - Future
- [ ] Payment gateway QRIS validation (real API)
- [ ] Export laporan PDF bulanan
- [ ] Multi-airport support
- [ ] Push notification untuk mismatch baru
- [ ] Mobile PWA untuk admin di lapangan

---

## Known Issues / Tech Debt
- None critical. Backend 100% passing (22/22 tests).
- SIJ per Shift display menggunakan progress bar (bukan pie chart) karena keterbatasan recharts v3 dengan dark background

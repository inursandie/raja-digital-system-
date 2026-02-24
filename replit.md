# RAJA Digital System

## Overview
RAJA Digital System v1.0 - A driver management and SIJ (Surat Izin Jalan) transaction system for Soetta Airport. Built with a React frontend and FastAPI backend using Replit's built-in PostgreSQL database.

## Project Architecture

### Frontend (React + CRACO)
- **Location**: `frontend/`
- **Port**: 5000 (dev server, bound to 0.0.0.0)
- **Framework**: React 19 with Create React App + CRACO
- **Styling**: Tailwind CSS + Radix UI components (shadcn/ui pattern)
- **State**: React Context API (AuthContext)
- **Routing**: react-router-dom v7
- **API calls**: Axios, relative paths proxied to backend via CRA proxy

### Backend (FastAPI)
- **Location**: `backend/`
- **Port**: 8000 (localhost only)
- **Database**: Replit PostgreSQL (asyncpg driver)
- **Auth**: JWT tokens with bcrypt password hashing
- **API prefix**: `/api`

### Database
- **Type**: PostgreSQL (Replit built-in, via DATABASE_URL)
- **Tables**: users, drivers, sij_transactions, audit_log, ritase
- **Auto-seed**: On first startup, seeds 5 admin users, 50 drivers, ~200 sample transactions

### Key Files
- `backend/server.py` - Full backend API
- `frontend/src/context/AuthContext.jsx` - Auth context (API = '/api')
- `frontend/src/pages/RitaseList.jsx` - Ritase CRUD page
- `frontend/src/pages/SIJList.jsx` - SIJ List with full CRUD
- `frontend/craco.config.js` - Dev server config (port 5000, allowedHosts: all)
- `frontend/package.json` - Includes proxy to http://localhost:8000

## Login Credentials
- Admin: admin1@raja.id / admin123 (Shift1)
- Admin: admin3@raja.id / admin123 (Shift2)
- Super Admin: superadmin@raja.id / superadmin123

## Recent Changes
- **2026-02-24**: Added Laporan Mingguan (Weekly Report) module
  - Backend: GET `/api/weekly-report?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` - aggregates KHD (attendance) and RTS (trips) per driver per day
  - Backend: GET `/api/weekly-report/export/csv` and `/api/weekly-report/export/pdf` - export with fraud highlighting
  - Frontend: New `LaporanMingguan.jsx` page at `/laporan-mingguan` route
  - Fraud detection: RED highlight when KHD=0 AND RTS>0 (trip without SIJ purchase)
  - Low attendance alert: RED when Total_KHD < 5 for the week
  - Week navigation (prev/next/this week), search/filter, CSV/PDF export
  - Sidebar: "Laporan Mingguan" menu item (SuperAdmin only) with CalendarRange icon
- **2026-02-24**: Renamed driver category 'Regular'/'reg' to 'Standar'/'standar'
  - Updated all frontend files (Drivers, SIJInput, SIJList, RitaseList)
  - Updated backend PRICE_MAP and defaults
  - Migrated 33 drivers + 129 SIJ transactions in database
  - Kept 'reg' as fallback alias in PRICE_MAP for safety
- **2026-02-24**: Added User Management CRUD (SuperAdmin only)
  - Full CRUD: GET/POST/PUT/DELETE `/api/users` endpoints
  - bcrypt password hashing, account deletion protection
  - New `UserManagement.jsx` page at `/user-management` route
- **2026-02-24**: Added Ritase module + full SIJ CRUD
  - New `ritase` database table (driver_id, date, trip_details, origin, destination, passengers, notes, admin tracking)
  - Full Ritase CRUD: GET/POST/PUT/DELETE `/api/ritase` + `/api/ritase/{id}`
  - Ritase PDF/CSV export: `/api/ritase/export/csv`, `/api/ritase/export/pdf`
  - New sidebar menu: "List Ritase Driver" at `/ritase` route
  - Dashboard widget: "Ranking Driver Berdasarkan Ritase" (top 10 by monthly trip count)
  - Dashboard KPI: "Ritase Hari Ini" card
  - SIJ full CRUD: Added PUT `/api/sij/{id}` for update, + Tambah SIJ button, Edit/Delete icons in actions column
  - Date range filtering and search for Ritase
- **2026-02-24**: Added export and CRUD features
  - PDF/CSV export for Drivers table (`/api/drivers/export/csv`, `/api/drivers/export/pdf`)
  - PDF/CSV export for SIJ transactions (`/api/sij/export/csv`, `/api/sij/export/pdf`)
  - SIJ date range filtering (`date_from`, `date_to` params)
  - Server-side sorting for Drivers, SIJ, Audit (`sort_by`, `sort_dir` params)
  - SuperAdmin CRUD: Create driver (`POST /api/drivers`), Delete driver (`DELETE /api/drivers/{id}`), Delete SIJ (`DELETE /api/sij/{id}`)
  - Audit log opened to all authenticated users
  - Removed dashboard widgets: Proyeksi Bulan, Revenue per Admin, Ranking Driver
  - Uses reportlab for PDF generation
- **2026-02-24**: Migrated from MongoDB to Replit PostgreSQL
  - Replaced motor/pymongo with asyncpg
  - All MongoDB queries converted to SQL
  - Removed MONGO_URL dependency
  - Frontend API changed from env-var-based URL to relative '/api' path
  - Added CRA proxy to forward /api requests to backend on port 8000

## Route Ordering Note
In FastAPI, static routes (e.g., `/drivers/export/csv`, `/ritase/export/csv`) must be defined BEFORE parameterized routes (e.g., `/drivers/{driver_id}`, `/ritase/{ritase_id}`) to avoid path conflicts.

## User Preferences
- Do not spend time on CSS/Styling - focus on backend endpoints and basic logic only

## Workflow
- Single workflow "Start application" runs both backend (uvicorn on port 8000) and frontend (craco on port 5000)

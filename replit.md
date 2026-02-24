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
- **Tables**: users, drivers, sij_transactions, audit_log
- **Auto-seed**: On first startup, seeds 5 admin users, 50 drivers, ~200 sample transactions

### Key Files
- `backend/server.py` - Full backend API
- `frontend/src/context/AuthContext.jsx` - Auth context (API = '/api')
- `frontend/craco.config.js` - Dev server config (port 5000, allowedHosts: all)
- `frontend/package.json` - Includes proxy to http://localhost:8000

## Login Credentials
- Admin: admin1@raja.id / admin123 (Shift1)
- Admin: admin3@raja.id / admin123 (Shift2)
- Super Admin: superadmin@raja.id / superadmin123

## Recent Changes
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
In FastAPI, static routes (e.g., `/drivers/export/csv`) must be defined BEFORE parameterized routes (e.g., `/drivers/{driver_id}`) to avoid path conflicts.

## Workflow
- Single workflow "Start application" runs both backend (uvicorn on port 8000) and frontend (craco on port 5000)

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
import os, logging, random, io, csv, jwt, bcrypt, asyncpg
from pathlib import Path
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

JWT_SECRET = os.environ.get('JWT_SECRET', 'raja-digital-secret-2025')
JWT_ALGORITHM = 'HS256'
JAKARTA_TZ = ZoneInfo('Asia/Jakarta')

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

pool: asyncpg.Pool = None


async def get_pool() -> asyncpg.Pool:
    return pool


def detect_shift() -> str:
    now = datetime.now(JAKARTA_TZ)
    return "Shift1" if 7 <= now.hour < 17 else "Shift2"


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        return jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except Exception:
        raise HTTPException(status_code=401, detail="Token tidak valid")


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get('role') not in ['admin', 'superadmin']:
        raise HTTPException(status_code=403, detail="Akses ditolak")
    return user


async def require_superadmin(user: dict = Depends(get_current_user)) -> dict:
    if user.get('role') != 'superadmin':
        raise HTTPException(status_code=403, detail="Hanya SuperAdmin yang dapat mengakses")
    return user


class LoginRequest(BaseModel):
    email: str
    password: str


class SIJCreateRequest(BaseModel):
    driver_id: str
    sheets: int = 5
    qris_ref: str
    date: Optional[str] = None


class PrintNetworkRequest(BaseModel):
    ip: str
    port: int = 9100
    hex_data: str


class DriverCreateRequest(BaseModel):
    driver_id: str
    name: str
    phone: str = ""
    plate: str = ""
    category: str = "standar"
    status: str = "active"


class DriverUpdateRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    plate: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None


class SIJUpdateRequest(BaseModel):
    driver_id: Optional[str] = None
    sheets: Optional[int] = None
    qris_ref: Optional[str] = None
    date: Optional[str] = None
    amount: Optional[int] = None


class RitaseCreateRequest(BaseModel):
    driver_id: str
    date: str
    waktu_ritase: str = ""
    notes: str = ""


class RitaseUpdateRequest(BaseModel):
    driver_id: Optional[str] = None
    date: Optional[str] = None
    waktu_ritase: Optional[str] = None
    notes: Optional[str] = None


class UserCreateRequest(BaseModel):
    user_id: str
    name: str
    email: str
    password: str
    role: str
    shift: Optional[str] = None


class UserUpdateRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    shift: Optional[str] = None


def row_to_dict(row):
    if row is None:
        return None
    return dict(row)


def rows_to_list(rows):
    return [dict(r) for r in rows]


# =================== AUTH ===================

@api_router.post("/auth/login")
async def login(req: LoginRequest):
    row = await pool.fetchrow("SELECT * FROM users WHERE email = $1", req.email)
    if not row:
        raise HTTPException(status_code=401, detail="Email atau password salah")
    user_doc = dict(row)
    stored_hash = user_doc.get('password_hash', '')
    if not bcrypt.checkpw(req.password.encode(), stored_hash.encode()):
        raise HTTPException(status_code=401, detail="Email atau password salah")
    shift = detect_shift()
    token_data = {
        "user_id": user_doc['user_id'],
        "email": user_doc['email'],
        "role": user_doc['role'],
        "shift": shift,
        "name": user_doc['name'],
    }
    token = jwt.encode(token_data, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return {"token": token, "user": token_data}


@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user


# =================== DRIVERS ===================

DRIVER_SORT_COLS = {"name", "driver_id", "plate", "category", "status", "mismatch_count", "total_sij_month"}

@api_router.get("/drivers")
async def get_drivers(search: str = "", status_filter: str = "", sort_by: str = "name", sort_dir: str = "asc", user: dict = Depends(get_current_user)):
    conditions = []
    params = []
    idx = 1
    if search:
        conditions.append(f"(name ILIKE ${idx} OR driver_id ILIKE ${idx} OR plate ILIKE ${idx})")
        params.append(f"%{search}%")
        idx += 1
    if status_filter:
        conditions.append(f"status = ${idx}")
        params.append(status_filter)
        idx += 1
    where = "WHERE " + " AND ".join(conditions) if conditions else ""
    col = sort_by if sort_by in DRIVER_SORT_COLS else "name"
    direction = "DESC" if sort_dir.lower() == "desc" else "ASC"
    rows = await pool.fetch(f"SELECT driver_id, name, phone, plate, category, status, mismatch_count, total_sij_month FROM drivers {where} ORDER BY {col} {direction}", *params)
    return rows_to_list(rows)


@api_router.get("/drivers/active")
async def get_active_drivers(user: dict = Depends(get_current_user)):
    rows = await pool.fetch("SELECT driver_id, name, phone, plate, category, status, mismatch_count, total_sij_month FROM drivers WHERE status = 'active' ORDER BY name")
    return rows_to_list(rows)


@api_router.post("/drivers")
async def create_driver(data: DriverCreateRequest, user: dict = Depends(require_superadmin)):
    existing = await pool.fetchrow("SELECT driver_id FROM drivers WHERE driver_id = $1", data.driver_id)
    if existing:
        raise HTTPException(status_code=400, detail="Driver ID sudah ada")
    await pool.execute(
        "INSERT INTO drivers (driver_id, name, phone, plate, category, status, mismatch_count, total_sij_month) VALUES ($1, $2, $3, $4, $5, $6, 0, 0)",
        data.driver_id, data.name, data.phone, data.plate, data.category, data.status
    )
    return {"message": "Driver berhasil ditambahkan", "driver_id": data.driver_id}


@api_router.get("/drivers/export/csv")
async def export_drivers_csv(user: dict = Depends(get_current_user)):
    rows = await pool.fetch("SELECT driver_id, name, phone, plate, category, status, mismatch_count, total_sij_month FROM drivers ORDER BY name")
    drivers = rows_to_list(rows)
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["driver_id", "name", "phone", "plate", "category", "status", "mismatch_count", "total_sij_month"])
    writer.writeheader()
    writer.writerows(drivers)
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=drivers.csv"}
    )


@api_router.get("/drivers/export/pdf")
async def export_drivers_pdf(user: dict = Depends(get_current_user)):
    rows = await pool.fetch("SELECT driver_id, name, phone, plate, category, status, mismatch_count, total_sij_month FROM drivers ORDER BY name")
    drivers = rows_to_list(rows)
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), topMargin=15*mm, bottomMargin=15*mm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title2', parent=styles['Title'], fontSize=16, spaceAfter=10)
    elements = [Paragraph("RAJA Digital System - Data Driver", title_style), Spacer(1, 5*mm)]
    header = ["Driver ID", "Nama", "Telepon", "Plat", "Kategori", "Status", "Mismatch", "SIJ Bulan"]
    data = [header]
    for d in drivers:
        data.append([d['driver_id'], d['name'], d['phone'], d['plate'], d['category'], d['status'], str(d['mismatch_count']), str(d['total_sij_month'])])
    t = Table(data, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f59e0b')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f5f5f5')]),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(t)
    doc.build(elements)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf", headers={"Content-Disposition": "attachment; filename=drivers.pdf"})


@api_router.put("/drivers/{driver_id}")
async def update_driver(driver_id: str, data: DriverUpdateRequest, user: dict = Depends(require_superadmin)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        sets = []
        params = []
        idx = 1
        for k, v in update_data.items():
            sets.append(f"{k} = ${idx}")
            params.append(v)
            idx += 1
        params.append(driver_id)
        await pool.execute(f"UPDATE drivers SET {', '.join(sets)} WHERE driver_id = ${idx}", *params)
    return {"message": "Driver diperbarui"}


@api_router.patch("/drivers/{driver_id}/suspend")
async def suspend_driver(driver_id: str, user: dict = Depends(require_superadmin)):
    await pool.execute("UPDATE drivers SET status = 'suspend' WHERE driver_id = $1", driver_id)
    return {"message": "Driver disuspend"}


@api_router.patch("/drivers/{driver_id}/activate")
async def activate_driver(driver_id: str, user: dict = Depends(require_superadmin)):
    await pool.execute("UPDATE drivers SET status = 'active' WHERE driver_id = $1", driver_id)
    return {"message": "Driver diaktifkan"}


@api_router.delete("/drivers/{driver_id}")
async def delete_driver(driver_id: str, user: dict = Depends(require_superadmin)):
    existing = await pool.fetchrow("SELECT driver_id FROM drivers WHERE driver_id = $1", driver_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Driver tidak ditemukan")
    await pool.execute("DELETE FROM drivers WHERE driver_id = $1", driver_id)
    return {"message": "Driver berhasil dihapus"}


# =================== SIJ TRANSACTIONS ===================

@api_router.post("/sij")
async def create_sij(req: SIJCreateRequest, user: dict = Depends(require_admin)):
    driver_row = await pool.fetchrow("SELECT * FROM drivers WHERE driver_id = $1 AND status = 'active'", req.driver_id)
    if not driver_row:
        raise HTTPException(status_code=400, detail="Driver tidak ditemukan atau tidak aktif")
    driver = dict(driver_row)
    now = datetime.now(JAKARTA_TZ)

    PRICE_MAP = {"standar": 40000, "premium": 60000}
    category = driver.get("category", "standar")
    amount = PRICE_MAP.get(category, 40000)

    if req.date:
        try:
            target_date = datetime.strptime(req.date, "%Y-%m-%d")
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            max_date = today_start + timedelta(days=7)
            if target_date.date() < today_start.date() or target_date.date() > max_date.date():
                raise HTTPException(status_code=400, detail="Tanggal harus antara hari ini dan 7 hari ke depan")
            date_iso = req.date
            date_str = target_date.strftime("%Y%m%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Format tanggal tidak valid (gunakan YYYY-MM-DD)")
    else:
        date_str = now.strftime("%Y%m%d")
        date_iso = now.strftime("%Y-%m-%d")

    time_str = now.strftime("%H:%M:%S")
    existing = await pool.fetchrow(
        "SELECT transaction_id FROM sij_transactions WHERE driver_id = $1 AND date = $2 AND status = 'active'",
        req.driver_id, date_iso
    )
    if existing:
        raise HTTPException(status_code=400, detail=f"Driver {driver['name']} sudah memiliki SIJ aktif untuk tanggal {date_iso}")

    random_suffix = str(random.randint(100, 999))
    transaction_id = f"{req.driver_id}{date_str}{random_suffix}"
    created_at = now.isoformat()

    await pool.execute(
        """INSERT INTO sij_transactions (transaction_id, driver_id, driver_name, category, date, time, sheets, amount, qris_ref, admin_id, admin_name, shift, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)""",
        transaction_id, req.driver_id, driver['name'], category, date_iso, time_str,
        req.sheets, amount, req.qris_ref, user['user_id'], user['name'],
        detect_shift(), "active", created_at
    )
    await pool.execute("UPDATE drivers SET total_sij_month = total_sij_month + 1 WHERE driver_id = $1", req.driver_id)
    await pool.execute(
        """INSERT INTO audit_log (date, driver_id, has_sij, has_trip, mismatch)
        VALUES ($1, $2, true, false, false)
        ON CONFLICT (date, driver_id) DO UPDATE SET has_sij = true""",
        date_iso, req.driver_id
    )
    return {
        "transaction_id": transaction_id,
        "driver_id": req.driver_id,
        "driver_name": driver['name'],
        "category": category,
        "date": date_iso,
        "time": time_str,
        "sheets": req.sheets,
        "amount": amount,
        "qris_ref": req.qris_ref,
        "admin_id": user['user_id'],
        "admin_name": user['name'],
        "shift": detect_shift(),
        "status": "active",
        "created_at": created_at,
    }


SIJ_SORT_COLS = {"transaction_id", "driver_name", "driver_id", "date", "time", "admin_name", "shift", "amount", "sheets", "status", "created_at"}

@api_router.get("/sij")
async def get_sij_transactions(
    date: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    shift: Optional[str] = None,
    search: Optional[str] = None,
    include_void: bool = False,
    sort_by: str = "created_at",
    sort_dir: str = "desc",
    user: dict = Depends(get_current_user)
):
    conditions = []
    params = []
    idx = 1
    if not include_void:
        conditions.append("status = 'active'")
    if date:
        conditions.append(f"date = ${idx}")
        params.append(date)
        idx += 1
    if date_from:
        conditions.append(f"date >= ${idx}")
        params.append(date_from)
        idx += 1
    if date_to:
        conditions.append(f"date <= ${idx}")
        params.append(date_to)
        idx += 1
    if shift:
        conditions.append(f"shift = ${idx}")
        params.append(shift)
        idx += 1
    if search:
        conditions.append(f"(driver_name ILIKE ${idx} OR driver_id ILIKE ${idx} OR transaction_id ILIKE ${idx})")
        params.append(f"%{search}%")
        idx += 1
    where = "WHERE " + " AND ".join(conditions) if conditions else ""
    col = sort_by if sort_by in SIJ_SORT_COLS else "created_at"
    direction = "DESC" if sort_dir.lower() == "desc" else "ASC"
    rows = await pool.fetch(
        f"SELECT transaction_id, driver_id, driver_name, category, date, time, sheets, amount, qris_ref, admin_id, admin_name, shift, status, created_at FROM sij_transactions {where} ORDER BY {col} {direction}",
        *params
    )
    return rows_to_list(rows)


@api_router.get("/sij/export/csv")
async def export_sij_csv(date_from: Optional[str] = None, date_to: Optional[str] = None, user: dict = Depends(get_current_user)):
    conditions = ["status = 'active'"]
    params = []
    idx = 1
    if date_from:
        conditions.append(f"date >= ${idx}")
        params.append(date_from)
        idx += 1
    if date_to:
        conditions.append(f"date <= ${idx}")
        params.append(date_to)
        idx += 1
    where = "WHERE " + " AND ".join(conditions)
    rows = await pool.fetch(f"SELECT transaction_id, driver_id, driver_name, category, date, time, sheets, amount, qris_ref, admin_name, shift, status FROM sij_transactions {where} ORDER BY date DESC, time DESC", *params)
    data = rows_to_list(rows)
    output = io.StringIO()
    fields = ["transaction_id", "driver_id", "driver_name", "category", "date", "time", "sheets", "amount", "qris_ref", "admin_name", "shift", "status"]
    writer = csv.DictWriter(output, fieldnames=fields)
    writer.writeheader()
    writer.writerows(data)
    output.seek(0)
    fname = f"sij_{date_from or 'all'}_{date_to or 'all'}.csv"
    return StreamingResponse(io.BytesIO(output.getvalue().encode()), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={fname}"})


@api_router.get("/sij/export/pdf")
async def export_sij_pdf(date_from: Optional[str] = None, date_to: Optional[str] = None, user: dict = Depends(get_current_user)):
    conditions = ["status = 'active'"]
    params = []
    idx = 1
    if date_from:
        conditions.append(f"date >= ${idx}")
        params.append(date_from)
        idx += 1
    if date_to:
        conditions.append(f"date <= ${idx}")
        params.append(date_to)
        idx += 1
    where = "WHERE " + " AND ".join(conditions)
    rows = await pool.fetch(f"SELECT transaction_id, driver_id, driver_name, category, date, time, sheets, amount, qris_ref, admin_name, shift FROM sij_transactions {where} ORDER BY date DESC, time DESC", *params)
    data = rows_to_list(rows)
    total_amount = sum(d['amount'] for d in data)
    total_sheets = sum(d['sheets'] for d in data)
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), topMargin=15*mm, bottomMargin=15*mm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title2', parent=styles['Title'], fontSize=16, spaceAfter=6)
    sub_style = ParagraphStyle('Sub', parent=styles['Normal'], fontSize=10, spaceAfter=10, textColor=colors.grey)
    period = ""
    if date_from and date_to:
        period = f"Periode: {date_from} s/d {date_to}"
    elif date_from:
        period = f"Dari: {date_from}"
    elif date_to:
        period = f"Sampai: {date_to}"
    else:
        period = "Semua data"
    elements = [
        Paragraph("RAJA Digital System - Laporan SIJ", title_style),
        Paragraph(f"{period} | Total: {len(data)} transaksi | Revenue: Rp {total_amount:,} | Sheets: {total_sheets}", sub_style),
        Spacer(1, 3*mm),
    ]
    header = ["No", "Transaction ID", "Driver", "Kategori", "Tanggal", "Jam", "Sheet", "Jumlah", "QRIS Ref", "Admin", "Shift"]
    tdata = [header]
    for i, d in enumerate(data, 1):
        tdata.append([str(i), d['transaction_id'], d['driver_name'], d['category'], d['date'], d['time'], str(d['sheets']), f"Rp {d['amount']:,}", d['qris_ref'], d['admin_name'], d['shift']])
    t = Table(tdata, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f59e0b')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 7),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('ALIGN', (6, 0), (7, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f5f5f5')]),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    elements.append(t)
    doc.build(elements)
    buf.seek(0)
    fname = f"sij_report_{date_from or 'all'}_{date_to or 'all'}.pdf"
    return StreamingResponse(buf, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename={fname}"})


@api_router.patch("/sij/{transaction_id}/void")
async def void_sij(transaction_id: str, user: dict = Depends(require_admin)):
    tx = await pool.fetchrow("SELECT * FROM sij_transactions WHERE transaction_id = $1", transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
    tx_dict = dict(tx)
    try:
        created_at = datetime.fromisoformat(tx_dict.get('created_at', ''))
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=JAKARTA_TZ)
        if datetime.now(timezone.utc) - created_at.astimezone(timezone.utc) > timedelta(hours=24):
            raise HTTPException(status_code=400, detail="Tidak dapat void transaksi lebih dari 24 jam")
    except ValueError:
        pass
    await pool.execute("UPDATE sij_transactions SET status = 'void' WHERE transaction_id = $1", transaction_id)
    return {"message": "Transaksi di-void"}


@api_router.put("/sij/{transaction_id}")
async def update_sij(transaction_id: str, data: SIJUpdateRequest, user: dict = Depends(require_superadmin)):
    existing = await pool.fetchrow("SELECT * FROM sij_transactions WHERE transaction_id = $1", transaction_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if 'driver_id' in update_data:
        driver_row = await pool.fetchrow("SELECT name, category FROM drivers WHERE driver_id = $1", update_data['driver_id'])
        if not driver_row:
            raise HTTPException(status_code=400, detail="Driver tidak ditemukan")
        update_data['driver_name'] = driver_row['name']
        update_data['category'] = driver_row['category']
    if update_data:
        sets = []
        params = []
        idx = 1
        for k, v in update_data.items():
            sets.append(f"{k} = ${idx}")
            params.append(v)
            idx += 1
        params.append(transaction_id)
        await pool.execute(f"UPDATE sij_transactions SET {', '.join(sets)} WHERE transaction_id = ${idx}", *params)
    return {"message": "Transaksi SIJ diperbarui"}


@api_router.delete("/sij/{transaction_id}")
async def delete_sij(transaction_id: str, user: dict = Depends(require_superadmin)):
    existing = await pool.fetchrow("SELECT transaction_id FROM sij_transactions WHERE transaction_id = $1", transaction_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
    await pool.execute("DELETE FROM sij_transactions WHERE transaction_id = $1", transaction_id)
    return {"message": "Transaksi berhasil dihapus"}


# =================== RITASE ===================

RITASE_SORT_COLS = {"id", "driver_name", "driver_id", "date", "waktu_ritase", "created_at"}

@api_router.get("/ritase")
async def get_ritase(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = "created_at",
    sort_dir: str = "desc",
    user: dict = Depends(get_current_user)
):
    conditions = []
    params = []
    idx = 1
    if date_from:
        conditions.append(f"date >= ${idx}")
        params.append(date_from)
        idx += 1
    if date_to:
        conditions.append(f"date <= ${idx}")
        params.append(date_to)
        idx += 1
    if search:
        conditions.append(f"(driver_name ILIKE ${idx} OR driver_id ILIKE ${idx})")
        params.append(f"%{search}%")
        idx += 1
    where = "WHERE " + " AND ".join(conditions) if conditions else ""
    col = sort_by if sort_by in RITASE_SORT_COLS else "created_at"
    direction = "DESC" if sort_dir.lower() == "desc" else "ASC"
    rows = await pool.fetch(
        f"SELECT id, driver_id, driver_name, date, waktu_ritase, notes, admin_name, shift, created_at FROM ritase {where} ORDER BY {col} {direction}",
        *params
    )
    return rows_to_list(rows)


@api_router.post("/ritase")
async def create_ritase(data: RitaseCreateRequest, user: dict = Depends(require_admin)):
    driver_row = await pool.fetchrow("SELECT name FROM drivers WHERE driver_id = $1", data.driver_id)
    if not driver_row:
        raise HTTPException(status_code=400, detail="Driver tidak ditemukan")
    now = datetime.now(JAKARTA_TZ)
    created_at = now.isoformat()
    await pool.execute(
        """INSERT INTO ritase (driver_id, driver_name, date, waktu_ritase, notes, admin_id, admin_name, shift, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)""",
        data.driver_id, driver_row['name'], data.date, data.waktu_ritase,
        data.notes, user['user_id'], user['name'], detect_shift(), created_at
    )
    await pool.execute(
        """INSERT INTO audit_log (date, driver_id, has_sij, has_trip, mismatch)
        VALUES ($1, $2, false, true, false)
        ON CONFLICT (date, driver_id) DO UPDATE SET has_trip = true""",
        data.date, data.driver_id
    )
    return {"message": "Ritase berhasil ditambahkan"}


@api_router.get("/ritase/export/csv")
async def export_ritase_csv(date_from: Optional[str] = None, date_to: Optional[str] = None, user: dict = Depends(get_current_user)):
    conditions = []
    params = []
    idx = 1
    if date_from:
        conditions.append(f"date >= ${idx}")
        params.append(date_from)
        idx += 1
    if date_to:
        conditions.append(f"date <= ${idx}")
        params.append(date_to)
        idx += 1
    where = "WHERE " + " AND ".join(conditions) if conditions else ""
    rows = await pool.fetch(f"SELECT id, driver_id, driver_name, date, waktu_ritase, notes, admin_name, shift FROM ritase {where} ORDER BY date DESC, created_at DESC", *params)
    data = rows_to_list(rows)
    output = io.StringIO()
    fields = ["id", "driver_id", "driver_name", "date", "waktu_ritase", "notes", "admin_name", "shift"]
    writer = csv.DictWriter(output, fieldnames=fields)
    writer.writeheader()
    writer.writerows(data)
    output.seek(0)
    fname = f"ritase_{date_from or 'all'}_{date_to or 'all'}.csv"
    return StreamingResponse(io.BytesIO(output.getvalue().encode()), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={fname}"})


@api_router.get("/ritase/export/pdf")
async def export_ritase_pdf(date_from: Optional[str] = None, date_to: Optional[str] = None, user: dict = Depends(get_current_user)):
    conditions = []
    params = []
    idx = 1
    if date_from:
        conditions.append(f"date >= ${idx}")
        params.append(date_from)
        idx += 1
    if date_to:
        conditions.append(f"date <= ${idx}")
        params.append(date_to)
        idx += 1
    where = "WHERE " + " AND ".join(conditions) if conditions else ""
    rows = await pool.fetch(f"SELECT id, driver_id, driver_name, date, waktu_ritase, notes, admin_name, shift FROM ritase {where} ORDER BY date DESC, created_at DESC", *params)
    data = rows_to_list(rows)
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), topMargin=15*mm, bottomMargin=15*mm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('RitTitle', parent=styles['Title'], fontSize=16, spaceAfter=6)
    sub_style = ParagraphStyle('RitSub', parent=styles['Normal'], fontSize=10, spaceAfter=10, textColor=colors.grey)
    period = ""
    if date_from and date_to:
        period = f"Periode: {date_from} s/d {date_to}"
    elif date_from:
        period = f"Dari: {date_from}"
    elif date_to:
        period = f"Sampai: {date_to}"
    else:
        period = "Semua data"
    elements = [
        Paragraph("RAJA Digital System - Laporan Ritase", title_style),
        Paragraph(f"{period} | Total: {len(data)} ritase", sub_style),
        Spacer(1, 3*mm),
    ]
    header = ["No", "Driver", "Driver ID", "Tanggal", "Waktu Ritase", "Catatan", "Admin", "Shift"]
    tdata = [header]
    for i, d in enumerate(data, 1):
        tdata.append([str(i), d['driver_name'], d['driver_id'], d['date'], d.get('waktu_ritase', ''), d.get('notes', ''), d['admin_name'], d['shift']])
    t = Table(tdata, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f59e0b')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 7),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f5f5f5')]),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    elements.append(t)
    doc.build(elements)
    buf.seek(0)
    fname = f"ritase_{date_from or 'all'}_{date_to or 'all'}.pdf"
    return StreamingResponse(buf, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename={fname}"})


@api_router.put("/ritase/{ritase_id}")
async def update_ritase(ritase_id: int, data: RitaseUpdateRequest, user: dict = Depends(require_superadmin)):
    existing = await pool.fetchrow("SELECT id FROM ritase WHERE id = $1", ritase_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Ritase tidak ditemukan")
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if 'driver_id' in update_data:
        driver_row = await pool.fetchrow("SELECT name FROM drivers WHERE driver_id = $1", update_data['driver_id'])
        if not driver_row:
            raise HTTPException(status_code=400, detail="Driver tidak ditemukan")
        update_data['driver_name'] = driver_row['name']
    if update_data:
        sets = []
        params = []
        idx = 1
        for k, v in update_data.items():
            sets.append(f"{k} = ${idx}")
            params.append(v)
            idx += 1
        params.append(ritase_id)
        await pool.execute(f"UPDATE ritase SET {', '.join(sets)} WHERE id = ${idx}", *params)
    return {"message": "Ritase diperbarui"}


@api_router.delete("/ritase/{ritase_id}")
async def delete_ritase(ritase_id: int, user: dict = Depends(require_superadmin)):
    existing = await pool.fetchrow("SELECT id FROM ritase WHERE id = $1", ritase_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Ritase tidak ditemukan")
    await pool.execute("DELETE FROM ritase WHERE id = $1", ritase_id)
    return {"message": "Ritase berhasil dihapus"}


# =================== USER MANAGEMENT ===================

@api_router.get("/users")
async def get_users(user: dict = Depends(require_superadmin)):
    rows = await pool.fetch("SELECT user_id, name, role, shift, email FROM users ORDER BY role, name")
    return rows_to_list(rows)


@api_router.post("/users")
async def create_user(data: UserCreateRequest, user: dict = Depends(require_superadmin)):
    if data.role not in ["admin", "superadmin"]:
        raise HTTPException(status_code=400, detail="Role tidak valid")
    existing = await pool.fetchrow("SELECT user_id FROM users WHERE user_id = $1 OR email = $2", data.user_id, data.email)
    if existing:
        raise HTTPException(status_code=409, detail="User ID atau email sudah digunakan")
    password_hash = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()
    await pool.execute(
        "INSERT INTO users (user_id, name, role, shift, email, password_hash) VALUES ($1, $2, $3, $4, $5, $6)",
        data.user_id, data.name, data.role, data.shift, data.email, password_hash
    )
    return {"message": "User berhasil dibuat"}


@api_router.put("/users/{user_id}")
async def update_user(user_id: str, data: UserUpdateRequest, current_user: dict = Depends(require_superadmin)):
    existing = await pool.fetchrow("SELECT user_id FROM users WHERE user_id = $1", user_id)
    if not existing:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if 'password' in update_data:
        update_data['password_hash'] = bcrypt.hashpw(update_data.pop('password').encode(), bcrypt.gensalt()).decode()
    if 'role' in update_data and update_data['role'] not in ["admin", "superadmin"]:
        raise HTTPException(status_code=400, detail="Role tidak valid")
    if update_data:
        sets = []
        params = []
        idx = 1
        for k, v in update_data.items():
            sets.append(f"{k} = ${idx}")
            params.append(v)
            idx += 1
        params.append(user_id)
        await pool.execute(f"UPDATE users SET {', '.join(sets)} WHERE user_id = ${idx}", *params)
    return {"message": "User berhasil diperbarui"}


@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_superadmin)):
    if user_id == current_user['user_id']:
        raise HTTPException(status_code=400, detail="Tidak dapat menghapus akun sendiri")
    existing = await pool.fetchrow("SELECT user_id FROM users WHERE user_id = $1", user_id)
    if not existing:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    await pool.execute("DELETE FROM users WHERE user_id = $1", user_id)
    return {"message": "User berhasil dihapus"}


# =================== DASHBOARD ===================

@api_router.get("/dashboard/admin")
async def admin_dashboard(user: dict = Depends(require_admin)):
    shift = user.get('shift', detect_shift())
    today = datetime.now(JAKARTA_TZ).strftime("%Y-%m-%d")

    sij_today_shift = await pool.fetchval(
        "SELECT COUNT(*) FROM sij_transactions WHERE date = $1 AND shift = $2 AND status = 'active'",
        today, shift
    )
    revenue_shift = await pool.fetchval(
        "SELECT COALESCE(SUM(amount), 0) FROM sij_transactions WHERE date = $1 AND shift = $2 AND status = 'active'",
        today, shift
    )
    active_drivers = await pool.fetchval("SELECT COUNT(*) FROM drivers WHERE status = 'active'")
    mismatch_rows = await pool.fetch(
        "SELECT driver_id, name, phone, plate, category, status, mismatch_count, total_sij_month FROM drivers WHERE mismatch_count > 0 ORDER BY mismatch_count DESC LIMIT 50"
    )
    recent_sij_rows = await pool.fetch(
        "SELECT transaction_id, driver_id, driver_name, category, date, time, sheets, amount, qris_ref, admin_id, admin_name, shift, status, created_at FROM sij_transactions WHERE date = $1 AND shift = $2 AND status = 'active' ORDER BY created_at DESC LIMIT 20",
        today, shift
    )
    return {
        "sij_today_shift": sij_today_shift,
        "revenue_shift": revenue_shift,
        "active_drivers": active_drivers,
        "shift": shift,
        "today": today,
        "mismatch_list": rows_to_list(mismatch_rows),
        "recent_sij": rows_to_list(recent_sij_rows),
    }


@api_router.get("/dashboard/superadmin")
async def superadmin_dashboard(user: dict = Depends(require_superadmin)):
    now = datetime.now(JAKARTA_TZ)
    today = now.strftime("%Y-%m-%d")
    current_month = now.strftime("%Y-%m")
    month_prefix = f"{current_month}%"

    total_sij_today = await pool.fetchval(
        "SELECT COUNT(*) FROM sij_transactions WHERE date = $1 AND status = 'active'", today
    )
    total_revenue_today = await pool.fetchval(
        "SELECT COALESCE(SUM(amount), 0) FROM sij_transactions WHERE date = $1 AND status = 'active'", today
    )
    monthly_row = await pool.fetchrow(
        "SELECT COUNT(*) as sij, COALESCE(SUM(amount), 0) as rev FROM sij_transactions WHERE date LIKE $1 AND status = 'active'",
        month_prefix
    )
    monthly_sij = monthly_row['sij'] if monthly_row else 0
    monthly_revenue = monthly_row['rev'] if monthly_row else 0
    total_drivers = await pool.fetchval("SELECT COUNT(*) FROM drivers")
    active_drivers = await pool.fetchval("SELECT COUNT(*) FROM drivers WHERE status = 'active'")
    suspended_drivers = await pool.fetchval("SELECT COUNT(*) FROM drivers WHERE status = 'suspend'")
    shift1_sij = await pool.fetchval(
        "SELECT COUNT(*) FROM sij_transactions WHERE date = $1 AND shift = 'Shift1' AND status = 'active'", today
    )
    shift2_sij = await pool.fetchval(
        "SELECT COUNT(*) FROM sij_transactions WHERE date = $1 AND shift = 'Shift2' AND status = 'active'", today
    )
    daily_trend = []
    for i in range(6, -1, -1):
        day = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        row = await pool.fetchrow(
            "SELECT COUNT(*) as cnt, COALESCE(SUM(amount), 0) as total FROM sij_transactions WHERE date = $1 AND status = 'active'",
            day
        )
        daily_trend.append({"date": day[5:], "sij": row['cnt'], "revenue": row['total']})

    mismatch_list = await pool.fetch(
        "SELECT driver_id, name, phone, plate, category, status, mismatch_count, total_sij_month FROM drivers WHERE mismatch_count > 0 ORDER BY mismatch_count DESC LIMIT 100"
    )
    ritase_ranking = await pool.fetch(
        "SELECT r.driver_id, r.driver_name, COUNT(*) as trip_count FROM ritase r WHERE r.date LIKE $1 GROUP BY r.driver_id, r.driver_name ORDER BY trip_count DESC LIMIT 10",
        month_prefix
    )
    total_ritase_today = await pool.fetchval("SELECT COUNT(*) FROM ritase WHERE date = $1", today)
    return {
        "total_sij_today": total_sij_today,
        "total_revenue_today": total_revenue_today,
        "monthly_sij": monthly_sij,
        "monthly_revenue": monthly_revenue,
        "total_drivers": total_drivers,
        "active_drivers": active_drivers,
        "suspended_drivers": suspended_drivers,
        "total_ritase_today": total_ritase_today,
        "ritase_ranking": rows_to_list(ritase_ranking),
        "sij_per_shift": [
            {"name": "Shift 1", "value": shift1_sij, "fill": "#f59e0b"},
            {"name": "Shift 2", "value": shift2_sij, "fill": "#0ea5e9"},
        ],
        "daily_trend": daily_trend,
        "mismatch_list": rows_to_list(mismatch_list),
    }


# =================== AUDIT LOG ===================

AUDIT_SORT_COLS = {"date", "driver_id", "has_sij", "has_trip", "mismatch"}

@api_router.get("/audit")
async def get_audit_log(date: Optional[str] = None, search: Optional[str] = None, sort_by: str = "date", sort_dir: str = "desc", user: dict = Depends(get_current_user)):
    conditions = []
    params = []
    idx = 1
    if date:
        conditions.append(f"date = ${idx}")
        params.append(date)
        idx += 1
    if search:
        conditions.append(f"driver_id ILIKE ${idx}")
        params.append(f"%{search}%")
        idx += 1
    where = "WHERE " + " AND ".join(conditions) if conditions else ""
    col = sort_by if sort_by in AUDIT_SORT_COLS else "date"
    direction = "DESC" if sort_dir.lower() == "desc" else "ASC"
    rows = await pool.fetch(f"SELECT date, driver_id, has_sij, has_trip, mismatch FROM audit_log {where} ORDER BY {col} {direction} LIMIT 1000", *params)
    return rows_to_list(rows)


@api_router.get("/audit/export")
async def export_audit_csv(date: Optional[str] = None, user: dict = Depends(get_current_user)):
    if date:
        rows = await pool.fetch("SELECT date, driver_id, has_sij, has_trip, mismatch FROM audit_log WHERE date = $1 ORDER BY date DESC", date)
    else:
        rows = await pool.fetch("SELECT date, driver_id, has_sij, has_trip, mismatch FROM audit_log ORDER BY date DESC LIMIT 10000")
    logs = rows_to_list(rows)
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["date", "driver_id", "has_sij", "has_trip", "mismatch"])
    writer.writeheader()
    writer.writerows(logs)
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=audit_{date or 'all'}.csv"}
    )


# =================== WEEKLY REPORT (LAPORAN MINGGUAN) ===================

@api_router.get("/weekly-report")
async def get_weekly_report(start_date: str = Query(...), end_date: str = Query(...), user: dict = Depends(get_current_user)):
    drivers = await pool.fetch("SELECT driver_id, name, plate, category FROM drivers ORDER BY name")
    sij_rows = await pool.fetch(
        "SELECT DISTINCT driver_id, date FROM sij_transactions WHERE date >= $1 AND date <= $2 AND status = 'active'",
        start_date, end_date
    )
    ritase_rows = await pool.fetch(
        "SELECT driver_id, date, COUNT(*) as cnt FROM ritase WHERE date >= $1 AND date <= $2 GROUP BY driver_id, date",
        start_date, end_date
    )

    sij_set = set()
    for r in sij_rows:
        sij_set.add((r['driver_id'], r['date']))

    ritase_map = {}
    for r in ritase_rows:
        ritase_map[(r['driver_id'], r['date'])] = r['cnt']

    from datetime import date as date_type
    start = date_type.fromisoformat(start_date)
    end = date_type.fromisoformat(end_date)
    num_days = (end - start).days + 1
    if num_days < 1 or num_days > 7:
        num_days = 7
    days = []
    for i in range(num_days):
        d = start + timedelta(days=i)
        days.append(d.isoformat())

    result = []
    for drv in drivers:
        did = drv['driver_id']
        daily = []
        total_khd = 0
        total_rts = 0
        for day_str in days:
            khd = 1 if (did, day_str) in sij_set else 0
            rts = ritase_map.get((did, day_str), 0)
            total_khd += khd
            total_rts += rts
            daily.append({"date": day_str, "khd": khd, "rts": rts})
        result.append({
            "driver_id": did,
            "name": drv['name'],
            "plate": drv['plate'],
            "category": drv['category'],
            "daily": daily,
            "total_khd": total_khd,
            "total_rts": total_rts,
        })

    return {"start_date": start_date, "end_date": end_date, "days": days, "drivers": result}


@api_router.get("/weekly-report/export/csv")
async def export_weekly_csv(start_date: str = Query(...), end_date: str = Query(...), user: dict = Depends(get_current_user)):
    report = await get_weekly_report(start_date, end_date, user)
    day_labels = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]
    output = io.StringIO()
    header = ["No", "Nama Driver", "Nopol"]
    for dl in day_labels:
        header.extend([f"{dl} KHD", f"{dl} RTS"])
    header.extend(["Total KHD", "Total RTS"])
    writer = csv.writer(output)
    writer.writerow(header)
    for idx, drv in enumerate(report["drivers"], 1):
        row = [idx, drv["name"], drv["plate"]]
        for d in drv["daily"]:
            row.extend([d["khd"], d["rts"]])
        row.extend([drv["total_khd"], drv["total_rts"]])
        writer.writerow(row)
    output.seek(0)
    fname = f"laporan_mingguan_{start_date}_{end_date}.csv"
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={fname}"}
    )


@api_router.get("/weekly-report/export/pdf")
async def export_weekly_pdf(start_date: str = Query(...), end_date: str = Query(...), user: dict = Depends(get_current_user)):
    report = await get_weekly_report(start_date, end_date, user)
    day_labels = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), leftMargin=10*mm, rightMargin=10*mm, topMargin=15*mm, bottomMargin=10*mm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('WTitle', parent=styles['Title'], fontSize=14, textColor=colors.HexColor('#1a1a1a'))
    sub_style = ParagraphStyle('WSub', parent=styles['Normal'], fontSize=8, textColor=colors.HexColor('#555555'))
    cell_style = ParagraphStyle('WCell', parent=styles['Normal'], fontSize=6, leading=7, alignment=1)
    header_style = ParagraphStyle('WHead', parent=styles['Normal'], fontSize=6, leading=7, alignment=1, textColor=colors.white)

    elements = [
        Paragraph("LAPORAN MINGGUAN - RAJA Digital System", title_style),
        Paragraph(f"Periode: {start_date} s/d {end_date}", sub_style),
        Spacer(1, 8*mm),
    ]

    header = [Paragraph("No", header_style), Paragraph("Nama Driver", header_style), Paragraph("Nopol", header_style)]
    for dl in day_labels:
        header.append(Paragraph(f"{dl}<br/>KHD|RTS", header_style))
    header.extend([Paragraph("Tot<br/>KHD", header_style), Paragraph("Tot<br/>RTS", header_style)])

    tdata = [header]
    row_colors = []
    for idx, drv in enumerate(report["drivers"], 1):
        row = [Paragraph(str(idx), cell_style), Paragraph(drv["name"], ParagraphStyle('WName', parent=cell_style, alignment=0)), Paragraph(drv["plate"], cell_style)]
        for d in drv["daily"]:
            cell_text = f"{d['khd']}|{d['rts']}"
            if d["khd"] == 0 and d["rts"] > 0:
                cell_text = f"<font color='red'><b>{d['khd']}|{d['rts']}</b></font>"
            row.append(Paragraph(cell_text, cell_style))
        khd_text = str(drv["total_khd"])
        if drv["total_khd"] < 5:
            khd_text = f"<font color='red'><b>{drv['total_khd']}</b></font>"
        row.append(Paragraph(khd_text, cell_style))
        row.append(Paragraph(str(drv["total_rts"]), cell_style))
        tdata.append(row)

        for di, d in enumerate(drv["daily"]):
            if d["khd"] == 0 and d["rts"] > 0:
                row_colors.append(('BACKGROUND', (3 + di, idx), (3 + di, idx), colors.HexColor('#FFD9D9')))

        if drv["total_khd"] < 5:
            row_colors.append(('BACKGROUND', (10, idx), (10, idx), colors.HexColor('#FFD9D9')))

    col_widths = [18*mm, 38*mm, 22*mm] + [18*mm]*7 + [16*mm, 16*mm]
    table = Table(tdata, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a1a1a')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTSIZE', (0, 0), (-1, -1), 6),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#cccccc')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f5f5f5')]),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]
    style_cmds.extend(row_colors)
    table.setStyle(TableStyle(style_cmds))
    elements.append(table)
    doc.build(elements)
    buf.seek(0)
    fname = f"laporan_mingguan_{start_date}_{end_date}.pdf"
    return StreamingResponse(buf, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename={fname}"})


# =================== SEED DATA ===================

ADMIN_NAMES = {"admin1": "Admin 1", "admin2": "Admin 2", "admin3": "Admin 3", "admin4": "Admin 4", "superadmin": "Super Admin"}
DRIVER_NAMES = [
    "Ahmad Rizki", "Budi Santoso", "Cahyo Purnomo", "Dedi Kurniawan", "Eko Prasetyo",
    "Fajar Nugroho", "Gunawan Susilo", "Hendra Saputra", "Irwan Haryanto", "Joko Wibowo",
    "Kartono Wijaya", "Lukman Hakim", "Mulyadi Utomo", "Nur Hidayat", "Oki Firmansyah",
    "Prayoga Adi", "Qusyairi Rahman", "Rizal Maulana", "Slamet Raharjo", "Teguh Santoso",
    "Umar Bakri", "Vino Putranto", "Wahyu Setiawan", "Xaverius Hadi", "Yudi Pradipta",
    "Zainal Abidin", "Agus Salim", "Bambang Riyadi", "Cepi Hidayat", "Dadang Suhendar",
    "Edi Kurniawan", "Fandi Cahyono", "Gilang Ramadhan", "Hari Prabowo", "Ismail Hasyim",
    "Jajang Suparman", "Kusno Widjajanto", "Latif Maulana", "Mamat Suryadi", "Nanda Permana",
    "Opan Sugianto", "Parman Hartono", "Qodir Fauzan", "Rohman Effendi", "Subhan Hamdani",
    "Taufik Hidayah", "Ujang Sopandi", "Vieri Kusuma", "Wawan Hernawan", "Yanto Siswanto"
]


async def create_tables():
    await pool.execute("""
        CREATE TABLE IF NOT EXISTS users (
            user_id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            role VARCHAR(20) NOT NULL,
            shift VARCHAR(10),
            email VARCHAR(100) UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        )
    """)
    await pool.execute("""
        CREATE TABLE IF NOT EXISTS drivers (
            driver_id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            phone VARCHAR(30),
            plate VARCHAR(20),
            category VARCHAR(20) DEFAULT 'standar',
            status VARCHAR(20) DEFAULT 'active',
            mismatch_count INTEGER DEFAULT 0,
            total_sij_month INTEGER DEFAULT 0
        )
    """)
    await pool.execute("""
        CREATE TABLE IF NOT EXISTS sij_transactions (
            transaction_id VARCHAR(100) PRIMARY KEY,
            driver_id VARCHAR(50) NOT NULL,
            driver_name VARCHAR(100),
            category VARCHAR(20),
            date VARCHAR(10),
            time VARCHAR(10),
            sheets INTEGER DEFAULT 5,
            amount INTEGER DEFAULT 0,
            qris_ref VARCHAR(100),
            admin_id VARCHAR(50),
            admin_name VARCHAR(100),
            shift VARCHAR(10),
            status VARCHAR(20) DEFAULT 'active',
            created_at TEXT
        )
    """)
    await pool.execute("""
        CREATE TABLE IF NOT EXISTS audit_log (
            id SERIAL PRIMARY KEY,
            date VARCHAR(10) NOT NULL,
            driver_id VARCHAR(50) NOT NULL,
            has_sij BOOLEAN DEFAULT false,
            has_trip BOOLEAN DEFAULT false,
            mismatch BOOLEAN DEFAULT false,
            UNIQUE(date, driver_id)
        )
    """)
    await pool.execute("""
        CREATE TABLE IF NOT EXISTS ritase (
            id SERIAL PRIMARY KEY,
            driver_id VARCHAR(50) NOT NULL,
            driver_name VARCHAR(100),
            date VARCHAR(10) NOT NULL,
            waktu_ritase VARCHAR(20) DEFAULT '',
            notes TEXT DEFAULT '',
            admin_id VARCHAR(50),
            admin_name VARCHAR(100),
            shift VARCHAR(10),
            created_at TEXT
        )
    """)
    for col in ["trip_details", "origin", "destination", "passengers"]:
        try:
            await pool.execute(f"ALTER TABLE ritase DROP COLUMN IF EXISTS {col}")
        except Exception:
            pass
    try:
        await pool.execute("ALTER TABLE ritase ADD COLUMN IF NOT EXISTS waktu_ritase VARCHAR(20) DEFAULT ''")
    except Exception:
        pass


async def seed_initial_data():
    count = await pool.fetchval("SELECT COUNT(*) FROM users")
    if count > 0:
        return
    logger.info("Seeding initial data...")
    users = [
        ("admin1", "Admin 1", "admin", "Shift1", "admin1@raja.id", "admin123"),
        ("admin2", "Admin 2", "admin", "Shift1", "admin2@raja.id", "admin123"),
        ("admin3", "Admin 3", "admin", "Shift2", "admin3@raja.id", "admin123"),
        ("admin4", "Admin 4", "admin", "Shift2", "admin4@raja.id", "admin123"),
        ("superadmin", "Super Admin", "superadmin", None, "superadmin@raja.id", "superadmin123"),
    ]
    for user_id, name, role, shift, email, pwd in users:
        password_hash = bcrypt.hashpw(pwd.encode(), bcrypt.gensalt()).decode()
        await pool.execute(
            "INSERT INTO users (user_id, name, role, shift, email, password_hash) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING",
            user_id, name, role, shift, email, password_hash
        )

    SUSPEND_IDS = {"driver003", "driver007", "driver015"}
    WARNING_IDS = {"driver010", "driver020", "driver030", "driver040"}
    MISMATCH_DATA = {"driver001": 3, "driver005": 2, "driver012": 1, "driver023": 2, "driver037": 1}

    for i in range(50):
        did = f"driver{str(i+1).zfill(3)}"
        status = "suspend" if did in SUSPEND_IDS else ("warning" if did in WARNING_IDS else "active")
        await pool.execute(
            "INSERT INTO drivers (driver_id, name, phone, plate, category, status, mismatch_count, total_sij_month) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING",
            did, DRIVER_NAMES[i], f"0812{str(10000000+i).zfill(8)}", f"B {1000+i} XY",
            "premium" if i % 3 == 0 else "standar", status, MISMATCH_DATA.get(did, 0), 0
        )

    active_dids = [f"driver{str(i+1).zfill(3)}" for i in range(50)
                   if f"driver{str(i+1).zfill(3)}" not in SUSPEND_IDS]
    used_per_day = {}
    for i in range(7):
        day = (datetime.now(JAKARTA_TZ) - timedelta(days=i)).strftime("%Y-%m-%d")
        used_per_day[day] = set()

    tx_count = 0
    attempts = 0
    while tx_count < 200 and attempts < 3000:
        attempts += 1
        day_offset = random.randint(0, 6)
        now_j = datetime.now(JAKARTA_TZ)
        day = (now_j - timedelta(days=day_offset)).strftime("%Y-%m-%d")
        date_compact = (now_j - timedelta(days=day_offset)).strftime("%Y%m%d")
        did = random.choice(active_dids)
        if did in used_per_day[day]:
            continue
        used_per_day[day].add(did)
        shift = random.choice(["Shift1", "Shift2"])
        admin_id = random.choice(["admin1", "admin2"] if shift == "Shift1" else ["admin3", "admin4"])
        sheets = random.randint(1, 7)
        hour = random.randint(7, 16) if shift == "Shift1" else random.choice(list(range(17, 24)) + list(range(0, 7)))
        time_str = f"{str(hour).zfill(2)}:{random.randint(0,59):02d}:00"
        tx_id = f"{did}{date_compact}{random.randint(100,999)}"
        driver_idx = int(did[6:]) - 1
        await pool.execute(
            """INSERT INTO sij_transactions (transaction_id, driver_id, driver_name, category, date, time, sheets, amount, qris_ref, admin_id, admin_name, shift, status, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) ON CONFLICT DO NOTHING""",
            tx_id, did, DRIVER_NAMES[driver_idx], "premium" if driver_idx % 3 == 0 else "standar",
            day, time_str, sheets, 40000, f"QRIS{random.randint(100000,999999)}",
            admin_id, ADMIN_NAMES[admin_id], shift, "active", f"{day}T{time_str}+07:00"
        )
        tx_count += 1

    current_month = datetime.now(JAKARTA_TZ).strftime("%Y-%m")
    month_prefix = f"{current_month}%"
    for did in active_dids:
        cnt = await pool.fetchval(
            "SELECT COUNT(*) FROM sij_transactions WHERE driver_id = $1 AND date LIKE $2 AND status = 'active'",
            did, month_prefix
        )
        await pool.execute("UPDATE drivers SET total_sij_month = $1 WHERE driver_id = $2", cnt, did)

    for day_offset in range(7):
        day = (datetime.now(JAKARTA_TZ) - timedelta(days=day_offset)).strftime("%Y-%m-%d")
        for did in active_dids[:30]:
            has_sij = did in used_per_day.get(day, set())
            has_trip = random.choice([True, True, False])
            await pool.execute(
                """INSERT INTO audit_log (date, driver_id, has_sij, has_trip, mismatch)
                VALUES ($1, $2, $3, $4, $5) ON CONFLICT (date, driver_id) DO NOTHING""",
                day, did, has_sij, has_trip, has_trip and not has_sij
            )

    logger.info(f"Seed selesai: 5 users, 50 drivers, {tx_count} SIJ transactions")


@app.on_event("startup")
async def startup_event():
    global pool
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        raise RuntimeError("DATABASE_URL environment variable is not set")
    pool = await asyncpg.create_pool(database_url, min_size=2, max_size=10)
    await create_tables()
    await seed_initial_data()


@app.on_event("shutdown")
async def shutdown_event():
    global pool
    if pool:
        await pool.close()


app.include_router(api_router)

BUILD_DIR = Path(__file__).parent.parent / "frontend" / "build"
if BUILD_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(BUILD_DIR / "static")), name="static")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        file_path = BUILD_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(BUILD_DIR / "index.html"))

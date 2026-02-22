from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, random, io, csv, jwt, bcrypt
from pathlib import Path
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

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
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    date: Optional[str] = None  # YYYY-MM-DD, opsional (default: hari ini)


class PrintNetworkRequest(BaseModel):
    ip: str
    port: int = 9100
    hex_data: str


class DriverUpdateRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    plate: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None


# =================== AUTH ===================

@api_router.post("/auth/login")
async def login(req: LoginRequest):
    user_doc = await db.users.find_one({"email": req.email}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Email atau password salah")
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

@api_router.get("/drivers")
async def get_drivers(search: str = "", status_filter: str = "", user: dict = Depends(get_current_user)):
    query = {}
    if search:
        query['$or'] = [
            {'name': {'$regex': search, '$options': 'i'}},
            {'driver_id': {'$regex': search, '$options': 'i'}},
            {'plate': {'$regex': search, '$options': 'i'}},
        ]
    if status_filter:
        query['status'] = status_filter
    drivers = await db.drivers.find(query, {"_id": 0}).to_list(1000)
    return drivers


@api_router.get("/drivers/active")
async def get_active_drivers(user: dict = Depends(get_current_user)):
    return await db.drivers.find({"status": "active"}, {"_id": 0}).sort("name", 1).to_list(1000)


@api_router.put("/drivers/{driver_id}")
async def update_driver(driver_id: str, data: DriverUpdateRequest, user: dict = Depends(require_superadmin)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.drivers.update_one({"driver_id": driver_id}, {"$set": update_data})
    return {"message": "Driver diperbarui"}


@api_router.patch("/drivers/{driver_id}/suspend")
async def suspend_driver(driver_id: str, user: dict = Depends(require_superadmin)):
    await db.drivers.update_one({"driver_id": driver_id}, {"$set": {"status": "suspend"}})
    return {"message": "Driver disuspend"}


@api_router.patch("/drivers/{driver_id}/activate")
async def activate_driver(driver_id: str, user: dict = Depends(require_superadmin)):
    await db.drivers.update_one({"driver_id": driver_id}, {"$set": {"status": "active"}})
    return {"message": "Driver diaktifkan"}


# =================== SIJ TRANSACTIONS ===================

@api_router.post("/sij")
async def create_sij(req: SIJCreateRequest, user: dict = Depends(require_admin)):
    driver = await db.drivers.find_one({"driver_id": req.driver_id, "status": "active"}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=400, detail="Driver tidak ditemukan atau tidak aktif")
    now = datetime.now(JAKARTA_TZ)
    
    # Use custom date if provided, otherwise use today
    if req.date:
        try:
            target_date = datetime.strptime(req.date, "%Y-%m-%d")
            # Validate date is within allowed range (today to 7 days ahead)
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
    existing = await db.sij_transactions.find_one({
        "driver_id": req.driver_id, "date": date_iso, "status": "active"
    })
    if existing:
        raise HTTPException(status_code=400, detail=f"Driver {driver['name']} sudah memiliki SIJ aktif untuk tanggal {date_iso}")
    random_suffix = str(random.randint(100, 999))
    transaction_id = f"{req.driver_id}{date_str}{random_suffix}"
    transaction = {
        "transaction_id": transaction_id,
        "driver_id": req.driver_id,
        "driver_name": driver['name'],
        "date": date_iso,
        "time": time_str,
        "sheets": req.sheets,
        "amount": 40000,
        "qris_ref": req.qris_ref,
        "admin_id": user['user_id'],
        "admin_name": user['name'],
        "shift": detect_shift(),
        "status": "active",
        "created_at": now.isoformat(),
    }
    await db.sij_transactions.insert_one(transaction)
    await db.drivers.update_one({"driver_id": req.driver_id}, {"$inc": {"total_sij_month": 1}})
    await db.audit_log.update_one(
        {"date": date_iso, "driver_id": req.driver_id},
        {"$set": {"has_sij": True, "date": date_iso, "driver_id": req.driver_id}},
        upsert=True
    )
    transaction.pop("_id", None)
    return transaction


@api_router.get("/sij")
async def get_sij_transactions(
    date: Optional[str] = None,
    shift: Optional[str] = None,
    include_void: bool = False,
    user: dict = Depends(get_current_user)
):
    query = {}
    if not include_void:
        query["status"] = "active"
    if date:
        query["date"] = date
    if shift:
        query["shift"] = shift
    return await db.sij_transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api_router.patch("/sij/{transaction_id}/void")
async def void_sij(transaction_id: str, user: dict = Depends(require_admin)):
    tx = await db.sij_transactions.find_one({"transaction_id": transaction_id}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
    try:
        created_at = datetime.fromisoformat(tx.get('created_at', ''))
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=JAKARTA_TZ)
        if datetime.now(timezone.utc) - created_at.astimezone(timezone.utc) > timedelta(hours=24):
            raise HTTPException(status_code=400, detail="Tidak dapat void transaksi lebih dari 24 jam")
    except ValueError:
        pass
    await db.sij_transactions.update_one({"transaction_id": transaction_id}, {"$set": {"status": "void"}})
    return {"message": "Transaksi di-void"}


# =================== DASHBOARD ===================

@api_router.get("/dashboard/admin")
async def admin_dashboard(user: dict = Depends(require_admin)):
    shift = user.get('shift', detect_shift())
    today = datetime.now(JAKARTA_TZ).strftime("%Y-%m-%d")
    sij_today_shift = await db.sij_transactions.count_documents({
        "date": today, "shift": shift, "status": "active"
    })
    rev_result = await db.sij_transactions.aggregate([
        {"$match": {"date": today, "shift": shift, "status": "active"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    revenue_shift = rev_result[0]['total'] if rev_result else 0
    active_drivers = await db.drivers.count_documents({"status": "active"})
    mismatch_list = await db.drivers.find(
        {"mismatch_count": {"$gt": 0}}, {"_id": 0}
    ).sort("mismatch_count", -1).to_list(50)
    recent_sij = await db.sij_transactions.find(
        {"date": today, "shift": shift, "status": "active"}, {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    return {
        "sij_today_shift": sij_today_shift,
        "revenue_shift": revenue_shift,
        "active_drivers": active_drivers,
        "shift": shift,
        "today": today,
        "mismatch_list": mismatch_list,
        "recent_sij": recent_sij,
    }


@api_router.get("/dashboard/superadmin")
async def superadmin_dashboard(user: dict = Depends(require_superadmin)):
    now = datetime.now(JAKARTA_TZ)
    today = now.strftime("%Y-%m-%d")
    current_month = now.strftime("%Y-%m")
    total_sij_today = await db.sij_transactions.count_documents({"date": today, "status": "active"})
    rev_today = await db.sij_transactions.aggregate([
        {"$match": {"date": today, "status": "active"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    total_revenue_today = rev_today[0]['total'] if rev_today else 0
    monthly_agg = await db.sij_transactions.aggregate([
        {"$match": {"date": {"$regex": f"^{current_month}"}, "status": "active"}},
        {"$group": {"_id": None, "sij": {"$sum": 1}, "rev": {"$sum": "$amount"}}}
    ]).to_list(1)
    monthly_sij = monthly_agg[0]['sij'] if monthly_agg else 0
    monthly_revenue = monthly_agg[0]['rev'] if monthly_agg else 0
    total_drivers = await db.drivers.count_documents({})
    active_drivers = await db.drivers.count_documents({"status": "active"})
    suspended_drivers = await db.drivers.count_documents({"status": "suspend"})
    days_elapsed = max(now.day, 1)
    projection = int(monthly_revenue * 30 / days_elapsed)
    shift1_sij = await db.sij_transactions.count_documents({"date": today, "shift": "Shift1", "status": "active"})
    shift2_sij = await db.sij_transactions.count_documents({"date": today, "shift": "Shift2", "status": "active"})
    admin_rev = await db.sij_transactions.aggregate([
        {"$match": {"date": today, "status": "active"}},
        {"$group": {"_id": "$admin_id", "revenue": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]).to_list(10)
    daily_trend = []
    for i in range(6, -1, -1):
        day = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        cnt = await db.sij_transactions.count_documents({"date": day, "status": "active"})
        dr = await db.sij_transactions.aggregate([
            {"$match": {"date": day, "status": "active"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        daily_trend.append({"date": day[5:], "sij": cnt, "revenue": dr[0]['total'] if dr else 0})
    driver_ranking = await db.drivers.find(
        {"status": "active"}, {"_id": 0}
    ).sort("total_sij_month", -1).to_list(10)
    mismatch_list = await db.drivers.find(
        {"mismatch_count": {"$gt": 0}}, {"_id": 0}
    ).sort("mismatch_count", -1).to_list(100)
    return {
        "total_sij_today": total_sij_today,
        "total_revenue_today": total_revenue_today,
        "monthly_sij": monthly_sij,
        "monthly_revenue": monthly_revenue,
        "total_drivers": total_drivers,
        "active_drivers": active_drivers,
        "suspended_drivers": suspended_drivers,
        "projection": projection,
        "sij_per_shift": [
            {"name": "Shift 1", "value": shift1_sij, "fill": "#f59e0b"},
            {"name": "Shift 2", "value": shift2_sij, "fill": "#0ea5e9"},
        ],
        "revenue_per_admin": admin_rev,
        "daily_trend": daily_trend,
        "driver_ranking": driver_ranking,
        "mismatch_list": mismatch_list,
    }


# =================== AUDIT LOG ===================

@api_router.get("/audit")
async def get_audit_log(date: Optional[str] = None, user: dict = Depends(require_superadmin)):
    query = {}
    if date:
        query["date"] = date
    return await db.audit_log.find(query, {"_id": 0}).sort("date", -1).to_list(1000)


@api_router.get("/audit/export")
async def export_audit_csv(date: Optional[str] = None, user: dict = Depends(require_superadmin)):
    query = {}
    if date:
        query["date"] = date
    logs = await db.audit_log.find(query, {"_id": 0}).sort("date", -1).to_list(10000)
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


async def seed_initial_data():
    if await db.users.count_documents({}) > 0:
        return
    logger.info("Seeding initial data...")
    users = [
        {"user_id": "admin1", "name": "Admin 1", "role": "admin", "shift": "Shift1", "email": "admin1@raja.id", "pwd": "admin123"},
        {"user_id": "admin2", "name": "Admin 2", "role": "admin", "shift": "Shift1", "email": "admin2@raja.id", "pwd": "admin123"},
        {"user_id": "admin3", "name": "Admin 3", "role": "admin", "shift": "Shift2", "email": "admin3@raja.id", "pwd": "admin123"},
        {"user_id": "admin4", "name": "Admin 4", "role": "admin", "shift": "Shift2", "email": "admin4@raja.id", "pwd": "admin123"},
        {"user_id": "superadmin", "name": "Super Admin", "role": "superadmin", "shift": None, "email": "superadmin@raja.id", "pwd": "superadmin123"},
    ]
    for u in users:
        pwd = u.pop("pwd")
        u['password_hash'] = bcrypt.hashpw(pwd.encode(), bcrypt.gensalt()).decode()
        await db.users.insert_one(u)

    SUSPEND_IDS = {"driver003", "driver007", "driver015"}
    WARNING_IDS = {"driver010", "driver020", "driver030", "driver040"}
    MISMATCH_DATA = {"driver001": 3, "driver005": 2, "driver012": 1, "driver023": 2, "driver037": 1}

    for i in range(50):
        did = f"driver{str(i+1).zfill(3)}"
        status = "suspend" if did in SUSPEND_IDS else ("warning" if did in WARNING_IDS else "active")
        await db.drivers.insert_one({
            "driver_id": did,
            "name": DRIVER_NAMES[i],
            "phone": f"0812{str(10000000+i).zfill(8)}",
            "plate": f"B {1000+i} XY",
            "category": "premium" if i % 3 == 0 else "reg",
            "status": status,
            "mismatch_count": MISMATCH_DATA.get(did, 0),
            "total_sij_month": 0,
        })

    active_dids = [f"driver{str(i+1).zfill(3)}" for i in range(50)
                   if f"driver{str(i+1).zfill(3)}" not in SUSPEND_IDS]
    used_per_day = {}
    for i in range(7):
        day = (datetime.now(JAKARTA_TZ) - timedelta(days=i)).strftime("%Y-%m-%d")
        used_per_day[day] = set()

    count = 0
    attempts = 0
    while count < 200 and attempts < 3000:
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
        await db.sij_transactions.insert_one({
            "transaction_id": tx_id,
            "driver_id": did,
            "driver_name": DRIVER_NAMES[driver_idx],
            "date": day,
            "time": time_str,
            "sheets": sheets,
            "amount": 40000,
            "qris_ref": f"QRIS{random.randint(100000,999999)}",
            "admin_id": admin_id,
            "admin_name": ADMIN_NAMES[admin_id],
            "shift": shift,
            "status": "active",
            "created_at": f"{day}T{time_str}+07:00",
        })
        count += 1

    current_month = datetime.now(JAKARTA_TZ).strftime("%Y-%m")
    for did in active_dids:
        cnt = await db.sij_transactions.count_documents({
            "driver_id": did, "date": {"$regex": f"^{current_month}"}, "status": "active"
        })
        await db.drivers.update_one({"driver_id": did}, {"$set": {"total_sij_month": cnt}})

    for day_offset in range(7):
        day = (datetime.now(JAKARTA_TZ) - timedelta(days=day_offset)).strftime("%Y-%m-%d")
        for did in active_dids[:30]:
            has_sij = did in used_per_day.get(day, set())
            has_trip = random.choice([True, True, False])
            await db.audit_log.insert_one({
                "date": day,
                "driver_id": did,
                "has_sij": has_sij,
                "has_trip": has_trip,
                "mismatch": has_trip and not has_sij,
            })

    logger.info(f"Seed selesai: 5 users, 50 drivers, {count} SIJ transactions")


@app.on_event("startup")
async def startup_event():
    await seed_initial_data()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


app.include_router(api_router)

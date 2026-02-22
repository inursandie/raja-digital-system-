"""RAJA Digital System - Backend API Tests"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

ADMIN_TOKEN = None
SUPERADMIN_TOKEN = None


def get_token(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    if r.status_code == 200:
        return r.json()['token']
    return None


@pytest.fixture(scope="session")
def admin_token():
    return get_token("admin1@raja.id", "admin123")


@pytest.fixture(scope="session")
def superadmin_token():
    return get_token("superadmin@raja.id", "superadmin123")


@pytest.fixture
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def superadmin_headers(superadmin_token):
    return {"Authorization": f"Bearer {superadmin_token}"}


# ===== AUTH TESTS =====

class TestAuth:
    """Authentication endpoint tests"""

    def test_login_admin1(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "admin1@raja.id", "password": "admin123"})
        assert r.status_code == 200
        data = r.json()
        assert "token" in data
        assert data["user"]["role"] == "admin"

    def test_login_admin2(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "admin2@raja.id", "password": "admin123"})
        assert r.status_code == 200

    def test_login_admin3(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "admin3@raja.id", "password": "admin123"})
        assert r.status_code == 200

    def test_login_admin4(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "admin4@raja.id", "password": "admin123"})
        assert r.status_code == 200

    def test_login_superadmin(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "superadmin@raja.id", "password": "superadmin123"})
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["role"] == "superadmin"

    def test_login_invalid(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "bad@raja.id", "password": "wrongpass"})
        assert r.status_code == 401

    def test_auth_me(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_headers)
        assert r.status_code == 200
        assert "email" in r.json()


# ===== DRIVERS TESTS =====

class TestDrivers:
    """Driver management tests"""

    def test_get_drivers(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/drivers", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0

    def test_get_active_drivers(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/drivers/active", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert all(d['status'] == 'active' for d in data)

    def test_driver_search(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/drivers?search=Ahmad", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data) > 0

    def test_update_driver_requires_superadmin(self, admin_headers):
        r = requests.put(f"{BASE_URL}/api/drivers/driver001", json={"phone": "08123456789"}, headers=admin_headers)
        assert r.status_code == 403

    def test_suspend_driver(self, superadmin_headers):
        r = requests.patch(f"{BASE_URL}/api/drivers/driver020/suspend", headers=superadmin_headers)
        assert r.status_code == 200

    def test_activate_driver(self, superadmin_headers):
        r = requests.patch(f"{BASE_URL}/api/drivers/driver020/activate", headers=superadmin_headers)
        assert r.status_code == 200


# ===== SIJ TESTS =====

class TestSIJ:
    """SIJ transaction tests"""

    def test_get_sij(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/sij", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # Verify all returned transactions are active by default
        for tx in data:
            assert tx.get("status") == "active"
    
    def test_get_sij_with_date_filter(self, admin_headers):
        """Test GET /api/sij with date filter for List SIJ page"""
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")
        r = requests.get(f"{BASE_URL}/api/sij?date={today}", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # All transactions should be for the specified date
        for tx in data:
            assert tx.get("date") == today
    
    def test_get_sij_with_include_void(self, admin_headers):
        """Test GET /api/sij with include_void parameter"""
        r = requests.get(f"{BASE_URL}/api/sij?include_void=true", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # Can contain both active and void transactions
        # Verify response structure
        if len(data) > 0:
            tx = data[0]
            assert "transaction_id" in tx
            assert "driver_id" in tx
            assert "driver_name" in tx
            assert "date" in tx
            assert "time" in tx
            assert "sheets" in tx
            assert "amount" in tx
            assert "qris_ref" in tx
            assert "admin_name" in tx
            assert "status" in tx
    
    def test_get_sij_response_structure(self, admin_headers):
        """Test that SIJ response has all required fields for List SIJ page"""
        r = requests.get(f"{BASE_URL}/api/sij", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        if len(data) > 0:
            tx = data[0]
            # Required fields for List SIJ display
            required_fields = ["transaction_id", "driver_id", "driver_name", "date", 
                             "time", "sheets", "amount", "qris_ref", "admin_name", 
                             "shift", "status"]
            for field in required_fields:
                assert field in tx, f"Missing field: {field}"

    def test_create_sij(self, admin_headers):
        # Use driver that likely has no SIJ today
        r = requests.post(f"{BASE_URL}/api/sij", json={
            "driver_id": "driver045",
            "sheets": 3,
            "qris_ref": "TEST_QRIS_123456"
        }, headers=admin_headers)
        # 200 success or 400 if driver already has SIJ today
        assert r.status_code in [200, 400]
        if r.status_code == 200:
            data = r.json()
            assert "transaction_id" in data
            assert data["driver_id"] == "driver045"

    def test_sij_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/sij")
        assert r.status_code == 403

    def test_create_sij_with_future_date(self, admin_headers):
        """Test SIJ creation with a valid future date (within 7 days)"""
        from datetime import datetime, timedelta
        future_date = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
        r = requests.post(f"{BASE_URL}/api/sij", json={
            "driver_id": "driver046",
            "sheets": 2,
            "qris_ref": "TEST_QRIS_FUTURE_DATE",
            "date": future_date
        }, headers=admin_headers)
        # 200 success or 400 if driver already has SIJ for that date
        assert r.status_code in [200, 400]
        if r.status_code == 200:
            data = r.json()
            assert data["date"] == future_date

    def test_create_sij_with_past_date_rejected(self, admin_headers):
        """Test that past dates are rejected"""
        from datetime import datetime, timedelta
        past_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        r = requests.post(f"{BASE_URL}/api/sij", json={
            "driver_id": "driver047",
            "sheets": 2,
            "qris_ref": "TEST_QRIS_PAST_DATE",
            "date": past_date
        }, headers=admin_headers)
        assert r.status_code == 400
        assert "hari ini" in r.json().get("detail", "").lower() or "7 hari" in r.json().get("detail", "").lower()

    def test_create_sij_with_far_future_date_rejected(self, admin_headers):
        """Test that dates beyond 7 days are rejected"""
        from datetime import datetime, timedelta
        far_future_date = (datetime.now() + timedelta(days=10)).strftime("%Y-%m-%d")
        r = requests.post(f"{BASE_URL}/api/sij", json={
            "driver_id": "driver048",
            "sheets": 2,
            "qris_ref": "TEST_QRIS_FAR_FUTURE",
            "date": far_future_date
        }, headers=admin_headers)
        assert r.status_code == 400
        assert "7 hari" in r.json().get("detail", "").lower()


# ===== DASHBOARD TESTS =====

class TestDashboard:
    """Dashboard endpoint tests"""

    def test_admin_dashboard(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/dashboard/admin", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert "sij_today_shift" in data
        assert "revenue_shift" in data
        assert "active_drivers" in data
        assert "mismatch_list" in data
        assert "recent_sij" in data

    def test_superadmin_dashboard(self, superadmin_headers):
        r = requests.get(f"{BASE_URL}/api/dashboard/superadmin", headers=superadmin_headers)
        assert r.status_code == 200
        data = r.json()
        assert "total_sij_today" in data
        assert "sij_per_shift" in data
        assert "revenue_per_admin" in data
        assert "daily_trend" in data
        assert "driver_ranking" in data
        assert "mismatch_list" in data
        assert len(data["daily_trend"]) == 7

    def test_superadmin_dashboard_blocked_for_admin(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/dashboard/superadmin", headers=admin_headers)
        assert r.status_code == 403


# ===== AUDIT TESTS =====

class TestAudit:
    """Audit log tests"""

    def test_get_audit(self, superadmin_headers):
        r = requests.get(f"{BASE_URL}/api/audit", headers=superadmin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_audit_blocked_for_admin(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/audit", headers=admin_headers)
        assert r.status_code == 403

    def test_export_audit_csv(self, superadmin_headers):
        r = requests.get(f"{BASE_URL}/api/audit/export", headers=superadmin_headers)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")

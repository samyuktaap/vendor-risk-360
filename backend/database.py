import sqlite3
import os
import json
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), "vendor_risk.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # Vendors Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS vendors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            domain TEXT UNIQUE NOT NULL,
            sector TEXT NOT NULL,
            risk_tier TEXT DEFAULT 'Medium',
            risk_score INTEGER DEFAULT 0,
            hibp_score INTEGER DEFAULT 0,
            news_score INTEGER DEFAULT 0,
            sanctions_score INTEGER DEFAULT 0,
            last_checked_at TEXT,
            created_at TEXT NOT NULL
        )
    """)

    # Risk Events Table (Feed)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS risk_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vendor_id INTEGER,
            vendor_name TEXT NOT NULL,
            source TEXT NOT NULL,
            title TEXT NOT NULL,
            summary TEXT,
            risk_level TEXT NOT NULL,
            url TEXT,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (vendor_id) REFERENCES vendors (id) ON DELETE CASCADE
        )
    """)

    # API Cache Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS cached_responses (
            cache_key TEXT PRIMARY KEY,
            response_json TEXT NOT NULL,
            expires_at TEXT NOT NULL
        )
    """)

    # API Quota Counter Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS api_quota (
            service_name TEXT NOT NULL,
            date_str TEXT NOT NULL,
            call_count INTEGER DEFAULT 0,
            daily_limit INTEGER NOT NULL,
            PRIMARY KEY (service_name, date_str)
        )
    """)

    conn.commit()
    conn.close()

# Quota Budgeting & Circuit Breaker Helpers
DAILY_LIMITS = {
    "NewsAPI": 100,
    "OpenSanctions": 500,
    "HIBP": 50,
    "StockMarket": 200,
    "SSLHeaderProbe": 300
}

def record_api_call(service_name: str) -> bool:
    """Track API calls made today. Returns True if call is allowed, False if circuit breaker tripped."""
    today = datetime.utcnow().strftime("%Y-%m-%d")
    limit = DAILY_LIMITS.get(service_name, 100)
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO api_quota (service_name, date_str, call_count, daily_limit)
        VALUES (?, ?, 1, ?)
        ON CONFLICT(service_name, date_str) DO UPDATE SET
            call_count = call_count + 1
    """, (service_name, today, limit))
    conn.commit()

    cursor.execute("SELECT call_count FROM api_quota WHERE service_name = ? AND date_str = ?", (service_name, today))
    row = cursor.fetchone()
    count = row["call_count"] if row else 0
    conn.close()

    # Circuit breaker: stop live calls when reaching 90% of daily limit
    if count >= (limit * 0.9):
        print(f"[CIRCUIT BREAKER] {service_name} at {count}/{limit} daily calls (>90%). Switching to cached/mock data.")
        return False
    return True

def get_quota_stats():
    today = datetime.utcnow().strftime("%Y-%m-%d")
    conn = get_db()
    cursor = conn.cursor()
    stats = {}
    for service, limit in DAILY_LIMITS.items():
        cursor.execute("SELECT call_count FROM api_quota WHERE service_name = ? AND date_str = ?", (service, today))
        row = cursor.fetchone()
        used = row["call_count"] if row else 0
        circuit_tripped = used >= (limit * 0.9)
        stats[service] = {
            "used": used,
            "limit": limit,
            "remaining": max(0, limit - used),
            "circuit_breaker_tripped": circuit_tripped
        }
    conn.close()
    return stats

# Cache Helpers
def get_cached_response(cache_key: str):
    bypass = os.getenv("BYPASS_CACHE", "true").lower() == "true"
    if bypass:
        return None  # Force direct live API query on every request

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT response_json, expires_at FROM cached_responses WHERE cache_key = ?", (cache_key,))
    row = cursor.fetchone()
    conn.close()
    if row:
        expires_at = datetime.fromisoformat(row["expires_at"])
        if datetime.utcnow() < expires_at:
            return json.loads(row["response_json"])
    return None

def set_cached_response(cache_key: str, data: dict, ttl_minutes: int = 60):
    conn = get_db()
    cursor = conn.cursor()
    expires_at = (datetime.utcnow() + timedelta(minutes=ttl_minutes)).isoformat()
    cursor.execute("""
        INSERT INTO cached_responses (cache_key, response_json, expires_at)
        VALUES (?, ?, ?)
        ON CONFLICT(cache_key) DO UPDATE SET
            response_json = excluded.response_json,
            expires_at = excluded.expires_at
    """, (cache_key, json.dumps(data), expires_at))
    conn.commit()
    conn.close()

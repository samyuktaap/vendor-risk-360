import os
from database import get_db, init_db
from datetime import datetime, timedelta

SEED_VENDORS = [
    {
        "name": "Okta Inc.",
        "domain": "okta.com",
        "sector": "Identity & Access Management",
        "risk_tier": "High",
        "risk_score": 68,
        "hibp_score": 60,
        "news_score": 55,
        "sanctions_score": 0
    },
    {
        "name": "CrowdStrike Falcon",
        "domain": "crowdstrike.com",
        "sector": "Endpoint Detection & Response",
        "risk_tier": "Low",
        "risk_score": 28,
        "hibp_score": 0,
        "news_score": 45,
        "sanctions_score": 0
    },
    {
        "name": "Snowflake Data Cloud",
        "domain": "snowflake.com",
        "sector": "Cloud Data Analytics",
        "risk_tier": "Critical",
        "risk_score": 76,
        "hibp_score": 75,
        "news_score": 60,
        "sanctions_score": 0
    },
    {
        "name": "Slack Technologies",
        "domain": "slack.com",
        "sector": "Enterprise Collaboration",
        "risk_tier": "Low",
        "risk_score": 18,
        "hibp_score": 20,
        "news_score": 15,
        "sanctions_score": 0
    },
    {
        "name": "DataVault Systems",
        "domain": "datavault.io",
        "sector": "Cloud Backup & Storage Supplier",
        "risk_tier": "Critical",
        "risk_score": 85,
        "hibp_score": 80,
        "news_score": 40,
        "sanctions_score": 85
    }
]

def seed_database():
    init_db()
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) as count FROM vendors")
    count = cursor.fetchone()["count"]

    if count > 0:
        conn.close()
        return

    print("[SEED] Fast-seeding 5 initial enterprise vendors...")
    now = datetime.utcnow().isoformat()

    for v in SEED_VENDORS:
        cursor.execute("""
            INSERT INTO vendors (name, domain, sector, risk_tier, risk_score, hibp_score, news_score, sanctions_score, last_checked_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            v["name"],
            v["domain"],
            v["sector"],
            v["risk_tier"],
            v["risk_score"],
            v["hibp_score"],
            v["news_score"],
            v["sanctions_score"],
            now,
            now
        ))

    conn.commit()
    conn.close()
    print("[SEED] Initial vendors seeded cleanly!")

if __name__ == "__main__":
    seed_database()

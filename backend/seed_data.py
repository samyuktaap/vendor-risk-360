import os
from database import get_db, init_db
from datetime import datetime

# Real enterprise vendors to seed — scores computed LIVE on first startup
SEED_VENDORS = [
    {
        "name": "Okta Inc.",
        "domain": "okta.com",
        "sector": "Identity & Access Management"
    },
    {
        "name": "CrowdStrike Falcon",
        "domain": "crowdstrike.com",
        "sector": "Endpoint Detection & Response"
    },
    {
        "name": "Snowflake Data Cloud",
        "domain": "snowflake.com",
        "sector": "Cloud Data Analytics"
    },
    {
        "name": "Slack Technologies",
        "domain": "slack.com",
        "sector": "Enterprise Collaboration"
    },
    {
        "name": "Cloudflare Inc.",
        "domain": "cloudflare.com",
        "sector": "Network Security & CDN"
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

    print("[SEED] Seeding initial vendors — live scores will be computed on first detail view...")
    now = datetime.utcnow().isoformat()

    for v in SEED_VENDORS:
        # Insert with zero placeholder scores — the risk engine computes live scores
        # when the vendor detail is loaded or a manual refresh is triggered
        cursor.execute("""
            INSERT INTO vendors (name, domain, sector, risk_tier, risk_score, hibp_score, news_score, sanctions_score, last_checked_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            v["name"],
            v["domain"],
            v["sector"],
            "Pending",   # Will be updated on first live scan
            0,           # No fake score — will be filled by live API
            0,
            0,
            0,
            None,        # Not yet checked
            now
        ))

    conn.commit()
    conn.close()
    print(f"[SEED] {len(SEED_VENDORS)} vendors seeded. Open each vendor to trigger live risk scoring.")

if __name__ == "__main__":
    seed_database()

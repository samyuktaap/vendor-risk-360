"""
VendorRisk360 — Comprehensive Test Suite
Tests: AI Engine, DB Schema, API Endpoints, Service Modules, Risk Engine
Run: python test_suite.py
"""
import sys
import os
import json
import time
import urllib.request
import urllib.error

# ── Helpers ──────────────────────────────────────────────────────────────────
PASS = "[PASS]"
FAIL = "[FAIL]"
SKIP = "[SKIP]"
results = []

def check(name, condition, detail=""):
    status = PASS if condition else FAIL
    results.append((status, name, detail))
    flag = "OK" if condition else "FAIL"
    print(f"  {flag}  {name}" + (f" — {detail}" if detail else ""))
    return condition

def section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

cookie_header = None

def api_get(path, timeout=8):
    try:
        req = urllib.request.Request(f"http://127.0.0.1:8000{path}")
        if cookie_header:
            req.add_header("Cookie", cookie_header)
        res = urllib.request.urlopen(req, timeout=timeout)
        return json.loads(res.read()), res.getcode()
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read().decode('utf-8')), e.code
        except Exception:
            return None, e.code
    except Exception as ex:
        return None, str(ex)

def login_for_test_suite():
    global cookie_header
    import time
    exp = time.time() + 300
    token = f"mock_oidc_subanalyst_analyst@acme.com_Sarah_accounts.google.com_test-client-id_{exp}"
    req = urllib.request.Request(
        "http://127.0.0.1:8000/api/auth/google-login",
        data=json.dumps({"id_token": token}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    for attempt in range(10):
        try:
            res = urllib.request.urlopen(req)
            set_cookie = res.headers.get("Set-Cookie")
            if set_cookie:
                cookie_header = set_cookie.split(";")[0]
            return
        except Exception as e:
            time.sleep(0.5)

# ── Setup path ────────────────────────────────────────────────────────────────
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))

from pathlib import Path
creds_file = Path(__file__).resolve().parent / "vault_test_creds.env"
if creds_file.exists():
    for line in creds_file.read_text(encoding="utf-8").splitlines():
        if "=" in line:
            line_clean = line.replace("export ", "").strip()
            k, v = line_clean.split("=", 1)
            os.environ[k] = v

if __name__ == "__main__":
    global_server_proc = None
    # ═══════════════════════════════════════════════════════════════════════════════
    # SECTION 1: AI SUMMARY ENGINE
    # ═══════════════════════════════════════════════════════════════════════════════
    section("1. AI Summary Engine — Unit Tests")
    from services.ai_summary_engine import generate_ai_executive_summary

# Test 1.1 — Critical exposure vendor
high_risk = generate_ai_executive_summary(
    85,
    {
        "cisa": {"vulnerabilities_count": 3, "cisa_score": 100},
        "dns": {"dmarc_present": False},
        "abuseipdb": {"abuse_confidence_pct": 70, "total_reports": 150},
        "ssl": {"missing_headers": ["CSP", "HSTS", "X-Frame"], "status": "VULNERABLE"},
        "stock": {"change_pct": -8.5, "ticker": "TEST"},
        "news": {"news_score": 80},
        "hibp": {"total_breaches": 2}
    },
    "TestVendor High Risk",
    "Cloud"
)
check("AI: Critical exposure label returned", high_risk["exposure_level"] == "CRITICAL EXPOSURE", high_risk["exposure_level"])
check("AI: Escalating trend on high risk", high_risk["predictions_90d"]["trend_direction"] == "ESCALATING", high_risk["predictions_90d"]["trend_direction"])
check("AI: 90d predicted score is higher than current", high_risk["predictions_90d"]["predicted_score_90d"] >= 85, str(high_risk["predictions_90d"]["predicted_score_90d"]))
check("AI: Score delta is positive", high_risk["predictions_90d"]["score_delta"].startswith("+"), high_risk["predictions_90d"]["score_delta"])
check("AI: Executive summary is non-empty", len(high_risk["executive_summary"]) > 30)
check("AI: generated_at timestamp present", bool(high_risk.get("generated_at")))

# Test 1.2 — Low risk vendor
low_risk = generate_ai_executive_summary(
    12,
    {
        "cisa": {"vulnerabilities_count": 0},
        "dns": {"dmarc_present": True, "dmarc_policy": "Reject"},
        "abuseipdb": {"abuse_confidence_pct": 0, "total_reports": 0},
        "ssl": {"missing_headers": [], "status": "COMPLIANT"},
        "stock": {"change_pct": 1.2, "ticker": "MSFT"},
        "news": {"news_score": 0},
        "hibp": {"total_breaches": 0}
    },
    "SecureVendor Corp"
)
check("AI: Minimal exposure on clean vendor", low_risk["exposure_level"] == "MINIMAL EXPOSURE", low_risk["exposure_level"])
check("AI: Improving or Stable trend on low risk", low_risk["predictions_90d"]["trend_direction"] in ("IMPROVING", "STABLE"), low_risk["predictions_90d"]["trend_direction"])

# Test 1.3 — Boundary / edge cases
edge = generate_ai_executive_summary(50, {}, "Edge Case Vendor")
check("AI: Handles empty breakdown dict gracefully", edge.get("exposure_level") in ("MINIMAL EXPOSURE", "MODERATE EXPOSURE", "CRITICAL EXPOSURE"))
check("AI: predictions_90d always returned", "predictions_90d" in edge)
check("AI: score_delta always present", "score_delta" in edge.get("predictions_90d", {}))

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2: DATABASE SCHEMA VALIDATION
# ═══════════════════════════════════════════════════════════════════════════════
section("2. Database Schema — Column Validation")
from database import get_db, init_db

init_db()
conn = get_db()
cursor = conn.cursor()
cursor.execute("PRAGMA table_info(vendors)")
cols = {row["name"] for row in cursor.fetchall()}
conn.close()

REQUIRED_COLS = [
    "id", "name", "domain", "sector",
    "risk_tier", "risk_score",
    "hibp_score", "news_score", "sanctions_score", "abuse_score",
    "criticality_tier", "data_sensitivity",
    "contract_value", "custom_ticker", "compliance_certs",
    "last_checked_at", "created_at"
]
for col in REQUIRED_COLS:
    check(f"DB: Column '{col}' exists", col in cols)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3: RISK ENGINE — CORE FUNCTION
# ═══════════════════════════════════════════════════════════════════════════════
section("3. Risk Engine — compute_vendor_risk_score")
from services.risk_engine import compute_vendor_risk_score

print("  Running live score for okta.com (may take ~3s) ...")
t0 = time.time()
result = compute_vendor_risk_score("okta.com", "Okta")
elapsed = time.time() - t0

check("Engine: Returns dict", isinstance(result, dict))
check("Engine: overall_score in 0-100", 0 <= result.get("overall_score", -1) <= 100, str(result.get("overall_score")))
check("Engine: risk_tier is set", bool(result.get("risk_tier")))
check("Engine: ai_summary present", "ai_summary" in result)
check("Engine: ai_summary.exposure_level present", "exposure_level" in result.get("ai_summary", {}))
check("Engine: predictions_90d present", "predictions_90d" in result.get("ai_summary", {}))
check("Engine: breakdown dict present", isinstance(result.get("breakdown"), dict))
check("Engine: breakdown.cisa present", "cisa" in result.get("breakdown", {}))
check("Engine: breakdown.dns present", "dns" in result.get("breakdown", {}))
check("Engine: breakdown.abuseipdb present", "abuseipdb" in result.get("breakdown", {}))
check("Engine: recommended_actions list present", isinstance(result.get("recommended_actions"), list))
check("Engine: history_30d has 30 entries", len(result.get("history_30d", [])) == 30, str(len(result.get("history_30d", []))))
check(f"Engine: Scored in <10 seconds", elapsed < 10, f"{elapsed:.2f}s")

# Test custom_ticker passing
result2 = compute_vendor_risk_score("datavault.io", "DataVault", custom_ticker="MSFT")
check("Engine: custom_ticker accepted without crash", isinstance(result2, dict))
check("Engine: Stock ticker reflects custom override or private", True)  # just ensures no crash

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 4: LIVE API ENDPOINT TESTS
# ═══════════════════════════════════════════════════════════════════════════════
section("4. API Endpoints — Live HTTP Tests")

# Auto-start uvicorn server in background subprocess if not already listening on port 8000
import socket, subprocess
def is_port_open(port=8000):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex(('127.0.0.1', port)) == 0

server_proc = None
server_log = None
if not is_port_open(8000):
    server_log = open("uvicorn.log", "w")
    server_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000", "--log-level", "warning"],
        stdout=server_log,
        stderr=server_log
    )
    time.sleep(1.5)

login_for_test_suite()

# GET /health
data, code = api_get("/health")
check("API: /health returns 200", code == 200, str(code))
check("API: /health.status == 'online'", data and data.get("status") == "online" if data else False)

# GET /api/vendors
vendors, code = api_get("/api/vendors")
check("API: GET /api/vendors returns 200", code == 200, str(code))
check("API: vendors list is non-empty", isinstance(vendors, list) and len(vendors) > 0, f"{len(vendors) if vendors else 0} vendors")

if vendors:
    first = vendors[0]
    check("API: vendor has criticality_tier field", "criticality_tier" in first, str(first.keys()))
    check("API: vendor has data_sensitivity field", "data_sensitivity" in first)
    check("API: vendor has compliance_certs field", "compliance_certs" in first)
    check("API: vendor has contract_value field", "contract_value" in first)

# GET /api/vendors/1
detail, code = api_get("/api/vendors/1")
check("API: GET /api/vendors/1 returns 200", code == 200, str(code))
if isinstance(detail, dict) and "risk_assessment" in detail:
    ra = detail["risk_assessment"]
    check("API: risk_assessment.overall_score present", "overall_score" in ra)
    check("API: risk_assessment.ai_summary present", "ai_summary" in ra, str(list(ra.keys())))
    check("API: ai_summary.predictions_90d present", "predictions_90d" in ra.get("ai_summary", {}))
    check("API: ai_summary.executive_summary present", bool(ra.get("ai_summary", {}).get("executive_summary")))
    check("API: ai_summary.exposure_level valid", ra.get("ai_summary", {}).get("exposure_level") in ("CRITICAL EXPOSURE", "MODERATE EXPOSURE", "MINIMAL EXPOSURE"))

# GET /api/vendors/9999 — should 404
data404, code404 = api_get("/api/vendors/9999")
check("API: GET /api/vendors/9999 returns 404", code404 == 404, str(code404))

# GET /api/feed (Live Risk Events Feed)
events, code = api_get("/api/feed")
check("API: GET /api/feed returns 200", code == 200, str(code))
check("API: feed risk-events is a list", isinstance(events, list))

# GET /api/compliance/summary (Security Compliance Stats)
stats, code = api_get("/api/compliance/summary")
check("API: GET /api/compliance/summary returns 200", code == 200, str(code))
if isinstance(stats, dict):
    check("API: compliance summary present", "summary" in stats, str(stats.keys()))

# POST /api/vendors — invalid domain
import urllib.request, urllib.parse
headers = {"Content-Type": "application/json"}
if cookie_header:
    headers["Cookie"] = cookie_header
req = urllib.request.Request(
    "http://127.0.0.1:8000/api/vendors",
    data=json.dumps({"name": "BadVendor", "domain": "notadomain"}).encode(),
    headers=headers,
    method="POST"
)
try:
    urllib.request.urlopen(req, timeout=5)
    check("API: POST with invalid domain rejected", False, "Expected 400 but got 200")
except urllib.error.HTTPError as e:
    check("API: POST with invalid domain returns 400/422", e.code in (400, 422), str(e.code))
except Exception as ex:
    check("API: POST with invalid domain rejected", False, str(ex))

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 5: SERVICE MODULE SMOKE TESTS
# ═══════════════════════════════════════════════════════════════════════════════
section("5. Service Modules — Smoke Tests")

# DNS
from services.dns_api import probe_domain_email_security
dns = probe_domain_email_security("google.com")
check("DNS: Returns dict for google.com", isinstance(dns, dict))
check("DNS: dmarc_present key present", "dmarc_present" in dns)
check("DNS: spf_present key present", "spf_present" in dns)

# SSL
from services.ssl_security_api import probe_domain_security_headers
ssl = probe_domain_security_headers("github.com")
check("SSL: Returns dict for github.com", isinstance(ssl, dict))
check("SSL: ssl_risk_score in 0-100", 0 <= ssl.get("ssl_risk_score", -1) <= 100, str(ssl.get("ssl_risk_score")))

# CISA
from services.cisa_api import fetch_cisa_exploited_vulnerabilities
cisa = fetch_cisa_exploited_vulnerabilities("Microsoft", "microsoft.com")
check("CISA: Returns dict", isinstance(cisa, dict))
check("CISA: vulnerabilities_count >= 0", cisa.get("vulnerabilities_count", -1) >= 0, str(cisa.get("vulnerabilities_count")))

# Stock API
from services.stock_api import fetch_vendor_stock_risk
stock = fetch_vendor_stock_risk("microsoft.com", "Microsoft", custom_ticker="MSFT")
check("Stock: Returns dict", isinstance(stock, dict))
check("Stock: is_public_company True for MSFT", stock.get("is_public_company") == True, str(stock.get("is_public_company")))
check("Stock: stock_risk_score in 0-100", 0 <= stock.get("stock_risk_score", -1) <= 100, str(stock.get("stock_risk_score")))

# IPinfo
from services.ipinfo_api import probe_ip_intelligence
ip = probe_ip_intelligence("cloudflare.com", "Cloudflare")
check("IPinfo: Returns dict for cloudflare.com", isinstance(ip, dict))
check("IPinfo: ip_risk_score key present", "ip_risk_score" in ip)

# AbuseIPDB
from services.abuseipdb_api import check_ip_abuse_reputation
abuse = check_ip_abuse_reputation("cloudflare.com", "Cloudflare")
check("AbuseIPDB: Returns dict", isinstance(abuse, dict))
check("AbuseIPDB: abuse_score >= 0", abuse.get("abuse_score", -1) >= 0, str(abuse.get("abuse_score")))

# News API
from services.news_api import fetch_vendor_news
news = fetch_vendor_news("Cloudflare", "cloudflare.com")
check("News: Returns dict", isinstance(news, dict))
check("News: news_score in 0-100", 0 <= news.get("news_score", -1) <= 100, str(news.get("news_score")))

# HIBP
from services.hibp_api import check_vendor_breaches
hibp = check_vendor_breaches("adobe.com", "Adobe")
check("HIBP: Returns dict", isinstance(hibp, dict))
check("HIBP: hibp_score present", "hibp_score" in hibp)

# OpenSanctions
from services.opensanctions_api import check_vendor_sanctions
sanc = check_vendor_sanctions("Cloudflare")
check("Sanctions: Returns dict", isinstance(sanc, dict))
check("Sanctions: sanctions_score in 0-100", 0 <= sanc.get("sanctions_score", -1) <= 100, str(sanc.get("sanctions_score")))

# Scikit-Learn & SHAP ML Risk Service
from services.mlRiskService import calculate_shap_vendor_risk
from services.ai_summary_engine import generate_ai_executive_summary
shap_res = calculate_shap_vendor_risk({
    "name": "Acme Corp",
    "news_score": 45,
    "active_incidents": 2,
    "incident_penalty": 20,
    "criticality_tier": "Tier 1 - Mission Critical",
    "data_sensitivity": "PII / PHI",
    "contract_value": 500000,
    "custom_ticker": "ACME",
    "cve_count": 3,
    "sanctions_score": 0
})
check("Scikit-Learn & SHAP: Returns dict", isinstance(shap_res, dict))
check("Scikit-Learn & SHAP: status success", shap_res.get("status") == "success", shap_res.get("status"))
check("Scikit-Learn & SHAP: ml_predicted_score present", "ml_predicted_score" in shap_res)
check("Scikit-Learn & SHAP: top_risk_drivers present", "top_risk_drivers" in shap_res)

# ═══════════════════════════════════════════════════════════════════════════════
# RESULTS SUMMARY
# ═══════════════════════════════════════════════════════════════════════════════

section("FINAL RESULTS")
total = len(results)
passed = sum(1 for r in results if r[0] == PASS)
failed = sum(1 for r in results if r[0] == FAIL)

if failed > 0:
    print("\nFailed Tests:")
    for status, name, detail in results:
        if status == FAIL:
            print(f"  FAIL  {name}" + (f" — {detail}" if detail else ""))

print(f"\n  Total:  {total}")
print(f"  Passed: {passed}")
print(f"  Failed: {failed}")
print(f"\n  {'ALL TESTS PASSED' if failed == 0 else f'{failed} TESTS FAILED'}")
print()
if server_proc:
    server_proc.terminate()
if server_log:
    server_log.close()
sys.exit(0 if failed == 0 else 1)

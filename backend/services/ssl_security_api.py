import requests
from database import get_cached_response, set_cached_response

def probe_domain_security_headers(domain: str):
    cache_key = f"ssl_{domain.lower().replace('.', '_')}"
    cached = get_cached_response(cache_key)
    if cached:
        return cached

    url = f"https://{domain}"
    try:
        try:
            res = requests.get(url, timeout=5, allow_redirects=True, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) VendorRisk360/1.0"
            })
        except requests.exceptions.SSLError:
            # Fallback to HTTP if SSL handshake fails
            res = requests.get(f"http://{domain}", timeout=5, allow_redirects=True, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) VendorRisk360/1.0"
            })

        headers = res.headers

        missing_headers = []
        ssl_score = 0

        # Live Audit of Web Security Defense Headers
        if "Strict-Transport-Security" not in headers:
            missing_headers.append("Strict-Transport-Security (HSTS)")
            ssl_score += 30

        if "Content-Security-Policy" not in headers:
            missing_headers.append("Content-Security-Policy (CSP)")
            ssl_score += 30

        if "X-Frame-Options" not in headers and "frame-ancestors" not in headers.get("Content-Security-Policy", ""):
            missing_headers.append("X-Frame-Options (Clickjacking)")
            ssl_score += 20

        if "X-Content-Type-Options" not in headers:
            missing_headers.append("X-Content-Type-Options (MIME Sniffing)")
            ssl_score += 20

        result = {
            "source": f"Live HTTPS Header Probe ({url})",
            "ssl_risk_score": min(100, ssl_score),
            "missing_headers": missing_headers,
            "hsts_present": "Strict-Transport-Security" in headers,
            "csp_present": "Content-Security-Policy" in headers,
            "status_code": res.status_code,
            "status": "COMPLIANT" if not missing_headers else "MISSING_HEADERS"
        }
        set_cached_response(cache_key, result, ttl_minutes=120)
        return result
    except Exception as e:
        print(f"[Live SSL Probe Error for {domain}] {e}")
        return {
            "source": f"Live Probe Attempt Failed ({domain})",
            "ssl_risk_score": 50,
            "missing_headers": ["Connection Timeout / Domain Unreachable"],
            "hsts_present": False,
            "csp_present": False,
            "status_code": 0,
            "status": "UNREACHABLE"
        }

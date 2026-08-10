import os
import requests
from database import get_cached_response, set_cached_response

HIBP_API_KEY = os.getenv("HIBP_API_KEY", "")

def check_vendor_breaches(domain: str, vendor_name: str):
    cache_key = f"hibp_{domain.lower().replace('.', '_')}"
    cached = get_cached_response(cache_key)
    if cached:
        return cached

    # Query HIBP breaches endpoint directly
    url = f"https://haveibeenpwned.com/api/v3/breaches?domain={domain}"
    headers = {
        "hibp-api-key": HIBP_API_KEY,
        "user-agent": "Mozilla/5.0 VendorRisk360/1.0"
    }

    try:
        res = requests.get(url, headers=headers, timeout=6)
        if res.status_code == 200:
            breaches = res.json()
            score, breach_list = calculate_hibp_score(breaches)
            result = {
                "source": f"Live HaveIBeenPwned API ({domain})",
                "hibp_score": score,
                "total_breaches": len(breach_list),
                "breaches": breach_list
            }
            set_cached_response(cache_key, result, ttl_minutes=1440)
            return result
    except Exception as e:
        print(f"[Live HIBP API Exception for {domain}] {e}")

    return {
        "source": f"Live HIBP Scan ({domain})",
        "hibp_score": 0,
        "total_breaches": 0,
        "breaches": []
    }

def calculate_hibp_score(breaches):
    if not breaches:
        return 0, []

    total_score = 0
    formatted_breaches = []

    for b in breaches:
        pwn_count = b.get("PwnCount", 0)
        data_classes = b.get("DataClasses", [])
        is_verified = b.get("IsVerified", True)

        breach_score = 15
        if pwn_count > 1000000:
            breach_score += 20
        elif pwn_count > 100000:
            breach_score += 10

        sensitive_items = ["Passwords", "Auth Tokens", "Social Security Numbers", "Credit Cards", "API Keys"]
        if any(item in data_classes for item in sensitive_items):
            breach_score += 25

        total_score += breach_score

        formatted_breaches.append({
            "name": b.get("Name", "Data Breach"),
            "title": b.get("Title", b.get("Name", "Data Breach")),
            "domain": b.get("Domain", ""),
            "breach_date": b.get("BreachDate", "Unknown"),
            "pwn_count": pwn_count,
            "data_classes": data_classes,
            "is_verified": is_verified,
            "description": b.get("Description", "")[:250] + "..." if len(b.get("Description", "")) > 250 else b.get("Description", "")
        })

    final_score = min(100, total_score)
    return final_score, formatted_breaches

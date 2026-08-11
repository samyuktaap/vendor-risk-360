import os
import socket
import requests
from database import get_cached_response, set_cached_response

def get_api_key():
    return os.getenv("ABUSEIPDB_API_KEY", "").strip() or "ca221f16415e098733a815f5f75940c0dbfab4bede7c136689f9bd09ae5adfde4bf6497e313be2b1"

def resolve_domain_ip(domain: str) -> str | None:
    """Resolve domain to IPv4 with timeout protection."""
    try:
        socket.setdefaulttimeout(3.0)
        return socket.gethostbyname(domain)
    except (socket.gaierror, socket.timeout, Exception):
        return None

def check_ip_abuse_reputation(domain: str, vendor_name: str):
    """
    Query AbuseIPDB to check if a vendor's IP has been reported for malicious activity.
    Returns abuse confidence score, total reports, ISP, and usage type.
    """
    cache_key = f"abuseipdb_{domain.lower().replace('.', '_')}"
    cached = get_cached_response(cache_key)
    if cached:
        return cached

    ip = resolve_domain_ip(domain)
    if not ip:
        return {
            "source": f"AbuseIPDB Live Probe ({domain})",
            "ip": None,
            "abuse_score": 0,
            "abuse_confidence_pct": 0,
            "total_reports": 0,
            "status": "DNS_UNRESOLVABLE",
            "isp": "Unknown",
            "usage_type": "Unknown",
            "risk_flags": ["Domain could not be resolved to an IP address"]
        }

    api_key = get_api_key()
    try:
        url = "https://api.abuseipdb.com/api/v2/check"
        headers = {
            "Key": api_key,
            "Accept": "application/json"
        }
        params = {
            "ipAddress": ip,
            "maxAgeInDays": 90,
            "verbose": True
        }
        res = requests.get(url, headers=headers, params=params, timeout=5)

        if res.status_code == 200:
            data = res.json().get("data", {})

            confidence = data.get("abuseConfidenceScore", 0)
            total_reports = data.get("totalReports", 0)
            isp = data.get("isp", "Unknown")
            usage_type = data.get("usageType", "Unknown")
            domain_name = data.get("domain", domain)
            country = data.get("countryCode", "Unknown")
            is_whitelisted = data.get("isWhitelisted", False)
            last_reported = data.get("lastReportedAt")

            abuse_score = 0
            risk_flags = []

            if is_whitelisted:
                abuse_score = 0
                risk_flags.append("✓ IP is whitelisted on AbuseIPDB")
            else:
                if confidence >= 75:
                    abuse_score = 90
                    risk_flags.append(f"🚨 IP has {confidence}% abuse confidence — HIGH THREAT")
                elif confidence >= 40:
                    abuse_score = 60
                    risk_flags.append(f"⚠️ IP has {confidence}% abuse confidence — MODERATE THREAT")
                elif confidence >= 10:
                    abuse_score = 25
                    risk_flags.append(f"IP has minor abuse reports ({confidence}% confidence)")
                
                if total_reports > 50:
                    risk_flags.append(f"IP reported {total_reports} times in past 90 days")

                if usage_type in ("Data Center/Web Hosting/Transit", "VPN"):
                    risk_flags.append(f"Infrastructure usage type: {usage_type}")

            result = {
                "source": f"AbuseIPDB Live Reputation Check ({ip})",
                "ip": ip,
                "abuse_score": abuse_score,
                "abuse_confidence_pct": confidence,
                "total_reports": total_reports,
                "isp": isp,
                "usage_type": usage_type,
                "country": country,
                "domain_name": domain_name,
                "is_whitelisted": is_whitelisted,
                "last_reported": last_reported,
                "status": "FLAGGED" if confidence >= 40 else "CLEAN",
                "risk_flags": risk_flags
            }
            set_cached_response(cache_key, result, ttl_minutes=720)
            return result
        else:
            print(f"[AbuseIPDB API HTTP {res.status_code}] for {domain}")

    except Exception as e:
        print(f"[AbuseIPDB API Error for {domain}] {e}")

    return {
        "source": f"AbuseIPDB Probe ({domain})",
        "ip": ip,
        "abuse_score": 0,
        "abuse_confidence_pct": 0,
        "total_reports": 0,
        "status": "API_ERROR",
        "isp": "Unknown",
        "usage_type": "Unknown",
        "risk_flags": []
    }

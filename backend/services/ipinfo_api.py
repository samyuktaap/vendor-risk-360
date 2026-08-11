import os
import socket
import requests
from database import get_cached_response, set_cached_response

def get_api_key():
    return os.getenv("IPINFO_API_KEY", "").strip() or "620b2c73fa9ee1"

HIGH_RISK_COUNTRIES = {"CN", "RU", "KP", "IR", "BY", "SY", "CU"}
MEDIUM_RISK_COUNTRIES = {"VN", "PK", "NG", "BD"}
TRUSTED_ASNS = {"AS15169", "AS8075", "AS16509", "AS13335", "AS54113", "AS20940"}

def resolve_domain_ip(domain: str) -> str | None:
    """Resolve a domain name to its primary IPv4 address with timeout protection."""
    try:
        socket.setdefaulttimeout(3.0)
        return socket.gethostbyname(domain)
    except (socket.gaierror, socket.timeout, Exception):
        return None

def probe_ip_intelligence(domain: str, vendor_name: str):
    """
    Query IPinfo API for live IP intelligence on a vendor's domain.
    Returns hosting country, ASN, org, risk score, and network posture.
    """
    cache_key = f"ipinfo_{domain.lower().replace('.', '_')}"
    cached = get_cached_response(cache_key)
    if cached:
        return cached

    ip = resolve_domain_ip(domain)
    if not ip:
        return {
            "source": f"IPinfo Live Probe ({domain})",
            "ip": None,
            "status": "DNS_UNRESOLVABLE",
            "ip_risk_score": 0,
            "country": "Unknown",
            "asn": None,
            "org": None,
            "hosting": None,
            "risk_flags": ["Domain could not be resolved to an IP address"]
        }

    api_key = get_api_key()
    try:
        url = f"https://ipinfo.io/{ip}/json"
        headers = {"Authorization": f"Bearer {api_key}"}
        res = requests.get(url, headers=headers, timeout=5)

        if res.status_code == 200:
            data = res.json()

            country = data.get("country", "Unknown")
            org = data.get("org", "") or ""
            parts = org.split(" ") if org else []
            asn = parts[0] if len(parts) > 0 and parts[0].startswith("AS") else None
            org_name = " ".join(parts[1:]) if len(parts) > 1 else (org or "Unknown")
            city = data.get("city", "")
            region = data.get("region", "")
            hostname = data.get("hostname", "")
            timezone = data.get("timezone", "")

            # Calculate IP-based risk score
            ip_risk_score = 0
            risk_flags = []

            if country in HIGH_RISK_COUNTRIES:
                ip_risk_score += 60
                risk_flags.append(f"⚠️ Infrastructure hosted in high-risk country ({country})")

            elif country in MEDIUM_RISK_COUNTRIES:
                ip_risk_score += 30
                risk_flags.append(f"Infrastructure hosted in elevated-risk region ({country})")

            if asn and asn not in TRUSTED_ASNS:
                ip_risk_score += 10
                risk_flags.append(f"Infrastructure on non-CDN/cloud ASN ({asn})")

            if "vpn" in org_name.lower() or "proxy" in org_name.lower() or "hosting" in org_name.lower():
                ip_risk_score += 15
                risk_flags.append(f"Vendor infrastructure running through VPN/proxy/hosting provider")

            ip_risk_score = min(100, ip_risk_score)

            result = {
                "source": f"IPinfo Live Network Intelligence (ipinfo.io/{ip})",
                "ip": ip,
                "status": "RESOLVED",
                "ip_risk_score": ip_risk_score,
                "country": country,
                "city": city,
                "region": region,
                "asn": asn,
                "org": org_name,
                "hostname": hostname,
                "timezone": timezone,
                "risk_flags": risk_flags,
                "is_trusted_cloud": asn in TRUSTED_ASNS,
                "is_high_risk_country": country in HIGH_RISK_COUNTRIES
            }
            set_cached_response(cache_key, result, ttl_minutes=1440)
            return result

    except Exception as e:
        print(f"[IPinfo API Error for {domain}] {e}")

    return {
        "source": f"IPinfo Live Probe ({domain})",
        "ip": ip,
        "status": "API_ERROR",
        "ip_risk_score": 0,
        "country": "Unknown",
        "asn": None,
        "org": None,
        "hostname": None,
        "risk_flags": []
    }

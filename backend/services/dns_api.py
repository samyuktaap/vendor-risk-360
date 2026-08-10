import socket
import requests
from database import get_cached_response, set_cached_response

def probe_domain_email_security(domain: str):
    cache_key = f"dns_{domain.lower().replace('.', '_')}"
    cached = get_cached_response(cache_key)
    if cached:
        return cached

    # Live DNS & TXT Record probe using Google Public DNS JSON API
    try:
        url = f"https://dns.google/resolve?name=_dmarc.{domain}&type=TXT"
        res = requests.get(url, timeout=5)
        dmarc_present = False
        dmarc_policy = "None"

        if res.status_code == 200:
            data = res.json()
            answers = data.get("Answer", [])
            for a in answers:
                txt = a.get("data", "")
                if "v=DMARC1" in txt:
                    dmarc_present = True
                    if "p=reject" in txt:
                        dmarc_policy = "Reject (Strict Enforcement)"
                    elif "p=quarantine" in txt:
                        dmarc_policy = "Quarantine"
                    else:
                        dmarc_policy = "None (Monitor Only)"

        # Probe SPF Record
        spf_url = f"https://dns.google/resolve?name={domain}&type=TXT"
        spf_res = requests.get(spf_url, timeout=5)
        spf_present = False

        if spf_res.status_code == 200:
            spf_data = spf_res.json()
            for a in spf_data.get("Answer", []):
                if "v=spf1" in a.get("data", ""):
                    spf_present = True
                    break

        result = {
            "source": f"Live DNS Email Security Audit (_dmarc.{domain})",
            "dmarc_present": dmarc_present,
            "dmarc_policy": dmarc_policy,
            "spf_present": spf_present,
            "email_security_status": "STRONG_PROTECTION" if dmarc_present and dmarc_policy != "None" else ("BASIC" if spf_present else "VULNERABLE")
        }
        set_cached_response(cache_key, result, ttl_minutes=1440)
        return result
    except Exception as e:
        print(f"[DNS Probe Error for {domain}] {e}")
        return {
            "source": f"Live DNS Probe Failed ({domain})",
            "dmarc_present": False,
            "dmarc_policy": "Unknown",
            "spf_present": False,
            "email_security_status": "UNCHECKED"
        }

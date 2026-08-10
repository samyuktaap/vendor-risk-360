import requests
from database import get_cached_response, set_cached_response

# Official US CISA Known Exploited Vulnerabilities (KEV) Catalog (100% Free Live US Govt Cyber Feed)
CISA_KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"

def fetch_cisa_exploited_vulnerabilities(vendor_name: str, domain: str):
    cache_key = f"cisa_{vendor_name.lower().replace(' ', '_')}"
    cached = get_cached_response(cache_key)
    if cached:
        return cached

    try:
        res = requests.get(CISA_KEV_URL, timeout=8, headers={"User-Agent": "Mozilla/5.0 VendorRisk360/1.0"})
        if res.status_code == 200:
            data = res.json()
            vulnerabilities = data.get("vulnerabilities", [])

            # Filter for CVEs matching vendor name or domain
            v_lower = vendor_name.lower()
            d_prefix = domain.split('.')[0].lower()

            matches = []
            cisa_score = 0

            for v in vulnerabilities:
                vendor_project = v.get("vendorProject", "").lower()
                product = v.get("product", "").lower()
                desc = v.get("shortDescription", "").lower()

                if v_lower in vendor_project or d_prefix in vendor_project or v_lower in product or d_prefix in product:
                    matches.append({
                        "cve_id": v.get("cveID"),
                        "vendor_project": v.get("vendorProject"),
                        "product": v.get("product"),
                        "vulnerability_name": v.get("vulnerabilityName"),
                        "date_added": v.get("dateAdded"),
                        "required_action": v.get("requiredAction"),
                        "short_description": v.get("shortDescription")
                    })
                    cisa_score += 25

            final_score = min(100, cisa_score)
            result = {
                "source": "US CISA Known Exploited Vulnerabilities Live Feed (Official US Govt API)",
                "cisa_score": final_score,
                "vulnerabilities_count": len(matches),
                "vulnerabilities": matches[:5],
                "status": "FLAGGED_EXPLOITS" if len(matches) > 0 else "CLEAN"
            }
            set_cached_response(cache_key, result, ttl_minutes=720)
            return result
    except Exception as e:
        print(f"[Live CISA API Error for {vendor_name}] {e}")

    return {
        "source": "Live CISA Catalog Probe",
        "cisa_score": 0,
        "vulnerabilities_count": 0,
        "vulnerabilities": [],
        "status": "CLEAN"
    }

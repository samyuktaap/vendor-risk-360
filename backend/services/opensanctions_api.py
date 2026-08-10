import requests
from database import get_cached_response, set_cached_response

def check_vendor_sanctions(vendor_name: str):
    cache_key = f"sanctions_{vendor_name.lower().replace(' ', '_')}"
    cached = get_cached_response(cache_key)
    if cached:
        return cached

    # Live query against OpenSanctions entity lookup
    try:
        url = "https://api.opensanctions.org/search/default"
        params = {"q": vendor_name, "limit": 5}
        res = requests.get(url, params=params, timeout=5, headers={"User-Agent": "Mozilla/5.0 VendorRisk360/1.0"})

        if res.status_code == 200:
            data = res.json()
            results = data.get("results", [])
            
            sanctions_score = 0
            matches = []

            for item in results:
                score = item.get("score", 0)
                caption = item.get("caption", "")
                topics = item.get("topics", [])
                
                if score > 0.65:
                    sanctions_score = 100 if ("sanction" in topics or "export.control" in topics) else 50
                    matches.append({
                        "entity": caption,
                        "schema": item.get("schema", "Company"),
                        "topics": topics,
                        "dataset": item.get("dataset", "OpenSanctions Dataset"),
                        "match_score": round(score * 100, 1),
                        "severity": "CRITICAL" if sanctions_score == 100 else "MEDIUM"
                    })

            result = {
                "source": "Live OpenSanctions Watchlist Scan",
                "sanctions_score": sanctions_score,
                "has_sanctions_hit": len(matches) > 0,
                "matches": matches,
                "status": "FLAGGED" if matches else "CLEAR"
            }
            set_cached_response(cache_key, result, ttl_minutes=120)
            return result
    except Exception as e:
        print(f"[Live Sanctions API Exception for {vendor_name}] {e}")

    return {
        "source": "Live Sanctions Scan (No Hits)",
        "sanctions_score": 0,
        "has_sanctions_hit": False,
        "matches": [],
        "status": "CLEAR"
    }

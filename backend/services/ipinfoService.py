import os
import requests
from typing import Dict, Any

def check_ipinfo(ip: str) -> Dict[str, Any]:
    if not ip:
        return {"status": "Not Available"}

    api_token = os.getenv("IPINFO_TOKEN")
    if not api_token:
        return {"status": "Unavailable", "error": "API Key not configured"}

    url = f"https://ipinfo.io/{ip}/json"
    headers = {
        "Authorization": f"Bearer {api_token}",
        "Accept": "application/json"
    }
    
    result = {
        "status": "Available",
        "ip": ip,
        "city": None,
        "region": None,
        "country": None,
        "organization": None,
        "asn": None,
        "hostname": None,
        "privacy": {}
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            result["city"] = data.get("city")
            result["region"] = data.get("region")
            result["country"] = data.get("country")
            org_str = data.get("org", "")
            if org_str:
                parts = org_str.split(" ", 1)
                if len(parts) > 1 and parts[0].startswith("AS"):
                    result["asn"] = parts[0]
                    result["organization"] = parts[1]
                else:
                    result["organization"] = org_str
            result["hostname"] = data.get("hostname")
            result["privacy"] = data.get("privacy", {})
        elif response.status_code == 429:
            result["status"] = "Rate Limited"
        else:
            result["status"] = "Unavailable"
            result["error"] = f"API Error: {response.status_code}"
            
    except requests.exceptions.Timeout:
        result["status"] = "Timeout"
    except Exception as e:
        result["status"] = "Unavailable"
        result["error"] = str(e)
        
    return result

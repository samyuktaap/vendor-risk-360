import os
import requests
from typing import Dict, Any

def check_abuseipdb(ip: str) -> Dict[str, Any]:
    if not ip:
        return {"status": "Not Available"}

    api_key = os.getenv("ABUSEIPDB_API_KEY")
    if not api_key:
        return {"status": "Unavailable", "error": "API Key not configured"}

    url = "https://api.abuseipdb.com/api/v2/check"
    headers = {
        "Key": api_key,
        "Accept": "application/json"
    }
    params = {
        "ipAddress": ip,
        "maxAgeInDays": 90
    }
    
    result = {
        "status": "Available",
        "ipAddress": ip,
        "abuseConfidenceScore": 0,
        "totalReports": 0,
        "lastReportedAt": None,
        "countryCode": None,
        "isp": None,
        "domain": None,
        "usageType": None
    }
    
    try:
        response = requests.get(url, headers=headers, params=params, timeout=10)
        if response.status_code == 200:
            data = response.json().get("data", {})
            result["abuseConfidenceScore"] = data.get("abuseConfidenceScore", 0)
            result["totalReports"] = data.get("totalReports", 0)
            result["lastReportedAt"] = data.get("lastReportedAt")
            result["countryCode"] = data.get("countryCode")
            result["isp"] = data.get("isp")
            result["domain"] = data.get("domain")
            result["usageType"] = data.get("usageType")
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

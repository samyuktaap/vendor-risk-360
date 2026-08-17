import requests
from typing import Dict, Any
import urllib.parse

def check_xposedornot(email: str) -> Dict[str, Any]:
    if not email:
        return {"status": "Not Available"}

    # Encode the email
    safe_email = urllib.parse.quote(email)
    url = f"https://api.xposedornot.com/v1/check-email/{safe_email}"
    
    result = {
        "status": "Available",
        "breach_status": "Clean",
        "number_of_breaches": 0,
        "breach_names": [],
        "exposed_information": []
    }
    
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            breaches = data.get("breaches")
            if isinstance(breaches, list) and breaches and isinstance(breaches[0], list):
                breaches = breaches[0]
            if breaches and isinstance(breaches, list):
                result["breach_status"] = "Breached"
                result["number_of_breaches"] = len(breaches)
                result["breach_names"] = breaches
        elif response.status_code == 404:
            # 404 means email not found in breaches (Clean)
            pass
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

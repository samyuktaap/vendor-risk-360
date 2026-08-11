import os
import requests
from typing import Dict, Any

def check_opensanctions(name: str, country: str = None) -> Dict[str, Any]:
    api_key = os.getenv("OPENSANCTIONS_API_KEY")
    url = "https://api.opensanctions.org/match/default"
    headers = {"Accept": "application/json"}
    if api_key:
        headers["Authorization"] = f"ApiKey {api_key}"

    payload = {
        "queries": {
            "q1": {
                "schema": "Company",
                "properties": {
                    "name": [name]
                }
            }
        }
    }
    if country:
        payload["queries"]["q1"]["properties"]["country"] = [country]

    result = {
        "status": "Available",
        "match_status": "No Match",
        "matched_entity": None,
        "dataset": [],
        "sanctions_info": [],
        "match_confidence": 0.0
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=10)
        if response.status_code == 200:
            data = response.json()
            responses = data.get("responses", {}).get("q1", {})
            results = responses.get("results", [])
            
            if results:
                best_match = results[0]
                result["match_confidence"] = best_match.get("score", 0.0)
                
                if result["match_confidence"] > 0.8:
                    result["match_status"] = "Confirmed Match"
                elif result["match_confidence"] > 0.5:
                    result["match_status"] = "Potential Match — Manual Review Required"
                
                if result["match_status"] != "No Match":
                    result["matched_entity"] = best_match.get("caption")
                    result["dataset"] = best_match.get("datasets", [])
                    properties = best_match.get("properties", {})
                    topics = properties.get("topics", [])
                    result["sanctions_info"] = topics
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

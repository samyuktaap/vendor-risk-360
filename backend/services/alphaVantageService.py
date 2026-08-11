import os
import requests
from typing import Dict, Any

def check_alphavantage(ticker: str) -> Dict[str, Any]:
    if not ticker:
        return {"status": "Not Available"}

    api_key = os.getenv("ALPHA_VANTAGE_API_KEY")
    if not api_key:
        return {"status": "Unavailable", "error": "API Key not configured"}

    url = f"https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol={ticker}&apikey={api_key}"
    
    result = {
        "status": "Available",
        "ticker": ticker,
        "current_price": 0.0,
        "change_pct": 0.0,
        "volume": 0
    }
    
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            quote = data.get("Global Quote", {})
            if quote:
                result["current_price"] = float(quote.get("05. price", 0))
                change = quote.get("10. change percent", "0%")
                result["change_pct"] = float(change.replace("%", ""))
                result["volume"] = int(quote.get("06. volume", 0))
            else:
                if data.get("Note") or data.get("Information"):
                    result["status"] = "Rate Limited"
                else:
                    result["status"] = "Financial Market Data Not Available"
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

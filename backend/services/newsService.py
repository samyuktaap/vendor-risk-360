import os
import requests
from typing import Dict, Any
from urllib.parse import quote

def check_news(company_name: str) -> Dict[str, Any]:
    api_key = os.getenv("NEWS_API_KEY")
    if not api_key:
        return {"status": "Unavailable", "error": "API Key not configured"}

    q = f'"{company_name}" AND (cybersecurity OR breach OR lawsuit OR fraud OR "security incident")'
    url = f"https://newsapi.org/v2/everything?q={quote(q)}&language=en&sortBy=publishedAt&pageSize=5"
    headers = {"X-Api-Key": api_key}
    
    result = {
        "status": "Available",
        "articles": []
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            articles = data.get("articles", [])
            for a in articles:
                result["articles"].append({
                    "title": a.get("title"),
                    "source": a.get("source", {}).get("name"),
                    "publication_date": a.get("publishedAt"),
                    "url": a.get("url"),
                    "description": a.get("description")
                })
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

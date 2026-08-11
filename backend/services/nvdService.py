import os
import requests
from typing import Dict, Any

def check_nvd_vulnerabilities(software: str) -> Dict[str, Any]:
    if not software:
        return {"status": "Not Available"}

    api_key = os.getenv("NVD_API_KEY")
    # NVD API works without a key but is rate-limited. We'll send it if available.
    headers = {}
    if api_key:
        headers["apiKey"] = api_key

    # Search CVEs by keyword (software)
    url = "https://services.nvd.nist.gov/rest/json/cves/2.0"
    params = {
        "keywordSearch": software,
        "resultsPerPage": 20
    }
    
    result = {
        "status": "Available",
        "cves": [],
        "cve_count": 0,
        "critical_count": 0,
        "high_count": 0,
        "medium_count": 0,
        "low_count": 0
    }
    
    try:
        response = requests.get(url, headers=headers, params=params, timeout=15)
        if response.status_code == 200:
            data = response.json()
            vulnerabilities = data.get("vulnerabilities", [])
            result["cve_count"] = len(vulnerabilities)
            
            for v in vulnerabilities:
                cve = v.get("cve", {})
                cve_id = cve.get("id")
                descriptions = cve.get("descriptions", [])
                desc = descriptions[0].get("value") if descriptions else "No description"
                
                metrics = cve.get("metrics", {})
                cvss_data = metrics.get("cvssMetricV31", metrics.get("cvssMetricV30", metrics.get("cvssMetricV2", [])))
                
                severity = "UNKNOWN"
                cvss_score = 0
                if cvss_data and len(cvss_data) > 0:
                    cvss = cvss_data[0].get("cvssData", {})
                    severity = cvss.get("baseSeverity", cvss_data[0].get("baseSeverity", "UNKNOWN")).upper()
                    cvss_score = cvss.get("baseScore", 0)
                
                # Categorize vulnerabilities
                if severity == "CRITICAL" or cvss_score >= 9.0:
                    result["critical_count"] += 1
                elif severity == "HIGH" or cvss_score >= 7.0:
                    result["high_count"] += 1
                elif severity == "MEDIUM" or cvss_score >= 4.0:
                    result["medium_count"] += 1
                elif severity == "LOW" or cvss_score > 0:
                    result["low_count"] += 1
                    
                result["cves"].append({
                    "cve_id": cve_id,
                    "description": desc,
                    "severity": severity,
                    "cvss_score": cvss_score,
                    "published": cve.get("published"),
                    "last_modified": cve.get("lastModified")
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

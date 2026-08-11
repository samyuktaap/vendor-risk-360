import os
import requests
from typing import Dict, Any

def check_virustotal(domain: str, ip: str = None) -> Dict[str, Any]:
    api_key = os.getenv("VIRUSTOTAL_API_KEY")
    if not api_key:
        return {"status": "Unavailable", "error": "API Key not configured"}

    headers = {"x-apikey": api_key, "accept": "application/json"}
    
    result = {
        "status": "Available",
        "malicious_detections": 0,
        "suspicious_detections": 0,
        "harmless_detections": 0,
        "reputation": 0,
        "analysis_status": "completed",
        "relevant_security_findings": []
    }
    
    try:
        # Check domain
        url = f"https://www.virustotal.com/api/v3/domains/{domain}"
        response = requests.get(url, headers=headers, timeout=10)
        domain_status = response.status_code
        if domain_status == 200:
            data = response.json().get("data", {}).get("attributes", {})
            stats = data.get("last_analysis_stats", {})
            result["malicious_detections"] += stats.get("malicious", 0)
            result["suspicious_detections"] += stats.get("suspicious", 0)
            result["harmless_detections"] += stats.get("harmless", 0)
            result["reputation"] += data.get("reputation", 0)
            
            for engine, res in data.get("last_analysis_results", {}).items():
                if res.get("category") in ["malicious", "suspicious"]:
                    result["relevant_security_findings"].append(f"Domain flagged by {engine}: {res.get('result')}")
        elif domain_status == 429:
            result["status"] = "Rate Limited"
            return result
                    
        # Check IP if provided
        ip_status = None
        if ip:
            url_ip = f"https://www.virustotal.com/api/v3/ip_addresses/{ip}"
            response_ip = requests.get(url_ip, headers=headers, timeout=10)
            ip_status = response_ip.status_code
            if ip_status == 200:
                data_ip = response_ip.json().get("data", {}).get("attributes", {})
                stats_ip = data_ip.get("last_analysis_stats", {})
                result["malicious_detections"] += stats_ip.get("malicious", 0)
                result["suspicious_detections"] += stats_ip.get("suspicious", 0)
                result["harmless_detections"] += stats_ip.get("harmless", 0)
                result["reputation"] += data_ip.get("reputation", 0)
                
                for engine, res in data_ip.get("last_analysis_results", {}).items():
                    if res.get("category") in ["malicious", "suspicious"]:
                        result["relevant_security_findings"].append(f"IP flagged by {engine}: {res.get('result')}")
            elif ip_status == 429:
                result["status"] = "Rate Limited"
                return result
                        
        if domain_status != 200 and ip_status != 200:
            result["status"] = "Unavailable"
            
    except requests.exceptions.Timeout:
        result["status"] = "Timeout"
    except Exception as e:
        result["status"] = "Unavailable"
        result["error"] = str(e)
        
    return result

import os
import requests
import json
from typing import Dict, Any

def generate_risk_analysis(vendor_name: str, normalized_data: Dict[str, Any]) -> Dict[str, Any]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return {
            "summary": "OpenAI API key not configured. Cannot generate analysis.",
            "keyRisks": [],
            "recommendations": [],
            "dueDiligenceQuestions": []
        }

    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    prompt = f"""
You are an expert cybersecurity risk analyst. Analyze the following normalized evidence for the vendor "{vendor_name}" and produce a JSON response. 
Use only the supplied evidence. If information is missing, say that it is unavailable. Do not fabricate vulnerabilities, breaches, sanctions, financial information, or news.

Normalized Evidence:
{json.dumps(normalized_data, indent=2)}

Provide the output in the exact JSON structure below, without markdown blocks, just the raw JSON:
{{
  "summary": "Executive summary of the vendor's risk profile (string)",
  "keyRisks": ["List of key risk factors (strings)"],
  "recommendations": ["List of recommended actions (strings)"],
  "dueDiligenceQuestions": ["List of questions for vendor due diligence (strings)"]
}}
"""
    
    payload = {
        "model": "gpt-4-turbo-preview",
        "messages": [
            {"role": "system", "content": "You are an expert cybersecurity risk analyst. Output only JSON."},
            {"role": "user", "content": prompt}
        ],
        "response_format": {"type": "json_object"}
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=20)
        if response.status_code == 200:
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            return json.loads(content)
        else:
            return {
                "summary": f"Failed to generate analysis (Status {response.status_code})",
                "keyRisks": [],
                "recommendations": [],
                "dueDiligenceQuestions": []
            }
    except Exception as e:
        return {
            "summary": f"Error generating analysis: {str(e)}",
            "keyRisks": [],
            "recommendations": [],
            "dueDiligenceQuestions": []
        }

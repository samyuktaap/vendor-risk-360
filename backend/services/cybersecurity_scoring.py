"""
cybersecurity_scoring.py — Deterministic Cybersecurity 360° Risk Scoring Engine.

SCORING MODEL SPECIFICATION (Version 1.0):
  - Scale: 0 to 100 (where 0 = Safe / Lowest Risk, 100 = Critical Risk).
  - Calculated hierarchically: Question Risk Penalty → Domain Risk Score (0-100) → Composite Weighted Score (0-100).
  - Versioned and immutable for historical auditing.
"""

from typing import List, Dict, Any
from services.cybersecurity_catalog import QUESTIONS_CATALOG, CYBERSECURITY_DOMAINS, get_question_by_id

SCORING_VERSION = "1.0"

def calculate_cybersecurity_score(answers: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Computes deterministic 0-100 Cybersecurity Risk Score and domain breakdowns.
    
    answers list items:
      - question_id: str
      - answer_value: str ("YES", "NO", option_value, text)
      - evidence_status: str ("MISSING", "PRESENT", "REVIEWED", "REJECTED")
    """
    answers_map = {a["question_id"]: a for a in answers}
    
    domain_totals: Dict[str, Dict[str, float]] = {
        d["id"]: {"accumulated_risk_points": 0.0, "total_max_weight": 0.0, "question_count": 0}
        for d in CYBERSECURITY_DOMAINS
    }
    
    for q in QUESTIONS_CATALOG:
        q_id = q["question_id"]
        domain = q["domain"]
        weight = q["weight"]
        
        if domain not in domain_totals:
            continue
            
        domain_totals[domain]["total_max_weight"] += weight
        domain_totals[domain]["question_count"] += 1
        
        ans = answers_map.get(q_id)
        if not ans:
            # Unanswered question incurs maximum risk weight
            domain_totals[domain]["accumulated_risk_points"] += (1.0 * weight)
            continue
            
        ans_val = str(ans.get("answer_value", "")).strip().upper()
        ev_status = str(ans.get("evidence_status", "MISSING")).strip().upper()
        
        risk_factor = 0.0
        
        if q["response_type"] == "YES_NO":
            if ans_val == "YES":
                risk_factor = 0.0
            elif ans_val == "NO":
                risk_factor = 1.0
            else:
                risk_factor = 0.8  # Partial/unknown penalty
        elif q["response_type"] == "MULTIPLE_CHOICE":
            options = q.get("options") or []
            matched = False
            for opt in options:
                if opt["value"].upper() == ans_val:
                    risk_factor = opt["risk_factor"]
                    matched = True
                    break
            if not matched:
                risk_factor = 0.5
        elif q["response_type"] == "TEXT":
            risk_factor = 0.0 if len(ans_val) > 5 else 0.5
            
        # Evidence Penalty: If evidence is required but MISSING or REJECTED
        if q.get("evidence_required"):
            if ev_status == "REJECTED":
                risk_factor = min(1.0, risk_factor + 0.3)
            elif ev_status == "MISSING":
                risk_factor = min(1.0, risk_factor + 0.2)
                
        domain_totals[domain]["accumulated_risk_points"] += (risk_factor * weight)
        
    domain_scores: Dict[str, Dict[str, Any]] = {}
    total_weighted_points = 0.0
    total_weights = 0.0
    
    for d in CYBERSECURITY_DOMAINS:
        d_id = d["id"]
        t = domain_totals[d_id]
        max_w = t["total_max_weight"]
        acc_p = t["accumulated_risk_points"]
        
        domain_risk_score = round((acc_p / max_w * 100.0), 1) if max_w > 0 else 0.0
        domain_risk_score = max(0.0, min(100.0, domain_risk_score))
        
        domain_scores[d_id] = {
            "title": d["title"],
            "score": domain_risk_score,
            "accumulated_points": acc_p,
            "max_weight": max_w
        }
        
        total_weighted_points += acc_p
        total_weights += max_w
        
    overall_cybersecurity_score = round((total_weighted_points / total_weights * 100.0), 1) if total_weights > 0 else 0.0
    overall_cybersecurity_score = max(0.0, min(100.0, overall_cybersecurity_score))
    
    if overall_cybersecurity_score >= 70:
        risk_level = "CRITICAL"
    elif overall_cybersecurity_score >= 40:
        risk_level = "WATCH"
    else:
        risk_level = "SAFE"
        
    return {
        "scoring_version": SCORING_VERSION,
        "cybersecurity_score": overall_cybersecurity_score,
        "risk_level": risk_level,
        "domain_scores": domain_scores
    }

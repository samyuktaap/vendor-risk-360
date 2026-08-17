"""
vendor_tiering_service.py — Deterministic Risk-Based Vendor Tiering and Trend Analysis Service.

Evaluates vendor risk tiering policy (Version 1.0) and calculates historical risk score
progression, score deltas, and trend directions.
"""

from __future__ import annotations

from typing import Dict, List, Any, Optional
from datetime import datetime, UTC

TIERING_VERSION = "v1"

VALID_TIERS = {
    "TIER_1_CRITICAL",
    "TIER_2_HIGH",
    "TIER_3_MEDIUM",
    "TIER_4_LOW"
}

TIER_LABELS = {
    "TIER_1_CRITICAL": "TIER 1 — CRITICAL",
    "TIER_2_HIGH": "TIER 2 — HIGH",
    "TIER_3_MEDIUM": "TIER 3 — MEDIUM",
    "TIER_4_LOW": "TIER 4 — LOW"
}

def calculate_vendor_tier(vendor_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Deterministically computes a vendor's calculated risk tier and rationale list.
    
    Inputs considered:
      - risk_score (0–100)
      - criticality_tier / criticality (e.g. 'Tier 1 - Mission Critical', 'Tier 2 - Business Operational', 'Tier 3 - Non-Critical')
      - data_sensitivity / data_handled (e.g. 'Highly Confidential / Regulated PII', 'Confidential / Internal Data', 'Public Data')
      - contract_value (annual spend / business exposure)
      - incident_penalty / active_incidents
    
    Policy Rules (Version 1.0):
      TIER 1 — CRITICAL:
        - Criticality Tier 1 AND risk_score >= 40
        - OR risk_score >= 70 (Severe risk exposure)
        - OR Highly Confidential PII AND risk_score >= 50
        - OR Contract Value >= $1,000,000 AND risk_score >= 50
      
      TIER 2 — HIGH:
        - Criticality Tier 1 (even with moderate risk < 40)
        - OR Criticality Tier 2 AND risk_score >= 40
        - OR risk_score >= 40
        - OR Confidential Data AND risk_score >= 30
      
      TIER 3 — MEDIUM:
        - risk_score >= 20
        - OR Criticality Tier 2 (Business Operational)
        - OR Confidential / Internal Data
      
      TIER 4 — LOW:
        - Default for low criticality, public data, and risk_score < 20
    """
    risk_score = float(vendor_data.get("risk_score") or 0.0)
    criticality = str(vendor_data.get("criticality_tier") or vendor_data.get("criticality") or "Tier 2 - Business Operational")
    data_sens = str(vendor_data.get("data_sensitivity") or vendor_data.get("data_handled") or "Public Data")
    contract_val = int(vendor_data.get("contract_value") or 0)
    
    crit_lower = criticality.lower()
    is_crit_tier1 = "tier 1" in crit_lower or "mission critical" in crit_lower or (("critical" in crit_lower) and ("non-critical" not in crit_lower and "non_critical" not in crit_lower))
    is_crit_tier2 = "tier 2" in crit_lower or "operational" in crit_lower or (("medium" in crit_lower or "high" in crit_lower) and "non-critical" not in crit_lower)
    
    is_data_high = any(k in data_sens.lower() for k in ("highly confidential", "pii", "regulated", "sensitive", "financial"))
    is_data_med = any(k in data_sens.lower() for k in ("confidential", "internal", "proprietary"))
    
    rationale = []
    
    # 1. Evaluate TIER 1 - CRITICAL
    if (is_crit_tier1 and risk_score >= 40.0) or (risk_score >= 70.0) or (is_data_high and risk_score >= 50.0) or (contract_val >= 1000000 and risk_score >= 50.0):
        tier = "TIER_1_CRITICAL"
        if risk_score >= 70.0:
            rationale.append(f"Overall Risk Score ({int(risk_score)}/100) indicates severe third-party risk exposure.")
        if is_crit_tier1:
            rationale.append(f"Vendor Criticality is classified as Mission Critical ({criticality}).")
        if is_data_high:
            rationale.append(f"Vendor handles sensitive/regulated assets ({data_sens}).")
        if contract_val >= 1000000:
            rationale.append(f"High financial engagement (${contract_val:,} contract exposure).")
            
    # 2. Evaluate TIER 2 - HIGH
    elif is_crit_tier1 or (is_crit_tier2 and risk_score >= 40.0) or (risk_score >= 40.0) or (is_data_high and risk_score >= 30.0) or (is_data_med and risk_score >= 30.0):
        tier = "TIER_2_HIGH"
        if is_crit_tier1:
            rationale.append(f"Vendor Criticality is classified as Mission Critical ({criticality}).")
        if risk_score >= 40.0:
            rationale.append(f"Elevated Overall Risk Score ({int(risk_score)}/100).")
        if is_crit_tier2:
            rationale.append(f"Operational Criticality classification ({criticality}).")
        if is_data_high or is_data_med:
            rationale.append(f"Access to confidential business or customer data ({data_sens}).")
            
    # 3. Evaluate TIER 3 - MEDIUM
    elif risk_score >= 20.0 or is_crit_tier2 or is_data_med:
        tier = "TIER_3_MEDIUM"
        if risk_score >= 20.0:
            rationale.append(f"Moderate Risk Score ({int(risk_score)}/100).")
        if is_crit_tier2:
            rationale.append(f"Operational vendor role ({criticality}).")
        if is_data_med:
            rationale.append(f"Internal data access ({data_sens}).")
            
    # 4. TIER 4 - LOW
    else:
        tier = "TIER_4_LOW"
        rationale.append(f"Low Risk Score ({int(risk_score)}/100).")
        rationale.append(f"Non-critical classification ({criticality}).")
        rationale.append(f"Public / non-sensitive data exposure ({data_sens}).")
        
    return {
        "tiering_version": TIERING_VERSION,
        "calculated_tier": tier,
        "tier_label": TIER_LABELS.get(tier, tier),
        "rationale": rationale,
        "evaluated_at": datetime.now(UTC).isoformat()
    }

def calculate_risk_trend(history_records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Computes risk score change amount, percentage, and trend direction from real historical records.
    
    Trend states:
      - IMPROVING: Score decreased by >= 3.0 points (lower risk is better)
      - WORSENING: Score increased by >= 3.0 points (higher risk is worse)
      - STABLE: Score change between -3.0 and +3.0 points
      - NO_HISTORY: Fewer than 2 historical assessment records available
    """
    if not history_records or len(history_records) == 0:
        return {
            "trend_state": "NO_HISTORY",
            "trend_direction": "NO_HISTORY",
            "previous_score": None,
            "current_score": None,
            "score_delta": 0.0,
            "change_percentage": 0.0,
            "history_points": [],
            "message": "No historical risk data."
        }
        
    sorted_records = sorted(history_records, key=lambda x: x.get("calculated_at", ""))
    history_points = [
        {
            "id": r.get("id"),
            "score": float(r.get("score") or r.get("total_score") or 0.0),
            "calculated_at": r.get("calculated_at"),
            "score_type": r.get("score_type", "OVERALL"),
            "calculated_tier": r.get("calculated_tier")
        }
        for r in sorted_records
    ]
    
    if len(history_points) < 2:
        return {
            "trend_state": "NO_HISTORY",
            "trend_direction": "NO_HISTORY",
            "previous_score": None,
            "current_score": history_points[-1]["score"],
            "score_delta": 0.0,
            "change_percentage": 0.0,
            "history_points": history_points,
            "message": "Not enough history for trend analysis."
        }
        
    previous = history_points[-2]["score"]
    current = history_points[-1]["score"]
    delta = round(current - previous, 1)
    
    prev_base = max(previous, 1.0)
    change_pct = round(((current - previous) / prev_base) * 100.0, 1)
    
    if delta <= -3.0:
        trend_direction = "IMPROVING"
    elif delta >= 3.0:
        trend_direction = "WORSENING"
    else:
        trend_direction = "STABLE"
        
    return {
        "trend_state": trend_direction,
        "trend_direction": trend_direction,
        "previous_score": previous,
        "current_score": current,
        "score_delta": delta,
        "change_percentage": change_pct,
        "history_points": history_points,
        "message": None
    }

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
import shap
import logging

logger = logging.getLogger(__name__)

FEATURE_NAMES = [
    'news_sentiment_risk',
    'active_incidents',
    'incident_penalty',
    'criticality_tier_num',
    'data_sensitivity_num',
    'contract_value_k',
    'stock_volatility_risk',
    'cve_vulnerabilities',
    'sanctions_flag'
]

FEATURE_LABELS = {
    'news_sentiment_risk': 'Adverse News Sentiment',
    'active_incidents': 'Active Security Incidents',
    'incident_penalty': 'Historical Breach Penalty',
    'criticality_tier_num': 'System Criticality Tier',
    'data_sensitivity_num': 'Data Sensitivity Level',
    'contract_value_k': 'Annual Contract Exposure ($K)',
    'stock_volatility_risk': 'Market Financial Volatility',
    'cve_vulnerabilities': 'Known NVD Vulnerabilities',
    'sanctions_flag': 'Watchlist / Sanctions Indicator'
}

# Global singleton ML model & SHAP explainer
_model = None
_explainer = None

def _initialize_ml_model():
    global _model, _explainer
    if _model is not None:
        return

    try:
        logger.info("Training Scikit-Learn RandomForest Risk Model...")
        np.random.seed(42)
        n_samples = 500

        # Generate realistic training features
        news = np.random.uniform(0, 100, n_samples)
        incidents = np.random.poisson(0.8, n_samples)
        penalty = incidents * np.random.uniform(10, 25, n_samples)
        tier = np.random.choice([1, 2, 3], size=n_samples, p=[0.3, 0.5, 0.2])
        sensitivity = np.random.choice([1, 2, 3, 4], size=n_samples, p=[0.2, 0.4, 0.3, 0.1])
        contract_k = np.random.exponential(250, n_samples)
        stock_vol = np.random.uniform(0, 50, n_samples)
        cves = np.random.poisson(1.5, n_samples)
        sanctions = np.random.choice([0, 1], size=n_samples, p=[0.92, 0.08])

        X_train = np.column_stack([
            news, incidents, penalty, tier, sensitivity, contract_k, stock_vol, cves, sanctions
        ])

        # Ground truth target formula with non-linear interactions
        y_train = (
            0.35 * news +
            18.0 * incidents +
            0.6 * penalty +
            12.0 * (4 - tier) +
            8.0 * sensitivity +
            0.02 * np.sqrt(contract_k) +
            0.4 * stock_vol +
            6.5 * cves +
            35.0 * sanctions
        )
        y_train = np.clip(y_train + np.random.normal(0, 3, n_samples), 0, 100)

        # Train Random Forest Regressor
        rf = RandomForestRegressor(n_estimators=80, max_depth=6, random_state=42)
        rf.fit(X_train, y_train)

        # Initialize SHAP TreeExplainer
        explainer = shap.TreeExplainer(rf)

        _model = rf
        _explainer = explainer
        logger.info("Scikit-Learn ML Model & SHAP Explainer initialized successfully.")
    except Exception as e:
        logger.error(f"Error initializing ML SHAP model: {e}", exc_info=True)

def _extract_feature_vector(vendor: dict) -> np.ndarray:
    tier_map = {
        'Tier 1 - Mission Critical': 1,
        'Tier 2 - Business Operational': 2,
        'Tier 3 - Low Impact': 3
    }
    sensitivity_map = {
        'Public Data': 1,
        'Internal Data': 2,
        'Confidential IP': 3,
        'PII / PHI': 4,
        'PCI-DSS': 4
    }

    news_score = float(vendor.get('news_score', 15) or 15)
    active_incidents = int(vendor.get('active_incidents', 0) or 0)
    incident_penalty = float(vendor.get('incident_penalty', 0) or 0)
    tier_num = tier_map.get(vendor.get('criticality_tier'), 2)
    sensitivity_num = sensitivity_map.get(vendor.get('data_sensitivity'), 2)
    contract_k = float(vendor.get('contract_value', 50000) or 50000) / 1000.0
    stock_vol = 35.0 if vendor.get('custom_ticker') else 10.0
    cve_count = int(vendor.get('cve_count', 0) or 0)
    sanctions_flag = 1.0 if vendor.get('sanctions_score', 0) > 0 else 0.0

    return np.array([
        news_score,
        active_incidents,
        incident_penalty,
        tier_num,
        sensitivity_num,
        contract_k,
        stock_vol,
        cve_count,
        sanctions_flag
    ], dtype=np.float64)

def calculate_shap_vendor_risk(vendor: dict) -> dict:
    """
    Predicts vendor risk score using Scikit-Learn RandomForest and returns SHAP feature explanations.
    """
    _initialize_ml_model()
    if _model is None or _explainer is None:
        return {"status": "error", "message": "ML model unavailable"}

    try:
        feat_vec = _extract_feature_vector(vendor).reshape(1, -1)
        ml_score = float(_model.predict(feat_vec)[0])
        ml_score = round(max(0.0, min(100.0, ml_score)), 1)

        # Calculate SHAP values
        shap_values = _explainer.shap_values(feat_vec)
        if isinstance(shap_values, list):
            shap_vals = shap_values[0][0]
        else:
            shap_vals = shap_values[0]

        expected_value = float(_explainer.expected_value if not isinstance(_explainer.expected_value, np.ndarray) else _explainer.expected_value[0])

        feature_contributions = []
        for name, val, s_val in zip(FEATURE_NAMES, feat_vec[0], shap_vals):
            label = FEATURE_LABELS.get(name, name)
            s_val_rounded = round(float(s_val), 2)
            impact = "increase" if s_val_rounded > 0.5 else "decrease" if s_val_rounded < -0.5 else "neutral"
            feature_contributions.append({
                "feature_id": name,
                "label": label,
                "feature_value": round(float(val), 2),
                "shap_value": s_val_rounded,
                "impact": impact,
                "description": f"{label} {'adds +' if s_val_rounded > 0 else ''}{s_val_rounded} risk points"
            })

        # Sort by absolute SHAP impact magnitude
        feature_contributions.sort(key=lambda x: abs(x["shap_value"]), reverse=True)

        top_risk_drivers = [f for f in feature_contributions if f["shap_value"] > 0]
        protective_factors = [f for f in feature_contributions if f["shap_value"] < 0]

        return {
            "status": "success",
            "model": "Scikit-Learn RandomForest + SHAP Explainer",
            "ml_predicted_score": ml_score,
            "baseline_portfolio_risk": round(expected_value, 1),
            "top_risk_drivers": top_risk_drivers[:4],
            "protective_factors": protective_factors[:4],
            "all_shap_values": feature_contributions
        }
    except Exception as e:
        logger.error(f"Error computing SHAP values: {e}", exc_info=True)
        return {
            "status": "error",
            "message": str(e),
            "ml_predicted_score": vendor.get("risk_score", 30)
        }

import os
import requests
from database import get_cached_response, set_cached_response, record_api_call

VENDOR_TICKERS = {
    "okta.com": "OKTA",
    "crowdstrike.com": "CRWD",
    "snowflake.com": "SNOW",
    "slack.com": "CRM",
    "microsoft.com": "MSFT",
    "amazon.com": "AMZN",
    "google.com": "GOOGL",
    "datadoghq.com": "DDOG",
    "cloudflare.com": "NET",
    "paloaltonetworks.com": "PANW",
    "atlassian.com": "TEAM",
    "cisco.com": "CSCO"
}

def fetch_vendor_stock_risk(domain: str, vendor_name: str):
    ticker = VENDOR_TICKERS.get(domain.lower(), None)
    alpha_key = os.getenv("ALPHA_VANTAGE_API_KEY", "").strip()

    cache_key = f"stock_{domain.lower().replace('.', '_')}"
    cached = get_cached_response(cache_key)
    if cached:
        return cached

    if not ticker:
        return {
            "source": "Private / Unlisted Supplier",
            "ticker": None,
            "is_public_company": False,
            "current_price": None,
            "change_pct": 0.0,
            "stock_risk_score": 0,
            "status": "UNLISTED"
        }

    # 1. If Alpha Vantage API key is configured in .env, query Alpha Vantage
    if alpha_key:
        try:
            record_api_call("StockMarket")
            av_url = f"https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol={ticker}&apikey={alpha_key}"
            res = requests.get(av_url, timeout=5)
            if res.status_code == 200:
                quote = res.json().get("Global Quote", {})
                price = float(quote.get("05. price", 0))
                change_pct_str = quote.get("10. change percent", "0%").replace("%", "")
                change_pct = float(change_pct_str)
                result = {
                    "source": f"Alpha Vantage Live Market API (${ticker})",
                    "ticker": ticker,
                    "is_public_company": True,
                    "current_price": price,
                    "change_pct": change_pct,
                    "stock_risk_score": 65 if change_pct <= -4.0 else 0,
                    "status": "ELEVATED_VOLATILITY" if change_pct <= -4.0 else "STABLE"
                }
                set_cached_response(cache_key, result, ttl_minutes=15)
                return result
        except Exception as e:
            print(f"[Alpha Vantage Exception] {e}")

    # 2. Query Live Market Quote from Yahoo Finance Chart API
    try:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range=2d"
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) VendorRisk360/1.0"}
        res = requests.get(url, headers=headers, timeout=6)

        if res.status_code == 200:
            data = res.json()
            meta = data["chart"]["result"][0]["meta"]
            price = meta.get("regularMarketPrice", 0.0)
            prev = meta.get("chartPreviousClose") or meta.get("previousClose") or price

            change_pct = round(((price - prev) / prev) * 100, 2) if prev else 0.0

            stock_risk_score = 0
            if change_pct <= -8.0:
                stock_risk_score = 90
            elif change_pct <= -4.0:
                stock_risk_score = 65
            elif change_pct <= -1.5:
                stock_risk_score = 35
            elif change_pct >= 0:
                stock_risk_score = 0

            result = {
                "source": f"Yahoo Finance Live Ticker Feed (${ticker})",
                "ticker": ticker,
                "is_public_company": True,
                "current_price": price,
                "change_pct": change_pct,
                "stock_risk_score": stock_risk_score,
                "status": "ELEVATED_VOLATILITY" if change_pct <= -4.0 else "STABLE"
            }
            set_cached_response(cache_key, result, ttl_minutes=15)
            return result
    except Exception as e:
        print(f"[Live Stock API Error for {ticker}] {e}")

    return {
        "source": "Live Stock Stream Error",
        "ticker": ticker,
        "is_public_company": True,
        "current_price": 0.0,
        "change_pct": 0.0,
        "stock_risk_score": 0,
        "status": "ERROR"
    }

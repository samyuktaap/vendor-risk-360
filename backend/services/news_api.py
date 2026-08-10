import os
import requests
import xml.etree.ElementTree as ET
from datetime import datetime
from database import get_cached_response, set_cached_response, record_api_call

HIGH_RISK_KEYWORDS = ["ransomware", "zero-day", "exfiltrated", "critical flaw", "extortion", "compromised", "outage", "malware"]
MEDIUM_RISK_KEYWORDS = ["data leak", "breached", "unauthorized access", "vulnerability", "hack", "cyberattack", "investigating"]

def analyze_news_sentiment(articles):
    if not articles:
        return 0, []

    total_score = 0
    flagged_articles = []

    for art in articles:
        title = art.get("title", "")
        desc = art.get("snippet", "") or art.get("description", "") or ""
        content = (title + " " + desc).lower()

        risk_level = "LOW"
        article_score = 10

        if any(kw in content for kw in HIGH_RISK_KEYWORDS):
            risk_level = "HIGH"
            article_score = 35
        elif any(kw in content for kw in MEDIUM_RISK_KEYWORDS):
            risk_level = "MEDIUM"
            article_score = 20

        total_score += article_score
        source_val = art.get("source", "Live Security Feed")
        source_name = source_val.get("name", "NewsAPI Live") if isinstance(source_val, dict) else str(source_val)

        flagged_articles.append({
            "title": title,
            "source": source_name,
            "url": art.get("url", "#"),
            "published_at": art.get("published_at") or art.get("publishedAt") or datetime.utcnow().isoformat(),
            "risk_level": risk_level,
            "snippet": desc[:180] + "..." if len(desc) > 180 else desc
        })

    final_score = min(100, total_score)
    return final_score, flagged_articles

def fetch_vendor_news(vendor_name: str, domain: str):
    news_api_key = os.getenv("NEWS_API_KEY", "").strip()

    cache_key = f"news_{vendor_name.lower().replace(' ', '_')}"
    cached = get_cached_response(cache_key)
    if cached:
        return cached

    # 1. If live NEWS_API_KEY is provided in .env, query NewsAPI.org directly
    if news_api_key:
        try:
            record_api_call("NewsAPI")
            url = "https://newsapi.org/v2/everything"
            query = f'"{vendor_name}" AND (breach OR hacked OR ransomware OR "data leak" OR cyberattack)'
            params = {
                "q": query,
                "sortBy": "publishedAt",
                "language": "en",
                "pageSize": 5,
                "apiKey": news_api_key
            }
            res = requests.get(url, params=params, timeout=6)
            if res.status_code == 200:
                data = res.json()
                articles = data.get("articles", [])
                news_score, flagged = analyze_news_sentiment(articles)
                result = {
                    "source": "NewsAPI.org Live Feed (API Key Active)",
                    "news_score": news_score,
                    "articles": flagged,
                    "article_count": len(flagged)
                }
                set_cached_response(cache_key, result, ttl_minutes=60)
                return result
        except Exception as e:
            print(f"[NewsAPI Live Key Exception] {e}")

    # 2. Query Live Google News RSS Feed (No Key Required)
    try:
        query_str = f"{vendor_name} cyberattack OR breach OR ransomware OR vulnerability"
        rss_url = f"https://news.google.com/rss/search?q={query_str}&hl=en-US&gl=US&ceid=US:en"
        res = requests.get(rss_url, timeout=6, headers={"User-Agent": "Mozilla/5.0 VendorRisk360/1.0"})

        if res.status_code == 200:
            root = ET.fromstring(res.text)
            items = root.findall('.//item')[:6]

            live_articles = []
            for item in items:
                title_elem = item.find('title')
                link_elem = item.find('link')
                pub_elem = item.find('pubDate')
                source_elem = item.find('source')

                title = title_elem.text if title_elem is not None else "Cyber Security Advisory"
                url = link_elem.text if link_elem is not None else "#"
                pub_date = pub_elem.text if pub_elem is not None else datetime.utcnow().isoformat()
                source_name = source_elem.text if source_elem is not None else "Google News Security"

                live_articles.append({
                    "title": title,
                    "source": source_name,
                    "url": url,
                    "published_at": pub_date,
                    "snippet": title
                })

            news_score, flagged = analyze_news_sentiment(live_articles)
            result = {
                "source": "Live Google News Incident Feed",
                "news_score": news_score,
                "articles": flagged,
                "article_count": len(flagged)
            }
            set_cached_response(cache_key, result, ttl_minutes=60)
            return result
    except Exception as e:
        print(f"[Live News RSS Error for {vendor_name}] {e}")

    return {
        "source": "Live News Stream Timeout",
        "news_score": 0,
        "articles": [],
        "article_count": 0
    }

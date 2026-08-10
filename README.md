# VendorRisk 360 🛡️

> **Enterprise Third-Party Security Risk Monitoring & Contagion Dashboard**

VendorRisk 360 continuously evaluates enterprise vendors across **5 live security & financial risk vectors**, computing a transparent 0–100 security risk score and mapping third-party risk contagion across an organization's supply chain network.

---

## 🌟 Key Features

- **🌐 Live No-Key Cyber Radar Feeds**: Integrates 100% live public threat intelligence from Google News RSS, Yahoo Finance Market Quotes, US CISA Known Exploited Vulnerabilities, Google Public DNS, and direct HTTPS socket probes.
- **🕸️ Third-Party Risk Contagion Map**: Radial topology network placing your central organization at the core, connected to vendor nodes via color-coded data propagation lines (Rose Red hazard for scores $\ge 70$).
- **📊 30-Day Risk History Trend**: Historical risk score trend line charts rendered via Recharts.
- **📥 Executive Security Audit Exporter**: Downloads CISO-ready JSON audit assessment reports.
- **✉️ Email Security & DMARC/SPF Scanner**: Audits DMARC enforcement policies (`p=reject`, `p=quarantine`) and SPF sender records.
- **⚡ API Quota Budgeting & Circuit Breakers**: SQLite response caching with daily call counters to prevent external API key exhaustion.

---

## 🛠️ Architecture & Tech Stack

- **Frontend**: React 18, Vite, TailwindCSS (v4), Lucide Icons, Recharts
- **Backend**: FastAPI (Python 3.12), Uvicorn
- **Database**: SQLite (`vendor_risk.db`)

---

## 🚀 Quick Start

### 1. Backend Setup
```bash
# Navigate to backend
cd backend

# Install dependencies
pip install -r requirements.txt

# Start FastAPI Server
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

### 2. Frontend Setup
```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start Vite React Dev Server
npm run dev
```

Open **[http://localhost:5173/](http://localhost:5173/)** in your browser.

---

## 🔒 Security & Environment Variables

Create a `backend/.env` file from `backend/.env.example`:
```env
NEWS_API_KEY=your_optional_key
HIBP_API_KEY=your_optional_key
OPENSANCTIONS_API_KEY=your_optional_key
ALPHA_VANTAGE_API_KEY=your_optional_key

BYPASS_CACHE=true
DEMO_MODE=false
```
*Note: Secret `.env` files and SQLite databases are strictly excluded from Git tracking via `.gitignore`.*

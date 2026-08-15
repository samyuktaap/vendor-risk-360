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

## 🔒 Production Security Architecture

The application implements a zero-cost, self-hosted, enterprise-grade security stack:
- **KMS / Transit Encryption**: Vault OSS manages encryption keys (AES-256-GCM) with key derivation enabled (`derived=True`). Raw keys never touch backend memory.
- **Envelope File Encryption**: Streaming chunk-by-chunk encryption for large documents using generated DEKs wrapped by Vault.
- **OIDC Authentication**: Official Google Identity Services / OIDC verification (issuer, audience, and client-side signature validations).
- **Session Protection**: HttpOnly/Secure session cookie lifecycle, 15-minute idle timeouts, and automatic session ID rotation on login to prevent fixation.
- **Tamper-Evident Audit Logging**: HMAC-SHA256 signed checkpoints and chain hashing of all logins, logouts, access failures, and data decryptions.

---

## 🚀 Quick Start

### 1. HashiCorp Vault Setup (Local Dev Mode)
```bash
# 1. Start Vault dev server in the background
vault server -dev -dev-listen-address="127.0.0.1:8200" -dev-root-token-id="my-root-token"

# 2. Run the initialization script to set up engines and AppRole auth
cd backend
python setup_vault.py
```

### 2. Backend Setup
```bash
cd backend
pip install -r requirements.txt

# Start FastAPI Server (enforcing workers=1 for SQLite serialization safety)
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --workers=1
```

### 3. Frontend Setup
```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start Vite React Dev Server
npm run dev
```

---

## 🧪 Running Security Test Suite

To run the automated encryption, OIDC auth, and role check test suites:
```bash
cd backend
# 1. Run encryption and auth tests
python -m pytest tests/test_encryption.py tests/test_auth.py -v

# 2. Run API integration/smoke tests
python test_suite.py
```

---

## ⚙️ Environment Variables

Configure `backend/.env` with your API credentials.
For Google Sign-In, set `GOOGLE_CLIENT_ID` in your shell profile or secure secret vaults:
```bash
export GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
export AUDIT_HMAC_KEY="your-random-hmac-checkpoint-key"
```

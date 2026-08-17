# VendorRisk 360 🛡️

> **Enterprise Third-Party Security Risk Monitoring & Contagion Dashboard**

VendorRisk 360 continuously evaluates enterprise vendors across **live security & financial risk vectors**, computing transparent 0–100 security risk scores and mapping third-party risk contagion across an organization's supply chain network.

---

## 🌟 Key Features

- **🛡️ Cybersecurity 360° Assessment Module**: Comprehensive 12-domain vendor cybersecurity assessment featuring deterministic 0–100 risk scoring (Scoring Engine v1.0), evidence document verification workflows, company data isolation, and RBAC-controlled evidence reviews.
- **📈 MVP Executive Risk Dashboard**: Multi-tenant, company-scoped executive dashboard tracking Total Vendors, High-Risk Vendors, Pending Assessments, Expiring Certifications, Overall Risk Score, Risk Tier Distribution, and Historical Risk Trends.
- **🌐 Live No-Key Cyber Radar Feeds**: Integrates live threat intelligence from Google News RSS, Yahoo Finance Market Quotes, US CISA Known Exploited Vulnerabilities, Google Public DNS, and direct HTTPS socket probes.
- **🕸️ Third-Party Risk Contagion Map**: Radial topology network placing your central organization at the core, connected to vendor nodes via color-coded data propagation lines (Rose Red hazard for scores $\ge 70$).
- **📊 30-Day Risk History Trend**: Historical risk score trend line charts rendered via Recharts.
- **📥 Executive Security Audit Exporter**: Downloads CISO-ready JSON audit assessment reports.
- **✉️ Email Security & DMARC/SPF Scanner**: Audits DMARC enforcement policies (`p=reject`, `p=quarantine`) and SPF sender records.
- **⚡ API Quota Budgeting & Circuit Breakers**: SQLite response caching with daily call counters to prevent external API key exhaustion.

---

## 🎯 Cybersecurity 360° Assessment Domains

The Cybersecurity 360° Assessment module evaluates vendor security posture across 12 mandatory control domains:

1. **Security Governance**: Policies, CISO leadership, executive oversight
2. **Identity & Access Management (IAM)**: MFA enforcement, RBAC, Privileged Access Management (PAM)
3. **Data Protection & Encryption**: AES-256 at rest, TLS 1.2+/1.3 in transit
4. **Network Security**: Web Application Firewalls (WAF), Next-Gen Firewalls, network micro-segmentation
5. **Secure Software Development**: Automated SAST/DAST scanning, SCA, SSDLC
6. **Vulnerability Management**: Patching SLAs, CVE vulnerability tracking
7. **Security Monitoring & Logging**: 24/7 SOC, SIEM integration, log retention
8. **Incident Response**: IR plan, breach notification SLAs (24-72 hours)
9. **Business Continuity & Disaster Recovery**: RTO/RPO targets, annual DR testing
10. **Security Testing & Assurance**: SOC 2 Type II, ISO 27001 certifications
11. **Third-Party / Subcontractor Security**: 4th-party supply chain risk screening
12. **Security Awareness & Workforce Controls**: Security training, phishing simulations, background checks

---

## 🛠️ Architecture & Tech Stack

- **Frontend**: React 18, Vite, Vanilla CSS & TailwindCSS (v4), Lucide Icons, Recharts
- **Backend**: FastAPI (Python 3.12), Uvicorn
- **Database**: SQLite (`vendor_risk.db`)

---

## 🔒 Production Security Architecture

The application implements a zero-cost, self-hosted, enterprise-grade security stack:
- **KMS / Transit Encryption**: Vault OSS manages encryption keys (AES-256-GCM) with key derivation enabled (`derived=True`). Raw keys never touch backend memory.
- **Envelope File Encryption**: Streaming chunk-by-chunk encryption for large documents using generated DEKs wrapped by Vault.
- **OIDC Authentication**: Official Google Identity Services / OIDC verification (issuer, audience, and client-side signature validations).
- **Session Protection**: HttpOnly/Secure session cookie lifecycle, 15-minute idle timeouts, and automatic session ID rotation on login to prevent fixation.
- **Tamper-Evident Audit Logging**: HMAC-SHA256 signed checkpoints and chain hashing of all logins, logouts, access failures, data decryptions, and cybersecurity assessment actions (`CYBERSECURITY_*`).

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

## 🧪 Running Security & Assessment Test Suite

To run the automated test suite covering Cybersecurity 360°, Multi-Tenant Isolation, Encryption, OIDC Auth, and RBAC:
```bash
cd backend

# 1. Run all backend pytest tests (includes test_cybersecurity_assessment.py)
python -m pytest tests/ -v

# 2. Run full backend suite
python run_test_suite.py
```

---

## ⚙️ Environment Variables

Configure `backend/.env` with your API credentials.
For Google Sign-In, set `GOOGLE_CLIENT_ID` in your shell profile or secure secret vaults:
```bash
export GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
export AUDIT_HMAC_KEY="your-random-hmac-checkpoint-key"
```

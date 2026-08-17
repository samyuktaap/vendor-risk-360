# VendorRisk 360 🛡️

> **Enterprise Third-Party Security Risk Monitoring & Contagion Dashboard**

VendorRisk 360 continuously evaluates enterprise vendors across **live security & financial risk vectors**, computing transparent 0–100 security risk scores and mapping third-party risk contagion across an organization's supply chain network.

---

## 🌟 Key Features

- **🔗 Fourth-Party / Supply Chain Risk Management**: Multi-tier transitive supply chain mapping (Company $\rightarrow$ Vendor A $\rightarrow$ Vendor B $\rightarrow$ Cloud Provider / Subprocessor), cycle detection & integrity validation, transitive blast-radius impact analysis (identifying all upstream vendors affected by a downstream outage), multi-tenant isolation, real alerts on critical dependencies, and tamper-evident audit trails.
- **🏷️ Risk-Based Vendor Tiering & Risk Trend Analysis**: Deterministic risk tiering policy (Version 1.0) categorizing vendors into `TIER_1_CRITICAL`, `TIER_2_HIGH`, `TIER_3_MEDIUM`, and `TIER_4_LOW` with dynamic rationale generation. Supports RBAC-governed manual tier overrides for `ENTERPRISE_ADMIN` and `CISO` with mandatory audit justifications while preserving calculated vs effective tiers. Includes historical risk score trend tracking (`IMPROVING`, `STABLE`, `WORSENING`, `NO_HISTORY`), score deltas, and Recharts interactive trend curves.
- **🛡️ Cybersecurity 360° Assessment Module**: Comprehensive 12-domain vendor cybersecurity assessment featuring deterministic 0–100 risk scoring (Scoring Engine v1.0), evidence document verification workflows, company data isolation, and RBAC-controlled evidence reviews.
- **🔍 Vendor Vulnerability Management Module**: Real CVE telemetry correlation against authorized vendor assets via NIST NVD and US CISA KEV feeds, remediation SLA tracking (`CRITICAL`: 7d, `HIGH`: 14d, `MEDIUM`: 30d, `LOW`: 60d), deterministic 0–100 vulnerability risk scoring (v1.0), status lifecycle (`OPEN`, `IN_PROGRESS`, `MITIGATED`, `RESOLVED`, `ACCEPTED_RISK`), and anti-IDOR protections.
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

## 🚀 Installation & Setup Guide

### 📋 Prerequisites

Before running VendorRisk 360, ensure you have the following installed on your machine:
- **Python 3.10+** (Python 3.12 recommended)
- **Node.js 18+** & **npm 9+**
- **Git**
- *(Optional for KMS Transit Key Management)*: **HashiCorp Vault OSS** binary ([Download Vault](https://developer.hashicorp.com/vault/install))

---

### ⚙️ 1. Environment Configuration

1. In the `backend/` directory, create a `.env` file from `.env.example`:
   ```bash
   cd backend
   cp .env.example .env
   ```

2. Configure environment variables in `backend/.env`:
   ```ini
   # --- Server Configuration ---
   HOST=0.0.0.0
   PORT=8000
   WORKERS=1

   # --- Security & Cryptography ---
   AUDIT_HMAC_KEY=your-secure-random-hmac-checkpoint-key-32bytes
   GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com

   # --- Optional HashiCorp Vault Integration ---
   VAULT_ADDR=http://127.0.0.1:8200
   VAULT_TOKEN=my-root-token
   VAULT_ROLE_ID=
   VAULT_SECRET_ID=

   # --- Optional Live Feeds API Keys (Leave blank to use live free feeds) ---
   ABUSEIPDB_API_KEY=
   HIBP_API_KEY=
   ```

---

### 🔐 2. HashiCorp Vault Setup (Local Dev Mode)

VendorRisk 360 supports hardware/KMS envelope encryption and key derivation via HashiCorp Vault. If running with Vault:

```bash
# Terminal 1: Start Vault in development mode
vault server -dev -dev-listen-address="127.0.0.1:8200" -dev-root-token-id="my-root-token"

# Terminal 2: Initialize Transit & KV Secrets Engines
cd backend
python setup_vault.py
```
> *Note: If Vault is not running, the application gracefully falls back to local authenticated encryption with AES-256-GCM for dev environments.*

---

### 🐍 3. Backend Setup & Run

1. Open a terminal and navigate to the `backend/` folder:
   ```bash
   cd backend
   ```

2. *(Recommended)* Create and activate a Python virtual environment:
   - **Windows (PowerShell)**:
     ```powershell
     python -m venv venv
     .\venv\Scripts\Activate.ps1
     ```
   - **macOS / Linux**:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

3. Install all required backend dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Start the FastAPI backend server:
   ```bash
   # Enforces workers=1 for SQLite multi-process serialization safety
   python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload --workers 1
   ```
   - **API Base URL**: `http://localhost:8000`
   - **Interactive Swagger Docs**: `http://localhost:8000/docs`
   - **ReDoc API Documentation**: `http://localhost:8000/redoc`

---

### ⚛️ 4. Frontend Setup & Run

1. Open a new terminal and navigate to the `frontend/` folder:
   ```bash
   cd frontend
   ```

2. Install Node dependencies:
   ```bash
   npm install
   ```

3. Start the Vite React development server:
   ```bash
   npm run dev
   ```
   - **Web Application URL**: `http://localhost:5173`

4. *(Optional)* Build for production:
   ```bash
   npm run build
   npm run preview
   ```

---

## 🧪 Automated Testing & Verification

VendorRisk 360 includes a comprehensive test suite with **82+ automated unit, integration, and security tests** covering encryption, multi-tenancy, RBAC, cybersecurity assessments, vulnerability SLA tracking, vendor tiering, and supply chain graphs.

### Run All Backend Tests:
```bash
cd backend
python -m pytest tests/ -v
```

### Run Module-Specific Test Suites:
```bash
# 1. Supply Chain & Fourth-Party Risk Management
python -m pytest tests/test_supply_chain_management.py -v

# 2. Risk-Based Vendor Tiering & Risk Trend Analysis
python -m pytest tests/test_vendor_tiering_and_trend.py -v

# 3. Vulnerability Management & CVE SLA Correlation
python -m pytest tests/test_vulnerability_management.py -v

# 4. Cybersecurity 360° Assessment & Evidence Verification
python -m pytest tests/test_cybersecurity_assessment.py -v

# 5. Multi-Tenant Data Isolation & Anti-IDOR Protections
python -m pytest tests/test_dashboard_isolation.py -v

# 6. Cryptography, Vault KMS, and Tamper-Evident Audit Logging
python -m pytest tests/test_encryption.py -v

# 7. OIDC Authentication, MFA, and Session Rotation
python -m pytest tests/test_auth.py tests/test_auth_integration.py -v
```

---

## 🧭 Application Usage & Workflow

1. **Sign In**: Access `http://localhost:5173` and sign in via Google OIDC or enter your authorized enterprise credentials.
2. **Executive Dashboard**: Review organization-wide risk distribution, critical supply chain dependencies, and risk trend metrics.
3. **Vendor Management**:
   - **Cybersecurity 360°**: Conduct 12-domain vendor assessments and verify uploaded compliance evidence.
   - **Vulnerability Management**: Correlate live CVEs from NIST NVD and US CISA KEV against authorized vendor assets.
   - **Risk Tiering**: Inspect calculated risk tiers (`Tier 1` to `Tier 4`), causal rationale factors, and apply authorized CISO overrides.
   - **Fourth-Party / Supply Chain**: Add multi-tier downstream dependencies, inspect transitive blast-radius impacts, and view hierarchy trees.
   - **Audit Logs**: Download cryptographically verifiable, HMAC-signed audit logs for compliance reviews.

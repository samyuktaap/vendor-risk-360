"""
cybersecurity_catalog.py — Maintainable question-definition catalog for Cybersecurity 360° Assessment.

Covers 12 mandatory cybersecurity domains:
1. Security Governance
2. Identity & Access Management
3. Data Protection & Encryption
4. Network Security
5. Secure Software Development
6. Vulnerability Management
7. Security Monitoring & Logging
8. Incident Response
9. Business Continuity & Disaster Recovery
10. Security Testing & Assurance
11. Third-Party / Subcontractor Security
12. Security Awareness & Workforce Controls
"""

from typing import Dict, List, TypedDict, Optional

class QuestionOption(TypedDict):
    label: str
    value: str
    risk_factor: float  # 0.0 (no risk penalty) to 1.0 (maximum risk penalty)

class QuestionDefinition(TypedDict):
    question_id: str
    domain: str
    question_text: str
    response_type: str  # "YES_NO", "MULTIPLE_CHOICE", "TEXT"
    required: bool
    weight: float
    evidence_required: bool
    display_order: int
    options: Optional[List[QuestionOption]]

CYBERSECURITY_DOMAINS = [
    {"id": "SECURITY_GOVERNANCE", "title": "Security Governance", "description": "Policies, executive oversight, and CISO leadership"},
    {"id": "IDENTITY_ACCESS_MANAGEMENT", "title": "Identity & Access Management", "description": "Authentication, MFA, RBAC, and Privileged Access Management"},
    {"id": "DATA_PROTECTION_ENCRYPTION", "title": "Data Protection & Encryption", "description": "AES-256 at rest, TLS 1.3 in transit, and Data Loss Prevention"},
    {"id": "NETWORK_SECURITY", "title": "Network Security", "description": "Firewalls, network segmentation, WAF, and intrusion prevention"},
    {"id": "SECURE_SOFTWARE_DEVELOPMENT", "title": "Secure Software Development", "description": "SSDLC, SAST/DAST scanning, code reviews, and dependency checks"},
    {"id": "VULNERABILITY_MANAGEMENT", "title": "Vulnerability Management", "description": "Patch management SLAs, CVE scanning, and penetration testing"},
    {"id": "SECURITY_MONITORING_LOGGING", "title": "Security Monitoring & Logging", "description": "24/7 SOC, SIEM centralization, and tamper-evident log retention"},
    {"id": "INCIDENT_RESPONSE", "title": "Incident Response", "description": "Incident response plan, breach notification SLAs, and exercises"},
    {"id": "BUSINESS_CONTINUITY_DR", "title": "Business Continuity & Disaster Recovery", "description": "RTO/RPO targets, backup encryption, and annual DR testing"},
    {"id": "SECURITY_TESTING_ASSURANCE", "title": "Security Testing & Assurance", "description": "SOC 2 Type II, ISO 27001 certifications, and third-party audits"},
    {"id": "THIRD_PARTY_SECURITY", "title": "Third-Party / Subcontractor Security", "description": "N-th party supply chain risk management and vendor screening"},
    {"id": "SECURITY_AWARENESS_WORKFORCE", "title": "Security Awareness & Workforce Controls", "description": "Employee security training, phishing simulations, and background checks"},
]

QUESTIONS_CATALOG: List[QuestionDefinition] = [
    # 1. Security Governance
    {
        "question_id": "GOV_01",
        "domain": "SECURITY_GOVERNANCE",
        "question_text": "Does your organization maintain a formal Information Security Policy approved by executive leadership and reviewed annually?",
        "response_type": "YES_NO",
        "required": True,
        "weight": 1.5,
        "evidence_required": True,
        "display_order": 1,
        "options": None
    },
    {
        "question_id": "GOV_02",
        "domain": "SECURITY_GOVERNANCE",
        "question_text": "Is there a designated Chief Information Security Officer (CISO) or equivalent executive head of cybersecurity?",
        "response_type": "YES_NO",
        "required": True,
        "weight": 1.2,
        "evidence_required": False,
        "display_order": 2,
        "options": None
    },

    # 2. Identity & Access Management
    {
        "question_id": "IAM_01",
        "domain": "IDENTITY_ACCESS_MANAGEMENT",
        "question_text": "Is Multi-Factor Authentication (MFA) strictly enforced for all employee and contractor access to corporate systems and customer data?",
        "response_type": "YES_NO",
        "required": True,
        "weight": 2.0,
        "evidence_required": True,
        "display_order": 3,
        "options": None
    },
    {
        "question_id": "IAM_02",
        "domain": "IDENTITY_ACCESS_MANAGEMENT",
        "question_text": "What identity architecture controls are enforced for privileged access accounts?",
        "response_type": "MULTIPLE_CHOICE",
        "required": True,
        "weight": 1.5,
        "evidence_required": True,
        "display_order": 4,
        "options": [
            {"label": "Dedicated PAM solution with JIT access and session recording", "value": "PAM_ADVANCED", "risk_factor": 0.0},
            {"label": "RBAC + Hardware MFA token required for administrative access", "value": "RBAC_MFA", "risk_factor": 0.2},
            {"label": "Standard passwords with basic MFA", "value": "BASIC_MFA", "risk_factor": 0.6},
            {"label": "Shared credentials / no formal PAM control", "value": "NO_PAM", "risk_factor": 1.0}
        ]
    },

    # 3. Data Protection & Encryption
    {
        "question_id": "DPE_01",
        "domain": "DATA_PROTECTION_ENCRYPTION",
        "question_text": "Is all sensitive customer data encrypted at rest using AES-256 or equivalent strong cryptography?",
        "response_type": "YES_NO",
        "required": True,
        "weight": 2.0,
        "evidence_required": True,
        "display_order": 5,
        "options": None
    },
    {
        "question_id": "DPE_02",
        "domain": "DATA_PROTECTION_ENCRYPTION",
        "question_text": "Are modern transport security protocols (TLS 1.2+ / TLS 1.3) enforced for all external network communications?",
        "response_type": "YES_NO",
        "required": True,
        "weight": 1.5,
        "evidence_required": False,
        "display_order": 6,
        "options": None
    },

    # 4. Network Security
    {
        "question_id": "NET_01",
        "domain": "NETWORK_SECURITY",
        "question_text": "Are network perimeters protected by Web Application Firewalls (WAF) and Next-Generation Firewalls (NGFW)?",
        "response_type": "YES_NO",
        "required": True,
        "weight": 1.5,
        "evidence_required": True,
        "display_order": 7,
        "options": None
    },
    {
        "question_id": "NET_02",
        "domain": "NETWORK_SECURITY",
        "question_text": "Is micro-segmentation or Zero Trust Network Access (ZTNA) implemented across environments?",
        "response_type": "YES_NO",
        "required": False,
        "weight": 1.0,
        "evidence_required": False,
        "display_order": 8,
        "options": None
    },

    # 5. Secure Software Development
    {
        "question_id": "DEV_01",
        "domain": "SECURE_SOFTWARE_DEVELOPMENT",
        "question_text": "Are Static Application Security Testing (SAST) and Software Composition Analysis (SCA) automated in CI/CD build pipelines?",
        "response_type": "YES_NO",
        "required": True,
        "weight": 1.8,
        "evidence_required": True,
        "display_order": 9,
        "options": None
    },

    # 6. Vulnerability Management
    {
        "question_id": "VUL_01",
        "domain": "VULNERABILITY_MANAGEMENT",
        "question_text": "What is the organization's SLA for patching critical-severity CVE vulnerabilities?",
        "response_type": "MULTIPLE_CHOICE",
        "required": True,
        "weight": 1.8,
        "evidence_required": True,
        "display_order": 10,
        "options": [
            {"label": "< 7 days for critical vulnerabilities", "value": "SLA_7_DAYS", "risk_factor": 0.0},
            {"label": "8 to 14 days", "value": "SLA_14_DAYS", "risk_factor": 0.3},
            {"label": "15 to 30 days", "value": "SLA_30_DAYS", "risk_factor": 0.6},
            {"label": "> 30 days or informal patching schedule", "value": "SLA_30_PLUS", "risk_factor": 1.0}
        ]
    },

    # 7. Security Monitoring & Logging
    {
        "question_id": "MON_01",
        "domain": "SECURITY_MONITORING_LOGGING",
        "question_text": "Is security event logging centralized in a SIEM/XDR with 24/7/365 active SOC monitoring?",
        "response_type": "YES_NO",
        "required": True,
        "weight": 1.6,
        "evidence_required": True,
        "display_order": 11,
        "options": None
    },

    # 8. Incident Response
    {
        "question_id": "INC_01",
        "domain": "INCIDENT_RESPONSE",
        "question_text": "Does your Incident Response Plan commit to notifying affected customers of confirmed security breaches within 24–72 hours?",
        "response_type": "YES_NO",
        "required": True,
        "weight": 2.0,
        "evidence_required": True,
        "display_order": 12,
        "options": None
    },

    # 9. Business Continuity & Disaster Recovery
    {
        "question_id": "BCP_01",
        "domain": "BUSINESS_CONTINUITY_DR",
        "question_text": "Are full disaster recovery and data restoration exercises conducted and documented at least annually?",
        "response_type": "YES_NO",
        "required": True,
        "weight": 1.5,
        "evidence_required": True,
        "display_order": 13,
        "options": None
    },

    # 10. Security Testing & Assurance
    {
        "question_id": "TST_01",
        "domain": "SECURITY_TESTING_ASSURANCE",
        "question_text": "What third-party security assurance audits or certifications does your organization maintain?",
        "response_type": "MULTIPLE_CHOICE",
        "required": True,
        "weight": 2.0,
        "evidence_required": True,
        "display_order": 14,
        "options": [
            {"label": "SOC 2 Type II AND ISO 27001 certified", "value": "SOC2_ISO27001", "risk_factor": 0.0},
            {"label": "SOC 2 Type II OR ISO 27001 certified", "value": "SOC2_OR_ISO", "risk_factor": 0.2},
            {"label": "SOC 2 Type I or self-assessment against NIST CSF", "value": "TYPE1_SELF", "risk_factor": 0.6},
            {"label": "No formal third-party audit reports", "value": "NONE", "risk_factor": 1.0}
        ]
    },

    # 11. Third-Party / Subcontractor Security
    {
        "question_id": "TPM_01",
        "domain": "THIRD_PARTY_SECURITY",
        "question_text": "Are all 4th-party sub-processors and subcontractors subjected to mandatory vendor risk assessments before integration?",
        "response_type": "YES_NO",
        "required": True,
        "weight": 1.4,
        "evidence_required": False,
        "display_order": 15,
        "options": None
    },

    # 12. Security Awareness & Workforce Controls
    {
        "question_id": "AWA_01",
        "domain": "SECURITY_AWARENESS_WORKFORCE",
        "question_text": "Are all employees required to complete security awareness training and simulated phishing testing at least bi-annually?",
        "response_type": "YES_NO",
        "required": True,
        "weight": 1.2,
        "evidence_required": False,
        "display_order": 16,
        "options": None
    }
]

def get_questions_catalog() -> List[QuestionDefinition]:
    return QUESTIONS_CATALOG

def get_question_by_id(question_id: str) -> Optional[QuestionDefinition]:
    for q in QUESTIONS_CATALOG:
        if q["question_id"] == question_id:
            return q
    return None

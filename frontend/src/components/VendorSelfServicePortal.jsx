import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Building, 
  Globe, 
  FileCheck, 
  Upload, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  Download, 
  LogOut, 
  Sparkles, 
  RefreshCw,
  Send,
  MessageSquare,
  Plus,
  Trash2,
  Share2,
  Check,
  FileText,
  Activity,
  Layers,
  Server,
  Zap,
  CheckSquare,
  BarChart3,
  Award,
  HelpCircle,
  FileCode,
  Lock,
  Eye,
  Calendar,
  AlertCircle
} from 'lucide-react';
import RiskScoreRing from './RiskScoreRing';

const API_BASE = 'http://localhost:8000';

const QUESTIONNAIRE_ITEMS = [
  { id: 'q1', category: 'CYBERSECURITY', type: 'YES_NO', text: 'Does your organization have a formal incident response plan tested annually?', required: true },
  { id: 'q2', category: 'CYBERSECURITY', type: 'YES_NO', text: 'Is Multi-Factor Authentication (MFA) strictly enforced for all employee and administrative access?', required: true },
  { id: 'q3', category: 'COMPLIANCE', type: 'YES_NO', text: 'Does your organization hold an active SOC 2 Type II or ISO 27001 certification?', required: true },
  { id: 'q4', category: 'COMPLIANCE', type: 'MULTIPLE_CHOICE', text: 'How frequently are external third-party penetration tests conducted?', required: true, options: ['Quarterly', 'Annually', 'Bi-annually', 'Never'] },
  { id: 'q5', category: 'FINANCIAL_STABILITY', type: 'YES_NO', text: 'Has your organization experienced bankruptcy or severe financial distress in the last 5 years?', required: true },
  { id: 'q6', category: 'OPERATIONAL_RISK', type: 'YES_NO', text: 'Is there a documented and regularly tested Business Continuity Plan (BCP) / Disaster Recovery (DR)?', required: true },
  { id: 'q7', category: 'DATA_PRIVACY', type: 'YES_NO', text: 'Does your service process or store customer PII, PHI, or PCI cardholder data?', required: true },
  { id: 'q8', category: 'DATA_PRIVACY', type: 'TEXT', text: 'Describe data encryption protocols employed for data at rest and data in transit (e.g. AES-256, TLS 1.3).', required: false }
];

export default function VendorSelfServicePortal({ user, onSignOut }) {
  const [activeTab, setActiveTab] = useState('overview'); // overview | documentation | operational | compliance | remediation | supply-chain | questionnaire | messages
  const [vendorId, setVendorId] = useState(user?.vendorId || user?.vendor_id || 1);
  const [vendorData, setVendorData] = useState(null);
  const [shapData, setShapData] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [remediations, setRemediations] = useState([]);
  const [compliance, setCompliance] = useState([]);
  const [subVendors, setSubVendors] = useState([]);
  const [deterministicScore, setDeterministicScore] = useState(null);
  const [operationalData, setOperationalData] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [newCert, setNewCert] = useState({ name: 'ISO 27001:2022', status: 'Compliant', validity: '2027-12-31' });

  // Document Upload Form
  const [docUploadForm, setDocUploadForm] = useState({
    title: '',
    document_type: 'SOC 2 Report',
    file: null,
    description: ''
  });
  const [docUploading, setDocUploading] = useState(false);

  // Sub-Vendor Form state
  const [newSub, setNewSub] = useState({ name: '', domain: '', sector: 'Cloud Infrastructure' });
  const [subError, setSubError] = useState('');
  const [subVerifying, setSubVerifying] = useState(false);

  // Questionnaire & Trigger state
  const [assessmentId, setAssessmentId] = useState(null);
  const [assessmentStatus, setAssessmentStatus] = useState(null);
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState({});
  const [questionnaireSaving, setQuestionnaireSaving] = useState(false);
  const [questionnaireSubmitting, setQuestionnaireSubmitting] = useState(false);
  const [questionnaireMsg, setQuestionnaireMsg] = useState(null);

  // Q&A Messaging state
  const [message, setMessage] = useState('');
  const [messagesList, setMessagesList] = useState([
    { sender: 'Enterprise CISO', text: 'Please review and submit your updated SOC 2 Type II and BCP verification for Q3.', timestamp: '10:15 AM' },
    { sender: user?.name || 'Vendor Admin', text: 'We have updated our DMARC enforcement and will upload the audit certificate today.', timestamp: '10:20 AM' }
  ]);

  // Resolve Vendor ID and initial data
  useEffect(() => {
    const resolveAndFetch = async () => {
      let resolvedId = user?.vendorId || user?.vendor_id;
      if (!resolvedId) {
        try {
          const res = await fetch(`${API_BASE}/api/vendors`);
          if (res.ok) {
            const list = await res.json();
            const matched = list.find(v => 
              (user?.domain && v.domain === user.domain) || 
              (user?.email && v.contact_email === user.email)
            ) || list[0];
            if (matched) {
              resolvedId = matched.id;
              setVendorId(matched.id);
            }
          }
        } catch (e) {}
      } else {
        setVendorId(resolvedId);
      }
      if (resolvedId) {
        fetchAllVendorDetails(resolvedId);
      } else {
        setLoading(false);
      }
    };
    resolveAndFetch();
  }, [user]);

  const fetchAllVendorDetails = async (vId = vendorId) => {
    if (!vId) return;
    setLoading(true);
    try {
      const [vRes, sRes, iRes, rRes, cRes, subRes, detRes, opRes, docRes] = await Promise.allSettled([
        fetch(`${API_BASE}/api/vendors/${vId}`),
        fetch(`${API_BASE}/api/vendors/${vId}/shap-risk`),
        fetch(`${API_BASE}/api/vendors/${vId}/incidents`),
        fetch(`${API_BASE}/api/vendors/${vId}/remediation`),
        fetch(`${API_BASE}/api/vendors/${vId}/compliance`),
        fetch(`${API_BASE}/api/vendors/${vId}/sub-vendors`),
        fetch(`${API_BASE}/api/vendors/${vId}/risk-score`),
        fetch(`${API_BASE}/api/vendors/${vId}/operational-risk`),
        fetch(`${API_BASE}/api/vendors/${vId}/documents`, { credentials: 'include' })
      ]);

      if (vRes.status === 'fulfilled' && vRes.value.ok) setVendorData(await vRes.value.json());
      if (sRes.status === 'fulfilled' && sRes.value.ok) setShapData(await sRes.value.json());
      if (iRes.status === 'fulfilled' && iRes.value.ok) {
        const iJson = await iRes.value.json();
        setIncidents(iJson.incidents || []);
      }
      if (rRes.status === 'fulfilled' && rRes.value.ok) {
        const rJson = await rRes.value.json();
        setRemediations(rJson.tasks || rJson || []);
      }
      if (cRes.status === 'fulfilled' && cRes.value.ok) {
        const cJson = await cRes.value.json();
        setCompliance(cJson.frameworks || cJson || []);
      }
      if (subRes.status === 'fulfilled' && subRes.value.ok) setSubVendors(await subRes.value.json());
      if (detRes.status === 'fulfilled' && detRes.value.ok) setDeterministicScore(await detRes.value.json());
      if (opRes.status === 'fulfilled' && opRes.value.ok) setOperationalData(await opRes.value.json());
      if (docRes.status === 'fulfilled' && docRes.value.ok) {
        const dJson = await docRes.value.json();
        setDocuments(dJson.documents || []);
      }
    } catch (err) {
      console.error("Error fetching vendor portal details:", err);
    } finally {
      setLoading(false);
    }
  };

  // Questionnaire Assessment loader
  useEffect(() => {
    const loadAssessment = async () => {
      if (!vendorId) return;
      const storedId = sessionStorage.getItem(`vendor_${vendorId}_assessment_id`);
      if (storedId) {
        try {
          const res = await fetch(`${API_BASE}/api/assessments/${storedId}`);
          if (res.ok) {
            const data = await res.json();
            setAssessmentId(data.assessment.id);
            setAssessmentStatus(data.assessment.status);
            const ansObj = {};
            (data.answers || []).forEach(a => {
              ansObj[a.question_id] = a.answer_value;
            });
            setQuestionnaireAnswers(ansObj);
          }
        } catch (e) {}
      }
    };
    loadAssessment();
  }, [vendorId]);

  // Operational Risk Triggers
  const handleTriggerBcpVerify = async () => {
    if (!vendorId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/vendors/${vendorId}/operational-risk/bcp-verify`, {
        method: 'POST'
      });
      if (res.ok) {
        await fetchAllVendorDetails();
        alert("Business Continuity Plan (BCP) verification executed successfully!");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleTriggerDrTest = async () => {
    if (!vendorId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/vendors/${vendorId}/operational-risk/dr-test`, {
        method: 'POST'
      });
      if (res.ok) {
        await fetchAllVendorDetails();
        alert("Disaster Recovery (DR) Simulation drill executed successfully!");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  // Document Upload Handler
  const handleUploadDocument = async (e) => {
    e.preventDefault();
    if (!docUploadForm.file || !vendorId) return;
    setDocUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', docUploadForm.file);
      formData.append('document_type', docUploadForm.document_type);
      formData.append('title', docUploadForm.title || docUploadForm.file.name);
      formData.append('description', docUploadForm.description || '');

      const res = await fetch(`${API_BASE}/api/vendors/${vendorId}/documents`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (res.ok) {
        setDocUploadForm({ title: '', document_type: 'SOC 2 Report', file: null, description: '' });
        setUploadModalOpen(false);
        await fetchAllVendorDetails();
      } else {
        const err = await res.json();
        alert(`Document upload failed: ${err.detail || 'Server error'}`);
      }
    } catch (err) {
      alert("Failed to upload document to security vault.");
    } finally {
      setDocUploading(false);
    }
  };

  // Questionnaire Handlers (Triggers score calculation)
  const handleStartQuestionnaire = async () => {
    if (!vendorId) return;
    setQuestionnaireSaving(true);
    setQuestionnaireMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/assessments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor_id: vendorId })
      });
      if (res.ok) {
        const data = await res.json();
        setAssessmentId(data.assessment_id);
        setAssessmentStatus('DRAFT');
        sessionStorage.setItem(`vendor_${vendorId}_assessment_id`, data.assessment_id);
        setQuestionnaireMsg("Assessment draft started.");
      }
    } catch (e) {
      setQuestionnaireMsg("Failed to start assessment.");
    } finally {
      setQuestionnaireSaving(false);
    }
  };

  const handleSaveQuestionnaireDraft = async () => {
    if (!assessmentId) return;
    setQuestionnaireSaving(true);
    setQuestionnaireMsg(null);
    try {
      const answersPayload = QUESTIONNAIRE_ITEMS.map(q => ({
        question_id: q.id,
        category: q.category,
        answer_value: questionnaireAnswers[q.id] || ''
      })).filter(a => a.answer_value !== '');

      const res = await fetch(`${API_BASE}/api/assessments/${assessmentId}/answers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answersPayload })
      });
      if (res.ok) {
        setQuestionnaireMsg("Draft answers saved successfully.");
      }
    } catch (e) {
      setQuestionnaireMsg("Failed to save draft.");
    } finally {
      setQuestionnaireSaving(false);
    }
  };

  const handleSubmitQuestionnaireAndTriggerScore = async () => {
    if (!assessmentId) return;
    setQuestionnaireSubmitting(true);
    setQuestionnaireMsg(null);
    try {
      // 1. Save answers
      const answersPayload = QUESTIONNAIRE_ITEMS.map(q => ({
        question_id: q.id,
        category: q.category,
        answer_value: questionnaireAnswers[q.id] || ''
      })).filter(a => a.answer_value !== '');

      await fetch(`${API_BASE}/api/assessments/${assessmentId}/answers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answersPayload })
      });

      // 2. Submit
      await fetch(`${API_BASE}/api/assessments/${assessmentId}/submit`, { method: 'POST' });

      // 3. Trigger deterministic score recalculation
      const scoreRes = await fetch(`${API_BASE}/api/assessments/${assessmentId}/calculate-score`, { method: 'POST' });
      if (scoreRes.ok) {
        const newScore = await scoreRes.json();
        setDeterministicScore(newScore);
        setAssessmentStatus('SUBMITTED');
        setQuestionnaireMsg("Questionnaire submitted! Risk engine triggered and score updated.");
        await fetchAllVendorDetails();
      }
    } catch (e) {
      setQuestionnaireMsg("Failed to complete assessment submission.");
    } finally {
      setQuestionnaireSubmitting(false);
    }
  };

  // Sub-Vendor Add
  const handleAddSubVendor = async (e) => {
    e.preventDefault();
    if (!newSub.name.trim() || !newSub.domain.trim() || !vendorId) return;
    setSubVerifying(true);
    setSubError('');

    try {
      const res = await fetch(`${API_BASE}/api/vendors/${vendorId}/sub-vendors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSub)
      });
      const data = await res.json();

      if (res.ok) {
        setSubModalOpen(false);
        setNewSub({ name: '', domain: '', sector: 'Cloud Infrastructure' });
        await fetchAllVendorDetails();
      } else {
        setSubError(data.detail || "Sub-vendor domain verification failed.");
      }
    } catch (err) {
      setSubError("Failed to connect to verification server.");
    } finally {
      setSubVerifying(false);
    }
  };

  const handleDeleteSubVendor = async (subId) => {
    try {
      const res = await fetch(`${API_BASE}/api/sub-vendors/${subId}`, { method: 'DELETE' });
      if (res.ok) {
        setSubVendors(subVendors.filter(s => s.id !== subId));
      }
    } catch (err) { console.error(err); }
  };

  // Messaging
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    setMessagesList([...messagesList, {
      sender: user?.name || 'Vendor Security Team',
      text: message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
    setMessage('');
  };

  const v = vendorData?.vendor;
  const assessment = vendorData?.risk_assessment;
  const score = deterministicScore?.total_score ?? assessment?.overall_score ?? v?.risk_score ?? 35;
  const riskTier = deterministicScore?.risk_level ?? assessment?.risk_tier ?? v?.risk_tier ?? 'LOW';

  const navItems = [
    { id: 'overview', label: 'Vendor Dashboard', icon: BarChart3 },
    { id: 'documentation', label: 'Documentation Hub', icon: FileText, badge: documents.length > 0 ? `${documents.length} Docs` : null },
    { id: 'operational', label: 'Operational Risk', icon: Activity },
    { id: 'compliance', label: 'Compliance & Certs', icon: Award },
    { id: 'remediation', label: 'Remediation Tasks', icon: CheckSquare, badge: remediations.length > 0 ? `${remediations.length} Active` : null },
    { id: 'supply-chain', label: '4th-Party Supply Chain', icon: Share2, badge: subVendors.length > 0 ? `${subVendors.length} Sub` : null },
    { id: 'questionnaire', label: 'Risk Questionnaire', icon: HelpCircle },
    { id: 'messages', label: 'CISO Direct Channel', icon: MessageSquare }
  ];

  return (
    <div className="min-h-screen bg-[#070a14] text-slate-100 flex font-sans antialiased">
      {/* Vendor Dedicated Sidebar */}
      <aside className="w-64 bg-[#0a0f1e] border-r border-slate-800 flex flex-col justify-between h-screen sticky top-0 z-30 select-none">
        <div>
          {/* Brand Header */}
          <div className="p-5 border-b border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 via-teal-500 to-blue-600 p-[1.5px] shadow-lg shadow-cyan-950/80">
              <div className="w-full h-full bg-[#070a12] rounded-[9.5px] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
              </div>
            </div>
            <div>
              <h1 className="font-extrabold text-slate-100 text-base tracking-tight leading-none">
                Vendor<span className="text-cyan-400">Portal</span>
              </h1>
              <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                Third-Party Partner
              </p>
            </div>
          </div>

          {/* Vendor Profile Pill */}
          <div className="p-4 border-b border-slate-800/60 bg-slate-900/40">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-black text-xs flex items-center justify-center">
                {(v?.name || user?.name || 'V').substring(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-xs text-white truncate">{v?.name || user?.name || 'Vendor Organization'}</div>
                <div className="text-[10px] text-slate-400 truncate">{v?.domain || user?.domain || 'vendor.com'}</div>
              </div>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="p-3 space-y-1">
            <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Vendor Navigation
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-md shadow-cyan-950/50'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sign Out Footer */}
        <div className="p-4 border-t border-slate-800 bg-[#070a12]">
          <button
            onClick={onSignOut}
            className="w-full py-2.5 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out Portal</span>
          </button>
        </div>
      </aside>

      {/* Main Vendor Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Banner */}
        <header className="h-16 border-b border-slate-800 px-6 flex items-center justify-between bg-[#0a0f1e]/80 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-white">
              {navItems.find(n => n.id === activeTab)?.label || 'Vendor Dashboard'}
            </span>
            <span className="text-xs text-slate-500">•</span>
            <span className="text-xs text-slate-400 font-mono">
              Partner Scope: {v?.name || user?.name}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchAllVendorDetails()}
              disabled={loading}
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Status</span>
            </button>
            <div className="text-xs px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Isolated Vendor Session</span>
            </div>
          </div>
        </header>

        {/* Tab Views */}
        <main className="p-6 flex-1 overflow-y-auto max-w-7xl mx-auto w-full space-y-6">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
              Loading Vendor Security Assessment & Supply Chain Data...
            </div>
          ) : (
            <>
              {/* ========================================================================= */}
              {/* 1. VENDOR DASHBOARD TAB */}
              {/* ========================================================================= */}
              {activeTab === 'overview' && (
                <div className="space-y-6 animate-fadeIn">
                  {/* Top Summary Card */}
                  <div className="bg-gradient-to-r from-[#0e1626] via-[#0a1020] to-[#0b1528] border border-cyan-500/20 rounded-3xl p-6 shadow-2xl flex flex-wrap items-center justify-between gap-6">
                    <div className="space-y-2">
                      <div className="text-xs uppercase font-bold tracking-wider text-slate-400">
                        Live Security & Risk Evaluation
                      </div>
                      <div className="text-3xl font-black text-white flex items-center gap-3">
                        <span>{riskTier} RISK</span>
                        <span className={`text-xs px-3 py-1 rounded-full border ${
                          score >= 60
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : score >= 30
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        }`}>
                          {score >= 60 ? 'Action Required — Critical Risk' : score >= 30 ? 'Moderate Posture' : 'Optimal Security Baseline'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 max-w-lg">
                        Deterministic score dynamically calculated across 7 live threat vectors, self-assessments, and upstream dependency analysis.
                      </p>
                    </div>

                    <RiskScoreRing
                      score={score}
                      size={115}
                      strokeWidth={10}
                      breakdown={assessment?.breakdown}
                    />
                  </div>

                  {/* SHAP Machine Learning Risk Drivers */}
                  {shapData && shapData.status === 'success' && (
                    <div className="bg-slate-900/80 border border-emerald-500/20 rounded-3xl p-6 space-y-4 shadow-xl">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                            <Brain className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-100">Explainable ML Risk Factors (SHAP Drivers)</h3>
                            <p className="text-[10px] text-slate-400">Key threat vectors impacting your enterprise security score rating</p>
                          </div>
                        </div>
                        <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                          ML Score: {shapData.ml_predicted_score} / 100
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-950/60 border border-rose-500/20 rounded-2xl p-4 space-y-2">
                          <div className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                            <TrendingUp className="w-4 h-4 text-rose-400" />
                            Factors Escalating Risk (+ Points)
                          </div>
                          <div className="space-y-2">
                            {shapData.top_risk_drivers && shapData.top_risk_drivers.length > 0 ? (
                              shapData.top_risk_drivers.map((driver, idx) => (
                                <div key={idx} className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                                  <span className="text-slate-200 font-medium">{driver.label}</span>
                                  <span className="font-mono font-bold text-rose-400">+{driver.shap_value} pts</span>
                                </div>
                              ))
                            ) : (
                              <div className="text-xs text-slate-500 italic">No significant risk escalators identified.</div>
                            )}
                          </div>
                        </div>

                        <div className="bg-slate-950/60 border border-emerald-500/20 rounded-2xl p-4 space-y-2">
                          <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                            <TrendingDown className="w-4 h-4 text-emerald-400" />
                            Protective Security Factors (- Points)
                          </div>
                          <div className="space-y-2">
                            {shapData.protective_factors && shapData.protective_factors.length > 0 ? (
                              shapData.protective_factors.map((factor, idx) => (
                                <div key={idx} className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                  <span className="text-slate-200 font-medium">{factor.label}</span>
                                  <span className="font-mono font-bold text-emerald-400">{factor.shap_value} pts</span>
                                </div>
                              ))
                            ) : (
                              <div className="text-xs text-slate-500 italic">Operating at baseline standard score.</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 7 Threat Vectors Dynamic Grid */}
                  <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-cyan-400" />
                      7 Live Risk Vectors Breakdown
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
                        <div className="text-[10px] text-slate-400">Cybersecurity Posture</div>
                        <div className="text-base font-bold text-cyan-300">
                          {deterministicScore?.cybersecurity_score ?? assessment?.breakdown?.cve_risk ?? '20'} / 100
                        </div>
                      </div>
                      <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
                        <div className="text-[10px] text-slate-400">Compliance Alignment</div>
                        <div className="text-base font-bold text-emerald-300">
                          {deterministicScore?.compliance_score ?? '95'}%
                        </div>
                      </div>
                      <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
                        <div className="text-[10px] text-slate-400">Operational Resilience</div>
                        <div className="text-base font-bold text-blue-300">
                          {operationalData?.service_availability_pct ?? 99.98}%
                        </div>
                      </div>
                      <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
                        <div className="text-[10px] text-slate-400">Upstream Supply Chain</div>
                        <div className="text-base font-bold text-purple-300">
                          {subVendors.length} Suppliers Tracked
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* 2. DOCUMENTATION HUB TAB */}
              {/* ========================================================================= */}
              {activeTab === 'documentation' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <FileText className="w-5 h-5 text-cyan-400" />
                        <div>
                          <h3 className="text-sm font-bold text-slate-100">Security Documentation & Audit Reports</h3>
                          <p className="text-[10px] text-slate-400">Upload, store, and manage your encrypted security attestations for CISO review</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setUploadModalOpen(true)}
                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" /> Upload Document
                      </button>
                    </div>

                    {documents.length === 0 ? (
                      <div className="text-center py-10 text-xs text-slate-500 border border-dashed border-slate-800 rounded-2xl space-y-2">
                        <FileText className="w-8 h-8 text-slate-600 mx-auto" />
                        <div>No documents uploaded yet. Click 'Upload Document' to submit SOC 2, ISO 27001, or Pentest reports.</div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {documents.map((doc) => (
                          <div key={doc.id} className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                                <FileCheck className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="font-bold text-xs text-white">{doc.title || doc.filename}</div>
                                <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                                  <span className="text-cyan-400 font-semibold">{doc.document_type}</span>
                                  <span>•</span>
                                  <span>{doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'Active'}</span>
                                  {doc.file_size && (
                                    <>
                                      <span>•</span>
                                      <span>{(doc.file_size / 1024).toFixed(1)} KB</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                {doc.status || 'VERIFIED'}
                              </span>
                              <a
                                href={`${API_BASE}/api/documents/${doc.id}/download`}
                                download
                                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-cyan-300 transition-colors"
                                title="Download Encrypted Document"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* 3. OPERATIONAL RISK TAB */}
              {/* ========================================================================= */}
              {activeTab === 'operational' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                      <div className="flex items-center gap-2.5">
                        <Activity className="w-5 h-5 text-blue-400" />
                        <div>
                          <h3 className="text-sm font-bold text-slate-100">Operational Resilience & Service Metrics</h3>
                          <p className="text-[10px] text-slate-400">Live operational telemetry, availability SLAs, BCP, and Disaster Recovery triggers</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleTriggerBcpVerify}
                          disabled={actionLoading}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Trigger BCP Verification
                        </button>
                        <button
                          onClick={handleTriggerDrTest}
                          disabled={actionLoading}
                          className="px-3.5 py-1.5 rounded-xl bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Zap className="w-3.5 h-3.5" /> Run DR Drill Simulation
                        </button>
                      </div>
                    </div>

                    {/* Operational KPIs */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Service Availability SLA</div>
                        <div className="text-2xl font-black text-emerald-400">
                          {operationalData?.service_availability_pct ?? 99.98}%
                        </div>
                        <p className="text-[10px] text-slate-500">Contractual target 99.9% uptime strictly met.</p>
                      </div>

                      <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Business Continuity (BCP)</div>
                        <div className="text-2xl font-black text-white flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          <span>{operationalData?.bcp_status || 'VERIFIED'}</span>
                        </div>
                        <p className="text-[10px] text-slate-500">Last verified: {operationalData?.last_bcp_review || '2026-08-15'}</p>
                      </div>

                      <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Disaster Recovery (DR) Test</div>
                        <div className="text-2xl font-black text-cyan-400">
                          {operationalData?.dr_test_status || 'PASSED'}
                        </div>
                        <p className="text-[10px] text-slate-500">RTO: 15 mins | RPO: 5 mins</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* 4. COMPLIANCE TAB */}
              {/* ========================================================================= */}
              {activeTab === 'compliance' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2.5">
                        <Award className="w-5 h-5 text-cyan-400" />
                        <h3 className="text-sm font-bold text-slate-100">Compliance Frameworks & Certifications</h3>
                      </div>
                      <button
                        onClick={() => setUploadModalOpen(true)}
                        className="px-3.5 py-1.5 rounded-xl bg-cyan-500/20 border border-cyan-500/40 hover:bg-cyan-500/30 text-xs font-bold text-cyan-300 flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" /> Submit New Certificate
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {compliance.length === 0 ? (
                        <div className="col-span-2 text-center py-6 text-xs text-slate-500">No compliance records found.</div>
                      ) : (
                        compliance.map((item) => (
                          <div key={item.id} className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                            <div>
                              <div className="font-bold text-xs text-slate-200">{item.framework_name}</div>
                              <div className="text-[10px] text-slate-400">Valid until {item.valid_until || '2027-12-31'}</div>
                            </div>
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              {item.status || 'COMPLIANT'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* 5. REMEDIATION TASKS TAB */}
              {/* ========================================================================= */}
              {activeTab === 'remediation' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        Enterprise Remediation Tasks Assigned to {v?.name || user?.name}
                      </h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">
                        {remediations.length} Assigned
                      </span>
                    </div>

                    <div className="space-y-3">
                      {remediations.length === 0 ? (
                        <div className="text-center py-8 text-xs text-slate-500 flex flex-col items-center gap-2">
                          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                          <span>All assigned remediation items are up to date and resolved!</span>
                        </div>
                      ) : (
                        remediations.map((task) => (
                          <div key={task.id} className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="font-bold text-xs text-slate-200">{task.title}</div>
                              <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${
                                task.priority === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              }`}>
                                {task.priority}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400">{task.description}</p>
                            <div className="flex items-center justify-between text-[10px] pt-2 border-t border-slate-900">
                              <span className="text-slate-500">Target Deadline: {task.due_date}</span>
                              <span className="text-cyan-400 font-semibold px-2 py-0.5 rounded bg-cyan-950/40 border border-cyan-500/20">{task.status}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* 6. 4TH-PARTY SUPPLY CHAIN TAB */}
              {/* ========================================================================= */}
              {activeTab === 'supply-chain' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Share2 className="w-5 h-5 text-cyan-400" />
                        <div>
                          <h3 className="text-sm font-bold text-slate-100">My Upstream Suppliers (4th-Party Supply Chain)</h3>
                          <p className="text-[10px] text-slate-400">Add & monitor sub-contractors and cloud dependencies powering your services</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSubModalOpen(true);
                          setSubError('');
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Sub-Supplier
                      </button>
                    </div>

                    <div className="space-y-2">
                      {subVendors.length === 0 ? (
                        <div className="text-center py-8 text-xs text-slate-500 border border-dashed border-slate-800 rounded-2xl">
                          No upstream sub-vendors listed. Click 'Add Sub-Supplier' to declare upstream supply chain entities.
                        </div>
                      ) : (
                        subVendors.map((sub) => (
                          <div key={sub.id} className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center font-bold text-xs text-cyan-400">
                                {sub.name.substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-bold text-xs text-slate-100">{sub.name}</div>
                                <div className="text-[10px] text-slate-400 flex items-center gap-2">
                                  <span>{sub.domain}</span>
                                  <span>•</span>
                                  <span>{sub.sector}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Sub-Tier Risk</div>
                                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                                  sub.risk_score >= 70 ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' :
                                  sub.risk_score >= 40 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                                  'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                }`}>
                                  Score {sub.risk_score} / 100
                                </span>
                              </div>
                              <button
                                onClick={() => handleDeleteSubVendor(sub.id)}
                                className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                                title="Remove sub-supplier"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* 7. RISK QUESTIONNAIRE & SCORE TRIGGERS TAB */}
              {/* ========================================================================= */}
              {activeTab === 'questionnaire' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                      <div className="flex items-center gap-2.5">
                        <HelpCircle className="w-5 h-5 text-cyan-400" />
                        <div>
                          <h3 className="text-sm font-bold text-slate-100">Vendor Security & Risk Questionnaire</h3>
                          <p className="text-[10px] text-slate-400">Submitting responses automatically triggers risk engine recalculation</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {!assessmentId ? (
                          <button
                            onClick={handleStartQuestionnaire}
                            disabled={questionnaireSaving}
                            className="px-3.5 py-1.5 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition-all cursor-pointer"
                          >
                            Start New Assessment
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={handleSaveQuestionnaireDraft}
                              disabled={questionnaireSaving}
                              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all cursor-pointer"
                            >
                              Save Draft
                            </button>
                            <button
                              onClick={handleSubmitQuestionnaireAndTriggerScore}
                              disabled={questionnaireSubmitting}
                              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-bold transition-all shadow-md cursor-pointer"
                            >
                              {questionnaireSubmitting ? 'Calculating Score...' : 'Submit & Trigger Score'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {questionnaireMsg && (
                      <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 text-xs flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                        <span>{questionnaireMsg}</span>
                      </div>
                    )}

                    <div className="space-y-4">
                      {QUESTIONNAIRE_ITEMS.map((q, idx) => (
                        <div key={q.id} className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <label className="text-xs font-semibold text-slate-200">
                              {idx + 1}. {q.text}
                            </label>
                            <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-400">
                              {q.category}
                            </span>
                          </div>

                          {q.type === 'YES_NO' && (
                            <div className="flex gap-4 pt-1">
                              {['YES', 'NO'].map(opt => (
                                <label key={opt} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={q.id}
                                    value={opt}
                                    checked={questionnaireAnswers[q.id] === opt}
                                    onChange={(e) => setQuestionnaireAnswers({ ...questionnaireAnswers, [q.id]: e.target.value })}
                                    className="text-cyan-500 focus:ring-0"
                                  />
                                  <span>{opt === 'YES' ? 'Yes, Enforced' : 'No / In Progress'}</span>
                                </label>
                              ))}
                            </div>
                          )}

                          {q.type === 'MULTIPLE_CHOICE' && (
                            <select
                              value={questionnaireAnswers[q.id] || ''}
                              onChange={(e) => setQuestionnaireAnswers({ ...questionnaireAnswers, [q.id]: e.target.value })}
                              className="w-full md:w-64 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 mt-1"
                            >
                              <option value="">Select Option</option>
                              {q.options.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          )}

                          {q.type === 'TEXT' && (
                            <input
                              type="text"
                              value={questionnaireAnswers[q.id] || ''}
                              onChange={(e) => setQuestionnaireAnswers({ ...questionnaireAnswers, [q.id]: e.target.value })}
                              placeholder="e.g. AES-256 at rest, TLS 1.3 in transit..."
                              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:border-cyan-400 focus:outline-none"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* 8. CISO DIRECT CHANNEL TAB */}
              {/* ========================================================================= */}
              {activeTab === 'messages' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-cyan-400" />
                        <h3 className="text-sm font-bold text-slate-100">Enterprise CISO Direct Q&A Channel</h3>
                      </div>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    </div>

                    <div className="space-y-3 min-h-[300px] max-h-[450px] overflow-y-auto p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
                      {messagesList.map((msg, i) => (
                        <div key={i} className={`p-3 rounded-xl text-xs space-y-1 ${
                          msg.sender === (user?.name || 'Vendor Admin')
                            ? 'bg-cyan-950/40 border border-cyan-500/30 text-cyan-100 ml-8'
                            : 'bg-slate-900 border border-slate-700 text-slate-200 mr-8'
                        }`}>
                          <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                            <span>{msg.sender}</span>
                            <span>{msg.timestamp}</span>
                          </div>
                          <div>{msg.text}</div>
                        </div>
                      ))}
                    </div>

                    <form onSubmit={handleSendMessage} className="flex gap-2 pt-2">
                      <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Send secure inquiry or clarification to enterprise CISO..."
                        className="flex-1 bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Send</span>
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* ========================================================================= */}
      {/* Upload Document Modal */}
      {/* ========================================================================= */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Upload className="w-5 h-5 text-cyan-400" /> Upload Security Document
            </h3>

            <form onSubmit={handleUploadDocument} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Document Type</label>
                <select
                  value={docUploadForm.document_type}
                  onChange={(e) => setDocUploadForm({ ...docUploadForm, document_type: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100"
                >
                  <option value="SOC 2 Report">SOC 2 Report</option>
                  <option value="ISO 27001 Certificate">ISO 27001 Certificate</option>
                  <option value="NIST Assessment">NIST Assessment</option>
                  <option value="PCI DSS Report">PCI DSS Report</option>
                  <option value="HIPAA Documentation">HIPAA Documentation</option>
                  <option value="Security Questionnaire">Security Questionnaire</option>
                  <option value="Penetration Test Report">Penetration Test Report</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Document Title</label>
                <input
                  type="text"
                  value={docUploadForm.title}
                  onChange={(e) => setDocUploadForm({ ...docUploadForm, title: e.target.value })}
                  placeholder="e.g. Q3 2026 SOC 2 Type II Final Report"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Select File</label>
                <input
                  type="file"
                  required
                  accept=".pdf,.png,.jpg,.docx,.json"
                  onChange={(e) => {
                    const f = e.target.files[0];
                    if (f) setDocUploadForm({ ...docUploadForm, file: f, title: docUploadForm.title || f.name });
                  }}
                  className="w-full text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-cyan-500/20 file:text-cyan-300"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={docUploading}
                  className="flex-1 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {docUploading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Encrypting & Storing...
                    </>
                  ) : (
                    'Upload Document'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Add Sub-Vendor Modal */}
      {/* ========================================================================= */}
      {subModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-cyan-400" /> Add Upstream Sub-Supplier (4th Party)
            </h3>

            {subError && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <span>{subError}</span>
              </div>
            )}

            <form onSubmit={handleAddSubVendor} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Sub-Supplier Name</label>
                <input
                  type="text"
                  value={newSub.name}
                  onChange={(e) => setNewSub({ ...newSub, name: e.target.value })}
                  placeholder="e.g. Amazon Web Services"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Domain Name (Domain Verification Active)</label>
                <input
                  type="text"
                  value={newSub.domain}
                  onChange={(e) => setNewSub({ ...newSub, domain: e.target.value })}
                  placeholder="aws.amazon.com"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Industry Sector</label>
                <input
                  type="text"
                  value={newSub.sector}
                  onChange={(e) => setNewSub({ ...newSub, sector: e.target.value })}
                  placeholder="Cloud Infrastructure"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSubModalOpen(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={subVerifying}
                  className="flex-1 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {subVerifying ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verifying Domain...
                    </>
                  ) : (
                    'Verify & Add Supplier'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

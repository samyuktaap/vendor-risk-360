import React, { useState, useEffect } from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Cell 
} from 'recharts';
import { 
  Building2, 
  ShieldAlert, 
  TrendingUp, 
  Layers, 
  RefreshCw, 
  Search, 
  Flame, 
  ArrowUpRight, 
  Plus, 
  Activity, 
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  XCircle,
  RotateCcw,
  ShieldCheck,
  Scale,
  History,
  BarChart3,
  Check,
  X,
  Shield,
  Award,
  Bell,
  AlertCircle,
  FileSpreadsheet,
  Clock,
  FileText,
  UserCheck,
  Zap,
  ChevronRight,
  Filter
} from 'lucide-react';

export default function OverviewDashboard({ 
  activeTab = 'overview',
  setActiveTab,
  vendors = [], 
  feed = [], 
  onSelectVendor, 
  onOpenAddModal, 
  onRefreshVendor, 
  onDeleteVendor,
  onNavigateToContagion
}) {
  // Local filter & search state
  const [filterRisk, setFilterRisk] = useState('ALL');
  const [searchFilter, setSearchFilter] = useState('');
  const [refreshingId, setRefreshingId] = useState(null);

  // Vendor selected for Decision Center review
  const [selectedVendorForDecision, setSelectedVendorForDecision] = useState(null);

  // Inline decision panel open state (for All Vendors table row expansion)
  const [decisionPanelVendorId, setDecisionPanelVendorId] = useState(null);
  const [decisionNotes, setDecisionNotes] = useState('');

  // Selected Vendor IDs for Comparison Matrix
  const [compareIds, setCompareIds] = useState([]);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState(null);

  // CISO Vendor Decisions State (Persisted in localStorage)
  const [decisions, setDecisions] = useState(() => {
    try {
      const saved = localStorage.getItem('ciso_vendor_decisions');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // Audit History State (Persisted in localStorage)
  const [auditHistory, setAuditHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('ciso_audit_history');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [
      {
        id: 101,
        action: 'APPROVED',
        vendorName: 'AWS Cloud Services',
        actor: 'Sarah Jenkins (CISO)',
        timestamp: '2026-08-20 08:30:12',
        details: 'Approved enterprise cloud hosting risk posture after SOC 2 review.'
      },
      {
        id: 102,
        action: 'REMEDIATION_REQUESTED',
        vendorName: 'Acme Logistics',
        actor: 'Sarah Jenkins (CISO)',
        timestamp: '2026-08-19 14:15:00',
        details: 'Requested remediation for unpatched CVSS 9.8 vulnerability.'
      },
      {
        id: 103,
        action: 'ESCALATED',
        vendorName: 'Stripe Payments',
        actor: 'Security Operations',
        timestamp: '2026-08-18 11:05:40',
        details: 'Escalated to legal due to upcoming ISO 27001 renewal delay.'
      }
    ];
  });

  // Security Alerts Acknowledged State
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState({});

  // Dashboard API Metrics State
  const [metrics, setMetrics] = useState({
    total_vendors: 0,
    high_risk_vendors: 0,
    pending_assessments: 0,
    expiring_certifications: 0,
    overall_risk_score: 0,
    risk_distribution: { CRITICAL: 0, WATCH: 0, SAFE: 0 },
    risk_trend: []
  });
  const [metricsLoading, setMetricsLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/dashboard/metrics');
        if (res.ok) {
          const data = await res.json();
          setMetrics(data);
        }
      } catch (err) {
        console.error("Failed to fetch dashboard metrics:", err);
      } finally {
        setMetricsLoading(false);
      }
    };
    fetchMetrics();
  }, [vendors]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Requirement 7: Vendor Decision Center Logic (APPROVE, REJECT, REQUEST REMEDIATION, ESCALATE)
  const handleDecisionAction = (vendor, actionType, notes = '') => {
    const actionTitles = {
      APPROVED: 'APPROVED',
      REJECTED: 'REJECTED',
      REMEDIATION_REQUESTED: 'REMEDIATION REQUESTED',
      ESCALATED: 'ESCALATED'
    };

    const newDecisions = {
      ...decisions,
      [vendor.id]: {
        action: actionType,
        timestamp: new Date().toLocaleString(),
        actor: 'CISO Admin',
        notes: notes || `CISO executed ${actionTitles[actionType]} action.`
      }
    };

    setDecisions(newDecisions);
    try {
      localStorage.setItem('ciso_vendor_decisions', JSON.stringify(newDecisions));
    } catch (e) {}

    // Add entry to Audit History (Requirement 9)
    const newAuditEntry = {
      id: Date.now(),
      action: actionType,
      vendorName: vendor.name,
      actor: 'Sarah Jenkins (CISO)',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      details: `Vendor status changed to ${actionTitles[actionType]}. ${notes ? `Notes: ${notes}` : ''}`
    };

    const updatedAudit = [newAuditEntry, ...auditHistory];
    setAuditHistory(updatedAudit);
    try {
      localStorage.setItem('ciso_audit_history', JSON.stringify(updatedAudit));
    } catch (e) {}

    // Optional API call to update vendor status if supported
    fetch(`http://localhost:8000/api/vendors/${vendor.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: actionType })
    }).catch(() => {});

    showToast(`Status updated: ${actionTitles[actionType]} for ${vendor.name}`);
  };

  // Helper calculation functions
  const computeComplianceRate = (v) => {
    const base = 100 - (v.risk_score * 0.65);
    return Math.max(25, Math.min(100, Math.round(base)));
  };

  const getVerificationStatus = (v) => {
    if (v.risk_score >= 75) return 'FAILED';
    if (v.risk_score >= 60) return 'PENDING_REVIEW';
    return 'VERIFIED';
  };

  // Categorize 4 Risk Tiers for Section 1 & 2
  const lowRiskVendors = vendors.filter(v => v.risk_score < 40 || v.risk_tier === 'SAFE' || v.risk_tier === 'LOW');
  const mediumRiskVendors = vendors.filter(v => (v.risk_score >= 40 && v.risk_score < 60) || v.risk_tier === 'WATCH' || v.risk_tier === 'MEDIUM');
  const highRiskVendors = vendors.filter(v => (v.risk_score >= 60 && v.risk_score < 75) || v.risk_tier === 'HIGH');
  const criticalRiskVendors = vendors.filter(v => v.risk_score >= 75 || v.risk_tier === 'CRITICAL');
  
  const highAndCriticalVendors = vendors.filter(v => v.risk_score >= 60 || v.risk_tier === 'CRITICAL' || v.risk_tier === 'HIGH');
  const vendorsPendingReview = vendors.filter(v => {
    const dec = decisions[v.id];
    return !dec || dec.action === 'REMEDIATION_REQUESTED' || getVerificationStatus(v) === 'PENDING_REVIEW';
  });

  // Compliance Breakdown (Requirement 5)
  const compliantVendors = vendors.filter(v => computeComplianceRate(v) >= 85);
  const partiallyCompliantVendors = vendors.filter(v => computeComplianceRate(v) >= 55 && computeComplianceRate(v) < 85);
  const nonCompliantVendors = vendors.filter(v => computeComplianceRate(v) < 55);

  const overallCompliancePercent = vendors.length > 0
    ? Math.round(vendors.reduce((acc, v) => acc + computeComplianceRate(v), 0) / vendors.length)
    : 0;

  // Filtered vendors according to risk tab & search text
  const filteredVendors = vendors.filter(v => {
    const matchesRisk = 
      filterRisk === 'ALL' ? true :
      filterRisk === 'CRITICAL' ? (v.risk_score >= 75 || v.risk_tier === 'CRITICAL') :
      filterRisk === 'HIGH' ? (v.risk_score >= 60 && v.risk_score < 75) :
      filterRisk === 'MEDIUM' ? (v.risk_score >= 40 && v.risk_score < 60) :
      (v.risk_score < 40);

    const matchesSearch = 
      v.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      v.domain.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (v.sector && v.sector.toLowerCase().includes(searchFilter.toLowerCase()));

    return matchesRisk && matchesSearch;
  });

  // CISO Security Alerts (Requirement 6)
  const cisoSecurityAlerts = [
    ...highAndCriticalVendors.map(v => ({
      id: `alert-highrisk-${v.id}`,
      type: 'HIGH_RISK_VENDOR',
      severity: v.risk_score >= 75 ? 'CRITICAL' : 'HIGH',
      title: `High-Risk Vendor Detected: ${v.name}`,
      description: `Risk Score is ${v.risk_score}/100. Vendor requires immediate security decision.`,
      vendor: v,
      timestamp: 'Live Monitor'
    })),
    {
      id: 'alert-failed-verify',
      type: 'FAILED_VERIFICATION',
      severity: 'HIGH',
      title: 'Failed Document Verification Alert',
      description: 'Document signature mismatch detected for 2 vendor SOC 2 submissions.',
      timestamp: '1 hour ago'
    },
    {
      id: 'alert-doc-review',
      type: 'DOC_REVIEW_REQUIRED',
      severity: 'MEDIUM',
      title: 'Compliance Document Requiring Review',
      description: 'Acme Logistics uploaded updated Data Processing Addendum (DPA).',
      timestamp: '3 hours ago'
    },
    {
      id: 'alert-expiring-doc',
      type: 'EXPIRING_COMPLIANCE_DOC',
      severity: 'MEDIUM',
      title: 'Expiring Compliance Certification',
      description: `${metrics.expiring_certifications || 3} Vendor ISO 27001 certifications expiring within 30 days.`,
      timestamp: 'Today'
    },
    {
      id: 'alert-serious-compliance',
      type: 'SERIOUS_COMPLIANCE_ISSUE',
      severity: 'CRITICAL',
      title: 'Serious Compliance Gap Alert',
      description: 'Non-compliant vendor operating in core financial payment pipeline.',
      timestamp: 'Yesterday'
    }
  ];

  // Toggle Vendor Comparison selection
  const toggleCompare = (vId) => {
    if (compareIds.includes(vId)) {
      setCompareIds(compareIds.filter(id => id !== vId));
    } else {
      if (compareIds.length >= 3) {
        showToast("Maximum 3 vendors can be compared side-by-side.");
        return;
      }
      setCompareIds([...compareIds, vId]);
    }
  };

  // Sector Analytics Data (Requirement 8)
  const sectorRiskData = (() => {
    const map = {};
    vendors.forEach(v => {
      const sec = v.sector || 'Other';
      if (!map[sec]) map[sec] = { sector: sec, count: 0, total: 0 };
      map[sec].count += 1;
      map[sec].total += v.risk_score;
    });
    return Object.values(map).map(s => ({
      sector: s.sector,
      avgScore: Math.round(s.total / s.count),
      count: s.count
    }));
  })();

  const handleSingleRefresh = async (e, vendorId) => {
    e.stopPropagation();
    setRefreshingId(vendorId);
    try {
      const res = await fetch(`http://localhost:8000/api/vendors/${vendorId}/refresh`, {
        method: 'POST'
      });
      if (res.ok && onRefreshVendor) {
        onRefreshVendor();
        showToast("Refreshed security risk probes.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshingId(null);
    }
  };

  return (
    <div className="space-y-6 pb-16 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-[#0f172a] border border-cyan-500/50 text-cyan-200 text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce font-mono">
          <CheckCircle2 className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* CISO Header Banner */}
      <div className="bg-[#0a0f1d] border border-slate-800 rounded-2xl p-5 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Shield className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-100 tracking-tight flex items-center gap-2">
              CISO Vendor Risk Governance Command Center
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono font-bold">
                MONITOR → EVALUATE → DECIDE
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Which vendors are risky, why are they risky, and what decision should you take?
            </p>
          </div>
        </div>

        {/* Quick Decision & Onboard Buttons */}
        <div className="flex items-center gap-2">
          {compareIds.length > 0 && (
            <button
              onClick={() => setActiveTab && setActiveTab('comparison')}
              className="px-3 py-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-bold font-mono hover:bg-cyan-500/30 transition-all cursor-pointer"
            >
              Compare ({compareIds.length})
            </button>
          )}
          <button
            onClick={onOpenAddModal}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs py-2 px-3.5 rounded-xl shadow-lg shadow-cyan-950/40 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Onboard Vendor</span>
          </button>
        </div>
      </div>

      {/* REQUIREMENT 1: TOP SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Vendors */}
        <div 
          onClick={() => setActiveTab && setActiveTab('vendors')}
          className="bg-[#0a0f1d] border border-cyan-950/60 rounded-2xl p-4 shadow-xl hover:border-cyan-500/40 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Vendors</span>
            <Building2 className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-100 font-mono">{vendors.length}</span>
            <span className="text-[10px] text-cyan-400 font-mono">Monitored</span>
          </div>
        </div>

        {/* Low Risk Vendors */}
        <div className="bg-[#0a0f1d] border border-emerald-950/60 rounded-2xl p-4 shadow-xl hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Low Risk (&lt;40)</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-400 font-mono">{lowRiskVendors.length}</span>
            <span className="text-[10px] text-emerald-400/80 font-mono">Safe Assets</span>
          </div>
        </div>

        {/* Medium Risk Vendors */}
        <div className="bg-[#0a0f1d] border border-blue-950/60 rounded-2xl p-4 shadow-xl hover:border-blue-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Medium Risk (40-59)</span>
            <Activity className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-400 font-mono">{mediumRiskVendors.length}</span>
            <span className="text-[10px] text-blue-400/80 font-mono">Moderate</span>
          </div>
        </div>

        {/* High / Critical Risk Vendors */}
        <div 
          onClick={() => setActiveTab && setActiveTab('risk-management')}
          className="bg-[#0a0f1d] border border-rose-950/60 rounded-2xl p-4 shadow-xl hover:border-rose-500/50 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">High / Critical (60+)</span>
            <Flame className="w-4 h-4 text-rose-400 animate-pulse" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-400 font-mono">{highAndCriticalVendors.length}</span>
            <span className="text-[10px] text-rose-400/80 font-mono">Action Required</span>
          </div>
        </div>

        {/* Vendors Pending Review */}
        <div 
          onClick={() => setActiveTab && setActiveTab('decisions')}
          className="bg-[#0a0f1d] border border-amber-950/60 rounded-2xl p-4 shadow-xl hover:border-amber-500/40 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Review</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-400 font-mono">{vendorsPendingReview.length}</span>
            <span className="text-[10px] text-amber-400/80 font-mono">Governance Queue</span>
          </div>
        </div>
      </div>

      {/* CONDITIONAL MAIN CONTENT BASED ON CISO SIDEBAR TABS */}

      {/* SECTION 2 & 3: OVERALL VENDOR RISK & RISK TRENDS */}
      {(activeTab === 'overview' || activeTab === 'risk-management') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* REQUIREMENT 3: Risk Trends Graph over time */}
          <div className="lg:col-span-2 bg-[#0a0f1d] border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                  Vendor Risk Score Trends Over Time
                </h3>
                <p className="text-xs text-slate-400">Historical average risk score tracking across enterprise vendor assets</p>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                Live Data Feed
              </span>
            </div>

            {metrics.risk_trend && metrics.risk_trend.length > 0 ? (
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics.risk_trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cisoRiskGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="avg_score" stroke="#06b6d4" strokeWidth={3} fillOpacity={1} fill="url(#cisoRiskGrad)" name="Avg Risk Score" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-60 flex items-center justify-center text-slate-500 text-xs font-mono">
                Calculating risk trends from active database...
              </div>
            )}
          </div>

          {/* REQUIREMENT 2: Overall Vendor Risk Breakdown */}
          <div className="bg-[#0a0f1d] border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-100 mb-1 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                Overall Vendor Risk Distribution
              </h3>
              <p className="text-xs text-slate-400 mb-5">Categorized vendor risk tiers</p>

              <div className="space-y-4 font-mono text-xs">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-rose-400 font-bold">CRITICAL (75+)</span>
                    <span className="text-slate-200">{criticalRiskVendors.length} vendors</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div className="bg-rose-500 h-2 rounded-full" style={{ width: `${(criticalRiskVendors.length / Math.max(1, vendors.length)) * 100}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-amber-400 font-bold">HIGH (60 - 74)</span>
                    <span className="text-slate-200">{highRiskVendors.length} vendors</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${(highRiskVendors.length / Math.max(1, vendors.length)) * 100}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-blue-400 font-bold">MEDIUM (40 - 59)</span>
                    <span className="text-slate-200">{mediumRiskVendors.length} vendors</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${(mediumRiskVendors.length / Math.max(1, vendors.length)) * 100}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-emerald-400 font-bold">LOW (&lt;40)</span>
                    <span className="text-slate-200">{lowRiskVendors.length} vendors</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div className="bg-emerald-400 h-2 rounded-full" style={{ width: `${(lowRiskVendors.length / Math.max(1, vendors.length)) * 100}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">High Risk Exposure:</span>
              <span className="font-bold text-rose-400">
                {Math.round(((highAndCriticalVendors.length) / Math.max(1, vendors.length)) * 100)}% of Portfolio
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ALL VENDORS FULL ROSTER - Only visible on 'vendors' tab */}
      {activeTab === 'vendors' && (
        <div className="bg-[#0a0f1d] border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-cyan-400" />
                All Enterprise Monitored Vendors
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                  {filteredVendors.length} of {vendors.length} Vendors
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Organization-wide view of all third-party vendor assets and their security posture.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search name, domain, sector..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="bg-[#070a12] border border-slate-800 focus:border-cyan-500 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none w-48"
                />
              </div>
              <div className="flex items-center bg-[#070a12] p-1 rounded-xl border border-slate-800">
                {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(tier => (
                  <button
                    key={tier}
                    onClick={() => setFilterRisk(tier)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      filterRisk === tier
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-semibold bg-[#070a12]/80">
                  <th className="py-3 px-4">Vendor &amp; Domain</th>
                  <th className="py-3 px-4">Sector</th>
                  <th className="py-3 px-4 text-center">Risk Score</th>
                  <th className="py-3 px-4">Risk Level</th>
                  <th className="py-3 px-4">Compliance %</th>
                  <th className="py-3 px-4">Verification</th>
                  <th className="py-3 px-4">CISO Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 font-mono">
                {filteredVendors.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-400">
                      {vendors.length === 0
                        ? 'No vendors onboarded yet. Click "Onboard Vendor" to add your first vendor.'
                        : 'No vendors match the selected filter criteria.'}
                    </td>
                  </tr>
                ) : (
                  filteredVendors.map((vendor) => {
                    const isCritical = vendor.risk_score >= 75 || vendor.risk_tier === 'CRITICAL';
                    const isHigh = vendor.risk_score >= 60 && vendor.risk_score < 75;
                    const isMedium = vendor.risk_score >= 40 && vendor.risk_score < 60;
                    const compRate = computeComplianceRate(vendor);
                    const verifyStatus = getVerificationStatus(vendor);
                    const dec = decisions[vendor.id];
                    const isPanelOpen = decisionPanelVendorId === vendor.id;

                    const scoreColor = isCritical
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                      : isHigh
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                      : isMedium
                      ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                      : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';

                    const avatarColor = isCritical
                      ? 'bg-rose-950 border-rose-500/40 text-rose-300'
                      : isHigh
                      ? 'bg-amber-950 border-amber-500/40 text-amber-300'
                      : isMedium
                      ? 'bg-blue-950 border-blue-500/40 text-blue-300'
                      : 'bg-emerald-950 border-emerald-500/40 text-emerald-300';

                    const subScores = [
                      { label: 'Data Breach (HIBP)', value: vendor.hibp_score ?? Math.round(vendor.risk_score * 0.35), color: 'bg-rose-500', textColor: 'text-rose-400' },
                      { label: 'News / Reputation', value: vendor.news_score ?? Math.round(vendor.risk_score * 0.25), color: 'bg-amber-500', textColor: 'text-amber-400' },
                      { label: 'Sanctions Exposure', value: vendor.sanctions_score ?? Math.round(vendor.risk_score * 0.2), color: 'bg-purple-500', textColor: 'text-purple-400' },
                      { label: 'IP Abuse Intel', value: vendor.abuse_score ?? Math.round(vendor.risk_score * 0.2), color: 'bg-blue-500', textColor: 'text-blue-400' },
                    ];

                    const mockDocs = [
                      { name: 'SOC 2 Type II Report', status: vendor.risk_score >= 75 ? 'MISSING' : 'UPLOADED', date: '2026-07-15' },
                      { name: 'ISO 27001 Certificate', status: vendor.risk_score >= 60 ? 'EXPIRED' : 'VERIFIED', date: '2026-06-01' },
                      { name: 'Data Processing Addendum', status: 'UPLOADED', date: '2026-08-01' },
                      { name: 'Penetration Test Report', status: vendor.risk_score >= 70 ? 'PENDING_REVIEW' : 'VERIFIED', date: '2026-05-20' },
                    ];

                    return (
                      <React.Fragment key={vendor.id}>
                        <tr className={`transition-colors ${isPanelOpen ? 'bg-slate-800/25 border-l-2 border-l-cyan-500' : 'hover:bg-slate-800/20'}`}>
                          {/* Vendor Name & Domain */}
                          <td className="py-3.5 px-4">
                            <div
                              onClick={() => onSelectVendor(vendor.id)}
                              className="flex items-center gap-3 cursor-pointer group"
                            >
                              <div className={`w-9 h-9 rounded-xl border flex items-center justify-center font-bold ${avatarColor}`}>
                                {vendor.name.charAt(0)}
                              </div>
                              <div>
                                <div className="font-bold text-slate-100 group-hover:text-cyan-300 transition-colors">
                                  {vendor.name}
                                </div>
                                <div className="text-[11px] text-slate-400">{vendor.domain}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-300 font-sans">{vendor.sector}</td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`text-sm font-black px-2.5 py-0.5 rounded-full border ${scoreColor}`}>
                              {vendor.risk_score}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${scoreColor}`}>
                              {isCritical ? 'CRITICAL' : isHigh ? 'HIGH' : isMedium ? 'MEDIUM' : 'LOW'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-200 font-bold">{compRate}%</span>
                              <div className="w-14 bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
                                <div className={`h-1.5 rounded-full ${compRate >= 85 ? 'bg-emerald-400' : compRate >= 55 ? 'bg-amber-400' : 'bg-rose-500'}`} style={{ width: `${compRate}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${verifyStatus === 'VERIFIED' ? 'bg-emerald-500/20 text-emerald-400' : verifyStatus === 'PENDING_REVIEW' ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400'}`}>
                              {verifyStatus}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-sans">
                            {dec ? (
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${dec.action === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : dec.action === 'REJECTED' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : dec.action === 'ESCALATED' ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-amber-500/20 text-amber-300 border-amber-500/40'}`}>
                                {dec.action.replace(/_/g, ' ')}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500 italic">Monitoring</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right font-sans">
                            <button
                              onClick={() => { setDecisionPanelVendorId(isPanelOpen ? null : vendor.id); setDecisionNotes(''); }}
                              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${isPanelOpen ? 'bg-cyan-500/30 text-cyan-200 border-cyan-400/60' : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/20'}`}
                            >
                              {isPanelOpen ? '▲ Close' : '▼ Decide'}
                            </button>
                          </td>
                        </tr>

                        {/* ── INLINE DECISION PANEL ── */}
                        {isPanelOpen && (
                          <tr>
                            <td colSpan="8" className="p-0 border-b border-slate-700/80">
                              <div className="bg-gradient-to-br from-[#06091a] to-[#0a0f1d] border-l-2 border-l-cyan-500 p-6 space-y-5">

                                {/* Panel Header */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                                  <div>
                                    <h4 className="text-base font-black text-slate-100 flex items-center gap-2">
                                      <ShieldAlert className="w-5 h-5 text-cyan-400" />
                                      {vendor.name} — CISO Decision Panel
                                    </h4>
                                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">{vendor.domain} · {vendor.sector} · Added: {vendor.created_at ? new Date(vendor.created_at).toLocaleDateString() : 'N/A'}</p>
                                  </div>
                                  <div className="flex items-center gap-5 font-mono">
                                    <div className="text-center">
                                      <div className="text-[9px] text-slate-400 uppercase tracking-wider">Risk Score</div>
                                      <div className={`text-2xl font-black ${isCritical ? 'text-rose-400' : isHigh ? 'text-amber-400' : isMedium ? 'text-blue-400' : 'text-emerald-400'}`}>
                                        {vendor.risk_score}<span className="text-xs text-slate-600">/100</span>
                                      </div>
                                    </div>
                                    <div className="text-center border-l border-slate-700 pl-5">
                                      <div className="text-[9px] text-slate-400 uppercase tracking-wider">Compliance</div>
                                      <div className="text-2xl font-black text-cyan-400">{compRate}<span className="text-xs text-slate-600">%</span></div>
                                    </div>
                                    <div className="text-center border-l border-slate-700 pl-5">
                                      <div className="text-[9px] text-slate-400 uppercase tracking-wider">Verification</div>
                                      <div className={`text-sm font-bold mt-1 ${verifyStatus === 'VERIFIED' ? 'text-emerald-400' : verifyStatus === 'PENDING_REVIEW' ? 'text-amber-400' : 'text-rose-400'}`}>
                                        {verifyStatus.replace(/_/g,' ')}
                                      </div>
                                    </div>
                                    <span className={`px-3 py-1.5 rounded-full text-[10px] font-extrabold uppercase border ${isCritical ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : isHigh ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : isMedium ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'}`}>
                                      {isCritical ? 'CRITICAL' : isHigh ? 'HIGH' : isMedium ? 'MEDIUM' : 'LOW'} RISK
                                    </span>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                                  {/* COL 1: Risk Sub-Score Breakdown */}
                                  <div className="space-y-3">
                                    <h5 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                      <ShieldAlert className="w-3.5 h-3.5 text-rose-400" /> Risk Intel Breakdown
                                    </h5>
                                    {subScores.map(s => (
                                      <div key={s.label}>
                                        <div className="flex justify-between text-[10px] mb-1">
                                          <span className="text-slate-400">{s.label}</span>
                                          <span className={`font-bold font-mono ${s.textColor}`}>{s.value}/100</span>
                                        </div>
                                        <div className="w-full bg-slate-900 rounded-full h-2 border border-slate-800 overflow-hidden">
                                          <div className={`h-2 rounded-full ${s.color}`} style={{ width: `${s.value}%` }} />
                                        </div>
                                        <div className="text-[9px] mt-0.5 text-slate-500">{s.value >= 70 ? '⚠ Elevated' : s.value >= 40 ? '~ Moderate' : '✓ Acceptable'}</div>
                                      </div>
                                    ))}
                                    <div className="mt-3 pt-3 border-t border-slate-800 text-[10px] font-mono space-y-1.5">
                                      <div className="flex justify-between"><span className="text-slate-400">Last Assessed</span><span className="text-slate-200">{vendor.last_checked_at ? new Date(vendor.last_checked_at).toLocaleDateString() : 'N/A'}</span></div>
                                      <div className="flex justify-between"><span className="text-slate-400">Previous Decision</span><span className={`font-bold ${dec ? 'text-cyan-300' : 'text-slate-500 italic'}`}>{dec ? dec.action.replace(/_/g,' ') : 'None recorded'}</span></div>
                                    </div>
                                  </div>

                                  {/* COL 2: Compliance Documents */}
                                  <div className="space-y-3">
                                    <h5 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                      <FileText className="w-3.5 h-3.5 text-cyan-400" /> Compliance Documents
                                    </h5>
                                    {mockDocs.map(doc => (
                                      <div key={doc.name} className="flex items-center justify-between bg-[#070a12] border border-slate-800 rounded-xl px-3 py-2.5">
                                        <div>
                                          <div className="text-[11px] font-semibold text-slate-200">{doc.name}</div>
                                          <div className="text-[10px] text-slate-500 font-mono">Submitted: {doc.date}</div>
                                        </div>
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${doc.status === 'VERIFIED' ? 'bg-emerald-500/20 text-emerald-400' : doc.status === 'UPLOADED' ? 'bg-blue-500/20 text-blue-400' : doc.status === 'PENDING_REVIEW' ? 'bg-amber-500/20 text-amber-400' : doc.status === 'EXPIRED' ? 'bg-orange-500/20 text-orange-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                          {doc.status.replace(/_/g,' ')}
                                        </span>
                                      </div>
                                    ))}
                                  </div>

                                  {/* COL 3: Governance Decision */}
                                  <div className="space-y-3">
                                    <h5 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                      <CheckSquare className="w-3.5 h-3.5 text-emerald-400" /> Governance Decision
                                    </h5>
                                    <textarea
                                      rows={3}
                                      placeholder="Add decision notes / justification (optional)..."
                                      value={decisionNotes}
                                      onChange={e => setDecisionNotes(e.target.value)}
                                      className="w-full bg-[#070a12] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none resize-none placeholder:text-slate-600"
                                    />
                                    <div className="grid grid-cols-2 gap-2">
                                      <button onClick={() => { handleDecisionAction(vendor, 'APPROVED', decisionNotes); setDecisionPanelVendorId(null); }} className="py-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> APPROVE
                                      </button>
                                      <button onClick={() => { handleDecisionAction(vendor, 'REJECTED', decisionNotes); setDecisionPanelVendorId(null); }} className="py-2.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer">
                                        <XCircle className="w-3.5 h-3.5" /> REJECT
                                      </button>
                                      <button onClick={() => { handleDecisionAction(vendor, 'REMEDIATION_REQUESTED', decisionNotes); setDecisionPanelVendorId(null); }} className="py-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer">
                                        <RotateCcw className="w-3.5 h-3.5" /> REMEDIATE
                                      </button>
                                      <button onClick={() => { handleDecisionAction(vendor, 'ESCALATED', decisionNotes); setDecisionPanelVendorId(null); }} className="py-2.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer">
                                        <AlertTriangle className="w-3.5 h-3.5" /> ESCALATE
                                      </button>
                                    </div>
                                    <button onClick={() => onSelectVendor(vendor.id)} className="w-full py-2 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer">
                                      <ChevronRight className="w-3.5 h-3.5" /> Open Full Vendor Profile
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RISK MANAGEMENT: DEDICATED PER-VENDOR RISK INTELLIGENCE VIEW */}
      {activeTab === 'risk-management' && (
        <div className="space-y-4">
          <div className="bg-[#0a0f1d] border border-rose-950/50 rounded-2xl p-5 shadow-xl">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 mb-1">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
              Vendor Risk Intelligence Center
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30">{vendors.length} Vendors Monitored</span>
            </h3>
            <p className="text-xs text-slate-400">Sorted by risk severity · Sub-scores: Data Breach · News Reputation · Sanctions Exposure · IP Abuse</p>
          </div>

          <div className="space-y-3">
            {[...vendors].sort((a, b) => b.risk_score - a.risk_score).map(vendor => {
              const isCritical = vendor.risk_score >= 75;
              const isHigh = vendor.risk_score >= 60 && vendor.risk_score < 75;
              const isMedium = vendor.risk_score >= 40 && vendor.risk_score < 60;
              const compRate = computeComplianceRate(vendor);
              const dec = decisions[vendor.id];
              const riskLabel = isCritical ? 'CRITICAL' : isHigh ? 'HIGH' : isMedium ? 'MEDIUM' : 'LOW';
              const borderColor = isCritical ? 'border-rose-900/80' : isHigh ? 'border-amber-900/70' : isMedium ? 'border-blue-900/50' : 'border-emerald-900/40';
              const headerBg = isCritical ? 'bg-rose-950/25' : isHigh ? 'bg-amber-950/15' : isMedium ? 'bg-blue-950/15' : 'bg-emerald-950/10';
              const avatarCls = isCritical ? 'bg-rose-950 border-rose-500/40 text-rose-300' : isHigh ? 'bg-amber-950 border-amber-500/40 text-amber-300' : isMedium ? 'bg-blue-950 border-blue-500/40 text-blue-300' : 'bg-emerald-950 border-emerald-500/40 text-emerald-300';
              const scoreTextColor = isCritical ? 'text-rose-400' : isHigh ? 'text-amber-400' : isMedium ? 'text-blue-400' : 'text-emerald-400';
              const badgeCls = isCritical ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : isHigh ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : isMedium ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';

              const subScores = [
                { label: 'Data Breach (HIBP)', value: vendor.hibp_score ?? Math.round(vendor.risk_score * 0.35), color: 'bg-rose-500', textColor: 'text-rose-400' },
                { label: 'News / Reputation', value: vendor.news_score ?? Math.round(vendor.risk_score * 0.25), color: 'bg-amber-500', textColor: 'text-amber-400' },
                { label: 'Sanctions Exposure', value: vendor.sanctions_score ?? Math.round(vendor.risk_score * 0.2), color: 'bg-purple-500', textColor: 'text-purple-400' },
                { label: 'IP Abuse Intel', value: vendor.abuse_score ?? Math.round(vendor.risk_score * 0.2), color: 'bg-blue-500', textColor: 'text-blue-400' },
              ];

              return (
                <div key={vendor.id} className={`bg-[#0a0f1d] border ${borderColor} rounded-2xl shadow-xl overflow-hidden`}>
                  <div className={`${headerBg} p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center font-black text-sm ${avatarCls}`}>{vendor.name.charAt(0)}</div>
                      <div>
                        <div onClick={() => onSelectVendor(vendor.id)} className="font-bold text-slate-100 hover:text-cyan-300 cursor-pointer transition-colors flex items-center gap-2">
                          {vendor.name}
                          {dec && <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${dec.action === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : dec.action === 'REJECTED' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : dec.action === 'ESCALATED' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>{dec.action.replace(/_/g,' ')}</span>}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">{vendor.domain} · {vendor.sector}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 font-mono">
                      <div className="text-center">
                        <div className="text-[9px] text-slate-400 uppercase">Overall Score</div>
                        <div className={`text-2xl font-black ${scoreTextColor}`}>{vendor.risk_score}<span className="text-xs text-slate-600">/100</span></div>
                      </div>
                      <span className={`px-3 py-1.5 rounded-full text-[10px] font-extrabold uppercase border ${badgeCls}`}>{riskLabel}</span>
                      <div className="text-center border-l border-slate-700 pl-4">
                        <div className="text-[9px] text-slate-400 uppercase">Compliance</div>
                        <div className="text-xl font-black text-cyan-400">{compRate}%</div>
                      </div>
                      <button onClick={() => setSelectedVendorForDecision(vendor)} className="px-3 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 text-xs font-bold transition-all cursor-pointer">
                        Review &amp; Decide
                      </button>
                    </div>
                  </div>
                  <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    {subScores.map(s => (
                      <div key={s.label}>
                        <div className="flex justify-between text-[10px] mb-1.5">
                          <span className="text-slate-400">{s.label}</span>
                          <span className={`font-bold font-mono ${s.textColor}`}>{s.value}</span>
                        </div>
                        <div className="w-full bg-slate-900 rounded-full h-2.5 border border-slate-800 overflow-hidden">
                          <div className={`h-2.5 rounded-full ${s.color}`} style={{ width: `${s.value}%` }} />
                        </div>
                        <div className="text-[9px] mt-1 text-slate-500">{s.value >= 70 ? '⚠ Elevated' : s.value >= 40 ? '~ Moderate' : '✓ Acceptable'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* REQUIREMENT 4: HIGH-RISK VENDORS PROMINENT TABLE (overview only) */}
      {activeTab === 'overview' && (
        <div className="bg-[#0a0f1d] border border-rose-950/60 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-5 border-b border-slate-800 bg-rose-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Flame className="w-5 h-5 text-rose-400 animate-pulse" />
                High &amp; Critical Risk Vendors Spotlight
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  {highAndCriticalVendors.length} Priority Targets
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Which vendors are risky, why are they risky, and what decision should you take?
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Filter vendors..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="bg-[#070a12] border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-semibold bg-[#070a12]/80">
                  <th className="py-3 px-4">Vendor</th>
                  <th className="py-3 px-4 text-center">Risk Score</th>
                  <th className="py-3 px-4">Risk Level</th>
                  <th className="py-3 px-4">Compliance %</th>
                  <th className="py-3 px-4">Verification</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {highAndCriticalVendors.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-slate-400">
                      No vendors currently exceeding high-risk threshold.
                    </td>
                  </tr>
                ) : (
                  highAndCriticalVendors.map((vendor) => {
                    const dec = decisions[vendor.id];
                    const compRate = computeComplianceRate(vendor);
                    const verifyStatus = getVerificationStatus(vendor);

                    return (
                      <tr key={vendor.id} className="hover:bg-slate-800/40 transition-colors">
                        {/* Vendor Name & Domain */}
                        <td className="py-3.5 px-4 font-sans">
                          <div 
                            onClick={() => onSelectVendor(vendor.id)}
                            className="flex items-center gap-3 cursor-pointer group"
                          >
                            <div className="w-9 h-9 rounded-xl bg-rose-950 border border-rose-500/40 flex items-center justify-center font-bold text-rose-300">
                              {vendor.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-slate-100 group-hover:text-cyan-300 transition-colors flex items-center gap-2">
                                {vendor.name}
                                {dec && (
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                    dec.action === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                                    dec.action === 'REJECTED' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                                    dec.action === 'ESCALATED' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                                    'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  }`}>
                                    {dec.action.replace('_', ' ')}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono">{vendor.domain}</div>
                            </div>
                          </div>
                        </td>

                        {/* Risk Score */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="text-base font-black px-3 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40">
                            {vendor.risk_score}
                          </span>
                        </td>

                        {/* Risk Level */}
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            {vendor.risk_score >= 75 ? 'CRITICAL' : 'HIGH'}
                          </span>
                        </td>

                        {/* Compliance % */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-200 font-bold">{compRate}%</span>
                            <div className="w-16 bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
                              <div className={`h-1.5 rounded-full ${compRate >= 85 ? 'bg-emerald-400' : compRate >= 55 ? 'bg-amber-400' : 'bg-rose-500'}`} style={{ width: `${compRate}%` }}></div>
                            </div>
                          </div>
                        </td>

                        {/* Verification Status */}
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            verifyStatus === 'VERIFIED' ? 'bg-emerald-500/20 text-emerald-400' :
                            verifyStatus === 'PENDING_REVIEW' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-rose-500/20 text-rose-400'
                          }`}>
                            {verifyStatus}
                          </span>
                        </td>

                        {/* Action Button */}
                        <td className="py-3.5 px-4 text-right font-sans">
                          <button
                            onClick={() => setSelectedVendorForDecision(vendor)}
                            className="px-3 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 text-xs font-bold transition-all cursor-pointer"
                          >
                            Review &amp; Decide
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── COMPLIANCE OVERVIEW (dedicated full page) ─── */}
      {activeTab === 'compliance-overview' && (
        <div className="space-y-5">
          {/* Header */}
          <div className="bg-[#0a0f1d] border border-cyan-950/60 rounded-2xl p-5 shadow-xl">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 mb-1">
              <Award className="w-5 h-5 text-cyan-400" />
              Vendor Compliance Overview
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">{vendors.length} Vendors</span>
            </h3>
            <p className="text-xs text-slate-400">Full compliance posture across all monitored vendors. Track certifications, document status, and audit readiness.</p>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
            <div className="bg-[#0a0f1d] border border-emerald-900/60 rounded-2xl p-5 shadow-xl">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Fully Compliant</div>
              <div className="text-3xl font-black text-emerald-400 mt-2">{compliantVendors.length}</div>
              <div className="text-[10px] text-emerald-400/70 mt-1">Compliance Rate ≥ 85%</div>
            </div>
            <div className="bg-[#0a0f1d] border border-amber-900/60 rounded-2xl p-5 shadow-xl">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Partially Compliant</div>
              <div className="text-3xl font-black text-amber-400 mt-2">{partiallyCompliantVendors.length}</div>
              <div className="text-[10px] text-amber-400/70 mt-1">Compliance Rate 55–84%</div>
            </div>
            <div className="bg-[#0a0f1d] border border-rose-900/60 rounded-2xl p-5 shadow-xl">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Non-Compliant</div>
              <div className="text-3xl font-black text-rose-400 mt-2">{nonCompliantVendors.length}</div>
              <div className="text-[10px] text-rose-400/70 mt-1">Compliance Rate &lt; 55%</div>
            </div>
            <div className="bg-[#0a0f1d] border border-cyan-900/60 rounded-2xl p-5 shadow-xl">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Portfolio Average</div>
              <div className="text-3xl font-black text-cyan-400 mt-2">{overallCompliancePercent}%</div>
              <div className="text-[10px] text-cyan-400/70 mt-1">Overall Compliance Rate</div>
            </div>
          </div>

          {/* Overall compliance bar */}
          <div className="bg-[#0a0f1d] border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-slate-300 font-semibold">Portfolio Compliance Health</span>
              <span className="font-mono font-bold text-cyan-400">{overallCompliancePercent}%</span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-4 border border-slate-800 overflow-hidden flex">
              <div className="h-4 bg-emerald-500 transition-all" style={{ width: `${(compliantVendors.length / Math.max(1, vendors.length)) * 100}%` }} />
              <div className="h-4 bg-amber-500 transition-all" style={{ width: `${(partiallyCompliantVendors.length / Math.max(1, vendors.length)) * 100}%` }} />
              <div className="h-4 bg-rose-500 transition-all" style={{ width: `${(nonCompliantVendors.length / Math.max(1, vendors.length)) * 100}%` }} />
            </div>
            <div className="flex gap-4 mt-2 text-[10px] font-mono">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>Compliant</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block"/>Partial</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block"/>Non-Compliant</span>
            </div>
          </div>

          {/* Per-vendor compliance table */}
          <div className="bg-[#0a0f1d] border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
                Per-Vendor Compliance Breakdown
              </h4>
              <span className="text-[10px] font-mono text-slate-400">{vendors.length} vendors tracked</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#070a12] text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                    <th className="py-3 px-4">Vendor</th>
                    <th className="py-3 px-4 text-center">Compliance %</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">SOC 2</th>
                    <th className="py-3 px-4">ISO 27001</th>
                    <th className="py-3 px-4">DPA</th>
                    <th className="py-3 px-4">Risk Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 font-mono">
                  {[...vendors].sort((a, b) => computeComplianceRate(a) - computeComplianceRate(b)).map(vendor => {
                    const rate = computeComplianceRate(vendor);
                    const statusLabel = rate >= 85 ? 'COMPLIANT' : rate >= 55 ? 'PARTIAL' : 'NON-COMPLIANT';
                    const statusColor = rate >= 85 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : rate >= 55 ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-rose-500/20 text-rose-400 border-rose-500/40';
                    const soc2 = vendor.risk_score >= 75 ? 'MISSING' : 'UPLOADED';
                    const iso = vendor.risk_score >= 60 ? 'EXPIRED' : 'VERIFIED';
                    const docColor = (s) => s === 'VERIFIED' || s === 'UPLOADED' ? 'text-emerald-400' : s === 'EXPIRED' ? 'text-orange-400' : 'text-rose-400';
                    return (
                      <tr key={vendor.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="py-3 px-4">
                          <div onClick={() => onSelectVendor(vendor.id)} className="flex items-center gap-2 cursor-pointer group">
                            <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 group-hover:text-cyan-300 transition-colors">
                              {vendor.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-slate-100 group-hover:text-cyan-300 transition-colors">{vendor.name}</div>
                              <div className="text-[10px] text-slate-500">{vendor.domain}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-100">{rate}%</span>
                            <div className="flex-1 bg-slate-900 rounded-full h-1.5 border border-slate-800 overflow-hidden min-w-[60px]">
                              <div className={`h-1.5 rounded-full ${rate >= 85 ? 'bg-emerald-400' : rate >= 55 ? 'bg-amber-400' : 'bg-rose-500'}`} style={{ width: `${rate}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${statusColor}`}>{statusLabel}</span>
                        </td>
                        <td className={`py-3 px-4 font-semibold ${docColor(soc2)}`}>{soc2}</td>
                        <td className={`py-3 px-4 font-semibold ${docColor(iso)}`}>{iso}</td>
                        <td className="py-3 px-4 text-emerald-400 font-semibold">UPLOADED</td>
                        <td className="py-3 px-4">
                          <span className={`font-mono font-bold ${vendor.risk_score >= 75 ? 'text-rose-400' : vendor.risk_score >= 60 ? 'text-amber-400' : vendor.risk_score >= 40 ? 'text-blue-400' : 'text-emerald-400'}`}>
                            {vendor.risk_score}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── SECURITY ALERTS (dedicated full page) ─── */}
      {activeTab === 'alerts' && (
        <div className="space-y-5">
          {/* Header */}
          <div className="bg-[#0a0f1d] border border-amber-950/60 rounded-2xl p-5 shadow-xl">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 mb-1">
              <Bell className="w-5 h-5 text-amber-400 animate-pulse" />
              CISO Security Alerts Hub
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/30">
                {cisoSecurityAlerts.filter(a => !acknowledgedAlerts[a.id]).length} Active
              </span>
            </h3>
            <p className="text-xs text-slate-400">Real-time security alerts requiring CISO attention. Acknowledge alerts to mark them as reviewed.</p>
          </div>

          {/* Alert Stats */}
          <div className="grid grid-cols-3 gap-4 font-mono">
            <div className="bg-[#0a0f1d] border border-rose-900/60 rounded-2xl p-4 shadow-xl">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Critical Alerts</div>
              <div className="text-2xl font-black text-rose-400 mt-1">
                {cisoSecurityAlerts.filter(a => a.severity === 'CRITICAL').length}
              </div>
            </div>
            <div className="bg-[#0a0f1d] border border-amber-900/60 rounded-2xl p-4 shadow-xl">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">High Alerts</div>
              <div className="text-2xl font-black text-amber-400 mt-1">
                {cisoSecurityAlerts.filter(a => a.severity === 'HIGH').length}
              </div>
            </div>
            <div className="bg-[#0a0f1d] border border-slate-700/60 rounded-2xl p-4 shadow-xl">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Acknowledged</div>
              <div className="text-2xl font-black text-slate-400 mt-1">
                {Object.values(acknowledgedAlerts).filter(Boolean).length}
              </div>
            </div>
          </div>

          {/* CRITICAL alerts first */}
          {['CRITICAL', 'HIGH', 'MEDIUM'].map(sev => {
            const sevAlerts = cisoSecurityAlerts.filter(a => a.severity === sev);
            if (sevAlerts.length === 0) return null;
            const sevColor = sev === 'CRITICAL' ? 'text-rose-400 border-rose-900/60 bg-rose-950/20' : sev === 'HIGH' ? 'text-amber-400 border-amber-900/60 bg-amber-950/15' : 'text-blue-400 border-blue-900/50 bg-blue-950/10';
            const badgeColor = sev === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400 border-rose-500/40' : sev === 'HIGH' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-blue-500/20 text-blue-400 border-blue-500/40';
            const icon = sev === 'CRITICAL' ? <AlertCircle className="w-4 h-4 text-rose-400 animate-pulse" /> : sev === 'HIGH' ? <AlertTriangle className="w-4 h-4 text-amber-400" /> : <Bell className="w-4 h-4 text-blue-400" />;
            return (
              <div key={sev} className={`bg-[#0a0f1d] border rounded-2xl shadow-xl overflow-hidden ${sevColor}`}>
                <div className={`p-4 border-b border-slate-800 flex items-center gap-2 ${sev === 'CRITICAL' ? 'bg-rose-950/25' : sev === 'HIGH' ? 'bg-amber-950/15' : 'bg-blue-950/10'}`}>
                  {icon}
                  <span className={`text-sm font-bold uppercase tracking-wider ${sev === 'CRITICAL' ? 'text-rose-300' : sev === 'HIGH' ? 'text-amber-300' : 'text-blue-300'}`}>{sev} Priority Alerts</span>
                  <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${badgeColor}`}>{sevAlerts.length}</span>
                </div>
                <div className="divide-y divide-slate-800/50">
                  {sevAlerts.map(alert => (
                    <div key={alert.id} className={`p-4 flex items-start justify-between gap-4 text-xs transition-colors ${acknowledgedAlerts[alert.id] ? 'opacity-50' : 'hover:bg-slate-800/20'}`}>
                      <div className="flex-1">
                        <div className="font-bold text-slate-100 flex items-center gap-2 mb-1">
                          {alert.title}
                          {acknowledgedAlerts[alert.id] && <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 font-mono">ACKNOWLEDGED</span>}
                        </div>
                        <p className="text-slate-400 text-[11px] leading-relaxed">{alert.description}</p>
                        <p className="text-slate-600 text-[10px] font-mono mt-1">{alert.timestamp || 'Live Monitor'}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {alert.vendor && (
                          <button
                            onClick={() => setSelectedVendorForDecision(alert.vendor)}
                            className="px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-[10px] font-semibold hover:bg-cyan-500/20 cursor-pointer transition-all"
                          >
                            Review Vendor
                          </button>
                        )}
                        <button
                          onClick={() => { setAcknowledgedAlerts({ ...acknowledgedAlerts, [alert.id]: true }); showToast("Alert acknowledged."); }}
                          disabled={acknowledgedAlerts[alert.id]}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border cursor-pointer transition-all ${acknowledgedAlerts[alert.id] ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'}`}
                        >
                          {acknowledgedAlerts[alert.id] ? 'Done ✓' : 'Acknowledge'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── OVERVIEW: compact 2-col side-by-side of Compliance + Alerts ─── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Compliance Summary */}
          <div className="bg-[#0a0f1d] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Award className="w-5 h-5 text-cyan-400" />
              Vendor Compliance Overview
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
              <div className="p-3 rounded-xl bg-[#070a12] border border-slate-800">
                <span className="text-[10px] text-slate-400">Compliant</span>
                <div className="text-xl font-bold text-emerald-400 mt-1">{compliantVendors.length}</div>
              </div>
              <div className="p-3 rounded-xl bg-[#070a12] border border-slate-800">
                <span className="text-[10px] text-slate-400">Partially</span>
                <div className="text-xl font-bold text-amber-400 mt-1">{partiallyCompliantVendors.length}</div>
              </div>
              <div className="p-3 rounded-xl bg-[#070a12] border border-slate-800">
                <span className="text-[10px] text-slate-400">Non-Compliant</span>
                <div className="text-xl font-bold text-rose-400 mt-1">{nonCompliantVendors.length}</div>
              </div>
              <div className="p-3 rounded-xl bg-[#070a12] border border-slate-800">
                <span className="text-[10px] text-slate-400">Overall Rate</span>
                <div className="text-xl font-bold text-cyan-400 mt-1">{overallCompliancePercent}%</div>
              </div>
            </div>
            <button onClick={() => setActiveTab && setActiveTab('compliance-overview')} className="w-full py-2 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer">
              <ChevronRight className="w-3.5 h-3.5" /> View Full Compliance Report
            </button>
          </div>

          {/* Alerts Summary */}
          <div className="bg-[#0a0f1d] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-400" />
              CISO Security Alerts Hub
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/30">
                {cisoSecurityAlerts.filter(a => !acknowledgedAlerts[a.id]).length} Active
              </span>
            </h3>
            <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
              {cisoSecurityAlerts.map(alert => (
                <div key={alert.id} className="p-3 rounded-xl bg-[#070a12] border border-slate-800 flex items-start justify-between gap-3 text-xs">
                  <div>
                    <div className="font-bold text-slate-200 flex items-center gap-2">
                      {alert.title}
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${alert.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400' : alert.severity === 'HIGH' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                        {alert.severity}
                      </span>
                    </div>
                    <p className="text-slate-400 text-[11px] mt-0.5">{alert.description}</p>
                  </div>
                  <button
                    onClick={() => { setAcknowledgedAlerts({ ...acknowledgedAlerts, [alert.id]: true }); showToast("Alert acknowledged."); }}
                    disabled={acknowledgedAlerts[alert.id]}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-[10px] font-semibold border border-slate-700 cursor-pointer flex-shrink-0"
                  >
                    {acknowledgedAlerts[alert.id] ? 'Done ✓' : 'Ack'}
                  </button>
                </div>
              ))}
            </div>
            <button onClick={() => setActiveTab && setActiveTab('alerts')} className="w-full py-2 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer">
              <ChevronRight className="w-3.5 h-3.5" /> View All Alerts
            </button>
          </div>
        </div>
      )}

      {/* SECTION 7: VENDOR DECISION CENTER (VERY IMPORTANT) */}
      {(activeTab === 'overview' || activeTab === 'decisions' || selectedVendorForDecision) && (
        <div className="bg-[#0a0f1d] border border-cyan-950/80 rounded-2xl p-6 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-cyan-400" />
                Vendor Decision &amp; Governance Center
              </h3>
              <p className="text-xs text-slate-400">
                Execute CISO enterprise governance decisions on target vendor assets.
              </p>
            </div>

            {/* Target Vendor Select */}
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="text-slate-400">Select Vendor:</span>
              <select
                value={selectedVendorForDecision?.id || ''}
                onChange={(e) => {
                  const found = vendors.find(v => v.id === Number(e.target.value));
                  setSelectedVendorForDecision(found || null);
                }}
                className="bg-[#070a12] border border-slate-800 rounded-xl px-3 py-1.5 text-slate-200 focus:border-cyan-500 focus:outline-none cursor-pointer"
              >
                <option value="">-- Choose Vendor to Decide --</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.risk_score} score - {v.risk_tier})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedVendorForDecision ? (
            <div className="p-5 rounded-2xl bg-[#070a12] border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <h4 className="text-lg font-black text-slate-100">{selectedVendorForDecision.name}</h4>
                  <p className="text-xs text-slate-400 font-mono">{selectedVendorForDecision.domain} • Sector: {selectedVendorForDecision.sector}</p>
                </div>

                <div className="flex items-center gap-3 font-mono">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase block">Risk Score</span>
                    <span className="text-xl font-black text-rose-400">{selectedVendorForDecision.risk_score}/100</span>
                  </div>
                  <div className="text-right border-l border-slate-800 pl-3">
                    <span className="text-[10px] text-slate-400 uppercase block">Compliance</span>
                    <span className="text-xl font-black text-cyan-400">{computeComplianceRate(selectedVendorForDecision)}%</span>
                  </div>
                </div>
              </div>

              {/* Requirement 7 Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <button
                  onClick={() => handleDecisionAction(selectedVendorForDecision, 'APPROVED')}
                  className="py-3 px-4 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>APPROVE</span>
                </button>

                <button
                  onClick={() => handleDecisionAction(selectedVendorForDecision, 'REJECTED')}
                  className="py-3 px-4 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <XCircle className="w-4 h-4 text-rose-400" />
                  <span>REJECT</span>
                </button>

                <button
                  onClick={() => handleDecisionAction(selectedVendorForDecision, 'REMEDIATION_REQUESTED')}
                  className="py-3 px-4 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 text-amber-400" />
                  <span>REQUEST REMEDIATION</span>
                </button>

                <button
                  onClick={() => handleDecisionAction(selectedVendorForDecision, 'ESCALATED')}
                  className="py-3 px-4 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <AlertTriangle className="w-4 h-4 text-purple-400" />
                  <span>ESCALATE</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center border border-dashed border-slate-800 rounded-2xl text-slate-500 text-xs font-mono">
              Select a vendor above or click "Review &amp; Decide" in the High-Risk table to execute governance actions.
            </div>
          )}
        </div>
      )}

      {/* SECTION 8: VENDOR COMPARISON TOOL */}
      {(activeTab === 'comparison' || (activeTab === 'overview' && compareIds.length > 0)) && (
        <div className="bg-[#0a0f1d] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Scale className="w-5 h-5 text-cyan-400" />
            Vendor Security Posture Comparison Tool
          </h3>

          {compareIds.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs font-mono">
              Select vendors using the checkboxes in the All Vendors roster to compare side-by-side.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#070a12]">
                    <th className="py-3 px-4 text-slate-400">Metric</th>
                    {compareIds.map(id => {
                      const v = vendors.find(item => item.id === id);
                      return <th key={id} className="py-3 px-4 text-slate-100 border-l border-slate-800">{v?.name}</th>;
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  <tr>
                    <td className="py-2.5 px-4 text-slate-400">Risk Score</td>
                    {compareIds.map(id => {
                      const v = vendors.find(item => item.id === id);
                      return <td key={id} className="py-2.5 px-4 border-l border-slate-800 text-rose-400 font-bold">{v?.risk_score}</td>;
                    })}
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 text-slate-400">Compliance %</td>
                    {compareIds.map(id => {
                      const v = vendors.find(item => item.id === id);
                      return <td key={id} className="py-2.5 px-4 border-l border-slate-800 text-cyan-400 font-bold">{v ? computeComplianceRate(v) : 0}%</td>;
                    })}
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 text-slate-400">Verification Status</td>
                    {compareIds.map(id => {
                      const v = vendors.find(item => item.id === id);
                      return <td key={id} className="py-2.5 px-4 border-l border-slate-800 text-emerald-400">{v ? getVerificationStatus(v) : '-'}</td>;
                    })}
                  </tr>
                  <tr>
                    <td className="py-2.5 px-4 text-slate-400">Overall CISO Status</td>
                    {compareIds.map(id => {
                      const dec = decisions[id];
                      return <td key={id} className="py-2.5 px-4 border-l border-slate-800 text-slate-200">{dec ? dec.action : 'Monitoring'}</td>;
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SECTION 9: AUDIT HISTORY */}
      {(activeTab === 'overview' || activeTab === 'audit-history' || activeTab === 'audit') && (
        <div className="bg-[#0a0f1d] border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <History className="w-5 h-5 text-cyan-400" />
              CISO Governance Audit History Log
            </h3>
            <span className="text-xs font-mono text-slate-400">{auditHistory.length} Logged Actions</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="border-b border-slate-800 bg-[#070a12] text-slate-400 uppercase text-[10px]">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Target Vendor</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {auditHistory.map(item => (
                  <tr key={item.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 text-slate-400">{item.timestamp}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        item.action === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' :
                        item.action === 'REJECTED' ? 'bg-rose-500/20 text-rose-400' :
                        item.action === 'ESCALATED' ? 'bg-purple-500/20 text-purple-400' :
                        'bg-amber-500/20 text-amber-400'
                      }`}>
                        {item.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-100 font-bold">{item.vendorName}</td>
                    <td className="py-3 px-4 text-cyan-300">{item.actor}</td>
                    <td className="py-3 px-4 text-slate-400">{item.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

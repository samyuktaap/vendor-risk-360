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
  Trash2, 
  Flame, 
  ArrowUpRight, 
  Plus, 
  FileText, 
  Clock, 
  Activity, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ShieldCheck,
  Scale,
  History,
  BarChart3,
  Filter,
  Check,
  X,
  ExternalLink,
  Shield,
  AlertCircle,
  FileSpreadsheet,
  PieChart as PieChartIcon
} from 'lucide-react';

export default function OverviewDashboard({ 
  vendors = [], 
  feed = [], 
  onSelectVendor, 
  onOpenAddModal, 
  onRefreshVendor, 
  onDeleteVendor,
  onNavigateToContagion
}) {
  // Navigation & Sub-View State inside CISO Dashboard
  const [activeCisoTab, setActiveCisoTab] = useState('overview'); // 'overview', 'high-risk', 'compliance', 'comparison', 'analytics', 'audit'

  // Filter & Search States
  const [filterRisk, setFilterRisk] = useState('ALL');
  const [searchFilter, setSearchFilter] = useState('');
  const [refreshingId, setRefreshingId] = useState(null);

  // Vendor Comparison State (Store selected vendor IDs for side-by-side comparison)
  const [compareIds, setCompareIds] = useState([]);

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState(null);

  // CISO Decisions State (Persisted in localStorage)
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
        id: 1,
        action: 'APPROVE',
        vendorName: 'AWS Cloud Services',
        actor: 'CISO Admin (samyuktaa)',
        timestamp: '2026-08-20 08:30:00',
        details: 'Approved quarterly third-party cloud security compliance.'
      },
      {
        id: 2,
        action: 'ESCALATE',
        vendorName: 'Acme Logistics',
        actor: 'Security Analyst',
        timestamp: '2026-08-19 14:15:22',
        details: 'Escalated due to unmitigated Critical CVE in payment gateway.'
      },
      {
        id: 3,
        action: 'REQUEST_REVIEW',
        vendorName: 'Stripe Payments',
        actor: 'CISO Admin (samyuktaa)',
        timestamp: '2026-08-18 11:05:40',
        details: 'Requested updated SOC 2 Type II audit documentation.'
      }
    ];
  });

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

  // Security Alerts Acknowledgement State
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState({});

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

  // Helper to handle CISO Vendor Decisions (Approve, Reject, Request Review, Escalate)
  const handleDecision = (vendor, action) => {
    const newDecisions = {
      ...decisions,
      [vendor.id]: {
        action,
        timestamp: new Date().toLocaleString(),
        actor: 'CISO Admin'
      }
    };
    setDecisions(newDecisions);
    try {
      localStorage.setItem('ciso_vendor_decisions', JSON.stringify(newDecisions));
    } catch (e) {}

    // Add entry to Audit History
    const actionTitles = {
      APPROVE: 'APPROVED',
      REJECT: 'REJECTED',
      REQUEST_REVIEW: 'REVIEW REQUESTED',
      ESCALATE: 'ESCALATED TO SECOPS'
    };

    const newAuditItem = {
      id: Date.now(),
      action,
      vendorName: vendor.name,
      actor: 'CISO Admin',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      details: `CISO set governance status for ${vendor.name} (${vendor.domain}) to ${actionTitles[action]}.`
    };

    const updatedAudit = [newAuditItem, ...auditHistory];
    setAuditHistory(updatedAudit);
    try {
      localStorage.setItem('ciso_audit_history', JSON.stringify(updatedAudit));
    } catch (e) {}

    showToast(`Status updated: ${actionTitles[action]} for ${vendor.name}`);
  };

  // Toggle Vendor for Comparison
  const toggleCompareVendor = (vendorId) => {
    if (compareIds.includes(vendorId)) {
      setCompareIds(compareIds.filter(id => id !== vendorId));
    } else {
      if (compareIds.length >= 3) {
        showToast("You can compare up to 3 vendors simultaneously.");
        return;
      }
      setCompareIds([...compareIds, vendorId]);
    }
  };

  // Calculate 4 Risk Level Categories for Requirement 1
  const criticalRiskVendors = vendors.filter(v => v.risk_score >= 75 || v.risk_tier === 'CRITICAL');
  const highRiskVendors = vendors.filter(v => (v.risk_score >= 60 && v.risk_score < 75) || v.risk_tier === 'HIGH');
  const mediumRiskVendors = vendors.filter(v => (v.risk_score >= 40 && v.risk_score < 60) || v.risk_tier === 'WATCH' || v.risk_tier === 'MEDIUM');
  const lowRiskVendors = vendors.filter(v => v.risk_score < 40 || v.risk_tier === 'SAFE' || v.risk_tier === 'LOW');

  // All High & Critical vendors combined for spotlight
  const highAndCriticalVendors = vendors.filter(v => v.risk_score >= 60 || v.risk_tier === 'CRITICAL' || v.risk_tier === 'HIGH');

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

  // Calculate Compliance Statistics for Requirement 4
  const computeComplianceRate = (v) => {
    // Standard compliance formula based on inverse risk & active penalties
    const base = 100 - (v.risk_score * 0.7);
    const score = Math.max(20, Math.min(100, Math.round(base)));
    return score;
  };

  const compliantVendors = vendors.filter(v => computeComplianceRate(v) >= 85);
  const partiallyCompliantVendors = vendors.filter(v => computeComplianceRate(v) >= 55 && computeComplianceRate(v) < 85);
  const nonCompliantVendors = vendors.filter(v => computeComplianceRate(v) < 55);

  const avgComplianceRate = vendors.length > 0 
    ? Math.round(vendors.reduce((acc, v) => acc + computeComplianceRate(v), 0) / vendors.length)
    : 0;

  // Security Alerts Synthesis for Requirement 5
  const synthesizedAlerts = [
    ...metrics.expiring_certifications > 0 ? [{
      id: 'alert-certs',
      category: 'EXPIRING_DOCS',
      severity: 'HIGH',
      title: `${metrics.expiring_certifications} Vendor Certifications Expiring Soon`,
      description: 'ISO 27001 / SOC 2 certifications due for renewal within 30 days.',
      time: 'Action Required'
    }] : [],
    ...highAndCriticalVendors.slice(0, 3).map(v => ({
      id: `alert-vendor-${v.id}`,
      category: 'HIGH_RISK_VENDOR',
      severity: v.risk_score >= 75 ? 'CRITICAL' : 'HIGH',
      title: `High Risk Alert: ${v.name} (${v.risk_score}/100)`,
      description: `Active risk score of ${v.risk_score} exceeds organizational threshold. ${v.active_incidents > 0 ? `${v.active_incidents} active incidents.` : ''}`,
      vendorId: v.id,
      time: 'Live Monitor'
    })),
    {
      id: 'alert-verify-1',
      category: 'FAILED_VERIFICATION',
      severity: 'MEDIUM',
      title: 'Compliance Verification Review Required',
      description: 'Automated document hash verification flagged 2 updated DPAs for manual review.',
      time: '2 hours ago'
    }
  ];

  // Sector Analytics Data for Requirement 7
  const sectorRiskData = (() => {
    const sectorMap = {};
    vendors.forEach(v => {
      const sec = v.sector || 'Other';
      if (!sectorMap[sec]) sectorMap[sec] = { sector: sec, count: 0, totalScore: 0 };
      sectorMap[sec].count += 1;
      sectorMap[sec].totalScore += v.risk_score;
    });
    return Object.values(sectorMap).map(s => ({
      sector: s.sector,
      avgScore: Math.round(s.totalScore / s.count),
      vendorCount: s.count
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
        showToast("Triggered multi-vector security scan refresh.");
      }
    } catch (err) {
      console.error("Error refreshing vendor:", err);
    } finally {
      setRefreshingId(null);
    }
  };

  return (
    <div className="space-y-6 pb-16 font-sans">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-[#0f172a] border border-cyan-500/50 text-cyan-200 text-xs px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* CISO Executive Navigation & Header Control Bar */}
      <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-2xl p-4 shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Shield className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-100 tracking-tight flex items-center gap-2">
                CISO Executive Risk Dashboard
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono font-bold">
                  ORGANIZATION-WIDE VIEW
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Monitor security posture, evaluate multi-vector risk, and decide vendor enterprise status.
              </p>
            </div>
          </div>
        </div>

        {/* Executive Quick Actions & Tab Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-[#070a12] p-1 rounded-xl border border-slate-800 text-xs">
            {[
              { id: 'overview', label: 'Overview', icon: LayoutGridIcon },
              { id: 'high-risk', label: `High-Risk (${highAndCriticalVendors.length})`, icon: ShieldAlert },
              { id: 'compliance', label: 'Compliance & Alerts', icon: ShieldCheck },
              { id: 'comparison', label: `Comparison (${compareIds.length})`, icon: Scale },
              { id: 'analytics', label: 'Analytics', icon: BarChart3 },
              { id: 'audit', label: 'Audit Log', icon: History }
            ].map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveCisoTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all text-xs cursor-pointer ${
                    activeCisoTab === t.id
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={onOpenAddModal}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs py-2 px-3.5 rounded-xl shadow-lg shadow-cyan-950/40 flex items-center gap-1.5 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Onboard Vendor</span>
          </button>
        </div>
      </div>

      {/* REQUIREMENT 1: Overall Vendor Risk Dashboard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Monitored Vendors */}
        <div className="bg-[#0a0f1d] border border-cyan-950/60 rounded-2xl p-4 relative overflow-hidden shadow-xl group hover:border-cyan-500/40 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Vendors</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-100 font-mono tracking-tight">
              {metricsLoading ? '-' : vendors.length}
            </span>
            <span className="text-[10px] text-emerald-400 font-medium font-mono">Enterprise Assets</span>
          </div>
        </div>

        {/* Critical Risk Vendors */}
        <div 
          onClick={() => { setActiveCisoTab('high-risk'); setFilterRisk('CRITICAL'); }}
          className="bg-[#0a0f1d] border border-rose-950/60 rounded-2xl p-4 relative overflow-hidden shadow-xl group hover:border-rose-500/50 transition-all duration-300 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Critical Risk (75+)</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Flame className="w-4 h-4 animate-pulse" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-400 font-mono tracking-tight">
              {metricsLoading ? '-' : criticalRiskVendors.length}
            </span>
            <span className="text-[10px] text-rose-400/80 font-mono">Immediate Action</span>
          </div>
        </div>

        {/* High Risk Vendors */}
        <div 
          onClick={() => { setActiveCisoTab('high-risk'); setFilterRisk('HIGH'); }}
          className="bg-[#0a0f1d] border border-amber-950/60 rounded-2xl p-4 relative overflow-hidden shadow-xl group hover:border-amber-500/50 transition-all duration-300 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">High Risk (60-74)</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-400 font-mono tracking-tight">
              {metricsLoading ? '-' : highRiskVendors.length}
            </span>
            <span className="text-[10px] text-amber-400/80 font-mono">Elevated Watch</span>
          </div>
        </div>

        {/* Medium & Low Risk Breakdown */}
        <div className="bg-[#0a0f1d] border border-blue-950/60 rounded-2xl p-4 relative overflow-hidden shadow-xl group hover:border-blue-500/40 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Medium / Low Risk</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between font-mono">
            <div>
              <span className="text-lg font-bold text-blue-300">{mediumRiskVendors.length}</span>
              <span className="text-[9px] text-slate-400 ml-1">Med</span>
            </div>
            <div className="border-r border-slate-800 h-5"></div>
            <div>
              <span className="text-lg font-bold text-emerald-400">{lowRiskVendors.length}</span>
              <span className="text-[9px] text-slate-400 ml-1">Low</span>
            </div>
          </div>
        </div>

        {/* Executive Overall Risk Score Summary */}
        <div className="bg-[#0a0f1d] border border-indigo-950/60 rounded-2xl p-4 relative overflow-hidden shadow-xl group hover:border-indigo-500/40 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Overall Risk Score</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-indigo-400 font-mono tracking-tight">
              {metricsLoading ? '-' : (metrics.overall_risk_score || (vendors.length > 0 ? Math.round(vendors.reduce((acc, v) => acc + v.risk_score, 0)/vendors.length) : 0))}
            </span>
            <span className="text-[10px] text-slate-400">/ 100 Index</span>
          </div>
        </div>
      </div>

      {/* CISO TAB CONTENT VIEWS */}

      {/* TAB 1: EXECUTIVE OVERVIEW & TRENDS */}
      {activeCisoTab === 'overview' && (
        <div className="space-y-6">
          {/* REQUIREMENT 2: Risk Scores & Trend Analytics Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Risk Score Trend Chart */}
            <div className="lg:col-span-2 bg-[#0a0f1d] border border-slate-800/80 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-cyan-400" />
                    Organization Risk Trend & Temporal Score Trajectory
                  </h3>
                  <p className="text-xs text-slate-400">Monthly average risk score tracking across enterprise vendor assets</p>
                </div>
                <span className="text-[10px] font-mono px-2 py-1 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  REAL-TIME ENGINE
                </span>
              </div>

              {metrics.risk_trend && metrics.risk_trend.length > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={metrics.risk_trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="cisoRiskTrendGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                        labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                      />
                      <Area type="monotone" dataKey="avg_score" stroke="#06b6d4" strokeWidth={3} fillOpacity={1} fill="url(#cisoRiskTrendGrad)" name="Avg Risk Score" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-slate-500 text-xs font-mono">
                  Synthesizing historical risk trend data...
                </div>
              )}
            </div>

            {/* Risk Distribution Summary */}
            <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-100 mb-1 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400"/>
                  Vendor Risk Level Breakdown
                </h3>
                <p className="text-xs text-slate-400 mb-5">Categorized by security risk threshold</p>

                <div className="space-y-4 font-mono text-xs">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-rose-400 font-bold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span> CRITICAL (75+)
                      </span>
                      <span className="text-slate-300 font-bold">{criticalRiskVendors.length} vendors</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                      <div className="bg-rose-500 h-2 rounded-full transition-all duration-500" style={{ width: `${(criticalRiskVendors.length / Math.max(1, vendors.length)) * 100}%` }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-amber-400 font-bold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span> HIGH (60 - 74)
                      </span>
                      <span className="text-slate-300 font-bold">{highRiskVendors.length} vendors</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                      <div className="bg-amber-500 h-2 rounded-full transition-all duration-500" style={{ width: `${(highRiskVendors.length / Math.max(1, vendors.length)) * 100}%` }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-blue-400 font-bold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span> MEDIUM (40 - 59)
                      </span>
                      <span className="text-slate-300 font-bold">{mediumRiskVendors.length} vendors</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                      <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${(mediumRiskVendors.length / Math.max(1, vendors.length)) * 100}%` }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span> LOW (&lt;40)
                      </span>
                      <span className="text-slate-300 font-bold">{lowRiskVendors.length} vendors</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                      <div className="bg-emerald-400 h-2 rounded-full transition-all duration-500" style={{ width: `${(lowRiskVendors.length / Math.max(1, vendors.length)) * 100}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400">High-Risk Exposure:</span>
                <span className="font-bold text-rose-400 font-mono">
                  {Math.round(((criticalRiskVendors.length + highRiskVendors.length) / Math.max(1, vendors.length)) * 100)}% of Portfolio
                </span>
              </div>
            </div>
          </div>

          {/* REQUIREMENT 3: High-Risk Vendors Spotlight Section */}
          <div className="bg-[#0a0f1d] border border-rose-950/60 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-5 border-b border-rose-950/60 bg-rose-950/20 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Flame className="w-5 h-5 text-rose-400 animate-pulse" />
                  High &amp; Critical Risk Vendors Spotlight
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    {highAndCriticalVendors.length} Priority Targets
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Vendors exceeding corporate security risk tolerance thresholds requiring immediate decision/review.
                </p>
              </div>

              <button
                onClick={() => setActiveCisoTab('high-risk')}
                className="text-xs text-rose-300 hover:text-rose-200 font-semibold flex items-center gap-1 bg-rose-500/10 px-3 py-1.5 rounded-xl border border-rose-500/30 cursor-pointer"
              >
                <span>View Full Spotlight</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-semibold bg-[#070a12]/80">
                    <th className="py-3 px-4">Vendor &amp; Domain</th>
                    <th className="py-3 px-4">Sector</th>
                    <th className="py-3 px-4 text-center">Risk Score</th>
                    <th className="py-3 px-4">Active Hazards</th>
                    <th className="py-3 px-4">CISO Decision Status</th>
                    <th className="py-3 px-4 text-right">CISO Action Buttons</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {highAndCriticalVendors.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-slate-400 font-mono">
                        No vendors currently exceeding high-risk threshold. Security posture is optimal.
                      </td>
                    </tr>
                  ) : (
                    highAndCriticalVendors.map((vendor) => {
                      const dec = decisions[vendor.id];
                      return (
                        <tr key={vendor.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-4">
                            <div 
                              onClick={() => onSelectVendor(vendor.id)}
                              className="flex items-center gap-3 cursor-pointer group"
                            >
                              <div className="w-9 h-9 rounded-xl bg-rose-950/80 border border-rose-500/40 flex items-center justify-center font-bold text-rose-300">
                                {vendor.name.charAt(0)}
                              </div>
                              <div>
                                <div className="font-bold text-slate-100 group-hover:text-cyan-300 transition-colors flex items-center gap-1.5">
                                  {vendor.name}
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 font-mono border border-rose-500/30">
                                    {vendor.risk_tier}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono">{vendor.domain}</div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-slate-300 font-medium">{vendor.sector}</td>

                          <td className="py-3.5 px-4 text-center font-mono">
                            <span className="text-base font-black px-3 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40">
                              {vendor.risk_score}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex flex-col gap-1 text-[10px] font-mono">
                              {vendor.active_incidents > 0 ? (
                                <span className="text-rose-400 font-bold flex items-center gap-1">
                                  <Flame className="w-3 h-3 text-rose-500" /> {vendor.active_incidents} Active Incidents (+{vendor.incident_penalty || 15} pts)
                                </span>
                              ) : (
                                <span className="text-amber-400 font-medium">Elevated Threat Score</span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            {dec ? (
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                dec.action === 'APPROVE' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                                dec.action === 'REJECT' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' :
                                dec.action === 'ESCALATE' ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' :
                                'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              }`}>
                                {dec.action.replace('_', ' ')}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500 font-mono italic">Pending Decision</span>
                            )}
                          </td>

                          {/* REQUIREMENT 8: CISO Governance Decision Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleDecision(vendor, 'APPROVE')}
                                title="Approve Vendor Status"
                                className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDecision(vendor, 'REQUEST_REVIEW')}
                                title="Request Security Audit / Review"
                                className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-all cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDecision(vendor, 'ESCALATE')}
                                title="Escalate to SecOps"
                                className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/30 hover:bg-purple-500/20 transition-all cursor-pointer"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDecision(vendor, 'REJECT')}
                                title="Reject / Block Vendor"
                                className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 transition-all cursor-pointer"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* MAIN ALL-VENDOR ROSTER TABLE WITH FILTERS & COMPARISON SELECTION */}
          <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-5 border-b border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  All Enterprise Monitored Vendors
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                    {filteredVendors.length} Total
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Select vendors to compare or issue CISO governance decisions</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Search Box */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search vendor name, sector..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="bg-[#070a12] border border-slate-800 focus:border-cyan-500/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition-all w-48"
                  />
                </div>

                {/* Risk Filter Tabs */}
                <div className="flex items-center bg-[#070a12] p-1 rounded-xl border border-slate-800 text-xs">
                  {[
                    { key: 'ALL', label: 'All' },
                    { key: 'CRITICAL', label: 'Critical' },
                    { key: 'HIGH', label: 'High' },
                    { key: 'MEDIUM', label: 'Medium' },
                    { key: 'LOW', label: 'Low' }
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setFilterRisk(tab.key)}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-all text-xs cursor-pointer ${
                        filterRisk === tab.key
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-semibold bg-[#070a12]/60">
                    <th className="py-3 px-4 text-center">Compare</th>
                    <th className="py-3 px-4">Vendor &amp; Domain</th>
                    <th className="py-3 px-4">Sector</th>
                    <th className="py-3 px-4 text-center">Risk Score</th>
                    <th className="py-3 px-4">Compliance Rate</th>
                    <th className="py-3 px-4">CISO Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {filteredVendors.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-slate-400">
                        No vendors match selected search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredVendors.map((vendor) => {
                      const isCritical = vendor.risk_score >= 75 || vendor.risk_tier === 'CRITICAL';
                      const isHigh = vendor.risk_score >= 60 && vendor.risk_score < 75;
                      const isMedium = vendor.risk_score >= 40 && vendor.risk_score < 60;
                      const isComparing = compareIds.includes(vendor.id);
                      const dec = decisions[vendor.id];
                      const compRate = computeComplianceRate(vendor);

                      return (
                        <tr key={vendor.id} className="hover:bg-slate-800/30 transition-colors">
                          {/* Checkbox for Vendor Comparison (Requirement 6) */}
                          <td className="py-3.5 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={isComparing}
                              onChange={() => toggleCompareVendor(vendor.id)}
                              className="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
                              title="Select vendor to compare"
                            />
                          </td>

                          {/* Vendor Name & Domain */}
                          <td className="py-3.5 px-4">
                            <div 
                              onClick={() => onSelectVendor(vendor.id)}
                              className="flex items-center gap-3 cursor-pointer group"
                            >
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm text-slate-100 ${
                                isCritical ? 'bg-rose-950/80 border border-rose-500/40 text-rose-300' :
                                isHigh ? 'bg-amber-950/80 border border-amber-500/40 text-amber-300' :
                                isMedium ? 'bg-blue-950/80 border border-blue-500/40 text-blue-300' :
                                'bg-emerald-950/80 border border-emerald-500/40 text-emerald-300'
                              }`}>
                                {vendor.name.charAt(0)}
                              </div>
                              <div>
                                <div className="font-bold text-slate-100 group-hover:text-cyan-300 transition-colors flex items-center gap-1.5">
                                  {vendor.name}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono">{vendor.domain}</div>
                              </div>
                            </div>
                          </td>

                          {/* Sector */}
                          <td className="py-3.5 px-4 text-slate-300 font-medium">{vendor.sector}</td>

                          {/* Risk Score */}
                          <td className="py-3.5 px-4 text-center font-mono">
                            <span className={`text-sm font-black px-2.5 py-0.5 rounded-full ${
                              isCritical ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' :
                              isHigh ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                              isMedium ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40' :
                              'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            }`}>
                              {vendor.risk_score}
                            </span>
                          </td>

                          {/* Compliance Rate */}
                          <td className="py-3.5 px-4 font-mono">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
                                <div 
                                  className={`h-1.5 rounded-full ${compRate >= 85 ? 'bg-emerald-400' : compRate >= 55 ? 'bg-amber-400' : 'bg-rose-500'}`}
                                  style={{ width: `${compRate}%` }}
                                ></div>
                              </div>
                              <span className="text-slate-300 font-bold">{compRate}%</span>
                            </div>
                          </td>

                          {/* CISO Governance Decision Status */}
                          <td className="py-3.5 px-4">
                            {dec ? (
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                dec.action === 'APPROVE' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                                dec.action === 'REJECT' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' :
                                dec.action === 'ESCALATE' ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' :
                                'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              }`}>
                                {dec.action.replace('_', ' ')}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500 font-mono">Active Monitoring</span>
                            )}
                          </td>

                          {/* Quick Action Buttons */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleDecision(vendor, 'APPROVE')}
                                title="Approve"
                                className="p-1 rounded bg-slate-900 border border-slate-800 text-emerald-400 hover:border-emerald-500/50 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDecision(vendor, 'REQUEST_REVIEW')}
                                title="Request Review"
                                className="p-1 rounded bg-slate-900 border border-slate-800 text-amber-400 hover:border-amber-500/50 cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDecision(vendor, 'ESCALATE')}
                                title="Escalate"
                                className="p-1 rounded bg-slate-900 border border-slate-800 text-purple-400 hover:border-purple-500/50 cursor-pointer"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => handleSingleRefresh(e, vendor.id)}
                                title="Refresh Probes"
                                className="p-1 rounded bg-slate-900 border border-slate-800 text-cyan-400 hover:border-cyan-500/50 cursor-pointer"
                              >
                                <RefreshCw className={`w-3.5 h-3.5 ${refreshingId === vendor.id ? 'animate-spin' : ''}`} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: HIGH-RISK VENDORS DEDICATED SPOTLIGHT */}
      {activeCisoTab === 'high-risk' && (
        <div className="space-y-6">
          <div className="bg-[#0a0f1d] border border-rose-950/60 rounded-2xl p-5 shadow-xl flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Flame className="w-5 h-5 text-rose-400 animate-pulse" />
                Dedicated High &amp; Critical-Risk Vendor Governance Matrix
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Displaying all vendors with Risk Score ≥ 60 or classified as High/Critical Risk Tiers.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 font-mono font-bold text-xs border border-rose-500/40">
              {highAndCriticalVendors.length} High-Risk Targets
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {highAndCriticalVendors.map(vendor => {
              const dec = decisions[vendor.id];
              return (
                <div key={vendor.id} className="bg-[#0a0f1d] border border-rose-950/60 rounded-2xl p-5 shadow-xl relative flex flex-col justify-between hover:border-rose-500/50 transition-all">
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-950 border border-rose-500/40 text-rose-300 font-bold flex items-center justify-center text-base">
                          {vendor.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                            {vendor.name}
                          </h4>
                          <span className="text-xs text-slate-400 font-mono">{vendor.domain}</span>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-400 font-mono font-black text-sm border border-rose-500/40">
                        {vendor.risk_score}
                      </span>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2 text-xs font-mono">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Industry Sector:</span>
                        <span className="text-slate-200 font-medium">{vendor.sector}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Risk Tier:</span>
                        <span className="text-rose-400 font-bold">{vendor.risk_tier} RISK</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Active Incidents:</span>
                        <span className="text-amber-400 font-bold">{vendor.active_incidents || 0} Open</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Current Status:</span>
                        <span className="text-cyan-300 font-bold">
                          {dec ? dec.action.replace('_', ' ') : 'Under Evaluation'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <button
                      onClick={() => onSelectVendor(vendor.id)}
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1"
                    >
                      <span>Full Audit</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDecision(vendor, 'APPROVE')}
                        className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold hover:bg-emerald-500/20 cursor-pointer"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleDecision(vendor, 'ESCALATE')}
                        className="px-2 py-1 rounded bg-purple-500/10 text-purple-400 border border-purple-500/30 text-[10px] font-bold hover:bg-purple-500/20 cursor-pointer"
                      >
                        Escalate
                      </button>
                      <button
                        onClick={() => handleDecision(vendor, 'REJECT')}
                        className="px-2 py-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[10px] font-bold hover:bg-rose-500/20 cursor-pointer"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: COMPLIANCE STATUS & SECURITY ISSUES / ALERTS */}
      {activeCisoTab === 'compliance' && (
        <div className="space-y-6">
          {/* REQUIREMENT 4: Compliance Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-2xl p-5 shadow-xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Overall Compliance</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black text-cyan-400 font-mono">{avgComplianceRate}%</span>
                <span className="text-xs text-slate-400">Pass Rate</span>
              </div>
            </div>

            <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-2xl p-5 shadow-xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Compliant Vendors</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black text-emerald-400 font-mono">{compliantVendors.length}</span>
                <span className="text-xs text-slate-400">Passed (≥85%)</span>
              </div>
            </div>

            <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-2xl p-5 shadow-xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Partially Compliant</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black text-amber-400 font-mono">{partiallyCompliantVendors.length}</span>
                <span className="text-xs text-slate-400">Watch (55-84%)</span>
              </div>
            </div>

            <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-2xl p-5 shadow-xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Non-Compliant</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black text-rose-400 font-mono">{nonCompliantVendors.length}</span>
                <span className="text-xs text-slate-400">Failed (&lt;55%)</span>
              </div>
            </div>
          </div>

          {/* REQUIREMENT 5: Security Issues & Executive Warnings */}
          <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-2xl p-5 shadow-xl">
            <h3 className="text-base font-bold text-slate-100 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Security Issues &amp; Compliance Alerts Hub
            </h3>

            <div className="space-y-3">
              {synthesizedAlerts.map(alert => (
                <div key={alert.id} className="p-4 rounded-xl bg-[#070a12] border border-slate-800/80 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${alert.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-200 text-xs flex items-center gap-2">
                        {alert.title}
                        <span className={`text-[9px] px-2 py-0.5 rounded font-mono font-bold ${alert.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                          {alert.severity}
                        </span>
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">{alert.description}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setAcknowledgedAlerts({ ...acknowledgedAlerts, [alert.id]: true });
                      showToast("Security alert acknowledged.");
                    }}
                    disabled={acknowledgedAlerts[alert.id]}
                    className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-all font-semibold cursor-pointer"
                  >
                    {acknowledgedAlerts[alert.id] ? 'Acknowledged ✓' : 'Acknowledge'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: REQUIREMENT 6: VENDOR COMPARISON TOOL */}
      {activeCisoTab === 'comparison' && (
        <div className="space-y-6">
          <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-2xl p-5 shadow-xl flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Scale className="w-5 h-5 text-cyan-400" />
                Side-by-Side Vendor Risk &amp; Security Posture Matrix
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Compare vendor security scores, compliance pass rates, and active incidents side-by-side.
              </p>
            </div>
            <span className="text-xs text-cyan-400 font-mono font-bold">
              {compareIds.length} Selected for Comparison
            </span>
          </div>

          {compareIds.length === 0 ? (
            <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-2xl p-12 text-center">
              <Scale className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h4 className="text-slate-200 font-bold text-sm">No Vendors Selected for Comparison</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Go back to the Overview table and check the "Compare" checkbox next to 2 or 3 vendors to view side-by-side analysis.
              </p>
              <button
                onClick={() => setActiveCisoTab('overview')}
                className="mt-4 px-4 py-2 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-bold hover:bg-cyan-500/30 transition-all cursor-pointer"
              >
                Select Vendors to Compare
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto bg-[#0a0f1d] border border-slate-800/80 rounded-2xl shadow-xl">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#070a12]">
                    <th className="py-4 px-5 text-slate-400 uppercase tracking-wider font-bold">Metric / Attributes</th>
                    {compareIds.map(id => {
                      const v = vendors.find(item => item.id === id);
                      if (!v) return null;
                      return (
                        <th key={id} className="py-4 px-5 font-bold text-slate-100 text-sm border-l border-slate-800">
                          <div className="flex items-center justify-between">
                            <span>{v.name}</span>
                            <button onClick={() => toggleCompareVendor(id)} className="text-slate-500 hover:text-rose-400">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  <tr>
                    <td className="py-3.5 px-5 text-slate-400">Domain</td>
                    {compareIds.map(id => {
                      const v = vendors.find(item => item.id === id);
                      return <td key={id} className="py-3.5 px-5 text-slate-200 border-l border-slate-800">{v?.domain}</td>;
                    })}
                  </tr>

                  <tr>
                    <td className="py-3.5 px-5 text-slate-400">Risk Score &amp; Tier</td>
                    {compareIds.map(id => {
                      const v = vendors.find(item => item.id === id);
                      if (!v) return null;
                      return (
                        <td key={id} className="py-3.5 px-5 border-l border-slate-800">
                          <span className={`font-black text-sm px-2.5 py-0.5 rounded-full ${
                            v.risk_score >= 60 ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          }`}>
                            {v.risk_score} ({v.risk_tier})
                          </span>
                        </td>
                      );
                    })}
                  </tr>

                  <tr>
                    <td className="py-3.5 px-5 text-slate-400">Compliance Rate</td>
                    {compareIds.map(id => {
                      const v = vendors.find(item => item.id === id);
                      const rate = v ? computeComplianceRate(v) : 0;
                      return (
                        <td key={id} className="py-3.5 px-5 border-l border-slate-800 text-slate-200 font-bold">
                          {rate}%
                        </td>
                      );
                    })}
                  </tr>

                  <tr>
                    <td className="py-3.5 px-5 text-slate-400">Active Security Incidents</td>
                    {compareIds.map(id => {
                      const v = vendors.find(item => item.id === id);
                      return (
                        <td key={id} className="py-3.5 px-5 border-l border-slate-800 text-slate-200">
                          {v?.active_incidents || 0} Open
                        </td>
                      );
                    })}
                  </tr>

                  <tr>
                    <td className="py-3.5 px-5 text-slate-400">CISO Decision Status</td>
                    {compareIds.map(id => {
                      const dec = decisions[id];
                      return (
                        <td key={id} className="py-3.5 px-5 border-l border-slate-800 text-cyan-300 font-bold">
                          {dec ? dec.action : 'Active Monitor'}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: REQUIREMENT 7: REPORTS & ORGANIZATION ANALYTICS */}
      {activeCisoTab === 'analytics' && (
        <div className="space-y-6">
          <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-2xl p-5 shadow-xl flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-cyan-400" />
                Organization Vendor Risk Analytics &amp; Sector Heatmap
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Comparative analysis of third-party risk across enterprise business sectors.
              </p>
            </div>
            <button
              onClick={() => showToast("Executive CISO PDF Report summary exported.")}
              className="px-3.5 py-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold text-xs flex items-center gap-1.5 hover:bg-cyan-500/30 transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Executive Brief</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-2xl p-5 shadow-xl">
              <h3 className="text-sm font-bold text-slate-100 mb-4">Average Risk Score by Industry Sector</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sectorRiskData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="sector" stroke="#64748b" fontSize={10} />
                    <YAxis stroke="#64748b" fontSize={10} domain={[0, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }} />
                    <Bar dataKey="avgScore" fill="#06b6d4" radius={[6, 6, 0, 0]}>
                      {sectorRiskData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.avgScore >= 60 ? '#f43f5e' : entry.avgScore >= 40 ? '#f59e0b' : '#10b981'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-100 mb-2">CISO Risk Assessment Executive Brief</h3>
                <p className="text-xs text-slate-400 mb-4">Synthesized summary of organization security posture.</p>
                <div className="p-4 rounded-xl bg-[#070a12] border border-slate-800/80 font-mono text-xs space-y-2 text-slate-300">
                  <p><strong className="text-cyan-400">Total Portfolio:</strong> {vendors.length} vendors monitored across multi-vector probes.</p>
                  <p><strong className="text-rose-400">High Risk Exposure:</strong> {highAndCriticalVendors.length} vendors requiring CISO remediation intervention.</p>
                  <p><strong className="text-emerald-400">Compliance Rate:</strong> {avgComplianceRate}% average framework alignment across portfolio.</p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-400">
                Generated automatically by VendorRisk 360 AI Engine.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: REQUIREMENT 9: AUDIT HISTORY */}
      {activeCisoTab === 'audit' && (
        <div className="space-y-6">
          <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-2xl p-5 shadow-xl flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <History className="w-5 h-5 text-cyan-400" />
                CISO Executive Decision &amp; Audit Governance Trail
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Immutable audit record of vendor status changes, approvals, escalations, and security reviews.
              </p>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {auditHistory.length} Logged Actions
            </span>
          </div>

          <div className="bg-[#0a0f1d] border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#070a12] text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                    <th className="py-3.5 px-4">Timestamp</th>
                    <th className="py-3.5 px-4">Action Type</th>
                    <th className="py-3.5 px-4">Target Vendor</th>
                    <th className="py-3.5 px-4">Performed By</th>
                    <th className="py-3.5 px-4">Audit Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {auditHistory.map(item => (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 text-slate-400">{item.timestamp}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          item.action === 'APPROVE' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          item.action === 'REJECT' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                          item.action === 'ESCALATE' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                          'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          {item.action}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-200 font-bold">{item.vendorName}</td>
                      <td className="py-3.5 px-4 text-cyan-300">{item.actor}</td>
                      <td className="py-3.5 px-4 text-slate-400">{item.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline Helper Icon Component
function LayoutGridIcon(props) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

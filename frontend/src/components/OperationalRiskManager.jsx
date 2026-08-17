import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Edit3,
  Filter,
  Gauge,
  HardDrive,
  Layers,
  RefreshCw,
  Save,
  Search,
  Server,
  Shield,
  ShieldCheck,
  Timer,
  Truck,
  X,
  XCircle,
  Zap
} from 'lucide-react';

const API_BASE = 'http://localhost:8000';

// Utility helpers
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const pctColor = (pct) => {
  if (pct >= 99) return 'text-emerald-400';
  if (pct >= 97) return 'text-yellow-400';
  if (pct >= 95) return 'text-amber-400';
  return 'text-rose-400';
};
const scoreColor = (score) => {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-yellow-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-rose-400';
};
const depColor = (level) => {
  if (level === 'LOW') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  if (level === 'MODERATE') return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
  if (level === 'HIGH') return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
};
const bcpBadge = (status) => {
  if (status === 'VERIFIED') return { cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', label: '✓ Verified' };
  if (status === 'PENDING') return { cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', label: '⏳ Pending' };
  return { cls: 'bg-rose-500/20 text-rose-400 border-rose-500/30', label: '✗ Not Verified' };
};
const drBadge = (status) => {
  if (status && status.startsWith('PASSED')) return { cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', label: `✓ ${status.replace('_', ' ')}` };
  if (status === 'SCHEDULED') return { cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30', label: '📅 Scheduled' };
  if (status === 'FAILED') return { cls: 'bg-rose-500/20 text-rose-400 border-rose-500/30', label: '✗ Failed' };
  return { cls: 'bg-slate-500/20 text-slate-400 border-slate-500/30', label: status || 'Unknown' };
};

export default function OperationalRiskManager({ vendors }) {
  const [summary, setSummary] = useState(null);
  const [vendorRisks, setVendorRisks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [depFilter, setDepFilter] = useState('ALL');
  const [editVendor, setEditVendor] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [expandedVendor, setExpandedVendor] = useState(null);
  const [sortBy, setSortBy] = useState('sla');
  const [sortDir, setSortDir] = useState('asc');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, ...vendorRiskRes] = await Promise.all([
        fetch(`${API_BASE}/api/operational-risk/summary`),
        ...vendors.map(v => fetch(`${API_BASE}/api/vendors/${v.id}/operational-risk`))
      ]);
      if (sumRes.ok) setSummary(await sumRes.json());

      const risks = [];
      for (let i = 0; i < vendors.length; i++) {
        const v = vendors[i];
        try {
          if (vendorRiskRes[i].ok) {
            const d = await vendorRiskRes[i].json();
            risks.push({ ...d, vendor_name: v.name, vendor_domain: v.domain, vendor_risk_score: v.risk_score, vendor_id: v.id });
          }
        } catch {
          risks.push({ vendor_name: v.name, vendor_domain: v.domain, vendor_risk_score: v.risk_score, vendor_id: v.id });
        }
      }
      setVendorRisks(risks);
    } catch (err) {
      console.error('Failed to fetch operational risk data:', err);
    } finally {
      setLoading(false);
    }
  }, [vendors]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    if (!editVendor) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/vendors/${editVendor.vendor_id}/operational-risk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      if (res.ok) {
        setEditVendor(null);
        await fetchData();
      }
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (vr) => {
    setEditForm({
      sla_compliance_pct: vr.sla_compliance_pct ?? 99.5,
      monthly_downtime_hours: vr.monthly_downtime_hours ?? 1.0,
      incident_frequency: vr.incident_frequency ?? 1,
      delivery_delays_count: vr.delivery_delays_count ?? 0,
      quality_defect_rate_pct: vr.quality_defect_rate_pct ?? 0.2,
      support_response_time_hrs: vr.support_response_time_hrs ?? 1.5,
      bcp_status: vr.bcp_status ?? 'VERIFIED',
      bcp_audit_score: vr.bcp_audit_score ?? 85,
      dr_rto_hours: vr.dr_rto_hours ?? 4.0,
      dr_rpo_hours: vr.dr_rpo_hours ?? 1.0,
      dr_testing_status: vr.dr_testing_status ?? 'PASSED_Q2',
      dependency_level: vr.dependency_level ?? 'MODERATE',
      replaceability_score: vr.replaceability_score ?? 70
    });
    setEditVendor(vr);
  };

  // Filtering & sorting
  const filtered = vendorRisks
    .filter(vr => {
      if (searchQuery && !vr.vendor_name?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (depFilter !== 'ALL' && vr.dependency_level !== depFilter) return false;
      return true;
    })
    .sort((a, b) => {
      let valA, valB;
      switch (sortBy) {
        case 'sla': valA = a.sla_compliance_pct ?? 100; valB = b.sla_compliance_pct ?? 100; break;
        case 'downtime': valA = a.monthly_downtime_hours ?? 0; valB = b.monthly_downtime_hours ?? 0; break;
        case 'mttr': valA = a.support_response_time_hrs ?? 0; valB = b.support_response_time_hrs ?? 0; break;
        case 'dependency': valA = ['LOW', 'MODERATE', 'HIGH', 'HIGH_SINGLE_POINT'].indexOf(a.dependency_level); valB = ['LOW', 'MODERATE', 'HIGH', 'HIGH_SINGLE_POINT'].indexOf(b.dependency_level); break;
        case 'bcp': valA = a.bcp_audit_score ?? 0; valB = b.bcp_audit_score ?? 0; break;
        default: valA = a.sla_compliance_pct ?? 100; valB = b.sla_compliance_pct ?? 100;
      }
      return sortDir === 'asc' ? valA - valB : valB - valA;
    });

  // SPOF matrix
  const spofGroups = {
    'HIGH_SINGLE_POINT': vendorRisks.filter(v => v.dependency_level === 'HIGH_SINGLE_POINT'),
    'HIGH': vendorRisks.filter(v => v.dependency_level === 'HIGH'),
    'MODERATE': vendorRisks.filter(v => v.dependency_level === 'MODERATE'),
    'LOW': vendorRisks.filter(v => v.dependency_level === 'LOW')
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Loading Operational Risk Engine...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Gauge className="w-6 h-6 text-cyan-400" />
            Operational Risk Manager
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Monitor SLA compliance, downtime, vendor dependency, BCP/DR readiness, and delivery performance across all vendors
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-xl text-xs font-semibold hover:bg-cyan-500/20 transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh KPIs
        </button>
      </div>

      {/* KPI Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* SLA Compliance */}
          <div className="bg-[#111827] border border-cyan-500/20 rounded-2xl p-5 relative overflow-hidden group hover:border-cyan-500/40 transition-all">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                  <ShieldCheck className="w-4.5 h-4.5 text-cyan-400" />
                </div>
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Avg SLA Compliance</span>
              </div>
              <p className={`text-2xl font-black tracking-tight ${pctColor(summary.avg_sla_compliance)}`}>
                {summary.avg_sla_compliance}%
              </p>
              <p className="text-[10px] text-slate-500 mt-1">Across {summary.total_vendors} vendors</p>
            </div>
          </div>

          {/* Monthly Downtime */}
          <div className="bg-[#111827] border border-amber-500/20 rounded-2xl p-5 relative overflow-hidden group hover:border-amber-500/40 transition-all">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Timer className="w-4.5 h-4.5 text-amber-400" />
                </div>
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Total Downtime</span>
              </div>
              <p className={`text-2xl font-black tracking-tight ${summary.total_downtime_hours > 10 ? 'text-rose-400' : summary.total_downtime_hours > 5 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {summary.total_downtime_hours}h
              </p>
              <p className="text-[10px] text-slate-500 mt-1">Monthly aggregate</p>
            </div>
          </div>

          {/* SPOF Dependencies */}
          <div className="bg-[#111827] border border-rose-500/20 rounded-2xl p-5 relative overflow-hidden group hover:border-rose-500/40 transition-all">
            <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-4.5 h-4.5 text-rose-400" />
                </div>
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">High SPOF Count</span>
              </div>
              <p className={`text-2xl font-black tracking-tight ${summary.high_spof_dependency_count > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {summary.high_spof_dependency_count}
              </p>
              <p className="text-[10px] text-slate-500 mt-1">Single-point-of-failure vendors</p>
            </div>
          </div>

          {/* BCP/DR Verification */}
          <div className="bg-[#111827] border border-emerald-500/20 rounded-2xl p-5 relative overflow-hidden group hover:border-emerald-500/40 transition-all">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Shield className="w-4.5 h-4.5 text-emerald-400" />
                </div>
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">BCP / DR Pass Rate</span>
              </div>
              <p className={`text-2xl font-black tracking-tight ${pctColor(summary.bcp_verification_rate)}`}>
                {summary.bcp_verification_rate}%
                <span className="text-sm font-medium text-slate-500 ml-1">/ {summary.dr_test_pass_rate}%</span>
              </p>
              <p className="text-[10px] text-slate-500 mt-1">BCP verified / DR tested</p>
            </div>
          </div>
        </div>
      )}

      {/* SPOF Concentration Matrix */}
      <div className="bg-[#111827] border border-slate-700/50 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-4">
          <Layers className="w-4 h-4 text-purple-400" />
          Vendor Dependency Concentration Matrix
        </h3>
        <div className="grid grid-cols-4 gap-3">
          {[
            { key: 'HIGH_SINGLE_POINT', label: 'Critical SPOF', borderCls: 'border-rose-500/30', bgCls: 'bg-rose-500/5', dotCls: 'bg-rose-500', textCls: 'text-rose-400' },
            { key: 'HIGH', label: 'High Dependency', borderCls: 'border-amber-500/30', bgCls: 'bg-amber-500/5', dotCls: 'bg-amber-500', textCls: 'text-amber-400' },
            { key: 'MODERATE', label: 'Moderate', borderCls: 'border-yellow-500/30', bgCls: 'bg-yellow-500/5', dotCls: 'bg-yellow-500', textCls: 'text-yellow-400' },
            { key: 'LOW', label: 'Low / Replaceable', borderCls: 'border-emerald-500/30', bgCls: 'bg-emerald-500/5', dotCls: 'bg-emerald-500', textCls: 'text-emerald-400' }
          ].map(tier => (
            <div key={tier.key} className={`border ${tier.borderCls} ${tier.bgCls} rounded-xl p-4`}>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-[10px] uppercase tracking-wider font-bold ${tier.textCls}`}>{tier.label}</span>
                <span className={`text-lg font-black ${tier.textCls}`}>{spofGroups[tier.key]?.length || 0}</span>
              </div>
              <div className="space-y-1.5 max-h-28 overflow-y-auto">
                {(spofGroups[tier.key] || []).map((v, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px] text-slate-300">
                    <span className={`w-1.5 h-1.5 rounded-full ${tier.dotCls} flex-shrink-0`}></span>
                    <span className="truncate">{v.vendor_name}</span>
                    <span className="text-slate-500 ml-auto">{v.replaceability_score ?? 70}%</span>
                  </div>
                ))}
                {(!spofGroups[tier.key] || spofGroups[tier.key].length === 0) && (
                  <p className="text-[10px] text-slate-600 italic">No vendors</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search vendors..."
            className="w-full pl-9 pr-4 py-2.5 bg-[#0d1117] border border-slate-700/50 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <select
            value={depFilter}
            onChange={(e) => setDepFilter(e.target.value)}
            className="bg-[#0d1117] border border-slate-700/50 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50"
          >
            <option value="ALL">All Dependencies</option>
            <option value="HIGH_SINGLE_POINT">⛔ Critical SPOF</option>
            <option value="HIGH">🟠 High</option>
            <option value="MODERATE">🟡 Moderate</option>
            <option value="LOW">🟢 Low</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-[#0d1117] border border-slate-700/50 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50"
          >
            <option value="sla">Sort: SLA %</option>
            <option value="downtime">Sort: Downtime</option>
            <option value="mttr">Sort: MTTR</option>
            <option value="dependency">Sort: Dependency</option>
            <option value="bcp">Sort: BCP Score</option>
          </select>
          <button
            onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
            className="p-2.5 bg-[#0d1117] border border-slate-700/50 rounded-xl text-slate-400 hover:text-slate-200 transition-colors"
          >
            {sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Vendor Operational Risk Scorecards */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-500 text-sm">
            No vendors match the current filters.
          </div>
        )}
        {filtered.map((vr) => {
          const isExpanded = expandedVendor === vr.vendor_id;
          const sla = vr.sla_compliance_pct ?? 99.5;
          const bcp = bcpBadge(vr.bcp_status);
          const dr = drBadge(vr.dr_testing_status);
          const dep = depColor(vr.dependency_level);

          return (
            <div
              key={vr.vendor_id}
              className="bg-[#111827] border border-slate-700/40 rounded-2xl overflow-hidden hover:border-cyan-500/30 transition-all duration-200"
            >
              {/* Compact Row */}
              <div
                className="flex items-center gap-4 px-5 py-4 cursor-pointer"
                onClick={() => setExpandedVendor(isExpanded ? null : vr.vendor_id)}
              >
                <div className="flex items-center gap-2 w-4">
                  {isExpanded
                    ? <ChevronDown className="w-4 h-4 text-cyan-400" />
                    : <ChevronRight className="w-4 h-4 text-slate-500" />
                  }
                </div>

                {/* Vendor Name */}
                <div className="min-w-[160px]">
                  <p className="text-sm font-semibold text-slate-200">{vr.vendor_name}</p>
                  <p className="text-[10px] text-slate-500">{vr.vendor_domain}</p>
                </div>

                {/* SLA Compliance */}
                <div className="flex-1 min-w-[100px]">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">SLA</span>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${sla >= 99 ? 'bg-emerald-500' : sla >= 97 ? 'bg-yellow-500' : sla >= 95 ? 'bg-amber-500' : 'bg-rose-500'}`}
                        style={{ width: `${clamp(sla, 0, 100)}%` }}
                      ></div>
                    </div>
                    <span className={`text-xs font-bold ${pctColor(sla)}`}>{sla}%</span>
                  </div>
                </div>

                {/* Downtime */}
                <div className="text-center min-w-[70px]">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Downtime</span>
                  <span className={`text-xs font-bold ${(vr.monthly_downtime_hours ?? 0) > 4 ? 'text-rose-400' : (vr.monthly_downtime_hours ?? 0) > 2 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {vr.monthly_downtime_hours ?? 1.0}h
                  </span>
                </div>

                {/* MTTR */}
                <div className="text-center min-w-[60px]">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">MTTR</span>
                  <span className={`text-xs font-bold ${(vr.support_response_time_hrs ?? 0) > 4 ? 'text-rose-400' : (vr.support_response_time_hrs ?? 0) > 2 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {vr.support_response_time_hrs ?? 1.5}h
                  </span>
                </div>

                {/* BCP */}
                <div className="text-center min-w-[80px]">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">BCP</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${bcp.cls}`}>
                    {bcp.label}
                  </span>
                </div>

                {/* Dependency */}
                <div className="text-center min-w-[90px]">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Dependency</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${dep}`}>
                    {(vr.dependency_level ?? 'MODERATE').replace('_', ' ')}
                  </span>
                </div>

                {/* Edit */}
                <button
                  onClick={(e) => { e.stopPropagation(); openEdit(vr); }}
                  className="p-2 rounded-lg bg-slate-800/50 hover:bg-cyan-500/10 text-slate-400 hover:text-cyan-400 transition-all"
                  title="Edit Operational Risk"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="border-t border-slate-700/30 bg-[#0d1117] px-5 py-5 animate-fadeIn">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* SLA Compliance Detail */}
                    <div className="bg-[#111827] rounded-xl p-4 border border-slate-700/30">
                      <div className="flex items-center gap-2 mb-3">
                        <ShieldCheck className="w-4 h-4 text-cyan-400" />
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">SLA Compliance</span>
                      </div>
                      <p className={`text-xl font-black ${pctColor(sla)}`}>{sla}%</p>
                      <div className="w-full h-2 bg-slate-800 rounded-full mt-2 overflow-hidden">
                        <div className={`h-full rounded-full ${sla >= 99 ? 'bg-emerald-500' : sla >= 97 ? 'bg-yellow-500' : 'bg-rose-500'}`} style={{ width: `${clamp(sla, 0, 100)}%` }}></div>
                      </div>
                    </div>

                    {/* Downtime */}
                    <div className="bg-[#111827] rounded-xl p-4 border border-slate-700/30">
                      <div className="flex items-center gap-2 mb-3">
                        <Timer className="w-4 h-4 text-amber-400" />
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Monthly Downtime</span>
                      </div>
                      <p className={`text-xl font-black ${(vr.monthly_downtime_hours ?? 0) > 4 ? 'text-rose-400' : 'text-amber-400'}`}>{vr.monthly_downtime_hours ?? 1.0}h</p>
                      <p className="text-[10px] text-slate-500 mt-1">Incidents: {vr.incident_frequency ?? 1}/mo</p>
                    </div>

                    {/* Delivery & Quality */}
                    <div className="bg-[#111827] rounded-xl p-4 border border-slate-700/30">
                      <div className="flex items-center gap-2 mb-3">
                        <Truck className="w-4 h-4 text-purple-400" />
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Delivery / Quality</span>
                      </div>
                      <p className="text-xl font-black text-purple-400">{vr.delivery_delays_count ?? 0} delays</p>
                      <p className="text-[10px] text-slate-500 mt-1">Defect rate: {vr.quality_defect_rate_pct ?? 0.2}%</p>
                    </div>

                    {/* Support MTTR */}
                    <div className="bg-[#111827] rounded-xl p-4 border border-slate-700/30">
                      <div className="flex items-center gap-2 mb-3">
                        <Clock className="w-4 h-4 text-blue-400" />
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Support MTTR</span>
                      </div>
                      <p className={`text-xl font-black ${(vr.support_response_time_hrs ?? 0) > 4 ? 'text-rose-400' : 'text-blue-400'}`}>{vr.support_response_time_hrs ?? 1.5}h</p>
                      <p className="text-[10px] text-slate-500 mt-1">Avg response time</p>
                    </div>

                    {/* BCP */}
                    <div className="bg-[#111827] rounded-xl p-4 border border-slate-700/30">
                      <div className="flex items-center gap-2 mb-3">
                        <Shield className="w-4 h-4 text-emerald-400" />
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Business Continuity</span>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${bcp.cls}`}>{bcp.label}</span>
                      <p className="text-[10px] text-slate-500 mt-2">Audit Score: <span className={`font-bold ${scoreColor(vr.bcp_audit_score ?? 85)}`}>{vr.bcp_audit_score ?? 85}/100</span></p>
                    </div>

                    {/* Disaster Recovery */}
                    <div className="bg-[#111827] rounded-xl p-4 border border-slate-700/30">
                      <div className="flex items-center gap-2 mb-3">
                        <HardDrive className="w-4 h-4 text-indigo-400" />
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Disaster Recovery</span>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${dr.cls}`}>{dr.label}</span>
                      <div className="mt-2 flex gap-3 text-[10px] text-slate-400">
                        <span>RTO: <span className="font-bold text-slate-300">{vr.dr_rto_hours ?? 4.0}h</span></span>
                        <span>RPO: <span className="font-bold text-slate-300">{vr.dr_rpo_hours ?? 1.0}h</span></span>
                      </div>
                    </div>

                    {/* Vendor Dependency */}
                    <div className="bg-[#111827] rounded-xl p-4 border border-slate-700/30">
                      <div className="flex items-center gap-2 mb-3">
                        <Server className="w-4 h-4 text-rose-400" />
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Dependency Level</span>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${dep}`}>
                        {(vr.dependency_level ?? 'MODERATE').replace('_', ' ')}
                      </span>
                      <p className="text-[10px] text-slate-500 mt-2">
                        Replaceability: <span className={`font-bold ${scoreColor(vr.replaceability_score ?? 70)}`}>{vr.replaceability_score ?? 70}/100</span>
                      </p>
                    </div>

                    {/* Overall Operational Health */}
                    <div className="bg-[#111827] rounded-xl p-4 border border-slate-700/30">
                      <div className="flex items-center gap-2 mb-3">
                        <Activity className="w-4 h-4 text-teal-400" />
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Op. Health Score</span>
                      </div>
                      {(() => {
                        const health = Math.round(
                          (clamp(sla, 90, 100) - 90) * 10 * 0.3 +
                          clamp(100 - (vr.monthly_downtime_hours ?? 1) * 5, 0, 100) * 0.15 +
                          (vr.bcp_audit_score ?? 85) * 0.2 +
                          (vr.replaceability_score ?? 70) * 0.15 +
                          clamp(100 - (vr.support_response_time_hrs ?? 1.5) * 10, 0, 100) * 0.1 +
                          clamp(100 - (vr.quality_defect_rate_pct ?? 0.2) * 50, 0, 100) * 0.1
                        );
                        return (
                          <>
                            <p className={`text-xl font-black ${scoreColor(health)}`}>{health}/100</p>
                            <div className="w-full h-2 bg-slate-800 rounded-full mt-2 overflow-hidden">
                              <div className={`h-full rounded-full ${health >= 80 ? 'bg-emerald-500' : health >= 60 ? 'bg-yellow-500' : health >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${health}%` }}></div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit Modal */}
      {editVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setEditVendor(null)}>
          <div className="bg-[#111827] border border-cyan-500/30 rounded-2xl w-[680px] max-h-[85vh] overflow-y-auto shadow-2xl shadow-cyan-950/50" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-cyan-400" />
                  Edit Operational Risk — {editVendor.vendor_name}
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Update SLA, downtime, BCP/DR, and dependency metrics</p>
              </div>
              <button onClick={() => setEditVendor(null)} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Fields */}
            <div className="p-5 space-y-5">
              {/* SLA & Downtime Section */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" /> Service Level & Availability
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">SLA Compliance (%)</span>
                    <input type="number" step="0.1" min="0" max="100"
                      value={editForm.sla_compliance_pct}
                      onChange={(e) => setEditForm(f => ({ ...f, sla_compliance_pct: parseFloat(e.target.value) || 0 }))}
                      className="w-full mt-1 px-3 py-2 bg-[#0d1117] border border-slate-700/50 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Monthly Downtime (hrs)</span>
                    <input type="number" step="0.1" min="0"
                      value={editForm.monthly_downtime_hours}
                      onChange={(e) => setEditForm(f => ({ ...f, monthly_downtime_hours: parseFloat(e.target.value) || 0 }))}
                      className="w-full mt-1 px-3 py-2 bg-[#0d1117] border border-slate-700/50 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Incident Frequency (/mo)</span>
                    <input type="number" min="0"
                      value={editForm.incident_frequency}
                      onChange={(e) => setEditForm(f => ({ ...f, incident_frequency: parseInt(e.target.value) || 0 }))}
                      className="w-full mt-1 px-3 py-2 bg-[#0d1117] border border-slate-700/50 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Support MTTR (hrs)</span>
                    <input type="number" step="0.1" min="0"
                      value={editForm.support_response_time_hrs}
                      onChange={(e) => setEditForm(f => ({ ...f, support_response_time_hrs: parseFloat(e.target.value) || 0 }))}
                      className="w-full mt-1 px-3 py-2 bg-[#0d1117] border border-slate-700/50 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50"
                    />
                  </label>
                </div>
              </div>

              {/* Delivery & Quality Section */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Truck className="w-3.5 h-3.5 text-purple-400" /> Delivery & Quality
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Delivery Delays Count</span>
                    <input type="number" min="0"
                      value={editForm.delivery_delays_count}
                      onChange={(e) => setEditForm(f => ({ ...f, delivery_delays_count: parseInt(e.target.value) || 0 }))}
                      className="w-full mt-1 px-3 py-2 bg-[#0d1117] border border-slate-700/50 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Quality Defect Rate (%)</span>
                    <input type="number" step="0.01" min="0" max="100"
                      value={editForm.quality_defect_rate_pct}
                      onChange={(e) => setEditForm(f => ({ ...f, quality_defect_rate_pct: parseFloat(e.target.value) || 0 }))}
                      className="w-full mt-1 px-3 py-2 bg-[#0d1117] border border-slate-700/50 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50"
                    />
                  </label>
                </div>
              </div>

              {/* BCP / DR Section */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" /> Business Continuity & Disaster Recovery
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">BCP Status</span>
                    <select
                      value={editForm.bcp_status}
                      onChange={(e) => setEditForm(f => ({ ...f, bcp_status: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 bg-[#0d1117] border border-slate-700/50 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50"
                    >
                      <option value="VERIFIED">✓ Verified</option>
                      <option value="PENDING">⏳ Pending</option>
                      <option value="NOT_VERIFIED">✗ Not Verified</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">BCP Audit Score (0-100)</span>
                    <input type="number" min="0" max="100"
                      value={editForm.bcp_audit_score}
                      onChange={(e) => setEditForm(f => ({ ...f, bcp_audit_score: parseInt(e.target.value) || 0 }))}
                      className="w-full mt-1 px-3 py-2 bg-[#0d1117] border border-slate-700/50 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">DR RTO (hrs)</span>
                    <input type="number" step="0.5" min="0"
                      value={editForm.dr_rto_hours}
                      onChange={(e) => setEditForm(f => ({ ...f, dr_rto_hours: parseFloat(e.target.value) || 0 }))}
                      className="w-full mt-1 px-3 py-2 bg-[#0d1117] border border-slate-700/50 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">DR RPO (hrs)</span>
                    <input type="number" step="0.5" min="0"
                      value={editForm.dr_rpo_hours}
                      onChange={(e) => setEditForm(f => ({ ...f, dr_rpo_hours: parseFloat(e.target.value) || 0 }))}
                      className="w-full mt-1 px-3 py-2 bg-[#0d1117] border border-slate-700/50 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50"
                    />
                  </label>
                  <label className="block col-span-2">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">DR Testing Status</span>
                    <select
                      value={editForm.dr_testing_status}
                      onChange={(e) => setEditForm(f => ({ ...f, dr_testing_status: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 bg-[#0d1117] border border-slate-700/50 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50"
                    >
                      <option value="PASSED_Q1">✓ Passed Q1</option>
                      <option value="PASSED_Q2">✓ Passed Q2</option>
                      <option value="PASSED_Q3">✓ Passed Q3</option>
                      <option value="PASSED_Q4">✓ Passed Q4</option>
                      <option value="SCHEDULED">📅 Scheduled</option>
                      <option value="FAILED">✗ Failed</option>
                      <option value="NOT_TESTED">⚠ Not Tested</option>
                    </select>
                  </label>
                </div>
              </div>

              {/* Dependency Section */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Server className="w-3.5 h-3.5 text-rose-400" /> Vendor Dependency & Replaceability
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Dependency Level</span>
                    <select
                      value={editForm.dependency_level}
                      onChange={(e) => setEditForm(f => ({ ...f, dependency_level: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 bg-[#0d1117] border border-slate-700/50 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50"
                    >
                      <option value="LOW">🟢 Low — Easily Replaceable</option>
                      <option value="MODERATE">🟡 Moderate — Alternatives Exist</option>
                      <option value="HIGH">🟠 High — Few Alternatives</option>
                      <option value="HIGH_SINGLE_POINT">⛔ Critical SPOF — No Alternatives</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Replaceability Score (0-100)</span>
                    <input type="number" min="0" max="100"
                      value={editForm.replaceability_score}
                      onChange={(e) => setEditForm(f => ({ ...f, replaceability_score: parseInt(e.target.value) || 0 }))}
                      className="w-full mt-1 px-3 py-2 bg-[#0d1117] border border-slate-700/50 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 p-5 border-t border-slate-700/50">
              <button
                onClick={() => setEditVendor(null)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 border border-slate-700/50 rounded-xl hover:bg-slate-800 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-500 to-teal-500 rounded-xl flex items-center gap-2 shadow-lg shadow-cyan-950/50 hover:from-cyan-400 hover:to-teal-400 transition-all disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
      `}</style>
    </div>
  );
}

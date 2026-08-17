import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  ShieldAlert, 
  TrendingUp, 
  Layers, 
  RefreshCw, 
  ChevronRight, 
  Search, 
  Trash2, 
  Flame, 
  ArrowUpRight,
  Plus,
  FileText,
  Clock,
  Activity,
  AlertTriangle
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
  const [filterRisk, setFilterRisk] = useState('ALL');
  const [searchFilter, setSearchFilter] = useState('');
  const [refreshingId, setRefreshingId] = useState(null);
  
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
  }, [vendors]); // Re-fetch when vendors change


  const filteredVendors = vendors.filter(v => {
    const matchesRisk = 
      filterRisk === 'ALL' ? true :
      filterRisk === 'CRITICAL' ? v.risk_score >= 70 :
      filterRisk === 'WATCH' ? v.risk_score >= 40 && v.risk_score < 70 :
      v.risk_score < 40;

    const matchesSearch = 
      v.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      v.domain.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (v.sector && v.sector.toLowerCase().includes(searchFilter.toLowerCase()));

    return matchesRisk && matchesSearch;
  });

  const handleSingleRefresh = async (e, vendorId) => {
    e.stopPropagation();
    setRefreshingId(vendorId);
    try {
      const res = await fetch(`http://localhost:8000/api/vendors/${vendorId}/refresh`, {
        method: 'POST'
      });
      if (res.ok && onRefreshVendor) {
        onRefreshVendor();
      }
    } catch (err) {
      console.error("Error refreshing vendor:", err);
    } finally {
      setRefreshingId(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Overview Stat Cards Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Total Monitored Vendors */}
        <div className="bg-[#0a0f1d] border border-emerald-950/40 rounded-2xl p-4 relative overflow-hidden shadow-lg shadow-emerald-950/20 group hover:border-emerald-500/30 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Vendors</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[#00f090]">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-100 font-mono tracking-tight">{metricsLoading ? '-' : metrics.total_vendors}</span>
          </div>
        </div>

        {/* High Risk Vendors */}
        <div className="bg-[#0a0f1d] border border-rose-950/40 rounded-2xl p-4 relative overflow-hidden shadow-lg shadow-rose-950/20 group hover:border-rose-500/30 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">High-Risk Vendors</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-400 font-mono tracking-tight">{metricsLoading ? '-' : metrics.high_risk_vendors}</span>
          </div>
        </div>

        {/* Pending Assessments */}
        <div className="bg-[#0a0f1d] border border-amber-950/40 rounded-2xl p-4 relative overflow-hidden shadow-lg shadow-amber-950/20 group hover:border-amber-500/30 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Pending Assessments</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-400 font-mono tracking-tight">{metricsLoading ? '-' : metrics.pending_assessments}</span>
          </div>
        </div>

        {/* Expiring Certifications */}
        <div className="bg-[#0a0f1d] border border-orange-950/40 rounded-2xl p-4 relative overflow-hidden shadow-lg shadow-orange-950/20 group hover:border-orange-500/30 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Expiring Certs</span>
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-orange-400 font-mono tracking-tight">{metricsLoading ? '-' : metrics.expiring_certifications}</span>
          </div>
        </div>

        {/* Overall Risk Score */}
        <div className="bg-[#0a0f1d] border border-indigo-950/40 rounded-2xl p-4 relative overflow-hidden shadow-lg shadow-indigo-950/20 group hover:border-indigo-500/30 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Overall Risk Score</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-indigo-400 font-mono tracking-tight">{metricsLoading ? '-' : metrics.overall_risk_score}</span>
            <span className="text-[10px] text-slate-500">/ 100</span>
          </div>
        </div>
      </div>

      {/* Visualizations row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Risk Distribution */}
        <div className="bg-[#0a0f1d] border border-emerald-950/40 rounded-2xl p-5 shadow-xl">
          <h3 className="text-sm font-bold text-slate-100 mb-4 flex items-center gap-2"><Layers className="w-4 h-4 text-[#00f090]"/> Vendor Risk Distribution</h3>
          {metricsLoading ? (
            <div className="h-24 flex items-center justify-center text-slate-500 text-xs">Loading distribution...</div>
          ) : metrics.total_vendors === 0 ? (
            <div className="h-24 flex items-center justify-center text-slate-500 text-xs">No vendors to display</div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-rose-400 font-semibold">CRITICAL (70+)</span>
                  <span className="text-slate-400">{metrics.risk_distribution.CRITICAL || 0}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5">
                  <div className="bg-rose-500 h-1.5 rounded-full" style={{ width: `${((metrics.risk_distribution.CRITICAL || 0) / metrics.total_vendors) * 100}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-amber-400 font-semibold">WATCH (40-69)</span>
                  <span className="text-slate-400">{metrics.risk_distribution.WATCH || 0}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5">
                  <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${((metrics.risk_distribution.WATCH || 0) / metrics.total_vendors) * 100}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#00f090] font-semibold">SAFE (&lt;40)</span>
                  <span className="text-slate-400">{metrics.risk_distribution.SAFE || 0}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5">
                  <div className="bg-[#00f090] h-1.5 rounded-full" style={{ width: `${((metrics.risk_distribution.SAFE || 0) / metrics.total_vendors) * 100}%` }}></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Risk Trend */}
        <div className="bg-[#0a0f1d] border border-emerald-950/40 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-indigo-400"/> Risk Trend</h3>
            <span className="text-[10px] text-slate-400">Avg Score by Month</span>
          </div>
          {metricsLoading ? (
            <div className="h-24 flex items-center justify-center text-slate-500 text-xs">Loading trend...</div>
          ) : metrics.risk_trend.length === 0 ? (
            <div className="h-24 flex items-center justify-center text-slate-500 text-xs">No historical risk data</div>
          ) : (
            <div className="h-24 flex items-end gap-2 px-2">
              {metrics.risk_trend.map((point, idx) => {
                const heightPercent = Math.max(10, (point.avg_score / 100) * 100);
                const colorClass = point.avg_score >= 70 ? 'bg-rose-500/80 hover:bg-rose-400' : point.avg_score >= 40 ? 'bg-amber-500/80 hover:bg-amber-400' : 'bg-emerald-500/80 hover:bg-emerald-400';
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                    <div className="w-full relative flex items-end justify-center h-20">
                      <div className={`w-full max-w-[24px] rounded-t-sm transition-all duration-300 ${colorClass}`} style={{ height: `${heightPercent}%` }}>
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-slate-200 text-[9px] py-0.5 px-1.5 rounded whitespace-nowrap z-10 transition-opacity">
                          Avg: {point.avg_score}
                        </div>
                      </div>
                    </div>
                    <span className="text-[9px] text-slate-500 uppercase">{point.month.split('-')[1]}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main Vendor Inventory & Risk Assessment Table */}
      <div className="bg-[#0a0f1d] border border-emerald-950/40 rounded-2xl shadow-xl overflow-hidden">
        {/* Table Header Bar */}
        <div className="p-5 border-b border-emerald-950/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              Enterprise Monitored Vendors
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-[#00f090] border border-emerald-500/20">
                {filteredVendors.length} Assets
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Automated multi-probe threat monitoring and risk calculation</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Filter Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter vendor list..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="bg-[#070a12] border border-emerald-900/30 focus:border-[#00f090]/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition-all w-48"
              />
            </div>

            {/* Risk Tier Tabs */}
            <div className="flex items-center bg-[#070a12] p-1 rounded-xl border border-emerald-900/30 text-xs">
              {[
                { key: 'ALL', label: 'All Vendors' },
                { key: 'CRITICAL', label: 'Critical Risk (70+)' },
                { key: 'WATCH', label: 'Watch (40-69)' },
                { key: 'SAFE', label: 'Safe (<40)' }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilterRisk(tab.key)}
                  className={`px-3 py-1 rounded-lg font-semibold transition-all text-xs ${
                    filterRisk === tab.key
                      ? 'bg-emerald-500/20 text-[#00f090] border border-emerald-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Vendors Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-emerald-950/40 text-slate-400 uppercase text-[10px] tracking-wider font-semibold bg-[#070a12]/60">
                <th className="py-3.5 px-4">Vendor &amp; Domain</th>
                <th className="py-3.5 px-4">Industry Sector</th>
                <th className="py-3.5 px-4 text-center">Security Risk Score</th>
                <th className="py-3.5 px-4">Multi-Vector Probes</th>
                <th className="py-3.5 px-4">Risk Tier</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-950/30">
              {filteredVendors.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    No vendors registered yet. Add your first vendor to start monitoring vendor risk.
                  </td>
                </tr>
              ) : (
                filteredVendors.map((vendor) => {
                  const isCritical = vendor.risk_score >= 70;
                  const isWatch = vendor.risk_score >= 40 && vendor.risk_score < 70;
                  const hasCriticalIncident = vendor.critical_active > 0;
                  const hasActiveIncident = vendor.active_incidents > 0;

                  return (
                    <tr
                      key={vendor.id}
                      onClick={() => onSelectVendor(vendor.id)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    >
                      {/* Vendor Name & Domain */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm text-slate-100 ${
                            isCritical ? 'bg-rose-950/80 border border-rose-500/40 text-rose-300' :
                            isWatch ? 'bg-amber-950/80 border border-amber-500/40 text-amber-300' :
                            'bg-emerald-950/80 border border-emerald-500/40 text-[#00f090]'
                          }`}>
                            {vendor.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-100 group-hover:text-[#00f090] transition-colors flex items-center gap-2">
                              {vendor.name}
                              {hasCriticalIncident && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse" title="Active Critical Incident">
                                  <Flame className="w-2.5 h-2.5" /> HAZARD
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                              <span>{vendor.domain}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Sector */}
                      <td className="py-4 px-4">
                        <span className="px-2.5 py-1 rounded-lg bg-[#070a12] border border-emerald-900/30 text-slate-300 font-medium text-[11px]">
                          {vendor.sector}
                        </span>
                      </td>

                      {/* Score Badge */}
                      <td className="py-4 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className={`text-base font-black px-3 py-0.5 rounded-full font-mono ${
                            isCritical ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' :
                            isWatch ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                            'bg-emerald-500/20 text-[#00f090] border border-emerald-500/40'
                          }`}>
                            {vendor.risk_score}
                          </span>
                          {hasActiveIncident && (
                            <span className="text-[9px] font-bold text-rose-400 mt-0.5 font-mono">
                              +{vendor.incident_penalty} pts
                            </span>
                          )}
                          <span className="text-[9px] font-semibold text-slate-500 uppercase mt-0.5">/ 100 Score</span>
                        </div>
                      </td>

                      {/* Sub-score Pills */}
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                          <span className="px-2 py-0.5 rounded bg-[#070a12] border border-emerald-900/30 text-slate-300">
                            📰 News: {vendor.news_score}
                          </span>
                          {vendor.custom_ticker && (
                            <span className="px-2 py-0.5 rounded bg-[#070a12] border border-emerald-500/30 text-[#00f090]">
                              📈 Stock: ${vendor.custom_ticker}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Risk Tier Badge */}
                      <td className="py-4 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
                          isCritical ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' :
                          isWatch ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                          'bg-emerald-500/20 text-[#00f090] border border-emerald-500/40'
                        }`}>
                          {vendor.risk_tier} RISK
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => handleSingleRefresh(e, vendor.id)}
                            disabled={refreshingId === vendor.id}
                            title="Trigger Multi-API Refresh"
                            className="p-1.5 rounded-lg bg-[#070a12] border border-emerald-900/30 text-slate-300 hover:text-[#00f090] hover:border-emerald-500/50 transition-colors"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${refreshingId === vendor.id ? 'animate-spin text-[#00f090]' : ''}`} />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteVendor(vendor.id);
                            }}
                            title="Delete Vendor"
                            className="p-1.5 rounded-lg bg-[#070a12] border border-emerald-900/30 text-slate-400 hover:text-rose-400 hover:border-rose-500/50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
  );
}

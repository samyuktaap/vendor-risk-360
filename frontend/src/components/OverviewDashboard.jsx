import React, { useState } from 'react';
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
  Plus
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

  const totalCount = vendors.length;
  const criticalVendors = vendors.filter(v => v.risk_score >= 70);
  const watchVendors = vendors.filter(v => v.risk_score >= 40 && v.risk_score < 70);
  const safeVendors = vendors.filter(v => v.risk_score < 40);

  const avgScore = totalCount > 0 
    ? Math.round(vendors.reduce((acc, v) => acc + v.risk_score, 0) / totalCount) 
    : 0;

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Monitored Vendors */}
        <div className="bg-[#0a0f1d] border border-emerald-950/40 rounded-2xl p-5 relative overflow-hidden shadow-lg shadow-emerald-950/20 group hover:border-emerald-500/30 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Monitored Portfolio</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[#00f090]">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-100 font-mono tracking-tight">{totalCount}</span>
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-0.5">
              <ArrowUpRight className="w-3.5 h-3.5 text-[#00f090]" /> Active
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
            <span className="text-emerald-400 font-semibold">{safeVendors.length} Safe</span>
            <span>•</span>
            <span className="text-amber-400 font-semibold">{watchVendors.length} Watch</span>
            <span>•</span>
            <span className="text-rose-400 font-semibold">{criticalVendors.length} Critical</span>
          </div>
        </div>

        {/* Critical Risk Vendors */}
        <div className="bg-[#0a0f1d] border border-rose-950/40 rounded-2xl p-5 relative overflow-hidden shadow-lg shadow-rose-950/20 group hover:border-rose-500/30 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Critical Risk Vendors</span>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black text-rose-400 font-mono tracking-tight">{criticalVendors.length}</span>
            <span className="text-xs text-rose-400 font-semibold">Immediate Action</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 truncate">
            {criticalVendors.length > 0 ? `${criticalVendors[0].name} requires remediation` : 'No critical risk vendors detected'}
          </div>
        </div>

        {/* Average Security Risk Score */}
        <div className="bg-[#0a0f1d] border border-emerald-950/40 rounded-2xl p-5 relative overflow-hidden shadow-lg shadow-emerald-950/20 group hover:border-emerald-500/30 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Portfolio Risk Average</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[#00f090]">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-100 font-mono tracking-tight">{avgScore}</span>
            <span className="text-xs text-slate-400 font-mono">/ 100 max</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            Weighted composite risk score across all vendors
          </div>
        </div>

        {/* Risk Contagion Quick Launcher */}
        <div 
          onClick={onNavigateToContagion}
          className="bg-gradient-to-br from-[#0a0f1d] to-[#0d162a] border border-emerald-500/30 hover:border-emerald-500/60 rounded-2xl p-5 relative overflow-hidden shadow-lg shadow-emerald-950/40 cursor-pointer group transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#00f090]" /> Supply Chain Graph
            </span>
            <ChevronRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-1 transition-transform" />
          </div>
          <div className="mt-3">
            <div className="text-sm font-bold text-slate-100 group-hover:text-[#00f090] transition-colors">
              Risk Contagion Topology Map
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Visualize cascade vulnerability pathways and critical vendor dependencies.
            </p>
          </div>
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
                    No vendors match the active filter criteria.
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

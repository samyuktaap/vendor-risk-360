import React, { useState } from 'react';
import { 
  Building2, 
  ShieldAlert, 
  Activity, 
  TrendingUp, 
  Layers, 
  RefreshCw, 
  ExternalLink, 
  ChevronRight,
  Filter,
  Search,
  CheckCircle2,
  AlertOctagon,
  Trash2,
  TrendingDown
} from 'lucide-react';
import RiskScoreRing from './RiskScoreRing';

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

  // Compute Metrics
  const totalCount = vendors.length;
  const criticalVendors = vendors.filter(v => v.risk_score >= 70);
  const watchVendors = vendors.filter(v => v.risk_score >= 40 && v.risk_score < 70);
  const safeVendors = vendors.filter(v => v.risk_score < 40);

  const avgScore = totalCount > 0 
    ? Math.round(vendors.reduce((acc, v) => acc + v.risk_score, 0) / totalCount) 
    : 0;

  // Filter vendors list
  const filteredVendors = vendors.filter(v => {
    const matchesRisk = 
      filterRisk === 'ALL' ? true :
      filterRisk === 'CRITICAL' ? v.risk_score >= 70 :
      filterRisk === 'WATCH' ? v.risk_score >= 40 && v.risk_score < 70 :
      v.risk_score < 40;

    const matchesSearch = 
      v.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      v.domain.toLowerCase().includes(searchFilter.toLowerCase()) ||
      v.sector.toLowerCase().includes(searchFilter.toLowerCase());

    return matchesRisk && matchesSearch;
  });

  const handleSingleRefresh = async (e, vendorId) => {
    e.stopPropagation();
    setRefreshingId(vendorId);
    try {
      const res = await fetch(`http://localhost:8000/api/vendors/${vendorId}/refresh`, { method: 'POST' });
      if (res.ok && onRefreshVendor) {
        onRefreshVendor();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Monitored Vendors */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg backdrop-blur-md relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Monitored Vendors
            </span>
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-100">{totalCount}</span>
            <span className="text-xs text-slate-400">Active Supply Chain</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            {safeVendors.length} Low Risk &bull; {watchVendors.length} Watch &bull; {criticalVendors.length} Critical
          </div>
        </div>

        {/* Metric 2: Critical Risk Alerts */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg backdrop-blur-md relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Critical Risk Alerts
            </span>
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-rose-400">{criticalVendors.length}</span>
            <span className="text-xs font-bold text-rose-400/80 uppercase tracking-wide">
              {criticalVendors.length > 0 ? 'Requires Immediate Action' : 'All Clear'}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 truncate">
            Score &ge; 70 hazard threshold
          </div>
        </div>

        {/* Metric 3: Network Risk Index */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg backdrop-blur-md relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              5-Vector Risk Index
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-100">{avgScore}</span>
            <span className="text-xs text-slate-400">/ 100 Risk Score</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            News, Breaches, Sanctions, Stocks & SSL
          </div>
        </div>

        {/* Metric 4: Risk Contagion Quick Action */}
        <div 
          onClick={onNavigateToContagion}
          className="bg-gradient-to-br from-slate-900 to-slate-950 border border-cyan-500/30 rounded-2xl p-5 shadow-lg backdrop-blur-md cursor-pointer hover:border-cyan-400 transition-all duration-300 group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
              <Layers className="w-4 h-4" />
              Contagion Map
            </span>
            <ChevronRight className="w-4 h-4 text-cyan-400 group-hover:translate-x-1 transition-transform" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-100 mt-2">View Topology Network</div>
            <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
              Visualize central HQ contagion vectors & red alert hazard nodes.
            </p>
          </div>
        </div>
      </div>

      {/* Main Vendor Risk Matrix Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md">
        {/* Table Header & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 mb-4 border-b border-slate-800 gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-cyan-400" />
              Multi-Vector Vendor Risk Matrix
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Continuously evaluated across HIBP breaches, NewsAPI, OpenSanctions, Stock Market volatility, and SSL posture.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Risk Tier Filters */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
              {[
                { id: 'ALL', label: 'All' },
                { id: 'CRITICAL', label: 'Critical (≥70)' },
                { id: 'WATCH', label: 'Watch (40-69)' },
                { id: 'LOW', label: 'Low (<40)' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterRisk(tab.id)}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    filterRisk === tab.id
                      ? 'bg-slate-800 text-cyan-300 shadow-sm'
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
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                <th className="py-3 px-4">Vendor & Domain</th>
                <th className="py-3 px-4">Industry Sector</th>
                <th className="py-3 px-4 text-center">Security Risk Score</th>
                <th className="py-3 px-4">5-Vector Breakdown (News / HIBP / Sanc / Stock / SSL)</th>
                <th className="py-3 px-4">Risk Classification</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
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

                  return (
                    <tr
                      key={vendor.id}
                      onClick={() => onSelectVendor(vendor.id)}
                      className="hover:bg-slate-800/50 cursor-pointer transition-colors group"
                    >
                      {/* Vendor Name & Domain */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm text-slate-100 ${
                            isCritical ? 'bg-rose-950/80 border border-rose-500/40 text-rose-300' :
                            isWatch ? 'bg-amber-950/80 border border-amber-500/40 text-amber-300' :
                            'bg-slate-800 border border-slate-700 text-cyan-300'
                          }`}>
                            {vendor.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-100 group-hover:text-cyan-300 transition-colors">
                              {vendor.name}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                              <span>{vendor.domain}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Sector */}
                      <td className="py-4 px-4">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700/60 text-slate-300 font-medium text-[11px]">
                          {vendor.sector}
                        </span>
                      </td>

                      {/* Score Badge */}
                      <td className="py-4 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className={`text-base font-black px-3 py-0.5 rounded-full font-mono ${
                            isCritical ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' :
                            isWatch ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                            'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          }`}>
                            {vendor.risk_score}
                          </span>
                          <span className="text-[9px] font-semibold text-slate-500 uppercase mt-0.5">/ 100 Score</span>
                        </div>
                      </td>

                      {/* Sub-score Pills */}
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                            📰 News: {vendor.news_score}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                            🛡️ HIBP: {vendor.hibp_score}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                            ⚖️ Sanc: {vendor.sanctions_score}
                          </span>
                        </div>
                      </td>

                      {/* Risk Tier Badge */}
                      <td className="py-4 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
                          isCritical ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' :
                          isWatch ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                          'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
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
                            className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/50 transition-colors"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${refreshingId === vendor.id ? 'animate-spin text-cyan-400' : ''}`} />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteVendor(vendor.id);
                            }}
                            title="Delete Vendor"
                            className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-rose-400 hover:border-rose-500/50 transition-colors"
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

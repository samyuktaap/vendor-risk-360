import React, { useState } from 'react';
import { 
  Building2, 
  Plus, 
  Search, 
  RefreshCw, 
  Trash2, 
  ExternalLink, 
  Globe,
  ShieldAlert,
  SlidersHorizontal
} from 'lucide-react';

export default function VendorRoster({ 
  vendors = [], 
  onSelectVendor, 
  onOpenAddModal, 
  onRefreshVendor, 
  onDeleteVendor 
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTier, setFilterTier] = useState('ALL');
  const [refreshingId, setRefreshingId] = useState(null);

  const filtered = vendors.filter(v => {
    const matchesTier = 
      filterTier === 'ALL' ? true :
      filterTier === 'CRITICAL' ? v.risk_score >= 70 :
      filterTier === 'WATCH' ? v.risk_score >= 40 && v.risk_score < 70 :
      v.risk_score < 40;

    const matchesSearch = 
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.sector.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesTier && matchesSearch;
  });

  const handleRefresh = async (e, id) => {
    e.stopPropagation();
    setRefreshingId(id);
    try {
      const res = await fetch(`http://localhost:8000/api/vendors/${id}/refresh`, { method: 'POST' });
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
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-6 rounded-2xl backdrop-blur-md">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-cyan-400" />
            Enterprise Monitored Vendors Roster ({vendors.length})
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Continuous automated monitoring of vendor domains across HIBP data breaches, news sentiment, and sanctions lists.
          </p>
        </div>

        <button
          onClick={onOpenAddModal}
          className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-cyan-950/40 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Vendor</span>
        </button>
      </div>

      {/* Controls & Filter Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search roster by vendor name, domain, or sector..."
            className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
          />
        </div>

        {/* Tier Tabs */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
          {['ALL', 'CRITICAL', 'WATCH', 'LOW'].map((tier) => (
            <button
              key={tier}
              onClick={() => setFilterTier(tier)}
              className={`px-3 py-1 rounded-lg transition-all ${
                filterTier === tier
                  ? 'bg-slate-800 text-cyan-300 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tier}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Vendors */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 text-xs bg-slate-900/40 rounded-2xl border border-slate-800">
            No vendors match the active search filter.
          </div>
        ) : (
          filtered.map((v) => {
            const isCritical = v.risk_score >= 70;
            const isWatch = v.risk_score >= 40 && v.risk_score < 70;

            return (
              <div
                key={v.id}
                onClick={() => onSelectVendor(v.id)}
                className="bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 rounded-2xl p-5 shadow-lg backdrop-blur-md cursor-pointer transition-all duration-300 flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base text-slate-100 ${
                        isCritical ? 'bg-rose-950 border border-rose-500/40 text-rose-300' :
                        isWatch ? 'bg-amber-950 border border-amber-500/40 text-amber-300' :
                        'bg-slate-800 border border-slate-700 text-cyan-300'
                      }`}>
                        {v.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-100 text-sm group-hover:text-cyan-300 transition-colors">
                          {v.name}
                        </h3>
                        <div className="text-xs text-slate-400 font-mono flex items-center gap-1">
                          <Globe className="w-3 h-3 text-slate-500" />
                          <span>{v.domain}</span>
                        </div>
                      </div>
                    </div>

                    <span className={`text-base font-black px-2.5 py-0.5 rounded-full font-mono border ${
                      isCritical ? 'bg-rose-500/20 text-rose-400 border-rose-500/40' :
                      isWatch ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' :
                      'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    }`}>
                      {v.risk_score}
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                    <span className="px-2.5 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                      {v.sector}
                    </span>
                    <span className={`text-[10px] font-bold uppercase ${
                      isCritical ? 'text-rose-400' : isWatch ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {v.risk_tier} RISK
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                  <span className="text-[11px] font-mono text-slate-500">
                    Last audit: {v.last_checked_at ? new Date(v.last_checked_at).toLocaleDateString() : 'Recent'}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleRefresh(e, v.id)}
                      disabled={refreshingId === v.id}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-400 transition-colors"
                      title="Trigger Manual Refresh"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${refreshingId === v.id ? 'animate-spin text-cyan-400' : ''}`} />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteVendor(v.id);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition-colors"
                      title="Delete Vendor"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

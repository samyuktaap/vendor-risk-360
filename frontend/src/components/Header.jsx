import React, { useState } from 'react';
import { 
  Search, 
  Bell, 
  Building, 
  ShieldCheck, 
  Sparkles, 
  X, 
  ChevronDown,
  AlertTriangle
} from 'lucide-react';

export default function Header({ 
  searchQuery, 
  setSearchQuery, 
  criticalVendors = [], 
  onSelectVendor, 
  quotaStats 
}) {
  const [showNotifications, setShowNotifications] = useState(false);
  const criticalCount = criticalVendors.length;

  return (
    <header className="h-16 bg-[#0d131f]/90 backdrop-blur-md border-b border-slate-800/80 px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Search Input & Company Switcher */}
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300">
          <Building className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-semibold text-slate-200">Acme Enterprise</span>
          <ChevronDown className="w-3 h-3 text-slate-500" />
        </div>

        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search vendors, domains, or industry sectors..."
            className="w-full bg-slate-900/90 border border-slate-800 focus:border-cyan-500/80 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Right Toolbar */}
      <div className="flex items-center gap-4">
        {/* Live API Radar Active Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-[11px] text-emerald-400 font-semibold shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span>LIVE API RADAR ACTIVE</span>
        </div>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 transition-colors"
          >
            <Bell className="w-4 h-4" />
            {criticalCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {criticalCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="font-semibold text-xs text-slate-200 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  Security Risk Alerts ({criticalCount})
                </span>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-slate-400 hover:text-slate-200 text-xs"
                >
                  Close
                </button>
              </div>

              <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                {criticalCount === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-400 flex flex-col items-center gap-1">
                    <ShieldCheck className="w-6 h-6 text-emerald-400" />
                    <span>No critical security alerts triggered.</span>
                  </div>
                ) : (
                  criticalVendors.map((v) => (
                    <div
                      key={v.id}
                      onClick={() => {
                        onSelectVendor(v.id);
                        setShowNotifications(false);
                      }}
                      className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-500/30 hover:bg-rose-900/40 cursor-pointer transition-colors flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-xs text-rose-200">{v.name}</div>
                        <div className="text-[10px] text-slate-400">{v.sector}</div>
                      </div>
                      <div className="text-right">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500 text-white">
                          Score {v.risk_score}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

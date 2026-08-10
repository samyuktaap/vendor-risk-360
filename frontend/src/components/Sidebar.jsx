import React from 'react';
import { 
  ShieldAlert, 
  LayoutDashboard, 
  Network, 
  Building2, 
  Activity, 
  Gauge, 
  Plus,
  Radio
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, onOpenAddModal, criticalCount }) {
  const navItems = [
    { id: 'overview', label: 'Overview Dashboard', icon: LayoutDashboard },
    { id: 'contagion', label: 'Risk Contagion Map', icon: Network, badge: criticalCount > 0 ? `${criticalCount} Critical` : null },
    { id: 'vendors', label: 'Monitored Vendors', icon: Building2 },
    { id: 'feed', label: 'Live Activity Stream', icon: Activity },
    { id: 'quota', label: 'API Quota Debugger', icon: Gauge },
  ];

  return (
    <aside className="w-64 bg-[#0d131f] border-r border-slate-800/80 flex flex-col justify-between h-screen sticky top-0 z-30 select-none">
      {/* Brand Header */}
      <div>
        <div className="p-5 border-b border-slate-800/80 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 via-amber-500 to-emerald-500 p-[1.5px] shadow-lg shadow-rose-950/40">
            <div className="w-full h-full bg-slate-950 rounded-[10.5px] flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
            </div>
          </div>
          <div>
            <h1 className="font-bold text-slate-100 text-base tracking-tight leading-none flex items-center gap-1.5">
              VendorRisk <span className="text-cyan-400 font-extrabold">360</span>
            </h1>
            <p className="text-[11px] text-slate-400 mt-1 font-medium tracking-wide">Security Incident Engine</p>
          </div>
        </div>

        {/* Action Button */}
        <div className="p-4">
          <button
            onClick={onOpenAddModal}
            className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50 transition-all duration-200 hover:shadow-cyan-900/60 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Onboard Vendor</span>
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="px-3 space-y-1">
          <div className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Navigation Menu
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-slate-800/90 text-cyan-300 border border-slate-700/80 shadow-md shadow-slate-950/50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* System Status Footer */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Engine Active</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono">v1.0.4</span>
        </div>
        <div className="mt-2 text-[10px] text-slate-500 truncate">
          Monitoring 5 Enterprise Feeds
        </div>
      </div>
    </aside>
  );
}

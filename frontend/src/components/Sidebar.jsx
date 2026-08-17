import React from 'react';
import { 
  ShieldAlert, 
  LayoutDashboard, 
  Network, 
  Building2, 
  Activity, 
  Gauge, 
  Plus,
  Radio,
  Flame,
  Award,
  CheckSquare,
  BarChart3,
  FileText,
  Bell
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, onOpenAddModal, criticalCount, activeIncidentsCount = 0, unreadAlertCount = 0 }) {
  const navItems = [
    { id: 'overview', label: 'Overview Dashboard', icon: LayoutDashboard },
    { id: 'incidents', label: 'Incident Center', icon: Flame, badge: activeIncidentsCount > 0 ? `${activeIncidentsCount} Active` : null },
    { id: 'compliance', label: 'Compliance Manager', icon: Award },
    { id: 'remediation', label: 'Remediation Tasks', icon: CheckSquare },
    { id: 'operational-risk', label: 'Operational Risk', icon: BarChart3 },
    { id: 'documents', label: 'Document Manager', icon: FileText },
    { id: 'alerts', label: 'Alert Center', icon: Bell, badge: unreadAlertCount > 0 ? `${unreadAlertCount} New` : null, badgePulse: true },
    { id: 'contagion', label: 'Risk Contagion Map', icon: Network, badge: criticalCount > 0 ? `${criticalCount} Critical` : null },
    { id: 'vendors', label: 'Monitored Vendors', icon: Building2 },
    { id: 'feed', label: 'Live Activity Stream', icon: Activity },
    { id: 'quota', label: 'API Quota Debugger', icon: Gauge },
  ];

  return (
    <aside className="w-64 bg-[#0a0f1d] border-r border-emerald-950/40 flex flex-col justify-between h-screen sticky top-0 z-30 select-none">
      {/* Brand Header */}
      <div>
        <div className="p-5 border-b border-emerald-950/40 flex items-center gap-3">
          <div className="relative group flex items-center justify-center">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#00f090] via-teal-400 to-emerald-600 p-[1.5px] shadow-lg shadow-emerald-950/80 transition-transform duration-300 group-hover:scale-105">
              <div className="w-full h-full bg-[#070a12] rounded-[10.5px] flex items-center justify-center relative overflow-hidden">
                {/* Background Ambient Glow */}
                <div className="absolute inset-0 bg-emerald-500/10 blur-sm"></div>
                {/* Radiant 360 Cyber Shield SVG Emblem */}
                <svg className="w-6 h-6 relative z-10 text-[#00f090] drop-shadow-[0_0_8px_rgba(0,240,144,0.6)]" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L3 6V11C3 16.55 7.16 21.74 12 23C16.84 21.74 21 16.55 21 11V6L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="rgba(0,240,144,0.08)" />
                  <circle cx="12" cy="11" r="3.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
                  <path d="M12 7.5V11L14.5 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="11" r="1" fill="currentColor" />
                </svg>
              </div>
            </div>
          </div>
          <div>
            <h1 className="font-extrabold text-slate-100 text-base tracking-tight leading-none flex items-center gap-1 font-sans">
              VendorRisk <span className="text-[#00f090] font-black tracking-tight">360°</span>
            </h1>
            <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mt-1.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00f090] animate-pulse"></span>
              Enterprise OS
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="p-4">
          <button
            onClick={onOpenAddModal}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all duration-200 hover:shadow-emerald-900/60 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
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
                    ? 'bg-emerald-950/40 text-[#00f090] border border-emerald-500/30 shadow-md shadow-emerald-950/50 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#00f090]' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                    item.id === 'alerts'
                      ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  } ${item.badgePulse ? 'animate-pulse' : ''}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* System Status Footer */}
      <div className="p-4 border-t border-emerald-950/40 bg-[#070a12]">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-[#00f090] animate-pulse" />
            <span className="text-slate-300 font-medium">Engine Active</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/60 text-[#00f090] border border-emerald-500/30 font-mono font-bold">v1.0.4</span>
        </div>
        <div className="mt-2 text-[10px] text-slate-500 truncate">
          Monitoring 5 Enterprise Feeds
        </div>
      </div>
    </aside>
  );
}

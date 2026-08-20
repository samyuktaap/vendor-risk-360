import React from 'react';
import { 
  ShieldAlert, 
  LayoutDashboard, 
  Building2, 
  Plus,
  Radio,
  Award,
  CheckSquare,
  BarChart3,
  Bell,
  History,
  ShieldCheck,
  Scale
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, onOpenAddModal, criticalCount = 0, unreadAlertCount = 0 }) {
  // CISO-Specific Navigation Items as specified:
  // 1. CISO Overview, 2. All Vendors, 3. Risk Management, 4. Compliance Overview, 5. Alerts, 6. Decisions / Reviews, 7. Reports, 8. Audit History
  const cisoNavItems = [
    { id: 'overview', label: 'CISO Overview', icon: LayoutDashboard },
    { id: 'vendors', label: 'All Vendors', icon: Building2 },
    { id: 'risk-management', label: 'Risk Management', icon: ShieldAlert, badge: criticalCount > 0 ? `${criticalCount} High Risk` : null },
    { id: 'compliance-overview', label: 'Compliance Overview', icon: Award },
    { id: 'alerts', label: 'Alerts', icon: Bell, badge: unreadAlertCount > 0 ? `${unreadAlertCount} New` : null, badgePulse: true },
    { id: 'decisions', label: 'Decisions / Reviews', icon: CheckSquare },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'audit-history', label: 'Audit History', icon: History }
  ];

  return (
    <aside className="w-64 bg-[#0a0f1d] border-r border-slate-800 flex flex-col justify-between h-screen sticky top-0 z-30 select-none font-sans">
      {/* Brand Header */}
      <div>
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <div className="relative group flex items-center justify-center">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 via-teal-400 to-blue-600 p-[1.5px] shadow-lg shadow-cyan-950/80 transition-transform duration-300 group-hover:scale-105">
              <div className="w-full h-full bg-[#070a12] rounded-[9.5px] flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-cyan-500/10 blur-sm"></div>
                <svg className="w-5 h-5 relative z-10 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L3 6V11C3 16.55 7.16 21.74 12 23C16.84 21.74 21 16.55 21 11V6L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="rgba(6,182,212,0.08)" />
                  <circle cx="12" cy="11" r="3.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
                  <path d="M12 7.5V11L14.5 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="11" r="1" fill="currentColor" />
                </svg>
              </div>
            </div>
          </div>
          <div>
            <h1 className="font-extrabold text-slate-100 text-base tracking-tight leading-none flex items-center gap-1 font-sans">
              VendorRisk <span className="text-cyan-400 font-black tracking-tight">360°</span>
            </h1>
            <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider mt-1.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              CISO Command Center
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="p-4">
          <button
            onClick={onOpenAddModal}
            className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50 transition-all duration-200 hover:shadow-cyan-900/60 active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Onboard Vendor</span>
          </button>
        </div>

        {/* CISO Dedicated Navigation Items */}
        <nav className="px-3 space-y-1">
          <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            CISO Navigation
          </div>
          {cisoNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-md shadow-cyan-950/50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
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
      <div className="p-4 border-t border-slate-800 bg-[#070a12]">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="text-slate-300 font-medium">CISO Engine Active</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-cyan-400 border border-cyan-500/30 font-mono font-bold">v2.0</span>
        </div>
        <div className="mt-1.5 text-[10px] text-slate-500 truncate font-mono">
          Security Decision Hub
        </div>
      </div>
    </aside>
  );
}

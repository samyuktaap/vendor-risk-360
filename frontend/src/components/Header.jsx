import React, { useState } from 'react';
import { 
  Search, 
  Bell, 
  Building, 
  ShieldCheck, 
  Sparkles, 
  X, 
  ChevronDown,
  AlertTriangle,
  User,
  LogIn,
  LogOut,
  Volume2
} from 'lucide-react';

export default function Header({ 
  searchQuery, 
  setSearchQuery, 
  criticalVendors = [], 
  onSelectVendor, 
  quotaStats,
  currentUser,
  onOpenAuth,
  onSignOut,
  onOpenVoiceDemo,
  unreadAlertCount = 0,
  onOpenAlerts
}) {
  const criticalCount = criticalVendors.length;

  return (
    <header className="h-16 bg-[#0a0f1d]/90 backdrop-blur-md border-b border-emerald-950/40 px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Search Input & Company Switcher */}
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <div className="flex items-center gap-2 bg-[#070a12] border border-emerald-900/30 rounded-xl px-3 py-1.5 text-xs text-slate-300">
          <Building className="w-3.5 h-3.5 text-[#00f090]" />
          <span className="font-semibold text-slate-200">
            {currentUser?.role === 'vendor' ? currentUser.name : 'Acme Enterprise'}
          </span>
          <ChevronDown className="w-3 h-3 text-slate-500" />
        </div>

        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search vendors, domains, or industry sectors..."
            className="w-full bg-[#070a12] border border-emerald-900/30 focus:border-[#00f090]/80 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-all"
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
      <div className="flex items-center gap-3">
        {/* 🔊 How It Works Voice Guided Demo Button */}
        <button
          onClick={onOpenVoiceDemo}
          className="px-3 py-1 bg-gradient-to-r from-cyan-500/20 to-teal-500/20 hover:from-cyan-500/30 hover:to-teal-500/30 border border-cyan-500/40 rounded-full text-[11px] text-cyan-300 font-bold flex items-center gap-1.5 shadow-sm transition-all animate-pulse"
        >
          <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
          <span>How It Works (Voice Demo)</span>
        </button>

        {/* Live API Radar Active Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-[11px] text-[#00f090] font-semibold shadow-sm">
          <span className="w-2 h-2 rounded-full bg-[#00f090] animate-ping"></span>
          <span>LIVE API RADAR ACTIVE</span>
        </div>

        {/* Notifications Dropdown / Alerts Button */}
        <div className="relative">
          <button
            onClick={() => {
              if (onOpenAlerts) onOpenAlerts();
            }}
            className="relative p-2 rounded-xl bg-[#070a12] border border-emerald-900/30 hover:bg-slate-800 text-slate-300 transition-colors"
          >
            <Bell className="w-4 h-4 text-slate-300" />
            {unreadAlertCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {unreadAlertCount > 99 ? '99+' : unreadAlertCount}
              </span>
            )}
          </button>
        </div>

        {/* User Account / Auth Profile Button */}
        {currentUser ? (
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-2 pl-2 pr-3 py-1 bg-slate-900 border border-slate-700 hover:border-emerald-500/40 rounded-xl text-xs transition-all"
            >
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold flex items-center justify-center text-[10px]">
                {currentUser.avatar || 'U'}
              </div>
              <div className="text-left hidden sm:block">
                <div className="font-bold text-slate-100 text-[11px] leading-tight truncate max-w-[100px]">
                  {currentUser.name}
                </div>
                <div className="text-[9px] text-slate-400 leading-tight font-semibold">
                  {currentUser.account_type === 'ENTERPRISE' || ['CISO', 'ENTERPRISE_ADMIN', 'ANALYST', 'SUPER_ADMIN', 'ADMIN', 'enterprise'].includes(currentUser.role)
                    ? 'CISO | Enterprise Portal'
                    : 'Vendor | Vendor Portal'}
                </div>
              </div>
            </button>
            <button
              onClick={onSignOut}
              title="Sign Out"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 hover:border-rose-500/50 rounded-xl text-xs text-rose-400 font-semibold transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950/30 transition-all"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
}


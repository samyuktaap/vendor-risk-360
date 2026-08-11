import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  Building, 
  User, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight,
  Shield,
  KeyRound,
  Globe,
  Briefcase
} from 'lucide-react';

export default function AuthModal({ isOpen, onClose, onLogin, vendors = [] }) {
  const [role, setRole] = useState('enterprise'); // 'enterprise' | 'vendor'
  const [selectedVendorId, setSelectedVendorId] = useState(vendors[0]?.id || '');
  const [email, setEmail] = useState('ciso@acme-corp.com');
  const [password, setPassword] = useState('••••••••••••');
  const [vendorDomain, setVendorDomain] = useState('datavault.io');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleQuickDemoCiso = () => {
    onLogin({
      role: 'enterprise',
      name: 'Sarah Jenkins',
      title: 'Chief Information Security Officer (CISO)',
      organization: 'Acme Enterprise',
      email: 'ciso@acme-corp.com',
      avatar: 'SJ'
    });
    if (onClose) onClose();
  };

  const handleQuickDemoVendor = (vendor) => {
    onLogin({
      role: 'vendor',
      vendorId: vendor.id,
      name: vendor.name,
      domain: vendor.domain,
      sector: vendor.sector,
      email: `security@${vendor.domain}`,
      avatar: vendor.name.substring(0, 2).toUpperCase()
    });
    if (onClose) onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      if (role === 'enterprise') {
        onLogin({
          role: 'enterprise',
          name: email.split('@')[0].toUpperCase(),
          title: 'Security Administrator',
          organization: 'Acme Enterprise',
          email: email,
          avatar: email.substring(0, 2).toUpperCase()
        });
      } else {
        const found = vendors.find(v => v.id === Number(selectedVendorId)) || {
          id: selectedVendorId || 1,
          name: vendorDomain.split('.')[0].toUpperCase(),
          domain: vendorDomain,
          sector: 'Third-Party Vendor'
        };
        onLogin({
          role: 'vendor',
          vendorId: found.id,
          name: found.name,
          domain: found.domain,
          sector: found.sector,
          email: email || `security@${found.domain}`,
          avatar: found.name.substring(0, 2).toUpperCase()
        });
      }
      if (onClose) onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-gradient-to-b from-[#0e1626] via-[#0a0f1d] to-[#070a14] border border-emerald-500/30 rounded-3xl shadow-2xl overflow-hidden">
        {/* Glow accent header */}
        <div className="h-2 bg-gradient-to-r from-cyan-500 via-emerald-400 to-violet-500" />

        <div className="p-6 space-y-6">
          {/* Brand & Title */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-[#00f090] shadow-lg shadow-emerald-950/40 mb-1">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
              <span>VendorRisk 360</span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-[#00f090] border border-emerald-500/30">
                AUTH PORTAL
              </span>
            </h2>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Secure Unified Login for Enterprise CISOs & Third-Party Security Teams
            </p>
          </div>

          {/* Role Switching Selector */}
          <div className="grid grid-cols-2 p-1.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setRole('enterprise');
                setEmail('ciso@acme-corp.com');
              }}
              className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-2 ${
                role === 'enterprise'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 shadow-md font-extrabold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              Enterprise CISO
            </button>

            <button
              type="button"
              onClick={() => {
                setRole('vendor');
                setEmail('security@datavault.io');
              }}
              className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-2 ${
                role === 'vendor'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md font-extrabold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              Vendor Login
            </button>
          </div>

          {/* Quick 1-Click Demo Login Options */}
          <div className="space-y-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>⚡ Quick Demo Instant Sign-In</span>
              <Sparkles className="w-3 h-3 text-amber-400" />
            </div>

            {role === 'enterprise' ? (
              <button
                type="button"
                onClick={handleQuickDemoCiso}
                className="w-full p-3 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-between transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 font-bold flex items-center justify-center">
                    SJ
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-white group-hover:text-emerald-200">Sarah Jenkins (CISO)</div>
                    <div className="text-[10px] text-slate-400">Acme Enterprise Admin</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-1 transition-transform" />
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {vendors.slice(0, 4).map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleQuickDemoVendor(v)}
                    className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 text-slate-200 text-xs text-left transition-all group"
                  >
                    <div className="font-bold text-slate-100 truncate group-hover:text-cyan-300">{v.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">{v.domain}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800" /></div>
            <span className="relative px-3 bg-[#0a0f1d] text-[10px] text-slate-500 font-mono uppercase">or sign in manually</span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {role === 'vendor' && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-cyan-400" /> Select Monitored Vendor Organization
                </label>
                <select
                  value={selectedVendorId}
                  onChange={(e) => {
                    setSelectedVendorId(e.target.value);
                    const v = vendors.find(item => item.id === Number(e.target.value));
                    if (v) setVendorDomain(v.domain);
                  }}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none"
                >
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.domain})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" /> Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-400 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                placeholder={role === 'enterprise' ? "ciso@acme-corp.com" : "security@vendor.com"}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" /> Security Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-400 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                placeholder="••••••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-2xl font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 ${
                role === 'enterprise'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950'
              }`}
            >
              {loading ? (
                <span>Verifying Credentials...</span>
              ) : (
                <>
                  <span>Sign In as {role === 'enterprise' ? 'Enterprise CISO' : 'Vendor Portal'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {onClose && (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                Continue as Guest Explorer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

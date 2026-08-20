import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (isOpen && window.google) {
      try {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || "your-client-id.apps.googleusercontent.com",
          callback: (response) => {
            if (response.credential) {
              handleLoginWithToken(response.credential);
            }
          }
        });
        window.google.accounts.id.renderButton(
          document.getElementById("google-signin-button"),
          { theme: "filled_blue", size: "large", width: "100%" }
        );
      } catch (err) {
        console.error("Failed to initialize Google Sign-in:", err);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLoginWithToken = async (idToken) => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/auth/google-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken })
      });
      if (res.ok) {
        const data = await res.json();
        onLogin(data.user);
        if (onClose) onClose();
      } else {
        const errData = await res.json();
        alert(`Login failed: ${errData.detail || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Login failed: Connection error');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoCiso = () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const mockToken = `mock_oidc|subciso|ciso@acme-corp.com|Sarah Jenkins|accounts.google.com|test-client-id|${exp}`;
    handleLoginWithToken(mockToken);
  };

  const handleQuickDemoVendor = (vendor) => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const mockToken = `mock_oidc|subvendor-${vendor.domain}|vendor@${vendor.domain}|${vendor.name}|accounts.google.com|test-client-id|${exp}`;
    handleLoginWithToken(mockToken);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const finalEmail = role === 'vendor' && !email.toLowerCase().includes('vendor') ? `vendor_${email}` : email;
    const mockToken = `mock_oidc|submanual|${finalEmail}|${email.split('@')[0]}|accounts.google.com|test-client-id|${exp}`;
    handleLoginWithToken(mockToken);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn overflow-y-auto min-h-[100dvh] box-border">
      <div 
        className="relative w-full bg-gradient-to-b from-[#0e1626] via-[#0a0f1d] to-[#070a14] border border-emerald-500/30 rounded-3xl shadow-2xl overflow-hidden my-auto"
        style={{
          width: 'min(100% - 32px, 680px)',
          maxWidth: '680px',
          boxSizing: 'border-box',
          marginInline: 'auto'
        }}
      >
        {/* Glow accent header */}
        <div className="h-2 bg-gradient-to-r from-cyan-500 via-emerald-400 to-violet-500" />

        <div className="p-4 md:p-8 space-y-4 md:space-y-6">
          {/* Brand & Title */}
          <div className="text-center space-y-1.5 md:space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-[#00f090] shadow-lg shadow-emerald-950/40 mb-1">
              <ShieldCheck className="w-6 h-6 md:w-8 md:h-8" />
            </div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
              <span>VendorRisk 360</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-[#00f090] border border-emerald-500/30">
                AUTH PORTAL
              </span>
            </h2>
            <p className="text-[11px] md:text-xs text-slate-400 max-w-xs mx-auto">
              Secure Unified Login for Enterprise CISOs & Third-Party Security Teams
            </p>
          </div>

          {/* Role Switching Selector */}
          <div className="flex p-1.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs font-bold w-full box-border gap-1">
            <button
              type="button"
              onClick={() => {
                setRole('enterprise');
                setEmail('ciso@acme-corp.com');
              }}
              className={`flex-1 min-w-0 py-2.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 min-h-[44px] ${
                role === 'enterprise'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 shadow-md font-extrabold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">Enterprise CISO</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setRole('vendor');
                setEmail('security@datavault.io');
              }}
              className={`flex-1 min-w-0 py-2.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 min-h-[44px] ${
                role === 'vendor'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md font-extrabold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">Vendor Login</span>
            </button>
          </div>

          {/* Google Identity Secure Login */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              🛡️ Google Identity Secure Login
            </div>
            <div id="google-signin-button" className="w-full flex justify-center py-1 box-border"></div>
          </div>

          {/* Quick 1-Click Demo Login Options */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span>⚡ Quick Demo Instant Sign-In</span>
                <span className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold uppercase">
                  Demo Mode (Dev Only)
                </span>
              </div>
              <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
            </div>

            {role === 'enterprise' ? (
              <button
                type="button"
                onClick={handleQuickDemoCiso}
                className="w-full p-2.5 md:p-3 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-between transition-all group min-h-[44px] box-border"
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
                    className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 text-slate-200 text-xs text-left transition-all group min-h-[44px] box-border"
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
          <form onSubmit={handleSubmit} className="space-y-3.5 md:space-y-4">
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
                  className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-xl px-3 py-2 md:py-2.5 text-xs text-slate-100 focus:outline-none min-h-[44px] box-border"
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
                className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-400 rounded-xl px-3.5 py-2 md:py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none min-h-[44px] box-border"
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
                className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-400 rounded-xl px-3.5 py-2 md:py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none min-h-[44px] box-border"
                placeholder="••••••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2.5 md:py-3.5 rounded-2xl font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 min-h-[44px] box-border ${
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
            <div className="text-center pt-1 md:pt-2">
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors min-h-[44px] px-4 py-2"
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

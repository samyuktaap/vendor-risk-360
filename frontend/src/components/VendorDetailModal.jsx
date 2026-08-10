import React, { useState, useEffect } from 'react';
import { 
  X, 
  RefreshCw, 
  ShieldAlert, 
  ShieldCheck, 
  Globe, 
  Building, 
  Calendar, 
  ExternalLink, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  Newspaper, 
  CheckSquare,
  Lock,
  TrendingDown,
  TrendingUp,
  Shield,
  DollarSign,
  Download,
  Mail,
  Activity,
  Flame
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import RiskScoreRing from './RiskScoreRing';

export default function VendorDetailModal({ vendorId, onClose, onRefreshVendor }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('actions');

  useEffect(() => {
    if (vendorId) {
      fetchVendorDetail();
    }
  }, [vendorId]);

  const fetchVendorDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/api/vendors/${vendorId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to fetch vendor detail:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`http://localhost:8000/api/vendors/${vendorId}/refresh`, {
        method: 'POST'
      });
      if (res.ok) {
        await fetchVendorDetail();
        if (onRefreshVendor) onRefreshVendor();
      }
    } catch (err) {
      console.error("Manual refresh failed:", err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleExportAuditReport = () => {
    if (!data) return;
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VendorRisk360_${data.vendor.name.replace(/[^a-zA-Z0-9]/g, '_')}_Audit.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!vendorId) return null;

  const vendor = data?.vendor;
  const assessment = data?.risk_assessment;
  const breakdown = assessment?.breakdown;
  const score = assessment?.overall_score ?? vendor?.risk_score ?? 0;
  const history30d = assessment?.history_30d || [];

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex justify-end transition-opacity duration-300">
      <div className="w-full max-w-2xl bg-[#0e1626] border-l border-slate-800 h-full flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-right">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-[#0a0f1b] flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center font-bold text-xl text-cyan-400 shadow-md">
              {vendor?.name ? vendor.name.charAt(0) : 'V'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-100">{vendor?.name || 'Vendor Profile'}</h2>
                <a
                  href={`https://${vendor?.domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-400 hover:text-cyan-400 flex items-center gap-1 text-xs"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>{vendor?.domain}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                <span className="px-2.5 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-medium">
                  {vendor?.sector}
                </span>

                {breakdown?.stock?.ticker && (
                  <span className={`px-2.5 py-0.5 rounded-md border font-mono font-bold flex items-center gap-1 ${
                    breakdown?.stock?.change_pct < 0
                      ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                      : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  }`}>
                    {breakdown?.stock?.change_pct < 0 ? <TrendingDown className="w-3 h-3 text-rose-400" /> : <TrendingUp className="w-3 h-3 text-emerald-400" />}
                    ${breakdown?.stock?.ticker}: ${breakdown?.stock?.current_price} ({breakdown?.stock?.change_pct}%)
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportAuditReport}
              title="Export Executive Security Audit JSON Report"
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export Audit</span>
            </button>

            <button
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Scanning...' : 'Refresh Risk'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Container */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
            <RefreshCw className="w-6 h-6 animate-spin text-cyan-400 mr-2" />
            Evaluating Live No-Key API Radar Feeds...
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Top Risk Score Summary Banner */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex items-center justify-between shadow-lg">
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Security Risk Classification
                </div>
                <div className="text-2xl font-black text-slate-100 flex items-center gap-2">
                  <span>{assessment?.risk_tier || vendor?.risk_tier} RISK</span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full border ${
                    score >= 70
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : score >= 40
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}>
                    {score >= 70 ? 'High Contagion Hazard' : score >= 40 ? 'Moderate Concern' : 'Clean Record'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono">
                  {assessment?.formula_description}
                </p>
              </div>

              <RiskScoreRing
                score={score}
                size={110}
                strokeWidth={10}
                showFormulaTooltip={true}
                breakdown={breakdown}
              />
            </div>

            {/* 30-Day Risk Score Trend Chart */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                <span className="flex items-center gap-1.5 text-cyan-400">
                  <Activity className="w-4 h-4" />
                  30-Day Historical Security Risk Trend
                </span>
                <span className="text-[10px] font-mono text-slate-400">Score Range: 0 (Safe) to 100 (Critical)</span>
              </div>

              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history30d} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={9} />
                    <YAxis domain={[0, 100]} stroke="#64748b" fontSize={9} />
                    <Tooltip
                      contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', fontSize: '11px' }}
                      labelStyle={{ color: '#94a3b8' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke={score >= 70 ? "#f43f5e" : score >= 40 ? "#f59e0b" : "#10b981"}
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Component Sub-score Cards (5 Live Vectors) */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Google News</span>
                  <span className="font-semibold text-cyan-400">30%</span>
                </div>
                <div className="text-base font-bold text-slate-100">{breakdown?.news?.score ?? 0}</div>
                <div className="text-[9px] text-slate-400 truncate">{breakdown?.news?.articles?.length ?? 0} articles</div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>US CISA KEV</span>
                  <span className="font-semibold text-cyan-400">25%</span>
                </div>
                <div className="text-base font-bold text-slate-100">{breakdown?.cisa?.score ?? 0}</div>
                <div className="text-[9px] text-slate-400 truncate">{breakdown?.cisa?.vulnerabilities_count ?? 0} exploits</div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Yahoo Market</span>
                  <span className="font-semibold text-cyan-400">20%</span>
                </div>
                <div className="text-base font-bold text-slate-100">{breakdown?.stock?.score ?? 0}</div>
                <div className="text-[9px] text-slate-400 truncate">{breakdown?.stock?.change_pct ?? 0}% drop</div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>HTTPS Probe</span>
                  <span className="font-semibold text-cyan-400">15%</span>
                </div>
                <div className="text-base font-bold text-slate-100">{breakdown?.ssl?.score ?? 0}</div>
                <div className="text-[9px] text-slate-400 truncate">{breakdown?.ssl?.missing_headers?.length ?? 0} missing</div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Google DNS</span>
                  <span className="font-semibold text-cyan-400">10%</span>
                </div>
                <div className="text-base font-bold text-slate-100">{breakdown?.dns?.dmarc_present ? 0 : 40}</div>
                <div className="text-[9px] text-slate-400 truncate">{breakdown?.dns?.dmarc_present ? 'DMARC Active' : 'No DMARC'}</div>
              </div>
            </div>

            {/* Detail Tabs */}
            <div className="border-b border-slate-800 flex flex-wrap gap-4 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('actions')}
                className={`pb-2 transition-colors border-b-2 ${
                  activeTab === 'actions'
                    ? 'border-cyan-400 text-cyan-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Recommended Actions ({assessment?.recommended_actions?.length ?? 0})
              </button>
              <button
                onClick={() => setActiveTab('cisa')}
                className={`pb-2 transition-colors border-b-2 ${
                  activeTab === 'cisa'
                    ? 'border-cyan-400 text-cyan-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                US CISA Exploits ({breakdown?.cisa?.vulnerabilities_count ?? 0})
              </button>
              <button
                onClick={() => setActiveTab('dns')}
                className={`pb-2 transition-colors border-b-2 ${
                  activeTab === 'dns'
                    ? 'border-cyan-400 text-cyan-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Email Security (DMARC / SPF)
              </button>
              <button
                onClick={() => setActiveTab('stock')}
                className={`pb-2 transition-colors border-b-2 ${
                  activeTab === 'stock'
                    ? 'border-cyan-400 text-cyan-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Stock Signal ({breakdown?.stock?.ticker || 'Private'})
              </button>
              <button
                onClick={() => setActiveTab('ssl')}
                className={`pb-2 transition-colors border-b-2 ${
                  activeTab === 'ssl'
                    ? 'border-cyan-400 text-cyan-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                SSL & Headers
              </button>
              <button
                onClick={() => setActiveTab('news')}
                className={`pb-2 transition-colors border-b-2 ${
                  activeTab === 'news'
                    ? 'border-cyan-400 text-cyan-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Live Google News ({breakdown?.news?.articles?.length ?? 0})
              </button>
            </div>

            {/* TAB CONTENT: RECOMMENDED ACTIONS */}
            {activeTab === 'actions' && (
              <div className="space-y-3">
                {assessment?.recommended_actions?.map((act, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors flex items-start gap-3 shadow-md"
                  >
                    <ShieldAlert className={`w-5 h-5 mt-0.5 ${
                      act.priority === 'CRITICAL' || act.priority === 'URGENT' ? 'text-rose-400' :
                      act.priority === 'HIGH' ? 'text-amber-400' : 'text-cyan-400'
                    }`} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-100">{act.title}</h4>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${
                          act.priority === 'CRITICAL' || act.priority === 'URGENT'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}>
                          {act.priority}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">{act.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB CONTENT: US CISA EXPLOITED VULNERABILITIES */}
            {activeTab === 'cisa' && (
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-rose-400" />
                    US CISA Known Exploited Vulnerabilities Catalog (US Govt Live Feed)
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    breakdown?.cisa?.vulnerabilities_count > 0
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    {breakdown?.cisa?.status}
                  </span>
                </div>

                {breakdown?.cisa?.vulnerabilities_count === 0 ? (
                  <div className="text-emerald-400 text-xs font-medium flex items-center gap-1.5 pt-2">
                    <CheckCircle2 className="w-4 h-4" /> Zero active zero-day vulnerabilities listed on the CISA KEV catalog for {vendor?.name}.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {breakdown?.cisa?.vulnerabilities?.map((v, i) => (
                      <div key={i} className="p-3 rounded-lg bg-rose-950/30 border border-rose-500/30 text-xs space-y-1">
                        <div className="flex justify-between font-bold text-rose-200">
                          <span>{v.cve_id}: {v.vulnerability_name}</span>
                          <span className="text-[10px] text-slate-400">Added: {v.date_added}</span>
                        </div>
                        <p className="text-[11px] text-slate-300">{v.short_description}</p>
                        <div className="text-[10px] text-cyan-300 font-mono">Action: {v.required_action}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: EMAIL SECURITY (DMARC/SPF) */}
            {activeTab === 'dns' && (
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-cyan-400" />
                    Domain DNS Email Authentication & Phishing Protection
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    breakdown?.dns?.dmarc_present
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}>
                    {breakdown?.dns?.email_security_status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-800">
                  <div>
                    <span className="text-slate-400 block">DMARC Record Status</span>
                    <span className="font-bold text-slate-100 font-mono">
                      {breakdown?.dns?.dmarc_present ? '✓ DMARC1 Record Active' : '✗ Missing DMARC Record'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Enforcement Policy</span>
                    <span className="font-bold text-cyan-300 font-mono">
                      {breakdown?.dns?.dmarc_policy}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">SPF Sender Authorization</span>
                    <span className="font-bold text-slate-100 font-mono">
                      {breakdown?.dns?.spf_present ? '✓ SPF Record Configured' : '✗ Missing SPF'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Data Source</span>
                    <span className="text-[10px] text-slate-400 font-mono">Google Public DNS API</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: STOCK MARKET SIGNAL */}
            {activeTab === 'stock' && (
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    Market Ticker & Volatility Scan ({breakdown?.stock?.ticker || 'Private Entity'})
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    breakdown?.stock?.change_pct < -5.0
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    {breakdown?.stock?.status}
                  </span>
                </div>

                {breakdown?.stock?.is_public_company ? (
                  <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-800">
                    <div>
                      <span className="text-slate-400 block">Stock Ticker Symbol</span>
                      <span className="font-bold text-slate-100 font-mono">${breakdown?.stock?.ticker}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Current Price & 1-Day Volatility</span>
                      <span className={`font-bold font-mono ${breakdown?.stock?.change_pct < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        ${breakdown?.stock?.current_price} ({breakdown?.stock?.change_pct}%)
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Vendor is a private entity or unlisted supplier.</p>
                )}
              </div>
            )}

            {/* TAB CONTENT: SSL & HEADERS */}
            {activeTab === 'ssl' && (
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-cyan-400" />
                    HTTPS Domain Security Header Audit
                  </span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-cyan-300">
                    Score {breakdown?.ssl?.score} / 100
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {breakdown?.ssl?.missing_headers?.length === 0 ? (
                    <div className="text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> All essential web security headers present (HSTS, CSP, X-Frame-Options).
                    </div>
                  ) : (
                    <div>
                      <span className="text-rose-400 font-semibold block mb-1">Missing Security Headers:</span>
                      <ul className="list-disc list-inside space-y-1 text-slate-300 font-mono text-[11px]">
                        {breakdown?.ssl?.missing_headers?.map((mh, idx) => (
                          <li key={idx}>{mh}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: NEWS */}
            {activeTab === 'news' && (
              <div className="space-y-3">
                {breakdown?.news?.articles?.map((art, idx) => (
                  <a key={idx} href={art.url} target="_blank" rel="noreferrer" className="block p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1">
                    <div className="font-bold text-slate-200">{art.title}</div>
                    <p className="text-slate-400">{art.snippet}</p>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

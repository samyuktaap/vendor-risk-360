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
  Flame,
  ClipboardList,
  Plus,
  CheckCheck,
  Sparkles,
  Brain,
  ArrowUpRight,
  Target
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import RiskScoreRing from './RiskScoreRing';
import RiskQuestionnaire from './RiskQuestionnaire';

export default function VendorDetailModal({ vendorId, onClose, onRefreshVendor, currentUser }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('actions');
  const [incidents, setIncidents] = useState([]);
  const [showIncidentForm, setShowIncidentForm] = useState(false);
  const [incidentForm, setIncidentForm] = useState({ title: '', description: '', category: 'Security Breach', severity: 'MEDIUM' });
  const [incidentStats, setIncidentStats] = useState(null);
  const [loggingIncident, setLoggingIncident] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);
  const [shapData, setShapData] = useState(null);
  const [deterministicScore, setDeterministicScore] = useState(null);
  const [riskHistory, setRiskHistory] = useState([]);

  useEffect(() => {
    if (vendorId) {
      fetchVendorDetail();
      fetchIncidents();
      fetchShapData();
      fetchDeterministicScore();
      fetchRiskHistory();
    }
  }, [vendorId]);

  const fetchDeterministicScore = async () => {
    try {
      const res = await fetch(`http://localhost:8000/api/vendors/${vendorId}/risk-score`);
      if (res.ok) {
        setDeterministicScore(await res.json());
      }
    } catch (err) { console.error("Failed to fetch deterministic risk score", err); }
  };

  const fetchRiskHistory = async () => {
    try {
      const res = await fetch(`http://localhost:8000/api/vendors/${vendorId}/risk-history`);
      if (res.ok) {
        const json = await res.json();
        setRiskHistory(json.history || []);
      }
    } catch (err) { console.error("Failed to fetch risk history", err); }
  };


  const fetchShapData = async () => {
    try {
      const res = await fetch(`http://localhost:8000/api/vendors/${vendorId}/shap-risk`);
      if (res.ok) {
        const json = await res.json();
        setShapData(json);
      }
    } catch (err) {
      console.error("Failed to fetch SHAP risk data:", err);
    }
  };



  const [error, setError] = useState(null);

  const fetchVendorDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`http://localhost:8000/api/vendors/${vendorId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        setError(`Failed to load vendor risk assessment (HTTP ${res.status}).`);
      }
    } catch (err) {
      console.error("Failed to fetch vendor detail:", err);
      setError("Unable to connect to Security Risk Engine server.");
    } finally {
      setLoading(false);
    }
  };

  const fetchIncidents = async () => {
    try {
      const res = await fetch(`http://localhost:8000/api/vendors/${vendorId}/incidents`);
      if (res.ok) {
        const data = await res.json();
        setIncidents(data.incidents || []);
        setIncidentStats(data.impact_stats || null);
      }
    } catch (err) { console.error("Failed to fetch incidents:", err); }
  };

  const handleLogIncident = async () => {
    if (!incidentForm.title.trim()) return;
    setLoggingIncident(true);
    try {
      const res = await fetch(`http://localhost:8000/api/incidents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor_id: vendorId, ...incidentForm, status: 'OPEN' })
      });
      if (res.ok) {
        setShowIncidentForm(false);
        setIncidentForm({ title: '', description: '', category: 'Security Breach', severity: 'MEDIUM' });
        await fetchIncidents();
        await fetchVendorDetail();
        if (onRefreshVendor) onRefreshVendor();
      }
    } catch (err) { console.error("Incident log failed:", err); }
    finally { setLoggingIncident(false); }
  };

  const handleResolveIncident = async (incidentId) => {
    setResolvingId(incidentId);
    try {
      const res = await fetch(`http://localhost:8000/api/incidents/${incidentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'RESOLVED' })
      });
      if (res.ok) {
        await fetchIncidents();
        await fetchVendorDetail();
        if (onRefreshVendor) onRefreshVendor();
      }
    } catch (err) { console.error("Resolve failed:", err); }
    finally { setResolvingId(null); }
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
  const aiSummary = assessment?.ai_summary;
  const predictions = aiSummary?.predictions_90d;
  
  // Deterministic risk score takes precedence if it exists
  const score = deterministicScore?.total_score ?? assessment?.overall_score ?? vendor?.risk_score ?? 0;
  const riskTier = deterministicScore?.risk_level ?? assessment?.risk_tier ?? vendor?.risk_tier;
  
  // Format risk history for the chart
  let historyData = assessment?.history_30d || [];
  if (riskHistory && riskHistory.length > 0) {
    historyData = riskHistory.map(h => ({
      date: new Date(h.calculated_at).toLocaleDateString(),
      score: h.total_score,
      tier: h.risk_level
    }));
  }

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
            Evaluating Live API Radar Feeds...
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
            <AlertTriangle className="w-10 h-10 text-rose-400" />
            <div className="text-sm font-bold text-slate-200">{error}</div>
            <button
              onClick={fetchVendorDetail}
              className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-xs text-cyan-300 font-semibold flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry Evaluation
            </button>
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
                  <span>{riskTier} RISK</span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full border ${
                    score >= 60
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : score >= 30
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}>
                    {score >= 60 ? 'High Risk' : score >= 30 ? 'Medium Risk' : 'Low Risk'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono">
                  {deterministicScore ? `Deterministic Assessment Score (${deterministicScore.scoring_version})` : assessment?.formula_description}
                </p>
              </div>

              {deterministicScore ? (
                <div className="flex flex-col gap-1 text-xs">
                    <div className="flex justify-between w-48"><span className="text-slate-400">Cybersecurity:</span> <span className="font-bold">{deterministicScore.categories.cybersecurity}</span></div>
                    <div className="flex justify-between w-48"><span className="text-slate-400">Compliance:</span> <span className="font-bold">{deterministicScore.categories.compliance}</span></div>
                    <div className="flex justify-between w-48"><span className="text-slate-400">Financial Stability:</span> <span className="font-bold">{deterministicScore.categories.financial_stability}</span></div>
                    <div className="flex justify-between w-48"><span className="text-slate-400">Operational Risk:</span> <span className="font-bold">{deterministicScore.categories.operational_risk}</span></div>
                    <div className="flex justify-between w-48"><span className="text-slate-400">Data Privacy:</span> <span className="font-bold">{deterministicScore.categories.data_privacy}</span></div>
                    <div className="flex justify-between w-48 mt-1 pt-1 border-t border-slate-700 text-cyan-400"><span className="font-bold">Total Score:</span> <span className="font-bold">{score.toFixed(1)} / 100</span></div>
                </div>
              ) : (
                <RiskScoreRing
                  score={score}
                  size={110}
                  strokeWidth={10}
                  showFormulaTooltip={true}
                  breakdown={breakdown}
                />
              )}
            </div>

            {/* Risk Score Trend Chart */}
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
                  <LineChart data={historyData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
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
                      stroke={score >= 60 ? "#f43f5e" : score >= 30 ? "#f59e0b" : "#10b981"}
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 🤖 AI Executive Risk Briefing Card */}
            {aiSummary && (
              <div className="rounded-2xl overflow-hidden border border-violet-500/20 bg-gradient-to-br from-violet-950/40 via-slate-900/80 to-slate-900/80 shadow-lg shadow-violet-950/20">
                <div className="px-4 pt-4 pb-3 flex items-center gap-2.5 border-b border-violet-500/20">
                  <div className="w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-violet-200">AI Executive Risk Briefing</div>
                    <div className="text-[10px] text-violet-400/70">7-Vector Threat Synthesis · Generated {new Date(aiSummary.generated_at).toLocaleTimeString()}</div>
                  </div>
                  <span className={`ml-auto px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                    aiSummary.exposure_level === 'CRITICAL EXPOSURE'
                      ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                      : aiSummary.exposure_level === 'MODERATE EXPOSURE'
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  }`}>
                    {aiSummary.exposure_level}
                  </span>
                </div>
                <div className="p-4">
                  {aiSummary.executive_summary.split('\n\n').map((para, i) => (
                    <p key={i} className={`text-xs leading-relaxed mb-2 last:mb-0 ${
                      i === 0 ? 'text-slate-100 font-medium' : 'text-slate-400'
                    }`}>
                      {para}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* 🔮 90-Day Predictive Analytics Card */}
            {predictions && (
              <div className="rounded-2xl overflow-hidden border border-cyan-500/15 bg-gradient-to-br from-slate-900/80 to-slate-900/60 shadow-lg">
                <div className="px-4 pt-4 pb-3 flex items-center gap-2.5 border-b border-slate-700/50">
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                    <Brain className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-200">90-Day Predictive Risk Forecast</div>
                    <div className="text-[10px] text-slate-500">{predictions.confidence_level}</div>
                  </div>
                  <span className="ml-auto text-[10px] font-bold px-2.5 py-1 rounded-full border"
                    style={{ color: predictions.trend_color, borderColor: `${predictions.trend_color}40`, background: `${predictions.trend_color}15` }}>
                    {predictions.trend_badge}
                  </span>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="text-center">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">Current</div>
                      <div className="text-2xl font-black text-slate-100">{predictions.current_score}</div>
                      <div className="text-[9px] text-slate-500">risk score</div>
                    </div>
                    <div className="flex-1 flex items-center">
                      <div className="h-0.5 flex-1 bg-gradient-to-r from-slate-700 to-slate-600 rounded-full relative">
                        <ArrowUpRight className="w-3.5 h-3.5 absolute right-0 -top-1.5" style={{ color: predictions.trend_color }} />
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">90 Days</div>
                      <div className="text-2xl font-black" style={{ color: predictions.trend_color }}>{predictions.predicted_score_90d}</div>
                      <div className="text-[9px] font-semibold" style={{ color: predictions.trend_color }}>{predictions.score_delta}</div>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50">
                    <div className="text-[10px] text-slate-500 mb-0.5 flex items-center gap-1"><Target className="w-3 h-3" /> Key Prediction Factor</div>
                    <div className="text-xs text-slate-300">{predictions.key_prediction_factor}</div>
                  </div>
                </div>
              </div>
            )}

            {/* 🌲 Scikit-Learn RandomForest + SHAP Explainability Card */}
            {shapData && shapData.status === 'success' && (
              <div className="rounded-2xl overflow-hidden border border-emerald-500/20 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-emerald-950/20 shadow-lg">
                <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                      <Brain className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-100 flex items-center gap-2">
                        <span>Scikit-Learn & SHAP Feature Attribution</span>
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          RandomForest Model
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Explainable AI (XAI) breakdown of risk score drivers & protective factors
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">ML Predicted Score</div>
                    <div className="text-lg font-black text-emerald-400">{shapData.ml_predicted_score} <span className="text-xs text-slate-500">/ 100</span></div>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Top Risk Drivers */}
                    <div className="bg-slate-900/70 border border-rose-500/20 rounded-xl p-3 space-y-2">
                      <div className="text-[11px] font-bold text-rose-300 flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-rose-400" />
                        Top Risk Drivers (+ Risk Points)
                      </div>
                      <div className="space-y-1.5">
                        {shapData.top_risk_drivers && shapData.top_risk_drivers.length > 0 ? (
                          shapData.top_risk_drivers.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-lg bg-rose-500/5 border border-rose-500/10">
                              <span className="text-slate-300 font-medium">{item.label}</span>
                              <span className="font-mono font-bold text-rose-400">+{item.shap_value}</span>
                            </div>
                          ))
                        ) : (
                          <div className="text-[11px] text-slate-500 italic">No significant risk escalations detected.</div>
                        )}
                      </div>
                    </div>

                    {/* Protective Factors */}
                    <div className="bg-slate-900/70 border border-emerald-500/20 rounded-xl p-3 space-y-2">
                      <div className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                        <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
                        Protective Factors (- Risk Points)
                      </div>
                      <div className="space-y-1.5">
                        {shapData.protective_factors && shapData.protective_factors.length > 0 ? (
                          shapData.protective_factors.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                              <span className="text-slate-300 font-medium">{item.label}</span>
                              <span className="font-mono font-bold text-emerald-400">{item.shap_value}</span>
                            </div>
                          ))
                        ) : (
                          <div className="text-[11px] text-slate-500 italic">Baseline score operating at standard levels.</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

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
                onClick={() => setActiveTab('assessment')}
                className={`pb-2 transition-colors border-b-2 flex items-center gap-1.5 ${
                  activeTab === 'assessment'
                    ? 'border-cyan-400 text-cyan-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                Risk Assessment
              </button>
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

              {breakdown?.virustotal && (
                <button
                  onClick={() => setActiveTab('vt')}
                  className={`pb-2 transition-colors border-b-2 ${
                    activeTab === 'vt'
                      ? 'border-cyan-400 text-cyan-300'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  VirusTotal ({breakdown.virustotal.malicious_detections || 0})
                </button>
              )}
              {breakdown?.nvd && (
                <button
                  onClick={() => setActiveTab('nvd')}
                  className={`pb-2 transition-colors border-b-2 ${
                    activeTab === 'nvd'
                      ? 'border-cyan-400 text-cyan-300'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  NVD CVEs ({breakdown.nvd.cve_count || 0})
                </button>
              )}
              {breakdown?.xposedornot && (
                <button
                  onClick={() => setActiveTab('xposed')}
                  className={`pb-2 transition-colors border-b-2 ${
                    activeTab === 'xposed'
                      ? 'border-cyan-400 text-cyan-300'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  XposedOrNot ({breakdown.xposedornot.number_of_breaches || 0})
                </button>
              )}
              <button
                onClick={() => setActiveTab('ai')}
                className={`pb-2 transition-colors border-b-2 flex items-center gap-1.5 ${
                  activeTab === 'ai'
                    ? 'border-violet-400 text-violet-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                AI Briefing
              </button>
              <button
                onClick={() => { setActiveTab('incidents'); fetchIncidents(); }}
                className={`pb-2 transition-colors border-b-2 flex items-center gap-1.5 ${
                  activeTab === 'incidents'
                    ? 'border-amber-400 text-amber-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                Incident Log ({incidents.length})
                {incidentStats?.critical_active > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[9px] animate-pulse">
                    {incidentStats.critical_active} CRIT
                  </span>
                )}
              </button>
            </div>

            {/* TAB CONTENT: QUESTIONNAIRE */}
            {activeTab === 'assessment' && (
              <RiskQuestionnaire 
                vendorId={vendorId} 
                userRole={currentUser?.role} 
                onScoreUpdated={fetchDeterministicScore} 
              />
            )}

            {/* TAB CONTENT: AI BRIEFING */}
            {activeTab === 'ai' && (
              <div className="space-y-4">
                {aiSummary ? (
                  <>
                    {/* Exposure Badge */}
                    <div className={`p-4 rounded-2xl border ${
                      aiSummary.exposure_level === 'CRITICAL EXPOSURE'
                        ? 'bg-rose-950/30 border-rose-500/30'
                        : aiSummary.exposure_level === 'MODERATE EXPOSURE'
                        ? 'bg-amber-950/30 border-amber-500/30'
                        : 'bg-emerald-950/30 border-emerald-500/30'
                    }`}>
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-violet-400" />
                        <span className="text-xs font-bold text-slate-200">AI Executive Risk Briefing</span>
                        <span className="ml-auto text-[10px] font-mono text-slate-500">Generated {new Date(aiSummary.generated_at).toLocaleString()}</span>
                      </div>
                      {aiSummary.executive_summary.split('\n\n').map((para, i) => (
                        <p key={i} className={`text-xs leading-relaxed mb-2 last:mb-0 ${i === 0 ? 'text-slate-100 font-medium' : 'text-slate-400'}`}>
                          {para}
                        </p>
                      ))}
                    </div>

                    {/* 90-Day Predictions Detail */}
                    {predictions && (
                      <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Brain className="w-4 h-4 text-cyan-400" />
                          <span className="text-xs font-bold text-slate-200">90-Day Risk Trajectory</span>
                          <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ color: predictions.trend_color, background: `${predictions.trend_color}15` }}>
                            {predictions.trend_direction}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div className="bg-slate-800/60 rounded-xl p-3">
                            <div className="text-[10px] text-slate-500 mb-1">Current Score</div>
                            <div className="text-xl font-black text-slate-100">{predictions.current_score}</div>
                          </div>
                          <div className="bg-slate-800/60 rounded-xl p-3">
                            <div className="text-[10px] text-slate-500 mb-1">Delta</div>
                            <div className="text-xl font-black" style={{ color: predictions.trend_color }}>{predictions.score_delta}</div>
                          </div>
                          <div className="bg-slate-800/60 rounded-xl p-3">
                            <div className="text-[10px] text-slate-500 mb-1">90-Day Forecast</div>
                            <div className="text-xl font-black" style={{ color: predictions.trend_color }}>{predictions.predicted_score_90d}</div>
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-500">{predictions.confidence_level}</div>
                        <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/40">
                          <div className="text-[10px] text-slate-500 mb-1 font-semibold uppercase tracking-wider">Key Prediction Driver</div>
                          <div className="text-xs text-slate-300">{predictions.key_prediction_factor}</div>
                        </div>
                      </div>
                    )}

                    {/* Vendor Metadata */}
                    <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-4 space-y-2">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Vendor Risk Profile</div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          ['Criticality Tier', vendor?.criticality_tier || '—'],
                          ['Data Sensitivity', vendor?.data_sensitivity || '—'],
                          ['Contract Value', vendor?.contract_value ? `$${Number(vendor.contract_value).toLocaleString()}` : '—'],
                          ['Stock Ticker', vendor?.custom_ticker || breakdown?.stock?.ticker || 'Private'],
                          ['Compliance Certs', vendor?.compliance_certs || '—'],
                          ['Last Assessed', vendor?.last_checked_at ? new Date(vendor.last_checked_at).toLocaleDateString() : '—'],
                        ].map(([label, val]) => (
                          <div key={label} className="bg-slate-800/40 rounded-xl p-2.5">
                            <div className="text-[10px] text-slate-500">{label}</div>
                            <div className="text-xs text-slate-200 font-semibold mt-0.5 truncate">{val}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-10 text-slate-500 text-xs">AI briefing not available. Refresh risk to generate.</div>
                )}
              </div>
            )}

            {/* TAB CONTENT: INCIDENT LOG */}
            {activeTab === 'incidents' && (
              <div className="space-y-3">
                {/* Impact Summary */}
                {incidentStats && incidentStats.active_incidents > 0 && (
                  <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-rose-300">
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                      <span>{incidentStats.active_incidents} active incident(s) applying <strong>+{incidentStats.total_impact} pts</strong> score penalty</span>
                    </div>
                  </div>
                )}

                {/* Log New Incident Button */}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">Manually log security incidents. Score auto-adjusts based on severity.</p>
                  <button
                    onClick={() => setShowIncidentForm(!showIncidentForm)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 text-xs font-semibold transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Log Incident
                  </button>
                </div>

                {/* Incident Form */}
                {showIncidentForm && (
                  <div className="p-4 rounded-xl bg-slate-900/90 border border-amber-500/30 space-y-3">
                    <h4 className="text-xs font-bold text-amber-300">New Security Incident</h4>
                    <input
                      type="text"
                      placeholder="Incident Title (e.g. Ransomware Detected)"
                      value={incidentForm.title}
                      onChange={e => setIncidentForm({...incidentForm, title: e.target.value})}
                      className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
                    />
                    <textarea
                      placeholder="Description (optional)"
                      value={incidentForm.description}
                      onChange={e => setIncidentForm({...incidentForm, description: e.target.value})}
                      className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500 h-16 resize-none"
                    />
                    <div className="flex gap-2 items-center flex-wrap">
                      <select
                        value={incidentForm.category}
                        onChange={e => setIncidentForm({...incidentForm, category: e.target.value})}
                        className="bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
                      >
                        <option value="Data Breach">Data Breach</option>
                        <option value="Ransomware">Ransomware</option>
                        <option value="Outage">Outage</option>
                        <option value="SLA Breach">SLA Breach</option>
                        <option value="Data Leak">Data Leak</option>
                        <option value="Zero-Day">Zero-Day</option>
                      </select>
                      <select
                        value={incidentForm.severity}
                        onChange={e => setIncidentForm({...incidentForm, severity: e.target.value})}
                        className="bg-slate-800 border border-slate-700 text-slate-100 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
                      >
                        <option value="LOW">LOW (+4 pts)</option>
                        <option value="MEDIUM">MEDIUM (+8 pts)</option>
                        <option value="HIGH">HIGH (+15 pts)</option>
                        <option value="CRITICAL">CRITICAL (+25 pts)</option>
                      </select>
                      <button
                        onClick={handleLogIncident}
                        disabled={loggingIncident || !incidentForm.title.trim()}
                        className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-bold transition-all disabled:opacity-50"
                      >
                        {loggingIncident ? 'Logging...' : 'Submit Incident'}
                      </button>
                      <button onClick={() => setShowIncidentForm(false)} className="px-3 py-2 rounded-xl bg-slate-800 text-slate-400 text-xs hover:bg-slate-700">Cancel</button>
                    </div>
                  </div>
                )}

                {/* Incident History */}
                {incidents.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-xs">No incidents logged for this vendor yet.</div>
                ) : incidents.map((inc) => (
                  <div key={inc.id} className={`p-4 rounded-xl border text-xs flex items-start justify-between gap-3 ${inc.status === 'RESOLVED' ? 'bg-slate-900/40 border-slate-800 opacity-60' : 'bg-slate-900/80 border-slate-700'}`}>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                          inc.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300' :
                          inc.severity === 'HIGH' ? 'bg-amber-500/20 text-amber-300' :
                          inc.severity === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-300' :
                          'bg-slate-700 text-slate-300'
                        }`}>{inc.severity}</span>
                        <span className="font-semibold text-slate-100">{inc.title}</span>
                        {inc.category && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{inc.category}</span>
                        )}
                        {inc.status === 'RESOLVED' && <span className="text-[10px] text-emerald-400 font-bold">✓ RESOLVED</span>}
                        {inc.status === 'MITIGATED' && <span className="text-[10px] text-emerald-400 font-bold">✓ MITIGATED</span>}
                      </div>
                      {inc.description && <p className="text-slate-400">{inc.description}</p>}
                      <div className="text-[10px] text-slate-500">
                        Score impact: {inc.status === 'OPEN' || inc.status === 'INVESTIGATING' ? `+${inc.score_impact}` : '0'} pts • Reported: {new Date(inc.reported_at).toLocaleDateString()}
                        {inc.resolved_at && ` • Resolved: ${new Date(inc.resolved_at).toLocaleDateString()}`}
                      </div>
                    </div>
                    {['OPEN', 'INVESTIGATING'].includes(inc.status) && (
                      <button
                        onClick={() => handleResolveIncident(inc.id)}
                        disabled={resolvingId === inc.id}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        {resolvingId === inc.id ? '...' : 'Resolve'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

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

            {/* TAB CONTENT: VIRUSTOTAL */}
            {activeTab === 'vt' && breakdown?.virustotal && (
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">VirusTotal Domain & IP Reputation</span>
                  <span className={`px-2 py-0.5 rounded font-bold ${breakdown.virustotal.malicious_detections > 0 ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                    {breakdown.virustotal.status || 'Available'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                  <div>Malicious Detections: <span className="font-bold text-rose-400">{breakdown.virustotal.malicious_detections || 0}</span></div>
                  <div>Suspicious Detections: <span className="font-bold text-amber-400">{breakdown.virustotal.suspicious_detections || 0}</span></div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: NVD CVES */}
            {activeTab === 'nvd' && breakdown?.nvd && (
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">NVD Vulnerabilities ({breakdown.nvd.cve_count || 0})</span>
                  <span className="px-2 py-0.5 rounded font-bold bg-slate-800 text-cyan-300">
                    {breakdown.nvd.status || 'Available'}
                  </span>
                </div>
                {breakdown.nvd.cves?.map((cve, idx) => (
                  <div key={idx} className="p-2.5 rounded bg-slate-800/60 border border-slate-700/60">
                    <div className="font-bold text-rose-300">{cve.cve_id} (CVSS {cve.cvss_score})</div>
                    <div className="text-[11px] text-slate-300 mt-1">{cve.description}</div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB CONTENT: XPOSEDORNOT */}
            {activeTab === 'xposed' && breakdown?.xposedornot && (
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">XposedOrNot Breach Check</span>
                  <span className={`px-2 py-0.5 rounded font-bold ${breakdown.xposedornot.breach_status === 'Clean' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                    {breakdown.xposedornot.breach_status || 'Clean'}
                  </span>
                </div>
                <div>Number of Breaches: <span className="font-bold text-slate-100">{breakdown.xposedornot.number_of_breaches || 0}</span></div>
                {breakdown.xposedornot.breach_names?.map((b, i) => (
                  <div key={i} className="text-slate-300">• {b}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, ShieldCheck, AlertTriangle, AlertCircle, 
  TrendingUp, TrendingDown, Minus, Clock, Edit3, CheckCircle, 
  Info, Sparkles, RefreshCw
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function VendorTieringTrend({ vendorId, userRole, onTierUpdated }) {
  const [tierData, setTierData] = useState(null);
  const [trendData, setTrendData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideTier, setOverrideTier] = useState('TIER_1_CRITICAL');
  const [overrideReason, setOverrideReason] = useState('');
  const [savingOverride, setSavingOverride] = useState(false);
  const [notification, setNotification] = useState(null);

  const canOverrideTier = ['ENTERPRISE_ADMIN', 'CISO'].includes(userRole);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tierRes, trendRes] = await Promise.all([
        fetch(`/api/vendors/${vendorId}/tier`, { credentials: 'include' }),
        fetch(`/api/vendors/${vendorId}/risk-trend`, { credentials: 'include' })
      ]);

      if (tierRes.ok) {
        setTierData(await tierRes.json());
      }
      if (trendRes.ok) {
        setTrendData(await trendRes.json());
      }
    } catch (err) {
      console.error('Failed to fetch tiering or trend data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (vendorId) {
      fetchData();
    }
  }, [vendorId]);

  const handleSaveOverride = async (e) => {
    e.preventDefault();
    if (!overrideReason.trim()) return;

    setSavingOverride(true);
    try {
      const res = await fetch(`/api/vendors/${vendorId}/tier-override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tier: overrideTier,
          reason: overrideReason.trim()
        })
      });

      if (res.ok) {
        const updated = await res.json();
        setTierData(updated);
        setShowOverrideModal(false);
        setOverrideReason('');
        setNotification({ type: 'success', text: 'Tier override applied successfully.' });
        if (onTierUpdated) onTierUpdated();
      } else {
        const errJson = await res.json();
        setNotification({ type: 'error', text: errJson.detail || 'Failed to apply tier override.' });
      }
    } catch (err) {
      setNotification({ type: 'error', text: 'Network error submitting tier override.' });
    } finally {
      setSavingOverride(false);
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const getTierBadge = (tier) => {
    switch (tier) {
      case 'TIER_1_CRITICAL':
        return (
          <span className="px-3 py-1 rounded-lg text-xs font-black bg-rose-600 text-white shadow-md shadow-rose-950/50 border border-rose-500 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" /> TIER 1 — CRITICAL
          </span>
        );
      case 'TIER_2_HIGH':
        return (
          <span className="px-3 py-1 rounded-lg text-xs font-black bg-orange-600 text-white shadow-md shadow-orange-950/50 border border-orange-500 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> TIER 2 — HIGH
          </span>
        );
      case 'TIER_3_MEDIUM':
        return (
          <span className="px-3 py-1 rounded-lg text-xs font-bold bg-amber-600 text-white shadow-md shadow-amber-950/50 border border-amber-500 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" /> TIER 3 — MEDIUM
          </span>
        );
      case 'TIER_4_LOW':
        return (
          <span className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-600 text-white shadow-md shadow-emerald-950/50 border border-emerald-500 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> TIER 4 — LOW
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
            {tier || 'UNCLASSIFIED'}
          </span>
        );
    }
  };

  const getTrendBadge = (direction) => {
    switch (direction) {
      case 'IMPROVING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-950 border border-emerald-800 text-emerald-300">
            <TrendingDown className="w-3.5 h-3.5 text-emerald-400" /> IMPROVING
          </span>
        );
      case 'WORSENING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-950 border border-rose-800 text-rose-300">
            <TrendingUp className="w-3.5 h-3.5 text-rose-400" /> WORSENING
          </span>
        );
      case 'STABLE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-slate-800 border border-slate-700 text-slate-300">
            <Minus className="w-3.5 h-3.5 text-cyan-400" /> STABLE
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-900 border border-slate-800 text-slate-400">
            NO HISTORY
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-slate-500 gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-cyan-500" />
        <span className="text-xs">Evaluating risk tier and history...</span>
      </div>
    );
  }

  const effectiveTier = tierData?.effective_tier || 'TIER_3_MEDIUM';
  const calculatedTier = tierData?.calculated_tier || 'TIER_3_MEDIUM';
  const isOverridden = tierData?.is_overridden;
  const rationale = tierData?.rationale || [];

  const historyPoints = trendData?.history_points || [];
  const chartData = historyPoints.map(p => ({
    date: p.calculated_at ? new Date(p.calculated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'Point',
    score: p.score
  }));

  return (
    <div className="space-y-4">
      {notification && (
        <div className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
          notification.type === 'success' ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300' : 'bg-rose-950/70 border-rose-800 text-rose-300'
        }`}>
          <span>{notification.text}</span>
          <button onClick={() => setNotification(null)} className="opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Main Tier & Trend Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left Column: Risk Tier Card */}
        <div className="lg:col-span-6 bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">Risk-Based Vendor Tier</h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  Policy {tierData?.tiering_version || 'v1'}
                </span>
              </div>
              {canOverrideTier && (
                <button
                  onClick={() => setShowOverrideModal(true)}
                  className="flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition-colors"
                >
                  <Edit3 className="w-3 h-3" /> Override
                </button>
              )}
            </div>

            {/* Effective vs Calculated Tier Badges */}
            <div className="flex flex-wrap items-center gap-3 bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 mb-3">
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Effective Tier</div>
                {getTierBadge(effectiveTier)}
              </div>
              {isOverridden && (
                <div className="border-l border-slate-800 pl-3">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Calculated Tier</div>
                  <div className="text-xs font-semibold text-slate-400">{calculatedTier.replace('_', ' ')}</div>
                  <span className="text-[9px] text-amber-400 font-medium">Manually Overridden</span>
                </div>
              )}
            </div>

            {/* Rationale Bullet Points */}
            <div>
              <div className="text-[11px] font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
                <Info className="w-3 h-3 text-cyan-400" /> Policy Rationale Factors:
              </div>
              {rationale.length > 0 ? (
                <ul className="space-y-1 text-xs text-slate-300 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
                  {rationale.map((r, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-cyan-400 mt-0.5">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500 italic">No specific risk triggers identified. Defaulting to operational baseline.</p>
              )}
            </div>
          </div>

          {/* Override Note footer if present */}
          {isOverridden && tierData?.tier_override_reason && (
            <div className="mt-3 p-2 rounded bg-amber-950/30 border border-amber-800/40 text-[11px] text-amber-300">
              <span className="font-semibold">Override Reason:</span> {tierData.tier_override_reason}
              {tierData.tier_overridden_by && (
                <span className="text-[10px] text-slate-400 block mt-0.5">By {tierData.tier_overridden_by}</span>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Risk Trend Analysis */}
        <div className="lg:col-span-6 bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">Risk Trend Analysis</h3>
              </div>
              <div>{getTrendBadge(trendData?.trend_direction)}</div>
            </div>

            {/* Score Delta Indicators */}
            {trendData?.current_score !== null && trendData?.current_score !== undefined ? (
              <div className="grid grid-cols-3 gap-2 bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80 mb-3 text-center">
                <div>
                  <div className="text-[10px] text-slate-400">Previous</div>
                  <div className="text-sm font-bold text-slate-300">
                    {trendData.previous_score !== null ? trendData.previous_score : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Current</div>
                  <div className="text-sm font-bold text-white">{trendData.current_score}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Score Delta</div>
                  <div className={`text-sm font-bold ${
                    trendData.score_delta > 0 ? 'text-rose-400' : trendData.score_delta < 0 ? 'text-emerald-400' : 'text-slate-300'
                  }`}>
                    {trendData.score_delta > 0 ? `+${trendData.score_delta}` : trendData.score_delta} pts
                  </div>
                </div>
              </div>
            ) : null}

            {/* Historical Score Line Chart */}
            <div className="h-32 w-full mt-1">
              {chartData.length >= 2 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 9 }} />
                    <YAxis domain={[0, 100]} stroke="#64748b" tick={{ fontSize: 9 }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                      formatter={(val) => [`${val} / 100`, 'Risk Score']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="score" 
                      stroke="#06b6d4" 
                      strokeWidth={2} 
                      dot={{ r: 3, fill: '#06b6d4' }} 
                      activeDot={{ r: 5 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-3 bg-slate-950/40 rounded-lg border border-slate-800/40 text-slate-500">
                  <Clock className="w-5 h-5 text-slate-600 mb-1" />
                  <p className="text-xs">{trendData?.message || "Not enough history for trend analysis."}</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">Requires at least 2 historical evaluations.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Manual Tier Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-cyan-400" /> Manual Tier Override
              </h3>
              <button onClick={() => setShowOverrideModal(false)} className="text-slate-400 hover:text-white text-xs">✕</button>
            </div>

            <form onSubmit={handleSaveOverride} className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Override Risk Tier</label>
                <select
                  value={overrideTier}
                  onChange={(e) => setOverrideTier(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="TIER_1_CRITICAL">TIER 1 — CRITICAL</option>
                  <option value="TIER_2_HIGH">TIER 2 — HIGH</option>
                  <option value="TIER_3_MEDIUM">TIER 3 — MEDIUM</option>
                  <option value="TIER_4_LOW">TIER 4 — LOW</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Justification Reason (Mandatory)</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Critical customer payment processor designated as Tier 1 by CISO."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingOverride || !overrideReason.trim()}
                  className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold disabled:opacity-50"
                >
                  {savingOverride ? 'Applying...' : 'Apply Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Gauge, ShieldAlert, RefreshCw, Zap, CheckCircle2, RotateCcw, AlertTriangle } from 'lucide-react';

export default function DevQuotaDrawer({ isOpen, onClose }) {
  const [quotaData, setQuotaData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchQuotaStats();
    }
  }, [isOpen]);

  const fetchQuotaStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/quota');
      if (res.ok) {
        const json = await res.json();
        setQuotaData(json);
      }
    } catch (err) {
      console.error("Quota fetch failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetQuota = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/quota/reset', { method: 'POST' });
      if (res.ok) {
        fetchQuotaStats();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  const quotas = quotaData?.quotas || {};

  return (
    <div className="bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-6 shadow-2xl backdrop-blur-md space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
          <Gauge className="w-4 h-4" />
          <span>API Quota Budgeting & Circuit Breaker Monitor</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchQuotaStats}
            disabled={loading}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleResetQuota}
            className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30 text-xs font-semibold flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Quota</span>
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Prevents API key exhaustion by tracking daily limits. If any service hits 90% of its daily quota limit, circuit breakers automatically trip to serve cached/mock responses.
      </p>

      {/* Quotas List */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(quotas).map(([service, q]) => {
          const percentage = Math.round((q.used / q.limit) * 100);
          const isTripped = q.circuit_breaker_tripped;

          return (
            <div key={service} className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                <span>{service} API</span>
                <span className={`text-[10px] px-2 py-0.5 rounded ${
                  isTripped ? 'bg-rose-500 text-white animate-pulse' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {isTripped ? 'CIRCUIT TRIPPED' : 'NORMAL'}
                </span>
              </div>

              <div className="flex justify-between text-xs text-slate-400 font-mono">
                <span>Calls Today: {q.used} / {q.limit}</span>
                <span className="font-bold">{q.remaining} Left</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    isTripped ? 'bg-rose-500' : percentage > 70 ? 'bg-amber-500' : 'bg-cyan-500'
                  }`}
                  style={{ width: `${Math.min(100, percentage)}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-2 text-[11px] text-slate-500 flex items-center justify-between">
        <span>Cache Cooldown Window: 60 minutes</span>
        <span>Environment Flag: DEMO_MODE={quotaData?.demo_mode ? 'true' : 'false'}</span>
      </div>
    </div>
  );
}

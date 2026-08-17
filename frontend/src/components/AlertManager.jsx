import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell, AlertTriangle, ShieldAlert, FileWarning, Clock, Award,
  CheckCircle, Circle, Eye, RefreshCw, ChevronRight, X,
  AlertCircle, TrendingDown, Filter, RotateCcw
} from 'lucide-react';

const API_BASE = 'http://localhost:8000';

const ALERT_CONFIG = {
  HIGH_RISK_VENDOR: {
    label: 'High Risk Vendor',
    icon: ShieldAlert,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    dot: 'bg-rose-500',
  },
  MAJOR_RISK_CHANGE: {
    label: 'Major Risk Change',
    icon: TrendingDown,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    dot: 'bg-orange-500',
  },
  ASSESSMENT_OVERDUE: {
    label: 'Assessment Overdue',
    icon: Clock,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    dot: 'bg-amber-400',
  },
  CERTIFICATION_EXPIRING: {
    label: 'Certification Expiring',
    icon: Award,
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
    dot: 'bg-sky-400',
  },
  CERTIFICATION_EXPIRED: {
    label: 'Certification Expired',
    icon: FileWarning,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/30',
    dot: 'bg-violet-500',
  },
};

const SEVERITY_CONFIG = {
  CRITICAL: { label: 'Critical', color: 'text-rose-400', bg: 'bg-rose-500/20', border: 'border-rose-500/40' },
  HIGH:     { label: 'High',     color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/40' },
  MEDIUM:   { label: 'Medium',   color: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/40' },
  LOW:      { label: 'Low',      color: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/40' },
};

function timeAgo(isoStr) {
  if (!isoStr) return '';
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function AlertDetailPanel({ alert, onClose, onRead, onAcknowledge }) {
  if (!alert) return null;
  const cfg = ALERT_CONFIG[alert.alert_type] || {};
  const sevCfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.HIGH;
  const Icon = cfg.icon || AlertTriangle;
  let meta = {};
  try { meta = JSON.parse(alert.metadata_json || '{}'); } catch {}

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#0d1424] border border-emerald-900/40 rounded-2xl shadow-2xl w-full max-w-xl mx-4 p-6 relative"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-start gap-4 mb-5">
          <div className={`p-3 rounded-xl ${cfg.bg} border ${cfg.border}`}>
            <Icon className={`w-6 h-6 ${cfg.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${sevCfg.bg} ${sevCfg.border} ${sevCfg.color}`}>
                {sevCfg.label}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color} border ${cfg.border} font-medium`}>
                {cfg.label || alert.alert_type}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                alert.status === 'ACKNOWLEDGED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                alert.status === 'READ' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' :
                'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}>
                {alert.status}
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-100">{alert.title}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{alert.vendor_name} · {timeAgo(alert.created_at)}</p>
          </div>
        </div>

        {/* Message */}
        <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 mb-5">
          <p className="text-sm text-slate-300 leading-relaxed">{alert.message}</p>
        </div>

        {/* Metadata */}
        {Object.keys(meta).length > 0 && (
          <div className="grid grid-cols-2 gap-2 mb-5">
            {Object.entries(meta).filter(([k]) => !['vendor_name'].includes(k)).map(([k, v]) => (
              <div key={k} className="bg-slate-900/40 rounded-lg p-2.5">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">
                  {k.replace(/_/g, ' ')}
                </div>
                <div className="text-xs font-semibold text-slate-200">{String(v)}</div>
              </div>
            ))}
          </div>
        )}

        {/* Timeline */}
        <div className="flex items-center gap-4 text-[10px] text-slate-500 mb-5 border-t border-slate-800 pt-4">
          <span>Created: <span className="text-slate-400">{alert.created_at?.slice(0, 16).replace('T', ' ')}</span></span>
          {alert.read_at && <span>Read: <span className="text-slate-400">{alert.read_at?.slice(0, 16).replace('T', ' ')}</span></span>}
          {alert.acknowledged_at && <span>Acked: <span className="text-slate-400">{alert.acknowledged_at?.slice(0, 16).replace('T', ' ')}</span></span>}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {alert.status === 'UNREAD' && (
            <button
              onClick={() => onRead(alert.id)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 rounded-xl text-sky-400 text-xs font-semibold transition-all"
            >
              <Eye className="w-4 h-4" /> Mark as Read
            </button>
          )}
          {alert.status !== 'ACKNOWLEDGED' && (
            <button
              onClick={() => onAcknowledge(alert.id)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 rounded-xl text-emerald-400 text-xs font-semibold transition-all"
            >
              <CheckCircle className="w-4 h-4" /> Acknowledge
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AlertCard({ alert, onClick }) {
  const cfg = ALERT_CONFIG[alert.alert_type] || {};
  const sevCfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.HIGH;
  const Icon = cfg.icon || AlertTriangle;
  const isUnread = alert.status === 'UNREAD';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left group rounded-xl border transition-all duration-200 p-4 hover:border-emerald-500/40 ${
        isUnread
          ? 'bg-slate-900/60 border-slate-700/60 hover:bg-slate-900/80'
          : 'bg-slate-900/30 border-slate-800/50 hover:bg-slate-900/50 opacity-75 hover:opacity-100'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 p-2 rounded-lg ${cfg.bg} border ${cfg.border} flex-shrink-0`}>
          <Icon className={`w-4 h-4 ${cfg.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {isUnread && <span className={`w-2 h-2 rounded-full ${cfg.dot} flex-shrink-0 animate-pulse`} />}
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${sevCfg.bg} ${sevCfg.border} ${sevCfg.color}`}>
              {sevCfg.label}
            </span>
            <span className="text-[10px] text-slate-500">{cfg.label || alert.alert_type}</span>
          </div>
          <p className="text-xs font-semibold text-slate-200 mb-0.5 truncate">{alert.title}</p>
          <p className="text-[11px] text-slate-400 line-clamp-2">{alert.message}</p>
          <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60" />
              {alert.vendor_name || `Vendor #${alert.vendor_id}`}
            </span>
            <span>{timeAgo(alert.created_at)}</span>
            <span className={`px-1.5 py-0.5 rounded font-medium ${
              alert.status === 'ACKNOWLEDGED' ? 'text-emerald-400' :
              alert.status === 'READ' ? 'text-sky-400' : 'text-rose-400'
            }`}>
              {alert.status}
            </span>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 flex-shrink-0 mt-1 transition-colors" />
      </div>
    </button>
  );
}

const FILTER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'UNREAD', label: 'Unread' },
  { id: 'HIGH_RISK_VENDOR', label: 'High Risk' },
  { id: 'MAJOR_RISK_CHANGE', label: 'Risk Change' },
  { id: 'ASSESSMENT_OVERDUE', label: 'Overdue' },
  { id: 'CERTIFICATION_EXPIRING', label: 'Cert Expiring' },
  { id: 'CERTIFICATION_EXPIRED', label: 'Cert Expired' },
];

export default function AlertManager() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const fetchAlerts = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/alerts`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      setAlerts(data.alerts || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const handleRead = async (alertId) => {
    try {
      const res = await fetch(`${API_BASE}/api/alerts/${alertId}/read`, { method: 'POST' });
      if (res.ok) {
        setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status: 'READ' } : a));
        setSelectedAlert(prev => prev?.id === alertId ? { ...prev, status: 'READ' } : prev);
      }
    } catch (e) { console.error(e); }
  };

  const handleAcknowledge = async (alertId) => {
    try {
      const res = await fetch(`${API_BASE}/api/alerts/${alertId}/acknowledge`, { method: 'POST' });
      if (res.ok) {
        setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status: 'ACKNOWLEDGED' } : a));
        setSelectedAlert(prev => prev?.id === alertId ? { ...prev, status: 'ACKNOWLEDGED' } : prev);
      }
    } catch (e) { console.error(e); }
  };

  const filteredAlerts = alerts.filter(a => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'UNREAD') return a.status === 'UNREAD';
    return a.alert_type === activeFilter;
  });

  const stats = {
    total: alerts.length,
    unread: alerts.filter(a => a.status === 'UNREAD').length,
    critical: alerts.filter(a => a.severity === 'CRITICAL' && a.status === 'UNREAD').length,
    acknowledged: alerts.filter(a => a.status === 'ACKNOWLEDGED').length,
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#00f090]" />
            Alert Center
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Real-time vendor risk alerts from live database events</p>
        </div>
        <button
          onClick={() => fetchAlerts(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700/60 hover:bg-slate-800 text-slate-300 text-xs font-medium transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Alerts', value: stats.total, color: 'text-slate-200', icon: Bell },
          { label: 'Unread', value: stats.unread, color: 'text-rose-400', icon: Circle },
          { label: 'Critical & Unread', value: stats.critical, color: 'text-orange-400', icon: AlertCircle },
          { label: 'Acknowledged', value: stats.acknowledged, color: 'text-emerald-400', icon: CheckCircle },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bg-[#0a0f1d] border border-emerald-950/40 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-[11px] text-slate-400">{label}</span>
            </div>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {FILTER_TABS.map(tab => {
          const count = tab.id === 'all'
            ? alerts.length
            : tab.id === 'UNREAD'
              ? alerts.filter(a => a.status === 'UNREAD').length
              : alerts.filter(a => a.alert_type === tab.id).length;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeFilter === tab.id
                  ? 'bg-emerald-950/40 text-[#00f090] border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent hover:border-slate-700/60'
              }`}
            >
              <Filter className="w-3 h-3" />
              {tab.label}
              {count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeFilter === tab.id
                    ? 'bg-emerald-500/20 text-[#00f090]'
                    : 'bg-slate-700/60 text-slate-300'
                }`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Alert List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5 animate-spin text-[#00f090]" />
            Loading alerts...
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
            <p className="text-rose-400 font-semibold text-sm">Failed to load alerts</p>
            <p className="text-slate-500 text-xs mt-1">{error}</p>
            <button
              onClick={() => fetchAlerts()}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-400 text-xs font-medium mx-auto hover:bg-rose-500/30 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <CheckCircle className="w-12 h-12 text-emerald-500/60 mx-auto mb-3" />
            <p className="text-slate-300 font-semibold">No alerts found</p>
            <p className="text-slate-500 text-xs mt-1">
              {activeFilter !== 'all'
                ? 'Try a different filter or check back after a risk scan'
                : 'All clear — no risk alerts for your vendors'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map(alert => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onClick={() => setSelectedAlert(alert)}
            />
          ))}
        </div>
      )}

      {/* Detail Panel */}
      {selectedAlert && (
        <AlertDetailPanel
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onRead={handleRead}
          onAcknowledge={handleAcknowledge}
        />
      )}
    </div>
  );
}

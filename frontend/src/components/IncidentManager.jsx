import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  Plus, 
  Search, 
  Filter, 
  Trash2, 
  ExternalLink,
  Flame,
  ShieldCheck,
  Zap,
  Building2,
  FileText
} from 'lucide-react';

const API_BASE = 'http://localhost:8000';

const CATEGORIES = [
  'Security Breach',
  'Data Leak',
  'Ransomware',
  'Outage / Downtime',
  'SLA Violation',
  'Zero-Day Vulnerability',
  'Supply Chain Compromise'
];

const SEVERITIES = [
  { level: 'CRITICAL', impact: '+25 pts', color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
  { level: 'HIGH', impact: '+15 pts', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  { level: 'MEDIUM', impact: '+8 pts', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  { level: 'LOW', impact: '+4 pts', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' }
];

export default function IncidentManager({ vendors, onSelectVendor, onRefreshVendorData }) {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  // New Incident Form State
  const [formData, setFormData] = useState({
    vendor_id: vendors[0]?.id || '',
    title: '',
    description: '',
    category: 'Security Breach',
    severity: 'HIGH',
    status: 'OPEN'
  });
  const [submitting, setSubmitting] = useState(false);

  // Synchronize vendor_id when vendors prop populates
  useEffect(() => {
    if (vendors && vendors.length > 0 && !formData.vendor_id) {
      setFormData(prev => ({ ...prev, vendor_id: vendors[0].id }));
    }
  }, [vendors]);

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/incidents`);
      if (res.ok) {
        const data = await res.json();
        setIncidents(data);
      }
    } catch (err) {
      console.error("Failed to fetch incidents:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = () => {
    const defaultVendorId = formData.vendor_id || vendors[0]?.id || '';
    setFormData(prev => ({ ...prev, vendor_id: defaultVendorId }));
    setIsLogModalOpen(true);
  };

  const handleCreateIncident = async (e) => {
    e.preventDefault();
    const effectiveVendorId = formData.vendor_id || vendors[0]?.id;
    if (!effectiveVendorId) {
      alert("Please select a target vendor.");
      return;
    }
    if (!formData.title || !formData.title.trim()) {
      alert("Please enter an Incident Summary Title.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        vendor_id: Number(effectiveVendorId),
        title: formData.title.trim()
      };
      const res = await fetch(`${API_BASE}/api/incidents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIsLogModalOpen(false);
        setFormData({
          vendor_id: vendors[0]?.id || '',
          title: '',
          description: '',
          category: 'Security Breach',
          severity: 'HIGH',
          status: 'OPEN'
        });
        await fetchIncidents();
        if (onRefreshVendorData) onRefreshVendorData();
      } else {
        const errData = await res.json().catch(() => ({ detail: 'Failed to create incident' }));
        alert(`Failed to log security incident: ${errData.detail || res.statusText}`);
      }
    } catch (err) {
      console.error("Error creating incident:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (incidentId, newStatus) => {
    try {
      const res = await fetch(`${API_BASE}/api/incidents/${incidentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        await fetchIncidents();
        if (onRefreshVendorData) onRefreshVendorData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteIncident = async (incidentId) => {
    if (!window.confirm("Are you sure you want to remove this incident record?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/incidents/${incidentId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchIncidents();
        if (onRefreshVendorData) onRefreshVendorData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filtered Incidents
  const filteredIncidents = incidents.filter(inc => {
    const matchesSearch = inc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          inc.vendor_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (inc.category && inc.category.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesSeverity = selectedSeverity === 'ALL' || inc.severity === selectedSeverity;
    const matchesStatus = selectedStatus === 'ALL' || inc.status === selectedStatus;
    return matchesSearch && matchesSeverity && matchesStatus;
  });

  // Calculate Metrics
  const activeIncidents = incidents.filter(i => ['OPEN', 'INVESTIGATING'].includes(i.status));
  const criticalIncidents = activeIncidents.filter(i => i.severity === 'CRITICAL');
  const resolvedCount = incidents.filter(i => ['RESOLVED', 'MITIGATED'].includes(i.status)).length;
  const totalImpact = activeIncidents.reduce((sum, i) => sum + (i.score_impact || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-rose-950/20 to-slate-900 border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
              <Flame className="w-3 h-3 text-rose-400 animate-pulse" /> LIVE INCIDENT LOG
            </span>
            <span className="text-xs text-slate-400">Dynamic Risk Score Modifier</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-100 tracking-tight mt-1">Vendor Incident Center</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Log security breaches, downtime outages, and zero-day threats. Logged active incidents automatically calculate score penalties and elevate vendor risk tiers in real-time.
          </p>
        </div>

        <button
          onClick={handleOpenModal}
          className="bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-semibold text-xs py-3 px-5 rounded-xl shadow-lg shadow-rose-950/50 flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] self-start md:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Log Security Incident</span>
        </button>
      </div>

      {/* Overview Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Active Incidents</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-100">{activeIncidents.length}</span>
            <span className="text-[11px] text-slate-400">/ {incidents.length} total</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Critical Outages & Breaches</span>
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-400">{criticalIncidents.length}</span>
            <span className="text-[11px] text-rose-400/80 font-medium">Require CISO Review</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Score Penalty Applied</span>
            <Zap className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-400">+{totalImpact} pts</span>
            <span className="text-[11px] text-slate-400">to vendor scores</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Resolved / Mitigated</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-400">{resolvedCount}</span>
            <span className="text-[11px] text-emerald-400 font-medium">Penalties Restored</span>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search incident title, vendor, category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical (+25 pts)</option>
            <option value="HIGH">High (+15 pts)</option>
            <option value="MEDIUM">Medium (+8 pts)</option>
            <option value="LOW">Low (+4 pts)</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="INVESTIGATING">Investigating</option>
            <option value="RESOLVED">Resolved</option>
            <option value="MITIGATED">Mitigated</option>
          </select>
        </div>
      </div>

      {/* Incidents Table / List */}
      <div className="rounded-xl bg-slate-900/70 border border-slate-800/80 overflow-hidden shadow-lg">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <Clock className="w-4 h-4 animate-spin text-cyan-400" /> Loading incident feed...
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No incidents match your search filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold">
                  <th className="py-3 px-4">Vendor</th>
                  <th className="py-3 px-4">Incident Title & Category</th>
                  <th className="py-3 px-4">Severity & Impact</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Reported</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredIncidents.map((inc) => {
                  const severityConfig = SEVERITIES.find(s => s.level === inc.severity) || SEVERITIES[2];
                  const isActive = ['OPEN', 'INVESTIGATING'].includes(inc.status);

                  return (
                    <tr key={inc.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-slate-200">
                        <button
                          onClick={() => onSelectVendor && onSelectVendor(inc.vendor_id)}
                          className="flex items-center gap-2 hover:text-cyan-400 transition-colors text-left"
                        >
                          <Building2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <div>
                            <div className="font-semibold text-slate-100">{inc.vendor_name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{inc.vendor_domain}</div>
                          </div>
                        </button>
                      </td>

                      <td className="py-3.5 px-4 max-w-md">
                        <div className="font-semibold text-slate-100 flex items-center gap-2">
                          {inc.title}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                          {inc.description || 'No description provided.'}
                        </div>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 font-mono">
                          {inc.category || 'Security Incident'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${severityConfig.color}`}>
                            {inc.severity}
                          </span>
                          <span className="text-[11px] font-mono text-rose-400 font-semibold">
                            {isActive ? severityConfig.impact : '0 pts'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit border ${
                          inc.status === 'OPEN' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' :
                          inc.status === 'INVESTIGATING' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                          'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        }`}>
                          {inc.status === 'OPEN' && <AlertTriangle className="w-3 h-3 text-rose-400" />}
                          {inc.status === 'INVESTIGATING' && <Clock className="w-3 h-3 text-amber-400 animate-spin" />}
                          {['RESOLVED', 'MITIGATED'].includes(inc.status) && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                          {inc.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-400 text-[11px] font-mono">
                        {inc.reported_at ? new Date(inc.reported_at).toLocaleDateString() : 'Recent'}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-1">
                        {inc.status !== 'RESOLVED' ? (
                          <button
                            onClick={() => handleUpdateStatus(inc.id, 'RESOLVED')}
                            className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded text-[10px] font-semibold transition-colors"
                          >
                            Mark Resolved
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUpdateStatus(inc.id, 'OPEN')}
                            className="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded text-[10px] font-semibold transition-colors"
                          >
                            Re-Open
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteIncident(inc.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                          title="Delete Incident"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log New Security Incident Modal */}
      {isLogModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-500" />
                <h3 className="text-base font-bold text-slate-100">Log Vendor Security Incident</h3>
              </div>
              <button
                onClick={() => setIsLogModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-xs font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateIncident} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Target Vendor *</label>
                <select
                  value={formData.vendor_id || (vendors[0]?.id || '')}
                  onChange={(e) => setFormData({ ...formData, vendor_id: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:border-cyan-500 focus:outline-none cursor-pointer"
                  required
                >
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.domain})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Incident Summary Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Production S3 Bucket Public Exposure"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:border-cyan-500 focus:outline-none"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Severity (Score Penalty)</label>
                  <select
                    value={formData.severity}
                    onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="CRITICAL">Critical (+25 Risk Pts)</option>
                    <option value="HIGH">High (+15 Risk Pts)</option>
                    <option value="MEDIUM">Medium (+8 Risk Pts)</option>
                    <option value="LOW">Low (+4 Risk Pts)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:border-cyan-500 focus:outline-none"
                >
                  <option value="OPEN">Open (Active Hazard)</option>
                  <option value="INVESTIGATING">Under Investigation</option>
                  <option value="RESOLVED">Resolved (No Penalty)</option>
                  <option value="MITIGATED">Mitigated</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Detailed Description</label>
                <textarea
                  rows="3"
                  placeholder="Include root cause, compromised assets, and CISO remediation steps..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsLogModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-semibold rounded-xl text-xs shadow-lg shadow-rose-950/40 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submitting ? 'Logging Incident...' : 'Log & Update Vendor Risk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

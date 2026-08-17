import React, { useState, useEffect } from 'react';
import { 
  Network, Link2, AlertTriangle, ShieldAlert, ShieldCheck, 
  Plus, Trash2, Edit3, ExternalLink, RefreshCw, Layers,
  Server, Cloud, Database, Cpu, Activity, Info
} from 'lucide-react';

const RELATIONSHIP_TYPES = [
  'SUBPROCESSOR',
  'CLOUD_PROVIDER',
  'HOSTING_PROVIDER',
  'PAYMENT_PROVIDER',
  'DATA_PROCESSOR',
  'INFRASTRUCTURE_PROVIDER',
  'SECURITY_PROVIDER',
  'CRITICAL_SERVICE_PROVIDER',
  'OTHER'
];

const CRITICALITY_LEVELS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export default function SupplyChainRisk({ vendorId, userRole, allVendors = [] }) {
  const [depsData, setDepsData] = useState({ direct_dependencies: [], dependent_vendors: [] });
  const [impactData, setImpactData] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImpactModal, setShowImpactModal] = useState(false);
  const [showGraphModal, setShowGraphModal] = useState(false);
  const [editingDep, setEditingDep] = useState(null);
  const [notification, setNotification] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [isExternal, setIsExternal] = useState(false);
  const [downstreamVendorId, setDownstreamVendorId] = useState('');
  const [externalName, setExternalName] = useState('');
  const [externalDomain, setExternalDomain] = useState('');
  const [relType, setRelType] = useState('CLOUD_PROVIDER');
  const [criticality, setCriticality] = useState('MEDIUM');
  const [depLevel, setDepLevel] = useState('MEDIUM');
  const [status, setStatus] = useState('ACTIVE');
  const [description, setDescription] = useState('');

  const canEdit = ['ENTERPRISE_ADMIN', 'CISO', 'ANALYST'].includes(userRole);
  const canDelete = ['ENTERPRISE_ADMIN', 'CISO'].includes(userRole);

  const fetchDependencies = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/vendors/${vendorId}/dependencies`, { credentials: 'include' });
      if (res.ok) {
        setDepsData(await res.json());
      }
    } catch (err) {
      console.error('Failed to load supply chain dependencies:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchImpact = async () => {
    try {
      const res = await fetch(`/api/supply-chain/impact/${vendorId}`, { credentials: 'include' });
      if (res.ok) {
        setImpactData(await res.json());
      }
    } catch (err) {
      console.error('Failed to load impact analysis:', err);
    }
  };

  const fetchGraph = async () => {
    try {
      const res = await fetch(`/api/supply-chain/graph?vendor_id=${vendorId}`, { credentials: 'include' });
      if (res.ok) {
        setGraphData(await res.json());
      }
    } catch (err) {
      console.error('Failed to load supply chain graph:', err);
    }
  };

  useEffect(() => {
    if (vendorId) {
      fetchDependencies();
    }
  }, [vendorId]);

  const handleOpenAdd = () => {
    setEditingDep(null);
    setIsExternal(false);
    setDownstreamVendorId('');
    setExternalName('');
    setExternalDomain('');
    setRelType('CLOUD_PROVIDER');
    setCriticality('MEDIUM');
    setDepLevel('MEDIUM');
    setStatus('ACTIVE');
    setDescription('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (dep) => {
    setEditingDep(dep);
    setIsExternal(!dep.downstream_vendor_id);
    setDownstreamVendorId(dep.downstream_vendor_id ? String(dep.downstream_vendor_id) : '');
    setExternalName(dep.external_vendor_name || '');
    setExternalDomain(dep.external_vendor_domain || '');
    setRelType(dep.relationship_type);
    setCriticality(dep.criticality);
    setDepLevel(dep.dependency_level);
    setStatus(dep.status);
    setDescription(dep.description || '');
    setShowAddModal(true);
  };

  const handleSaveDependency = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        relationship_type: relType,
        criticality,
        dependency_level: depLevel,
        status,
        description: description.trim() || null,
        downstream_vendor_id: !isExternal && downstreamVendorId ? parseInt(downstreamVendorId) : null,
        external_vendor_name: isExternal ? externalName.trim() : null,
        external_vendor_domain: isExternal ? externalDomain.trim() : null
      };

      let res;
      if (editingDep) {
        res = await fetch(`/api/dependencies/${editingDep.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`/api/vendors/${vendorId}/dependencies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        setShowAddModal(false);
        setNotification({ type: 'success', text: `Dependency ${editingDep ? 'updated' : 'created'} successfully.` });
        fetchDependencies();
      } else {
        const errJson = await res.json();
        setNotification({ type: 'error', text: errJson.detail || 'Failed to save dependency.' });
      }
    } catch (err) {
      setNotification({ type: 'error', text: 'Network error saving dependency.' });
    } finally {
      setSaving(false);
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const handleDeleteDependency = async (depId) => {
    if (!confirm('Are you sure you want to delete this supply chain relationship?')) return;
    try {
      const res = await fetch(`/api/dependencies/${depId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        setNotification({ type: 'success', text: 'Dependency deleted.' });
        fetchDependencies();
      } else {
        const err = await res.json();
        setNotification({ type: 'error', text: err.detail || 'Failed to delete dependency.' });
      }
    } catch (err) {
      setNotification({ type: 'error', text: 'Network error.' });
    } finally {
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const directDeps = depsData.direct_dependencies || [];
  const dependentVendors = depsData.dependent_vendors || [];
  const criticalCount = directDeps.filter(d => d.criticality === 'CRITICAL' || d.dependency_level === 'CRITICAL').length;

  const getCritBadge = (lvl) => {
    switch (lvl) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">CRITICAL</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-950 text-orange-300 border border-orange-800">HIGH</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">MEDIUM</span>;
      case 'LOW':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">LOW</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">{lvl}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-slate-500 gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-cyan-500" />
        <span className="text-xs">Loading supply chain dependencies...</span>
      </div>
    );
  }

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

      {/* Header Stat Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
            <span>Direct Downstream</span>
            <Network className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-lg font-bold text-white">{directDeps.length}</div>
          <div className="text-[10px] text-slate-500">4th-Party Dependencies</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
            <span>Critical Dependencies</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-lg font-bold text-rose-300">{criticalCount}</div>
          <div className="text-[10px] text-rose-400/80">High-impact risk links</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
            <span>Dependent Vendors</span>
            <Layers className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-lg font-bold text-slate-200">{dependentVendors.length}</div>
          <div className="text-[10px] text-slate-500">Upstream organizations</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
          <div className="flex gap-1.5">
            <button
              onClick={() => { fetchImpact(); setShowImpactModal(true); }}
              className="flex-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded text-[11px] font-semibold transition-colors flex items-center justify-center gap-1"
            >
              <Activity className="w-3 h-3 text-cyan-400" /> Blast Radius
            </button>
            <button
              onClick={() => { fetchGraph(); setShowGraphModal(true); }}
              className="flex-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded text-[11px] font-semibold transition-colors flex items-center justify-center gap-1"
            >
              <Network className="w-3 h-3 text-cyan-400" /> Tree Graph
            </button>
          </div>
          {canEdit && (
            <button
              onClick={handleOpenAdd}
              className="w-full mt-1.5 px-2 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-[11px] font-semibold transition-colors flex items-center justify-center gap-1 shadow"
            >
              <Plus className="w-3.5 h-3.5" /> Add Dependency
            </button>
          )}
        </div>
      </div>

      {/* Direct Downstream Dependencies Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-cyan-400" />
            <h4 className="text-sm font-semibold text-white">Direct Downstream Dependencies</h4>
            <span className="text-xs text-slate-500">({directDeps.length})</span>
          </div>
        </div>

        {directDeps.length === 0 ? (
          <div className="p-8 text-center bg-slate-950/40 rounded-lg border border-slate-800/40 text-slate-500">
            <Network className="w-6 h-6 text-slate-600 mx-auto mb-1.5" />
            <p className="text-xs font-medium">No fourth-party dependencies recorded.</p>
            <p className="text-[10px] text-slate-600 mt-0.5">Add upstream service providers, cloud hosts, or subprocessors to track supply chain contagion.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                  <th className="py-2 px-3">Downstream Entity</th>
                  <th className="py-2 px-3">Relationship Type</th>
                  <th className="py-2 px-3">Criticality</th>
                  <th className="py-2 px-3">Dependency Level</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {directDeps.map((dep) => (
                  <tr key={dep.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-white">
                        {dep.downstream_vendor_name || dep.external_vendor_name}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span>{dep.downstream_vendor_domain || dep.external_vendor_domain || '—'}</span>
                        {dep.downstream_vendor_id ? (
                          <span className="px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 text-[9px]">Inventory Vendor</span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 text-[9px]">External Provider</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                        {dep.relationship_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">{getCritBadge(dep.criticality)}</td>
                    <td className="py-2.5 px-3">{getCritBadge(dep.dependency_level)}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        dep.status === 'ACTIVE' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {dep.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-1.5">
                      {canEdit && (
                        <button
                          onClick={() => handleOpenEdit(dep)}
                          className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition-colors"
                          title="Edit"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDeleteDependency(dep.id)}
                          className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upstream Dependent Organizations (if any) */}
      {dependentVendors.length > 0 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-4 h-4 text-amber-400" />
            <h4 className="text-sm font-semibold text-white">Upstream Organizations Dependent on this Vendor</h4>
            <span className="text-xs text-slate-500">({dependentVendors.length})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {dependentVendors.map((dv) => (
              <div key={dv.id} className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white">{dv.upstream_vendor_name}</div>
                  <div className="text-[10px] text-slate-400">{dv.upstream_vendor_domain} • {dv.relationship_type}</div>
                </div>
                <div className="text-right">
                  {getCritBadge(dv.criticality)}
                  <div className="text-[9px] text-slate-500 mt-0.5">Tier: {dv.upstream_tier?.replace('TIER_', 'T') || 'T3'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit Dependency Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Network className="w-4 h-4 text-cyan-400" />
                {editingDep ? 'Edit Supply Chain Relationship' : 'Add Fourth-Party Dependency'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white text-xs">✕</button>
            </div>

            <form onSubmit={handleSaveDependency} className="space-y-3">
              {/* Entity Type Toggle */}
              <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setIsExternal(false)}
                  className={`flex-1 py-1.5 rounded-md font-semibold transition-colors ${
                    !isExternal ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Registered Vendor
                </button>
                <button
                  type="button"
                  onClick={() => setIsExternal(true)}
                  className={`flex-1 py-1.5 rounded-md font-semibold transition-colors ${
                    isExternal ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  External Provider
                </button>
              </div>

              {!isExternal ? (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Downstream Registered Vendor</label>
                  <select
                    value={downstreamVendorId}
                    onChange={(e) => setDownstreamVendorId(e.target.value)}
                    required={!isExternal}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">-- Select Vendor --</option>
                    {allVendors
                      .filter(v => v.id !== vendorId)
                      .map(v => (
                        <option key={v.id} value={v.id}>
                          {v.name} ({v.domain})
                        </option>
                      ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">External Provider Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Amazon Web Services"
                      value={externalName}
                      onChange={(e) => setExternalName(e.target.value)}
                      required={isExternal}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Provider Domain</label>
                    <input
                      type="text"
                      placeholder="e.g. aws.amazon.com"
                      value={externalDomain}
                      onChange={(e) => setExternalDomain(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Relationship Type</label>
                  <select
                    value={relType}
                    onChange={(e) => setRelType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    {RELATIONSHIP_TYPES.map(t => (
                      <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Criticality</label>
                  <select
                    value={criticality}
                    onChange={(e) => setCriticality(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    {CRITICALITY_LEVELS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Dependency Level</label>
                  <select
                    value={depLevel}
                    onChange={(e) => setDepLevel(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    {CRITICALITY_LEVELS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="UNDER_REVIEW">UNDER REVIEW</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Primary cloud hosting provider hosting production database clusters."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingDep ? 'Update Relationship' : 'Save Relationship'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Blast Radius Impact Analysis Modal */}
      {showImpactModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-xl w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-rose-400" />
                Blast-Radius Impact Analysis
              </h3>
              <button onClick={() => setShowImpactModal(false)} className="text-slate-400 hover:text-white text-xs">✕</button>
            </div>

            {impactData ? (
              <div className="space-y-3">
                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
                  <div className="text-xs text-slate-400">Target Vendor: <span className="text-white font-semibold">{impactData.vendor?.name}</span></div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    If this entity suffers an outage or breach, the following upstream vendors in your organization's supply chain would be directly and transitively impacted.
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Impacted Upstreams</div>
                    <div className="text-sm font-bold text-rose-400">{impactData.impacted_upstream_count}</div>
                  </div>
                  <div className="p-2 rounded bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Downstream Dependencies</div>
                    <div className="text-sm font-bold text-cyan-400">{impactData.direct_downstream_count}</div>
                  </div>
                  <div className="p-2 rounded bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400">Max Dependency Depth</div>
                    <div className="text-sm font-bold text-amber-400">{impactData.max_dependency_depth} hops</div>
                  </div>
                </div>

                {impactData.affected_upstream_vendors?.length > 0 ? (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    <div className="text-[11px] font-semibold text-slate-300">Affected Upstream Inventory Vendors:</div>
                    {impactData.affected_upstream_vendors.map((uv) => (
                      <div key={uv.vendor_id} className="p-2 rounded bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-semibold text-white">{uv.name}</div>
                          <div className="text-[10px] text-slate-400">Distance: {uv.dependency_distance} hop(s) • {uv.relationship_type}</div>
                        </div>
                        {getCritBadge(uv.criticality)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-slate-500 bg-slate-950/40 rounded-lg">
                    No upstream inventory vendors currently depend on this entity.
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-slate-500">Loading impact analysis...</div>
            )}
          </div>
        </div>
      )}

      {/* Supply Chain Tree Graph Modal */}
      {showGraphModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-2xl w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Network className="w-4 h-4 text-cyan-400" />
                Supply Chain Hierarchy Tree
              </h3>
              <button onClick={() => setShowGraphModal(false)} className="text-slate-400 hover:text-white text-xs">✕</button>
            </div>

            {graphData && graphData.edges?.length > 0 ? (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {graphData.edges.map((edge) => {
                  const srcNode = graphData.nodes?.find(n => n.id === edge.source);
                  const dstNode = graphData.nodes?.find(n => n.id === edge.target);
                  return (
                    <div key={edge.id} className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <div className="font-semibold text-slate-200">{srcNode?.name || edge.source}</div>
                        <span className="text-cyan-400 font-mono">──[{edge.relationship_type.replace(/_/g, ' ')}]──►</span>
                        <div className="font-semibold text-white flex items-center gap-1.5">
                          {dstNode?.name || edge.target}
                          {dstNode?.is_external && <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400">EXT</span>}
                        </div>
                      </div>
                      {getCritBadge(edge.criticality)}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-950/40 rounded-lg border border-slate-800/40 text-slate-500 text-xs">
                No supply-chain dependencies recorded.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

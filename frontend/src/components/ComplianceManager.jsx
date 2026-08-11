import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  FileText, 
  Plus, 
  Search, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Clock,
  Award,
  TrendingUp,
  BarChart3
} from 'lucide-react';

const API_BASE = 'http://localhost:8000';

const FRAMEWORK_TYPES = ['Security', 'Privacy', 'Operational', 'Financial'];

export default function ComplianceManager({ vendors }) {
  const [frameworks, setFrameworks] = useState([]);
  const [availableFrameworks, setAvailableFrameworks] = useState([]);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFramework, setSelectedFramework] = useState('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    vendor_id: vendors[0]?.id || '',
    framework_name: 'SOC 2 Type II',
    framework_type: 'Security',
    compliance_score: 0,
    document_path: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAvailableFrameworks();
    fetchComplianceSummary();
  }, []);

  const fetchAvailableFrameworks = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/compliance/frameworks`);
      if (res.ok) {
        const data = await res.json();
        setAvailableFrameworks(data.frameworks || []);
      }
    } catch (err) {
      console.error("Failed to fetch frameworks:", err);
    }
  };

  const fetchComplianceSummary = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/compliance/summary`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary || []);
      }
    } catch (err) {
      console.error("Failed to fetch compliance summary:", err);
    }
  };

  const handleCreateFramework = async (e) => {
    e.preventDefault();
    if (!formData.vendor_id || !formData.framework_name) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/vendors/${formData.vendor_id}/compliance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        setIsAddModalOpen(false);
        setFormData({
          vendor_id: vendors[0]?.id || '',
          framework_name: 'SOC 2 Type II',
          framework_type: 'Security',
          compliance_score: 0,
          document_path: ''
        });
        await fetchComplianceSummary();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate summary stats
  const totalAssessments = summary.reduce((sum, s) => sum + (s.vendor_count || 0), 0);
  const avgComplianceScore = summary.length > 0 
    ? Math.round(summary.reduce((sum, s) => sum + (s.avg_score || 0), 0) / summary.length)
    : 0;
  const overdueCount = summary.reduce((sum, s) => sum + (s.overdue_count || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-violet-950/20 to-slate-900 border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/20 text-violet-400 border border-violet-500/30 flex items-center gap-1">
              <Award className="w-3 h-3 text-violet-400" /> COMPLIANCE ENGINE
            </span>
            <span className="text-xs text-slate-400">VendorAuditAI-Inspired Frameworks</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-100 tracking-tight mt-1">Compliance Framework Manager</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Track vendor compliance across 12 frameworks including SOC 2, ISO 27001, NIST CSF, PCI DSS, and more. Automated scoring and gap analysis.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs py-3 px-5 rounded-xl shadow-lg shadow-violet-950/50 flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] self-start md:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add Framework Assessment</span>
        </button>
      </div>

      {/* Overview Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Total Assessments</span>
            <ShieldCheck className="w-4 h-4 text-violet-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-100">{totalAssessments}</span>
            <span className="text-[11px] text-slate-400">frameworks tracked</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Avg Compliance Score</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-400">{avgComplianceScore}%</span>
            <span className="text-[11px] text-slate-400">across all vendors</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Overdue Assessments</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-400">{overdueCount}</span>
            <span className="text-[11px] text-rose-400/80 font-medium">require attention</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Frameworks Available</span>
            <BarChart3 className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-cyan-400">{availableFrameworks.length}</span>
            <span className="text-[11px] text-slate-400">compliance standards</span>
          </div>
        </div>
      </div>

      {/* Compliance Summary by Framework */}
      <div className="rounded-xl bg-slate-900/70 border border-slate-800/80 overflow-hidden shadow-lg">
        <div className="p-4 border-b border-slate-800 bg-slate-950/60">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-violet-400" />
            Compliance Coverage by Framework
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold">
                <th className="py-3 px-4">Framework</th>
                <th className="py-3 px-4">Vendors Assessed</th>
                <th className="py-3 px-4">Avg Score</th>
                <th className="py-3 px-4">Overdue</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {summary.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-400 text-xs">
                    No compliance assessments tracked yet. Add your first framework assessment.
                  </td>
                </tr>
              ) : summary.map((s, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-medium text-slate-200">
                    <div className="flex items-center gap-2">
                      <Award className="w-3.5 h-3.5 text-violet-400" />
                      {s.framework_name}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-300">{s.vendor_count || 0}</td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${s.avg_score >= 80 ? 'bg-emerald-500' : s.avg_score >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`}
                          style={{ width: `${s.avg_score || 0}%` }}
                        />
                      </div>
                      <span className="font-mono text-slate-300">{Math.round(s.avg_score || 0)}%</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    {s.overdue_count > 0 ? (
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold">
                        {s.overdue_count}
                      </span>
                    ) : (
                      <span className="text-emerald-400 text-[10px]">None</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit border ${
                      s.avg_score >= 80 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                      s.avg_score >= 60 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                      'bg-rose-500/20 text-rose-400 border-rose-500/30'
                    }`}>
                      {s.avg_score >= 80 ? 'Compliant' : s.avg_score >= 60 ? 'Needs Review' : 'Non-Compliant'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Framework Assessment Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-violet-500" />
                <h3 className="text-base font-bold text-slate-100">Add Compliance Assessment</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-xs font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateFramework} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Target Vendor *</label>
                <select
                  value={formData.vendor_id}
                  onChange={(e) => setFormData({ ...formData, vendor_id: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:border-violet-500 focus:outline-none"
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
                <label className="block text-slate-300 font-medium mb-1">Compliance Framework *</label>
                <select
                  value={formData.framework_name}
                  onChange={(e) => setFormData({ ...formData, framework_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:border-violet-500 focus:outline-none"
                  required
                >
                  {availableFrameworks.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Framework Type</label>
                <select
                  value={formData.framework_type}
                  onChange={(e) => setFormData({ ...formData, framework_type: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:border-violet-500 focus:outline-none"
                >
                  {FRAMEWORK_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Compliance Score (0-100)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.compliance_score}
                  onChange={(e) => setFormData({ ...formData, compliance_score: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Document Path (Optional)</label>
                <input
                  type="text"
                  placeholder="/uploads/soc2_report.pdf"
                  value={formData.document_path}
                  onChange={(e) => setFormData({ ...formData, document_path: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold rounded-xl text-xs shadow-lg shadow-violet-950/40 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submitting ? 'Adding...' : 'Add Assessment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

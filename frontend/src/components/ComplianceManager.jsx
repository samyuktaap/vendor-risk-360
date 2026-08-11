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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl glass-panel-liquid border border-white/[0.08] shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#00D4AA]/20 text-[#00D4AA] border border-[#00D4AA]/30 flex items-center gap-1">
              <Award className="w-3 h-3 text-[#00D4AA]" /> COMPLIANCE ENGINE
            </span>
            <span className="text-xs text-slate-400">VendorAuditAI-Inspired Management</span>
          </div>
          <h2 className="text-2xl font-bold text-[#F8FAFC] tracking-tight mt-1">Compliance Framework Manager</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Track and manage vendor compliance across SOC 2, ISO 27001, NIST CSF, PCI DSS, GDPR, DORA, SIG, CAIQ, and CMMC frameworks with automated gap analysis.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-gradient-to-r from-[#00D4AA] to-[#0066FF] hover:from-[#00C4A0] hover:to-[#0056E6] text-white font-semibold text-xs py-3 px-5 rounded-xl shadow-lg shadow-[#00D4AA]/20 flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] self-start md:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add Assessment</span>
        </button>
      </div>

      {/* Overview Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl glass-card border border-white/[0.08] shadow-md card-hover-lift">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Total Assessments</span>
            <ShieldCheck className="w-4 h-4 text-[#00D4AA]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#F8FAFC]">{totalAssessments}</span>
            <span className="text-[11px] text-slate-400">frameworks</span>
          </div>
        </div>

        <div className="p-4 rounded-xl glass-card border border-white/[0.08] shadow-md card-hover-lift">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Avg Compliance</span>
            <TrendingUp className="w-4 h-4 text-[#00C853]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#00C853]">{avgComplianceScore}%</span>
            <span className="text-[11px] text-[#00C853]/80 font-medium">overall</span>
          </div>
        </div>

        <div className="p-4 rounded-xl glass-card border border-white/[0.08] shadow-md card-hover-lift">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Overdue</span>
            <AlertTriangle className="w-4 h-4 text-[#E63946]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#E63946]">{overdueCount}</span>
            <span className="text-[11px] text-[#E63946]/80 font-medium">assessments</span>
          </div>
        </div>

        <div className="p-4 rounded-xl glass-card border border-white/[0.08] shadow-md card-hover-lift">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Frameworks</span>
            <BarChart3 className="w-4 h-4 text-[#0066FF]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#F8FAFC]">{summary.length}</span>
            <span className="text-[11px] text-slate-400">tracked</span>
          </div>
        </div>
      </div>

      {/* Compliance Summary by Framework */}
      <div className="rounded-xl glass-panel border border-white/[0.08] overflow-hidden shadow-lg">
        <div className="p-4 border-b border-white/[0.08] bg-black/20">
          <h3 className="text-sm font-bold text-[#F8FAFC] flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#00D4AA]" />
            Compliance Coverage by Framework
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/[0.08] bg-black/20 text-slate-400 font-semibold">
                <th className="py-3 px-4">Framework</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Vendors</th>
                <th className="py-3 px-4">Avg Score</th>
                <th className="py-3 px-4">Overdue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {summary.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-400 text-xs">
                    <Award className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    No compliance data available. Add your first assessment.
                  </td>
                </tr>
              ) : summary.map((item, idx) => (
                <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3.5 px-4 font-medium text-[#F8FAFC]">{item.framework_name}</td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded-full bg-black/20 text-slate-300 text-[10px] border border-white/[0.08]">
                      {item.framework_type}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-300">{item.vendor_count || 0}</td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-2 bg-black/30 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${item.avg_score >= 80 ? 'bg-[#00C853]' : item.avg_score >= 60 ? 'bg-[#FFB800]' : 'bg-[#E63946]'}`}
                          style={{ width: `${item.avg_score}%` }}
                        />
                      </div>
                      <span className="font-mono text-slate-300">{item.avg_score}%</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    {item.overdue_count > 0 ? (
                      <span className="px-2 py-0.5 rounded-full bg-[#E63946]/20 text-[#E63946] text-[10px] border border-[#E63946]/30 font-medium">
                        {item.overdue_count} Overdue
                      </span>
                    ) : (
                      <span className="text-slate-500 text-[10px]">On Track</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Framework Assessment Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel border border-white/[0.08] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#00D4AA]" />
                <h3 className="text-base font-bold text-[#F8FAFC]">Add Compliance Assessment</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-[#F8FAFC] text-xs font-semibold"
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
                  className="w-full bg-black/20 border border-white/[0.08] rounded-lg p-2.5 text-[#F8FAFC] focus:border-[#00D4AA] focus:outline-none"
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
                  className="w-full bg-black/20 border border-white/[0.08] rounded-lg p-2.5 text-[#F8FAFC] focus:border-[#00D4AA] focus:outline-none"
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
                  className="w-full bg-black/20 border border-white/[0.08] rounded-lg p-2.5 text-[#F8FAFC] focus:border-[#00D4AA] focus:outline-none"
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
                  className="w-full bg-black/20 border border-white/[0.08] rounded-lg p-2.5 text-[#F8FAFC] focus:border-[#00D4AA] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Document Path (Optional)</label>
                <input
                  type="text"
                  placeholder="/uploads/soc2_report.pdf"
                  value={formData.document_path}
                  onChange={(e) => setFormData({ ...formData, document_path: e.target.value })}
                  className="w-full bg-black/20 border border-white/[0.08] rounded-lg p-2.5 text-[#F8FAFC] placeholder-slate-500 focus:border-[#00D4AA] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-black/20 hover:bg-black/30 text-slate-300 rounded-xl text-xs font-semibold border border-white/[0.08]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-gradient-to-r from-[#00D4AA] to-[#0066FF] hover:from-[#00C4A0] hover:to-[#0056E6] text-white font-semibold rounded-xl text-xs shadow-lg shadow-[#00D4AA]/20 flex items-center gap-1.5 disabled:opacity-50"
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

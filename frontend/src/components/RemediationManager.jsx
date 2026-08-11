import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, 
  Plus, 
  Search, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Clock,
  User,
  Target,
  TrendingUp,
  Filter
} from 'lucide-react';

const API_BASE = 'http://localhost:8000';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const STATUSES = ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'];
const SOURCE_TYPES = ['MANUAL', 'INCIDENT', 'COMPLIANCE', 'ASSESSMENT'];

export default function RemediationManager({ vendors }) {
  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    vendor_id: vendors[0]?.id || '',
    title: '',
    description: '',
    priority: 'MEDIUM',
    assigned_to: '',
    due_date: '',
    source_type: 'MANUAL',
    source_reference: null
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchRemediationSummary();
  }, []);

  const fetchRemediationSummary = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/remediation/summary`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary || []);
      }
    } catch (err) {
      console.error("Failed to fetch remediation summary:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!formData.vendor_id || !formData.title.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/vendors/${formData.vendor_id}/remediation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        setIsAddModalOpen(false);
        setFormData({
          vendor_id: vendors[0]?.id || '',
          title: '',
          description: '',
          priority: 'MEDIUM',
          assigned_to: '',
          due_date: '',
          source_type: 'MANUAL',
          source_reference: null
        });
        await fetchRemediationSummary();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    try {
      const res = await fetch(`${API_BASE}/api/remediation/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        await fetchRemediationSummary();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Calculate summary stats
  const totalTasks = summary.reduce((sum, s) => sum + (s.task_count || 0), 0);
  const openTasks = summary.reduce((sum, s) => sum + (s.open_count || 0), 0);
  const inProgressTasks = summary.reduce((sum, s) => sum + (s.in_progress_count || 0), 0);
  const completedTasks = summary.reduce((sum, s) => sum + (s.completed_count || 0), 0);
  const overdueTasks = summary.reduce((sum, s) => sum + (s.overdue_count || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl glass-panel-liquid border border-white/[0.08] shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#00C853]/20 text-[#00C853] border border-[#00C853]/30 flex items-center gap-1">
              <CheckSquare className="w-3 h-3 text-[#00C853]" /> REMEDIATION ENGINE
            </span>
            <span className="text-xs text-slate-400">VendorAuditAI-Inspired Workflow</span>
          </div>
          <h2 className="text-2xl font-bold text-[#F8FAFC] tracking-tight mt-1">Remediation Task Manager</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Track and manage security remediation tasks with SLA tracking, priority handling, and automated task assignment from incidents and compliance gaps.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-gradient-to-r from-[#00C853] to-[#00D4AA] hover:from-[#00B848] hover:to-[#00C4A0] text-white font-semibold text-xs py-3 px-5 rounded-xl shadow-lg shadow-[#00C853]/20 flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] self-start md:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Create Remediation Task</span>
        </button>
      </div>

      {/* Overview Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-4 rounded-xl glass-card border border-white/[0.08] shadow-md card-hover-lift">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Total Tasks</span>
            <CheckSquare className="w-4 h-4 text-[#00C853]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#F8FAFC]">{totalTasks}</span>
            <span className="text-[11px] text-slate-400">tasks</span>
          </div>
        </div>

        <div className="p-4 rounded-xl glass-card border border-white/[0.08] shadow-md card-hover-lift">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Open</span>
            <AlertTriangle className="w-4 h-4 text-[#FFB800]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#FFB800]">{openTasks}</span>
            <span className="text-[11px] text-[#FFB800]/80 font-medium">pending</span>
          </div>
        </div>

        <div className="p-4 rounded-xl glass-card border border-white/[0.08] shadow-md card-hover-lift">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">In Progress</span>
            <Clock className="w-4 h-4 text-[#0066FF]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#0066FF]">{inProgressTasks}</span>
            <span className="text-[11px] text-[#0066FF]/80 font-medium">active</span>
          </div>
        </div>

        <div className="p-4 rounded-xl glass-card border border-white/[0.08] shadow-md card-hover-lift">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-[#00C853]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#00C853]">{completedTasks}</span>
            <span className="text-[11px] text-[#00C853]/80 font-medium">resolved</span>
          </div>
        </div>

        <div className="p-4 rounded-xl glass-card border border-white/[0.08] shadow-md card-hover-lift">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Overdue</span>
            <AlertTriangle className="w-4 h-4 text-[#E63946]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#E63946]">{overdueTasks}</span>
            <span className="text-[11px] text-[#E63946]/80 font-medium">SLA breach</span>
          </div>
        </div>
      </div>

      {/* Remediation Summary by Priority */}
      <div className="rounded-xl bg-slate-900/70 border border-slate-800/80 overflow-hidden shadow-lg">
        <div className="p-4 border-b border-slate-800 bg-slate-950/60">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-400" />
            Task Distribution by Priority
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold">
                <th className="py-3 px-4">Priority Level</th>
                <th className="py-3 px-4">Total Tasks</th>
                <th className="py-3 px-4">Open</th>
                <th className="py-3 px-4">In Progress</th>
                <th className="py-3 px-4">Completed</th>
                <th className="py-3 px-4">Overdue</th>
                <th className="py-3 px-4">Completion Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {summary.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400 text-xs">
                    No remediation tasks tracked yet. Create your first task.
                  </td>
                </tr>
              ) : summary.map((s, idx) => {
                const completionRate = s.task_count > 0 
                  ? Math.round((s.completed_count / s.task_count) * 100) 
                  : 0;
                
                return (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-slate-200">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        s.priority === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' :
                        s.priority === 'HIGH' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                        s.priority === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' :
                        'bg-blue-500/20 text-blue-400 border-blue-500/30'
                      }`}>
                        {s.priority}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">{s.task_count || 0}</td>
                    <td className="py-3.5 px-4 text-slate-300">{s.open_count || 0}</td>
                    <td className="py-3.5 px-4 text-slate-300">{s.in_progress_count || 0}</td>
                    <td className="py-3.5 px-4 text-slate-300">{s.completed_count || 0}</td>
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
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${completionRate >= 75 ? 'bg-emerald-500' : completionRate >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                            style={{ width: `${completionRate}%` }}
                          />
                        </div>
                        <span className="font-mono text-slate-300">{completionRate}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Remediation Task Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-emerald-500" />
                <h3 className="text-base font-bold text-slate-100">Create Remediation Task</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-xs font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Target Vendor *</label>
                <select
                  value={formData.vendor_id}
                  onChange={(e) => setFormData({ ...formData, vendor_id: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:border-emerald-500 focus:outline-none"
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
                <label className="block text-slate-300 font-medium mb-1">Task Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Implement MFA for admin accounts"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Description</label>
                <textarea
                  rows="3"
                  placeholder="Detailed description of the remediation task..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:border-emerald-500 focus:outline-none"
                  >
                    {PRIORITIES.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Source Type</label>
                  <select
                    value={formData.source_type}
                    onChange={(e) => setFormData({ ...formData, source_type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:border-emerald-500 focus:outline-none"
                  >
                    {SOURCE_TYPES.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Assigned To</label>
                  <input
                    type="text"
                    placeholder="email@company.com"
                    value={formData.assigned_to}
                    onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Due Date</label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
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
                  className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-xl text-xs shadow-lg shadow-emerald-950/40 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  ShieldAlert, 
  Award, 
  CheckSquare, 
  Activity,
  Calendar,
  Download,
  Filter,
  Target,
  Globe,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart as RechartsPieChart, Pie as RechartsPie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

const API_BASE = 'http://localhost:8000';

const COLORS = ['#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];

export default function AnalyticsHub({ vendors }) {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');
  const [selectedMetric, setSelectedMetric] = useState('risk');

  // Mock data for analytics (in real app, this would come from API)
  const riskTrendData = [
    { date: 'Jul 13', critical: 2, high: 5, medium: 8, low: 12 },
    { date: 'Jul 20', critical: 3, high: 6, medium: 7, low: 11 },
    { date: 'Jul 27', critical: 2, high: 4, medium: 9, low: 13 },
    { date: 'Aug 3', critical: 4, high: 7, medium: 6, low: 10 },
    { date: 'Aug 10', critical: 3, high: 5, medium: 8, low: 12 },
  ];

  const complianceData = [
    { name: 'SOC 2 Type II', value: 85, color: '#10b981' },
    { name: 'ISO 27001', value: 72, color: '#3b82f6' },
    { name: 'NIST CSF', value: 68, color: '#f59e0b' },
    { name: 'PCI DSS', value: 45, color: '#f43f5e' },
    { name: 'GDPR', value: 78, color: '#8b5cf6' },
  ];

  const riskDistribution = [
    { name: 'Critical', value: vendors.filter(v => v.risk_score >= 70).length, color: '#f43f5e' },
    { name: 'High', value: vendors.filter(v => v.risk_score >= 40 && v.risk_score < 70).length, color: '#f59e0b' },
    { name: 'Medium', value: vendors.filter(v => v.risk_score >= 20 && v.risk_score < 40).length, color: '#3b82f6' },
    { name: 'Low', value: vendors.filter(v => v.risk_score < 20).length, color: '#10b981' },
  ];

  const sectorRiskData = [
    { sector: 'Cloud', avgRisk: 45, vendorCount: 8 },
    { sector: 'Security', avgRisk: 38, vendorCount: 5 },
    { sector: 'Collaboration', avgRisk: 28, vendorCount: 4 },
    { sector: 'Analytics', avgRisk: 32, vendorCount: 3 },
    { sector: 'Identity', avgRisk: 22, vendorCount: 2 },
  ];

  const incidentTrend = [
    { month: 'May', incidents: 12, resolved: 10 },
    { month: 'Jun', incidents: 18, resolved: 15 },
    { month: 'Jul', incidents: 24, resolved: 20 },
    { month: 'Aug', incidents: 15, resolved: 18 },
  ];

  useEffect(() => {
    setLoading(false);
  }, []);

  const criticalVendors = vendors.filter(v => v.risk_score >= 70).length;
  const avgRiskScore = vendors.length > 0 ? Math.round(vendors.reduce((sum, v) => sum + v.risk_score, 0) / vendors.length) : 0;
  const totalIncidents = vendors.reduce((sum, v) => sum + (v.active_incidents || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-cyan-950/20 to-slate-900 border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
              <BarChart3 className="w-3 h-3 text-cyan-400" /> ANALYTICS HUB
            </span>
            <span className="text-xs text-slate-400">VendorAuditAI-Inspired Intelligence</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-100 tracking-tight mt-1">Enterprise Risk Analytics</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Comprehensive risk analytics with compliance coverage, incident trends, and vendor ecosystem intelligence.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:border-cyan-500 focus:outline-none"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="1y">Last Year</option>
          </select>
          <button className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-2 transition-all">
            <Download className="w-3.5 h-3.5" />
            Export Report
          </button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Critical Vendors</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-400">{criticalVendors}</span>
            <span className="text-[11px] text-rose-400/80 font-medium">require attention</span>
          </div>
          <div className="mt-2 text-[10px] text-slate-500">Risk score ≥ 70</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Avg Risk Score</span>
            <Target className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-cyan-400">{avgRiskScore}</span>
            <span className="text-[11px] text-slate-400">/ 100</span>
          </div>
          <div className="mt-2 text-[10px] text-slate-500">Across all vendors</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Active Incidents</span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-400">{totalIncidents}</span>
            <span className="text-[11px] text-amber-400/80 font-medium">open cases</span>
          </div>
          <div className="mt-2 text-[10px] text-slate-500">Requiring resolution</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Compliance Rate</span>
            <Award className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-400">78%</span>
            <span className="text-[11px] text-emerald-400/80 font-medium">avg score</span>
          </div>
          <div className="mt-2 text-[10px] text-slate-500">Across frameworks</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Trend Chart */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              Risk Score Trend
            </h3>
            <span className="text-[10px] text-slate-500">30-day view</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={riskTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', fontSize: '11px' }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Legend />
                <Line type="monotone" dataKey="critical" stroke="#f43f5e" strokeWidth={2} name="Critical" />
                <Line type="monotone" dataKey="high" stroke="#f59e0b" strokeWidth={2} name="High" />
                <Line type="monotone" dataKey="medium" stroke="#3b82f6" strokeWidth={2} name="Medium" />
                <Line type="monotone" dataKey="low" stroke="#10b981" strokeWidth={2} name="Low" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Compliance Framework Pie Chart */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Award className="w-4 h-4 text-violet-400" />
              Compliance Coverage
            </h3>
            <span className="text-[10px] text-slate-500">By framework</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <RechartsPie
                  data={complianceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {complianceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </RechartsPie>
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', fontSize: '11px' }}
                  labelStyle={{ color: '#94a3b8' }}
                />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-[10px]">
            {complianceData.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-slate-400">{item.name}: {item.value}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Distribution Bar Chart */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-rose-400" />
              Risk Distribution
            </h3>
            <span className="text-[10px] text-slate-500">By tier</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', fontSize: '11px' }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {riskDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sector Risk Analysis */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-400" />
              Sector Risk Analysis
            </h3>
            <span className="text-[10px] text-slate-500">By industry</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sectorRiskData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis type="number" stroke="#64748b" fontSize={10} />
                <YAxis dataKey="sector" type="category" stroke="#64748b" fontSize={10} width={80} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', fontSize: '11px' }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Bar dataKey="avgRisk" fill="#3b82f6" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Incident Trend Chart */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-400" />
            Incident vs Resolution Trend
          </h3>
          <span className="text-[10px] text-slate-500">Monthly comparison</span>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={incidentTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" stroke="#64748b" fontSize={10} />
              <YAxis stroke="#64748b" fontSize={10} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', fontSize: '11px' }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Legend />
              <Line type="monotone" dataKey="incidents" stroke="#f43f5e" strokeWidth={2} name="New Incidents" />
              <Line type="monotone" dataKey="resolved" stroke="#10b981" strokeWidth={2} name="Resolved" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

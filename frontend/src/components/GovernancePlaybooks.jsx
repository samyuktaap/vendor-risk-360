import React from 'react';
import { BookOpen, FileCheck, ArrowRight, Layers, Lock, Shield, Settings } from 'lucide-react';

export default function GovernancePlaybooks() {
  const playbooks = [
    {
      title: "AI Vendor Onboarding",
      description: "Standardized workflow for assessing and approving new GenAI vendors.",
      icon: Layers,
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
      border: "border-cyan-500/20",
      steps: 8,
      completed: 0,
      tags: ["Procurement", "Security"]
    },
    {
      title: "Data Privacy Assessment",
      description: "Evaluate data residency, LLM training policies, and PII handling.",
      icon: Lock,
      color: "text-rose-400",
      bg: "bg-rose-500/10",
      border: "border-rose-500/20",
      steps: 12,
      completed: 12,
      tags: ["Privacy", "Legal", "Compliance"]
    },
    {
      title: "Incident Response",
      description: "Playbook for third-party breaches, API token leaks, and system outages.",
      icon: Shield,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
      steps: 5,
      completed: 2,
      tags: ["SecOps", "Critical"]
    },
    {
      title: "Annual SOC 2 Review",
      description: "Automated review cycle for vendor compliance certification renewals.",
      icon: FileCheck,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      steps: 4,
      completed: 0,
      tags: ["Compliance", "Audit"]
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-sky-950/20 to-slate-900 border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center gap-1">
              <BookOpen className="w-3 h-3 text-sky-400" /> GOVERNANCE PLAYBOOKS
            </span>
            <span className="text-xs text-slate-400">Process Automation</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-100 tracking-tight mt-1">Security Workflows</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Guided playbooks for consistent vendor onboarding, assessment, and incident remediation across the enterprise.
          </p>
        </div>
        
        <button className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all shadow-lg shadow-cyan-900/20 flex items-center gap-2">
          <Settings className="w-4 h-4" /> Edit Workflows
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-6">
        {playbooks.map((playbook, idx) => (
          <div key={idx} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors flex flex-col group relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-full h-1 ${playbook.bg}`}></div>
            
            <div className="flex items-start justify-between mb-4">
              <div className={`p-2.5 rounded-xl ${playbook.bg} ${playbook.color} ring-1 ${playbook.border}`}>
                <playbook.icon className="w-5 h-5" />
              </div>
              <div className="flex gap-1 flex-wrap justify-end max-w-[120px]">
                {playbook.tags.map(tag => (
                  <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-300 font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            
            <h3 className="text-base font-bold text-slate-200">{playbook.title}</h3>
            <p className="text-xs text-slate-400 mt-2 flex-1 leading-relaxed">
              {playbook.description}
            </p>
            
            <div className="mt-6 pt-4 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-slate-400 font-medium">Progress</span>
                <span className="text-slate-300 font-bold">{playbook.completed} / {playbook.steps} Steps</span>
              </div>
              <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${playbook.color.replace('text-', 'bg-')} rounded-full`}
                  style={{ width: `${(playbook.completed / playbook.steps) * 100}%` }}
                ></div>
              </div>
              
              <button className="w-full mt-4 flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors">
                {playbook.completed === playbook.steps ? 'Review Results' : 'Continue Playbook'}
                <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

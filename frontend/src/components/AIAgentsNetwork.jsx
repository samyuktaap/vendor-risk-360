import React, { useState } from 'react';
import { Bot, Activity, Brain, ShieldAlert, Cpu, Network, Zap, CheckCircle2, Clock } from 'lucide-react';

export default function AIAgentsNetwork() {
  const [activeAgent, setActiveAgent] = useState('sentinel');

  const agents = [
    {
      id: 'sentinel',
      name: 'Sentinel-X',
      role: 'Continuous Monitoring Agent',
      status: 'active',
      icon: Activity,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
      metrics: { analyzed: '2,451', findings: '142', confidence: '99.8%' },
      description: 'Scans the vendor ecosystem 24/7 for emerging threats, configuration drift, and dark web mentions.'
    },
    {
      id: 'oracle',
      name: 'Oracle-Insight',
      role: 'Document Analysis Agent',
      status: 'active',
      icon: Brain,
      color: 'text-violet-400',
      bgColor: 'bg-violet-500/10',
      borderColor: 'border-violet-500/20',
      metrics: { analyzed: '846 docs', findings: '3,211', confidence: '98.5%' },
      description: 'Processes SOC 2, ISO 27001, and SIG reports using advanced RAG and semantic chunking to extract controls.'
    },
    {
      id: 'guardian',
      name: 'Guardian-Zero',
      role: 'Compliance Mapping Agent',
      status: 'active',
      icon: ShieldAlert,
      color: 'text-rose-400',
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-rose-500/20',
      metrics: { frameworks: '12', mappings: '14,500+', confidence: '99.1%' },
      description: 'Automatically maps extracted vendor controls against 12 major compliance frameworks simultaneously.'
    },
    {
      id: 'nexus',
      name: 'Nexus-Link',
      role: 'Integration & Remediation Agent',
      status: 'active',
      icon: Network,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/20',
      metrics: { actions: '891', resolved: '652', confidence: '97.2%' },
      description: 'Triggers Jira tickets, Slack alerts, and automated remediation workflows based on Sentinel findings.'
    }
  ];

  const currentAgent = agents.find(a => a.id === activeAgent);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/20 to-slate-900 border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center gap-1">
              <Bot className="w-3 h-3 text-indigo-400" /> AI AGENT NETWORK
            </span>
            <span className="text-xs text-slate-400">Autonomous Ecosystem</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-100 tracking-tight mt-1">Multi-Agent Intelligence</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Four specialized AI agents working continuously to monitor, analyze, and secure your vendor supply chain.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs font-medium text-slate-300">All Agents Active</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agent List */}
        <div className="lg:col-span-1 space-y-3">
          {agents.map((agent) => {
            const isActive = activeAgent === agent.id;
            return (
              <button
                key={agent.id}
                onClick={() => setActiveAgent(agent.id)}
                className={`w-full text-left p-4 rounded-xl border transition-all duration-300 ${
                  isActive 
                    ? `bg-slate-800/80 ${agent.borderColor} shadow-lg shadow-${agent.color.split('-')[1]}-900/20` 
                    : 'bg-slate-900/50 border-slate-800/50 hover:bg-slate-800/50 hover:border-slate-700/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${isActive ? agent.bgColor : 'bg-slate-800'} ${isActive ? agent.color : 'text-slate-400'}`}>
                    <agent.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold ${isActive ? 'text-slate-100' : 'text-slate-300'}`}>
                      {agent.name}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">{agent.role}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Agent Detail */}
        <div className="lg:col-span-2">
          <div className="h-full rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl overflow-hidden flex flex-col">
            <div className={`h-2 w-full ${currentAgent.bgColor}`}></div>
            <div className="p-6 flex-1 flex flex-col">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${currentAgent.bgColor} ${currentAgent.color} ring-1 ${currentAgent.borderColor}`}>
                    <currentAgent.icon className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-100">{currentAgent.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-400">{currentAgent.role}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                      <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">
                        <CheckCircle2 className="w-3 h-3" /> Online
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-end">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">LLM Engine</span>
                  <span className="text-xs font-mono text-cyan-400 flex items-center gap-1 mt-0.5">
                    <Cpu className="w-3 h-3" /> Claude Opus 4.5
                  </span>
                </div>
              </div>

              <p className="text-sm text-slate-300 mt-6 leading-relaxed">
                {currentAgent.description}
              </p>

              <div className="grid grid-cols-3 gap-4 mt-8">
                {Object.entries(currentAgent.metrics).map(([key, value]) => (
                  <div key={key} className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/50">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">{key}</div>
                    <div className={`text-xl font-bold mt-1 ${currentAgent.color}`}>{value}</div>
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-6 border-t border-slate-800 flex-1">
                <h4 className="text-xs font-semibold text-slate-400 mb-4 uppercase tracking-wider">Live Activity Log</h4>
                <div className="space-y-3 font-mono text-xs">
                  <div className="flex items-start gap-3">
                    <span className="text-slate-500 w-16 shrink-0">14:02:11</span>
                    <span className="text-cyan-400">[INFO]</span>
                    <span className="text-slate-300">Evaluating third-party risk dependencies...</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-slate-500 w-16 shrink-0">14:02:15</span>
                    <span className="text-emerald-400">[SUCCESS]</span>
                    <span className="text-slate-300">Completed structural analysis of 45 vendors.</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-slate-500 w-16 shrink-0">14:02:18</span>
                    <span className="text-amber-400">[WARN]</span>
                    <span className="text-slate-300">Detected API rate limit approaching for Jira integration. Throttling requests.</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-slate-500 w-16 shrink-0">14:02:22</span>
                    <span className="text-cyan-400">[INFO]</span>
                    <span className="text-slate-300">Awaiting next instruction cycle.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

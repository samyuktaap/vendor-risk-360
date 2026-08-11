import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Building, 
  Globe, 
  FileCheck, 
  Upload, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  Download, 
  LogOut, 
  Sparkles, 
  RefreshCw,
  Send,
  MessageSquare,
  Plus,
  Trash2,
  Share2,
  Check
} from 'lucide-react';
import RiskScoreRing from './RiskScoreRing';

export default function VendorSelfServicePortal({ user, onSignOut }) {
  const [vendorData, setVendorData] = useState(null);
  const [shapData, setShapData] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [remediations, setRemediations] = useState([]);
  const [compliance, setCompliance] = useState([]);
  const [subVendors, setSubVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [newCert, setNewCert] = useState({ name: 'ISO 27001:2022', status: 'Compliant', validity: '2027-12-31' });
  
  // Sub-Vendor Form state
  const [newSub, setNewSub] = useState({ name: '', domain: '', sector: 'Cloud Infrastructure' });
  const [subError, setSubError] = useState('');
  const [subVerifying, setSubVerifying] = useState(false);

  // Q&A Messaging state
  const [message, setMessage] = useState('');
  const [messagesList, setMessagesList] = useState([
    { sender: 'Enterprise CISO', text: 'Please upload updated SOC 2 Type II audit report for Q3.', timestamp: '10:15 AM' },
    { sender: user.name, text: 'We have updated our SSL certs and DMARC enforcement.', timestamp: '10:20 AM' }
  ]);

  useEffect(() => {
    if (user && user.vendorId) {
      fetchVendorDetails();
    }
  }, [user]);

  const fetchVendorDetails = async () => {
    setLoading(true);
    try {
      const [vRes, sRes, iRes, rRes, cRes, subRes] = await Promise.all([
        fetch(`http://localhost:8000/api/vendors/${user.vendorId}`),
        fetch(`http://localhost:8000/api/vendors/${user.vendorId}/shap-risk`),
        fetch(`http://localhost:8000/api/vendors/${user.vendorId}/incidents`),
        fetch(`http://localhost:8000/api/remediation`),
        fetch(`http://localhost:8000/api/compliance?vendor_id=${user.vendorId}`),
        fetch(`http://localhost:8000/api/vendors/${user.vendorId}/sub-vendors`)
      ]);

      if (vRes.ok) setVendorData(await vRes.json());
      if (sRes.ok) setShapData(await sRes.json());
      if (iRes.ok) {
        const iJson = await iRes.json();
        setIncidents(iJson.incidents || []);
      }
      if (rRes.ok) {
        const rJson = await rRes.json();
        setRemediations((rJson || []).filter(item => item.vendor_id === user.vendorId));
      }
      if (cRes.ok) setCompliance(await cRes.json());
      if (subRes.ok) setSubVendors(await subRes.json());
    } catch (err) {
      console.error("Error fetching vendor portal details:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    setMessagesList([...messagesList, {
      sender: user.name,
      text: message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
    setMessage('');
  };

  const handleAddCert = (e) => {
    e.preventDefault();
    setCompliance([...compliance, {
      id: Date.now(),
      framework_name: newCert.name,
      status: newCert.status,
      valid_until: newCert.validity,
      evidence_document: `${newCert.name.replace(/\s+/g, '_')}_Audit.pdf`
    }]);
    setUploadModalOpen(false);
  };

  const handleAddSubVendor = async (e) => {
    e.preventDefault();
    if (!newSub.name.trim() || !newSub.domain.trim()) return;
    setSubVerifying(true);
    setSubError('');

    try {
      const res = await fetch(`http://localhost:8000/api/vendors/${user.vendorId}/sub-vendors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSub)
      });
      const data = await res.json();

      if (res.ok) {
        setSubModalOpen(false);
        setNewSub({ name: '', domain: '', sector: 'Cloud Infrastructure' });
        await fetchVendorDetails();
      } else {
        setSubError(data.detail || "Sub-vendor domain verification failed.");
      }
    } catch (err) {
      setSubError("Failed to connect to verification server.");
    } finally {
      setSubVerifying(false);
    }
  };

  const handleDeleteSubVendor = async (subId) => {
    try {
      const res = await fetch(`http://localhost:8000/api/sub-vendors/${subId}`, { method: 'DELETE' });
      if (res.ok) {
        setSubVendors(subVendors.filter(s => s.id !== subId));
      }
    } catch (err) { console.error(err); }
  };

  const v = vendorData?.vendor;
  const assessment = vendorData?.risk_assessment;
  const score = assessment?.overall_score ?? v?.risk_score ?? 30;

  return (
    <div className="min-h-screen bg-[#070a13] text-slate-100 p-6 space-y-6">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-[#0e172a] via-[#0b1222] to-[#0a1526] border border-cyan-500/20 rounded-3xl p-6 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-black text-xl flex items-center justify-center shadow-lg">
            {user.avatar || 'V'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white tracking-tight">{user.name}</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono font-bold">
                VENDOR SELF-SERVICE PORTAL
              </span>
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-3 mt-1">
              <span className="flex items-center gap-1 text-slate-300"><Globe className="w-3.5 h-3.5 text-cyan-400" /> {user.domain}</span>
              <span>•</span>
              <span>{user.sector}</span>
              <span>•</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Authenticated Vendor</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchVendorDetails}
            className="px-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-xs font-semibold text-slate-200 flex items-center gap-2 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} /> Refresh Status
          </button>

          <button
            onClick={onSignOut}
            className="px-4 py-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-xs font-bold text-rose-300 flex items-center gap-2 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
          Loading Vendor Security Assessment & Sub-Vendor Supply Chain...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1 & 2: Risk Score, SHAP & 4th-Party Sub-Vendors */}
          <div className="lg:col-span-2 space-y-6">
            {/* Live Risk Score Card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl flex items-center justify-between">
              <div className="space-y-2">
                <div className="text-xs uppercase font-bold tracking-wider text-slate-400">
                  Your Live Enterprise Risk Evaluation
                </div>
                <div className="text-3xl font-black text-white flex items-center gap-3">
                  <span>{assessment?.risk_tier || v?.risk_tier} RISK</span>
                  <span className={`text-xs px-3 py-1 rounded-full border ${
                    score >= 70
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : score >= 40
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}>
                    {score >= 70 ? 'High Risk — Action Required' : score >= 40 ? 'Moderate Concern' : 'Excellent Security Posture'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 max-w-md">
                  Calculated dynamically across 7 live threat vectors (Google News, CISA KEV, AbuseIPDB, Stock, SSL, DNS, IPinfo).
                </p>
              </div>

              <RiskScoreRing
                score={score}
                size={110}
                strokeWidth={10}
                breakdown={assessment?.breakdown}
              />
            </div>

            {/* Scikit-Learn & SHAP Feature Drivers for Vendor */}
            {shapData && shapData.status === 'success' && (
              <div className="bg-slate-900/80 border border-emerald-500/20 rounded-3xl p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <Brain className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-100">SHAP Explainable Risk Factors</h3>
                      <p className="text-[10px] text-slate-400">Features impacting your security score rating</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                    ML Score: {shapData.ml_predicted_score} / 100
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-950/60 border border-rose-500/20 rounded-2xl p-4 space-y-2">
                    <div className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-rose-400" />
                      Factors Escalating Your Risk (+ Points)
                    </div>
                    <div className="space-y-2">
                      {shapData.top_risk_drivers && shapData.top_risk_drivers.length > 0 ? (
                        shapData.top_risk_drivers.map((driver, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                            <span className="text-slate-200 font-medium">{driver.label}</span>
                            <span className="font-mono font-bold text-rose-400">+{driver.shap_value} pts</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-slate-500 italic">No significant risk escalators identified.</div>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-950/60 border border-emerald-500/20 rounded-2xl p-4 space-y-2">
                    <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                      <TrendingDown className="w-4 h-4 text-emerald-400" />
                      Protective Security Factors (- Points)
                    </div>
                    <div className="space-y-2">
                      {shapData.protective_factors && shapData.protective_factors.length > 0 ? (
                        shapData.protective_factors.map((factor, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                            <span className="text-slate-200 font-medium">{factor.label}</span>
                            <span className="font-mono font-bold text-emerald-400">{factor.shap_value} pts</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-slate-500 italic">Operating at baseline standard score.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 🕸️ 4th-Party Sub-Vendors (My Upstream Suppliers) */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Share2 className="w-5 h-5 text-cyan-400" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">My Upstream Suppliers (4th-Party Risk)</h3>
                    <p className="text-[10px] text-slate-400">Add & monitor sub-vendors that supply technology or services to {user.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSubModalOpen(true);
                    setSubError('');
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Sub-Supplier
                </button>
              </div>

              <div className="space-y-2">
                {subVendors.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500 border border-dashed border-slate-800 rounded-2xl">
                    No upstream sub-vendors listed. Click 'Add Sub-Supplier' to track your suppliers' security posture.
                  </div>
                ) : (
                  subVendors.map((sub) => (
                    <div key={sub.id} className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center font-bold text-xs text-cyan-400">
                          {sub.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-xs text-slate-100">{sub.name}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2">
                            <span>{sub.domain}</span>
                            <span>•</span>
                            <span>{sub.sector}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-[10px] text-slate-500 uppercase tracking-wider">Sub-Tier Risk</div>
                          <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                            sub.risk_score >= 70 ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' :
                            sub.risk_score >= 40 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                            'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          }`}>
                            Score {sub.risk_score} / 100
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteSubVendor(sub.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                          title="Remove sub-supplier"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Compliance Certificates */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <FileCheck className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-sm font-bold text-slate-100">Compliance & Security Certifications</h3>
                </div>
                <button
                  onClick={() => setUploadModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-cyan-500/20 border border-cyan-500/40 hover:bg-cyan-500/30 text-xs font-bold text-cyan-300 flex items-center gap-1.5 transition-all"
                >
                  <Upload className="w-3.5 h-3.5" /> Submit New Certificate
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {compliance.map((item) => (
                  <div key={item.id} className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-xs text-slate-200">{item.framework_name}</div>
                      <div className="text-[10px] text-slate-400">Valid until {item.valid_until}</div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Column 3: Remediation Tasks & CISO Direct Q&A Channel */}
          <div className="space-y-6">
            {/* Assigned Remediation Tasks */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Enterprise Remediation Tasks
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">
                  {remediations.length} Assigned
                </span>
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {remediations.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500 flex flex-col items-center gap-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                    <span>No outstanding remediation tasks assigned.</span>
                  </div>
                ) : (
                  remediations.map((task) => (
                    <div key={task.id} className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold text-xs text-slate-200">{task.title}</div>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${
                          task.priority === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}>
                          {task.priority}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2">{task.description}</p>
                      <div className="flex items-center justify-between text-[10px] pt-1">
                        <span className="text-slate-500">Due: {task.due_date}</span>
                        <span className="text-cyan-400 font-semibold">{task.status}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Direct Q&A Channel with Enterprise CISO */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-cyan-400" />
                  CISO Direct Q&A Channel
                </h3>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>

              <div className="space-y-3 max-h-56 overflow-y-auto p-2 bg-slate-950/60 border border-slate-800 rounded-2xl">
                {messagesList.map((msg, i) => (
                  <div key={i} className={`p-2.5 rounded-xl text-xs space-y-1 ${
                    msg.sender === user.name
                      ? 'bg-cyan-950/40 border border-cyan-500/30 text-cyan-100 ml-4'
                      : 'bg-slate-900 border border-slate-700 text-slate-200 mr-4'
                  }`}>
                    <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                      <span>{msg.sender}</span>
                      <span>{msg.timestamp}</span>
                    </div>
                    <div>{msg.text}</div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ask security team or reply..."
                  className="flex-1 bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1 transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Upload Certificate Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Upload className="w-5 h-5 text-cyan-400" /> Upload Security Compliance Cert
            </h3>

            <form onSubmit={handleAddCert} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Framework / Standard</label>
                <select
                  value={newCert.name}
                  onChange={(e) => setNewCert({ ...newCert, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100"
                >
                  <option value="SOC 2 Type II">SOC 2 Type II</option>
                  <option value="ISO 27001:2022">ISO 27001:2022</option>
                  <option value="HIPAA Compliance Audit">HIPAA Compliance Audit</option>
                  <option value="PCI-DSS v4.0">PCI-DSS v4.0</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Validity Date</label>
                <input
                  type="date"
                  value={newCert.validity}
                  onChange={(e) => setNewCert({ ...newCert, validity: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Select PDF File</label>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg"
                  className="w-full text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-cyan-500/20 file:text-cyan-300"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400"
                >
                  Upload & Verify
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Sub-Vendor Modal with Domain Verification */}
      {subModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-cyan-400" /> Add Upstream Sub-Supplier (4th Party)
            </h3>

            {subError && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <span>{subError}</span>
              </div>
            )}

            <form onSubmit={handleAddSubVendor} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Sub-Supplier Name</label>
                <input
                  type="text"
                  value={newSub.name}
                  onChange={(e) => setNewSub({ ...newSub, name: e.target.value })}
                  placeholder="e.g. Amazon Web Services"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Domain Name (Domain Verification Active)</label>
                <input
                  type="text"
                  value={newSub.domain}
                  onChange={(e) => setNewSub({ ...newSub, domain: e.target.value })}
                  placeholder="aws.amazon.com"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:border-cyan-400 focus:outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">Domain must exist with active public DNS or HTTPS web server.</p>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Industry Sector</label>
                <input
                  type="text"
                  value={newSub.sector}
                  onChange={(e) => setNewSub({ ...newSub, sector: e.target.value })}
                  placeholder="Cloud Infrastructure"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSubModalOpen(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={subVerifying}
                  className="flex-1 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  {subVerifying ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verifying Domain...
                    </>
                  ) : (
                    'Verify & Add Supplier'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

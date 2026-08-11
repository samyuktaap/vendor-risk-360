import React, { useState } from 'react';
import { X, Building2, Globe, Shield, Plus, RefreshCw, DollarSign, Tag, Award, ChevronDown } from 'lucide-react';

const COMPLIANCE_OPTIONS = [
  'SOC2 Type II', 'SOC2 Type I', 'ISO 27001', 'ISO 27701',
  'GDPR', 'HIPAA', 'PCI-DSS', 'FedRAMP', 'CSA STAR', 'NIST CSF'
];

export default function AddVendorModal({ isOpen, onClose, onVendorAdded }) {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [sector, setSector] = useState('Cloud Infrastructure');
  const [criticalityTier, setCriticalityTier] = useState('Tier 2 - Business Operational');
  const [dataSensitivity, setDataSensitivity] = useState('Public Data');
  const [contractValue, setContractValue] = useState('');
  const [customTicker, setCustomTicker] = useState('');
  const [complianceCerts, setComplianceCerts] = useState(['SOC2 Type II']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const toggleCert = (cert) => {
    setComplianceCerts(prev =>
      prev.includes(cert) ? prev.filter(c => c !== cert) : [...prev, cert]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !domain.trim()) {
      setError('Please fill out vendor name and domain.');
      return;
    }

    const cleanDomain = domain
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .trim();

    if (!cleanDomain.includes('.') || cleanDomain.length < 4) {
      setError('Please enter a valid domain (e.g., datadoghq.com, github.com)');
      return;
    }

    if (customTicker && !/^[A-Za-z]{1,6}$/.test(customTicker.trim())) {
      setError('Stock ticker must be 1–6 letters (e.g., DDOG, MSFT).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('http://localhost:8000/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          domain: cleanDomain,
          sector,
          criticality_tier: criticalityTier,
          data_sensitivity: dataSensitivity,
          contract_value: contractValue ? parseInt(contractValue.replace(/[^0-9]/g, ''), 10) : 0,
          custom_ticker: customTicker.trim().toUpperCase() || null,
          compliance_certs: complianceCerts.join(', ')
        })
      });

      if (res.ok) {
        // Reset all fields
        setName(''); setDomain(''); setSector('Cloud Infrastructure');
        setCriticalityTier('Tier 2 - Business Operational');
        setDataSensitivity('Public Data'); setContractValue('');
        setCustomTicker(''); setComplianceCerts(['SOC2 Type II']);
        onClose();
        if (onVendorAdded) onVendorAdded();
      } else {
        const errJson = await res.json();
        setError(errJson.detail || 'Failed to add vendor.');
      }
    } catch (err) {
      console.error(err);
      setError('Server communication error.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = "w-full bg-slate-900/80 border border-slate-700/60 focus:border-cyan-500/70 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all";
  const labelCls = "block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5";

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-b from-[#0e1626] to-[#080d18] border border-slate-700/50 rounded-2xl w-full max-w-lg shadow-2xl shadow-black/50 overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-700/50 bg-[#0a0f1b]/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm">Onboard Vendor for Monitoring</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Full 7-vector live security assessment</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[78vh] overflow-y-auto custom-scrollbar">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Section: Core Identity */}
          <div className="space-y-3">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pb-1 border-b border-slate-800">
              Core Identity
            </div>

            <div>
              <label className={labelCls}><Building2 className="w-3 h-3 text-cyan-400/70" />Vendor Company Name</label>
              <input type="text" required value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Datadog Inc., Atlassian, Cloudflare"
                className={inputCls} />
            </div>

            <div>
              <label className={labelCls}><Globe className="w-3 h-3 text-cyan-400/70" />Primary Domain Name</label>
              <div className="relative">
                <Globe className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="text" required value={domain} onChange={e => setDomain(e.target.value)}
                  placeholder="datadoghq.com"
                  className={`${inputCls} pl-9 font-mono`} />
              </div>
            </div>

            <div>
              <label className={labelCls}><Tag className="w-3 h-3 text-cyan-400/70" />Industry Sector</label>
              <select value={sector} onChange={e => setSector(e.target.value)} className={inputCls}>
                <option value="Cloud Infrastructure">Cloud Infrastructure &amp; Hosting</option>
                <option value="Identity & Access Management">Identity &amp; Access Management (IAM)</option>
                <option value="Observability & Analytics">Observability &amp; Analytics</option>
                <option value="Endpoint & Network Security">Endpoint &amp; Network Security</option>
                <option value="Enterprise SaaS & Productivity">Enterprise SaaS &amp; Productivity</option>
                <option value="Payment Processing & FinTech">Payment Processing &amp; FinTech</option>
                <option value="Software Supply Chain & CI/CD">Software Supply Chain &amp; CI/CD</option>
                <option value="Data Warehouse & Analytics">Data Warehouse &amp; Analytics</option>
                <option value="HR & People Operations">HR &amp; People Operations</option>
                <option value="Legal & Compliance">Legal &amp; Compliance</option>
                <option value="Marketing & CRM">Marketing &amp; CRM</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Section: Risk Classification */}
          <div className="space-y-3">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pb-1 border-b border-slate-800">
              Risk Classification
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}><Shield className="w-3 h-3 text-violet-400/70" />Criticality Tier</label>
                <select value={criticalityTier} onChange={e => setCriticalityTier(e.target.value)} className={inputCls}>
                  <option value="Tier 1 - Mission Critical">🔴 Tier 1 — Mission Critical</option>
                  <option value="Tier 2 - Business Operational">🟡 Tier 2 — Business Operational</option>
                  <option value="Tier 3 - Low Impact">🟢 Tier 3 — Low Impact</option>
                </select>
              </div>

              <div>
                <label className={labelCls}><Shield className="w-3 h-3 text-amber-400/70" />Data Sensitivity</label>
                <select value={dataSensitivity} onChange={e => setDataSensitivity(e.target.value)} className={inputCls}>
                  <option value="PII / PHI">🔴 PII / PHI (Regulated)</option>
                  <option value="PCI-DSS">🔴 PCI-DSS (Card Data)</option>
                  <option value="Confidential IP">🟠 Confidential IP</option>
                  <option value="Internal Data">🟡 Internal Data</option>
                  <option value="Public Data">🟢 Public Data</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}><DollarSign className="w-3 h-3 text-emerald-400/70" />Annual Contract Value</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
                  <input type="text" value={contractValue}
                    onChange={e => setContractValue(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="250000"
                    className={`${inputCls} pl-7`} />
                </div>
              </div>

              <div>
                <label className={labelCls}><Tag className="w-3 h-3 text-sky-400/70" />Stock Ticker (Optional)</label>
                <input type="text" value={customTicker}
                  onChange={e => setCustomTicker(e.target.value.toUpperCase())}
                  placeholder="e.g. DDOG, SNOW"
                  maxLength={6}
                  className={`${inputCls} font-mono uppercase`} />
              </div>
            </div>
          </div>

          {/* Section: Compliance Certifications */}
          <div className="space-y-3">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pb-1 border-b border-slate-800">
              <span className="flex items-center gap-1.5"><Award className="w-3 h-3 text-yellow-400/70" />Compliance Certifications</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {COMPLIANCE_OPTIONS.map(cert => (
                <button
                  key={cert}
                  type="button"
                  onClick={() => toggleCert(cert)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all ${
                    complianceCerts.includes(cert)
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                      : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {complianceCerts.includes(cert) ? '✓ ' : ''}{cert}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 sticky bottom-0 bg-gradient-to-t from-[#080d18] to-transparent py-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800/80 border border-slate-700/50 text-slate-400 hover:text-slate-200 text-xs font-semibold transition-all">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-cyan-950/50 disabled:opacity-50 transition-all">
              {submitting ? (
                <><RefreshCw className="w-3.5 h-3.5 animate-spin" /><span>Running 7-Vector Assessment...</span></>
              ) : (
                <><Plus className="w-4 h-4" /><span>Calculate Risk &amp; Onboard</span></>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

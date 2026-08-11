import React, { useState } from 'react';
import { X, Building2, Globe, Shield, Plus, RefreshCw, DollarSign, Tag, Award, Sparkles, Search, CheckCircle2 } from 'lucide-react';

const COMPLIANCE_OPTIONS = [
  'SOC2 Type II', 'SOC2 Type I', 'ISO 27001', 'ISO 27701',
  'GDPR', 'HIPAA', 'PCI-DSS', 'FedRAMP', 'CSA STAR', 'NIST CSF'
];

const ALPHABET = ['ALL', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

const PRESET_VENDORS = [
  // A
  { name: 'Adobe Inc.', domain: 'adobe.com', ticker: 'ADBE', sector: 'Enterprise SaaS & Productivity', email: 'security@adobe.com', ip: '192.147.130.100', software: 'Creative Cloud', country: 'US', tier: 'Tier 1 - Mission Critical', data: 'Confidential IP', value: '150000' },
  { name: 'Amazon Web Services (AWS)', domain: 'aws.amazon.com', ticker: 'AMZN', sector: 'Cloud Infrastructure', email: 'aws-security@amazon.com', ip: '54.239.28.85', software: 'AWS Cloud Hosting', country: 'US', tier: 'Tier 1 - Mission Critical', data: 'PII / PHI', value: '500000' },
  { name: 'Atlassian (Jira / Confluence)', domain: 'atlassian.com', ticker: 'TEAM', sector: 'Software Supply Chain & CI/CD', email: 'security@atlassian.com', ip: '13.52.81.1', software: 'Jira Enterprise', country: 'AU', tier: 'Tier 1 - Mission Critical', data: 'Confidential IP', value: '120000' },
  { name: 'Akamai Technologies', domain: 'akamai.com', ticker: 'AKAM', sector: 'Endpoint & Network Security', email: 'security@akamai.com', ip: '23.212.52.41', software: 'Edge DNS / CDN', country: 'US', tier: 'Tier 2 - Business Operational', data: 'Internal Data', value: '90000' },
  { name: 'Apple Inc.', domain: 'apple.com', ticker: 'AAPL', sector: 'Enterprise SaaS & Productivity', email: 'security@apple.com', ip: '17.253.144.10', software: 'Apple Business Manager', country: 'US', tier: 'Tier 2 - Business Operational', data: 'PII / PHI', value: '200000' },

  // B
  { name: 'Box Inc.', domain: 'box.com', ticker: 'BOX', sector: 'Enterprise SaaS & Productivity', email: 'security@box.com', ip: '74.112.184.10', software: 'Box Content Cloud', country: 'US', tier: 'Tier 1 - Mission Critical', data: 'PII / PHI', value: '80000' },
  { name: 'Bitdefender', domain: 'bitdefender.com', ticker: '', sector: 'Endpoint & Network Security', email: 'security@bitdefender.com', ip: '109.166.192.1', software: 'GravityZone EDR', country: 'RO', tier: 'Tier 2 - Business Operational', data: 'Internal Data', value: '45000' },

  // C
  { name: 'Cloudflare Inc.', domain: 'cloudflare.com', ticker: 'NET', sector: 'Endpoint & Network Security', email: 'security@cloudflare.com', ip: '104.16.123.96', software: 'Cloudflare Zero Trust', country: 'US', tier: 'Tier 1 - Mission Critical', data: 'Confidential IP', value: '220000' },
  { name: 'CrowdStrike Falcon', domain: 'crowdstrike.com', ticker: 'CRWD', sector: 'Endpoint & Network Security', email: 'security@crowdstrike.com', ip: '13.57.100.20', software: 'Falcon EDR Sensor', country: 'US', tier: 'Tier 1 - Mission Critical', data: 'PII / PHI', value: '310000' },
  { name: 'Cisco Systems', domain: 'cisco.com', ticker: 'CSCO', sector: 'Endpoint & Network Security', email: 'psirt@cisco.com', ip: '72.163.4.161', software: 'Cisco Duo / Umbrella', country: 'US', tier: 'Tier 1 - Mission Critical', data: 'Confidential IP', value: '400000' },
  { name: 'CyberArk Software', domain: 'cyberark.com', ticker: 'CYBR', sector: 'Identity & Access Management', email: 'security@cyberark.com', ip: '52.20.12.9', software: 'Privileged Access Manager', country: 'IL', tier: 'Tier 1 - Mission Critical', data: 'Confidential IP', value: '180000' },

  // D
  { name: 'Datadog Inc.', domain: 'datadoghq.com', ticker: 'DDOG', sector: 'Observability & Analytics', email: 'security@datadoghq.com', ip: '99.84.210.12', software: 'Datadog Agent', country: 'US', tier: 'Tier 1 - Mission Critical', data: 'Internal Data', value: '175000' },
  { name: 'DocuSign Inc.', domain: 'docusign.com', ticker: 'DOCU', sector: 'Enterprise SaaS & Productivity', email: 'security@docusign.com', ip: '162.248.184.1', software: 'eSignature Cloud', country: 'US', tier: 'Tier 1 - Mission Critical', data: 'PII / PHI', value: '95000' },
  { name: 'Dropbox Inc.', domain: 'dropbox.com', ticker: 'DBX', sector: 'Enterprise SaaS & Productivity', email: 'security@dropbox.com', ip: '162.125.1.1', software: 'Dropbox Business', country: 'US', tier: 'Tier 2 - Business Operational', data: 'Confidential IP', value: '60000' },

  // G
  { name: 'Google Cloud Platform', domain: 'cloud.google.com', ticker: 'GOOGL', sector: 'Cloud Infrastructure', email: 'security@google.com', ip: '142.250.190.46', software: 'GCP Cloud Infrastructure', country: 'US', tier: 'Tier 1 - Mission Critical', data: 'PII / PHI', value: '600000' },
  { name: 'GitHub (Microsoft)', domain: 'github.com', ticker: 'MSFT', sector: 'Software Supply Chain & CI/CD', email: 'support@github.com', ip: '140.82.121.4', software: 'GitHub Enterprise / Actions', country: 'US', tier: 'Tier 1 - Mission Critical', data: 'Confidential IP', value: '180000' },
  { name: 'GitLab Inc.', domain: 'gitlab.com', ticker: 'GTLB', sector: 'Software Supply Chain & CI/CD', email: 'security@gitlab.com', ip: '172.65.251.78', software: 'GitLab Ultimate', country: 'US', tier: 'Tier 1 - Mission Critical', data: 'Confidential IP', value: '95000' },

  // M
  { name: 'Microsoft Corporation', domain: 'microsoft.com', ticker: 'MSFT', sector: 'Cloud Infrastructure', email: 'secure@microsoft.com', ip: '20.112.52.29', software: 'Azure / Office 365', country: 'US', tier: 'Tier 1 - Mission Critical', data: 'PII / PHI', value: '850000' },

  // O
  { name: 'Okta Inc.', domain: 'okta.com', ticker: 'OKTA', sector: 'Identity & Access Management', email: 'security@okta.com', ip: '52.34.12.90', software: 'Okta Identity Cloud', country: 'US', tier: 'Tier 1 - Mission Critical', data: 'PII / PHI', value: '280000' },

  // S
  { name: 'Salesforce Inc.', domain: 'salesforce.com', ticker: 'CRM', sector: 'Enterprise SaaS & Productivity', email: 'security@salesforce.com', ip: '13.110.6.1', software: 'Salesforce CRM Cloud', country: 'US', tier: 'Tier 1 - Mission Critical', data: 'PII / PHI', value: '450000' },
  { name: 'Snowflake Inc.', domain: 'snowflake.com', ticker: 'SNOW', sector: 'Data Warehouse & Analytics', email: 'security@snowflake.com', ip: '54.214.12.1', software: 'Data Cloud Engine', country: 'US', tier: 'Tier 1 - Mission Critical', data: 'PII / PHI', value: '350000' },
  { name: 'Slack (Salesforce)', domain: 'slack.com', ticker: 'CRM', sector: 'Enterprise SaaS & Productivity', email: 'feedback@slack.com', ip: '54.203.20.1', software: 'Slack Enterprise Grid', country: 'US', tier: 'Tier 1 - Mission Critical', data: 'Internal Data', value: '160000' },

  // Z
  { name: 'Zoom Video Communications', domain: 'zoom.us', ticker: 'ZM', sector: 'Enterprise SaaS & Productivity', email: 'security@zoom.us', ip: '170.114.1.1', software: 'Zoom Meetings', country: 'US', tier: 'Tier 2 - Business Operational', data: 'Internal Data', value: '110000' },
  { name: 'Zscaler Inc.', domain: 'zscaler.com', ticker: 'ZS', sector: 'Endpoint & Network Security', email: 'security@zscaler.com', ip: '136.226.0.1', software: 'Zscaler Private Access', country: 'US', tier: 'Tier 1 - Mission Critical', data: 'Confidential IP', value: '240000' }
];

export default function AddVendorModal({ isOpen, onClose, onVendorAdded }) {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [email, setEmail] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [software, setSoftware] = useState('');
  const [country, setCountry] = useState('');
  const [sector, setSector] = useState('Cloud Infrastructure');
  const [criticalityTier, setCriticalityTier] = useState('Tier 2 - Business Operational');
  const [dataSensitivity, setDataSensitivity] = useState('Public Data');
  const [contractValue, setContractValue] = useState('');
  const [customTicker, setCustomTicker] = useState('');
  const [complianceCerts, setComplianceCerts] = useState(['SOC2 Type II']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // A-Z Quick Selector Filter State
  const [selectedLetter, setSelectedLetter] = useState('ALL');
  const [searchPreset, setSearchPreset] = useState('');

  if (!isOpen) return null;

  const toggleCert = (cert) => {
    setComplianceCerts(prev =>
      prev.includes(cert) ? prev.filter(c => c !== cert) : [...prev, cert]
    );
  };

  const selectPresetVendor = (preset) => {
    setName(preset.name);
    setDomain(preset.domain);
    setEmail(preset.email || '');
    setIpAddress(preset.ip || '');
    setSoftware(preset.software || '');
    setCountry(preset.country || '');
    setSector(preset.sector || 'Cloud Infrastructure');
    setCriticalityTier(preset.tier || 'Tier 2 - Business Operational');
    setDataSensitivity(preset.data || 'Public Data');
    setContractValue(preset.value ? String(preset.value) : '');
    setCustomTicker(preset.ticker || '');
    setError('');
  };

  const filteredPresets = PRESET_VENDORS.filter(p => {
    const matchesLetter = selectedLetter === 'ALL' ? true : p.name.toUpperCase().startsWith(selectedLetter);
    const matchesSearch = searchPreset === '' ? true : p.name.toLowerCase().includes(searchPreset.toLowerCase()) || p.domain.toLowerCase().includes(searchPreset.toLowerCase());
    return matchesLetter && matchesSearch;
  });

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

    setSubmitting(true);
    try {
      const res = await fetch('http://localhost:8000/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          domain: cleanDomain,
          email: email.trim() || null,
          ip_address: ipAddress.trim() || null,
          software: software.trim() || null,
          country: country.trim() || null,
          sector,
          criticality_tier: criticalityTier,
          data_sensitivity: dataSensitivity,
          contract_value: contractValue ? parseInt(contractValue.replace(/[^0-9]/g, ''), 10) : 0,
          custom_ticker: customTicker.trim().toUpperCase() || null,
          compliance_certs: complianceCerts.join(', ')
        })
      });

      if (res.ok) {
        setName(''); setDomain(''); setEmail(''); setIpAddress(''); setSoftware(''); setCountry(''); setSector('Cloud Infrastructure');
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

  const inputCls = "w-full bg-[#070a12] border border-emerald-900/30 focus:border-[#00f090]/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-all";
  const labelCls = "block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5";

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0a0f1d] border border-emerald-950/50 rounded-2xl w-full max-w-2xl shadow-2xl shadow-emerald-950/60 overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-emerald-950/50 bg-[#070a12]/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-[#00f090]" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                Onboard Vendor for Monitoring
                <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/20 text-[#00f090] border border-emerald-500/30 uppercase tracking-wide">A-Z Live Directory</span>
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Click any company below or enter custom details for instant multi-vector risk evaluation</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto custom-scrollbar">
          
          {/* A-Z Quick Select Preset Directory */}
          <div className="p-3.5 rounded-xl bg-[#070a12] border border-emerald-900/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#00f090]" />
                ⚡ Instant Auto-Fill Preset Directory (A-Z)
              </span>
              <span className="text-[10px] text-emerald-400 font-mono font-bold">
                {filteredPresets.length} enterprise vendors found
              </span>
            </div>

            {/* Alphabet Buttons */}
            <div className="flex flex-wrap gap-1 items-center max-h-16 overflow-y-auto custom-scrollbar p-1 bg-[#0a0f1d] rounded-lg border border-emerald-950/40">
              {ALPHABET.map(letter => (
                <button
                  key={letter}
                  type="button"
                  onClick={() => { setSelectedLetter(letter); setSearchPreset(''); }}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                    selectedLetter === letter
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                  }`}
                >
                  {letter}
                </button>
              ))}
            </div>

            {/* Vendor Preset Chips */}
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto custom-scrollbar pt-1">
              {filteredPresets.length === 0 ? (
                <span className="text-[11px] text-slate-500 italic p-1">No vendors match current letter filter</span>
              ) : (
                filteredPresets.map(p => (
                  <button
                    key={p.domain}
                    type="button"
                    onClick={() => selectPresetVendor(p)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all flex items-center gap-1.5 ${
                      domain === p.domain
                        ? 'bg-emerald-500/20 border-emerald-400 text-[#00f090] shadow-md'
                        : 'bg-[#0a0f1d] border-emerald-900/30 text-slate-300 hover:bg-slate-800 hover:border-emerald-500/50'
                    }`}
                  >
                    <span>{p.name}</span>
                    <span className="text-[9px] text-slate-400 font-mono">({p.domain})</span>
                    {domain === p.domain && <CheckCircle2 className="w-3 h-3 text-[#00f090]" />}
                  </button>
                ))
              )}
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Section: Core Identity */}
          <div className="space-y-3">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pb-1 border-b border-emerald-950/40">
              Core Identity
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}><Building2 className="w-3 h-3 text-[#00f090]" />Company Name</label>
                <input type="text" required value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. Datadog Inc., Atlassian, Cloudflare"
                  className={inputCls} />
              </div>

              <div>
                <label className={labelCls}><Globe className="w-3 h-3 text-[#00f090]" />Domain Name</label>
                <input type="text" required value={domain} onChange={e => setDomain(e.target.value)}
                  placeholder="datadoghq.com"
                  className={`${inputCls} font-mono`} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Vendor Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="security@vendor.com"
                  className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>IP Address</label>
                <input type="text" value={ipAddress} onChange={e => setIpAddress(e.target.value)}
                  placeholder="e.g. 8.8.8.8"
                  className={inputCls} />
              </div>
            </div>

            <div>
              <label className={labelCls}><Tag className="w-3 h-3 text-[#00f090]" />Industry Sector</label>
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
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pb-1 border-b border-emerald-950/40">
              Risk Classification
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}><Shield className="w-3 h-3 text-violet-400" />Criticality Tier</label>
                <select value={criticalityTier} onChange={e => setCriticalityTier(e.target.value)} className={inputCls}>
                  <option value="Tier 1 - Mission Critical">🔴 Tier 1 — Mission Critical</option>
                  <option value="Tier 2 - Business Operational">🟡 Tier 2 — Business Operational</option>
                  <option value="Tier 3 - Low Impact">🟢 Tier 3 — Low Impact</option>
                </select>
              </div>

              <div>
                <label className={labelCls}><Shield className="w-3 h-3 text-amber-400" />Data Sensitivity</label>
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
                <label className={labelCls}><DollarSign className="w-3 h-3 text-[#00f090]" />Annual Contract Value</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
                  <input type="text" value={contractValue}
                    onChange={e => setContractValue(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="250000"
                    className={`${inputCls} pl-7`} />
                </div>
              </div>

              <div>
                <label className={labelCls}><Tag className="w-3 h-3 text-sky-400" />Stock Ticker (Optional)</label>
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
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pb-1 border-b border-emerald-950/40">
              <span className="flex items-center gap-1.5"><Award className="w-3 h-3 text-amber-400" />Compliance Certifications</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {COMPLIANCE_OPTIONS.map(cert => (
                <button
                  key={cert}
                  type="button"
                  onClick={() => toggleCert(cert)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all ${
                    complianceCerts.includes(cert)
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-[#00f090]'
                      : 'bg-[#0a0f1d] border-emerald-900/30 text-slate-400 hover:border-emerald-700'
                  }`}
                >
                  {complianceCerts.includes(cert) ? '✓ ' : ''}{cert}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 sticky bottom-0 bg-gradient-to-t from-[#0a0f1d] to-transparent py-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800/80 border border-slate-700/50 text-slate-400 hover:text-slate-200 text-xs font-semibold transition-all">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-950/50 disabled:opacity-50 transition-all">
              {submitting ? (
                <><RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-950" /><span>Verifying Domain &amp; Scoring Live Risk...</span></>
              ) : (
                <><Plus className="w-4 h-4 stroke-[3]" /><span>Verify Domain &amp; Onboard</span></>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

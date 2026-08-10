import React, { useState } from 'react';
import { X, Building2, Globe, Shield, Plus, RefreshCw } from 'lucide-react';

export default function AddVendorModal({ isOpen, onClose, onVendorAdded }) {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [sector, setSector] = useState('Cloud Infrastructure');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !domain.trim()) {
      setError('Please fill out vendor name and domain.');
      return;
    }

    // Clean domain
    const cleanDomain = domain
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .trim();

    setSubmitting(true);
    try {
      const res = await fetch('http://localhost:8000/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          domain: cleanDomain,
          sector: sector
        })
      });

      if (res.ok) {
        setName('');
        setDomain('');
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

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0e1626] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 bg-[#0a0f1b] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-slate-100 text-base">Onboard Vendor for Monitoring</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Vendor Company Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Datadog Inc., Atlassian, Cloudflare"
              className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Primary Domain Name</label>
            <div className="relative">
              <Globe className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                required
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="datadoghq.com"
                className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Industry Sector / Category</label>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none"
            >
              <option value="Cloud Infrastructure">Cloud Infrastructure & Hosting</option>
              <option value="Identity & Access Management">Identity & Access Management (IAM)</option>
              <option value="Observability & Analytics">Observability & Analytics</option>
              <option value="Endpoint & Network Security">Endpoint & Network Security</option>
              <option value="Enterprise SaaS & Productivity">Enterprise SaaS & Productivity</option>
              <option value="Payment Processing & FinTech">Payment Processing & FinTech</option>
              <option value="Software Supply Chain & CI/CD">Software Supply Chain & CI/CD</option>
            </select>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-cyan-950/50 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Evaluating Risk...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Calculate Risk & Onboard</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

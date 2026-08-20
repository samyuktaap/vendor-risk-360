import React, { useEffect, useState } from 'react';
import "./ciso/cisoDashboard.css";
import SummaryCards from './ciso/SummaryCards';
import RiskTrendChart from './ciso/RiskTrendChart';
import HighRiskVendorsTable from './ciso/HighRiskVendorsTable';
import ComplianceStatus from './ciso/ComplianceStatus';

const API_BASE = 'http://localhost:8000';

export default function CisoDashboard({ vendors, feed, currentUser, onRefreshVendor, onDeleteVendor, onSelectVendor }) {
  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState([]);
  const [highRisk, setHighRisk] = useState([]);
  const [compliance, setCompliance] = useState(null);

  useEffect(() => {
    // Fetch summary
    fetch(`${API_BASE}/api/vendors/summary`)
      .then(res => (res.ok ? res.json() : Promise.reject('Failed summary')))
      .then(data => setSummary(data))
      .catch(console.error);
    // Fetch trends
    fetch(`${API_BASE}/api/vendors/trends`)
      .then(res => (res.ok ? res.json() : Promise.reject('Failed trends')))
      .then(data => setTrends(data))
      .catch(console.error);
    // Fetch high‑risk vendors
    fetch(`${API_BASE}/api/vendors/highrisk`)
      .then(res => (res.ok ? res.json() : Promise.reject('Failed high‑risk')))
      .then(data => setHighRisk(data))
      .catch(console.error);
    // Fetch compliance status
    fetch(`${API_BASE}/api/vendors/compliance`)
      .then(res => (res.ok ? res.json() : Promise.reject('Failed compliance')))
      .then(data => setCompliance(data))
      .catch(console.error);
  }, []);

  return (
    <div className="ciso-dashboard">
      {summary && <SummaryCards data={summary} />}
      {trends.length > 0 && <RiskTrendChart data={trends} />}
      {highRisk.length > 0 && (
        <HighRiskVendorsTable
          vendors={highRisk}
          onSelect={onSelectVendor}
          onDelete={onDeleteVendor}
        />
      )}
      {compliance && <ComplianceStatus data={compliance} />}
    </div>
  );
}

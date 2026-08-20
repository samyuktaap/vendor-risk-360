import React from 'react';
import './cisoDashboard.css';

export default function ComplianceStatus({ data }) {
  // Simple placeholder showing compliance percentages
  const total = data.total || 0;
  const compliant = data.compliant || 0;
  const nonCompliant = total - compliant;
  const compliantPct = total ? Math.round((compliant / total) * 100) : 0;
  const nonCompliantPct = 100 - compliantPct;

  return (
    <div className="compliance-status card glass p-4 mb-4">
      <h2 className="text-lg font-semibold mb-2">Compliance Overview</h2>
      <div className="flex items-center space-x-4">
        <div className="w-1/2">
          <div className="text-sm opacity-70">Compliant</div>
          <div className="text-2xl font-semibold">{compliantPct}%</div>
        </div>
        <div className="w-1/2">
          <div className="text-sm opacity-70">Non‑Compliant</div>
          <div className="text-2xl font-semibold">{nonCompliantPct}%</div>
        </div>
      </div>
    </div>
  );
}

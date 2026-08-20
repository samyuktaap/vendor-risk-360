import React from 'react';
import './cisoDashboard.css';

export default function HighRiskVendorsTable({ vendors, onSelect, onDelete }) {
  return (
    <div className="high-risk-table card glass p-4 mb-4">
      <h2 className="text-lg font-semibold mb-2">High / Critical Risk Vendors</h2>
      <table className="w-full text-left" style={{borderCollapse: 'collapse'}}>
        <thead className="opacity-70">
          <tr>
            <th className="pb-2">Vendor</th>
            <th className="pb-2">Risk Score</th>
            <th className="pb-2">Risk Level</th>
            <th className="pb-2">Status</th>
            <th className="pb-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {vendors.map(v => (
            <tr key={v.id} className="border-t border-gray-700">
              <td className="py-2 cursor-pointer" onClick={() => onSelect(v.id)}>{v.name}</td>
              <td className="py-2">{v.risk_score}</td>
              <td className="py-2">{v.risk_level}</td>
              <td className="py-2">{v.status || 'N/A'}</td>
              <td className="py-2">
                <button className="text-sm text-indigo-400 hover:underline" onClick={() => onDelete(v.id)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

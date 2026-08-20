import React from 'react';
import './cisoDashboard.css';

export default function SummaryCards({ data }) {
  const cards = [
    { title: 'Total Vendors', value: data.total_vendors, icon: '📦' },
    { title: 'Low Risk', value: data.low_risk, icon: '✅' },
    { title: 'Medium Risk', value: data.medium_risk, icon: '⚠️' },
    { title: 'High / Critical', value: data.high_critical_risk, icon: '🔥' },
    { title: 'Pending Review', value: data.pending_review, icon: '⏳' },
  ];

  return (
    <div className="summary-cards grid grid-cols-1 md:grid-cols-5 gap-4">
      {cards.map((card, idx) => (
        <div key={idx} className="card glass p-4 text-center">
          <div className="icon text-3xl mb-2">{card.icon}</div>
          <div className="title text-sm opacity-80">{card.title}</div>
          <div className="value text-2xl font-semibold mt-1">{card.value}</div>
        </div>
      ))}
    </div>
  );
}

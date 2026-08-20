import React from 'react';
import './cisoDashboard.css';

export default function RiskTrendChart({ data }) {
  // Simple placeholder chart – replace with recharts or chart.js later
  return (
    <div className="risk-trend-chart card glass p-4 mb-4">
      <h2 className="text-lg font-semibold mb-2">Risk Trend (Last 12 months)</h2>
      <div className="chart-placeholder" style={{height: '200px', background: 'rgba(255,255,255,0.1)'}}>
        {/* Placeholder – you can embed a real chart library later */}
        <p className="text-center text-sm opacity-70 pt-8">[Chart will appear here]</p>
      </div>
    </div>
  );
}

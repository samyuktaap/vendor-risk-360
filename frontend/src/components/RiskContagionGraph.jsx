import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Building2, 
  AlertTriangle, 
  ExternalLink, 
  Activity, 
  Layers,
  Filter
} from 'lucide-react';

export default function RiskContagionGraph({ contagionData, onSelectVendor }) {
  const [hoveredNode, setHoveredNode] = useState(null);
  const [filterTier, setFilterTier] = useState('ALL');

  if (!contagionData || !contagionData.nodes) {
    return (
      <div className="p-12 text-center text-slate-400">
        Loading Risk Contagion Topology...
      </div>
    );
  }

  const nodes = contagionData.nodes || [];
  const centerNode = nodes.find(n => n.type === 'organization') || { name: 'Acme HQ' };
  const vendorNodes = nodes.filter(n => n.type === 'vendor');

  const filteredVendors = vendorNodes.filter(v => {
    if (filterTier === 'CRITICAL') return v.risk_score >= 70;
    if (filterTier === 'WATCH') return v.risk_score >= 40 && v.risk_score < 70;
    if (filterTier === 'LOW') return v.risk_score < 40;
    return true;
  });

  // SVG Dimensions & Center Coordinates
  const width = 800;
  const height = 520;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = 190; // Distance of vendor nodes from center HQ

  // Position vendor nodes radially
  const totalCount = filteredVendors.length;
  const positionedVendors = filteredVendors.map((vendor, index) => {
    const angle = (index / (totalCount || 1)) * 2 * Math.PI - Math.PI / 2;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    return { ...vendor, x, y, angle };
  });

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden backdrop-blur-md">
      {/* Topology Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-4 mb-4 border-b border-slate-800 gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            Third-Party Risk Contagion Topology
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Interactive vendor risk propagation network. Red connections indicate high risk infection vector to your enterprise.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-semibold">
            {['ALL', 'CRITICAL', 'WATCH', 'LOW'].map((tier) => (
              <button
                key={tier}
                onClick={() => setFilterTier(tier)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  filterTier === tier
                    ? 'bg-slate-800 text-cyan-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tier}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SVG Canvas & Radial Network Graph */}
      <div className="relative flex justify-center items-center py-4 bg-[#080c14] rounded-xl border border-slate-800/60 shadow-inner">
        <svg width={width} height={height} className="overflow-visible select-none">
          <defs>
            {/* Pulsing Glow Filters */}
            <filter id="glow-rose" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background Concentric Radar Rings */}
          <circle cx={centerX} cy={centerY} r={radius} stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" fill="none" />
          <circle cx={centerX} cy={centerY} r={radius * 0.5} stroke="#131d2e" strokeWidth="1" strokeDasharray="2 2" fill="none" />

          {/* Connecting Pipe Lines */}
          {positionedVendors.map((vendor) => {
            const isHighRisk = vendor.risk_score >= 70;
            const isMediumRisk = vendor.risk_score >= 40 && vendor.risk_score < 70;
            const isHovered = hoveredNode === vendor.id;

            let strokeColor = "#10b981"; // Emerald
            let strokeWidth = "2";
            let dashArray = "none";

            if (isHighRisk) {
              strokeColor = "#f43f5e"; // Rose Red
              strokeWidth = isHovered ? "4" : "3";
              dashArray = "6 6";
            } else if (isMediumRisk) {
              strokeColor = "#f59e0b"; // Amber
              strokeWidth = isHovered ? "3" : "2";
            }

            return (
              <g key={`edge-${vendor.id}`}>
                <line
                  x1={centerX}
                  y1={centerY}
                  x2={vendor.x}
                  y2={vendor.y}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray={dashArray}
                  opacity={isHovered ? 1 : 0.75}
                  className="transition-all duration-300"
                />

                {/* Score badge pill on center line */}
                <g transform={`translate(${(centerX + vendor.x) / 2}, ${(centerY + vendor.y) / 2})`}>
                  <rect
                    x="-16"
                    y="-10"
                    width="32"
                    height="20"
                    rx="10"
                    fill="#0f172a"
                    stroke={strokeColor}
                    strokeWidth="1.5"
                  />
                  <text
                    x="0"
                    y="3"
                    textAnchor="middle"
                    fill={strokeColor}
                    fontSize="10"
                    fontWeight="bold"
                    fontFamily="Inter"
                  >
                    {vendor.risk_score}
                  </text>
                </g>
              </g>
            );
          })}

          {/* Central Organization Node (Your HQ) */}
          <g transform={`translate(${centerX}, ${centerY})`} className="cursor-pointer">
            <circle r="44" fill="#0f172a" stroke="#06b6d4" strokeWidth="3" filter="url(#glow-cyan)" />
            <circle r="36" fill="#162032" stroke="#0891b2" strokeWidth="1.5" />
            <foreignObject x="-30" y="-22" width="60" height="44">
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Building2 className="w-5 h-5 text-cyan-400 mb-0.5" />
                <span className="text-[10px] font-bold text-slate-100 leading-tight">Acme HQ</span>
              </div>
            </foreignObject>
          </g>

          {/* Radial Vendor Nodes */}
          {positionedVendors.map((vendor) => {
            const isHighRisk = vendor.risk_score >= 70;
            const isMediumRisk = vendor.risk_score >= 40 && vendor.risk_score < 70;
            const isHovered = hoveredNode === vendor.id;

            let nodeBorder = "#10b981";
            let nodeBg = "#064e3b";
            let badgeBg = "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";

            if (isHighRisk) {
              nodeBorder = "#f43f5e";
              nodeBg = "#881337";
              badgeBg = "bg-rose-500/20 text-rose-300 border-rose-500/40";
            } else if (isMediumRisk) {
              nodeBorder = "#f59e0b";
              nodeBg = "#78350f";
              badgeBg = "bg-amber-500/20 text-amber-300 border-amber-500/30";
            }

            return (
              <g
                key={`node-${vendor.id}`}
                transform={`translate(${vendor.x}, ${vendor.y})`}
                className="cursor-pointer transition-all duration-300"
                onClick={() => onSelectVendor(vendor.vendor_id)}
                onMouseEnter={() => setHoveredNode(vendor.id)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                {/* High Risk Pulsing Ring */}
                {isHighRisk && (
                  <circle
                    r={isHovered ? 38 : 34}
                    fill="none"
                    stroke="#f43f5e"
                    strokeWidth="2"
                    opacity="0.8"
                    className="animate-ping-slow"
                  />
                )}

                {/* Main Node Circle */}
                <circle
                  r={isHovered ? 32 : 28}
                  fill={nodeBg}
                  stroke={nodeBorder}
                  strokeWidth={isHovered ? "3.5" : "2.5"}
                  className="transition-all duration-200"
                  filter={isHighRisk ? "url(#glow-rose)" : "none"}
                />

                {/* Vendor Icon / Initial */}
                <text
                  x="0"
                  y="4"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize={isHovered ? "14" : "12"}
                  fontWeight="bold"
                  fontFamily="Inter"
                >
                  {vendor.name.charAt(0)}
                </text>

                {/* Vendor Label Card */}
                <foreignObject x="-70" y="34" width="140" height="50">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-2 py-0.5 shadow-lg backdrop-blur-md">
                      <span className="text-[11px] font-semibold text-slate-200 block truncate max-w-[120px]">
                        {vendor.name}
                      </span>
                      <span className={`text-[9px] font-mono font-bold px-1.5 rounded border ${badgeBg}`}>
                        {vendor.risk_score} / 100
                      </span>
                    </div>
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Contagion Topology Legend */}
      <div className="mt-4 flex flex-wrap items-center justify-between text-xs text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50"></span>
            <span className="text-slate-300 font-medium">Critical Contagion Vector (&ge;70)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-500"></span>
            <span className="text-slate-300 font-medium">High Watch (40-69)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
            <span className="text-slate-300 font-medium">Safe Node (&lt;40)</span>
          </div>
        </div>
        <div className="text-[11px] text-slate-400">
          💡 Click any node to open Vendor Risk Intelligence panel
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { Info } from 'lucide-react';

export default function RiskScoreRing({ score, size = 120, strokeWidth = 10, showFormulaTooltip = true, breakdown }) {
  const [showTooltip, setShowTooltip] = useState(false);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  let strokeColor = "#10b981"; // Low risk - Emerald
  let bgGlow = "rgba(16, 185, 129, 0.15)";
  let textColor = "text-emerald-400";
  let tierLabel = "LOW RISK";

  if (score >= 70) {
    strokeColor = "#f43f5e"; // Critical risk - Rose
    bgGlow = "rgba(244, 63, 94, 0.2)";
    textColor = "text-rose-400";
    tierLabel = "CRITICAL RISK";
  } else if (score >= 40) {
    strokeColor = "#f59e0b"; // Medium risk - Amber
    bgGlow = "rgba(245, 158, 11, 0.18)";
    textColor = "text-amber-400";
    tierLabel = "HIGH WATCH";
  } else if (score >= 20) {
    strokeColor = "#fbbf24"; // Moderate
    bgGlow = "rgba(251, 191, 36, 0.15)";
    textColor = "text-yellow-400";
    tierLabel = "MEDIUM";
  }

  return (
    <div className="relative flex flex-col items-center justify-center">
      <div 
        className="relative flex items-center justify-center rounded-full transition-transform duration-300 hover:scale-105"
        style={{ width: size, height: size, background: bgGlow }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#1e293b"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className={`font-bold tracking-tight ${textColor}`} style={{ fontSize: size * 0.28 }}>
            {score}
          </span>
          <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase -mt-1">
            / 100
          </span>
        </div>
      </div>

      {showFormulaTooltip && (
        <div className="mt-2 flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 cursor-pointer transition-colors relative">
          <Info className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[11px] font-medium">5-Vector Risk Formula</span>

          {showTooltip && (
            <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 w-72 p-3.5 bg-slate-900/95 border border-slate-700 rounded-xl shadow-2xl z-50 text-xs backdrop-blur-md pointer-events-none">
              <div className="font-semibold text-slate-200 mb-1 border-b border-slate-800 pb-1 flex justify-between">
                <span>Weighted Security Vectors</span>
                <span className={textColor}>{tierLabel}</span>
              </div>
              <div className="space-y-1 text-slate-300 text-[11px]">
                <div className="flex justify-between">
                  <span>📰 News Sentiment (35%):</span>
                  <span className="font-mono text-cyan-300">{breakdown?.news?.score ?? 0} pts</span>
                </div>
                <div className="flex justify-between">
                  <span>🛡️ HIBP Breaches (25%):</span>
                  <span className="font-mono text-cyan-300">{breakdown?.hibp?.score ?? 0} pts</span>
                </div>
                <div className="flex justify-between">
                  <span>⚖️ Sanctions Hit (15%):</span>
                  <span className="font-mono text-cyan-300">{breakdown?.sanctions?.score ?? 0} pts</span>
                </div>
                <div className="flex justify-between">
                  <span>📈 Stock Volatility (15%):</span>
                  <span className="font-mono text-cyan-300">{breakdown?.stock?.score ?? 0} pts</span>
                </div>
                <div className="flex justify-between">
                  <span>🔒 SSL & Headers (10%):</span>
                  <span className="font-mono text-cyan-300">{breakdown?.ssl?.score ?? 0} pts</span>
                </div>
              </div>
              <div className="mt-2 pt-1 border-t border-slate-800 text-[10px] text-slate-400 italic">
                (News×0.35) + (HIBP×0.25) + (Sanc×0.15) + (Stock×0.15) + (SSL×0.10)
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

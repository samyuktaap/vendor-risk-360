import React, { useState } from 'react';
import { 
  Activity, 
  ShieldAlert, 
  Newspaper, 
  Lock, 
  Scale, 
  ExternalLink, 
  Search, 
  Filter, 
  Radio
} from 'lucide-react';

export default function LiveActivityFeed({ feed = [], onSelectVendor }) {
  const [filterSource, setFilterSource] = useState('ALL');
  const [filterLevel, setFilterLevel] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFeed = feed.filter((item) => {
    const matchesSource = 
      filterSource === 'ALL' ? true :
      filterSource === 'NEWS' ? item.source.includes('News') :
      filterSource === 'HIBP' ? item.source.includes('HIBP') || item.source.includes('Breach') :
      filterSource === 'SANCTIONS' ? item.source.includes('Sanctions') :
      true;

    const matchesLevel = 
      filterLevel === 'ALL' ? true : item.risk_level === filterLevel;

    const matchesSearch = 
      item.vendor_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.summary && item.summary.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesSource && matchesLevel && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Stream Header */}
      <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <h2 className="text-xl font-bold text-slate-100">Live Security Risk Event Feed</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time security signal feed aggregating data breaches, threat news intelligence, and sanctions watchlist matches.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-300 font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          <span>Feed Active &bull; {feed.length} Recent Events</span>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search feed by vendor or event title..."
            className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
            {['ALL', 'NEWS', 'HIBP', 'SANCTIONS'].map((src) => (
              <button
                key={src}
                onClick={() => setFilterSource(src)}
                className={`px-3 py-1 rounded-lg transition-all ${
                  filterSource === src
                    ? 'bg-slate-800 text-cyan-300 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {src}
              </button>
            ))}
          </div>

          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
            {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFilterLevel(lvl)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  filterLevel === lvl
                    ? 'bg-slate-800 text-cyan-300 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Activity Timeline List */}
      <div className="space-y-3">
        {filteredFeed.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs bg-slate-900/40 rounded-2xl border border-slate-800">
            No activity feed items match the active filters.
          </div>
        ) : (
          filteredFeed.map((item) => {
            const isHigh = item.risk_level === 'HIGH';
            const isMedium = item.risk_level === 'MEDIUM';

            return (
              <div
                key={item.id}
                onClick={() => item.vendor_id && onSelectVendor(item.vendor_id)}
                className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors flex items-start gap-4 shadow-md group cursor-pointer"
              >
                {/* Event Icon */}
                <div className={`p-2.5 rounded-xl mt-0.5 ${
                  isHigh ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                  isMedium ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                  'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}>
                  {item.source.includes('News') ? <Newspaper className="w-5 h-5" /> :
                   item.source.includes('HIBP') || item.source.includes('Breach') ? <Lock className="w-5 h-5" /> :
                   item.source.includes('Sanctions') ? <Scale className="w-5 h-5" /> :
                   <Activity className="w-5 h-5" />}
                </div>

                {/* Body */}
                <div className="flex-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-100 group-hover:text-cyan-300 transition-colors">
                        {item.vendor_name}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 font-mono">
                        {item.source}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded border ${
                        isHigh ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' :
                        isMedium ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                        'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      }`}>
                        {item.risk_level} SEVERITY
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                      </span>
                    </div>
                  </div>

                  <h4 className="text-xs font-bold text-slate-200 mt-1.5">{item.title}</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{item.summary}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

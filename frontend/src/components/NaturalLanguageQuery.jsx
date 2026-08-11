import React, { useState } from 'react';
import { MessageSquare, Send, Sparkles, BookOpen, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';

export default function NaturalLanguageQuery() {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I am Oracle-Insight. I have analyzed 846 documents across your vendor ecosystem. What would you like to know?',
      timestamp: new Date().toISOString()
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);

  const handleQuery = (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    // Add user message
    const newMessages = [...messages, { role: 'user', content: query, timestamp: new Date().toISOString() }];
    setMessages(newMessages);
    setQuery('');
    setIsTyping(true);

    // Mock response after delay
    setTimeout(() => {
      setMessages([...newMessages, {
        role: 'assistant',
        content: `Based on the latest SOC 2 Type II report for Stripe (uploaded Oct 12, 2025): Stripe encrypts all data at rest using AES-256 and in transit via TLS 1.2+. Access to production environments requires MFA and is logged continuously.`,
        sources: [
          { name: 'Stripe_SOC2_2025.pdf', page: 42, confidence: '99%' },
          { name: 'Stripe_Security_Addendum.pdf', page: 3, confidence: '95%' }
        ],
        timestamp: new Date().toISOString()
      }]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col space-y-4 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-violet-950/20 to-slate-900 border border-slate-800 shadow-md shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/20 text-violet-400 border border-violet-500/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-violet-400" /> NLQ ENGINE
            </span>
            <span className="text-xs text-slate-400">Powered by Claude Opus</span>
          </div>
          <h2 className="text-lg font-bold text-slate-100 mt-1">Natural Language Query</h2>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
          <BookOpen className="w-3 h-3" />
          <span>846 Indexed Documents</span>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-inner">
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex gap-3 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === 'user' 
                    ? 'bg-cyan-600' 
                    : 'bg-violet-900 border border-violet-500/30 text-violet-300'
                }`}>
                  {msg.role === 'user' ? <span className="text-xs font-bold text-white">ME</span> : <Sparkles className="w-4 h-4" />}
                </div>

                {/* Message Bubble */}
                <div className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`p-4 rounded-2xl text-sm shadow-md ${
                    msg.role === 'user'
                      ? 'bg-cyan-600/20 border border-cyan-500/30 text-cyan-50 rounded-tr-sm'
                      : 'bg-slate-800 border border-slate-700 text-slate-300 rounded-tl-sm'
                  }`}>
                    <p className="leading-relaxed">{msg.content}</p>
                    
                    {/* Sources (if assistant) */}
                    {msg.sources && (
                      <div className="mt-4 pt-3 border-t border-slate-700/50">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 mb-2 block">Cited Sources:</span>
                        <div className="flex flex-wrap gap-2">
                          {msg.sources.map((source, sIdx) => (
                            <div key={sIdx} className="flex items-center gap-1.5 bg-slate-900/50 border border-slate-700 rounded-md px-2 py-1 text-[11px] text-slate-300">
                              <FileText className="w-3 h-3 text-emerald-400" />
                              <span>{source.name}</span>
                              <span className="text-slate-500">|</span>
                              <span className="text-slate-400">Pg {source.page}</span>
                              <span className="text-emerald-400 ml-1 flex items-center"><CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />{source.confidence}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] text-slate-500 mx-1">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-violet-900 border border-violet-500/30 text-violet-300 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-sm p-4 flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Box */}
        <div className="p-4 bg-slate-900 border-t border-slate-800">
          <form onSubmit={handleQuery} className="relative">
            <input 
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about encryption standards, data residency, or specific vendor compliance..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-4 pr-12 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all shadow-inner"
            />
            <button 
              type="submit"
              disabled={!query.trim() || isTyping}
              className="absolute right-2 top-2 p-1.5 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="flex items-center gap-2 mt-2 ml-1">
            <AlertCircle className="w-3 h-3 text-slate-500" />
            <span className="text-[10px] text-slate-500">AI can make mistakes. Always verify critical compliance information.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

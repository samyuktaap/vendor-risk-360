import React, { useState, useEffect } from 'react';
import { 
  Volume2, 
  VolumeX, 
  Play, 
  Pause, 
  RotateCcw, 
  ChevronRight, 
  ChevronLeft, 
  X, 
  ShieldCheck, 
  Activity, 
  Brain, 
  Share2, 
  Building, 
  Sparkles,
  CheckCircle2
} from 'lucide-react';

const TOUR_STEPS = [
  {
    step: 1,
    title: "1. Monitored Enterprise Portfolio & Live API Radar",
    icon: Building,
    badge: "Dashboard Overview",
    color: "from-cyan-500 to-blue-600",
    script: "Welcome to VendorRisk 360! This enterprise dashboard continuously monitors your entire third-party vendor supply chain in real time. The Live API Radar automatically scans threat intelligence feeds and updates risk scores without requiring manual data entry.",
    highlights: [
      "Real-time composite portfolio risk average score",
      "Immediate alert badges for critical risk vendors (scores over 70)",
      "Automated live threat radar background scans"
    ]
  },
  {
    step: 2,
    title: "2. The 7 Live Security & Financial Risk Vectors",
    icon: Activity,
    badge: "Multi-Vector Intelligence",
    color: "from-emerald-500 to-teal-600",
    script: "Our scoring engine evaluates vendors across seven live threat vectors: Google News adverse sentiment, US CISA Known Exploited Vulnerabilities, AbuseIPDB IP reputation, Yahoo Finance stock volatility, HTTPS SSL socket probes, Google Public DNS DMARC and SPF email security, and IPinfo network intelligence.",
    highlights: [
      "25% Adverse Cyber News & Sentiment Analysis",
      "20% US CISA Known Exploited Vulnerability Catalog",
      "15% AbuseIPDB Malicious IP Reputation & 15% Stock Volatility",
      "10% SSL Socket Probes + 10% DMARC Email Enforcement"
    ]
  },
  {
    step: 3,
    title: "3. Scikit-Learn & SHAP Explainability Layer (XAI)",
    icon: Brain,
    badge: "Explainable AI (XAI)",
    color: "from-violet-500 to-purple-600",
    script: "We eliminate black-box risk scoring using Scikit-Learn Random Forest regression paired with SHAP Shapley value attributions. For every vendor, SHAP breaks down exactly which factors escalate risk and which security practices protect the vendor score.",
    highlights: [
      "Machine learning non-linear risk prediction score",
      "Shapley additive feature attribution vectors",
      "Top Risk Drivers (+ points) vs. Protective Factors (- points)"
    ]
  },
  {
    step: 4,
    title: "4. Third-Party Risk Contagion Topology Map",
    icon: Share2,
    badge: "Supply Chain Risk Graph",
    color: "from-amber-500 to-orange-600",
    script: "The Risk Contagion Topology Map visualizes your central organization at the core of a radial network. Glowing red data propagation lines highlight critical vendor dependencies where breach contagion could cascade into your primary network.",
    highlights: [
      "Radial network topology with central organization core",
      "Dynamic color-coded data propagation hazard lines",
      "Instant focus filtering for mission-critical vendors"
    ]
  },
  {
    step: 5,
    title: "5. Vendor Self-Service Portal & 4th-Party Supply Chain",
    icon: ShieldCheck,
    badge: "Vendor Self-Service",
    color: "from-emerald-400 to-cyan-500",
    script: "Third-party vendors can log into their dedicated Vendor Self-Service Portal to view their own SHAP risk factors, upload SOC 2 and ISO 27001 compliance certificates, manage assigned remediation tasks, and monitor their own upstream sub-vendors for fourth-party supply chain risk.",
    highlights: [
      "Dedicated Vendor Self-Service Portal login for suppliers",
      "Upload & verify SOC2, ISO27001, HIPAA compliance certs",
      "Add and monitor upstream 4th-party sub-vendors"
    ]
  }
];

export default function VoiceGuidedDemoModal({ isOpen, onClose }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const step = TOUR_STEPS[currentStepIndex];

  useEffect(() => {
    if (isOpen && !isMuted) {
      speakStepScript(step.script);
    } else {
      stopSpeech();
    }
    return () => stopSpeech();
  }, [currentStepIndex, isOpen]);

  const speakStepScript = (text) => {
    if (!('speechSynthesis' in window)) return;
    stopSpeech();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = isMuted ? 0 : 1.0;

    // Pick English natural voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('David')));
    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeech = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
    }
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.pause();
        setIsPlaying(false);
      }
    } else {
      if ('speechSynthesis' in window) {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
          setIsPlaying(true);
        } else {
          speakStepScript(step.script);
        }
      }
    }
  };

  const handleRestartStep = () => {
    speakStepScript(step.script);
  };

  const handleNext = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  if (!isOpen) return null;

  const IconComp = step.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-[#0e1626] via-[#0a0f1d] to-[#070a14] border border-cyan-500/30 rounded-3xl shadow-2xl overflow-hidden">
        {/* Animated Top Progress Bar */}
        <div className="h-2 bg-slate-800 w-full flex">
          {TOUR_STEPS.map((s, idx) => (
            <div
              key={idx}
              className={`h-full flex-1 transition-all duration-500 ${
                idx <= currentStepIndex ? 'bg-gradient-to-r from-cyan-400 to-emerald-400' : 'bg-slate-800'
              }`}
            />
          ))}
        </div>

        {/* Modal Header */}
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${step.color} text-slate-950 font-black flex items-center justify-center shadow-lg`}>
                <IconComp className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    {step.badge}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">Step {step.step} of 5</span>
                </div>
                <h2 className="text-lg font-black text-white">{step.title}</h2>
              </div>
            </div>

            <button
              onClick={() => {
                stopSpeech();
                onClose();
              }}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Voice Narrator Player Control Bar */}
          <div className="p-3 rounded-2xl bg-slate-900/90 border border-cyan-500/20 flex items-center justify-between gap-3 shadow-inner">
            <div className="flex items-center gap-2">
              <button
                onClick={handleTogglePlay}
                className="w-9 h-9 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-bold flex items-center justify-center shadow-md transition-transform active:scale-95"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>

              <button
                onClick={handleRestartStep}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="Restart Voice Script"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  const nextMuted = !isMuted;
                  setIsMuted(nextMuted);
                  if (nextMuted) stopSpeech();
                  else speakStepScript(step.script);
                }}
                className={`p-2 rounded-xl border transition-colors ${
                  isMuted ? 'bg-rose-500/20 border-rose-500/40 text-rose-300' : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
              </button>
            </div>

            {/* Audio Wave Visualizer Animation */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[10px] font-mono font-bold text-cyan-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                {isPlaying ? 'AUDIO NARRATOR ACTIVE' : isMuted ? 'MUTED' : 'READY'}
              </span>
              {isPlaying && (
                <div className="flex items-center gap-0.5 ml-1">
                  <span className="w-1 h-3 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-4 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              )}
            </div>
          </div>

          {/* Voice Script & Key Highlights */}
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
            <p className="text-xs text-slate-200 leading-relaxed font-medium">
              "{step.script}"
            </p>

            <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Key Capability Highlights</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {step.highlights.map((h, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                    <span>{h}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Step Navigation Bar */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={handlePrev}
              disabled={currentStepIndex === 0}
              className={`px-4 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
                currentStepIndex === 0
                  ? 'opacity-40 cursor-not-allowed bg-slate-900 border-slate-800 text-slate-500'
                  : 'bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-200'
              }`}
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>

            <div className="flex items-center gap-1.5">
              {TOUR_STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentStepIndex(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    i === currentStepIndex ? 'bg-cyan-400 w-6' : 'bg-slate-700 hover:bg-slate-500'
                  }`}
                />
              ))}
            </div>

            {currentStepIndex < TOUR_STEPS.length - 1 ? (
              <button
                onClick={handleNext}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md transition-all"
              >
                Next Step <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => {
                  stopSpeech();
                  onClose();
                }}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md transition-all"
              >
                Complete Tour <CheckCircle2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

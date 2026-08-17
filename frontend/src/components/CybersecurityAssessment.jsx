import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  Save, 
  Send, 
  Plus, 
  Upload, 
  Layers, 
  Lock, 
  Activity,
  Sparkles,
  HelpCircle,
  XCircle,
  FileCheck
} from 'lucide-react';

export default function CybersecurityAssessment({ vendorId, onScoreUpdated }) {
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState({});
  const [expandedDomains, setExpandedDomains] = useState({});
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    if (vendorId) {
      loadAssessment();
    }
  }, [vendorId]);

  const loadAssessment = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch assessments for vendor
      const res = await fetch(`http://localhost:8000/api/vendors/${vendorId}/cybersecurity-assessments`);
      if (res.ok) {
        const data = await res.json();
        const list = data.assessments || [];
        if (list.length > 0) {
          // Fetch the latest assessment detail
          const detailRes = await fetch(`http://localhost:8000/api/cybersecurity-assessments/${list[0].id}`);
          if (detailRes.ok) {
            const detail = await detailRes.json();
            setAssessment(detail);
            populateAnswersMap(detail.answers || []);
            // Expand first domain by default
            if (detail.domains && detail.domains.length > 0) {
              setExpandedDomains({ [detail.domains[0].id]: true });
            }
          }
        } else {
          setAssessment(null);
        }
      } else {
        setAssessment(null);
      }
    } catch (err) {
      console.error("Failed to load cybersecurity assessment:", err);
      setError("Failed to load assessment data.");
    } finally {
      setLoading(false);
    }
  };

  const populateAnswersMap = (ansList) => {
    const map = {};
    ansList.forEach(a => {
      map[a.question_id] = {
        question_id: a.question_id,
        domain: a.domain,
        answer_value: a.answer_value,
        evidence_document_id: a.evidence_document_id,
        evidence_status: a.evidence_status || 'MISSING',
        evidence_notes: a.evidence_notes || ''
      };
    });
    setAnswers(map);
  };

  const handleStartAssessment = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`http://localhost:8000/api/vendors/${vendorId}/cybersecurity-assessments`, {
        method: 'POST'
      });
      if (res.ok) {
        const detail = await res.json();
        setAssessment(detail);
        populateAnswersMap(detail.answers || []);
        if (detail.domains && detail.domains.length > 0) {
          setExpandedDomains({ [detail.domains[0].id]: true });
        }
      } else {
        const errJson = await res.json();
        setError(errJson.detail || "Could not start assessment.");
      }
    } catch (err) {
      console.error("Start assessment error:", err);
      setError("Error connecting to backend server.");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (qId, domain, value) => {
    if (assessment?.status === 'SUBMITTED') return;
    setAnswers(prev => ({
      ...prev,
      [qId]: {
        ...(prev[qId] || {}),
        question_id: qId,
        domain: domain,
        answer_value: value,
        evidence_status: prev[qId]?.evidence_document_id ? (prev[qId]?.evidence_status || 'PRESENT') : 'MISSING'
      }
    }));
  };

  const handleLinkEvidence = (qId, domain, docId) => {
    if (assessment?.status === 'SUBMITTED') return;
    const parsedDocId = docId ? parseInt(docId, 10) : null;
    setAnswers(prev => ({
      ...prev,
      [qId]: {
        ...(prev[qId] || {}),
        question_id: qId,
        domain: domain,
        evidence_document_id: parsedDocId,
        evidence_status: parsedDocId ? 'PRESENT' : 'MISSING'
      }
    }));
  };

  const handleSaveDraft = async () => {
    if (!assessment) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const answersPayload = Object.values(answers);
      const res = await fetch(`http://localhost:8000/api/cybersecurity-assessments/${assessment.id}/answers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answersPayload })
      });
      if (res.ok) {
        const updated = await res.json();
        setAssessment(updated);
        populateAnswersMap(updated.answers || []);
        setSuccessMsg("Draft saved successfully.");
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        const errJson = await res.json();
        setError(errJson.detail || "Failed to save draft.");
      }
    } catch (err) {
      console.error("Save draft error:", err);
      setError("Failed to save draft.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitAssessment = async () => {
    if (!assessment) return;
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      // Save current draft first
      const answersPayload = Object.values(answers);
      await fetch(`http://localhost:8000/api/cybersecurity-assessments/${assessment.id}/answers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answersPayload })
      });

      // Submit assessment
      const res = await fetch(`http://localhost:8000/api/cybersecurity-assessments/${assessment.id}/submit`, {
        method: 'POST'
      });

      if (res.ok) {
        const finalAssessment = await res.json();
        setAssessment(finalAssessment);
        populateAnswersMap(finalAssessment.answers || []);
        setSuccessMsg("Cybersecurity 360° Assessment submitted successfully!");
        if (onScoreUpdated) onScoreUpdated();
      } else {
        const errJson = await res.json();
        setError(errJson.detail || "Failed to submit assessment.");
      }
    } catch (err) {
      console.error("Submit error:", err);
      setError("Failed to submit assessment.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleDomain = (domainId) => {
    setExpandedDomains(prev => ({ ...prev, [domainId]: !prev[domainId] }));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 space-y-3">
        <Clock className="w-8 h-8 animate-spin text-cyan-400" />
        <span className="text-xs">Loading Cybersecurity 360° Assessment module...</span>
      </div>
    );
  }

  // State 1: No assessment created yet
  if (!assessment) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto text-cyan-400">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-100">Cybersecurity 360° Assessment</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            No Cybersecurity 360° assessment yet. Evaluate this vendor across 12 mandatory security controls including IAM, Data Protection, WAF, Incident Response, and BCP.
          </p>
        </div>
        <button
          onClick={handleStartAssessment}
          className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2 mx-auto"
        >
          <Plus className="w-4 h-4" /> Start Cybersecurity 360° Assessment
        </button>
      </div>
    );
  }

  const catalog = assessment.questions_catalog || [];
  const domains = assessment.domains || [];
  const isSubmitted = assessment.status === 'SUBMITTED';

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
              Cybersecurity 360° Assessment
            </h3>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
              isSubmitted 
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
            }`}>
              {isSubmitted ? 'SUBMITTED' : 'DRAFT IN PROGRESS'}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            {isSubmitted 
              ? `Submitted on ${new Date(assessment.submitted_at).toLocaleDateString()} · Scoring Engine v${assessment.scoring_version}`
              : `Last updated: ${new Date(assessment.updated_at).toLocaleTimeString()}`}
          </p>
        </div>

        {isSubmitted ? (
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 px-5 flex items-center gap-4">
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Cybersecurity Score</div>
              <div className="text-2xl font-black font-mono text-cyan-400">
                {assessment.cybersecurity_score !== undefined ? assessment.cybersecurity_score : 0}
                <span className="text-xs text-slate-500 font-normal"> / 100</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveDraft}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-xs text-slate-200 font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              onClick={handleSubmitAssessment}
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {submitting ? 'Submitting...' : 'Submit Assessment'}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 12 Cybersecurity Domains Accordion List */}
      <div className="space-y-3">
        {domains.map(dom => {
          const domQuestions = catalog.filter(q => q.domain === dom.id);
          const isExpanded = !!expandedDomains[dom.id];
          const domainScoreObj = assessment.domain_scores ? assessment.domain_scores[dom.id] : null;
          const domainScore = domainScoreObj ? domainScoreObj.score : null;

          return (
            <div key={dom.id} className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
              {/* Domain Bar Header */}
              <div 
                onClick={() => toggleDomain(dom.id)}
                className="p-4 bg-slate-900/90 hover:bg-slate-800/80 cursor-pointer flex items-center justify-between transition-colors border-b border-slate-800/50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 text-xs font-bold font-mono">
                    {domQuestions.length}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">{dom.title}</h4>
                    <p className="text-[10px] text-slate-400">{dom.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {isSubmitted && domainScore !== null && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-400 font-mono text-[10px]">Risk Score:</span>
                      <span className={`font-mono font-bold px-2 py-0.5 rounded ${
                        domainScore >= 70 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                        domainScore >= 40 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                        'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {domainScore} / 100
                      </span>
                    </div>
                  )}
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </div>

              {/* Questions List */}
              {isExpanded && (
                <div className="p-4 space-y-5 bg-[#0a0f1d]">
                  {domQuestions.map(q => {
                    const ans = answers[q.question_id] || {};
                    const currentVal = ans.answer_value || '';
                    const evStatus = ans.evidence_status || 'MISSING';
                    const evDocId = ans.evidence_document_id || '';

                    return (
                      <div key={q.question_id} className="p-4 bg-slate-900/50 border border-slate-800/80 rounded-xl space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider">{q.question_id}</span>
                            <p className="text-xs font-semibold text-slate-200 leading-relaxed">{q.question_text}</p>
                          </div>
                          {q.required && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
                              REQUIRED
                            </span>
                          )}
                        </div>

                        {/* Input Control */}
                        <div className="pt-1">
                          {q.response_type === 'YES_NO' && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={isSubmitted}
                                onClick={() => handleAnswerChange(q.question_id, dom.id, 'YES')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                  currentVal === 'YES'
                                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                                    : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                YES (Control Active)
                              </button>
                              <button
                                type="button"
                                disabled={isSubmitted}
                                onClick={() => handleAnswerChange(q.question_id, dom.id, 'NO')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                  currentVal === 'NO'
                                    ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                                    : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                NO (Control Absent)
                              </button>
                            </div>
                          )}

                          {q.response_type === 'MULTIPLE_CHOICE' && (
                            <div className="space-y-1.5">
                              {(q.options || []).map((opt, idx) => (
                                <label key={idx} className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                                  currentVal === opt.value
                                    ? 'bg-cyan-500/15 border-cyan-500/40 text-slate-100 font-semibold'
                                    : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:text-slate-300'
                                }`}>
                                  <input
                                    type="radio"
                                    name={q.question_id}
                                    disabled={isSubmitted}
                                    checked={currentVal === opt.value}
                                    onChange={() => handleAnswerChange(q.question_id, dom.id, opt.value)}
                                    className="text-cyan-500 focus:ring-0"
                                  />
                                  <span>{opt.label}</span>
                                </label>
                              ))}
                            </div>
                          )}

                          {q.response_type === 'TEXT' && (
                            <textarea
                              rows={2}
                              disabled={isSubmitted}
                              value={currentVal}
                              onChange={(e) => handleAnswerChange(q.question_id, dom.id, e.target.value)}
                              placeholder="Specify implementation details or control references..."
                              className="w-full rounded-lg bg-slate-950 border border-slate-800 p-2.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                            />
                          )}
                        </div>

                        {/* Evidence Controls & Status */}
                        {q.evidence_required && (
                          <div className="mt-3 pt-3 border-t border-slate-800/60 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-950/40 p-2.5 rounded-lg">
                            <div className="flex items-center gap-2">
                              <FileText className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-[11px] text-slate-400 font-medium">Evidence Verification:</span>
                              
                              {/* Evidence Status Badge */}
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 ${
                                evStatus === 'REVIEWED' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                                evStatus === 'PRESENT' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' :
                                evStatus === 'REJECTED' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' :
                                'bg-slate-800 text-slate-400 border-slate-700'
                              }`}>
                                {evStatus === 'REVIEWED' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                                {evStatus === 'PRESENT' && <FileCheck className="w-3 h-3 text-cyan-400" />}
                                {evStatus === 'REJECTED' && <XCircle className="w-3 h-3 text-rose-400" />}
                                {evStatus === 'MISSING' && <HelpCircle className="w-3 h-3 text-slate-400" />}
                                {evStatus === 'MISSING' ? 'Evidence missing.' : `Evidence ${evStatus}`}
                              </span>
                            </div>

                            {!isSubmitted && (
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  placeholder="Linked Doc ID"
                                  value={evDocId}
                                  onChange={(e) => handleLinkEvidence(q.question_id, dom.id, e.target.value)}
                                  className="w-28 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

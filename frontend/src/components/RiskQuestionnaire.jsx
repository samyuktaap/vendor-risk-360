import React, { useState, useEffect } from 'react';
import { RefreshCw, Save, Send, AlertTriangle, CheckCircle2 } from 'lucide-react';

const QUESTIONS = [
  { id: 'q1', category: 'CYBERSECURITY', type: 'YES_NO', text: 'Does the vendor have a formal incident response plan?', required: true },
  { id: 'q2', category: 'CYBERSECURITY', type: 'YES_NO', text: 'Is Multi-Factor Authentication (MFA) enforced for all access?', required: true },
  { id: 'q3', category: 'COMPLIANCE', type: 'YES_NO', text: 'Does the vendor hold a valid SOC 2 Type II certification?', required: true },
  { id: 'q4', category: 'COMPLIANCE', type: 'MULTIPLE_CHOICE', text: 'How often are compliance audits conducted?', required: true, options: ['Annually', 'Bi-annually', 'Rarely', 'Never'] },
  { id: 'q5', category: 'FINANCIAL_STABILITY', type: 'YES_NO', text: 'Has the vendor experienced bankruptcy or severe financial distress in the last 5 years?', required: true },
  { id: 'q6', category: 'OPERATIONAL_RISK', type: 'YES_NO', text: 'Is there a documented Business Continuity Plan (BCP)?', required: true },
  { id: 'q7', category: 'DATA_PRIVACY', type: 'YES_NO', text: 'Does the vendor process PII/PHI data?', required: true },
  { id: 'q8', category: 'DATA_PRIVACY', type: 'TEXT', text: 'Describe the data encryption standards used at rest and in transit.', required: false }
];

export default function RiskQuestionnaire({ vendorId, userRole, onScoreUpdated }) {
  const [assessmentId, setAssessmentId] = useState(null);
  const [status, setStatus] = useState(null); // 'DRAFT', 'SUBMITTED'
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [scoreData, setScoreData] = useState(null);

  // Load draft or active assessment from sessionStorage
  useEffect(() => {
    const fetchAssessment = async () => {
      const storedId = sessionStorage.getItem(`vendor_${vendorId}_assessment_id`);
      if (storedId) {
        try {
          const res = await fetch(`http://localhost:8000/api/assessments/${storedId}`);
          if (res.ok) {
            const data = await res.json();
            setAssessmentId(data.assessment.id);
            setStatus(data.assessment.status);
            
            // Map answers to object
            const ansObj = {};
            data.answers.forEach(a => {
              ansObj[a.question_id] = a.answer_value;
            });
            setAnswers(ansObj);

            if (data.assessment.status === 'SUBMITTED') {
              fetchScore(vendorId);
            }
          } else if (res.status === 404) {
            sessionStorage.removeItem(`vendor_${vendorId}_assessment_id`);
          } else if (res.status === 401 || res.status === 403) {
            setError("Unauthorized access or expired session.");
          }
        } catch (err) {
          setError("Failed to connect to backend API.");
        }
      }
      setLoading(false);
    };
    fetchAssessment();
  }, [vendorId]);

  const fetchScore = async (vId) => {
    try {
      const res = await fetch(`http://localhost:8000/api/vendors/${vId}/risk-score`);
      if (res.ok) {
        const data = await res.json();
        setScoreData(data);
      }
    } catch (err) {
      console.error("Failed to fetch score", err);
    }
  };

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`http://localhost:8000/api/assessments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor_id: vendorId })
      });
      if (res.ok) {
        const data = await res.json();
        setAssessmentId(data.assessment_id);
        setStatus('DRAFT');
        sessionStorage.setItem(`vendor_${vendorId}_assessment_id`, data.assessment_id);
      } else if (res.status === 401 || res.status === 403) {
        setError("Unauthorized access or expired session.");
      } else {
        setError("Failed to start assessment.");
      }
    } catch (err) {
      setError("Failed to connect to backend API.");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (qId, value) => {
    setAnswers(prev => ({ ...prev, [qId]: value }));
    if (validationErrors[qId]) {
      setValidationErrors(prev => {
        const newErrs = { ...prev };
        delete newErrs[qId];
        return newErrs;
      });
    }
    setSuccessMsg(null);
  };

  const buildPayload = () => {
    return QUESTIONS.map(q => ({
      question_id: q.id,
      category: q.category,
      answer_value: answers[q.id] || ''
    })).filter(a => a.answer_value !== '');
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    setSuccessMsg(null);
    setError(null);
    try {
      const payload = { answers: buildPayload() };
      const res = await fetch(`http://localhost:8000/api/assessments/${assessmentId}/answers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setSuccessMsg("Draft saved successfully.");
      } else {
        const errData = await res.json();
        setError(errData.detail || "Failed to save draft.");
      }
    } catch (err) {
      setError("Failed to connect to backend API.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    // Validate required questions
    const errs = {};
    QUESTIONS.forEach(q => {
      if (q.required && !answers[q.id]) {
        errs[q.id] = "This question is required.";
      }
    });

    if (Object.keys(errs).length > 0) {
      setValidationErrors(errs);
      setError("Please answer all required questions.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      // 1. Save latest answers
      const payload = { answers: buildPayload() };
      const saveRes = await fetch(`http://localhost:8000/api/assessments/${assessmentId}/answers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!saveRes.ok) {
        throw new Error("Failed to save final answers before submission.");
      }

      // 2. Submit
      const subRes = await fetch(`http://localhost:8000/api/assessments/${assessmentId}/submit`, {
        method: 'POST'
      });

      if (!subRes.ok) {
        throw new Error("Failed to submit assessment.");
      }

      // 3. Calculate Score
      const scoreRes = await fetch(`http://localhost:8000/api/assessments/${assessmentId}/calculate-score`, {
        method: 'POST'
      });

      if (scoreRes.ok) {
        setStatus('SUBMITTED');
        const scoreDataResult = await scoreRes.json();
        setScoreData(scoreDataResult);
        if (onScoreUpdated) onScoreUpdated();
      } else {
        throw new Error("Assessment submitted, but score calculation failed.");
      }
    } catch (err) {
      setError(err.message || "Failed to submit assessment.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin text-cyan-400 mr-2" />
        Loading Questionnaire...
      </div>
    );
  }

  const isReadOnly = status === 'SUBMITTED' || userRole === 'AUDITOR';

  // Group questions by category
  const groupedQuestions = QUESTIONS.reduce((acc, q) => {
    if (!acc[q.category]) acc[q.category] = [];
    acc[q.category].push(q);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm flex items-start gap-2">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {!assessmentId ? (
        <div className="text-center p-8 bg-slate-900 border border-slate-800 rounded-xl">
          <h3 className="text-lg font-bold text-slate-200 mb-2">Security Risk Assessment</h3>
          <p className="text-slate-400 text-sm mb-6">Start a new comprehensive risk assessment for this vendor.</p>
          {userRole !== 'AUDITOR' ? (
            <button
              onClick={handleStart}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg transition-colors"
            >
              Start Assessment
            </button>
          ) : (
            <div className="text-slate-500 text-sm italic">Auditors cannot create new assessments.</div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-slate-900 p-4 border border-slate-800 rounded-xl flex-wrap gap-4">
            <div>
              <div className="text-sm text-slate-400 font-medium uppercase tracking-wider">Assessment Status</div>
              <div className={`text-lg font-bold ${status === 'SUBMITTED' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {status}
              </div>
            </div>
            {status === 'SUBMITTED' && scoreData && (
              <div className="text-right">
                <div className="text-sm text-slate-400 font-medium uppercase tracking-wider">Risk Level / Score</div>
                <div className="text-lg font-bold text-white">
                  <span className={scoreData.risk_level === 'HIGH' ? 'text-rose-400' : scoreData.risk_level === 'MEDIUM' ? 'text-amber-400' : 'text-emerald-400'}>
                    {scoreData.risk_level}
                  </span>
                  {' '} / {scoreData.total_score.toFixed(1)}
                </div>
              </div>
            )}
          </div>

          {status === 'SUBMITTED' && scoreData && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {Object.entries(scoreData.categories).map(([cat, val]) => (
                <div key={cat} className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">{cat.replace('_', ' ')}</div>
                  <div className="text-sm font-bold text-cyan-400">{val.toFixed(0)}</div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-8">
            {Object.entries(groupedQuestions).map(([category, questions], cIdx) => (
              <div key={category} className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                <div className="bg-slate-800/50 px-4 py-3 border-b border-slate-800">
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">{category.replace('_', ' ')}</h3>
                </div>
                <div className="p-4 space-y-6">
                  {questions.map((q, idx) => (
                    <div key={q.id} className="space-y-2">
                      <div className="flex gap-2">
                        <span className="text-slate-500 font-medium text-sm w-6">{idx + 1}.</span>
                        <div className="flex-1">
                          <label className="text-sm font-medium text-slate-300">
                            {q.text} {q.required && <span className="text-rose-500">*</span>}
                          </label>
                          {validationErrors[q.id] && (
                            <div className="text-xs text-rose-400 mt-1">{validationErrors[q.id]}</div>
                          )}
                          <div className="mt-2">
                            {q.type === 'YES_NO' && (
                              <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input 
                                    type="radio" 
                                    name={q.id} 
                                    value="YES"
                                    checked={answers[q.id] === 'YES'}
                                    onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                    disabled={isReadOnly}
                                    className="text-cyan-500 bg-slate-800 border-slate-700"
                                  />
                                  <span className="text-sm text-slate-400">Yes</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input 
                                    type="radio" 
                                    name={q.id} 
                                    value="NO"
                                    checked={answers[q.id] === 'NO'}
                                    onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                    disabled={isReadOnly}
                                    className="text-cyan-500 bg-slate-800 border-slate-700"
                                  />
                                  <span className="text-sm text-slate-400">No</span>
                                </label>
                              </div>
                            )}
                            
                            {q.type === 'MULTIPLE_CHOICE' && (
                              <select 
                                value={answers[q.id] || ''}
                                onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                disabled={isReadOnly}
                                className="w-full max-w-sm bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-cyan-500 transition-colors"
                              >
                                <option value="" disabled>Select an option...</option>
                                {q.options.map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            )}

                            {q.type === 'TEXT' && (
                              <textarea 
                                value={answers[q.id] || ''}
                                onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                disabled={isReadOnly}
                                rows={3}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-cyan-500 transition-colors placeholder-slate-600"
                                placeholder="Enter your response..."
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {!isReadOnly && (
            <div className="flex items-center justify-end gap-4 pt-4 border-t border-slate-800">
              <button
                onClick={handleSaveDraft}
                disabled={saving || submitting}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Draft
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || submitting}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Submit Assessment
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

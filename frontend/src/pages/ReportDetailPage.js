import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import RoadDamageOverlay, { DetectionSummary } from '../components/common/RoadDamageOverlay';

const API = process.env.REACT_APP_API_URL || '/api';

export default function ReportDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const chatEndRef = useRef();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState([
    { role: 'ai', text: '👋 Hi! I\'m PotholeVision AI Assistant powered by Groq LLaMA3. Ask me anything about this road hazard, safety precautions, or road maintenance.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => { fetchReport(); }, [id]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const fetchReport = async () => {
    try {
      const { data } = await axios.get(`/reports/${id}`);
      setReport(data.report);
    } catch {
      toast.error('Report not found');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const sendChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const q = chatInput.trim();
    setChatMessages(p => [...p, { role: 'user', text: q }]);
    setChatInput('');
    setChatLoading(true);
    try {
      const { data } = await axios.post('/ai/chat', { question: q, reportId: id });
      setChatMessages(p => [...p, { role: 'ai', text: data.answer }]);
    } catch {
      setChatMessages(p => [...p, { role: 'ai', text: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const downloadPDF = async () => {
    setPdfLoading(true);
    try {
      const token = localStorage.getItem('pv_token');
      const response = await fetch(`${API}/pdf/report/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('PDF generation failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PotholeVision-${report.reportId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('📄 PDF downloaded!');
    } catch {
      toast.error('PDF generation failed');
    } finally {
      setPdfLoading(false);
    }
  };

  const upvote = async () => {
    try {
      const { data } = await axios.post(`/reports/${id}/upvote`);
      setReport(p => ({ ...p, upvotes: data.upvotes }));
    } catch { toast.error('Could not upvote'); }
  };

  if (loading) return <div className="fullscreen-loader"><div className="spinner" /></div>;
  if (!report) return null;

  const ai = report.aiAnalysis || {};
  const sevColors = { critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#16a34a' };
  const sevColor = sevColors[ai.severityLevel] || '#1a56db';

  const quickQuestions = [
    'What caused this damage?',
    'How urgent is the repair?',
    'What are the environmental impacts?',
    'How can drivers stay safe?',
  ];

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Back</button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>Report: {report.reportId}</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
              Submitted {new Date(report.createdAt).toLocaleString('en-IN')}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={upvote}>👍 {report.upvotes}</button>
          <button className="btn btn-primary btn-sm" onClick={downloadPDF} disabled={pdfLoading}>
            {pdfLoading ? <><span className="spinner spinner-sm" /> Generating...</> : '📄 Download PDF'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }}>
        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Image + real YOLO detection overlay */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">🖼️ Road Image & AI Detections</div>
              <span className="ai-badge">YOLOv8s</span>
            </div>
            <div style={{ position: 'relative' }}>
              <RoadDamageOverlay
                imageUrl={report.imageUrl}
                detections={ai.detectedIssues || []}
                alt="Road hazard with AI detection boxes"
              />
              <div style={{
                position: 'absolute', top: 10, right: 10,
                background: sevColor, color: 'white',
                padding: '4px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.05em'
              }}>
                {ai.severityLevel}
              </div>
            </div>
            <div className="card-body">
              <DetectionSummary detections={ai.detectedIssues || []} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                <span className={`badge badge-${report.status?.replace(' ', '_')}`}>
                  {report.status === 'pending' ? '⏳ Pending' : report.status === 'in_progress' ? '🔧 In Progress' : report.status === 'resolved' ? '✅ Resolved' : '❌ Rejected'}
                </span>
                <span className={`badge badge-${ai.severityLevel}`}>{ai.severityLevel}</span>
                <span className="badge badge-blue">{(ai.primaryIssue || 'unknown').replace('_', ' ')}</span>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="card">
            <div className="card-header"><div className="card-title">📍 Location Details</div></div>
            <div className="card-body">
              {[
                { label: 'Address', val: report.location?.address || 'Not provided' },
                { label: 'City', val: report.location?.city || 'N/A' },
                { label: 'State', val: report.location?.state || 'N/A' },
                { label: 'Coordinates', val: `${report.location?.coordinates?.[1]?.toFixed(5)}, ${report.location?.coordinates?.[0]?.toFixed(5)}` },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', gap: 12, marginBottom: 10, fontSize: 13 }}>
                  <span style={{ minWidth: 90, color: 'var(--text-muted)', fontWeight: 500 }}>{row.label}</span>
                  <span style={{ color: 'var(--text-primary)' }}>{row.val}</span>
                </div>
              ))}
              {report.description && (
                <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--bg-tertiary)', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Description: </span>
                  {report.description}
                </div>
              )}
            </div>
          </div>

          {/* Sustainability Impact */}
          <div className="card" style={{ border: '1px solid rgba(22,163,74,0.2)' }}>
            <div className="card-header" style={{ background: 'rgba(22,163,74,0.06)' }}>
              <div className="card-title">🌿 Sustainability Impact</div>
              <span className="badge" style={{ background: 'rgba(22,163,74,0.12)', color: 'var(--severity-low)' }}>SDG 13</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { icon: '🚗', label: 'Fuel Savings', val: `${report.sustainabilityImpact?.estimatedFuelSavingsLiters || 0}L`, sub: 'per month if fixed' },
                  { icon: '🌍', label: 'CO₂ Reduction', val: `${report.sustainabilityImpact?.estimatedCO2ReductionKg || 0}kg`, sub: 'carbon per month' },
                  { icon: '⚠️', label: 'Accident Risk', val: `${report.sustainabilityImpact?.accidentRiskReduced || 0}%`, sub: 'reduction on fix' },
                  { icon: '🌳', label: 'Trees Equiv.', val: `${Math.round((report.sustainabilityImpact?.estimatedCO2ReductionKg || 0) / 21)}`, sub: 'trees per year' },
                ].map(m => (
                  <div key={m.label} style={{ background: 'var(--bg-tertiary)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{m.icon}</div>
                    <div style={{ fontWeight: 700, fontSize: 18, fontFamily: 'var(--font-display)', color: 'var(--severity-low)' }}>{m.val}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>{m.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* AI Analysis */}
          <div className="card" style={{ border: '1px solid rgba(26,86,219,0.2)' }}>
            <div className="card-header" style={{ background: 'rgba(26,86,219,0.05)' }}>
              <div className="card-title">🤖 AI Analysis Results</div>
              <span className="ai-badge">YOLOv8s + Groq</span>
            </div>
            <div className="card-body">
              {/* Severity Score */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Severity Score</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: sevColor, fontFamily: 'var(--font-display)' }}>
                    {ai.severityScore}/100
                  </span>
                </div>
                <div className="severity-bar-wrap" style={{ height: 10 }}>
                  <div className="severity-bar-fill" style={{
                    width: `${ai.severityScore || 0}%`,
                    background: `linear-gradient(90deg, ${sevColor}99, ${sevColor})`
                  }} />
                </div>
                <div style={{ marginTop: 7, fontSize: 11, color: 'var(--text-muted)' }}>
                  Level: <strong style={{ color: sevColor, textTransform: 'uppercase' }}>{ai.severityLevel || 'low'}</strong>
                </div>
              </div>

              {/* Derived severity explanation */}
              <div style={{ background: 'var(--bg-tertiary)', borderRadius: 10, padding: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                  Why this level?
                </div>
                <p style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-secondary)', margin: 0 }}>
                  {ai.severityExplanation || (ai.detectedIssues?.length === 0
                    ? 'Automated analysis did not detect road damage meeting the configured confidence threshold. This does not guarantee that the road is free of damage.'
                    : 'Severity is derived from the detected road-damage evidence.')}
                </p>
              </div>

              <div style={{ marginBottom: 16, padding: '9px 11px', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                Severity is a derived assessment based on detected damage evidence. It is not a direct prediction from the YOLO model.
              </div>

              {/* Detected Issues */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  Detection Details
                </div>
                {(ai.detectedIssues || []).length === 0 ? (
                  <div style={{ padding: 12, background: 'var(--bg-tertiary)', borderRadius: 10, fontSize: 13, color: 'var(--text-secondary)' }}>
                    No road-damage detection met the configured confidence threshold. This does not confirm that the road is undamaged.
                  </div>
                ) : (
                  (ai.detectedIssues || []).map((issue, i) => (
                    <div key={i} style={{ padding: 10, marginBottom: 8, background: 'var(--bg-tertiary)', borderRadius: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                        <span style={{ fontSize: 13, textTransform: 'capitalize', fontWeight: 600 }}>
                          {issue.type?.replace('_', ' ')}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                          {Math.round((issue.confidence || 0) * 100)}% confidence
                        </span>
                      </div>
                      {issue.boundingBox && (
                        <div style={{ marginTop: 5, fontSize: 11, color: 'var(--text-muted)' }}>
                          Bounding box: {Math.round(issue.boundingBox.x * 100)}%, {Math.round(issue.boundingBox.y * 100)}% · {Math.round(issue.boundingBox.width * 100)}% × {Math.round(issue.boundingBox.height * 100)}%
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* AI Explanation */}
              {ai.aiExplanation && (
                <div style={{ background: 'rgba(26,86,219,0.06)', border: '1px solid rgba(26,86,219,0.12)', borderRadius: 10, padding: 14, marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>AI Explanation</div>
                  <p style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--text-secondary)' }}>{ai.aiExplanation}</p>
                </div>
              )}

              {/* Safety Precautions */}
              {(ai.safetyPrecautions || []).length > 0 && (
                <div style={{ background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.15)', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--severity-medium)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>⚠️ Safety Precautions</div>
                  {(ai.safetyPrecautions || []).map((p, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                      <span style={{ color: 'var(--severity-medium)', fontWeight: 700, minWidth: 16 }}>{i + 1}.</span>
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* AI Chat Assistant */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">💬 AI Road Safety Assistant</div>
              <span className="ai-badge">Groq AI LLM</span>
            </div>

            {/* Quick Questions */}
            <div style={{ padding: '8px 16px', display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid var(--border-subtle)' }}>
              {quickQuestions.map(q => (
                <button key={q} className="filter-chip" onClick={() => setChatInput(q)} style={{ fontSize: 11 }}>
                  {q}
                </button>
              ))}
            </div>

            <div className="chat-container" style={{ height: 320 }}>
              <div className="chat-messages">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`chat-msg ${msg.role}`}>
                    {msg.role === 'ai' && <div style={{ fontSize: 10, fontWeight: 700, color: msg.role === 'ai' ? 'var(--brand-primary)' : 'rgba(255,255,255,0.7)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>PotholeVision AI</div>}
                    {msg.text}
                  </div>
                ))}
                {chatLoading && (
                  <div className="chat-msg ai">
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <span className="pulse">●</span><span className="pulse" style={{ animationDelay: '0.2s' }}>●</span><span className="pulse" style={{ animationDelay: '0.4s' }}>●</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={sendChat} className="chat-input-row">
                <input
                  className="form-input"
                  placeholder="Ask about this road hazard..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  disabled={chatLoading}
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn btn-primary btn-sm" disabled={chatLoading || !chatInput.trim()}>
                  Send
                </button>
              </form>
            </div>
          </div>

          {/* Municipality Notes */}
          {(report.municipalityNotes || report.assignedTo) && (
            <div className="card">
              <div className="card-header"><div className="card-title">🏛️ Municipality Response</div></div>
              <div className="card-body" style={{ fontSize: 13 }}>
                {report.assignedTo && <p><strong>Assigned to:</strong> {report.assignedTo}</p>}
                {report.municipalityNotes && <p style={{ marginTop: 8, color: 'var(--text-secondary)' }}>{report.municipalityNotes}</p>}
                {report.resolvedAt && <p style={{ marginTop: 8, color: 'var(--severity-low)' }}>✅ Resolved on {new Date(report.resolvedAt).toLocaleDateString('en-IN')}</p>}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .fade-in > div:last-child { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

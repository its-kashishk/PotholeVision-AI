import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function SustainabilityPage() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchMetrics(); }, []);

  const fetchMetrics = async () => {
    try {
      const { data } = await axios.get('/sustainability/metrics');
      setMetrics(data.metrics);
    } catch {
      toast.error('Failed to load sustainability data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="fullscreen-loader"><div className="spinner" /></div>;

  const sdgProgress = metrics?.sdgProgress || {};

  const sdgInfo = [
    {
      num: 11, label: 'Sustainable Cities & Communities',
      color: '#f99d26', icon: '🏙️', score: sdgProgress.sdg11 || 0,
      desc: 'Improving road safety and urban infrastructure quality for all citizens.'
    },
    {
      num: 9, label: 'Industry, Innovation & Infrastructure',
      color: '#fd6925', icon: '🏗️', score: sdgProgress.sdg9 || 0,
      desc: 'Leveraging AI and digital technology to build resilient infrastructure.'
    },
    {
      num: 13, label: 'Climate Action',
      color: '#3f7e44', icon: '🌿', score: sdgProgress.sdg13 || 0,
      desc: 'Reducing vehicle fuel waste and CO₂ emissions through better roads.'
    }
  ];

  const impactCards = [
    {
      icon: '⚠️', value: metrics?.estimatedAccidentsPrevented || 0,
      unit: 'accidents', label: 'Estimated Accidents Prevented',
      sub: 'Through timely hazard resolution', color: '#dc2626', bg: 'rgba(220,38,38,0.08)'
    },
    {
      icon: '⛽', value: `${metrics?.estimatedFuelSavingsLiters || 0}L`,
      unit: '', label: 'Estimated Fuel Savings',
      sub: 'Liters saved per month from resolutions', color: '#d97706', bg: 'rgba(217,119,6,0.08)'
    },
    {
      icon: '🌍', value: `${metrics?.estimatedCO2ReductionKg || 0}kg`,
      unit: '', label: 'CO₂ Emissions Reduced',
      sub: 'Kilograms of carbon saved monthly', color: '#16a34a', bg: 'rgba(22,163,74,0.08)'
    },
    {
      icon: '🌳', value: metrics?.estimatedTreesEquivalent || 0,
      unit: 'trees', label: 'Tree Equivalent Impact',
      sub: 'Annual carbon absorption equivalent', color: '#0891b2', bg: 'rgba(8,145,178,0.08)'
    },
    {
      icon: '✅', value: metrics?.totalResolved || 0,
      unit: 'fixed', label: 'Hazards Resolved',
      sub: `Out of ${metrics?.totalReports || 0} total reports`, color: '#1a56db', bg: 'rgba(26,86,219,0.08)'
    },
    {
      icon: '📈', value: `${metrics?.resolutionRate || 0}%`,
      unit: '', label: 'Resolution Rate',
      sub: 'Percentage of hazards fixed', color: '#7c3aed', bg: 'rgba(124,58,237,0.08)'
    },
  ];

  const CircleProgress = ({ score, color, size = 90 }) => {
    const r = 36, circ = 2 * Math.PI * r;
    const pct = Math.min(100, Math.max(0, score));
    const offset = circ - (pct / 100) * circ;
    return (
      <svg width={size} height={size} viewBox="0 0 90 90">
        <circle cx="45" cy="45" r={r} fill="none" stroke="var(--bg-tertiary)" strokeWidth="8" />
        <circle
          cx="45" cy="45" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease', transform: 'rotate(-90deg)', transformOrigin: 'center' }}
        />
        <text x="45" y="50" textAnchor="middle" fontSize="15" fontWeight="800" fill="var(--text-primary)" fontFamily="Space Grotesk, sans-serif">
          {pct}%
        </text>
      </svg>
    );
  };

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>🌿 Sustainability Dashboard</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 3 }}>
          Track real-world environmental and safety impact of road hazard resolutions
        </p>
      </div>

      {/* Hero Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1a4731 0%, #166534 50%, #14532d 100%)',
        borderRadius: 18, padding: '28px 32px', marginBottom: 24, color: 'white',
        display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap',
        position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', right: -20, top: -20, fontSize: 120, opacity: 0.08 }}>🌍</div>
        <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.7, marginBottom: 8 }}>
            Environmental Impact Report
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
            {metrics?.estimatedCO2ReductionKg || 0} kg CO₂ Reduced
          </h2>
          <p style={{ opacity: 0.85, fontSize: 14 }}>
            Through {metrics?.totalResolved || 0} road hazard resolutions — equivalent to planting{' '}
            <strong>{metrics?.estimatedTreesEquivalent || 0} trees</strong> annually.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
          {[
            { val: metrics?.activeHazards || 0, label: 'Active Hazards' },
            { val: metrics?.criticalHazards || 0, label: 'Critical Alerts' },
            { val: `${metrics?.resolutionRate || 0}%`, label: 'Resolved' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '12px 18px' }}>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif' }}>{s.val}</div>
              <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Impact Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
        {impactCards.map(card => (
          <div key={card.label} style={{
            background: card.bg, border: `1px solid ${card.color}25`,
            borderRadius: 14, padding: '18px 20px'
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{card.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: card.color, lineHeight: 1 }}>
              {card.value}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 6 }}>{card.label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* SDG Progress */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title">🏆 UN SDG Progress Indicators</div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Based on platform activity</span>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {sdgInfo.map(sdg => (
              <div key={sdg.num} style={{
                display: 'flex', gap: 16, alignItems: 'center',
                padding: 16, borderRadius: 12,
                background: `${sdg.color}0d`, border: `1px solid ${sdg.color}30`
              }}>
                <CircleProgress score={sdg.score} color={sdg.color} />
                <div style={{ flex: 1 }}>
                  <div style={{
                    display: 'inline-block',
                    background: sdg.color, color: 'white',
                    padding: '2px 10px', borderRadius: 100,
                    fontSize: 11, fontWeight: 800, marginBottom: 6
                  }}>
                    SDG {sdg.num}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                    {sdg.icon} {sdg.label}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {sdg.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Responsible AI Section */}
      <div className="card" style={{ border: '1px solid rgba(26,86,219,0.2)' }}>
        <div className="card-header" style={{ background: 'rgba(26,86,219,0.04)' }}>
          <div className="card-title">🛡️ Responsible AI Principles</div>
          <span className="ai-badge">Groq AI Powered</span>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {[
              { icon: '⚖️', title: 'Known Limitations', desc: 'Our detection model is a third-party fine-tune trained on Japan and India road-damage photos; performance on other road types or conditions is untested, so critical findings should be human-verified.' },
              { icon: '🔍', title: 'Transparency', desc: 'Every AI decision shows confidence scores and detected issue types. Users understand exactly how severity is calculated.' },
              { icon: '👤', title: 'Human Review', desc: 'All critical reports are flagged for mandatory human verification by municipal officers before action is taken.' },
              { icon: '🔒', title: 'Privacy Protection', desc: 'Anonymous reporting supported. Location data encrypted. No personal data sold. GDPR-aligned data practices.' },
              { icon: '📍', title: 'Secure Location', desc: 'GPS coordinates stored with precision limits. Users can blur exact location. Opt-out of location tracking available.' },
              { icon: '🌐', title: 'Inclusivity', desc: 'Platform designed to work on low-bandwidth connections. Supports citizens without smartphones via authority submission.' },
            ].map(p => (
              <div key={p.title} style={{
                background: 'var(--bg-tertiary)', borderRadius: 10, padding: 14
              }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>{p.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{p.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Carbon Calculator Info */}
      <div style={{
        marginTop: 20, background: 'var(--bg-tertiary)', borderRadius: 12,
        padding: '14px 18px', fontSize: 12, color: 'var(--text-muted)',
        border: '1px solid var(--border-color)'
      }}>
        <strong>📌 Methodology Note:</strong> CO₂ and fuel estimates are calculated based on peer-reviewed research:
        a pothole causes ~2-4% additional fuel consumption per affected vehicle per km.
        Accident risk reduction modelled from NITI Aayog road safety reports.
        Carbon equivalent uses IPCC tree absorption rate of 21 kg CO₂/tree/year.
        All figures are conservative estimates for transparency.
      </div>
    </div>
  );
}

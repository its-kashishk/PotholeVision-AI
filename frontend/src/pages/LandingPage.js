import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

export default function LandingPage() {
  const { isDark, toggle } = useTheme();
  const { isAuth } = useAuth();

  const features = [
    { icon: '🤖', title: 'AI-Powered Detection', desc: 'A YOLOv8 computer-vision model detects potholes and road cracks from an uploaded photo and flags a confidence score for each finding.' },
    { icon: '💬', title: 'Groq AI Assistant', desc: 'Powered by Groq LLaMA3 with RAG, get instant explanations and safety recommendations for any road hazard.' },
    { icon: '🗺️', title: 'Interactive Hazard Map', desc: 'Real-time Google Maps integration with heatmaps, severity filters, and location-based hazard discovery.' },
    { icon: '📊', title: 'Municipality Dashboard', desc: 'Priority queues, analytics, bulk status management, and automated PDF reports for local authorities.' },
    { icon: '🌿', title: 'Sustainability Metrics', desc: 'Track CO₂ reductions, fuel savings, and SDG progress. Quantify real environmental impact of road repairs.' },
    { icon: '📱', title: 'Citizen Reporting', desc: 'One-tap GPS capture, photo upload, and instant AI analysis. Report hazards in under 60 seconds.' },
  ];

  const sdgs = [
    { num: 11, label: 'Sustainable Cities', color: '#f99d26' },
    { num: 9, label: 'Innovation & Infrastructure', color: '#fd6925' },
    { num: 13, label: 'Climate Action', color: '#3f7e44' },
  ];

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
      {/* Navbar */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'var(--nav-bg)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', height: 64
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, background: 'var(--brand-gradient)',
            borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18
          }}>🛣️</div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>PotholeVision AI</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={toggle}>{isDark ? '☀️' : '🌙'}</button>
          {isAuth ? (
            <Link to="/dashboard" className="btn btn-primary btn-sm">Go to Dashboard</Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-secondary btn-sm">Sign In</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Get Started</Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="landing-hero" style={{ paddingTop: 100 }}>
        <div className="landing-hero-content">
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.15)', borderRadius: 100,
            padding: '5px 14px', marginBottom: 20, fontSize: 13, fontWeight: 500
          }}>
            🏆 1M1B AI for Sustainability · IBM SkillsBuild · AICTE
          </div>
          <h1>Intelligent Road Damage<br />Detection & Reporting</h1>
          <p>AI-powered platform for citizens and municipalities to detect, report, and resolve road hazards. Powered by Groq LLaMA3 for explanations and a YOLOv8 computer-vision model for detection.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/register" className="btn btn-lg" style={{ background: 'white', color: 'var(--brand-primary)', fontWeight: 700 }}>
              🚀 Get Started Free
            </Link>
            <Link to="/login" className="btn btn-lg" style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}>
              Sign In
            </Link>
          </div>

          {/* Stats */}
          <div style={{
            display: 'flex', gap: 32, justifyContent: 'center', marginTop: 48,
            flexWrap: 'wrap'
          }}>
            {[
              { val: 'YOLOv8', label: 'Detection Model' },
              { val: 'SDG 11', label: 'Primary Goal' },
              { val: '< 60s', label: 'Report Time' },
              { val: 'Free', label: 'For Citizens' }
            ].map(s => (
              <div key={s.val} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 26, fontWeight: 800, fontFamily: 'var(--font-display)' }}>{s.val}</div>
                <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SDG Badges */}
      <section style={{ background: 'var(--bg-secondary)', padding: '32px 24px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            Aligned with UN Sustainable Development Goals
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
            {sdgs.map(s => (
              <div key={s.num} style={{
                background: s.color, color: 'white',
                borderRadius: 12, padding: '12px 20px',
                display: 'flex', alignItems: 'center', gap: 10,
                fontWeight: 700
              }}>
                <span style={{ fontSize: 22, fontWeight: 800 }}>SDG {s.num}</span>
                <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.9 }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="landing-features">
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 32, fontWeight: 800 }}>Everything you need to build<br />safer roads</h2>
          <p style={{ fontSize: 16, color: 'var(--text-secondary)', marginTop: 10 }}>
            From citizen reporting to municipal management — all in one AI-powered platform.
          </p>
        </div>
        <div className="feature-grid">
          {features.map(f => (
            <div key={f.title} className="feature-card">
              <div className="feature-card-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{
        background: 'var(--brand-gradient)', padding: '72px 24px',
        textAlign: 'center', color: 'white'
      }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12 }}>
          Start reporting road hazards today
        </h2>
        <p style={{ fontSize: 16, opacity: 0.88, marginBottom: 28 }}>
          Join citizens and municipalities making roads safer with AI.
        </p>
        <Link to="/register" className="btn btn-lg" style={{ background: 'white', color: 'var(--brand-primary)', fontWeight: 700 }}>
          Create Free Account →
        </Link>
      </section>

      {/* Footer */}
      <footer style={{
        background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)',
        padding: '24px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)'
      }}>
        <p>PotholeVision AI · 1M1B AI for Sustainability Internship · IBM SkillsBuild × AICTE</p>
        <p style={{ marginTop: 6 }}>Built with ❤️ for SDG 11 · SDG 9 · SDG 13</p>
      </footer>
    </div>
  );
}

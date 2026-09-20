import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { toast } from 'react-toastify';

export default function LoginPage() {
  const { login } = useAuth();
  const { isDark, toggle } = useTheme();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome back, ${user.name}!`);
      navigate(user.role === 'citizen' ? '/dashboard' : '/municipality');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      {/* Left Panel */}
      <div className="auth-panel-left">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
            <div style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.2)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🛣️</div>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>PotholeVision AI</span>
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 16 }}>
            Making roads safer<br />with AI
          </h1>
          <p style={{ fontSize: 15, opacity: 0.88, lineHeight: 1.7, marginBottom: 32 }}>
            Report road hazards, get AI-powered analysis, and help your municipality respond faster. Powered by Groq AI.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              '🤖 AI detects potholes, cracks & waterlogging',
              '📊 Real-time severity scoring & reports',
              '🌿 Track sustainability impact of repairs',
              '🗺️ Live hazard map for your city'
            ].map(item => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, opacity: 0.9 }}>
                {item}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 40, padding: '16px 20px', background: 'rgba(255,255,255,0.1)', borderRadius: 12 }}>
            <p style={{ fontSize: 13, opacity: 0.85, fontStyle: 'italic' }}>
              "PotholeVision reduced our response time from 14 days to 3 days for critical hazards."
            </p>
            <p style={{ fontSize: 12, marginTop: 8, opacity: 0.7 }}>— Smart City Administrator</p>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="auth-panel-right">
        <div className="auth-form-box fade-in">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
            <button className="btn btn-ghost btn-sm" onClick={toggle}>{isDark ? '☀️' : '🌙'}</button>
          </div>

          <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>Welcome back</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 28 }}>
            Sign in to your PotholeVision account
          </p>

          {error && (
            <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 9, padding: '10px 14px', marginBottom: 16, color: 'var(--severity-critical)', fontSize: 13 }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address <span className="form-required">*</span></label>
              <input
                type="email" className="form-input"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password <span className="form-required">*</span></label>
              <input
                type="password" className="form-input"
                placeholder="Enter your password"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading} style={{ marginTop: 8 }}>
              {loading ? <><span className="spinner spinner-sm" /> Signing in...</> : '→ Sign In'}
            </button>
          </form>

          <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
            Don't have an account? <Link to="/register" style={{ fontWeight: 600 }}>Create one free</Link>
          </div>

          <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border-color)' }}>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
              Demo accounts: <strong>citizen@demo.com</strong> / <strong>municipality@demo.com</strong><br />
              Password: <strong>demo123456</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

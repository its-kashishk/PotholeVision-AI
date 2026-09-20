import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { toast } from 'react-toastify';

export default function RegisterPage() {
  const { register } = useAuth();
  const { isDark, toggle } = useTheme();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'citizen', city: '', state: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setError(''); setLoading(true);
    try {
      const user = await register(form);
      toast.success(`Account created! Welcome, ${user.name}!`);
      navigate(user.role === 'citizen' ? '/dashboard' : '/municipality');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-panel-left">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
            <div style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.2)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🛣️</div>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>PotholeVision AI</span>
          </div>
          <h1 style={{ fontSize: 34, fontWeight: 800, marginBottom: 14 }}>Join thousands<br />making roads safer</h1>
          <p style={{ fontSize: 14, opacity: 0.88, lineHeight: 1.7, marginBottom: 28 }}>
            Whether you're a citizen or a municipal officer, PotholeVision AI gives you the tools to detect, report, and resolve road hazards at scale.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { role: '👤 Citizen', desc: 'Report road hazards near you, track status, get safety alerts' },
              { role: '🏛️ Municipality', desc: 'Manage reports, analytics dashboard, PDF export, priority queue' },
            ].map(r => (
              <div key={r.role} style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{r.role}</div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>{r.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="auth-panel-right">
        <div className="auth-form-box fade-in">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
            <button className="btn btn-ghost btn-sm" onClick={toggle}>{isDark ? '☀️' : '🌙'}</button>
          </div>

          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Create your account</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 24 }}>
            Free forever for citizens · <Link to="/login">Already have an account?</Link>
          </p>

          {error && (
            <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 9, padding: '10px 14px', marginBottom: 16, color: 'var(--severity-critical)', fontSize: 13 }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Full Name <span className="form-required">*</span></label>
              <input type="text" className="form-input" placeholder="Your full name" value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>

            <div className="form-group">
              <label className="form-label">Email <span className="form-required">*</span></label>
              <input type="email" className="form-input" placeholder="you@example.com" value={form.email} onChange={e => set('email', e.target.value)} required />
            </div>

            <div className="form-group">
              <label className="form-label">Password <span className="form-required">*</span></label>
              <input type="password" className="form-input" placeholder="Min. 6 characters" value={form.password} onChange={e => set('password', e.target.value)} required />
            </div>

            <div className="form-group">
              <label className="form-label">Account Type <span className="form-required">*</span></label>
              <select className="form-select" value={form.role} onChange={e => set('role', e.target.value)}>
                <option value="citizen">👤 Citizen</option>
                <option value="municipality">🏛️ Municipality / Authority</option>
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">City</label>
                <input type="text" className="form-input" placeholder="e.g. Dehradun" value={form.city} onChange={e => set('city', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">State</label>
                <input type="text" className="form-input" placeholder="e.g. Uttarakhand" value={form.state} onChange={e => set('state', e.target.value)} />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
              {loading ? <><span className="spinner spinner-sm" /> Creating account...</> : '→ Create Account'}
            </button>
          </form>

          <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 16 }}>
            By creating an account, you agree to responsible and accurate hazard reporting.
          </p>
        </div>
      </div>
    </div>
  );
}

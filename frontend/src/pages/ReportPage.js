import React, { useState, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

export default function ReportPage() {
  const navigate = useNavigate();
  const fileRef = useRef();
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState('');
  const [form, setForm] = useState({ description: '', latitude: '', longitude: '', address: '', city: '', state: '', pincode: '', isAnonymous: false });
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [dragover, setDragover] = useState(false);
  const [step, setStep] = useState(1); // 1=upload, 2=location, 3=submit
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleFile = (file) => {
    if (!file?.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    setImage(file);
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target.result);
    reader.readAsDataURL(file);
    setStep(2);
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragover(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const getGPS = () => {
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords;
        set('latitude', latitude.toFixed(6));
        set('longitude', longitude.toFixed(6));
        // Reverse geocode using Nominatim (free, no API key)
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
          const geo = await res.json();
          set('address', geo.display_name || '');
          set('city', geo.address?.city || geo.address?.town || geo.address?.village || '');
          set('state', geo.address?.state || '');
          set('pincode', geo.address?.postcode || '');
          toast.success('📍 Location captured!');
        } catch { /* address optional */ }
        setGpsLoading(false);
      },
      err => {
        toast.error('Could not get GPS. Please enter manually.');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!image) { toast.error('Please upload a road image'); return; }
    if (!form.latitude || !form.longitude) { toast.error('Please provide location'); return; }

    setLoading(true);
    const fd = new FormData();
    fd.append('image', image);
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));

    try {
      const { data } = await axios.post('/reports', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('🎉 Report submitted! AI analysis complete.');
      navigate(`/report/${data.report._id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  const stepIndicator = (num, label, done) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: done || step === num ? 'var(--brand-primary)' : 'var(--bg-tertiary)',
        color: done || step === num ? 'white' : 'var(--text-muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, transition: 'all 0.2s'
      }}>{done ? '✓' : num}</div>
      <span style={{ fontSize: 13, fontWeight: step === num ? 600 : 400, color: step === num ? 'var(--text-primary)' : 'var(--text-muted)' }}>{label}</span>
    </div>
  );

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>📷 Report a Road Hazard</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 3 }}>Upload a photo and our AI will analyze it instantly</p>
      </div>

      {/* Step Indicators */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 28, padding: '14px 20px', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
        {stepIndicator(1, 'Upload Image', step > 1)}
        <div style={{ width: 30, height: 1, background: 'var(--border-color)', alignSelf: 'center' }} />
        {stepIndicator(2, 'Add Location', step > 2)}
        <div style={{ width: 30, height: 1, background: 'var(--border-color)', alignSelf: 'center' }} />
        {stepIndicator(3, 'Submit Report', false)}
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Left - Form */}
        <form onSubmit={handleSubmit}>
          {/* Step 1: Image Upload */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <div className="card-title">1️⃣ Road Image</div>
              {image && <span className="badge badge-low">✓ Image ready</span>}
            </div>
            <div className="card-body">
              {!preview ? (
                <div
                  className={`upload-zone ${dragover ? 'dragover' : ''}`}
                  onClick={() => fileRef.current.click()}
                  onDragOver={e => { e.preventDefault(); setDragover(true); }}
                  onDragLeave={() => setDragover(false)}
                  onDrop={handleDrop}
                >
                  <div className="upload-zone-icon">📸</div>
                  <div className="upload-zone-text">Drop a road photo or click to browse</div>
                  <div className="upload-zone-sub">JPG, PNG, WEBP · Max 10MB</div>
                  <input type="file" ref={fileRef} style={{ display: 'none' }} accept="image/*" onChange={e => handleFile(e.target.files[0])} />
                </div>
              ) : (
                <div>
                  <img src={preview} alt="Road hazard" className="report-image-thumb" style={{ marginBottom: 10 }} />
                  <button type="button" className="btn btn-secondary btn-sm btn-full" onClick={() => { setImage(null); setPreview(''); setStep(1); }}>
                    Change Image
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Location */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <div className="card-title">2️⃣ Location</div>
              {form.latitude && <span className="badge badge-low">✓ GPS captured</span>}
            </div>
            <div className="card-body">
              <button type="button" className="btn btn-primary btn-full" onClick={getGPS} disabled={gpsLoading} style={{ marginBottom: 14 }}>
                {gpsLoading ? <><span className="spinner spinner-sm" /> Getting location...</> : '📍 Capture GPS Location'}
              </button>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Latitude <span className="form-required">*</span></label>
                  <input type="number" className="form-input" placeholder="e.g. 30.3165" value={form.latitude} onChange={e => set('latitude', e.target.value)} step="any" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Longitude <span className="form-required">*</span></label>
                  <input type="number" className="form-input" placeholder="e.g. 78.0322" value={form.longitude} onChange={e => set('longitude', e.target.value)} step="any" required />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <input type="text" className="form-input" placeholder="Street address" value={form.address} onChange={e => set('address', e.target.value)} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">City</label>
                  <input type="text" className="form-input" placeholder="City" value={form.city} onChange={e => set('city', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">State</label>
                  <input type="text" className="form-input" placeholder="State" value={form.state} onChange={e => set('state', e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: Details */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <div className="card-title">3️⃣ Description</div>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Describe the Hazard</label>
                <textarea className="form-textarea" placeholder="e.g. Large pothole near the traffic signal, causing vehicles to swerve dangerously..." value={form.description} onChange={e => set('description', e.target.value)} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                <input type="checkbox" checked={form.isAnonymous} onChange={e => set('isAnonymous', e.target.checked)} />
                Submit anonymously
              </label>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
                <span className="spinner spinner-sm" />
                <span>Analyzing with AI...</span>
              </div>
            ) : '🤖 Submit & Analyze with AI'}
          </button>
        </form>

        {/* Right - Info Panel */}
        <div>
          <div className="ai-panel" style={{ marginBottom: 16 }}>
            <div className="ai-panel-header">
              <span style={{ fontSize: 24 }}>🤖</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>AI Analysis Engine</div>
                <span className="ai-badge">Powered by Groq AI + YOLOv8</span>
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              After submission, our AI pipeline will:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {[
                { icon: '👁️', text: 'Detect potholes, cracks, waterlogging & broken surfaces' },
                { icon: '📊', text: 'Generate confidence & severity scores (Low/Medium/High/Critical)' },
                { icon: '💬', text: 'Create Groq LLaMA AI explanation of the hazard' },
                { icon: '⚠️', text: 'Suggest immediate safety precautions for road users' },
                { icon: '🌿', text: 'Calculate sustainability & CO₂ impact metrics' },
              ].map(item => (
                <div key={item.text} style={{ display: 'flex', gap: 10, fontSize: 13 }}>
                  <span>{item.icon}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">📐 Severity Scale</div></div>
            <div className="card-body">
              {[
                { level: 'critical', label: 'Critical', score: '85-100', desc: 'Immediate hazard, road closure risk' },
                { level: 'high', label: 'High', score: '65-84', desc: 'Major damage, urgent repair needed' },
                { level: 'medium', label: 'Medium', score: '40-64', desc: 'Moderate damage, repair within weeks' },
                { level: 'low', label: 'Low', score: '0-39', desc: 'Minor damage, schedule maintenance' },
              ].map(s => (
                <div key={s.level} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                  <span className={`badge badge-${s.level}`}>{s.label}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>Score: {s.score}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

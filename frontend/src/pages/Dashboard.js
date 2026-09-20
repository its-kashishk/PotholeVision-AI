import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

const severityConfig = {
  critical: { color: 'var(--severity-critical)', label: '🔴 Critical' },
  high: { color: 'var(--severity-high)', label: '🟠 High' },
  medium: { color: 'var(--severity-medium)', label: '🟡 Medium' },
  low: { color: 'var(--severity-low)', label: '🟢 Low' },
};

export default function Dashboard() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, resolved: 0, inProgress: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const { data } = await axios.get('/reports?limit=10');
      setReports(data.reports || []);
      const all = data.reports || [];
      setStats({
        total: data.total || all.length,
        pending: all.filter(r => r.status === 'pending').length,
        resolved: all.filter(r => r.status === 'resolved').length,
        inProgress: all.filter(r => r.status === 'in_progress').length,
      });
    } catch (err) {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (status) => (
    <span className={`badge badge-${status.replace(' ', '_')}`}>
      {status === 'pending' ? '⏳ Pending' : status === 'in_progress' ? '🔧 In Progress' : status === 'resolved' ? '✅ Resolved' : '❌ Rejected'}
    </span>
  );

  return (
    <div className="fade-in">
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 3 }}>
            Here's your road safety activity overview
          </p>
        </div>
        <Link to="/report" className="btn btn-primary">
          📷 Report Hazard
        </Link>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon blue">📋</div>
          <div>
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Reports</div>
            <div className="stat-change">↑ Your contributions</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange">⏳</div>
          <div>
            <div className="stat-value">{stats.pending}</div>
            <div className="stat-label">Pending Review</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue">🔧</div>
          <div>
            <div className="stat-value">{stats.inProgress}</div>
            <div className="stat-label">In Progress</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">✅</div>
          <div>
            <div className="stat-value">{stats.resolved}</div>
            <div className="stat-label">Resolved</div>
            <div className="stat-change">Hazards fixed 🎉</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card" style={{ cursor: 'pointer' }}>
          <Link to="/report" style={{ display: 'block', padding: 20, textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 50, height: 50, background: 'var(--brand-gradient)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📷</div>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15 }}>Report a Road Hazard</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>Upload photo + GPS → AI analyzes instantly</div>
              </div>
            </div>
          </Link>
        </div>

        <div className="card">
          <Link to="/map" style={{ display: 'block', padding: 20, textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 50, height: 50, background: 'linear-gradient(135deg, #06b6d4, #0891b2)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🗺️</div>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15 }}>View Hazard Map</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>See all hazards in your area with heatmap</div>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Reports Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">📋 Your Recent Reports</div>
          <Link to="/map" className="btn btn-secondary btn-sm">View All on Map</Link>
        </div>

        {loading ? (
          <div className="page-loader"><div className="spinner" /></div>
        ) : reports.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🛣️</div>
            <div className="empty-state-title">No reports yet</div>
            <p style={{ fontSize: 13, marginBottom: 16 }}>Help make your city safer by reporting road hazards.</p>
            <Link to="/report" className="btn btn-primary">Report Your First Hazard</Link>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Report ID</th>
                  <th>Issue</th>
                  <th>Location</th>
                  <th>Severity</th>
                  <th>Confidence</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(r => (
                  <tr key={r._id}>
                    <td><code style={{ fontSize: 11, background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: 4 }}>{r.reportId}</code></td>
                    <td style={{ fontWeight: 500, textTransform: 'capitalize' }}>
                      {(r.aiAnalysis?.primaryIssue || 'unknown').replace('_', ' ')}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12, maxWidth: 130 }} className="truncate">
                      {r.location?.city || r.location?.address || 'Unknown'}
                    </td>
                    <td>
                      <span className={`badge badge-${r.aiAnalysis?.severityLevel}`}>
                        {r.aiAnalysis?.severityLevel}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className="severity-bar-wrap" style={{ width: 50 }}>
                          <div className="severity-bar-fill" style={{
                            width: `${Math.round((r.aiAnalysis?.overallConfidence || 0) * 100)}%`,
                            background: 'var(--brand-primary)'
                          }} />
                        </div>
                        <span style={{ fontSize: 11 }}>{Math.round((r.aiAnalysis?.overallConfidence || 0) * 100)}%</span>
                      </div>
                    </td>
                    <td>{statusBadge(r.status)}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {new Date(r.createdAt).toLocaleDateString('en-IN')}
                    </td>
                    <td>
                      <Link to={`/report/${r._id}`} className="btn btn-secondary btn-sm">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

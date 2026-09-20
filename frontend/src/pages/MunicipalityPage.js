import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend, ArcElement, PointElement, LineElement
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement);

const API = process.env.REACT_APP_API_URL || '/api';

export default function MunicipalityPage() {
  const [analytics, setAnalytics] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [selectedReports, setSelectedReports] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [bulkStatus, setBulkStatus] = useState('');
  const [tab, setTab] = useState('queue'); // queue | analytics | users
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => { fetchAnalytics(); }, []);
  useEffect(() => { fetchQueue(); }, [statusFilter, page]);

  const fetchAnalytics = async () => {
    try {
      const { data } = await axios.get('/municipality/analytics');
      setAnalytics(data.analytics);
    } catch { toast.error('Failed to load analytics'); }
    finally { setLoading(false); }
  };

  const fetchQueue = async () => {
    setReportsLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}&page=${page}` : `?page=${page}`;
      const { data } = await axios.get(`/municipality/priority-queue${params}`);
      setReports(data.reports || []);
      setTotal(data.total || 0);
    } catch { toast.error('Failed to load reports'); }
    finally { setReportsLoading(false); }
  };

  const updateStatus = async (reportId, status, notes = '') => {
    setUpdatingId(reportId);
    try {
      await axios.patch(`/reports/${reportId}/status`, { status, municipalityNotes: notes });
      toast.success(`Status updated to ${status}`);
      fetchQueue();
      fetchAnalytics();
    } catch { toast.error('Update failed'); }
    finally { setUpdatingId(null); }
  };

  const bulkUpdate = async () => {
    if (!selectedReports.length || !bulkStatus) { toast.warn('Select reports and a status'); return; }
    try {
      await axios.patch('/municipality/bulk-status', { reportIds: selectedReports, status: bulkStatus });
      toast.success(`Updated ${selectedReports.length} reports`);
      setSelectedReports([]); setBulkStatus('');
      fetchQueue(); fetchAnalytics();
    } catch { toast.error('Bulk update failed'); }
  };

  const downloadMunicipalityReport = async () => {
    try {
      const token = localStorage.getItem('pv_token');
      const res = await fetch(`${API}/pdf/municipality-report`, { headers: { Authorization: `Bearer ${token}` } });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'Municipality-Report.pdf'; a.click();
      URL.revokeObjectURL(url);
      toast.success('📄 Municipality report downloaded!');
    } catch { toast.error('PDF generation failed'); }
  };

  const toggleSelect = (id) => setSelectedReports(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const toggleAll = () => setSelectedReports(selectedReports.length === reports.length ? [] : reports.map(r => r._id));

  const chartColors = {
    critical: 'rgba(220,38,38,0.8)', high: 'rgba(234,88,12,0.8)',
    medium: 'rgba(217,119,6,0.8)', low: 'rgba(22,163,74,0.8)'
  };

  const severityData = analytics ? {
    labels: ['Critical', 'High', 'Medium', 'Low'],
    datasets: [{
      data: [
        analytics.bySeverity.critical || 0, analytics.bySeverity.high || 0,
        analytics.bySeverity.medium || 0, analytics.bySeverity.low || 0
      ],
      backgroundColor: Object.values(chartColors),
      borderWidth: 0
    }]
  } : null;

  const issueData = analytics ? {
    labels: Object.keys(analytics.byIssue || {}).map(k => k.replace('_', ' ')),
    datasets: [{
      label: 'Reports',
      data: Object.values(analytics.byIssue || {}),
      backgroundColor: 'rgba(26,86,219,0.7)',
      borderRadius: 6,
    }]
  } : null;

  const trendData = analytics?.dailyReports ? {
    labels: analytics.dailyReports.map(d => d._id.slice(5)),
    datasets: [{
      label: 'Daily Reports',
      data: analytics.dailyReports.map(d => d.count),
      borderColor: '#1a56db', backgroundColor: 'rgba(26,86,219,0.1)',
      fill: true, tension: 0.4, pointRadius: 3,
    }]
  } : null;

  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { x: { grid: { display: false } }, y: { grid: { color: 'rgba(148,163,184,0.1)' } } }
  };

  const statusBadge = (status) => {
    const map = { pending: '⏳ Pending', in_progress: '🔧 In Progress', resolved: '✅ Resolved', rejected: '❌ Rejected' };
    return <span className={`badge badge-${status}`}>{map[status] || status}</span>;
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>🏛️ Municipality Hub</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>Manage reports, track progress, and export data</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={downloadMunicipalityReport}>📄 Export PDF Report</button>
          <button className="btn btn-primary btn-sm" onClick={() => { fetchAnalytics(); fetchQueue(); }}>🔄 Refresh</button>
        </div>
      </div>

      {/* Stat Cards */}
      {loading ? (
        <div className="page-loader"><div className="spinner" /></div>
      ) : analytics && (
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          {[
            { icon: '📋', label: 'Total Reports', val: analytics.totals.total, cls: 'blue' },
            { icon: '⏳', label: 'Pending', val: analytics.totals.pending, cls: 'orange' },
            { icon: '🔧', label: 'In Progress', val: analytics.totals.inProgress, cls: 'blue' },
            { icon: '✅', label: 'Resolved', val: analytics.totals.resolved, cls: 'green' },
            { icon: '📈', label: 'Resolution Rate', val: `${analytics.resolutionRate}%`, cls: 'cyan' },
          ].map(s => (
            <div className="stat-card" key={s.label}>
              <div className={`stat-icon ${s.cls}`}>{s.icon}</div>
              <div>
                <div className="stat-value">{s.val}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: '1px solid var(--border-color)', paddingBottom: 0 }}>
        {[
          { id: 'queue', label: '📋 Priority Queue' },
          { id: 'analytics', label: '📊 Analytics' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '9px 16px', border: 'none', cursor: 'pointer', background: 'transparent',
              fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
              color: tab === t.id ? 'var(--brand-primary)' : 'var(--text-secondary)',
              borderBottom: tab === t.id ? '2px solid var(--brand-primary)' : '2px solid transparent',
              marginBottom: -1, transition: 'all 0.15s'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Priority Queue Tab */}
      {tab === 'queue' && (
        <div>
          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <select className="form-select" style={{ width: 160 }} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All Statuses</option>
              <option value="pending">⏳ Pending</option>
              <option value="in_progress">🔧 In Progress</option>
              <option value="resolved">✅ Resolved</option>
              <option value="rejected">❌ Rejected</option>
            </select>

            {selectedReports.length > 0 && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 'auto' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{selectedReports.length} selected</span>
                <select className="form-select" style={{ width: 140 }} value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}>
                  <option value="">Set status...</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="rejected">Rejected</option>
                </select>
                <button className="btn btn-primary btn-sm" onClick={bulkUpdate}>Apply Bulk</button>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="card">
            {reportsLoading ? (
              <div className="page-loader"><div className="spinner" /></div>
            ) : reports.length === 0 ? (
              <div className="empty-state"><div className="empty-state-icon">📋</div><div className="empty-state-title">No reports found</div></div>
            ) : (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th><input type="checkbox" onChange={toggleAll} checked={selectedReports.length === reports.length && reports.length > 0} /></th>
                      <th>Report ID</th>
                      <th>Issue</th>
                      <th>Severity</th>
                      <th>Score</th>
                      <th>Location</th>
                      <th>Reporter</th>
                      <th>Upvotes</th>
                      <th>Status</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map(r => (
                      <tr key={r._id}>
                        <td><input type="checkbox" checked={selectedReports.includes(r._id)} onChange={() => toggleSelect(r._id)} /></td>
                        <td>
                          <Link to={`/report/${r._id}`} style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--brand-primary)', fontWeight: 600 }}>
                            {r.reportId}
                          </Link>
                        </td>
                        <td style={{ fontWeight: 500, textTransform: 'capitalize', fontSize: 13 }}>
                          {(r.aiAnalysis?.primaryIssue || 'unknown').replace('_', ' ')}
                        </td>
                        <td><span className={`badge badge-${r.aiAnalysis?.severityLevel}`}>{r.aiAnalysis?.severityLevel}</span></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div className="severity-bar-wrap" style={{ width: 44 }}>
                              <div className="severity-bar-fill" style={{
                                width: `${r.aiAnalysis?.severityScore || 0}%`,
                                background: r.aiAnalysis?.severityLevel === 'critical' ? 'var(--severity-critical)' :
                                  r.aiAnalysis?.severityLevel === 'high' ? 'var(--severity-high)' :
                                    r.aiAnalysis?.severityLevel === 'medium' ? 'var(--severity-medium)' : 'var(--severity-low)'
                              }} />
                            </div>
                            <span style={{ fontSize: 11 }}>{r.aiAnalysis?.severityScore}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 120 }} className="truncate">
                          {r.location?.city || r.location?.address || 'N/A'}
                        </td>
                        <td style={{ fontSize: 12 }}>{r.isAnonymous ? 'Anonymous' : r.submittedBy?.name}</td>
                        <td style={{ fontSize: 12, fontWeight: 600 }}>👍 {r.upvotes || 0}</td>
                        <td>{statusBadge(r.status)}</td>
                        <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(r.createdAt).toLocaleDateString('en-IN')}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {r.status === 'pending' && (
                              <button
                                className="btn btn-sm"
                                style={{ background: 'rgba(26,86,219,0.1)', color: 'var(--brand-primary)', fontSize: 11 }}
                                onClick={() => updateStatus(r._id, 'in_progress')}
                                disabled={updatingId === r._id}
                              >
                                {updatingId === r._id ? '...' : 'Start'}
                              </button>
                            )}
                            {r.status === 'in_progress' && (
                              <button
                                className="btn btn-sm btn-success"
                                style={{ fontSize: 11 }}
                                onClick={() => updateStatus(r._id, 'resolved')}
                                disabled={updatingId === r._id}
                              >
                                {updatingId === r._id ? '...' : 'Resolve'}
                              </button>
                            )}
                            <Link to={`/report/${r._id}`} className="btn btn-secondary btn-sm" style={{ fontSize: 11 }}>View</Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {total > 20 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: 14, borderTop: '1px solid var(--border-subtle)' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Prev</button>
                <span style={{ fontSize: 13, alignSelf: 'center', color: 'var(--text-secondary)' }}>Page {page} of {Math.ceil(total / 20)}</span>
                <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 20)}>Next →</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {tab === 'analytics' && analytics && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="grid-2">
            {/* Severity Doughnut */}
            <div className="card">
              <div className="card-header"><div className="card-title">🎯 Reports by Severity</div></div>
              <div className="card-body" style={{ height: 260 }}>
                {severityData && (
                  <Doughnut data={severityData} options={{
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'right', labels: { font: { size: 12 }, color: 'var(--text-secondary)', padding: 16 } }
                    },
                    cutout: '60%'
                  }} />
                )}
              </div>
            </div>

            {/* Issue Type Bar */}
            <div className="card">
              <div className="card-header"><div className="card-title">🔍 Reports by Issue Type</div></div>
              <div className="card-body" style={{ height: 260 }}>
                {issueData && <Bar data={issueData} options={chartOptions} />}
              </div>
            </div>
          </div>

          {/* Daily Trend */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">📈 Reports Trend (Last 30 Days)</div>
              <span className="badge badge-blue">Daily</span>
            </div>
            <div className="card-body" style={{ height: 220 }}>
              {trendData && <Line data={trendData} options={{ ...chartOptions, plugins: { legend: { display: false } } }} />}
            </div>
          </div>

          {/* Status Summary + Top Cities */}
          <div className="grid-2">
            <div className="card">
              <div className="card-header"><div className="card-title">📊 Status Distribution</div></div>
              <div className="card-body">
                {[
                  { label: 'Pending', val: analytics.totals.pending, total: analytics.totals.total, color: 'var(--severity-medium)' },
                  { label: 'In Progress', val: analytics.totals.inProgress, total: analytics.totals.total, color: 'var(--brand-primary)' },
                  { label: 'Resolved', val: analytics.totals.resolved, total: analytics.totals.total, color: 'var(--severity-low)' },
                  { label: 'Rejected', val: analytics.totals.rejected, total: analytics.totals.total, color: 'var(--text-muted)' },
                ].map(s => (
                  <div key={s.label} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                      <span style={{ fontWeight: 500 }}>{s.label}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{s.val} / {s.total}</span>
                    </div>
                    <div className="severity-bar-wrap">
                      <div className="severity-bar-fill" style={{ width: `${s.total ? Math.round((s.val / s.total) * 100) : 0}%`, background: s.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header"><div className="card-title">🏙️ Top Cities by Reports</div></div>
              <div className="card-body">
                {(analytics.topCities || []).length === 0 ? (
                  <div className="empty-state" style={{ padding: 20 }}><p>No city data yet</p></div>
                ) : (
                  (analytics.topCities || []).map((city, i) => (
                    <div key={city._id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: '50%',
                        background: 'var(--brand-gradient)', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, flexShrink: 0
                      }}>{i + 1}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{city._id || 'Unknown'}</div>
                        <div className="severity-bar-wrap" style={{ marginTop: 4 }}>
                          <div className="severity-bar-fill" style={{
                            width: `${Math.round((city.count / (analytics.topCities[0]?.count || 1)) * 100)}%`,
                            background: 'var(--brand-primary)'
                          }} />
                        </div>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-primary)' }}>{city.count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const GMAPS_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

const severityColors = {
  critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#16a34a'
};

const issueIcons = {
  pothole: '🕳️', crack: '⚡', waterlogging: '💧', broken_surface: '🔥', unknown: '⚠️'
};

export default function MapPage() {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const heatmapRef = useRef(null);
  const infoWindowRef = useRef(null);

  const [hazards, setHazards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ severity: [], status: [] });
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [stats, setStats] = useState({ total: 0, critical: 0, high: 0, medium: 0, low: 0 });
  const [selectedHazard, setSelectedHazard] = useState(null);

  // Load Google Maps
  useEffect(() => {
    if (!GMAPS_KEY || GMAPS_KEY === 'your_google_maps_api_key_here') {
      setMapLoaded(false);
      setLoading(false);
      return;
    }
    if (window.google?.maps) { initMap(); return; }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&libraries=visualization`;
    script.async = true;
    script.onload = () => { setMapLoaded(true); };
    script.onerror = () => toast.error('Failed to load Google Maps');
    document.head.appendChild(script);
    return () => { if (document.head.contains(script)) document.head.removeChild(script); };
  }, []);

  useEffect(() => { if (mapLoaded) initMap(); }, [mapLoaded]);
  useEffect(() => { fetchHazards(); }, []);

  const initMap = () => {
    if (!mapRef.current || mapInstance.current) return;
    mapInstance.current = new window.google.maps.Map(mapRef.current, {
      center: { lat: 20.5937, lng: 78.9629 }, // India center
      zoom: 5,
      styles: getMapStyles(),
      mapTypeControl: false,
      streetViewControl: false,
    });
    infoWindowRef.current = new window.google.maps.InfoWindow();
  };

  const fetchHazards = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.severity.length) params.append('severity', filters.severity.join(','));
      if (filters.status.length) params.append('status', filters.status.join(','));

      const { data } = await axios.get(`/map/hazards?${params}`);
      setHazards(data.features || []);

      const counts = { total: 0, critical: 0, high: 0, medium: 0, low: 0 };
      (data.features || []).forEach(f => {
        counts.total++;
        counts[f.properties.severity] = (counts[f.properties.severity] || 0) + 1;
      });
      setStats(counts);
    } catch {
      toast.error('Failed to load hazard data');
    } finally {
      setLoading(false);
    }
  };

  const updateMarkers = useCallback(() => {
    if (!mapInstance.current || !window.google) return;

    // Clear existing markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    if (heatmapRef.current) { heatmapRef.current.setMap(null); heatmapRef.current = null; }

    if (showHeatmap) {
      const heatData = hazards
        .filter(f => !filters.severity.length || filters.severity.includes(f.properties.severity))
        .map(f => ({
          location: new window.google.maps.LatLng(f.geometry.coordinates[1], f.geometry.coordinates[0]),
          weight: f.properties.severity === 'critical' ? 4 : f.properties.severity === 'high' ? 3 : f.properties.severity === 'medium' ? 2 : 1
        }));
      heatmapRef.current = new window.google.maps.visualization.HeatmapLayer({
        data: heatData, map: mapInstance.current, radius: 30, opacity: 0.7
      });
      return;
    }

    hazards
      .filter(f => !filters.severity.length || filters.severity.includes(f.properties.severity))
      .filter(f => !filters.status.length || filters.status.includes(f.properties.status))
      .forEach(feature => {
        const { coordinates } = feature.geometry;
        const props = feature.properties;
        const color = severityColors[props.severity] || '#1a56db';

        const marker = new window.google.maps.Marker({
          position: { lat: coordinates[1], lng: coordinates[0] },
          map: mapInstance.current,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: props.severity === 'critical' ? 12 : props.severity === 'high' ? 10 : 8,
            fillColor: color, fillOpacity: 0.85,
            strokeColor: 'white', strokeWeight: 2
          },
          title: props.reportId
        });

        marker.addListener('click', () => {
          setSelectedHazard(props);
          infoWindowRef.current.setContent(`
            <div style="font-family: Inter, sans-serif; padding: 8px; max-width: 220px;">
              <div style="font-weight:700; margin-bottom:6px; font-size:13px;">${issueIcons[props.issue] || '⚠️'} ${(props.issue || 'unknown').replace('_', ' ').toUpperCase()}</div>
              <div style="background:${color}22; border-left:3px solid ${color}; padding:4px 8px; border-radius:4px; margin-bottom:8px; font-size:12px; font-weight:600; color:${color}; text-transform:uppercase;">${props.severity}</div>
              <div style="font-size:12px; color:#64748b; margin-bottom:4px;">${props.address || 'Location recorded'}</div>
              <div style="font-size:11px; color:#94a3b8;">Report: ${props.reportId}</div>
              <div style="font-size:11px; color:#94a3b8;">Status: ${props.status}</div>
              <div style="font-size:11px; color:#94a3b8; margin-bottom:8px;">${new Date(props.createdAt).toLocaleDateString('en-IN')}</div>
              <a href="/report/${props.id}" style="font-size:12px; color:#1a56db; font-weight:600; text-decoration:none;">View Full Report →</a>
            </div>
          `);
          infoWindowRef.current.open(mapInstance.current, marker);
        });

        markersRef.current.push(marker);
      });
  }, [hazards, filters, showHeatmap]);

  useEffect(() => { updateMarkers(); }, [updateMarkers]);

  const toggleFilter = (type, value) => {
    setFilters(prev => {
      const arr = prev[type];
      return { ...prev, [type]: arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value] };
    });
  };

  const getMapStyles = () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (!isDark) return [];
    return [
      { elementType: 'geometry', stylers: [{ color: '#1a2035' }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: '#0b0f1a' }] },
      { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
      { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c3b52' }] },
      { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0b1729' }] },
      { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    ];
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>🗺️ Hazard Map</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>Real-time road hazards in your area</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={`btn btn-sm ${showHeatmap ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setShowHeatmap(p => !p); }}
          >
            🔥 {showHeatmap ? 'Heatmap ON' : 'Heatmap OFF'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={fetchHazards}>🔄 Refresh</button>
        </div>
      </div>

      {/* Stat pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {[
          { key: 'total', label: `${stats.total} Total`, color: '#1a56db' },
          { key: 'critical', label: `${stats.critical} Critical`, color: '#dc2626' },
          { key: 'high', label: `${stats.high} High`, color: '#ea580c' },
          { key: 'medium', label: `${stats.medium} Medium`, color: '#d97706' },
          { key: 'low', label: `${stats.low} Low`, color: '#16a34a' },
        ].map(s => (
          <div key={s.key} style={{
            background: `${s.color}18`, border: `1px solid ${s.color}40`,
            color: s.color, padding: '4px 12px', borderRadius: 100,
            fontSize: 12, fontWeight: 600
          }}>{s.label}</div>
        ))}
      </div>

      {/* Filters */}
      <div className="map-filters" style={{ marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center', marginRight: 4 }}>Severity:</span>
        {['critical', 'high', 'medium', 'low'].map(s => (
          <button key={s} className={`filter-chip ${filters.severity.includes(s) ? 'active' : ''}`} onClick={() => toggleFilter('severity', s)}>
            {s}
          </button>
        ))}
        <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center', marginLeft: 8, marginRight: 4 }}>Status:</span>
        {['pending', 'in_progress', 'resolved'].map(s => (
          <button key={s} className={`filter-chip ${filters.status.includes(s) ? 'active' : ''}`} onClick={() => toggleFilter('status', s)}>
            {s.replace('_', ' ')}
          </button>
        ))}
        {(filters.severity.length > 0 || filters.status.length > 0) && (
          <button className="btn btn-ghost btn-sm" onClick={() => setFilters({ severity: [], status: [] })}>
            ✕ Clear
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, alignItems: 'start' }}>
        {/* Map Container */}
        <div className="card" style={{ overflow: 'hidden', height: 560 }}>
          {!GMAPS_KEY || GMAPS_KEY === 'your_google_maps_api_key_here' ? (
            <div style={{
              height: '100%', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-tertiary)', textAlign: 'center', padding: 32
            }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>🗺️</div>
              <h3 style={{ marginBottom: 8 }}>Google Maps Not Configured</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, maxWidth: 300, marginBottom: 16 }}>
                Add your Google Maps API key to <code>.env</code> as <code>REACT_APP_GOOGLE_MAPS_API_KEY</code> to see the interactive map.
              </p>
              <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 12, fontSize: 12, fontFamily: 'monospace', textAlign: 'left' }}>
                REACT_APP_GOOGLE_MAPS_API_KEY=your_key_here
              </div>
              <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                {loading ? 'Loading hazard data...' : `${hazards.length} hazards loaded from database`}
              </p>
            </div>
          ) : (
            <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
          )}
        </div>

        {/* Sidebar list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 560, overflowY: 'auto' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 2px' }}>
            Recent Hazards
          </div>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><div className="spinner" /></div>
          ) : hazards.length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}>
              <div style={{ fontSize: 32 }}>🛣️</div>
              <p style={{ fontSize: 13 }}>No hazards found</p>
            </div>
          ) : (
            hazards
              .filter(f => !filters.severity.length || filters.severity.includes(f.properties.severity))
              .slice(0, 20)
              .map(f => {
                const p = f.properties;
                const color = severityColors[p.severity] || '#1a56db';
                return (
                  <div
                    key={p.reportId}
                    className="card"
                    style={{ cursor: 'pointer', padding: 12, transition: 'all 0.15s', border: selectedHazard?.reportId === p.reportId ? `1px solid ${color}` : '1px solid var(--border-color)' }}
                    onClick={() => { setSelectedHazard(p); navigate(`/report/${p.id}`); }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize', marginBottom: 3 }}>
                          {issueIcons[p.issue]} {(p.issue || 'unknown').replace('_', ' ')}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{p.address || 'Location recorded'}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{new Date(p.createdAt).toLocaleDateString('en-IN')}</div>
                      </div>
                      <span className={`badge badge-${p.severity}`} style={{ flexShrink: 0 }}>{p.severity}</span>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="card" style={{ marginTop: 12, padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Legend:</span>
          {Object.entries(severityColors).map(([sev, col]) => (
            <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: col }} />
              <span style={{ fontSize: 12, textTransform: 'capitalize' }}>{sev}</span>
            </div>
          ))}
          <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
            Click a marker to view report details
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { MapPin, Filter, X, ChevronRight } from 'lucide-react';

// ── Colour helpers ────────────────────────────────────────────────────────────
const STATUS_COLOR = {
  Submitted:   '#6b7280', // gray
  Assigned:    '#2563eb', // blue
  InProgress:  '#f59e0b', // amber
  Resolved:    '#16a34a', // green
  Rejected:    '#dc2626', // red
};

function markerColor(issue) {
  return STATUS_COLOR[issue.status] ?? '#6b7280';
}

const STATUS_LABELS = Object.keys(STATUS_COLOR);

// ── Small badge ───────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const color = STATUS_COLOR[status] ?? '#6b7280';
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-white text-xs font-medium"
      style={{ backgroundColor: color }}
    >
      {status}
    </span>
  );
}

// ── Priority badge ────────────────────────────────────────────────────────────
const PRIORITY_BG = { High: 'bg-red-100 text-red-700', Medium: 'bg-yellow-100 text-yellow-700', Low: 'bg-green-100 text-green-700' };
function PriorityBadge({ priority }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_BG[priority] ?? 'bg-gray-100 text-gray-700'}`}>
      {priority}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function IssueMap() {
  const { issues } = useApp();
  const mapRef     = useRef(null);   // DOM div for the map
  const leafletMap = useRef(null);   // Leaflet map instance
  const markersRef = useRef({});     // id → L.circleMarker

  const [statusFilter,   setStatusFilter]   = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [selectedIssue,  setSelectedIssue]  = useState(null);
  const [sidebarOpen,    setSidebarOpen]    = useState(true);

  // Derive unique categories from data
  const categories = useMemo(() => {
    const cats = [...new Set(issues.map(i => i.category).filter(Boolean))];
    return ['All', ...cats];
  }, [issues]);

  // Filtered issues that have coordinates
  const mapped = useMemo(() => {
    return issues.filter(i => {
      const hasCoords = i.location_lat != null && i.location_lng != null;
      const byStatus  = statusFilter   === 'All' || i.status   === statusFilter;
      const byCat     = categoryFilter === 'All' || i.category === categoryFilter;
      return hasCoords && byStatus && byCat;
    });
  }, [issues, statusFilter, categoryFilter]);

  // Count helpers
  const total    = mapped.length;
  const open     = mapped.filter(i => i.status !== 'Resolved' && i.status !== 'Rejected').length;
  const resolved = mapped.filter(i => i.status === 'Resolved').length;

  // ── Initialise Leaflet map once ──────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;
    const L = window.L;
    if (!L) return;

    const map = L.map(mapRef.current, {
      center: [16.6944, 74.4615],
      zoom: 13,
      zoomControl: true,
    });
    leafletMap.current = map;

    // Satellite imagery (Esri World Imagery — no key required)
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        maxZoom: 19,
      }
    ).addTo(map);

    // Street-name labels overlay on top of satellite
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png',
      {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
        opacity: 0.85,
        pane: 'overlayPane',
      }
    ).addTo(map);

    return () => {
      map.remove();
      leafletMap.current = null;
      markersRef.current = {};
    };
  }, []);

  // ── Sync markers whenever filtered issues change ─────────────────────────
  useEffect(() => {
    const L = window.L;
    const map = leafletMap.current;
    if (!L || !map) return;

    // Remove all existing markers
    Object.values(markersRef.current).forEach(m => m.remove());
    markersRef.current = {};

    mapped.forEach(issue => {
      const color = markerColor(issue);
      const marker = L.circleMarker(
        [issue.location_lat, issue.location_lng],
        {
          radius: 9,
          fillColor: color,
          color: '#fff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9,
        }
      ).addTo(map);

      marker.bindPopup(
        `<div style="min-width:200px;font-family:sans-serif">
          <p style="font-size:11px;color:#6b7280;margin:0 0 2px">${issue.display_id ?? `#${issue.id}`}</p>
          <p style="font-weight:700;font-size:13px;margin:0 0 6px;color:#111">${issue.title}</p>
          <p style="font-size:12px;margin:0 0 2px"><b>Category:</b> ${issue.category ?? '—'}</p>
          <p style="font-size:12px;margin:0 0 2px"><b>Status:</b> ${issue.status}</p>
          <p style="font-size:12px;margin:0 0 2px"><b>Priority:</b> ${issue.priority ?? '—'}</p>
          <p style="font-size:12px;margin:0 0 2px"><b>Ward:</b> ${issue.ward ?? '—'}</p>
          <p style="font-size:12px;margin:0"><b>Reported by:</b> ${issue.reported_by_detail?.name ?? '—'}</p>
        </div>`,
        { maxWidth: 260 }
      );

      marker.on('click', () => setSelectedIssue(issue));
      markersRef.current[issue.id] = marker;
    });
  }, [mapped]);

  // ── Pan to issue when selected from sidebar list ──────────────────────────
  function panTo(issue) {
    const map = leafletMap.current;
    if (!map) return;
    map.setView([issue.location_lat, issue.location_lng], 16, { animate: true });
    markersRef.current[issue.id]?.openPopup();
    setSelectedIssue(issue);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-[#f1f5f9]">

      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0 flex-wrap">
        <div className="flex items-center gap-2 mr-2">
          <MapPin size={18} className="text-[#2563eb]" />
          <span className="font-semibold text-[#1e3a8a] text-sm">Issue Map</span>
        </div>

        {/* Stats */}
        <div className="flex gap-3 text-xs mr-auto flex-wrap">
          <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium">{total} pinned</span>
          <span className="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full font-medium">{open} open</span>
          <span className="bg-green-50 text-green-700 px-2.5 py-1 rounded-full font-medium">{resolved} resolved</span>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-gray-400" />

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30"
          >
            <option value="All">All Statuses</option>
            {STATUS_LABELS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* Category filter */}
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30"
          >
            {categories.map(c => <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>)}
          </select>

          {/* Toggle sidebar */}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {sidebarOpen ? 'Hide List' : 'Show List'}
          </button>
        </div>
      </div>

      {/* ── Map + Sidebar row ── */}
      <div className="flex flex-1 min-h-0 relative">

        {/* Sidebar issue list */}
        {sidebarOpen && (
          <div className="w-72 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{mapped.length} Issues</p>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {mapped.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm">
                  <MapPin size={28} className="mb-2 opacity-40" />
                  No issues with location data
                </div>
              )}
              {mapped.map(issue => (
                <button
                  key={issue.id}
                  onClick={() => panTo(issue)}
                  className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors group ${selectedIssue?.id === issue.id ? 'bg-blue-50 border-l-2 border-[#2563eb]' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400 mb-0.5">{issue.display_id ?? `#${issue.id}`}</p>
                      <p className="text-sm font-medium text-gray-800 truncate">{issue.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{issue.category ?? '—'} · Ward {issue.ward ?? '—'}</p>
                    </div>
                    <ChevronRight size={14} className="text-gray-300 group-hover:text-[#2563eb] mt-1 flex-shrink-0" />
                  </div>
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    <StatusBadge status={issue.status} />
                    {issue.priority && <PriorityBadge priority={issue.priority} />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Map container */}
        <div className="flex-1 relative min-w-0">
          <div ref={mapRef} className="w-full h-full" />

          {/* Legend */}
          <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 px-4 py-3 z-[400]">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Status Legend</p>
            <div className="space-y-1.5">
              {Object.entries(STATUS_COLOR).map(([status, color]) => (
                <div key={status} className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full border-2 border-white shadow-sm flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs text-gray-700">{status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Selected issue detail card */}
          {selectedIssue && (
            <div className="absolute top-4 left-4 w-64 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 p-4 z-[400]">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-xs text-gray-400">{selectedIssue.display_id ?? `#${selectedIssue.id}`}</p>
                  <p className="text-sm font-semibold text-gray-800 leading-tight">{selectedIssue.title}</p>
                </div>
                <button onClick={() => setSelectedIssue(null)} className="text-gray-400 hover:text-gray-600 ml-2 flex-shrink-0">
                  <X size={14} />
                </button>
              </div>
              <div className="flex gap-1.5 flex-wrap mb-3">
                <StatusBadge status={selectedIssue.status} />
                {selectedIssue.priority && <PriorityBadge priority={selectedIssue.priority} />}
              </div>
              <div className="space-y-1 text-xs text-gray-600">
                <p><span className="font-medium text-gray-500">Category:</span> {selectedIssue.category ?? '—'}</p>
                <p><span className="font-medium text-gray-500">Ward:</span> {selectedIssue.ward ?? '—'}</p>
                <p><span className="font-medium text-gray-500">Reporter:</span> {selectedIssue.reported_by_detail?.name ?? '—'}</p>
                {selectedIssue.assigned_to_detail?.name && (
                  <p><span className="font-medium text-gray-500">Worker:</span> {selectedIssue.assigned_to_detail.name}</p>
                )}
                {selectedIssue.ai_completion_score != null && (
                  <p><span className="font-medium text-gray-500">AI Score:</span> {selectedIssue.ai_completion_score}%</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useClient } from '../context/ClientContext';
import {
  MapPin, Navigation, CheckCircle, AlertCircle,
  Clock, Locate, Route,
} from 'lucide-react-native';
import { categoryIcons, statusConfig } from '../data/mockData';
import * as Location from 'expo-location';

// ─── Haversine distance (km) ───────────────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDist(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function formatEta(km) {
  const mins = Math.round((km / 25) * 60);
  if (mins < 1) return '<1 min';
  if (mins < 60) return `~${mins} min`;
  return `~${Math.floor(mins / 60)}h ${mins % 60}m`;
}

// ─── Route Optimisation ────────────────────────────────────────────────────────
function optimiseRoute(workerLat, workerLng, tasks) {
  const active = tasks.filter(t => !['Resolved', 'Closed'].includes(t.status));
  const done   = tasks.filter(t =>  ['Resolved', 'Closed'].includes(t.status));

  const tiers = [
    active.filter(t => t.priority === 'High'),
    active.filter(t => t.priority === 'Medium'),
    active.filter(t => t.priority === 'Low'),
  ];

  const ordered = [];
  let curLat = workerLat;
  let curLng = workerLng;

  for (const tier of tiers) {
    const remaining = [...tier];
    while (remaining.length > 0) {
      let bestIdx = 0;
      let bestDist = haversine(curLat, curLng, remaining[0].lat, remaining[0].lng);
      for (let i = 1; i < remaining.length; i++) {
        const d = haversine(curLat, curLng, remaining[i].lat, remaining[i].lng);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      const chosen = remaining.splice(bestIdx, 1)[0];
      ordered.push({ ...chosen, distFromPrev: bestDist });
      curLat = chosen.lat;
      curLng = chosen.lng;
    }
  }

  return [...ordered, ...done.map(t => ({ ...t, distFromPrev: null }))];
}

// ─── Fallback coords for known Ichalkaranji locations ─────────────────────────
const LOCATION_COORDS = {
  'Nehru Chowk, Main Road, Ichalkaranji': { lat: 18.5204, lng: 73.8567 },
  'Sadar Bazar, Near Textile Market':      { lat: 18.5100, lng: 73.8700 },
  'Near Ichalkaranji Bus Stand':           { lat: 18.5590, lng: 73.7868 },
  'Kasba Peth Road, Near Old Market':      { lat: 18.5362, lng: 73.8940 },
};

const DEFAULT_WORKER = { lat: 18.535, lng: 73.855 };
const CITY_CENTER    = { lat: 16.6925, lng: 74.4191 }; // Ichalkaranji centre
const PRIORITY_COLORS = { High: '#ef4444', Medium: '#f97316', Low: '#22c55e' };

// Parse "16.6925° N, 74.4191° E" strings stored as location_text when lat/lng is null
function parseCoordString(text) {
  if (!text) return null;
  const m = text.match(/([\d.]+)°?\s*N[,\s]+([\d.]+)°?\s*E/i);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  return null;
}

// ─── Leaflet HTML (injected into WebView) ─────────────────────────────────────
// Uses Esri WorldImagery (free satellite, no API key) + OpenStreetMap labels overlay.
function buildLeafletHtml(workerPos, routedTasks, stepMap) {
  // Build JS arrays we'll inject
  const workerJson = JSON.stringify(workerPos);

  const markersJson = JSON.stringify(
    routedTasks.map(t => ({
      id:       t.id,
      lat:      t.lat,
      lng:      t.lng,
      title:    t.title,
      priority: t.priority,
      status:   t.status,
      location: t.location,
      step:     stepMap[t.id] ?? null,
      isDone:   ['Resolved', 'Closed'].includes(t.status),
      color:    ['Resolved', 'Closed'].includes(t.status)
                  ? '#9ca3af'
                  : (PRIORITY_COLORS[t.priority] || '#6b7280'),
    }))
  );

  // Route coords: worker → active tasks in order
  const activeTasks = routedTasks.filter(t => !['Resolved', 'Closed'].includes(t.status));
  const routeCoords = JSON.stringify([
    [workerPos.lat, workerPos.lng],
    ...activeTasks.map(t => [t.lat, t.lng]),
  ]);

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body, #map { width: 100%; height: 100%; }
  /* Custom marker styles */
  .task-pin {
    width: 32px; height: 40px;
    display: flex; flex-direction: column;
    align-items: center;
  }
  .pin-circle {
    width: 32px; height: 32px; border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    border: 2.5px solid white;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.45);
  }
  .pin-label {
    transform: rotate(45deg);
    color: white; font-weight: 800; font-size: 13px;
    font-family: sans-serif; line-height: 1;
  }
  .worker-pin {
    width: 22px; height: 22px; border-radius: 50%;
    background: #2563eb; border: 3px solid white;
    box-shadow: 0 0 0 4px rgba(37,99,235,0.35), 0 2px 8px rgba(0,0,0,0.4);
  }
</style>
</head>
<body>
<div id="map"></div>
<script>
(function() {
  var workerPos  = ${workerJson};
  var markers    = ${markersJson};
  var routeCoords= ${routeCoords};

  // Determine initial map centre: average of all points
  var allLats = markers.map(function(m){ return m.lat; }).concat([workerPos.lat]);
  var allLngs = markers.map(function(m){ return m.lng; }).concat([workerPos.lng]);
  var centerLat = allLats.reduce(function(a,b){ return a+b; }, 0) / allLats.length;
  var centerLng = allLngs.reduce(function(a,b){ return a+b; }, 0) / allLngs.length;

  var map = L.map('map', {
    center: [centerLat, centerLng],
    zoom: markers.length === 0 ? 13 : 14,
    zoomControl: true,
    attributionControl: false,
  });

  // ── Satellite base layer (Esri WorldImagery — free, no API key) ──────────
  L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19, opacity: 1 }
  ).addTo(map);

  // ── Roads/labels overlay (OpenStreetMap hybrid labels) ───────────────────
  L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { maxZoom: 19, opacity: 0.28 }
  ).addTo(map);

  // ── Route polyline ───────────────────────────────────────────────────────
  if (routeCoords.length > 1) {
    L.polyline(routeCoords, {
      color: '#3b82f6',
      weight: 3.5,
      opacity: 0.85,
      dashArray: '10, 7',
      lineJoin: 'round',
    }).addTo(map);
  }

  // ── Task markers ─────────────────────────────────────────────────────────
  markers.forEach(function(m) {
    var label = m.isDone ? '✓' : (m.step !== null ? String(m.step) : '?');
    var html =
      '<div class="task-pin">' +
        '<div class="pin-circle" style="background:' + m.color + '">' +
          '<span class="pin-label">' + label + '</span>' +
        '</div>' +
      '</div>';

    var icon = L.divIcon({
      html: html,
      className: '',
      iconSize: [32, 40],
      iconAnchor: [16, 40],
      popupAnchor: [0, -42],
    });

    var marker = L.marker([m.lat, m.lng], { icon: icon }).addTo(map);
    marker.on('click', function() {
      // Send tap event back to React Native
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'pinTap', id: m.id }));
    });
  });

  // ── Worker marker ────────────────────────────────────────────────────────
  var workerIcon = L.divIcon({
    html: '<div class="worker-pin"></div>',
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
  L.marker([workerPos.lat, workerPos.lng], { icon: workerIcon, zIndexOffset: 1000 }).addTo(map);

  // ── Fit bounds to all markers + worker ───────────────────────────────────
  if (markers.length > 0) {
    var bounds = markers.map(function(m){ return [m.lat, m.lng]; });
    bounds.push([workerPos.lat, workerPos.lng]);
    map.fitBounds(bounds, { padding: [40, 40] });
  }

  // ── Listen for worker position updates from RN ───────────────────────────
  document.addEventListener('message', function(e) {
    try {
      var msg = JSON.parse(e.data);
      if (msg.type === 'updateWorker') {
        // Re-centre worker dot (future: move marker)
      }
    } catch(_) {}
  });
})();
</script>
</body>
</html>`;
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function WorkerMap() {
  const { myTasks } = useClient();
  const [selectedId, setSelectedId] = useState(null);
  const [workerPos, setWorkerPos]   = useState(DEFAULT_WORKER);
  const [gpsStatus, setGpsStatus]   = useState('idle');
  const locationSub = useRef(null);
  const webviewRef  = useRef(null);

  // ── GPS ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setGpsStatus('requesting');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (!cancelled) setGpsStatus('denied');
        return;
      }
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) {
          setWorkerPos({ lat: loc.coords.latitude, lng: loc.coords.longitude });
          setGpsStatus('live');
        }
      } catch (_) {
        if (!cancelled) setGpsStatus('denied');
        return;
      }
      locationSub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 20 },
        loc => {
          if (!cancelled) {
            setWorkerPos({ lat: loc.coords.latitude, lng: loc.coords.longitude });
            setGpsStatus('live');
          }
        }
      );
    })();
    return () => {
      cancelled = true;
      locationSub.current?.remove();
    };
  }, []);

  // ── Coords ───────────────────────────────────────────────────────────────
  const tasksWithCoords = myTasks.map(t => {
    let coords = null;
    // 1. Prefer DB lat/lng (saved since the fix)
    if (t.lat != null && t.lng != null) {
      coords = { lat: t.lat, lng: t.lng };
    }
    // 2. Try parsing "16.6925° N, 74.4191° E" style location_text
    if (!coords) coords = parseCoordString(t.location);
    // 3. Known address lookup
    if (!coords) coords = LOCATION_COORDS[t.location] || null;
    // 4. City-centre default (far better than a random offset near Pune)
    if (!coords) coords = { ...CITY_CENTER };
    return { ...t, ...coords };
  });

  // ── Route optimisation ───────────────────────────────────────────────────
  const routedTasks = optimiseRoute(workerPos.lat, workerPos.lng, tasksWithCoords);
  const activeTasks = routedTasks.filter(t => !['Resolved', 'Closed'].includes(t.status));
  const stepMap = {};
  activeTasks.forEach((t, i) => { stepMap[t.id] = i + 1; });

  const selectedTask = routedTasks.find(t => t.id === selectedId) || null;
  const selectedStep = selectedTask ? stepMap[selectedTask.id] : null;

  // ── Stats ────────────────────────────────────────────────────────────────
  const totalCount   = tasksWithCoords.length;
  const activeCount  = tasksWithCoords.filter(t => t.status === 'In Progress').length;
  const doneCount    = tasksWithCoords.filter(t => ['Resolved', 'Closed'].includes(t.status)).length;
  const pendingCount = tasksWithCoords.filter(t => t.status === 'Assigned').length;
  const totalDist    = activeTasks.reduce((s, t) => s + (t.distFromPrev || 0), 0);

  // ── Leaflet HTML (rebuilt when worker/tasks change) ──────────────────────
  const mapHtml = buildLeafletHtml(workerPos, routedTasks, stepMap);

  // ── Handle messages from WebView ─────────────────────────────────────────
  const onWebViewMessage = useCallback(e => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'pinTap') {
        setSelectedId(prev => prev === msg.id ? null : msg.id);
      }
    } catch (_) {}
  }, []);

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <Navigation size={18} color="#60a5fa" />
          <View style={{ flex: 1 }}>
            <Text style={styles.titleText}>Task Map</Text>
            <Text style={styles.titleSub}>
              {totalCount} task{totalCount !== 1 ? 's' : ''} · {activeTasks.length} to visit
            </Text>
          </View>
          <View style={styles.gpsBadge}>
            {gpsStatus === 'requesting' && <ActivityIndicator size="small" color="#60a5fa" />}
            {gpsStatus === 'live'       && <View style={styles.gpsDot} />}
            {gpsStatus === 'denied'     && <Locate size={13} color="#f87171" />}
            <Text style={[
              styles.gpsText,
              gpsStatus === 'live'   ? { color: '#4ade80' } :
              gpsStatus === 'denied' ? { color: '#f87171' } :
                                       { color: '#94a3b8' },
            ]}>
              {gpsStatus === 'live'
                ? 'GPS Live'
                : gpsStatus === 'denied'
                ? 'GPS Off'
                : 'Locating…'}
            </Text>
          </View>
        </View>
      </View>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        {[
          { icon: <AlertCircle size={14} color="#f97316" />, label: 'Pending',  val: pendingCount, color: '#f97316' },
          { icon: <Clock       size={14} color="#2563eb"  />, label: 'Active',   val: activeCount,  color: '#2563eb' },
          { icon: <CheckCircle size={14} color="#16a34a"  />, label: 'Done',     val: doneCount,    color: '#16a34a' },
        ].map(s => (
          <View key={s.label} style={styles.statItem}>
            {s.icon}
            <Text style={[styles.statVal, { color: s.color }]}>{s.val}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Route summary strip */}
      {activeTasks.length > 0 && (
        <View style={styles.routeStrip}>
          <Route size={13} color="#2563eb" />
          <Text style={styles.routeStripText}>
            Optimised · {activeTasks.length} stop{activeTasks.length !== 1 ? 's' : ''} · {formatDist(totalDist)} total
          </Text>
          <Text style={styles.routeStripEta}>{formatEta(totalDist)}</Text>
        </View>
      )}

      {/* Satellite map (WebView + Leaflet) */}
      <View style={styles.mapWrapper}>
        <WebView
          ref={webviewRef}
          originWhitelist={['*']}
          source={{ html: mapHtml }}
          style={styles.webview}
          onMessage={onWebViewMessage}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          renderLoading={() => (
            <View style={styles.mapLoader}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.mapLoaderText}>Loading satellite map…</Text>
            </View>
          )}
        />
      </View>

      {/* Selected task info panel */}
      {selectedTask && (
        <View style={styles.infoPanel}>
          {selectedStep != null && (
            <View style={[styles.stepBadge, { backgroundColor: PRIORITY_COLORS[selectedTask.priority] || '#6b7280' }]}>
              <Text style={styles.stepBadgeText}>#{selectedStep}</Text>
            </View>
          )}
          <View style={styles.infoPanelIcon}>
            <Text style={{ fontSize: 20 }}>{categoryIcons[selectedTask.category]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoPanelTitle} numberOfLines={1}>{selectedTask.title}</Text>
            <View style={styles.infoPanelMeta}>
              <MapPin size={11} color="#9ca3af" />
              <Text style={styles.infoPanelLocation} numberOfLines={1}>{selectedTask.location}</Text>
            </View>
            {selectedTask.distFromPrev != null && (
              <View style={styles.distRow}>
                <Navigation size={11} color="#2563eb" />
                <Text style={styles.distText}>
                  {formatDist(selectedTask.distFromPrev)} · {formatEta(selectedTask.distFromPrev)}
                </Text>
              </View>
            )}
            <View style={styles.infoBadges}>
              <View style={[
                styles.priorityChip,
                selectedTask.priority === 'High'   ? { backgroundColor: '#fee2e2' } :
                selectedTask.priority === 'Medium' ? { backgroundColor: '#ffedd5' } :
                                                     { backgroundColor: '#dcfce7' },
              ]}>
                <Text style={[
                  styles.priorityChipText,
                  selectedTask.priority === 'High'   ? { color: '#b91c1c' } :
                  selectedTask.priority === 'Medium' ? { color: '#c2410c' } :
                                                       { color: '#15803d' },
                ]}>{selectedTask.priority}</Text>
              </View>
              <View style={[styles.statusChip, { backgroundColor: statusConfig[selectedTask.status]?.bg || '#f3f4f6' }]}>
                <View style={[styles.statusDot, { backgroundColor: statusConfig[selectedTask.status]?.dot || '#9ca3af' }]} />
                <Text style={[styles.statusChipText, { color: statusConfig[selectedTask.status]?.text || '#6b7280' }]}>
                  {selectedTask.status}
                </Text>
              </View>
            </View>
          </View>
          <TouchableOpacity onPress={() => setSelectedId(null)} style={styles.infoPanelClose}>
            <Text style={styles.infoPanelCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Task list (ordered by optimised route) */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.listLabel}>VISIT ORDER — OPTIMISED ROUTE</Text>
        <View style={{ gap: 8 }}>
          {routedTasks.map(task => {
            const isResolved = ['Resolved', 'Closed'].includes(task.status);
            const isSelected = selectedId === task.id;
            const step       = stepMap[task.id];
            const pinColor   = isResolved ? '#9ca3af' : (PRIORITY_COLORS[task.priority] || '#6b7280');

            return (
              <TouchableOpacity
                key={task.id}
                style={[styles.listItem, isSelected ? styles.listItemSelected : styles.listItemDefault]}
                onPress={() => setSelectedId(task.id === selectedId ? null : task.id)}
                activeOpacity={0.85}
              >
                <View style={[styles.listPin, { backgroundColor: pinColor }]}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
                    {isResolved ? '✓' : (step != null ? String(step) : '?')}
                  </Text>
                </View>
                <Text style={{ fontSize: 19 }}>{categoryIcons[task.category]}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listTitle} numberOfLines={1}>{task.title}</Text>
                  <View style={styles.listMeta}>
                    <MapPin size={10} color="#9ca3af" />
                    <Text style={styles.listLocation} numberOfLines={1}>{task.location}</Text>
                  </View>
                  {task.distFromPrev != null && !isResolved && (
                    <View style={styles.listDistRow}>
                      <Navigation size={9} color="#2563eb" />
                      <Text style={styles.listDistText}>{formatDist(task.distFromPrev)}</Text>
                    </View>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <View style={[styles.listStatusBadge, { backgroundColor: statusConfig[task.status]?.bg || '#f3f4f6' }]}>
                    <Text style={[styles.listStatusText, { color: statusConfig[task.status]?.text || '#6b7280' }]} numberOfLines={1}>
                      {task.status}
                    </Text>
                  </View>
                  {!isResolved && (
                    <View style={[styles.priorityTag, { backgroundColor: pinColor + '22' }]}>
                      <Text style={[styles.priorityTagText, { color: pinColor }]}>{task.priority}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#f1f5f9' },

  header:        { backgroundColor: '#1e293b', paddingTop: 48, paddingBottom: 14, paddingHorizontal: 20 },
  headerTitle:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleText:     { color: '#fff', fontWeight: '700', fontSize: 16 },
  titleSub:      { color: '#94a3b8', fontSize: 11, marginTop: 1 },

  gpsBadge:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  gpsDot:        { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ade80' },
  gpsText:       { fontSize: 11, fontWeight: '600' },

  statsBar:      { flexDirection: 'row', backgroundColor: '#1e293b', paddingBottom: 16, paddingHorizontal: 20 },
  statItem:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, paddingVertical: 10, marginHorizontal: 4 },
  statVal:       { fontSize: 15, fontWeight: '700' },
  statLabel:     { fontSize: 10, color: '#94a3b8', fontWeight: '500' },

  routeStrip:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#eff6ff', paddingHorizontal: 16, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#dbeafe' },
  routeStripText:{ flex: 1, fontSize: 12, color: '#1d4ed8', fontWeight: '500' },
  routeStripEta: { fontSize: 12, color: '#2563eb', fontWeight: '700' },

  mapWrapper:    { height: 300, backgroundColor: '#1e293b' },
  webview:       { flex: 1 },
  mapLoader:     { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e293b', gap: 12 },
  mapLoaderText: { color: '#94a3b8', fontSize: 13 },

  infoPanel:     { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0', padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepBadge:     { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0 },
  stepBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  infoPanelIcon: { width: 40, height: 40, backgroundColor: '#f3f4f6', borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  infoPanelTitle:{ fontSize: 13, fontWeight: '600', color: '#1f2937' },
  infoPanelMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  infoPanelLocation: { fontSize: 11, color: '#9ca3af', flex: 1 },
  distRow:       { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  distText:      { fontSize: 11, color: '#2563eb', fontWeight: '600' },
  infoBadges:    { flexDirection: 'row', gap: 8, marginTop: 6 },
  priorityChip:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  priorityChipText: { fontSize: 11, fontWeight: '600' },
  statusChip:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusDot:     { width: 5, height: 5, borderRadius: 3 },
  statusChipText:{ fontSize: 11, fontWeight: '500' },
  infoPanelClose:{ padding: 4 },
  infoPanelCloseText: { fontSize: 16, color: '#9ca3af', fontWeight: '600' },

  scroll:        { flex: 1 },
  scrollContent: { padding: 16 },

  listLabel:     { fontSize: 10, fontWeight: '700', color: '#6b7280', letterSpacing: 0.5, marginBottom: 10 },
  listItem:      { backgroundColor: '#fff', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1 },
  listItemDefault:  { borderColor: '#f3f4f6', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 },
  listItemSelected: { borderColor: '#60a5fa', shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
  listPin:       { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  listTitle:     { fontSize: 13, fontWeight: '500', color: '#1f2937' },
  listMeta:      { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  listLocation:  { fontSize: 11, color: '#9ca3af', flex: 1 },
  listDistRow:   { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  listDistText:  { fontSize: 10, color: '#2563eb', fontWeight: '600' },
  listStatusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  listStatusText:  { fontSize: 10, fontWeight: '600' },
  priorityTag:     { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20 },
  priorityTagText: { fontSize: 10, fontWeight: '600' },
});

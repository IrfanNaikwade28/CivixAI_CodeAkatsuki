import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Card, Button } from '../components/ui/index.jsx';
import { Trash2, AlertTriangle, CheckCircle, RefreshCw, Zap } from 'lucide-react';

// Derive display status from fill_level (real API only gives fill_level as a number)
function binStatus(fillLevel) {
  if (fillLevel >= 85) return 'Overflow';
  if (fillLevel >= 70) return 'Near Capacity';
  return 'Normal';
}

function BinCard({ bin, onClick, selected }) {
  const fill = bin.fill_level ?? 0;
  const status = binStatus(fill);

  const statusConfig = {
    Normal: { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700', bar: 'bg-green-500', label: 'Normal' },
    'Near Capacity': { bg: 'bg-yellow-50 border-yellow-200', dot: 'bg-yellow-500', text: 'text-yellow-700', bar: 'bg-yellow-500', label: 'Near Capacity' },
    Overflow: { bg: 'bg-red-50 border-red-200', dot: 'bg-red-500', text: 'text-red-700', bar: 'bg-red-500', label: 'Overflow' },
  };
  const cfg = statusConfig[status];

  return (
    <div
      onClick={() => onClick(bin)}
      className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${cfg.bg}
        ${selected?.id === bin.id ? 'ring-2 ring-offset-2 ring-blue-500' : 'hover:shadow-md'}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-gray-800 text-sm">{bin.display_id || bin.id}</p>
          <p className="text-xs text-gray-500 mt-0.5">{bin.location_text}</p>
        </div>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${cfg.dot}`}>
          {status === 'Overflow' ? <AlertTriangle size={14} className="text-white" /> :
           status === 'Near Capacity' ? <Trash2 size={14} className="text-white" /> :
           <CheckCircle size={14} className="text-white" />}
        </div>
      </div>

      {/* Circular fill */}
      <div className="flex items-center gap-3 mb-3">
        <div className="relative w-14 h-14">
          <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15.9" fill="none"
              stroke={status === 'Overflow' ? '#ef4444' : status === 'Near Capacity' ? '#f59e0b' : '#22c55e'}
              strokeWidth="3"
              strokeDasharray={`${fill} 100`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-xs font-bold ${cfg.text}`}>{fill}%</span>
          </div>
        </div>
        <div>
          <p className={`text-xs font-semibold ${cfg.text}`}>{cfg.label}</p>
          <p className="text-xs text-gray-400">{bin.ward}</p>
          <p className="text-xs text-gray-400">Worker: {bin.assigned_worker_name || '—'}</p>
        </div>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className={`h-2 rounded-full ${cfg.bar}`} style={{ width: `${fill}%` }} />
      </div>
    </div>
  );
}

export default function GarbageMonitoring() {
  const { bins, updateBinLevel } = useApp();
  const [selected, setSelected] = useState(null);
  const [simLevel, setSimLevel] = useState('');
  const [filter, setFilter] = useState('All');

  // Enrich bins with derived status for filtering
  const enriched = bins.map(b => ({ ...b, _status: binStatus(b.fill_level ?? 0) }));
  const filtered = filter === 'All' ? enriched : enriched.filter(b => b._status === filter);

  const overflow = enriched.filter(b => b._status === 'Overflow').length;
  const nearCapacity = enriched.filter(b => b._status === 'Near Capacity').length;
  const normal = enriched.filter(b => b._status === 'Normal').length;

  const handleSimulate = () => {
    if (!selected || simLevel === '') return;
    const level = Math.min(100, Math.max(0, parseInt(simLevel)));
    updateBinLevel(selected.id, level);
    setSelected(prev => ({ ...prev, fill_level: level }));
    setSimLevel('');
  };

  const handleMarkCollected = () => {
    updateBinLevel(selected.id, 5);
    setSelected(prev => ({ ...prev, fill_level: 5 }));
  };

  // Get selected bin's derived status for display
  const selectedStatus = selected ? binStatus(selected.fill_level ?? 0) : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Garbage Monitoring</h2>
        <p className="text-gray-500 text-sm mt-1">Real-time bin fill level simulation across wards</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <AlertTriangle size={18} className="text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-600">{overflow}</p>
          <p className="text-xs text-gray-500">Overflow</p>
        </Card>
        <Card className="p-4 text-center">
          <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <Trash2 size={18} className="text-yellow-600" />
          </div>
          <p className="text-2xl font-bold text-yellow-600">{nearCapacity}</p>
          <p className="text-xs text-gray-500">Near Capacity</p>
        </Card>
        <Card className="p-4 text-center">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <CheckCircle size={18} className="text-green-500" />
          </div>
          <p className="text-2xl font-bold text-green-600">{normal}</p>
          <p className="text-xs text-gray-500">Normal</p>
        </Card>
      </div>

      <div className="flex gap-6">
        {/* Bin Grid */}
        <div className="flex-1">
          {/* Filter tabs */}
          <div className="flex gap-2 mb-4">
            {['All', 'Overflow', 'Near Capacity', 'Normal'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                  ${filter === f ? 'bg-[#1e3a8a] text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(bin => (
              <BinCard
                key={bin.id}
                bin={bin}
                onClick={setSelected}
                selected={selected}
              />
            ))}
          </div>
        </div>

        {/* Simulation Panel */}
        {selected && (
          <div className="w-72 flex-shrink-0">
            <Card className="p-5 sticky top-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800">Bin Detail</h3>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
              </div>

              <div className="space-y-3 mb-5">
                <div>
                  <p className="text-xs text-gray-500">BIN ID</p>
                  <p className="text-sm font-semibold text-gray-800">{selected.display_id || selected.id}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">LOCATION</p>
                  <p className="text-sm text-gray-800">{selected.location_text}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">WARD</p>
                  <p className="text-sm text-gray-800">{selected.ward}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">FILL LEVEL</p>
                  <p className={`text-2xl font-bold ${
                    (selected.fill_level ?? 0) >= 85 ? 'text-red-600' :
                    (selected.fill_level ?? 0) >= 70 ? 'text-yellow-600' : 'text-green-600'
                  }`}>{selected.fill_level ?? 0}%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">STATUS</p>
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium
                    ${selectedStatus === 'Overflow' ? 'bg-red-100 text-red-700' :
                      selectedStatus === 'Near Capacity' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'}`}>
                    {selectedStatus}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500">ASSIGNED WORKER</p>
                  <p className="text-sm text-gray-800">{selected.assigned_worker_name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">LAST COLLECTED</p>
                  <p className="text-sm text-gray-800">
                    {selected.last_collected
                      ? new Date(selected.last_collected).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
                      : '—'}
                  </p>
                </div>
              </div>

              {/* Simulation */}
              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Zap size={14} className="text-blue-600" />
                  <p className="text-xs font-semibold text-gray-700">SIMULATE FILL LEVEL</p>
                </div>
                <p className="text-xs text-gray-500 mb-2">PATCH /bins/{selected.id}/ — fill_level</p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0" max="100"
                    value={simLevel}
                    onChange={e => setSimLevel(e.target.value)}
                    placeholder="0–100%"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                  <Button size="sm" onClick={handleSimulate}>Set</Button>
                </div>

                {selectedStatus === 'Overflow' && (
                  <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-xs text-red-700 font-medium">Overflow Alert Active</p>
                    <p className="text-xs text-red-600 mt-1">Priority boosted · Worker notified · Admin alerted</p>
                  </div>
                )}

                <Button
                  size="sm"
                  variant="success"
                  className="w-full mt-3 justify-center"
                  onClick={handleMarkCollected}
                >
                  <RefreshCw size={13} /> Mark Collected
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Geographic SVG Map */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-1">Geographic Bin Map — Ichalkaranji</h3>
        <p className="text-xs text-gray-400 mb-4">Actual lat/lng positions · Click a dot to select bin</p>
        <div className="relative bg-gradient-to-br from-blue-50 to-slate-100 rounded-xl overflow-hidden border border-gray-200">
          <svg
            viewBox="0 0 600 400"
            className="w-full"
            style={{ display: 'block' }}
          >
            {/* Map background grid lines */}
            {[1,2,3].map(i => (
              <line key={`h${i}`} x1="0" y1={i*100} x2="600" y2={i*100} stroke="#e2e8f0" strokeWidth="1" />
            ))}
            {[1,2,3,4,5].map(i => (
              <line key={`v${i}`} x1={i*100} y1="0" x2={i*100} y2="400" stroke="#e2e8f0" strokeWidth="1" />
            ))}

            {/* City label */}
            <text x="10" y="18" fill="#94a3b8" fontSize="11" fontFamily="sans-serif">Ichalkaranji Municipal Area</text>

            {/* Lat/Lng corner labels */}
            <text x="4" y="396" fill="#cbd5e1" fontSize="9" fontFamily="sans-serif">16.685°N 74.455°E</text>
            <text x="480" y="14" fill="#cbd5e1" fontSize="9" fontFamily="sans-serif">16.705°N 74.470°E</text>

            {/* Bin dots — geo-projected */}
            {bins.map(bin => {
              // Ichalkaranji bounding box
              const LAT_MIN = 16.685, LAT_MAX = 16.705;
              const LNG_MIN = 74.455, LNG_MAX = 74.470;
              const SVG_W = 600, SVG_H = 400;
              const x = ((bin.location_lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * SVG_W;
              // lat increases upward, SVG y increases downward
              const y = SVG_H - ((bin.location_lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * SVG_H;
              const st = binStatus(bin.fill_level ?? 0);
              const color = st === 'Overflow' ? '#ef4444' : st === 'Near Capacity' ? '#f59e0b' : '#22c55e';
              const isSelected = selected?.id === bin.id;
              return (
                <g key={bin.id} onClick={() => setSelected(bin)} style={{ cursor: 'pointer' }}>
                  {isSelected && (
                    <circle cx={x} cy={y} r="14" fill={color} opacity="0.2" />
                  )}
                  <circle
                    cx={x} cy={y} r={isSelected ? 10 : 8}
                    fill={color}
                    stroke="white"
                    strokeWidth={isSelected ? 2.5 : 2}
                    style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.3))' }}
                  />
                  <text
                    x={x} y={y - 13}
                    textAnchor="middle"
                    fill="#374151"
                    fontSize="9"
                    fontWeight="600"
                    fontFamily="sans-serif"
                    style={{ pointerEvents: 'none' }}
                  >
                    {bin.display_id || bin.id}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Legend */}
          <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm rounded-lg p-2 flex flex-col gap-1.5 text-xs shadow-sm border border-gray-100">
            <div className="flex items-center gap-2"><span className="w-3 h-3 bg-green-500 rounded-full" />Normal</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 bg-yellow-400 rounded-full" />Near Capacity</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 bg-red-500 rounded-full" />Overflow</div>
          </div>
        </div>
      </Card>
    </div>
  );
}

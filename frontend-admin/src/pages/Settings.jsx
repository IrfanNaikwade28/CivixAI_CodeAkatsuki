import { Card, Button } from '../components/ui/index.jsx';
import { Settings as SettingsIcon, Sliders, Bell, Shield, Database } from 'lucide-react';
import { useState } from 'react';

export default function Settings() {
  const [weights, setWeights] = useState({
    baseWeight: 50,
    timeFactor: 30,
    wardFrequency: 20,
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
        <p className="text-gray-500 text-sm mt-1">Configure system behavior and priority weights</p>
      </div>

      {/* Priority Engine */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Sliders size={18} className="text-blue-700" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Priority Engine Weights</h3>
            <p className="text-xs text-gray-500">Configure how priority scores are calculated</p>
          </div>
        </div>

        <div className="space-y-5">
          {[
            { key: 'baseWeight', label: 'Category Base Weight', desc: 'Weight given to the issue category type' },
            { key: 'timeFactor', label: 'Time Pending Factor', desc: 'Weight given to how long issue has been open' },
            { key: 'wardFrequency', label: 'Ward Complaint Frequency', desc: 'Weight given to complaint density in ward' },
          ].map(({ key, label, desc }) => (
            <div key={key}>
              <div className="flex justify-between items-center mb-2">
                <div>
                  <p className="text-sm font-medium text-gray-800">{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
                <span className="text-lg font-bold text-[#1e3a8a] w-12 text-right">{weights[key]}%</span>
              </div>
              <input
                type="range" min="0" max="100"
                value={weights[key]}
                onChange={e => setWeights(prev => ({ ...prev, [key]: parseInt(e.target.value) }))}
                className="w-full accent-blue-700"
              />
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-xs text-blue-700 font-medium">Formula:</p>
          <p className="text-xs text-blue-600 font-mono mt-1">
            Score = (Base × {weights.baseWeight/100}) + (Time × {weights.timeFactor/100}) + (Ward × {weights.wardFrequency/100})
          </p>
        </div>

        <Button className="mt-4" onClick={handleSave}>
          {saved ? '✓ Saved!' : 'Save Changes'}
        </Button>
      </Card>

      {/* Notifications */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Bell size={18} className="text-orange-600" />
          </div>
          <h3 className="font-semibold text-gray-900">Notification Thresholds</h3>
        </div>
        <div className="space-y-3">
          {[
            { label: 'Garbage Overflow Alert', desc: 'Trigger alert when bin fill > 85%', default: true },
            { label: 'Unassigned High Priority', desc: 'Alert if high priority issue unassigned > 2 hours', default: true },
            { label: 'Worker Overload Alert', desc: 'Alert when worker has > 4 open tasks', default: false },
            { label: 'Daily Summary Email', desc: 'Send daily issue summary to admin', default: true },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-800">{item.label}</p>
                <p className="text-xs text-gray-400">{item.desc}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked={item.default} className="sr-only peer" />
                <div className="w-10 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-all peer-checked:after:translate-x-5"></div>
              </label>
            </div>
          ))}
        </div>
      </Card>

      {/* System Info */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-slate-100 rounded-lg">
            <Database size={18} className="text-slate-600" />
          </div>
          <h3 className="font-semibold text-gray-900">System Information</h3>
        </div>
        <div className="space-y-2 text-sm">
          {[
            { label: 'Platform', value: 'CivixAI v1.0' },
            { label: 'Municipality', value: 'Ichalkaranji Municipal Corporation' },
            { label: 'Mode', value: 'Live API' },
            { label: 'Backend', value: 'Django REST Framework — http://localhost:8000' },
          ].map(row => (
            <div key={row.label} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
              <span className="text-gray-500">{row.label}</span>
              <span className="font-medium text-gray-800">{row.value}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Card } from '../components/ui/index.jsx';
import { useApp } from '../context/AppContext';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  apiGetCategoryTrend, apiGetResolutionTrend, apiGetWardAnalytics,
} from '../services/api';
import { Download } from 'lucide-react';

const COLORS = ['#2563eb', '#0ea5e9', '#f59e0b', '#16a34a', '#8b5cf6', '#ec4899'];

export default function Reports() {
  const { issues, workers } = useApp();

  const [categoryTrend, setCategoryTrend] = useState([]);
  const [resolutionTrend, setResolutionTrend] = useState([]);
  const [wardAnalytics, setWardAnalytics] = useState([]);

  useEffect(() => {
    Promise.all([
      apiGetCategoryTrend(),
      apiGetResolutionTrend(),
      apiGetWardAnalytics(),
    ]).then(([cat, res, wards]) => {
      setCategoryTrend(Array.isArray(cat) ? cat : (cat.results || []));
      setResolutionTrend(Array.isArray(res) ? res : (res.results || []));
      setWardAnalytics(Array.isArray(wards) ? wards : (wards.results || []));
    }).catch(e => console.error('Reports analytics error', e));
  }, []);

  const catMap = {};
  issues.forEach(i => { catMap[i.category] = (catMap[i.category] || 0) + 1; });
  const pieData = Object.entries(catMap).map(([name, value]) => ({ name, value }));

  const wardData = wardAnalytics.map(w => ({
    ward: String(w.id).replace('Ward ', 'W'),
    total: w.totalIssues,
    resolved: w.resolved,
    pending: w.pending,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Reports & Analytics</h2>
          <p className="text-gray-500 text-sm mt-1">System-wide performance insights</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#1e3a8a] text-white rounded-lg text-sm font-medium hover:bg-blue-800 transition-colors">
          <Download size={15} /> Export Report
        </button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Issues', value: issues.length, color: 'text-blue-700' },
          { label: 'Resolution Rate', value: issues.length ? `${Math.round((issues.filter(i => ['Resolved','Closed'].includes(i.status)).length / issues.length) * 100)}%` : '0%', color: 'text-green-600' },
          { label: 'High Priority', value: issues.filter(i => i.priority === 'High').length, color: 'text-red-600' },
          { label: 'Active Workers', value: workers.filter(w => w.status === 'Active').length, color: 'text-purple-600' },
        ].map(k => (
          <Card key={k.label} className="p-4 text-center">
            <p className={`text-3xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-gray-500 mt-1">{k.label}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category trend */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Monthly Issues by Category</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={categoryTrend} barSize={7} barGap={1}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="Road" fill="#2563eb" radius={[2,2,0,0]} />
              <Bar dataKey="Water" fill="#0ea5e9" radius={[2,2,0,0]} />
              <Bar dataKey="Electricity" fill="#f59e0b" radius={[2,2,0,0]} />
              <Bar dataKey="Garbage" fill="#16a34a" radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Resolution trend */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Avg Resolution Time (Hours)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={resolutionTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="avgHours" stroke="#2563eb" strokeWidth={2.5} dot={{ fill: '#2563eb', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Category distribution */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Category Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* Ward performance */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Ward-wise Issues</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={wardData} barSize={10} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="ward" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="resolved" fill="#22c55e" radius={[2,2,0,0]} name="Resolved" />
              <Bar dataKey="pending" fill="#f59e0b" radius={[2,2,0,0]} name="Pending" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Worker performance table */}
      <Card>
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">Worker Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                {['Worker', 'Category', 'Ward', 'Completed Tasks', 'Open Tasks', 'Avg Resolution', 'Status'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {workers.map(w => (
                <tr key={w.id} className="hover:bg-gray-50/50">
                   <td className="px-5 py-3 font-medium text-gray-800">{w.name || w.full_name}</td>
                  <td className="px-5 py-3 text-gray-600">{w.category}</td>
                  <td className="px-5 py-3 text-gray-600">{w.ward}</td>
                  <td className="px-5 py-3">
                    <span className="text-green-600 font-semibold">{w.completed_tasks ?? 0}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`font-semibold ${(w.open_tasks ?? 0) >= 3 ? 'text-red-600' : (w.open_tasks ?? 0) >= 1 ? 'text-yellow-600' : 'text-gray-400'}`}>
                      {w.open_tasks ?? 0}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{w.avg_resolution_hours ?? '—'}h</td>
                  <td className="px-5 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${w.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      {w.status || 'Active'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Card, StatusBadge, PriorityBadge } from '../components/ui/index.jsx';
import {
  AlertCircle, CheckCircle2, Clock, Users,
  TrendingUp, Trash2, ArrowUpRight, Activity
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { apiGetCategoryTrend, apiGetResolutionTrend, apiGetActivityLog } from '../services/api';

const PIE_COLORS = ['#2563eb', '#0ea5e9', '#f59e0b', '#16a34a', '#8b5cf6', '#ec4899'];

function KpiCard({ title, value, sub, icon: Icon, color, trend }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon size={22} className="text-white" />
        </div>
      </div>
      {trend !== undefined && (
        <div className="mt-3 flex items-center gap-1 text-green-600 text-xs font-medium">
          <TrendingUp size={13} />
          <span>{trend}</span>
        </div>
      )}
    </Card>
  );
}

export default function Dashboard() {
  const { issues, workers, bins } = useApp();

  const [categoryTrend, setCategoryTrend] = useState([]);
  const [resolutionTrend, setResolutionTrend] = useState([]);
  const [activityLog, setActivityLog] = useState([]);

  useEffect(() => {
    apiGetCategoryTrend().then(d => setCategoryTrend(Array.isArray(d) ? d : (d.results || []))).catch(() => {});
    apiGetResolutionTrend().then(d => setResolutionTrend(Array.isArray(d) ? d : (d.results || []))).catch(() => {});
    apiGetActivityLog().then(d => setActivityLog(Array.isArray(d) ? d : (d.results || []))).catch(() => {});
  }, []);

  const total = issues.length;
  const highPriority = issues.filter(i => i.priority === 'High').length;
  const resolved = issues.filter(i => i.status === 'Resolved' || i.status === 'Closed').length;
  const activeWorkers = workers.filter(w => w.status === 'Active').length;
  const overflowBins = bins.filter(b => (b.fill_level ?? b.fillLevel ?? 0) >= 85).length;

  const avgResolution = (() => {
    const done = issues.filter(i => i.resolved_at || i.resolutionTime);
    if (!done.length) return '—';
    const avg = done.reduce((sum, i) => {
      const resolvedAt = i.resolved_at || i.resolutionTime;
      const reportedAt = i.reported_at || i.reportedAt;
      const diff = new Date(resolvedAt) - new Date(reportedAt);
      return sum + diff / 3600000;
    }, 0) / done.length;
    return `${Math.round(avg)}h`;
  })();

  // Category distribution for pie — from current issues list
  const catMap = {};
  issues.forEach(i => { catMap[i.category] = (catMap[i.category] || 0) + 1; });
  const pieData = Object.entries(catMap).map(([name, value]) => ({ name, value }));

  // High priority unassigned
  const urgent = issues.filter(i => i.priority === 'High' && !i.assigned_to && !i.assignedTo);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-500 text-sm mt-1">Ichalkaranji Municipal Corporation — Real-time overview</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total Issues" value={total} sub="All time" icon={AlertCircle} color="bg-blue-600" trend="+4 today" />
        <KpiCard title="High Priority" value={highPriority} sub="Needs attention" icon={Activity} color="bg-red-500" />
        <KpiCard title="Avg Resolution" value={avgResolution} sub="Resolved issues" icon={Clock} color="bg-orange-500" trend="↓ 2h vs last week" />
        <KpiCard title="Active Workers" value={activeWorkers} sub={`of ${workers.length} total`} icon={Users} color="bg-green-600" />
      </div>

      {/* Second row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 col-span-2 lg:col-span-1">
          <p className="text-sm text-gray-500 font-medium">Resolved Today</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{resolved}</p>
          <p className="text-xs text-gray-400 mt-1">Closed + Resolved</p>
          <div className="mt-3 flex items-center gap-1 text-green-600 text-xs font-medium">
            <CheckCircle2 size={13} />
            <span>+3 from yesterday</span>
          </div>
        </Card>
        <Card className="p-5 col-span-2 lg:col-span-1">
          <p className="text-sm text-gray-500 font-medium">Garbage Overflow</p>
          <p className="text-3xl font-bold text-red-600 mt-1">{overflowBins}</p>
          <p className="text-xs text-gray-400 mt-1">Bins need immediate action</p>
          <div className="mt-3 flex items-center gap-1 text-red-500 text-xs font-medium">
            <Trash2 size={13} />
            <span>Requires attention</span>
          </div>
        </Card>

        {/* Urgent unassigned */}
        <Card className="p-5 col-span-2 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Urgent Unassigned Issues</h3>
            <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full font-medium">{urgent.length} issues</span>
          </div>
          <div className="space-y-2">
            {urgent.slice(0, 3).map(issue => (
              <div key={issue.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-800 truncate max-w-[200px]">{issue.title}</p>
                  <p className="text-xs text-gray-400">{issue.display_id || issue.id} · {issue.ward}</p>
                </div>
                <PriorityBadge priority={issue.priority} />
              </div>
            ))}
            {urgent.length === 0 && <p className="text-sm text-gray-400 text-center py-2">All urgent issues assigned</p>}
          </div>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category trend */}
        <Card className="p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Issues by Category (Last 6 Months)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={categoryTrend} barSize={8} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Bar dataKey="Road" fill="#2563eb" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Water" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Electricity" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Garbage" fill="#16a34a" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Traffic" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Pie chart */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Category Distribution</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1">
            {pieData.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-gray-600">{d.name}</span>
                </div>
                <span className="font-medium text-gray-800">{d.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Resolution trend + Activity log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Avg Resolution Time Trend (Hours)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={resolutionTrend}>
              <defs>
                <linearGradient id="resGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Area type="monotone" dataKey="avgHours" stroke="#2563eb" strokeWidth={2} fill="url(#resGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {activityLog.slice(0, 6).map(log => (
              <div key={log.id} className="flex items-start gap-3">
                <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0
                  ${log.type === 'alert' ? 'bg-red-500' :
                    log.type === 'resolve' ? 'bg-green-500' :
                    log.type === 'assign' ? 'bg-blue-500' : 'bg-gray-400'}`} />
                <div>
                  <p className="text-xs text-gray-700">{log.action}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(log.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            {activityLog.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">No recent activity</p>
            )}
          </div>
        </Card>
      </div>

      {/* Recent issues table */}
      <Card>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">Recent Issues</h3>
          <a href="/issues" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            View all <ArrowUpRight size={12} />
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">ID</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Issue</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 hidden md:table-cell">Ward</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 hidden lg:table-cell">Priority</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 hidden lg:table-cell">Assigned To</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {issues.slice(0, 6).map(issue => (
                <tr key={issue.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3 text-blue-600 font-medium">{issue.display_id || issue.id}</td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-800 truncate max-w-[200px]">{issue.title}</p>
                    <p className="text-xs text-gray-400">{issue.category}</p>
                  </td>
                  <td className="px-5 py-3 text-gray-600 hidden md:table-cell">{issue.ward}</td>
                  <td className="px-5 py-3"><StatusBadge status={issue.status} /></td>
                  <td className="px-5 py-3 hidden lg:table-cell"><PriorityBadge priority={issue.priority} /></td>
                  <td className="px-5 py-3 text-gray-600 hidden lg:table-cell">
                    {issue.assigned_to_name || issue.assigned_to_detail?.name || issue.assignedTo || '—'}
                  </td>
                </tr>
              ))}
              {issues.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-400 text-sm">Loading issues...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

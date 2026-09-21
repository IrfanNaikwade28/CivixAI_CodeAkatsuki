import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Card, StatusBadge, PriorityBadge, Button } from '../components/ui/index.jsx';
import { Search, RefreshCw, X, ChevronDown, Image, RotateCcw, Loader2 } from 'lucide-react';
import AgentActivityPanel from '../components/agent/AgentActivityPanel.jsx';

const categories = ['All', 'Road', 'Water', 'Electricity', 'Garbage', 'Traffic', 'Public Facilities'];
const statuses = ['All', 'Submitted', 'Assigned', 'In Progress', 'Resolved', 'Closed'];
const priorities = ['All', 'High', 'Medium', 'Low'];

export default function Issues() {
  const { issues, workers, updateIssueStatus, assignWorker } = useApp();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priFilter, setPriFilter] = useState('All');
  const [wardFilter, setWardFilter] = useState('All');
  const [selected, setSelected] = useState(null);
  const [reopenReason, setReopenReason] = useState('');
  const [showReopenInput, setShowReopenInput] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  // Collect unique wards from issues
  const wards = ['All', ...Array.from(new Set(issues.map(i => i.ward).filter(Boolean))).sort()];

  const filtered = issues.filter(i => {
    const q = search.toLowerCase();
    const displayId = (i.display_id || String(i.id)).toLowerCase();
    return (
      (catFilter === 'All' || i.category === catFilter) &&
      (statusFilter === 'All' || i.status === statusFilter) &&
      (priFilter === 'All' || i.priority === priFilter) &&
      (wardFilter === 'All' || i.ward === wardFilter) &&
      (!q || i.title.toLowerCase().includes(q) || displayId.includes(q) || (i.ward || '').toLowerCase().includes(q))
    );
  });

  const handleAssign = async (workerId) => {
    if (!selected || !workerId) return;
    setActionLoading(true);
    setActionError('');
    try {
      const updated = await assignWorker(selected.id, parseInt(workerId));
      setSelected(prev => ({ ...prev, ...updated }));
    } catch (e) {
      setActionError(e.message || 'Failed to assign worker');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async (newStatus, note) => {
    if (!selected) return;
    setActionLoading(true);
    setActionError('');
    try {
      const updated = await updateIssueStatus(selected.id, newStatus, undefined, note);
      setSelected(prev => ({ ...prev, ...updated }));
    } catch (e) {
      setActionError(e.message || 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  const closeDrawer = () => {
    setSelected(null);
    setShowReopenInput(false);
    setReopenReason('');
    setActionError('');
  };

  // Normalise field names for a given issue
  const norm = (issue) => ({
    ...issue,
    displayId: issue.display_id || String(issue.id),
    // Backend: reported_by_detail.name (nested); fallback to flat field if present
    reportedBy: issue.reported_by_detail?.name || issue.reported_by_name || issue.reportedBy || '—',
    reportedAt: issue.reported_at || issue.reportedAt,
    assignedToId: issue.assigned_to,
    // Backend: assigned_to_detail.name (nested); fallback to flat field if present
    assignedToName: issue.assigned_to_detail?.name || issue.assigned_to_name || issue.assignedTo || null,
    priorityScore: issue.priority_score ?? issue.priorityScore ?? 0,
    // Backend: image_url (not image)
    image: issue.image_url || issue.image || null,
    // Backend: completion_photo_url (not completion_photo)
    completionPhoto: issue.completion_photo_url || issue.completion_photo || issue.completionPhoto || null,
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">All Issues</h2>
        <p className="text-gray-500 text-sm mt-1">{filtered.length} of {issues.length} issues</p>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 flex-1 min-w-[200px]">
            <Search size={15} className="text-gray-400" />
            <input
              type="text"
              placeholder="Search by ID, title, ward..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent text-sm text-gray-700 outline-none w-full placeholder-gray-400"
            />
          </div>

          {[
            { label: 'Category', value: catFilter, setter: setCatFilter, options: categories },
            { label: 'Status', value: statusFilter, setter: setStatusFilter, options: statuses },
            { label: 'Priority', value: priFilter, setter: setPriFilter, options: priorities },
            { label: 'Ward', value: wardFilter, setter: setWardFilter, options: wards },
          ].map(({ label, value, setter, options }) => (
            <div key={label} className="relative">
              <select
                value={value}
                onChange={e => setter(e.target.value)}
                className="appearance-none bg-gray-100 border-0 rounded-lg px-3 py-2 pr-8 text-sm text-gray-700 outline-none cursor-pointer"
              >
                {options.map(o => <option key={o}>{o}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-2 top-2.5 text-gray-400 pointer-events-none" />
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={() => { setSearch(''); setCatFilter('All'); setStatusFilter('All'); setPriFilter('All'); setWardFilter('All'); }}>
            <RefreshCw size={14} /> Reset
          </Button>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['ID', 'Issue', 'Category', 'Ward', 'Status', 'Priority', 'Score', 'Assigned To', 'Reported'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(issue => {
                const n = norm(issue);
                const score = n.priorityScore;
                return (
                  <tr
                    key={issue.id}
                    className="hover:bg-blue-50/30 cursor-pointer transition-colors"
                    onClick={() => { setSelected(issue); setActionError(''); }}
                  >
                    <td className="px-4 py-3 text-blue-600 font-medium whitespace-nowrap">{n.displayId}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800 max-w-[220px] truncate">{issue.title}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{issue.category}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{issue.ward}</td>
                    <td className="px-4 py-3"><StatusBadge status={issue.status} /></td>
                    <td className="px-4 py-3"><PriorityBadge priority={issue.priority} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-12 bg-gray-200 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${score >= 80 ? 'bg-red-500' : score >= 60 ? 'bg-orange-500' : 'bg-green-500'}`}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600 font-medium">{score}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {n.assignedToName || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {n.reportedAt ? new Date(n.reportedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-gray-400">
                    {issues.length === 0 ? 'Loading issues...' : 'No issues found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Issue Detail Drawer */}
      {selected && (() => {
        const n = norm(selected);
        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={closeDrawer}>
            <div
              className="w-full max-w-xl bg-white h-full overflow-y-auto shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-100 flex items-start justify-between">
                <div>
                  <p className="text-blue-600 text-sm font-medium">{n.displayId}</p>
                  <h3 className="text-lg font-bold text-gray-900 mt-1">{selected.title}</h3>
                </div>
                <button onClick={closeDrawer} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {actionError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">
                    {actionError}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={selected.status} />
                  <PriorityBadge priority={selected.priority} />
                  <span className="px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-full">{selected.category}</span>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">DESCRIPTION</p>
                  <p className="text-sm text-gray-700">{selected.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">WARD</p>
                    <p className="text-sm text-gray-800">{selected.ward}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">LOCATION</p>
                    <p className="text-sm text-gray-800">{selected.location_text || selected.location || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">REPORTED BY</p>
                    <p className="text-sm text-gray-800">{n.reportedBy}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">REPORTED AT</p>
                    <p className="text-sm text-gray-800">{n.reportedAt ? new Date(n.reportedAt).toLocaleString('en-IN') : '—'}</p>
                  </div>
                </div>

                {/* Issue Photos */}
                {(n.image || n.completionPhoto) && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">PHOTOS</p>
                    <div className="grid grid-cols-2 gap-3">
                      {n.image ? (
                        <div>
                          <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                            <Image size={11} /> Reported Photo
                          </p>
                          <img src={n.image} alt="Reported issue" className="w-full h-36 object-cover rounded-lg border border-gray-200" />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-36 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                          <Image size={20} className="text-gray-300 mb-1" />
                          <p className="text-xs text-gray-400">No photo</p>
                        </div>
                      )}
                      {n.completionPhoto ? (
                        <div>
                          <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                            <Image size={11} /> After Fix
                          </p>
                          <img src={n.completionPhoto} alt="After fix" className="w-full h-36 object-cover rounded-lg border border-green-200" />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-36 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                          <Image size={20} className="text-gray-300 mb-1" />
                          <p className="text-xs text-gray-400">No fix photo yet</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Priority Score */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">PRIORITY SCORE</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${n.priorityScore >= 80 ? 'bg-red-500' : n.priorityScore >= 60 ? 'bg-orange-500' : 'bg-green-500'}`}
                        style={{ width: `${n.priorityScore}%` }}
                      />
                    </div>
                    <span className="text-lg font-bold text-gray-800">{n.priorityScore}/100</span>
                  </div>
                </div>

                {/* Agent Activity */}
                <AgentActivityPanel issueId={selected.id} />

                {/* Assign worker */}
                {selected.status !== 'Resolved' && selected.status !== 'Closed' && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">ASSIGN WORKER</p>
                    <select
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-500"
                      value={n.assignedToId || ''}
                      onChange={e => handleAssign(e.target.value)}
                      disabled={actionLoading}
                    >
                      <option value="">— Select Worker —</option>
                      {workers
                        .filter(w => w.status === 'Active')
                        .map(w => (
                          <option key={w.id} value={w.id}>
                            {w.full_name || w.name} ({w.ward}) — {w.open_tasks ?? w.openTasks ?? 0} open tasks
                          </option>
                        ))}
                    </select>
                    {actionLoading && <p className="text-xs text-blue-600 mt-1 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Updating...</p>}
                  </div>
                )}

                {/* Update Status */}
                <div className="space-y-3">
                  {selected.status !== 'Closed' && (
                    <div className="flex gap-2 flex-wrap">
                      {selected.status !== 'Resolved' && (
                        <Button size="sm" variant="success" disabled={actionLoading} onClick={() => handleStatusChange('Resolved')}>
                          {actionLoading ? <Loader2 size={13} className="animate-spin" /> : null}
                          Mark Resolved
                        </Button>
                      )}
                      <Button size="sm" variant="secondary" disabled={actionLoading} onClick={() => handleStatusChange('Closed')}>
                        Close Issue
                      </Button>
                    </div>
                  )}

                  {/* Reopen with reason */}
                  {(selected.status === 'Closed' || selected.status === 'Resolved') && (
                    <div>
                      {!showReopenInput ? (
                        <Button size="sm" variant="outline" onClick={() => setShowReopenInput(true)}>
                          <RotateCcw size={13} /> Reopen Issue
                        </Button>
                      ) : (
                        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
                          <p className="text-xs font-semibold text-orange-700">REOPEN REASON</p>
                          <textarea
                            value={reopenReason}
                            onChange={e => setReopenReason(e.target.value)}
                            placeholder="Explain why this issue is being reopened..."
                            rows={3}
                            className="w-full border border-orange-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-orange-400 bg-white resize-none"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!reopenReason.trim() || actionLoading}
                              onClick={() => {
                                handleStatusChange('Submitted', reopenReason.trim()).then(() => {
                                  setShowReopenInput(false);
                                  setReopenReason('');
                                });
                              }}
                            >
                              <RotateCcw size={13} /> Confirm Reopen
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setShowReopenInput(false); setReopenReason(''); }}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

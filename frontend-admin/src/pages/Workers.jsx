import { useState } from 'react';
import { Card, StatusBadge } from '../components/ui/index.jsx';
import { useApp } from '../context/AppContext';
import { apiCreateWorker } from '../services/api';
import { Users, CheckCircle, Plus, Edit2, Trash2, X, AlertTriangle, Loader2 } from 'lucide-react';

const CATEGORIES = ['Infrastructure', 'Sanitation', 'Water Supply', 'Electrical', 'Maintenance', 'Traffic Control'];
const WARDS = ['Ward 2','Ward 3','Ward 4','Ward 5','Ward 6','Ward 7','Ward 9','Ward 11','Ward 12','Ward 14'];
const STATUSES = ['Active', 'On Leave', 'Inactive'];

const EMPTY_FORM = { name: '', email: '', password: '', phone: '', ward: 'Ward 5', category: 'Infrastructure', status: 'Active' };

function WorkerModal({ initial, onSave, onClose, isEdit, loading }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const isValid = isEdit
    ? (form.name || form.full_name || '').trim() && form.phone?.trim() && form.ward && form.category
    : form.name.trim() && form.email.trim() && form.password.trim() && form.phone.trim() && form.ward && form.category;

  const handleSave = () => {
    if (!isValid) { setError('Please fill all required fields.'); return; }
    onSave(form);
  };

  const displayName = form.full_name || form.name || '';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">{isEdit ? 'Edit Worker' : 'Add New Worker'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</p>}

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Full Name *</label>
            <input
              type="text" value={displayName}
              onChange={e => set(form.full_name !== undefined ? 'full_name' : 'name', e.target.value)}
              placeholder="Worker full name"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          {/* Email — only for new worker */}
          {!isEdit && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email *</label>
              <input
                type="email" value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="worker@ichalkaranji.gov.in"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              />
            </div>
          )}

          {/* Password — only for new worker */}
          {!isEdit && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Password *</label>
              <input
                type="password" value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder="Minimum 4 characters"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              />
            </div>
          )}

          {/* Phone */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Phone *</label>
            <input
              type="text" value={form.phone || ''}
              onChange={e => set('phone', e.target.value)}
              placeholder="10-digit mobile number"
              maxLength={10}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Specialization *</label>
            <select
              value={form.category} onChange={e => set('category', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            >
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          {/* Ward */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Assigned Ward *</label>
            <select
              value={form.ward} onChange={e => set('ward', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500"
            >
              {WARDS.map(w => <option key={w}>{w}</option>)}
            </select>
          </div>

          {/* Status — only for edit */}
          {isEdit && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Status</label>
              <select
                value={form.status} onChange={e => set('status', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              >
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl text-sm">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 bg-[#1e3a8a] hover:bg-blue-900 text-white font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : (isEdit ? 'Save Changes' : 'Add Worker')}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirm({ worker, onConfirm, onClose }) {
  const name = worker.full_name || worker.name || 'this worker';
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center" onClick={e => e.stopPropagation()}>
        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={24} className="text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">Remove Worker?</h3>
        <p className="text-sm text-gray-500 mb-6">
          Are you sure you want to remove <strong>{name}</strong> from the list?
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-700 font-semibold py-2.5 rounded-xl text-sm">
            Cancel
          </button>
          <button onClick={onConfirm} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-xl text-sm">
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Workers() {
  const { workers, issues, refreshWorkers } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState(null);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  // Local override list — real workers + any locally edited/removed ones
  const [localOverrides, setLocalOverrides] = useState({});
  const [localRemoved, setLocalRemoved] = useState(new Set());

  const displayWorkers = workers
    .filter(w => !localRemoved.has(w.id))
    .map(w => ({ ...w, ...(localOverrides[w.id] || {}) }));

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleAdd = async (form) => {
    setAddLoading(true);
    setAddError('');
    try {
      await apiCreateWorker({
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone,
        ward: form.ward,
        category: form.category,
      });
      await refreshWorkers();
      setShowAdd(false);
      showToast('Worker added successfully');
    } catch (e) {
      setAddError(e.message || 'Failed to add worker');
    } finally {
      setAddLoading(false);
    }
  };

  const handleEdit = (form) => {
    // Optimistic local update (no backend PATCH endpoint in spec)
    setLocalOverrides(prev => ({ ...prev, [editTarget.id]: form }));
    setEditTarget(null);
    showToast('Worker updated');
  };

  const handleDelete = () => {
    // Optimistic local removal (no backend DELETE endpoint in spec)
    setLocalRemoved(prev => new Set([...prev, deleteTarget.id]));
    setDeleteTarget(null);
    showToast('Worker removed');
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Workers</h2>
          <p className="text-gray-500 text-sm mt-1">Manage field workers and track performance</p>
        </div>
        <button
          onClick={() => { setAddError(''); setShowAdd(true); }}
          className="flex items-center gap-2 bg-[#1e3a8a] hover:bg-blue-900 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus size={16} /> Add Worker
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Workers', value: displayWorkers.length, icon: Users, color: 'bg-blue-100 text-blue-700' },
          { label: 'Active', value: displayWorkers.filter(w => w.status === 'Active').length, icon: CheckCircle, color: 'bg-green-100 text-green-700' },
          { label: 'On Leave', value: displayWorkers.filter(w => w.status === 'On Leave').length, icon: Users, color: 'bg-orange-100 text-orange-700' },
          {
            label: 'Avg Tasks/Worker',
            value: displayWorkers.length ? Math.round(displayWorkers.reduce((s, w) => s + (w.completed_tasks ?? w.completedTasks ?? 0), 0) / displayWorkers.length) : 0,
            icon: CheckCircle,
            color: 'bg-purple-100 text-purple-700',
          },
        ].map(k => (
          <Card key={k.label} className="p-4 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${k.color}`}>
              <k.icon size={20} />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{k.value}</p>
              <p className="text-xs text-gray-500">{k.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Worker Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {displayWorkers.map(worker => {
          const workerName = worker.full_name || worker.name || '';
          const workerDisplayId = worker.display_id || worker.id;
          const openTasks = worker.open_tasks ?? worker.openTasks ?? 0;
          const completedTasks = worker.completed_tasks ?? worker.completedTasks ?? 0;
          const avgResHours = worker.avg_resolution_hours ?? worker.avgResolutionHours ?? 0;

          // Match assigned issues by worker ID or name
          const assigned = issues.filter(i =>
            i.assigned_to === worker.id || i.assignedTo === workerName
          );

          return (
            <Card key={worker.id} className="p-5">
              <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {worker.profile_photo_url ? (
                      <img
                        src={worker.profile_photo_url}
                        alt={workerName}
                        className="w-11 h-11 rounded-full object-cover border-2 border-gray-200"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-[#1e3a8a] flex items-center justify-center text-white font-bold text-base">
                        {workerName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  <div>
                    <p className="font-semibold text-gray-900">{workerName}</p>
                    <p className="text-xs text-gray-500">{workerDisplayId} · {worker.ward}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <StatusBadge status={worker.status || 'Active'} />
                  <button
                    onClick={() => setEditTarget(worker)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-blue-600 ml-1"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(worker)}
                    className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-gray-900">{openTasks}</p>
                  <p className="text-xs text-gray-500">Open Tasks</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-green-600">{completedTasks}</p>
                  <p className="text-xs text-gray-500">Completed</p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Specialization</span>
                  <span className="font-medium text-gray-800">{worker.category}</span>
                </div>
                {avgResHours > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Avg Resolution</span>
                    <span className="font-medium text-gray-800">{avgResHours}h</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Phone</span>
                  <span className="font-medium text-gray-800">{worker.phone || '—'}</span>
                </div>
              </div>

              {/* Workload bar */}
              <div className="mt-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Workload</span>
                  <span>{openTasks}/5 tasks</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${openTasks >= 4 ? 'bg-red-500' : openTasks >= 2 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(100, (openTasks / 5) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Current assignments */}
              {assigned.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 mb-2">CURRENT ASSIGNMENTS</p>
                  {assigned.slice(0, 2).map(issue => (
                    <div key={issue.id} className="flex items-center justify-between py-1">
                      <p className="text-xs text-gray-700 truncate max-w-[160px]">{issue.title}</p>
                      <StatusBadge status={issue.status} />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}

        {displayWorkers.length === 0 && (
          <div className="col-span-3 text-center py-16 text-gray-400">
            {workers.length === 0 ? 'Loading workers...' : 'No workers found'}
          </div>
        )}
      </div>

      {/* Modals */}
      {showAdd && (
        <WorkerModal
          onSave={handleAdd}
          onClose={() => setShowAdd(false)}
          loading={addLoading}
        />
      )}
      {addError && (
        <div className="fixed bottom-4 right-4 z-50 bg-red-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium max-w-sm">
          {addError}
        </div>
      )}
      {editTarget && (
        <WorkerModal
          initial={editTarget}
          isEdit
          onSave={handleEdit}
          onClose={() => setEditTarget(null)}
        />
      )}
      {deleteTarget && (
        <DeleteConfirm
          worker={deleteTarget}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

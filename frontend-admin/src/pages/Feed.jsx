import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Card, Button } from '../components/ui/index.jsx';
import {
  Radio, ThumbsUp, MessageCircle, MapPin, Clock, AlertCircle,
  Megaphone, Send, X, Shield, ChevronDown, ChevronUp, Image,
  User, Wrench, CheckCircle, Filter, ShieldCheck
} from 'lucide-react';

const NOTICE_TYPES = ['Announcement', 'Alert', 'Maintenance', 'Event'];

const noticeCfg = {
  Announcement: { bg: 'bg-blue-50 border-blue-200', badge: 'bg-blue-100 text-blue-700', icon: Megaphone, color: 'text-blue-600' },
  Alert: { bg: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-700', icon: AlertCircle, color: 'text-red-600' },
  Maintenance: { bg: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700', icon: Shield, color: 'text-amber-600' },
  Event: { bg: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-700', icon: Radio, color: 'text-green-600' },
};



const categoryIcons = {
  Road: '🛣️', Water: '💧', Electricity: '⚡', Garbage: '🗑️',
  Traffic: '🚦', 'Public Facilities': '🏛️',
};

const STEPS = ['Submitted', 'Assigned', 'In Progress', 'Resolved'];

const initialNotices = [
  { id: 'N-001', type: 'Maintenance', title: 'Scheduled Water Supply Interruption', body: 'Water supply in Ward 7, 9 and 3 will be interrupted on Feb 23rd from 9 AM to 2 PM due to pipeline maintenance work at Kasba Peth junction.', ward: 'Ward 7, Ward 9, Ward 3', postedAt: '2026-02-21T08:00:00', postedBy: 'Admin', upvotes: 12 },
  { id: 'N-002', type: 'Announcement', title: 'New Complaint Portal Launch', body: 'Citizens of Ichalkaranji can now report civic issues directly via the CivixAI mobile app. Download and register today.', ward: 'All Wards', postedAt: '2026-02-20T10:00:00', postedBy: 'Commissioner', upvotes: 34 },
  { id: 'N-003', type: 'Alert', title: 'Open Manhole on Panchganga Riverside — Avoid Area', body: 'A dangerous open manhole has been reported on the Panchganga Riverside path (Ward 3). Citizens are advised to avoid the stretch until repaired.', ward: 'Ward 3', postedAt: '2026-02-21T07:30:00', postedBy: 'Admin', upvotes: 56 },
];

function NoticeCard({ notice, onDelete }) {
  const cfg = noticeCfg[notice.type] || noticeCfg.Announcement;
  const Icon = cfg.icon;
  return (
    <div className={`border rounded-xl p-4 ${cfg.bg}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <Icon size={16} className={cfg.color} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.badge}`}>{notice.type}</span>
              <span className="text-xs text-gray-500">{notice.ward}</span>
            </div>
            <p className="font-semibold text-gray-800 text-sm">{notice.title}</p>
            <p className="text-sm text-gray-600 mt-1">{notice.body}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
              <span className="flex items-center gap-1"><Clock size={11} />{new Date(notice.postedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
              <span>By {notice.postedBy}</span>
              <span className="flex items-center gap-1"><ThumbsUp size={11} />{notice.upvotes}</span>
            </div>
          </div>
        </div>
        {onDelete && (
          <button onClick={() => onDelete(notice.id)} className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 mt-1">
            <X size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

function StatusStepper({ status }) {
  const idx = STEPS.indexOf(status);
  return (
    <div className="flex items-center mt-2">
      {STEPS.map((step, i) => {
        const done = i <= idx;
        const isCurrent = i === idx;
        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center
                ${done ? isCurrent ? 'bg-blue-600 border-blue-600 scale-110' : 'bg-blue-500 border-blue-500' : 'bg-white border-gray-200'}`}>
                {done && !isCurrent && <span className="text-white text-[8px] font-bold">✓</span>}
                {isCurrent && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
              </div>
              <span className={`text-[9px] mt-0.5 font-medium whitespace-nowrap ${done ? 'text-blue-600' : 'text-gray-300'}`}>
                {step === 'In Progress' ? 'In Prog.' : step}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 mx-1 mb-3 rounded ${i < idx ? 'bg-blue-400' : 'bg-gray-100'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function IssueCard({ issue }) {
  const [expanded, setExpanded] = useState(false);
  const isResolved = issue.status === 'Resolved' || issue.status === 'Closed';

  // Normalise real API field names
  const reportedBy   = issue.reported_by_detail?.name || issue.reported_by_name || issue.reportedBy || 'Unknown';
  const reportedAt   = issue.reported_at        || issue.reportedAt;
  const displayId    = issue.display_id         || issue.id;
  const assignedTo   = issue.assigned_to_detail?.name || issue.assigned_to_name || issue.assignedTo;
  const imageUrl     = issue.image_url          || issue.image;
  const completionPhoto = issue.completion_photo_url || issue.completion_photo || issue.completionPhoto;
  const resolvedAt   = issue.resolved_at        || issue.resolutionTime;
  const aiScore      = issue.ai_completion_score  ?? issue.aiScore;
  const aiVerdict    = issue.ai_completion_verdict || issue.aiVerdict;

  return (
    <div className={`border rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow
      ${isResolved ? 'border-green-100' : 'border-gray-100'}`}>

      {/* Issue image */}
      {imageUrl && (
        <div className="relative">
          <img
            src={imageUrl}
            alt={issue.title}
            className="w-full object-cover"
            style={{ maxHeight: 180 }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-white/90 text-gray-700 flex items-center gap-1">
            {categoryIcons[issue.category]} {issue.category}
          </span>
          {isResolved && (
            <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle size={10} /> Resolved
            </div>
          )}
        </div>
      )}

      <div className="p-4">
        {/* Reporter + meta row */}
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-700 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {reportedBy.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-bold text-gray-800">{reportedBy}</p>
              <span className="text-blue-600 text-xs font-semibold">· {displayId}</span>
            </div>
            <p className="text-[10px] text-gray-400 flex items-center gap-1">
              <MapPin size={9} /> {issue.ward}
              <Clock size={9} className="ml-1" />
              {reportedAt ? new Date(reportedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
            </p>
          </div>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0
            ${issue.priority === 'High' ? 'bg-red-100 text-red-600' :
              issue.priority === 'Medium' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
            {issue.priority}
          </span>
        </div>

        {/* No-image category banner */}
        {!imageUrl && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{categoryIcons[issue.category]}</span>
            <span className="text-xs text-gray-500 font-medium">{issue.category}</span>
          </div>
        )}

        <p className="font-bold text-gray-900 text-sm leading-snug">{issue.title}</p>

        {expanded && (
          <p className="text-sm text-gray-500 mt-1">{issue.description}</p>
        )}

        {/* Status stepper */}
        <StatusStepper status={issue.status} />

        {/* Worker assignment row */}
        {assignedTo && (
          <div className={`flex items-center gap-2 mt-2 px-3 py-2 rounded-xl text-xs
            ${isResolved ? 'bg-green-50' : 'bg-blue-50'}`}>
            <Wrench size={12} className={isResolved ? 'text-green-600' : 'text-blue-500'} />
            <span className={`font-semibold ${isResolved ? 'text-green-700' : 'text-blue-700'}`}>
              {isResolved ? 'Resolved by' : 'Assigned to'}:
            </span>
            <span className={isResolved ? 'text-green-600' : 'text-blue-600'}>{assignedTo}</span>
          </div>
        )}

        {/* Completion photo */}
        {isResolved && completionPhoto && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-green-700 flex items-center gap-1 mb-1.5">
              <CheckCircle size={11} /> After Fix
            </p>
            <div className="relative rounded-xl overflow-hidden border border-green-200">
              <img
                src={completionPhoto}
                alt="After fix"
                className="w-full object-cover"
                style={{ maxHeight: 150 }}
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-green-900/50 to-transparent p-2">
                <p className="text-white text-[10px] font-semibold">
                  {assignedTo ? `Fixed by ${assignedTo}` : 'Issue resolved'}
                  {resolvedAt && ` · ${new Date(resolvedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`}
                </p>
              </div>
            </div>
          </div>
        )}

        {isResolved && !completionPhoto && (
          <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <Image size={12} className="text-gray-300" />
            <span className="text-xs text-gray-400">No completion photo</span>
          </div>
        )}

        {/* AI verification score */}
        {isResolved && aiScore != null && (
          <div className={`mt-2 flex items-center gap-3 px-3 py-2.5 rounded-xl border
            ${aiScore >= 50 ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-100'}`}>
            <ShieldCheck size={16} className={aiScore >= 50 ? 'text-green-600' : 'text-amber-600'} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold ${aiScore >= 50 ? 'text-green-700' : 'text-amber-700'}`}>
                  AI Score:
                </span>
                <span className={`text-sm font-extrabold ${aiScore >= 50 ? 'text-green-700' : 'text-amber-700'}`}>
                  {aiScore}<span className="text-xs font-medium">/100</span>
                </span>
              </div>
              {aiVerdict && (
                <p className={`text-[10px] mt-0.5 leading-tight line-clamp-2
                  ${aiScore >= 50 ? 'text-green-600' : 'text-amber-600'}`}>
                  {aiVerdict}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50">
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-600 transition-colors"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {expanded ? 'Less' : 'Details'}
          </button>
          <span className="ml-auto text-[10px] text-gray-300 font-mono">{issue.category}</span>
        </div>
      </div>
    </div>
  );
}

export default function Feed() {
  const { issues } = useApp();
  const [notices, setNotices] = useState(initialNotices);
  const [tab, setTab] = useState('issues');
  const [showCompose, setShowCompose] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');
  const [catFilter, setCatFilter] = useState('All');

  const [noticeType, setNoticeType] = useState('Announcement');
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeBody, setNoticeBody] = useState('');
  const [noticeWard, setNoticeWard] = useState('All Wards');
  const [postSuccess, setPostSuccess] = useState(false);

  const statuses = ['All', 'Submitted', 'Assigned', 'In Progress', 'Resolved', 'Closed'];
  const categories = ['All', 'Road', 'Water', 'Electricity', 'Garbage', 'Traffic', 'Public Facilities'];
  const wardOptions = ['All Wards', 'Ward 3', 'Ward 4', 'Ward 5', 'Ward 6', 'Ward 7', 'Ward 8', 'Ward 9', 'Ward 10', 'Ward 12', 'Ward 14'];

  const filteredIssues = issues.filter(i =>
    (statusFilter === 'All' || i.status === statusFilter) &&
    (catFilter === 'All' || i.category === catFilter)
  );

  const handlePostNotice = () => {
    if (!noticeTitle.trim() || !noticeBody.trim()) return;
    setNotices(prev => [{
      id: `N-${Date.now()}`, type: noticeType, title: noticeTitle.trim(),
      body: noticeBody.trim(), ward: noticeWard,
      postedAt: new Date().toISOString(), postedBy: 'Admin', upvotes: 0,
    }, ...prev]);
    setNoticeTitle(''); setNoticeBody(''); setNoticeWard('All Wards'); setNoticeType('Announcement');
    setPostSuccess(true);
    setTimeout(() => { setPostSuccess(false); setShowCompose(false); }, 1500);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Civic Feed</h2>
          <p className="text-gray-500 text-sm mt-1">Unified public issue feed — same view as citizens & workers</p>
        </div>
        <Button onClick={() => setShowCompose(true)}>
          <Megaphone size={15} /> Post Notice
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Issues', value: issues.length, color: 'text-blue-600' },
          { label: 'Open', value: issues.filter(i => !['Resolved', 'Closed'].includes(i.status)).length, color: 'text-yellow-600' },
          { label: 'Resolved', value: issues.filter(i => i.status === 'Resolved').length, color: 'text-green-600' },
          { label: 'Notices', value: notices.length, color: 'text-purple-600' },
        ].map(s => (
          <Card key={s.label} className="p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {[
          { key: 'issues', label: 'Public Issues', count: filteredIssues.length },
          { key: 'notices', label: 'Admin Notices', count: notices.length },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors
              ${tab === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
            <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs
              ${tab === t.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Issues tab */}
      {tab === 'issues' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <Filter size={14} className="text-gray-400" />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 outline-none">
              {statuses.map(s => <option key={s}>{s}</option>)}
            </select>
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 outline-none">
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
            {(statusFilter !== 'All' || catFilter !== 'All') && (
              <button onClick={() => { setStatusFilter('All'); setCatFilter('All'); }}
                className="text-xs text-gray-400 hover:text-gray-600 px-2">Clear</button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredIssues.map(issue => <IssueCard key={issue.id} issue={issue} />)}
          </div>
          {filteredIssues.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">No issues match the filters</div>
          )}
        </div>
      )}

      {/* Notices tab */}
      {tab === 'notices' && (
        <div className="space-y-3">
          {notices.map(notice => (
            <NoticeCard key={notice.id} notice={notice} onDelete={id => setNotices(prev => prev.filter(n => n.id !== id))} />
          ))}
          {notices.length === 0 && <div className="text-center py-12 text-gray-400 text-sm">No notices</div>}
        </div>
      )}

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowCompose(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 flex items-center gap-2"><Megaphone size={18} className="text-blue-600" /> Post Admin Notice</h3>
              <button onClick={() => setShowCompose(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-2 block">NOTICE TYPE</label>
                <div className="flex flex-wrap gap-2">
                  {NOTICE_TYPES.map(type => {
                    const cfg = noticeCfg[type];
                    const Icon = cfg.icon;
                    return (
                      <button key={type} onClick={() => setNoticeType(type)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all
                          ${noticeType === type ? `${cfg.badge} border-current` : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}>
                        <Icon size={13} /> {type}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">TITLE *</label>
                <input type="text" value={noticeTitle} onChange={e => setNoticeTitle(e.target.value)}
                  placeholder="Notice title..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">MESSAGE *</label>
                <textarea value={noticeBody} onChange={e => setNoticeBody(e.target.value)}
                  placeholder="Write your message..." rows={4}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-500 resize-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">TARGET WARD</label>
                <select value={noticeWard} onChange={e => setNoticeWard(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-500">
                  {wardOptions.map(w => <option key={w}>{w}</option>)}
                </select>
              </div>
              {postSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm text-green-700 font-medium text-center">Notice posted!</div>
              )}
              <div className="flex gap-3 pt-1">
                <Button onClick={handlePostNotice} disabled={!noticeTitle.trim() || !noticeBody.trim()} className="flex-1 justify-center">
                  <Send size={14} /> Publish Notice
                </Button>
                <Button variant="outline" onClick={() => setShowCompose(false)}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/index.jsx';
import {
  ThumbsUp, Clock, AlertCircle,
  Megaphone, Send, X, Shield, ChevronDown, ChevronUp,
  CheckCircle, Filter, ShieldCheck, Search
} from 'lucide-react';

const NOTICE_TYPES = ['Announcement', 'Alert', 'Maintenance', 'Event'];

const noticeCfg = {
  Announcement: { badge: 'bg-blue-100 text-blue-700', icon: Megaphone, color: 'text-blue-600' },
  Alert: { badge: 'bg-red-100 text-red-700', icon: AlertCircle, color: 'text-red-600' },
  Maintenance: { badge: 'bg-amber-100 text-amber-700', icon: Shield, color: 'text-amber-600' },
  Event: { badge: 'bg-green-100 text-green-700', icon: Megaphone, color: 'text-green-600' },
};

const categoryIcons = {
  Road: '🛣️', Water: '💧', Electricity: '⚡', Garbage: '🗑️',
  Traffic: '🚦', 'Public Facilities': '🏛️',
};

const statusColors = {
  Submitted: 'bg-gray-100 text-gray-600',
  Assigned: 'bg-blue-100 text-blue-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  Resolved: 'bg-green-100 text-green-700',
  Closed: 'bg-slate-100 text-slate-600',
};

const priorityColors = {
  High: 'bg-red-50 text-red-600',
  Medium: 'bg-amber-50 text-amber-600',
  Low: 'bg-green-50 text-green-600',
};

const initialNotices = [
  { id: 'N-001', type: 'Maintenance', title: 'Scheduled Water Supply Interruption', body: 'Water supply in Ward 7, 9 and 3 will be interrupted on Feb 23rd from 9 AM to 2 PM due to pipeline maintenance work at Kasba Peth junction.', ward: 'Ward 7, Ward 9, Ward 3', postedAt: '2026-02-21T08:00:00', postedBy: 'Admin', upvotes: 12 },
  { id: 'N-002', type: 'Announcement', title: 'New Complaint Portal Launch', body: 'Citizens of Ichalkaranji can now report civic issues directly via the CivixAI mobile app. Download and register today.', ward: 'All Wards', postedAt: '2026-02-20T10:00:00', postedBy: 'Commissioner', upvotes: 34 },
  { id: 'N-003', type: 'Alert', title: 'Open Manhole on Panchganga Riverside — Avoid Area', body: 'A dangerous open manhole has been reported on the Panchganga Riverside path (Ward 3). Citizens are advised to avoid the stretch until repaired.', ward: 'Ward 3', postedAt: '2026-02-21T07:30:00', postedBy: 'Admin', upvotes: 56 },
];

function NoticePost({ notice, onDelete }) {
  const cfg = noticeCfg[notice.type] || noticeCfg.Announcement;
  const Icon = cfg.icon;
  return (
    <div className="bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
              <Icon size={16} className={cfg.color} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.badge}`}>
                  {notice.type}
                </span>
                <span className="text-[11px] text-gray-400">{notice.ward}</span>
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mt-1.5 leading-snug">
                {notice.title}
              </h3>
              <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                {notice.body}
              </p>
              <div className="flex items-center gap-4 mt-3 text-[11px] text-gray-400">
                <span className="flex items-center gap-1">
                  <Clock size={10} />
                  {new Date(notice.postedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
                <span>By {notice.postedBy}</span>
                <span className="flex items-center gap-1">
                  <ThumbsUp size={10} />
                  {notice.upvotes}
                </span>
              </div>
            </div>
          </div>
          {onDelete && (
            <button onClick={() => onDelete(notice.id)} className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
              <X size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PostHeader({ issue }) {
  const reportedBy = issue.reported_by_detail?.name || issue.reported_by_name || issue.reportedBy || 'Unknown';
  const displayId = issue.display_id || issue.id;
  const reportedAt = issue.reported_at || issue.reportedAt;

  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
        {reportedBy.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold text-gray-900">{reportedBy}</span>
          <span className="text-[10px] text-blue-600 font-medium">{displayId}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-gray-400 flex-wrap">
          <span>{issue.ward}</span>
          <span>·</span>
          <span>{issue.category}</span>
          <span>·</span>
          <span>
            {reportedAt ? new Date(reportedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {issue.priority && issue.priority !== 'Low' && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${priorityColors[issue.priority]}`}>
            {issue.priority}
          </span>
        )}
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColors[issue.status] || statusColors.Submitted}`}>
          {issue.status}
        </span>
      </div>
    </div>
  );
}

function BeforeAfterMedia({ issue, isResolved, assignedTo, resolvedAt }) {
  const imageUrl = issue.image_url || issue.image;
  const completionPhoto = issue.completion_photo_url || issue.completion_photo;

  if (!imageUrl && !completionPhoto) return null;

  if (isResolved && imageUrl && completionPhoto) {
    return (
      <div className="mt-3">
        <div className="grid grid-cols-2 gap-2 rounded-lg overflow-hidden border border-gray-200">
          <div className="relative bg-gray-100">
            <img
              src={imageUrl}
              alt="Before"
              className="w-full h-40 object-cover"
            />
            <span className="absolute top-1.5 left-1.5 text-[9px] font-bold text-white bg-black/60 px-1.5 py-0.5 rounded">
              BEFORE
            </span>
          </div>
          <div className="relative bg-gray-100">
            <img
              src={completionPhoto}
              alt="After"
              className="w-full h-40 object-cover"
            />
            <span className="absolute top-1.5 left-1.5 text-[9px] font-bold text-white bg-black/60 px-1.5 py-0.5 rounded">
              AFTER
            </span>
          </div>
        </div>
        {assignedTo && (
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-green-600">
            <CheckCircle size={11} />
            <span className="font-medium">Resolved by {assignedTo}</span>
            {resolvedAt && (
              <span className="text-gray-400">
                · {new Date(resolvedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  if (imageUrl) {
    return (
      <div className="mt-3">
        <div className="relative rounded-lg overflow-hidden border border-gray-200">
          <img
            src={imageUrl}
            alt={issue.title}
            className="w-full h-48 object-cover"
          />
        </div>
      </div>
    );
  }

  return null;
}

function AIVerification({ aiScore, aiVerdict }) {
  if (aiScore == null) return null;

  const isGood = aiScore >= 50;

  return (
    <div className="mt-3 flex items-start gap-2.5 px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-100">
      <ShieldCheck size={14} className={isGood ? 'text-green-600' : 'text-amber-500'} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-gray-500">AI Verification</span>
          <span className={`text-xs font-bold ${isGood ? 'text-green-600' : 'text-amber-600'}`}>
            {aiScore}/100
          </span>
        </div>
        {aiVerdict && (
          <p className={`text-[11px] mt-1 leading-relaxed ${isGood ? 'text-gray-500' : 'text-amber-700'}`}>
            {aiVerdict}
          </p>
        )}
      </div>
    </div>
  );
}

function StatusTimeline({ status }) {
  const steps = ['Submitted', 'Assigned', 'In Progress', 'Resolved'];
  const idx = steps.indexOf(status);
  const isResolved = status === 'Resolved' || status === 'Closed';

  if (isResolved) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-green-600 font-medium">
        <CheckCircle size={12} />
        <span>Resolved</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-[10px] text-gray-400">
      {steps.map((step, i) => (
        <span key={step} className="flex items-center">
          <span className={i <= idx ? 'text-blue-600 font-medium' : ''}>
            {step === 'In Progress' ? 'In Prog.' : step}
          </span>
          {i < steps.length - 1 && <span className="mx-1">→</span>}
        </span>
      ))}
    </div>
  );
}

function CivicPost({ issue }) {
  const [expanded, setExpanded] = useState(false);
  const isResolved = issue.status === 'Resolved' || issue.status === 'Closed';

  const assignedTo = issue.assigned_to_detail?.name || issue.assigned_to_name || issue.assignedTo;
  const resolvedAt = issue.resolved_at || issue.resolutionTime;
  const aiScore = issue.ai_completion_score ?? issue.aiScore;
  const aiVerdict = issue.ai_completion_verdict || issue.aiVerdict;

  return (
    <div className="bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
      <div className="p-4">
        <PostHeader issue={issue} />

        <div className="mt-3">
          <h3 className="text-[15px] font-semibold text-gray-900 leading-snug">
            {issue.title}
          </h3>
          {expanded && issue.description && (
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              {issue.description}
            </p>
          )}
        </div>

        <BeforeAfterMedia
          issue={issue}
          isResolved={isResolved}
          assignedTo={assignedTo}
          resolvedAt={resolvedAt}
        />

        <AIVerification aiScore={aiScore} aiVerdict={aiVerdict} />

        <div className="mt-3 pt-3 border-t border-gray-100">
          <StatusTimeline status={issue.status} />
        </div>

        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1 text-[11px] font-medium text-gray-400 hover:text-gray-600 transition-colors"
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? 'Less' : 'Details'}
          </button>
          <span className="text-[10px] text-gray-300">
            {categoryIcons[issue.category]} {issue.category}
          </span>
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
  const [searchQuery, setSearchQuery] = useState('');

  const [noticeType, setNoticeType] = useState('Announcement');
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeBody, setNoticeBody] = useState('');
  const [noticeWard, setNoticeWard] = useState('All Wards');
  const [postSuccess, setPostSuccess] = useState(false);

  const statuses = ['All', 'Submitted', 'Assigned', 'In Progress', 'Resolved', 'Closed'];
  const categories = ['All', 'Road', 'Water', 'Electricity', 'Garbage', 'Traffic', 'Public Facilities'];
  const wardOptions = ['All Wards', 'Ward 3', 'Ward 4', 'Ward 5', 'Ward 6', 'Ward 7', 'Ward 8', 'Ward 9', 'Ward 10', 'Ward 12', 'Ward 14'];

  const filteredIssues = issues.filter(i => {
    const matchesStatus = statusFilter === 'All' || i.status === statusFilter;
    const matchesCategory = catFilter === 'All' || i.category === catFilter;
    const matchesSearch = !searchQuery ||
      i.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.display_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.ward?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesCategory && matchesSearch;
  });

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
    <div className="flex flex-col items-center">
      <div className="w-full max-w-[760px]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Civic Feed</h2>
              <p className="text-gray-400 text-xs mt-0.5">Community issues and municipal resolutions</p>
            </div>
            <Button onClick={() => setShowCompose(true)} size="sm">
              <Megaphone size={14} /> Post Notice
            </Button>
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search issues, workers..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 placeholder:text-gray-400 outline-none focus:border-blue-400 transition-colors"
            />
          </div>

          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 w-fit">
            {[
              { key: 'issues', label: 'Public Issues', count: filteredIssues.length },
              { key: 'notices', label: 'Admin Notices', count: notices.length },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                  ${tab === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {t.label}
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px]
                  ${tab === t.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'}`}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          {tab === 'issues' && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 items-center">
                <Filter size={12} className="text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="bg-white border border-gray-200 rounded-md px-2.5 py-1 text-xs text-gray-600 outline-none"
                >
                  {statuses.map(s => <option key={s}>{s}</option>)}
                </select>
                <select
                  value={catFilter}
                  onChange={e => setCatFilter(e.target.value)}
                  className="bg-white border border-gray-200 rounded-md px-2.5 py-1 text-xs text-gray-600 outline-none"
                >
                  {categories.map(c => <option key={c}>{c}</option>)}
                </select>
                {(statusFilter !== 'All' || catFilter !== 'All') && (
                  <button
                    onClick={() => { setStatusFilter('All'); setCatFilter('All'); }}
                    className="text-[10px] text-gray-400 hover:text-gray-600 px-1.5"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {filteredIssues.map(issue => (
                  <CivicPost key={issue.id} issue={issue} />
                ))}
              </div>

              {filteredIssues.length === 0 && (
                <div className="text-center py-12 text-gray-400 text-sm">No issues match the filters</div>
              )}
            </div>
          )}

          {tab === 'notices' && (
            <div className="space-y-3">
              {notices.map(notice => (
                <NoticePost
                  key={notice.id}
                  notice={notice}
                  onDelete={id => setNotices(prev => prev.filter(n => n.id !== id))}
                />
              ))}
              {notices.length === 0 && (
                <div className="text-center py-12 text-gray-400 text-sm">No notices</div>
              )}
            </div>
          )}
        </div>
      </div>

      {showCompose && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowCompose(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
                <Megaphone size={16} className="text-blue-600" /> Post Admin Notice
              </h3>
              <button onClick={() => setShowCompose(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-semibold text-gray-400 mb-1.5 block uppercase">Notice Type</label>
                <div className="flex flex-wrap gap-1.5">
                  {NOTICE_TYPES.map(type => {
                    const cfg = noticeCfg[type];
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={type}
                        onClick={() => setNoticeType(type)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all
                          ${noticeType === type ? `${cfg.badge} border-current` : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'}`}
                      >
                        <Icon size={12} /> {type}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-400 mb-1 block uppercase">Title</label>
                <input
                  type="text"
                  value={noticeTitle}
                  onChange={e => setNoticeTitle(e.target.value)}
                  placeholder="Notice title..."
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-400 mb-1 block uppercase">Message</label>
                <textarea
                  value={noticeBody}
                  onChange={e => setNoticeBody(e.target.value)}
                  placeholder="Write your message..."
                  rows={3}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-400 resize-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-400 mb-1 block uppercase">Target Ward</label>
                <select
                  value={noticeWard}
                  onChange={e => setNoticeWard(e.target.value)}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-600 outline-none focus:border-blue-400"
                >
                  {wardOptions.map(w => <option key={w}>{w}</option>)}
                </select>
              </div>
              {postSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-md px-4 py-2 text-sm text-green-700 font-medium text-center">
                  Notice posted!
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <Button onClick={handlePostNotice} disabled={!noticeTitle.trim() || !noticeBody.trim()} className="flex-1 justify-center" size="sm">
                  <Send size={13} /> Publish Notice
                </Button>
                <Button variant="outline" onClick={() => setShowCompose(false)} size="sm">Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

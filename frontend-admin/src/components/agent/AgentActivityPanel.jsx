import { useState, useEffect, useCallback } from 'react';
import { apiGetAgentStatus, apiGetAgentTrace, apiTriggerAgentProcessing } from '../../services/api';
import {
  Bot, Loader2, AlertCircle, ChevronDown, ChevronRight,
  CheckCircle2, AlertTriangle, Clock, Eye, Zap, Send,
  XCircle, RotateCcw, ArrowUpCircle, Play,
} from 'lucide-react';

const ACTION_LABELS = {
  RECEIVED: { label: 'Complaint Received', icon: Send, color: 'text-blue-600', bg: 'bg-blue-100' },
  UNDERSTAND: { label: 'Evidence Understood', icon: Eye, color: 'text-indigo-600', bg: 'bg-indigo-100' },
  ANALYZED: { label: 'Complaint Analyzed', icon: Zap, color: 'text-purple-600', bg: 'bg-purple-100' },
  DECIDED: { label: 'Decision Made', icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-100' },
  WORKER_ASSIGNED: { label: 'Worker Assigned', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100' },
  ASSIGNMENT_FAILED: { label: 'Worker Assignment Failed', icon: XCircle, color: 'text-red-600', bg: 'bg-red-100' },
  REVIEW_REQUIRED: { label: 'Review Required', icon: Eye, color: 'text-yellow-600', bg: 'bg-yellow-100' },
  FOLLOW_UP_REQUIRED: { label: 'Follow-up Required', icon: Clock, color: 'text-orange-600', bg: 'bg-orange-100' },
  ESCALATION_REQUIRED: { label: 'Escalation Required', icon: ArrowUpCircle, color: 'text-red-600', bg: 'bg-red-100' },
  FOLLOW_UP_INITIATED: { label: 'Follow-up Initiated', icon: RotateCcw, color: 'text-orange-600', bg: 'bg-orange-100' },
  ESCALATION_INITIATED: { label: 'Escalation Initiated', icon: ArrowUpCircle, color: 'text-red-600', bg: 'bg-red-100' },
  COMPLETED: { label: 'Agent Processing Completed', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100' },
  DECISION_FAILED: { label: 'Decision Failed', icon: XCircle, color: 'text-red-600', bg: 'bg-red-100' },
  UNDERSTAND_FAILED: { label: 'Understanding Failed', icon: XCircle, color: 'text-red-600', bg: 'bg-red-100' },
};

function getActionMeta(action) {
  return ACTION_LABELS[action] || { label: action, icon: AlertCircle, color: 'text-gray-500', bg: 'bg-gray-100' };
}

function isWarningAction(action) {
  return ['FOLLOW_UP_REQUIRED', 'FOLLOW_UP_INITIATED', 'REVIEW_REQUIRED'].includes(action);
}

function isEscalationAction(action) {
  return ['ESCALATION_REQUIRED', 'ESCALATION_INITIATED'].includes(action);
}

function isFailureAction(action) {
  return ['ASSIGNMENT_FAILED', 'DECISION_FAILED', 'UNDERSTAND_FAILED'].includes(action);
}

function TimelineStep({ trace, isLast }) {
  const [expanded, setExpanded] = useState(false);
  const meta = getActionMeta(trace.action);
  const Icon = meta.icon;
  const isWarn = isWarningAction(trace.action);
  const isEsc = isEscalationAction(trace.action);
  const isFail = isFailureAction(trace.action);

  const borderColor = isFail ? 'border-red-300' : isEsc ? 'border-red-200' : isWarn ? 'border-orange-200' : 'border-blue-200';
  const lineColor = isFail ? 'bg-red-300' : isEsc ? 'bg-red-200' : isWarn ? 'bg-orange-300' : 'bg-blue-300';

  const hasDetails = trace.decision || trace.output_data || trace.duration_ms;
  const time = trace.timestamp ? new Date(trace.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';

  return (
    <div className="relative flex gap-3">
      {/* Vertical line */}
      <div className="flex flex-col items-center">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${meta.bg} border-2 ${borderColor}`}>
          <Icon size={13} className={meta.color} />
        </div>
        {!isLast && <div className={`w-0.5 flex-1 min-h-[20px] ${lineColor}`} />}
      </div>

      {/* Content */}
      <div className={`flex-1 pb-4 ${isLast ? '' : ''}`}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-800">{meta.label}</p>
          <span className="text-[10px] text-gray-400 flex-shrink-0">{time}</span>
        </div>

        {trace.duration_ms != null && (
          <p className="text-[10px] text-gray-400 mt-0.5">{trace.duration_ms}ms</p>
        )}

        {/* Quick summary for ANALYZED */}
        {trace.action === 'ANALYZED' && trace.decision && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {trace.decision.severity && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                trace.decision.severity.level === 'HIGH' ? 'bg-red-100 text-red-700' :
                trace.decision.severity.level === 'MEDIUM' ? 'bg-orange-100 text-orange-700' :
                'bg-green-100 text-green-700'
              }`}>
                {trace.decision.severity.level} severity
              </span>
            )}
            {trace.decision.priority && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                trace.decision.priority.level === 'High' || trace.decision.priority.level === 'HIGH' ? 'bg-red-100 text-red-700' :
                trace.decision.priority.level === 'Medium' || trace.decision.priority.level === 'MEDIUM' ? 'bg-orange-100 text-orange-700' :
                'bg-green-100 text-green-700'
              }`}>
                {trace.decision.priority.level} priority
              </span>
            )}
            {trace.decision.department && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                {trace.decision.department.name}
              </span>
            )}
            {trace.decision.classification && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                {trace.decision.classification.category} ({Math.round((trace.decision.classification.confidence || 0) * 100)}%)
              </span>
            )}
          </div>
        )}

        {/* Quick summary for DECIDED */}
        {trace.action === 'DECIDED' && trace.decision && (
          <div className="mt-1.5">
            {trace.decision.recommended_action && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                {trace.decision.recommended_action}
              </span>
            )}
          </div>
        )}

        {/* Quick summary for WORKER_ASSIGNED */}
        {trace.action === 'WORKER_ASSIGNED' && trace.output_data && (
          <p className="text-xs text-green-700 mt-1">
            {trace.output_data.worker_name || trace.output_data.message || 'Worker assigned'}
          </p>
        )}

        {/* Expandable details */}
        {hasDetails && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 mt-1.5 transition-colors"
          >
            {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            {expanded ? 'Hide details' : 'Show details'}
          </button>
        )}

        {expanded && (
          <div className="mt-1.5 p-2.5 bg-gray-50 rounded-lg text-[11px] text-gray-600 space-y-1.5 border border-gray-100">
            {trace.decision && (
              <div>
                <p className="font-semibold text-gray-500 uppercase text-[9px] tracking-wide">Decision</p>
                <pre className="whitespace-pre-wrap font-mono text-[10px] text-gray-600 mt-0.5">
                  {JSON.stringify(trace.decision, null, 2)}
                </pre>
              </div>
            )}
            {trace.output_data && (
              <div>
                <p className="font-semibold text-gray-500 uppercase text-[9px] tracking-wide">Output</p>
                <pre className="whitespace-pre-wrap font-mono text-[10px] text-gray-600 mt-0.5">
                  {JSON.stringify(trace.output_data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AgentActivityPanel({ issueId }) {
  const [status, setStatus] = useState(null);
  const [traces, setTraces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [runLoading, setRunLoading] = useState(false);
  const [runResult, setRunResult] = useState('');
  const [showReasoning, setShowReasoning] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statusData, traceData] = await Promise.all([
        apiGetAgentStatus(issueId),
        apiGetAgentTrace(issueId),
      ]);
      setStatus(statusData);
      setTraces(traceData.traces || []);
    } catch (e) {
      setError(e.message || 'Failed to load agent data');
    } finally {
      setLoading(false);
    }
  }, [issueId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRunAgent = async () => {
    setRunLoading(true);
    setRunResult('');
    try {
      await apiTriggerAgentProcessing(issueId);
      setRunResult('success');
      await fetchData();
    } catch (e) {
      setRunResult(e.message || 'Processing failed');
    } finally {
      setRunLoading(false);
      setTimeout(() => setRunResult(''), 3000);
    }
  };

  // Find the ANALYZED trace for reasoning
  const analyzedTrace = traces.find(t => t.action === 'ANALYZED');
  const reasoning = analyzedTrace?.decision?.reasoning;
  const hasTraces = traces.length > 0;

  if (loading) {
    return (
      <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Bot size={16} className="text-blue-600" />
          <p className="text-sm font-semibold text-gray-800">Agent Activity</p>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-xs">Loading agent data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Bot size={16} className="text-blue-600" />
          <p className="text-sm font-semibold text-gray-800">Agent Activity</p>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-500">
            <AlertCircle size={14} />
            <span className="text-xs">{error}</span>
          </div>
          <button onClick={fetchData} className="text-xs text-blue-600 hover:underline">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-50/80 to-indigo-50/50 rounded-xl border border-blue-100 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-blue-600" />
          <p className="text-sm font-semibold text-gray-800">Agent Activity</p>
        </div>
        <div className="flex items-center gap-2">
          {status?.agent_processing ? (
            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
              Processing
            </span>
          ) : hasTraces ? (
            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
              <CheckCircle2 size={10} />
              Processed
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              <Clock size={10} />
              Pending
            </span>
          )}
        </div>
      </div>

      {/* Empty state */}
      {!hasTraces && !loading && (
        <div className="text-center py-4">
          <Bot size={28} className="text-gray-300 mx-auto mb-2" />
          <p className="text-xs text-gray-500 mb-3">Agent has not processed this complaint yet.</p>
          <button
            onClick={handleRunAgent}
            disabled={runLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50"
          >
            {runLoading ? <Loader2 size={12} className="animate-spin" /> : <Play size={11} />}
            {runLoading ? 'Processing...' : 'Run Agent'}
          </button>
          {runResult === 'success' && <p className="text-[10px] text-green-600 mt-2">Agent processing completed</p>}
          {runResult && runResult !== 'success' && <p className="text-[10px] text-red-500 mt-2">{runResult}</p>}
        </div>
      )}

      {/* Status summary */}
      {status && hasTraces && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-3 p-2.5 bg-white/70 rounded-lg border border-white">
          {status.priority && (
            <div>
              <p className="text-[9px] text-gray-400 uppercase tracking-wide font-semibold">Priority</p>
              <p className={`text-xs font-bold ${
                status.priority === 'High' ? 'text-red-600' :
                status.priority === 'Medium' ? 'text-orange-600' : 'text-green-600'
              }`}>{status.priority}</p>
            </div>
          )}
          {status.latest_agent_action && (
            <div>
              <p className="text-[9px] text-gray-400 uppercase tracking-wide font-semibold">Latest Action</p>
              <p className="text-xs font-medium text-gray-700">{getActionMeta(status.latest_agent_action).label}</p>
            </div>
          )}
          {status.assigned_worker && (
            <div>
              <p className="text-[9px] text-gray-400 uppercase tracking-wide font-semibold">Assigned Worker</p>
              <p className="text-xs font-medium text-gray-700">{status.assigned_worker.display_id || status.assigned_worker.id}</p>
            </div>
          )}
          <div>
            <p className="text-[9px] text-gray-400 uppercase tracking-wide font-semibold">Trace Steps</p>
            <p className="text-xs font-medium text-gray-700">{status.trace_count}</p>
          </div>
        </div>
      )}

      {/* Timeline */}
      {hasTraces && (
        <div className="mb-3">
          <p className="text-[9px] text-gray-400 uppercase tracking-wide font-semibold mb-2">Decision Timeline</p>
          <div className="space-y-0">
            {[...traces].reverse().map((trace, idx) => (
              <TimelineStep
                key={trace.timestamp + trace.action}
                trace={trace}
                isLast={idx === traces.length - 1}
              />
            ))}
          </div>
        </div>
      )}

      {/* Reasoning */}
      {reasoning && (
        <div className="mb-3">
          <button
            onClick={() => setShowReasoning(v => !v)}
            className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700 transition-colors"
          >
            {showReasoning ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            AI Reasoning
          </button>
          {showReasoning && (
            <div className="mt-2 p-3 bg-white/80 rounded-lg border border-white text-xs text-gray-600 italic leading-relaxed">
              "{reasoning}"
            </div>
          )}
        </div>
      )}

      {/* Run Agent button */}
      {hasTraces && (
        <div className="pt-2 border-t border-blue-100">
          <div className="flex items-center justify-between">
            <button
              onClick={handleRunAgent}
              disabled={runLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50"
            >
              {runLoading ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
              {runLoading ? 'Processing...' : 'Re-run Agent'}
            </button>
            {runResult === 'success' && <span className="text-[10px] text-green-600 font-medium">Done</span>}
            {runResult && runResult !== 'success' && <span className="text-[10px] text-red-500">{runResult}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

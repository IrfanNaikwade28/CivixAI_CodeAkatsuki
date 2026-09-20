// Unified FeedIssueCard — used by CivicFeed (Citizen) and WorkerFeed (Worker)
import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  TextInput, ScrollView, ActivityIndicator,
} from 'react-native';
import {
  ThumbsUp, MessageCircle, MapPin, CheckCircle,
  Clock, ChevronDown, ChevronUp, Wrench, Send, Image as ImageIcon,
} from 'lucide-react-native';
import { categoryIcons, categoryColors, statusConfig } from '../../data/mockData';
import { issuesAPI } from '../../services/api';

// Safe ISO 8601 date parser for Hermes (React Native).
// Hermes cannot parse strings with +HH:MM timezone offsets — strip them first.
function safeParseDateStr(str) {
  if (!str) return null;
  // Replace "+05:30" style offset (or "-05:30") with "Z" so Hermes can parse it
  const normalised = str.replace(/([+-]\d{2}:\d{2})$/, 'Z');
  const d = new Date(normalised);
  return isNaN(d.getTime()) ? null : d;
}

function StatusPill({ status }) {
  const cfg = statusConfig[status] || statusConfig['Submitted'];
  return (
    <View style={[styles.pill, { backgroundColor: cfg.bg }]}>
      <View style={[styles.pillDot, { backgroundColor: cfg.dot }]} />
      <Text style={[styles.pillText, { color: cfg.text }]}>{status}</Text>
    </View>
  );
}

const STEPS = ['Submitted', 'Assigned', 'In Progress', 'Resolved'];

function StatusStepper({ status }) {
  const idx = STEPS.indexOf(status);
  return (
    <View style={styles.stepper}>
      {STEPS.map((step, i) => {
        const done = i <= idx;
        const isCurrent = i === idx;
        return (
          <View key={step} style={[styles.stepItem, i < STEPS.length - 1 && styles.stepItemFlex]}>
            <View style={styles.stepCol}>
              <View style={[
                styles.stepCircle,
                done && !isCurrent && styles.stepCircleDone,
                isCurrent && styles.stepCircleCurrent,
                !done && styles.stepCircleEmpty,
              ]}>
                {done && !isCurrent && <CheckCircle size={10} color="#fff" />}
                {isCurrent && <View style={styles.stepInnerDot} />}
              </View>
              <Text style={[styles.stepLabel, done ? styles.stepLabelDone : styles.stepLabelEmpty]}>
                {step === 'In Progress' ? 'In Prog.' : step}
              </Text>
            </View>
            {i < STEPS.length - 1 && (
              <View style={[styles.stepLine, i < idx ? styles.stepLineDone : styles.stepLineEmpty]} />
            )}
          </View>
        );
      })}
    </View>
  );
}

export default function FeedIssueCard({ issue, readOnly = false, onUpvote, upvoted = false, onComment }) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [localComments, setLocalComments] = useState(issue.comments || []);
  const [commentLoading, setCommentLoading] = useState(false);

  const isResolved = issue.status === 'Resolved' || issue.status === 'Closed';
  const catColors = categoryColors[issue.category] || { bg: '#f3f4f6', text: '#374151' };

  // Upvote is fully controlled by parent (CivicFeed) via upvoted prop + onUpvote callback.
  // We only read props here — no internal toggle state.
  const localUpvotes = issue.upvotes ?? 0;
  const hasUpvoted = upvoted;

  const handleUpvote = () => {
    if (readOnly) return;
    onUpvote?.(issue.id);
  };

  const handleComment = async () => {
    const text = commentText.trim();
    if (!text) return;
    setCommentLoading(true);
    try {
      const { data } = await issuesAPI.addComment(issue._id, text);
      // Normalise backend response to local shape
      const newComment = {
        id:   data.id,
        user: data.user_name || 'You',
        text: data.text,
        time: data.created_at,
      };
      setLocalComments(prev => [...prev, newComment]);
      setCommentText('');
      onComment?.(issue.id, newComment);
    } catch (err) {
      console.warn('addComment failed:', err.message);
    } finally {
      setCommentLoading(false);
    }
  };

  return (
    <View style={[styles.card, isResolved ? styles.cardResolved : styles.cardDefault]}>
      {/* Left accent bar for resolved posts */}
      {isResolved && <View style={styles.resolvedAccentBar} />}

      {/* Issue / Before photo */}
      {issue.image ? (
        <View style={styles.photoContainer}>
          <Image source={{ uri: issue.image }} style={styles.photo} resizeMode="cover" />
          <View style={styles.photoOverlay} />
          {/* Category badge */}
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>
              {categoryIcons[issue.category]} {issue.category}
            </Text>
          </View>
          {isResolved && (
            <View style={styles.resolvedBadge}>
              <CheckCircle size={10} color="#fff" />
              <Text style={styles.resolvedBadgeText}>Resolved</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={[styles.noPhtoBanner, isResolved ? styles.noPhotoBannerResolved : styles.noPhotoBannerDefault]}>
          <Text style={styles.noPhotoEmoji}>{categoryIcons[issue.category]}</Text>
          <Text style={styles.noPhotoCategory}>{issue.category}</Text>
          {isResolved && (
            <View style={[styles.resolvedBadge, { marginLeft: 'auto' }]}>
              <CheckCircle size={10} color="#fff" />
              <Text style={styles.resolvedBadgeText}>Resolved</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.body}>
        {/* Reporter row */}
        <View style={styles.reporterRow}>
          {issue.reporterPhoto ? (
            <Image source={{ uri: issue.reporterPhoto }} style={styles.avatarPhoto} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(issue.reporterName || 'A').charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.reporterInfo}>
            <Text style={styles.reporterName}>{issue.reporterName || 'Anonymous'}</Text>
            <View style={styles.reporterMeta}>
              <MapPin size={9} color="#9ca3af" />
              <Text style={styles.reporterMetaText}>
                {issue.ward}
                {issue.distance ? ` · ${issue.distance}` : ''}
                {' · '}{new Date(issue.reportedAt || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
              </Text>
            </View>
          </View>
          <View style={[
            styles.priorityBadge,
            issue.priority === 'High' ? styles.priorityHigh :
            issue.priority === 'Medium' ? styles.priorityMedium : styles.priorityLow,
          ]}>
            <Text style={[
              styles.priorityText,
              issue.priority === 'High' ? styles.priorityHighText :
              issue.priority === 'Medium' ? styles.priorityMediumText : styles.priorityLowText,
            ]}>{issue.priority}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>{issue.title}</Text>

        {/* Status stepper */}
        <StatusStepper status={issue.status} />

        {/* Assigned worker row */}
        {issue.assignedTo && (
          <View style={[styles.workerRow, isResolved ? styles.workerRowResolved : styles.workerRowAssigned]}>
            <Wrench size={12} color={isResolved ? '#16a34a' : '#3b82f6'} />
            <Text style={[styles.workerLabel, isResolved ? styles.workerLabelResolved : styles.workerLabelAssigned]}>
              {isResolved ? 'Resolved by' : 'Assigned to'}:
            </Text>
            <Text style={[styles.workerName, isResolved ? styles.workerNameResolved : styles.workerNameAssigned]}>
              {issue.assignedToName || issue.assignedTo}
            </Text>
          </View>
        )}

        {/* Completion photo */}
        {issue.completionPhoto && (
          <View style={styles.completionSection}>
            {/* Divider strip — visually joins before & after as one post */}
            <View style={styles.completionDivider}>
              <View style={styles.completionDividerLine} />
              <View style={styles.completionDividerPill}>
                <CheckCircle size={9} color="#15803d" />
                <Text style={styles.completionDividerText}>After Fix</Text>
              </View>
              <View style={styles.completionDividerLine} />
            </View>

            {/* Tinted inset panel */}
            <View style={styles.completionPanel}>
              <View style={styles.completionHeader}>
                {issue.resolvedAt && (
                  <View style={styles.completionDate}>
                    <Clock size={9} color="#9ca3af" />
                    <Text style={styles.completionDateText}>
                      {new Date(issue.resolvedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.completionPhotoContainer}>
                <Image source={{ uri: issue.completionPhoto }} style={styles.completionPhoto} resizeMode="cover" />
                <View style={styles.completionPhotoOverlay}>
                  <View style={styles.completionOverlayRow}>
                    <Text style={styles.completionPhotoText}>
                      {issue.assignedToName || issue.assignedTo ? `Fixed by ${issue.assignedToName || issue.assignedTo}` : 'Issue resolved'}
                    </Text>
                    {issue.aiScore != null && (
                      <View style={[
                        styles.aiScoreBadge,
                        issue.aiScore >= 70 ? styles.aiScoreGood :
                        issue.aiScore >= 40 ? styles.aiScoreWarning : styles.aiScorePoor,
                      ]}>
                        <Text style={styles.aiScoreText}>AI {issue.aiScore}%</Text>
                      </View>
                    )}
                  </View>
                  {issue.aiVerdict ? (
                    <Text style={styles.aiVerdictText}>{issue.aiVerdict}</Text>
                  ) : null}
                </View>
              </View>
            </View>
          </View>
        )}

        {/* No completion photo placeholder */}
        {isResolved && !issue.completionPhoto && (
          <View style={styles.noCompletionPhoto}>
            <ImageIcon size={12} color="#d1d5db" />
            <Text style={styles.noCompletionPhotoText}>No completion photo uploaded</Text>
          </View>
        )}

        {/* Actions bar */}
        <View style={styles.actionsBar}>
          <TouchableOpacity
            onPress={handleUpvote}
            disabled={readOnly}
            style={[styles.actionBtn, hasUpvoted ? styles.upvotedBtn : styles.defaultActionBtn]}
          >
            <ThumbsUp size={13} color={hasUpvoted ? '#fff' : '#4b5563'} fill={hasUpvoted ? '#fff' : 'none'} />
            <Text style={[styles.actionBtnText, hasUpvoted ? styles.upvotedBtnText : styles.defaultActionBtnText]}>
              {localUpvotes}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowComments(v => !v)}
            style={[styles.actionBtn, styles.defaultActionBtn]}
          >
            <MessageCircle size={13} color="#4b5563" />
            <Text style={[styles.actionBtnText, styles.defaultActionBtnText]}>{localComments.length}</Text>
            {showComments ? <ChevronUp size={12} color="#4b5563" /> : <ChevronDown size={12} color="#4b5563" />}
          </TouchableOpacity>

          <Text style={styles.issueId}>{issue.id}</Text>
        </View>

        {/* Comments section */}
        {showComments && (
          <View style={styles.commentsSection}>
            {localComments.length === 0 && (
              <Text style={styles.noCommentsText}>No comments yet. Be the first!</Text>
            )}
            {localComments.map(c => (
              <View key={c.id} style={styles.commentRow}>
                <View style={styles.commentAvatar}>
                  <Text style={styles.commentAvatarText}>{(c.user || 'A').charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.commentBubble}>
                  <Text style={styles.commentUser}>{c.user}</Text>
                  <Text style={styles.commentText}>{c.text}</Text>
                  <Text style={styles.commentTime}>
                    {(() => {
                      const d = safeParseDateStr(c.time);
                      return d
                        ? d.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
                        : '';
                    })()}
                  </Text>
                </View>
              </View>
            ))}

            {!readOnly && (
              <View style={styles.commentInput}>
                <TextInput
                  value={commentText}
                  onChangeText={setCommentText}
                  placeholder="Add a comment..."
                  placeholderTextColor="#9ca3af"
                  style={styles.commentTextInput}
                  editable={!commentLoading}
                />
                <TouchableOpacity
                  onPress={handleComment}
                  disabled={!commentText.trim() || commentLoading}
                  style={[styles.sendBtn, (!commentText.trim() || commentLoading) && styles.sendBtnDisabled]}
                >
                  {commentLoading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Send size={13} color="#fff" />}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', borderWidth: 1, marginBottom: 12 },
  cardDefault: { borderColor: '#e5e7eb' },
  cardResolved: { borderColor: '#bbf7d0', backgroundColor: '#fafffe' },
  resolvedAccentBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: '#22c55e', zIndex: 10 },
  photoContainer: { width: '100%', aspectRatio: 16 / 9, position: 'relative' },
  photo: { width: '100%', height: '100%' },
  photoOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent' },
  categoryBadge: { position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(255,255,255,0.85)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  categoryBadgeText: { fontSize: 11, fontWeight: '600', color: '#374151' },
  resolvedBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: '#22c55e', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 4 },
  resolvedBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  noPhtoBanner: { height: 40, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 8 },
  noPhotoBannerDefault: { backgroundColor: '#f9fafb' },
  noPhotoBannerResolved: { backgroundColor: '#f0fdf4' },
  noPhotoEmoji: { fontSize: 16 },
  noPhotoCategory: { fontSize: 11, color: '#6b7280', fontWeight: '500' },
  body: { padding: 16 },
  reporterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center' },
  avatarPhoto: { width: 32, height: 32, borderRadius: 16 },
  avatarText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  reporterInfo: { flex: 1 },
  reporterName: { fontSize: 11, fontWeight: '700', color: '#1f2937' },
  reporterMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  reporterMetaText: { fontSize: 10, color: '#9ca3af' },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  priorityHigh: { backgroundColor: '#fee2e2' },
  priorityMedium: { backgroundColor: '#ffedd5' },
  priorityLow: { backgroundColor: '#dcfce7' },
  priorityText: { fontSize: 11, fontWeight: '600' },
  priorityHighText: { color: '#dc2626' },
  priorityMediumText: { color: '#ea580c' },
  priorityLowText: { color: '#16a34a' },
  title: { fontSize: 13, fontWeight: '700', color: '#111827', lineHeight: 18, marginBottom: 8 },
  // Stepper
  stepper: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 4 },
  stepItem: { flexDirection: 'row', alignItems: 'center' },
  stepItemFlex: { flex: 1 },
  stepCol: { alignItems: 'center' },
  stepCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stepCircleDone: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  stepCircleCurrent: { backgroundColor: '#2563eb', borderColor: '#2563eb', transform: [{ scale: 1.1 }] },
  stepCircleEmpty: { backgroundColor: '#fff', borderColor: '#e5e7eb' },
  stepInnerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  stepLabel: { fontSize: 9, marginTop: 3, fontWeight: '500', textAlign: 'center' },
  stepLabelDone: { color: '#2563eb' },
  stepLabelEmpty: { color: '#d1d5db' },
  stepLine: { flex: 1, height: 2, marginHorizontal: 3, marginBottom: 14, borderRadius: 2 },
  stepLineDone: { backgroundColor: '#60a5fa' },
  stepLineEmpty: { backgroundColor: '#f3f4f6' },
  // Worker row
  workerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  workerRowAssigned: { backgroundColor: '#eff6ff' },
  workerRowResolved: { backgroundColor: '#f0fdf4' },
  workerLabel: { fontSize: 11, fontWeight: '700' },
  workerLabelAssigned: { color: '#1d4ed8' },
  workerLabelResolved: { color: '#15803d' },
  workerName: { fontSize: 11 },
  workerNameAssigned: { color: '#2563eb' },
  workerNameResolved: { color: '#16a34a' },
  // Completion photo
  completionSection: { marginTop: 14 },
  completionDivider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  completionDividerLine: { flex: 1, height: 1, backgroundColor: '#bbf7d0' },
  completionDividerPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  completionDividerText: { fontSize: 10, fontWeight: '700', color: '#15803d' },
  completionPanel: { backgroundColor: '#f0fdf4', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#bbf7d0' },
  completionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  completionLabel: { fontSize: 11, fontWeight: '700', color: '#15803d' },
  completionDate: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 'auto' },
  completionDateText: { fontSize: 10, color: '#9ca3af' },
  completionPhotoContainer: { borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#86efac', aspectRatio: 16 / 9 },
  completionPhoto: { width: '100%', height: '100%' },
  completionPhotoOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(20,83,45,0.5)', padding: 8 },
  completionOverlayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  completionPhotoText: { color: '#fff', fontSize: 10, fontWeight: '600', flex: 1 },
  aiScoreBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20 },
  aiScoreGood: { backgroundColor: '#16a34a' },
  aiScoreWarning: { backgroundColor: '#d97706' },
  aiScorePoor: { backgroundColor: '#dc2626' },
  aiScoreText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  aiVerdictText: { color: 'rgba(255,255,255,0.85)', fontSize: 9, marginTop: 2 },
  noCompletionPhoto: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: '#e5e7eb' },
  noCompletionPhotoText: { fontSize: 11, color: '#9ca3af' },
  // Actions bar
  actionsBar: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f9fafb' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  defaultActionBtn: { backgroundColor: '#f3f4f6' },
  upvotedBtn: { backgroundColor: '#2563eb' },
  actionBtnText: { fontSize: 13, fontWeight: '600' },
  defaultActionBtnText: { color: '#4b5563' },
  upvotedBtnText: { color: '#fff' },
  issueId: { marginLeft: 'auto', fontSize: 10, color: '#d1d5db', fontFamily: 'monospace' },
  // Comments
  commentsSection: { marginTop: 12, gap: 8 },
  noCommentsText: { fontSize: 11, color: '#9ca3af', textAlign: 'center', paddingVertical: 8 },
  commentRow: { flexDirection: 'row', gap: 8 },
  commentAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  commentAvatarText: { fontSize: 11, fontWeight: '700', color: '#6b7280' },
  commentBubble: { flex: 1, backgroundColor: '#f9fafb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  commentUser: { fontSize: 11, fontWeight: '700', color: '#374151' },
  commentText: { fontSize: 11, color: '#4b5563', marginTop: 2 },
  commentTime: { fontSize: 10, color: '#9ca3af', marginTop: 4 },
  commentInput: { flexDirection: 'row', gap: 8, paddingTop: 4 },
  commentTextInput: { flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontSize: 11, color: '#111827', backgroundColor: '#fff' },
  sendBtn: { padding: 8, backgroundColor: '#2563eb', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 11, fontWeight: '700' },
});

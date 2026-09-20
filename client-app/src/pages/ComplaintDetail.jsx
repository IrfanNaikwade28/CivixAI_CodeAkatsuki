import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useClient } from '../context/ClientContext';
import {
  ArrowLeft, ThumbsUp, MessageCircle, Send, User,
  CheckCircle2, ImageIcon, ShieldCheck,
} from 'lucide-react-native';
import { categoryIcons, statusConfig } from '../data/mockData';

const STEPS = ['Submitted', 'Assigned', 'In Progress', 'Resolved', 'Closed'];

function StatusBadge({ status }) {
  const cfg = statusConfig[status] || statusConfig['Submitted'];
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <View style={[styles.badgeDot, { backgroundColor: cfg.dot }]} />
      <Text style={[styles.badgeText, { color: cfg.text }]}>{status}</Text>
    </View>
  );
}

export default function ComplaintDetail({ complaint, onBack }) {
  const { addComment, upvoteComplaint, complaints } = useClient();
  const [comment, setComment] = useState('');
  const [upvoted, setUpvoted] = useState(false);

  const live = complaints.find(c => c.id === complaint.id) || complaint;
  const stepIndex = STEPS.indexOf(live.status);
  const isResolved = live.status === 'Resolved' || live.status === 'Closed';

  const handleUpvote = () => {
    if (!upvoted) { upvoteComplaint(live.id); setUpvoted(true); }
  };

  const handleComment = () => {
    if (!comment.trim()) return;
    addComment(live.id, comment.trim());
    setComment('');
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero / Header */}
        {live.image ? (
          <View style={styles.heroContainer}>
            <Image source={{ uri: live.image }} style={styles.heroImage} resizeMode="cover" />
            <View style={styles.heroOverlay} />
            <TouchableOpacity style={styles.heroBackBtn} onPress={onBack}>
              <ArrowLeft size={15} color="#fff" />
              <Text style={styles.heroBackText}>Back</Text>
            </TouchableOpacity>
            <View style={styles.heroCatBadge}>
              <Text style={styles.heroCatText}>{live.category}</Text>
            </View>
            <View style={styles.heroBottom}>
              <Text style={styles.heroId}>{live.id}</Text>
              <Text style={styles.heroTitle} numberOfLines={2}>{live.title}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.noPhotoHeader}>
            <TouchableOpacity style={styles.backBtnRow} onPress={onBack}>
              <ArrowLeft size={16} color="#6b7280" />
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
            <View style={styles.noPhotoTitleRow}>
              <View style={styles.noPhotoIcon}>
                <Text style={{ fontSize: 24 }}>{categoryIcons[live.category]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.noPhotoId}>{live.id}</Text>
                <Text style={styles.noPhotoTitle} numberOfLines={1}>{live.title}</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.content}>
          {/* Status & meta card */}
          <View style={styles.card}>
            <View style={styles.badgeRow}>
              <StatusBadge status={live.status} />
              <View style={[
                styles.priorityBadge,
                live.priority === 'High' ? { backgroundColor: '#fee2e2' } :
                live.priority === 'Medium' ? { backgroundColor: '#ffedd5' } : { backgroundColor: '#dcfce7' },
              ]}>
                <Text style={[
                  styles.priorityText,
                  live.priority === 'High' ? { color: '#b91c1c' } :
                  live.priority === 'Medium' ? { color: '#c2410c' } : { color: '#15803d' },
                ]}>{live.priority} Priority</Text>
              </View>
              <View style={styles.catBadge}>
                <Text style={styles.catBadgeText}>{live.category}</Text>
              </View>
            </View>

            {live.image && (
              <Text style={styles.cardTitle}>{live.title}</Text>
            )}
            <Text style={styles.cardDesc}>{live.description}</Text>

            <View style={styles.metaRows}>
              <Text style={styles.metaText}>📍 {live.location} · {live.ward}</Text>
              <Text style={styles.metaText}>🕐 Reported: {new Date(live.reportedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</Text>
            </View>

            {live.assignedToName && (
              <View style={[styles.assignedBox, isResolved ? styles.assignedBoxGreen : styles.assignedBoxBlue]}>
                <View style={[styles.assignedAvatar, isResolved ? { backgroundColor: '#22c55e' } : { backgroundColor: '#2563eb' }]}>
                  <User size={13} color="#fff" />
                </View>
                <View>
                  <Text style={[styles.assignedName, isResolved ? { color: '#15803d' } : { color: '#1d4ed8' }]}>
                    {isResolved ? 'Resolved by' : 'Assigned to'}: {live.assignedToName}
                  </Text>
                  {live.resolvedAt && (
                    <Text style={styles.resolvedAt}>
                      {new Date(live.resolvedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                    </Text>
                  )}
                </View>
              </View>
            )}
          </View>

          {/* Photo evidence */}
          {(live.image || live.completionPhoto) && (
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>PHOTO EVIDENCE</Text>
              <View style={[styles.photosRow, (live.image && live.completionPhoto) ? { gap: 12 } : {}]}>
                {live.image && (
                  <View style={{ flex: 1 }}>
                    <Text style={styles.photoLabel}>Before</Text>
                    <View style={styles.photoBox}>
                      <Image source={{ uri: live.image }} style={styles.evidencePhoto} resizeMode="cover" />
                      <View style={styles.evidenceCaption}>
                        <Text style={styles.evidenceCaptionText}>Reported</Text>
                      </View>
                    </View>
                  </View>
                )}
                {live.completionPhoto ? (
                  <View style={{ flex: 1 }}>
                    <Text style={styles.photoLabel}>After Fix</Text>
                    <View style={styles.photoBox}>
                      <Image source={{ uri: live.completionPhoto }} style={styles.evidencePhoto} resizeMode="cover" />
                      <View style={[styles.evidenceCaption, { backgroundColor: 'rgba(22,163,74,0.8)' }]}>
                        <CheckCircle2 size={10} color="#fff" />
                        <Text style={styles.evidenceCaptionText}> Fixed</Text>
                      </View>
                    </View>
                  </View>
                ) : !isResolved && live.image ? (
                  <View style={{ flex: 1 }}>
                    <Text style={styles.photoLabel}>After Fix</Text>
                    <View style={styles.pendingPhoto}>
                      <ImageIcon size={20} color="#d1d5db" />
                      <Text style={styles.pendingPhotoText}>Pending{'\n'}resolution</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            </View>
          )}

          {/* AI verification score — only shown when resolved */}
          {isResolved && live.aiScore != null && (
            <View style={[
              styles.card,
              live.aiScore >= 50 ? styles.aiCardGreen : styles.aiCardAmber,
            ]}>
              <View style={styles.aiScoreRow}>
                <ShieldCheck size={18} color={live.aiScore >= 50 ? '#15803d' : '#b45309'} />
                <Text style={[styles.aiScoreLabel, live.aiScore >= 50 ? { color: '#15803d' } : { color: '#b45309' }]}>
                  AI Verification Score
                </Text>
                <Text style={[styles.aiScoreNumber, live.aiScore >= 50 ? { color: '#14532d' } : { color: '#92400e' }]}>
                  {live.aiScore}<Text style={styles.aiScoreOutOf}>/100</Text>
                </Text>
              </View>
              {live.aiVerdict ? (
                <Text style={[styles.aiVerdict, live.aiScore >= 50 ? { color: '#16a34a' } : { color: '#d97706' }]}>
                  {live.aiVerdict}
                </Text>
              ) : null}
            </View>
          )}

          {/* Progress Timeline */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>PROGRESS TIMELINE</Text>
            <View style={styles.timeline}>
              <View style={styles.timelineLine} />
              {STEPS.map((step, i) => {
                const done = i <= stepIndex;
                const isCurrent = i === stepIndex;
                const log = live.timeline?.find(t => t.status === step);
                return (
                  <View key={step} style={styles.timelineItem}>
                    <View style={[
                      styles.timelineDot,
                      done
                        ? isCurrent
                          ? { backgroundColor: '#2563eb', borderColor: '#2563eb', shadowColor: '#2563eb', shadowOpacity: 0.4, shadowRadius: 4, elevation: 4 }
                          : { backgroundColor: '#2563eb', borderColor: '#2563eb' }
                        : { backgroundColor: '#fff', borderColor: '#e5e7eb' },
                    ]}>
                      {done
                        ? <CheckCircle2 size={13} color="#fff" />
                        : <View style={styles.timelineEmpty} />
                      }
                    </View>
                    <View style={styles.timelineInfo}>
                      <Text style={[styles.timelineStep, done ? { color: '#111827' } : { color: '#d1d5db' }]}>{step}</Text>
                      {log && <Text style={styles.timelineNote}>{log.note}</Text>}
                      {log && <Text style={styles.timelineTime}>{new Date(log.time).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</Text>}
                      {!log && !done && <Text style={styles.timelinePending}>Pending</Text>}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Upvotes */}
          <View style={styles.card}>
            <View style={styles.upvoteRow}>
              <View>
                <Text style={styles.upvoteTitle}>Support this Issue</Text>
                <Text style={styles.upvoteCount}>
                  {live.upvotes + (upvoted ? 1 : 0)} {(live.upvotes + (upvoted ? 1 : 0)) === 1 ? 'person has' : 'people have'} supported
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleUpvote}
                style={[styles.upvoteBtn, upvoted ? styles.upvoteBtnActive : styles.upvoteBtnInactive]}
              >
                <ThumbsUp size={15} color={upvoted ? '#fff' : '#2563eb'} />
                <Text style={[styles.upvoteBtnText, upvoted ? { color: '#fff' } : { color: '#2563eb' }]}>
                  {upvoted ? 'Supported' : 'Upvote'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Comments */}
          <View style={[styles.card, { marginBottom: 32 }]}>
            <View style={styles.commentsHeader}>
              <MessageCircle size={13} color="#6b7280" />
              <Text style={styles.sectionLabel}> COMMENTS ({live.comments?.length || 0})</Text>
            </View>
            <View style={{ gap: 12, marginBottom: 16 }}>
              {(live.comments || []).map(c => (
                <View key={c.id} style={styles.commentItem}>
                  <View style={styles.commentAvatar}>
                    <Text style={styles.commentAvatarText}>{c.user.charAt(0)}</Text>
                  </View>
                  <View style={styles.commentBubble}>
                    <Text style={styles.commentUser}>{c.user}</Text>
                    <Text style={styles.commentText}>{c.text}</Text>
                    <Text style={styles.commentTime}>{new Date(c.time).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</Text>
                  </View>
                </View>
              ))}
              {(!live.comments || live.comments.length === 0) && (
                <Text style={styles.noComments}>No comments yet. Be the first!</Text>
              )}
            </View>

            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                value={comment}
                onChangeText={setComment}
                placeholder="Add a comment..."
                placeholderTextColor="#9ca3af"
              />
              <TouchableOpacity style={styles.sendBtn} onPress={handleComment}>
                <Send size={15} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f1f5f9' },
  heroContainer: { height: 208, position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  heroBackBtn: { position: 'absolute', top: 52, left: 16, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  heroBackText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  heroCatBadge: { position: 'absolute', top: 52, right: 16, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  heroCatText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  heroBottom: { position: 'absolute', bottom: 16, left: 16, right: 16 },
  heroId: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginBottom: 4 },
  heroTitle: { color: '#fff', fontWeight: '700', fontSize: 15, lineHeight: 20 },
  noPhotoHeader: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6', paddingTop: 52, paddingBottom: 16, paddingHorizontal: 20 },
  backBtnRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  backBtnText: { color: '#6b7280', fontSize: 13, fontWeight: '500' },
  noPhotoTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  noPhotoIcon: { width: 48, height: 48, backgroundColor: '#f3f4f6', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  noPhotoId: { fontSize: 11, color: '#9ca3af' },
  noPhotoTitle: { fontSize: 13, fontWeight: '700', color: '#111827' },
  content: { padding: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 10, fontWeight: '600' },
  priorityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  priorityText: { fontSize: 11, fontWeight: '600' },
  catBadge: { backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  catBadgeText: { color: '#1d4ed8', fontSize: 11, fontWeight: '600' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 6 },
  cardDesc: { fontSize: 13, color: '#6b7280', lineHeight: 20 },
  metaRows: { marginTop: 12, gap: 4 },
  metaText: { fontSize: 11, color: '#9ca3af' },
  assignedBox: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 14 },
  assignedBoxGreen: { backgroundColor: '#f0fdf4' },
  assignedBoxBlue: { backgroundColor: '#eff6ff' },
  assignedAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  assignedName: { fontSize: 11, fontWeight: '600' },
  resolvedAt: { fontSize: 10, color: '#4ade80', marginTop: 2 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: '#6b7280', letterSpacing: 0.5, marginBottom: 12 },
  photosRow: { flexDirection: 'row' },
  photoLabel: { fontSize: 11, fontWeight: '500', color: '#9ca3af', marginBottom: 6 },
  photoBox: { borderRadius: 12, overflow: 'hidden', position: 'relative' },
  evidencePhoto: { width: '100%', height: 112 },
  evidenceCaption: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.4)', paddingVertical: 4, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  evidenceCaptionText: { color: '#fff', fontSize: 10, fontWeight: '500' },
  pendingPhoto: { width: '100%', height: 112, backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', borderColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center', gap: 4 },
  pendingPhotoText: { fontSize: 11, color: '#d1d5db', textAlign: 'center' },
  timeline: { position: 'relative', paddingLeft: 20 },
  timelineLine: { position: 'absolute', left: 13, top: 12, bottom: 12, width: 2, backgroundColor: '#f3f4f6' },
  timelineItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginBottom: 16 },
  timelineDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center', zIndex: 1, marginLeft: -20 },
  timelineEmpty: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e5e7eb' },
  timelineInfo: { flex: 1, paddingTop: 4 },
  timelineStep: { fontSize: 13, fontWeight: '600' },
  timelineNote: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  timelineTime: { fontSize: 11, color: '#9ca3af' },
  timelinePending: { fontSize: 11, color: '#d1d5db' },
  upvoteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  upvoteTitle: { fontSize: 13, fontWeight: '600', color: '#1f2937' },
  upvoteCount: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  upvoteBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14 },
  upvoteBtnActive: { backgroundColor: '#2563eb' },
  upvoteBtnInactive: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe' },
  upvoteBtnText: { fontSize: 13, fontWeight: '600' },
  commentsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  commentItem: { flexDirection: 'row', gap: 12 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#6366f1' },
  commentAvatarText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  commentBubble: { flex: 1, backgroundColor: '#f9fafb', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  commentUser: { fontSize: 11, fontWeight: '600', color: '#374151' },
  commentText: { fontSize: 13, color: '#4b5563', marginTop: 2 },
  commentTime: { fontSize: 10, color: '#9ca3af', marginTop: 4 },
  noComments: { fontSize: 11, color: '#9ca3af', textAlign: 'center', paddingVertical: 16 },
  commentInputRow: { flexDirection: 'row', gap: 8 },
  commentInput: { flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: '#111827', backgroundColor: '#f9fafb' },
  sendBtn: { width: 42, height: 42, backgroundColor: '#2563eb', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  aiCardGreen: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0' },
  aiCardAmber: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fcd34d' },
  aiScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  aiScoreLabel: { fontSize: 12, fontWeight: '700', flex: 1 },
  aiScoreNumber: { fontSize: 22, fontWeight: '800' },
  aiScoreOutOf: { fontSize: 12, fontWeight: '500' },
  aiVerdict: { fontSize: 12, lineHeight: 18, marginTop: 8 },
});

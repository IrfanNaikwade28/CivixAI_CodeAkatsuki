import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';
import {
  ArrowLeft, Megaphone, Shield, AlertCircle, Radio,
  Clock, ThumbsUp,
} from 'lucide-react-native';
import { categoryIcons } from '../data/mockData';
import { issuesAPI } from '../services/api';
import FeedIssueCard from '../components/shared/FeedIssueCard';

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

const adminNotices = [
  {
    id: 'N-001', type: 'Maintenance',
    title: 'Scheduled Water Supply Interruption',
    body: 'Water supply in Ward 5, 7 and 12 will be interrupted on Feb 23rd from 9 AM to 2 PM.',
    ward: 'Ward 5, 7, 12', postedAt: '2026-02-21T08:00:00', upvotes: 12,
  },
  {
    id: 'N-002', type: 'Alert',
    title: 'Open Manhole on Karve Road — Avoid Area',
    body: 'Dangerous open manhole on Karve Road (Ward 6). Citizens advised to avoid this stretch.',
    ward: 'Ward 6', postedAt: '2026-02-21T07:30:00', upvotes: 56,
  },
  {
    id: 'N-003', type: 'Announcement',
    title: 'CivixAI App Now Available',
    body: 'Citizens of Ichalkaranji can now report civic issues via the CivixAI mobile app on Play Store & App Store.',
    ward: 'All Wards', postedAt: '2026-02-20T10:00:00', upvotes: 34,
  },
];

const noticeCfg = {
  Announcement: { bg: '#eff6ff', borderColor: '#dbeafe', badgeBg: '#dbeafe', badgeText: '#1d4ed8', Icon: Megaphone, iconColor: '#2563eb' },
  Alert:        { bg: '#fff1f2', borderColor: '#fecdd3', badgeBg: '#fecdd3', badgeText: '#b91c1c', Icon: AlertCircle, iconColor: '#ef4444' },
  Maintenance:  { bg: '#fffbeb', borderColor: '#fde68a', badgeBg: '#fde68a', badgeText: '#92400e', Icon: Shield,      iconColor: '#d97706' },
  Event:        { bg: '#f0fdf4', borderColor: '#bbf7d0', badgeBg: '#bbf7d0', badgeText: '#15803d', Icon: Radio,       iconColor: '#16a34a' },
};

const categories = ['All', 'Road', 'Water', 'Electricity', 'Garbage', 'Traffic', 'Public Facilities'];

function NoticeCard({ notice }) {
  const cfg = noticeCfg[notice.type] || noticeCfg.Announcement;
  const { Icon } = cfg;
  return (
    <View style={[styles.noticeCard, { backgroundColor: cfg.bg, borderColor: cfg.borderColor }]}>
      <View style={styles.noticeRow}>
        <View style={styles.noticeIconBox}>
          <Icon size={16} color={cfg.iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.noticeBadgeRow}>
            <View style={[styles.noticeBadge, { backgroundColor: cfg.badgeBg }]}>
              <Text style={[styles.noticeBadgeText, { color: cfg.badgeText }]}>{notice.type}</Text>
            </View>
            <Text style={styles.noticeWard}>{notice.ward}</Text>
          </View>
          <Text style={styles.noticeTitle}>{notice.title}</Text>
          <Text style={styles.noticeBody}>{notice.body}</Text>
          <View style={styles.noticeMeta}>
            <Clock size={9} color="#9ca3af" />
            <Text style={styles.noticeMetaText}>
              {new Date(notice.postedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
            </Text>
            <ThumbsUp size={9} color="#9ca3af" />
            <Text style={styles.noticeMetaText}>{notice.upvotes}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function CivicFeed({ onBack, readOnly = false }) {
  const [catFilter, setCatFilter] = useState('All');
  const [tab, setTab] = useState('issues');
  const [feedIssues, setFeedIssues] = useState([]);
  const [feedLoading, setFeedLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setFeedLoading(true);
        const { data } = await issuesAPI.list({ is_public: true });
        // Normalise to UI shape
        const normalised = data.map(issue => ({
          id:              issue.display_id,
          _id:             issue.id,
          title:           issue.title,
          description:     issue.description,
          category:        issue.category,
          status:          issue.status,
          ward:            issue.ward,
          location:        issue.location_text || '',
          upvotes:         issue.upvotes,
          upvotedByMe:     issue.upvoted_by_me,
          image:           issue.image_url,
          completionPhoto: issue.completion_photo_url,
          aiScore:         issue.ai_completion_score,
          aiVerdict:       issue.ai_completion_verdict,
          reporterName:    issue.reported_by_detail?.name || '',
          reporterPhoto:   issue.reported_by_detail?.profile_photo_url || null,
          assignedTo:      issue.assigned_to_detail?.id   || null,
          assignedToName:  issue.assigned_to_detail?.name || null,
          reportedAt:      issue.reported_at,
          resolvedAt:      issue.resolved_at,
          comments:        (issue.comments || []).map(c => ({
            id:   c.id,
            user: c.user_name || 'Unknown',
            text: c.text,
            time: c.created_at,
          })),
          distance:        '< 2 km',
          isPublic:        true,
        }));
        setFeedIssues(normalised);
      } catch (err) {
        console.warn('CivicFeed fetch failed:', err.message);
      } finally {
        setFeedLoading(false);
      }
    })();
  }, []);

  const now = Date.now();
  const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

  const filtered = feedIssues
    .filter(issue => {
      if (issue.status === 'Resolved' && issue.resolvedAt) {
        return now - new Date(issue.resolvedAt).getTime() < TWO_DAYS_MS;
      }
      return true;
    })
    .filter(issue => catFilter === 'All' || issue.category === catFilter);

  const handleUpvote = async (id) => {
    if (readOnly) return;
    const issue = feedIssues.find(i => i.id === id);
    if (!issue) return;
    try {
      const { data } = await issuesAPI.upvote(issue._id);
      setFeedIssues(prev => prev.map(i =>
        i.id === id ? { ...i, upvotes: data.upvotes, upvotedByMe: data.upvoted } : i
      ));
    } catch {
      // silent fail
    }
  };

  const handleComment = (id, newComment) => {
    // Keep feedIssues comment count in sync so the comment button counter stays accurate
    setFeedIssues(prev => prev.map(i =>
      i.id === id ? { ...i, comments: [...(i.comments || []), newComment] } : i
    ));
  };

  return (
    <View style={styles.root}>
      {/* Sticky header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <ArrowLeft size={16} color="#6b7280" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Civic Feed</Text>
              <Text style={styles.subtitle}>
                {readOnly ? 'Community issues in your area' : `${filtered.length} issues near you`}
              </Text>
            </View>
            {/* Tab pills */}
            <View style={styles.tabPills}>
              {[{ key: 'issues', label: 'Issues' }, { key: 'notices', label: 'Notices' }].map(t => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.tabPill, tab === t.key ? styles.tabPillActive : {}]}
                  onPress={() => setTab(t.key)}
                >
                  <Text style={[styles.tabPillText, tab === t.key ? { color: '#111827' } : { color: '#6b7280' }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Category filters */}
        {tab === 'issues' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catFilterRow}>
            {categories.map(f => (
              <TouchableOpacity
                key={f}
                style={[styles.catPill, catFilter === f ? styles.catPillActive : styles.catPillInactive]}
                onPress={() => setCatFilter(f)}
              >
                {f !== 'All' && <Text style={{ fontSize: 12, marginRight: 3 }}>{categoryIcons[f]}</Text>}
                <Text style={[styles.catPillText, catFilter === f ? { color: '#fff' } : { color: '#4b5563' }]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {tab === 'issues' && (
          <>
            {feedLoading && (
              <View style={styles.emptyBox}>
                <ActivityIndicator size="large" color="#2563eb" />
                <Text style={[styles.emptyText, { marginTop: 12 }]}>Loading issues...</Text>
              </View>
            )}
            {!feedLoading && filtered.length === 0 && (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyEmoji}>🔍</Text>
                <Text style={styles.emptyText}>No issues in this category</Text>
              </View>
            )}
            {!feedLoading && filtered.map(issue => (
              <FeedIssueCard
                key={issue.id}
                issue={issue}
                readOnly={readOnly}
                onUpvote={handleUpvote}
                upvoted={!!issue.upvotedByMe}
                onComment={handleComment}
              />
            ))}
          </>
        )}

        {tab === 'notices' && (
          <View style={{ gap: 12 }}>
            {adminNotices.map(n => <NoticeCard key={n.id} notice={n} />)}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f9fafb' },
  header: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  headerTop: { paddingTop: 52, paddingBottom: 8, paddingHorizontal: 16 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  backText: { color: '#6b7280', fontSize: 13 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  tabPills: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderRadius: 12, padding: 4, gap: 4 },
  tabPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  tabPillActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 },
  tabPillText: { fontSize: 11, fontWeight: '700' },
  catFilterRow: { paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4, gap: 8, flexDirection: 'row' },
  catPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  catPillActive: { backgroundColor: '#2563eb' },
  catPillInactive: { backgroundColor: '#f3f4f6' },
  catPillText: { fontSize: 11, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  emptyBox: { alignItems: 'center', paddingVertical: 64 },
  emptyEmoji: { fontSize: 36, marginBottom: 8 },
  emptyText: { fontSize: 13, color: '#9ca3af' },
  noticeCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
  noticeRow: { flexDirection: 'row', gap: 12 },
  noticeIconBox: { width: 36, height: 36, backgroundColor: '#fff', borderRadius: 18, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 },
  noticeBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  noticeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  noticeBadgeText: { fontSize: 10, fontWeight: '700' },
  noticeWard: { fontSize: 10, color: '#6b7280' },
  noticeTitle: { fontSize: 13, fontWeight: '700', color: '#1f2937', marginBottom: 4 },
  noticeBody: { fontSize: 11, color: '#4b5563', lineHeight: 16 },
  noticeMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  noticeMetaText: { fontSize: 10, color: '#9ca3af' },
});

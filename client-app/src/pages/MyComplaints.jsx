import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image,
} from 'react-native';
import { useClient } from '../context/ClientContext';
import { ArrowLeft, ChevronRight, User, CheckCircle, AlertTriangle } from 'lucide-react-native';
import { categoryIcons, statusConfig } from '../data/mockData';

function AiScoreBanner({ aiScore, aiVerdict }) {
  if (aiScore == null) return null;
  const passed = aiScore >= 70;
  return (
    <View style={[styles.aiBanner, passed ? styles.aiBannerGood : styles.aiBannerBad]}>
      <View style={styles.aiBannerLeft}>
        {passed
          ? <CheckCircle size={14} color="#15803d" />
          : <AlertTriangle size={14} color="#b45309" />}
        <View>
          <Text style={[styles.aiBannerTitle, passed ? styles.aiBannerTitleGood : styles.aiBannerTitleBad]}>
            {passed ? 'Work verified complete' : 'Work not completed'}
          </Text>
          {aiVerdict ? (
            <Text style={[styles.aiBannerVerdict, passed ? styles.aiBannerVerdictGood : styles.aiBannerVerdictBad]}>
              {aiVerdict}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={[styles.aiScorePill, passed ? styles.aiScorePillGood : aiScore >= 40 ? styles.aiScorePillWarn : styles.aiScorePillBad]}>
        <Text style={styles.aiScorePillText}>AI {aiScore}%</Text>
      </View>
    </View>
  );
}

const STATUS_ORDER = ['Submitted', 'Assigned', 'In Progress', 'Resolved', 'Closed'];
const filters = ['All', 'In Progress', 'Submitted', 'Assigned', 'Resolved'];

function StatusBadge({ status }) {
  const cfg = statusConfig[status] || statusConfig['Submitted'];
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <View style={[styles.badgeDot, { backgroundColor: cfg.dot }]} />
      <Text style={[styles.badgeText, { color: cfg.text }]}>{status}</Text>
    </View>
  );
}

export default function MyComplaints({ onBack, onDetail }) {
  const { myComplaints } = useClient();
  const [filter, setFilter] = useState('All');

  const filtered = filter === 'All' ? myComplaints : myComplaints.filter(c => c.status === filter);

  return (
    <View style={styles.root}>
      {/* Sticky header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <ArrowLeft size={16} color="#6b7280" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>My Complaints</Text>
          <Text style={styles.subtitle}>{myComplaints.length} complaints filed</Text>
        </View>

        {/* Filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {filters.map(f => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.filterPill, filter === f ? styles.filterPillActive : styles.filterPillInactive]}
            >
              <Text style={[styles.filterText, filter === f ? { color: '#fff' } : { color: '#6b7280' }]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {filtered.map(c => {
          const stepIdx = STATUS_ORDER.indexOf(c.status);
          const progress = ((stepIdx + 1) / STATUS_ORDER.length) * 100;
          const progressColor =
            c.status === 'Resolved' || c.status === 'Closed' ? '#22c55e' :
            c.status === 'In Progress' ? '#3b82f6' :
            c.status === 'Assigned' ? '#eab308' : '#d1d5db';

          return (
            <TouchableOpacity
              key={c.id}
              onPress={() => onDetail(c)}
              style={styles.card}
              activeOpacity={0.95}
            >
              {/* Photo strip */}
              {c.image && (
                <View style={styles.photoStrip}>
                  <Image source={{ uri: c.image }} style={styles.photo} resizeMode="cover" />
                  <View style={styles.photoOverlay} />
                  <View style={styles.photoBadges}>
                    <StatusBadge status={c.status} />
                    <View style={styles.dateBadge}>
                      <Text style={styles.dateBadgeText}>
                        {new Date(c.reportedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

                <View style={styles.cardBody}>
                <View style={styles.cardRow}>
                  {!c.image && (
                    <View style={styles.iconBox}>
                      <Text style={{ fontSize: 22 }}>{categoryIcons[c.category]}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle} numberOfLines={2}>{c.title}</Text>
                    <View style={styles.idRow}>
                      <Text style={styles.cardId}>{c.id}</Text>
                      {!c.image && (
                        <Text style={styles.cardDate}>
                          {new Date(c.reportedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </Text>
                      )}
                    </View>
                    <View style={styles.metaRow}>
                      <Text style={styles.wardText}>{c.ward}</Text>
                      {!c.image && <StatusBadge status={c.status} />}
                    </View>
                  </View>
                  <ChevronRight size={16} color="#d1d5db" />
                </View>

                {/* Worker assigned */}
                {c.assignedToName && (
                  <View style={styles.assignedRow}>
                    <View style={styles.assignedAvatar}>
                      <User size={11} color="#fff" />
                    </View>
                    <Text style={styles.assignedText}>
                      {c.status === 'Resolved' || c.status === 'Closed'
                        ? `Resolved by ${c.assignedToName}`
                        : `Assigned to ${c.assignedToName}`}
                    </Text>
                  </View>
                )}

                {/* AI score banner — only when worker has uploaded a completion photo */}
                {c.completionPhoto && (
                  <AiScoreBanner aiScore={c.aiScore} aiVerdict={c.aiVerdict} />
                )}

                {/* Progress bar */}
                <View style={styles.progressSection}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressLabel}>Progress</Text>
                    <Text style={styles.progressCount}>{stepIdx + 1}/{STATUS_ORDER.length}</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: progressColor }]} />
                  </View>
                  <View style={styles.stepLabels}>
                    {STATUS_ORDER.map((s, i) => (
                      <Text
                        key={s}
                        style={[styles.stepLabelText, i <= stepIdx ? { color: '#4b5563' } : { color: '#d1d5db' }]}
                      >
                        {s === 'In Progress' ? 'Active' : s === 'Submitted' ? 'New' : s}
                      </Text>
                    ))}
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {filtered.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyText}>No complaints found.</Text>
            {filter !== 'All' && (
              <TouchableOpacity onPress={() => setFilter('All')}>
                <Text style={styles.clearFilter}>Clear filter</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f1f5f9' },
  headerContainer: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  headerTop: { paddingTop: 52, paddingBottom: 12, paddingHorizontal: 20 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  backText: { color: '#6b7280', fontSize: 13, fontWeight: '500' },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  subtitle: { color: '#9ca3af', fontSize: 11, marginTop: 2 },
  filterRow: { paddingHorizontal: 20, paddingBottom: 12, gap: 8, flexDirection: 'row' },
  filterPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, flexShrink: 0 },
  filterPillActive: { backgroundColor: '#2563eb' },
  filterPillInactive: { backgroundColor: '#f3f4f6' },
  filterText: { fontSize: 11, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#f3f4f6', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  photoStrip: { height: 96, position: 'relative' },
  photo: { width: '100%', height: '100%' },
  photoOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  photoBadges: { position: 'absolute', bottom: 8, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateBadge: { backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  dateBadgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  cardBody: { padding: 16 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  iconBox: { width: 44, height: 44, backgroundColor: '#f3f4f6', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  idRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  cardId: { fontSize: 10, color: '#9ca3af', fontWeight: '500' },
  cardDate: { fontSize: 10, color: '#9ca3af' },
  cardTitle: { fontSize: 13, fontWeight: '600', color: '#1f2937' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  wardText: { fontSize: 11, color: '#9ca3af' },
  assignedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#eff6ff', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12 },
  assignedAvatar: { width: 20, height: 20, backgroundColor: '#2563eb', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  assignedText: { fontSize: 11, fontWeight: '500', color: '#1d4ed8', flex: 1 },
  progressSection: {},
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  progressLabel: { fontSize: 11, color: '#9ca3af' },
  progressCount: { fontSize: 11, color: '#9ca3af', fontWeight: '500' },
  progressTrack: { height: 6, backgroundColor: '#f3f4f6', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  stepLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  stepLabelText: { fontSize: 9, fontWeight: '500' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 10, fontWeight: '600' },
  emptyBox: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#f3f4f6', paddingVertical: 64, alignItems: 'center', gap: 8 },
  emptyEmoji: { fontSize: 36, marginBottom: 4 },
  emptyText: { fontSize: 13, fontWeight: '500', color: '#6b7280' },
  clearFilter: { fontSize: 11, color: '#2563eb', fontWeight: '600' },
  // AI score banner
  aiBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12, borderWidth: 1 },
  aiBannerGood: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  aiBannerBad: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  aiBannerLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, flex: 1 },
  aiBannerTitle: { fontSize: 11, fontWeight: '700' },
  aiBannerTitleGood: { color: '#15803d' },
  aiBannerTitleBad: { color: '#92400e' },
  aiBannerVerdict: { fontSize: 10, marginTop: 2 },
  aiBannerVerdictGood: { color: '#16a34a' },
  aiBannerVerdictBad: { color: '#b45309' },
  aiScorePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, marginLeft: 8 },
  aiScorePillGood: { backgroundColor: '#16a34a' },
  aiScorePillWarn: { backgroundColor: '#d97706' },
  aiScorePillBad: { backgroundColor: '#dc2626' },
  aiScorePillText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});

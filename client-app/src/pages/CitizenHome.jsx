import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image,
  Modal, TouchableWithoutFeedback,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus, MapPin, Bell, ChevronRight, TrendingUp, AlertCircle, LogOut, User } from 'lucide-react-native';
import { useClient } from '../context/ClientContext';
import { categoryIcons, statusConfig } from '../data/mockData';
import { issuesAPI } from '../services/api';

const STATUS_ORDER = ['Submitted', 'Assigned', 'In Progress', 'Resolved', 'Closed'];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning,';
  if (hour < 17) return 'Good afternoon,';
  return 'Good evening,';
}

const CAT_COLORS = {
  Road:               { bg: '#ffedd5', text: '#c2410c' },
  Water:              { bg: '#dbeafe', text: '#1d4ed8' },
  Electricity:        { bg: '#fef9c3', text: '#a16207' },
  Garbage:            { bg: '#dcfce7', text: '#15803d' },
  Traffic:            { bg: '#fee2e2', text: '#b91c1c' },
  'Public Facilities':{ bg: '#f3e8ff', text: '#7e22ce' },
};

function StatusBadge({ status }) {
  const cfg = statusConfig[status] || statusConfig['Submitted'];
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <View style={[styles.badgeDot, { backgroundColor: cfg.dot }]} />
      <Text style={[styles.badgeText, { color: cfg.text }]}>{status}</Text>
    </View>
  );
}

export default function CitizenHome({ onReport, onMyComplaints, onFeed, onComplaintDetail, onProfile, onLogout }) {
  const { user, myComplaints } = useClient();
  const open = myComplaints.filter(c => !['Resolved', 'Closed'].includes(c.status)).length;
  const resolved = myComplaints.filter(c => ['Resolved', 'Closed'].includes(c.status)).length;
  const categories = ['Road', 'Water', 'Electricity', 'Garbage', 'Traffic', 'Public Facilities'];

  const [nearbyIssues, setNearbyIssues] = useState([]);
  const [avatarMenuVisible, setAvatarMenuVisible] = useState(false);
  const avatarRef = useRef(null);
  const [avatarPos, setAvatarPos] = useState({ top: 0, right: 0 });

  useEffect(() => {
    issuesAPI.list({ is_public: true, page_size: 3 })
      .then(({ data }) => {
        const results = Array.isArray(data) ? data : (data.results || []);
        setNearbyIssues(results.slice(0, 2));
      })
      .catch(() => {});
  }, []);

  const handleAvatarPress = () => {
    if (avatarRef.current) {
      avatarRef.current.measure((x, y, width, height, pageX, pageY) => {
        setAvatarPos({ top: pageY + height + 6, right: 16 });
        setAvatarMenuVisible(true);
      });
    } else {
      setAvatarMenuVisible(true);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <LinearGradient colors={['#1d4ed8', '#2563eb', '#3b82f6']} style={styles.header}>
        {/* Decorative circles */}
        <View style={styles.decCircle1} />
        <View style={styles.decCircle2} />

        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greetingLabel}>{getGreeting()}</Text>
            <Text style={styles.greetingName}>{user?.name}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconBtn}>
              <Bell size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              ref={avatarRef}
              style={styles.avatarCircle}
              onPress={handleAvatarPress}
              activeOpacity={0.8}
            >
              {user?.profilePhoto ? (
                <Image source={{ uri: user.profilePhoto }} style={styles.avatarPhoto} />
              ) : (
                <Text style={styles.avatarText}>{user?.name?.charAt(0)?.toUpperCase()}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.wardRow}>
          <MapPin size={12} color="#93c5fd" />
          <Text style={styles.wardText}>{user?.ward} · Ichalkaranji Municipal Corporation</Text>
        </View>
      </LinearGradient>

      {/* Avatar dropdown menu */}
      <Modal
        visible={avatarMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAvatarMenuVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setAvatarMenuVisible(false)}>
          <View style={StyleSheet.absoluteFill}>
            <View style={[styles.avatarMenu, { top: avatarPos.top, right: avatarPos.right }]}>
              <TouchableOpacity
                style={styles.avatarMenuItem}
                onPress={() => { setAvatarMenuVisible(false); onProfile && onProfile(); }}
              >
                <User size={15} color="#374151" />
                <Text style={styles.avatarMenuItemText}>Profile</Text>
              </TouchableOpacity>
              <View style={styles.avatarMenuDivider} />
              <TouchableOpacity
                style={styles.avatarMenuItem}
                onPress={() => { setAvatarMenuVisible(false); onLogout && onLogout(); }}
              >
                <LogOut size={15} color="#ef4444" />
                <Text style={[styles.avatarMenuItemText, { color: '#ef4444' }]}>Log Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Stats card */}
      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{myComplaints.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={[styles.statItem, styles.statBorderX]}>
          <Text style={[styles.statNum, { color: '#f97316' }]}>{open}</Text>
          <Text style={styles.statLabel}>Open</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNum, { color: '#22c55e' }]}>{resolved}</Text>
          <Text style={styles.statLabel}>Resolved</Text>
        </View>
      </View>

      {/* Report CTA */}
      <View style={styles.section}>
        <TouchableOpacity onPress={onReport} style={styles.reportBtn}>
          <LinearGradient colors={['#2563eb', '#3b82f6']} style={styles.reportGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <View style={styles.reportIconBox}>
              <Plus size={20} color="#fff" />
            </View>
            <Text style={styles.reportBtnText}>Report an Issue</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Categories */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Report by Category</Text>
        <View style={styles.categoryGrid}>
          {categories.map(cat => {
            const col = CAT_COLORS[cat] || { bg: '#f3f4f6', text: '#374151' };
            return (
              <TouchableOpacity
                key={cat}
                onPress={onReport}
                style={[styles.categoryItem, { backgroundColor: col.bg }]}
              >
                <Text style={styles.categoryEmoji}>{categoryIcons[cat]}</Text>
                <Text style={[styles.categoryLabel, { color: col.text }]}>{cat}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Recent complaints */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Recent Issues</Text>
          <TouchableOpacity onPress={onMyComplaints} style={styles.viewAll}>
            <Text style={styles.viewAllText}>View all</Text>
            <ChevronRight size={13} color="#2563eb" />
          </TouchableOpacity>
        </View>
        <View style={{ gap: 10 }}>
          {myComplaints.slice(0, 3).map(c => {
            const stepIdx = STATUS_ORDER.indexOf(c.status);
            const progress = ((stepIdx + 1) / STATUS_ORDER.length) * 100;
            const progressColor =
              c.status === 'Resolved' || c.status === 'Closed' ? '#22c55e' :
              c.status === 'In Progress' ? '#3b82f6' :
              c.status === 'Assigned' ? '#eab308' : '#d1d5db';
            return (
              <TouchableOpacity
                key={c.id}
                onPress={() => onComplaintDetail(c)}
                style={styles.complaintCard}
              >
                {c.image && (
                  <View style={styles.photoStrip}>
                    <Image source={{ uri: c.image }} style={styles.photoStripImage} resizeMode="cover" />
                    <View style={styles.photoStripOverlay} />
                    <View style={styles.photoStripBadges}>
                      <StatusBadge status={c.status} />
                      <View style={[
                        styles.priorityBadge,
                        c.priority === 'High' ? { backgroundColor: '#fee2e2' } :
                        c.priority === 'Medium' ? { backgroundColor: '#ffedd5' } : { backgroundColor: '#dcfce7' },
                      ]}>
                        <Text style={{
                          fontSize: 10, fontWeight: '600',
                          color: c.priority === 'High' ? '#b91c1c' : c.priority === 'Medium' ? '#c2410c' : '#15803d',
                        }}>{c.priority}</Text>
                      </View>
                    </View>
                  </View>
                )}
                <View style={styles.complaintBody}>
                  <View style={styles.complaintRow}>
                    <View style={styles.complaintMeta}>
                      {!c.image && <Text style={{ fontSize: 18 }}>{categoryIcons[c.category]}</Text>}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.complaintId}>{c.id}</Text>
                        <Text style={styles.complaintTitle} numberOfLines={1}>{c.title}</Text>
                      </View>
                    </View>
                    {!c.image && <StatusBadge status={c.status} />}
                    <ChevronRight size={15} color="#d1d5db" />
                  </View>
                  {/* Progress bar */}
                  <View style={styles.progressBarTrack}>
                    <View style={[styles.progressBarFill, { width: `${progress}%`, backgroundColor: progressColor }]} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
          {myComplaints.length === 0 && (
            <View style={styles.emptyBox}>
              <AlertCircle size={32} color="#d1d5db" />
              <Text style={styles.emptyText}>No complaints filed yet.</Text>
              <TouchableOpacity onPress={onReport}>
                <Text style={styles.emptyLink}>Report your first issue →</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Nearby issues */}
      <View style={[styles.section, { paddingBottom: 24 }]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Nearby Issues</Text>
          <TouchableOpacity onPress={onFeed} style={styles.viewAll}>
            <Text style={styles.viewAllText}>View feed</Text>
            <ChevronRight size={13} color="#2563eb" />
          </TouchableOpacity>
        </View>
        <View style={{ gap: 10 }}>
          {nearbyIssues.map(issue => {
            const id = issue.display_id || issue.id;
            const title = issue.title;
            const status = issue.status;
            const category = issue.category;
            const upvotes = issue.upvotes ?? 0;
            const imageUri = issue.image_url || issue.image || null;
            return (
              <View key={id} style={styles.nearbyCard}>
                {imageUri && (
                  <View style={styles.nearbyPhotoContainer}>
                    <Image source={{ uri: imageUri }} style={styles.nearbyPhoto} resizeMode="cover" />
                    <View style={styles.nearbyPhotoOverlay} />
                    <View style={styles.nearbyPhotoBottom}>
                      <StatusBadge status={status} />
                      <View style={styles.upvoteChip}>
                        <TrendingUp size={10} color="#fff" />
                        <Text style={styles.upvoteChipText}>{upvotes}</Text>
                      </View>
                    </View>
                  </View>
                )}
                <View style={styles.nearbyBody}>
                  {!imageUri && <Text style={{ fontSize: 20 }}>{categoryIcons[category]}</Text>}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nearbyTitle} numberOfLines={1}>{title}</Text>
                    <View style={styles.nearbyMeta}>
                      {!imageUri && <StatusBadge status={status} />}
                      {!imageUri && (
                        <View style={styles.upvoteInline}>
                          <TrendingUp size={10} color="#9ca3af" />
                          <Text style={styles.nearbyUpvoteText}>{upvotes}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
          {nearbyIssues.length === 0 && (
            <View style={styles.emptyBox}>
              <AlertCircle size={24} color="#d1d5db" />
              <Text style={styles.emptyText}>No public issues yet.</Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f1f5f9' },
  scrollContent: { paddingBottom: 24 },
  header: { paddingTop: 52, paddingBottom: 80, paddingHorizontal: 20, position: 'relative', overflow: 'hidden' },
  decCircle1: { position: 'absolute', top: -32, right: -32, width: 128, height: 128, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 64 },
  decCircle2: { position: 'absolute', top: 16, right: -8, width: 64, height: 64, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 32 },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 },
  greetingLabel: { color: '#bfdbfe', fontSize: 13, fontWeight: '500' },
  greetingName: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 40, height: 40, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarCircle: { width: 40, height: 40, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', overflow: 'hidden' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  avatarPhoto: { width: 40, height: 40, borderRadius: 20 },
  wardRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  wardText: { color: '#bfdbfe', fontSize: 11 },
  statsCard: { marginHorizontal: 16, marginTop: -48, backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 8, zIndex: 10 },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  statBorderX: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#f3f4f6' },
  statNum: { fontSize: 24, fontWeight: '700', color: '#111827' },
  statLabel: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 12 },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 12 },
  viewAllText: { fontSize: 11, color: '#2563eb', fontWeight: '600' },
  reportBtn: { borderRadius: 16, overflow: 'hidden' },
  reportGradient: { paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  reportIconBox: { width: 32, height: 32, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  reportBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryItem: { width: '30%', borderRadius: 16, padding: 14, alignItems: 'center' },
  categoryEmoji: { fontSize: 24, marginBottom: 6 },
  categoryLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  complaintCard: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#f3f4f6', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  photoStrip: { height: 80, position: 'relative' },
  photoStripImage: { width: '100%', height: '100%' },
  photoStripOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
  photoStripBadges: { position: 'absolute', bottom: 6, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  complaintBody: { padding: 14 },
  complaintRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  complaintMeta: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  complaintId: { fontSize: 10, color: '#9ca3af' },
  complaintTitle: { fontSize: 13, fontWeight: '600', color: '#1f2937' },
  progressBarTrack: { height: 4, backgroundColor: '#f3f4f6', borderRadius: 2, overflow: 'hidden' },
  progressBarFill: { height: 4, borderRadius: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 10, fontWeight: '600' },
  emptyBox: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#f3f4f6', paddingVertical: 40, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 13, color: '#9ca3af' },
  emptyLink: { fontSize: 12, color: '#2563eb', fontWeight: '600' },
  nearbyCard: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#f3f4f6', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  nearbyPhotoContainer: { height: 96, position: 'relative' },
  nearbyPhoto: { width: '100%', height: '100%' },
  nearbyPhotoOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  nearbyPhotoBottom: { position: 'absolute', bottom: 8, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  upvoteChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  upvoteChipText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  nearbyBody: { paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  nearbyTitle: { fontSize: 13, fontWeight: '600', color: '#1f2937' },
  nearbyMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  nearbyDistance: { fontSize: 11, color: '#9ca3af' },
  upvoteInline: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 'auto' },
  nearbyUpvoteText: { fontSize: 11, color: '#9ca3af' },
  avatarMenu: { position: 'absolute', backgroundColor: '#fff', borderRadius: 14, paddingVertical: 6, minWidth: 160, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 16, borderWidth: 1, borderColor: '#f3f4f6' },
  avatarMenuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  avatarMenuItemText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  avatarMenuDivider: { height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 12 },
});

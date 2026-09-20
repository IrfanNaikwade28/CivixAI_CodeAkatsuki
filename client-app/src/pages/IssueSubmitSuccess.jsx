import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';

export default function IssueSubmitSuccess({ issueId, onHome, onTrack }) {
  return (
    <View style={styles.root}>
      <View style={styles.iconBox}>
        <CheckCircle2 size={48} color="#22c55e" />
      </View>

      <Text style={styles.heading}>Issue Reported!</Text>
      <Text style={styles.subtext}>
        Your issue has been successfully submitted to the municipal office.
      </Text>

      <View style={styles.idCard}>
        <Text style={styles.idLabel}>Issue ID</Text>
        <Text style={styles.idValue}>{issueId}</Text>
        <Text style={styles.idNote}>Save this ID to track your issue</Text>
      </View>

      <View style={styles.buttonGroup}>
        <TouchableOpacity style={styles.primaryBtn} onPress={onTrack}>
          <Text style={styles.primaryBtnText}>Track My Issue</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onHome}>
          <Text style={styles.secondaryBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>
        You will be notified when the issue status is updated.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  iconBox: {
    width: 96,
    height: 96,
    backgroundColor: '#dcfce7',
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtext: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },
  idCard: {
    marginTop: 24,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
  },
  idLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 4,
  },
  idValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  idNote: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 8,
  },
  buttonGroup: {
    marginTop: 24,
    gap: 12,
    width: '100%',
  },
  primaryBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 15,
  },
  footer: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 24,
    textAlign: 'center',
  },
});

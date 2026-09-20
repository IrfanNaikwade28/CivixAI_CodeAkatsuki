import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Image, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useClient } from '../context/ClientContext';
import { ArrowLeft, MapPin, Camera, ChevronDown, Eye, Lock, CheckCircle, Cpu } from 'lucide-react-native';
import GeoCamera from '../components/shared/GeoCamera';
import { aiAPI } from '../services/api';

const categories = ['Road', 'Water', 'Electricity', 'Garbage', 'Traffic', 'Public Facilities'];
const categoryIcons = {
  Road: '🛣️', Water: '💧', Electricity: '⚡',
  Garbage: '🗑️', Traffic: '🚦', 'Public Facilities': '🏛️',
};
const WARDS = ['Ward 2','Ward 3','Ward 4','Ward 5','Ward 6','Ward 7','Ward 9','Ward 11','Ward 12','Ward 14'];
const steps = ['Photo', 'Details', 'Submit'];

export default function ReportIssue({ onBack, onSuccess }) {
  const { submitComplaint, user } = useClient();
  const [step, setStep] = useState(1);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [capturedLocation, setCapturedLocation] = useState(null);
  const [form, setForm] = useState({
    category: '',
    title: '',
    description: '',
    location: (user?.ward || '') + ', Ichalkaranji',
    ward: user?.ward || 'Ward 5',
    isPublic: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [wardOpen, setWardOpen] = useState(false);
  // AI detect state: idle | scanning | done | error
  const [aiState, setAiState] = useState('idle');
  const [aiResult, setAiResult] = useState(null);

  const handleCameraCapture = async ({ photo, location }) => {
    setCapturedPhoto(photo);
    setCapturedLocation(location);
    setShowCamera(false);
    if (location?.label) {
      setForm(p => ({ ...p, location: location.label }));
    }
    // Run AI detect-issue
    setAiState('scanning');
    setAiResult(null);
    try {
      const formData = new FormData();
      const filename = photo.split('/').pop();
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      formData.append('image', { uri: photo, name: filename, type });
      console.log('[AI] Sending image:', filename, type);
      const { data } = await aiAPI.detectIssue(formData);
      console.log('[AI] Response:', JSON.stringify(data));
      setAiResult(data);
      if (!data.ai_available) {
        // Backend AI failed — show error so user fills in manually
        setAiState('error');
        return;
      }
      // Always overwrite category, title and description with AI result
      setForm(p => ({
        ...p,
        category:    data.category    || p.category,
        title:       data.title       || p.title,
        description: data.description || p.description,
      }));
      setAiState('done');
    } catch (err) {
      console.error('[AI] detectIssue error:', err?.message, err?.response?.status, JSON.stringify(err?.response?.data));
      setAiState('error');
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const id = await submitComplaint({
        ...form,
        image: capturedPhoto,
        lat: capturedLocation?.lat,
        lng: capturedLocation?.lng,
      });
      onSuccess(id);
    } catch {
      // submitComplaint throws on error; silently stop spinner
    } finally {
      setSubmitting(false);
    }
  };

  const isStep2Valid = form.category && form.title.trim() && form.description.trim();

  return (
    <>
      <GeoCamera
        visible={showCamera}
        label="Take Issue Photo"
        onCapture={handleCameraCapture}
        onClose={() => setShowCamera(false)}
      />

      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={step === 1 ? onBack : () => setStep(s => s - 1)}
            style={styles.backBtn}
          >
            <ArrowLeft size={16} color="#93c5fd" />
            <Text style={styles.backText}>{step === 1 ? 'Back' : 'Previous'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Report an Issue</Text>
          <Text style={styles.headerSub}>Help improve your city</Text>

          {/* Step indicators */}
          <View style={styles.stepRow}>
            {steps.map((label, i) => {
              const s = i + 1;
              const done = step > s;
              const current = step === s;
              return (
                <View key={s} style={styles.stepItem}>
                  <View style={[
                    styles.stepCircle,
                    (done || current) ? styles.stepCircleActive : styles.stepCircleInactive,
                  ]}>
                    {done
                      ? <CheckCircle size={14} color="#2563eb" />
                      : <Text style={[styles.stepNum, (current) ? { color: '#2563eb' } : { color: '#fff' }]}>{s}</Text>
                    }
                  </View>
                  {s < steps.length && (
                    <View style={[styles.stepLine, done ? styles.stepLineDone : styles.stepLineInactive]} />
                  )}
                </View>
              );
            })}
            <Text style={styles.stepLabel}>{steps[step - 1]}</Text>
          </View>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

          {/* ─── Step 1: Camera ─── */}
          {step === 1 && (
            <>
              <View style={styles.cameraIntro}>
                <Camera size={40} color="#2563eb" />
                <Text style={styles.cameraTitle}>Take a Photo First</Text>
                <Text style={styles.cameraSub}>A photo with location tag is required to report an issue</Text>
              </View>

              {capturedPhoto ? (
                <View style={styles.photoPreviewBox}>
                  <Image source={{ uri: capturedPhoto }} style={styles.photoPreview} resizeMode="cover" />
                  <View style={styles.photoOverlay} />
                  <View style={styles.photoOverlayBottom}>
                    <MapPin size={12} color="#4ade80" />
                    <Text style={styles.photoLocationText} numberOfLines={1}>
                      {capturedLocation?.label || 'Location captured'}
                    </Text>
                  </View>
                  <View style={styles.capturedBadge}>
                    <CheckCircle size={11} color="#fff" />
                    <Text style={styles.capturedBadgeText}>Captured</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.emptyPhoto}>
                  <Camera size={28} color="#93c5fd" />
                  <Text style={styles.emptyPhotoText}>No photo yet</Text>
                </View>
              )}

              <TouchableOpacity style={styles.openCameraBtn} onPress={() => setShowCamera(true)}>
                <Camera size={18} color="#fff" />
                <Text style={styles.openCameraText}>{capturedPhoto ? 'Retake Photo' : 'Open Camera'}</Text>
              </TouchableOpacity>

              {capturedPhoto && aiState === 'idle' && (
                <TouchableOpacity style={styles.continueBtn} onPress={() => setStep(2)}>
                  <Text style={styles.continueBtnText}>Continue to Details</Text>
                </TouchableOpacity>
              )}

              {/* AI detect status */}
              {aiState === 'scanning' && (
                <View style={styles.aiBox}>
                  <ActivityIndicator size="small" color="#3b82f6" />
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Cpu size={12} color="#1d4ed8" />
                      <Text style={styles.aiTitle}> AI Analysing Photo…</Text>
                    </View>
                    <Text style={styles.aiSub}>Detecting issue category automatically</Text>
                  </View>
                </View>
              )}
              {aiState === 'done' && aiResult && (
                <View style={styles.aiBoxGreen}>
                  <Cpu size={16} color="#15803d" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.aiTitleGreen}>AI Detected: {aiResult.category || 'Issue'}</Text>
                    <Text style={styles.aiSubGreen}>Category and title pre-filled — tap Continue</Text>
                  </View>
                </View>
              )}
              {aiState === 'error' && (
                <View style={styles.aiBoxRed}>
                  <Cpu size={16} color="#b91c1c" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.aiTitleRed}>AI detection failed</Text>
                    <Text style={styles.aiSubRed}>Please fill category and title manually</Text>
                  </View>
                </View>
              )}

              {capturedPhoto && (aiState === 'done' || aiState === 'error') && (
                <TouchableOpacity style={styles.continueBtn} onPress={() => setStep(2)}>
                  <Text style={styles.continueBtnText}>Continue to Details</Text>
                </TouchableOpacity>
              )}

              <Text style={styles.cameraNote}>
                Your photo and GPS location will be attached to help authorities respond faster.
              </Text>
            </>
          )}

          {/* ─── Step 2: Details ─── */}
          {step === 2 && (
            <>
              {/* Category */}
              <Text style={styles.fieldLabel}>SELECT CATEGORY *</Text>
              <View style={styles.categoryGrid}>
                {categories.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setForm(p => ({ ...p, category: cat }))}
                    style={[
                      styles.categoryItem,
                      form.category === cat ? styles.categoryItemActive : styles.categoryItemInactive,
                    ]}
                  >
                    <Text style={styles.categoryEmoji}>{categoryIcons[cat]}</Text>
                    <Text style={[
                      styles.categoryLabel,
                      form.category === cat ? { color: '#1d4ed8' } : { color: '#374151' },
                    ]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Title */}
              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>ISSUE TITLE *</Text>
              <TextInput
                style={styles.input}
                value={form.title}
                onChangeText={v => setForm(p => ({ ...p, title: v }))}
                placeholder="Brief description of the issue"
                placeholderTextColor="#9ca3af"
                maxLength={80}
              />

              {/* Description */}
              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>DETAILED DESCRIPTION *</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={form.description}
                onChangeText={v => setForm(p => ({ ...p, description: v }))}
                placeholder="Describe the issue — when did it start, impact on public..."
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[styles.nextBtn, !isStep2Valid && styles.nextBtnDisabled]}
                onPress={() => isStep2Valid && setStep(3)}
                disabled={!isStep2Valid}
              >
                <Text style={styles.nextBtnText}>Next: Review &amp; Submit</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ─── Step 3: Visibility + Submit ─── */}
          {step === 3 && (
            <>
              {/* Location */}
              <Text style={styles.fieldLabel}>LOCATION</Text>
              <View style={styles.inputIconRow}>
                <MapPin size={16} color="#9ca3af" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.inputFlex}
                  value={form.location}
                  onChangeText={v => setForm(p => ({ ...p, location: v }))}
                  placeholder="Enter the address or landmark"
                  placeholderTextColor="#9ca3af"
                />
              </View>
              {capturedLocation && (
                <View style={styles.gpsBox}>
                  <MapPin size={14} color="#16a34a" />
                  <Text style={styles.gpsText}>GPS: {capturedLocation.label}</Text>
                </View>
              )}

              {/* Ward */}
              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>WARD</Text>
              <TouchableOpacity style={styles.dropdownBtn} onPress={() => setWardOpen(v => !v)}>
                <Text style={styles.dropdownText}>{form.ward}</Text>
                <ChevronDown size={14} color="#9ca3af" />
              </TouchableOpacity>
              {wardOpen && (
                <View style={styles.dropdownList}>
                  {WARDS.map(w => (
                    <TouchableOpacity
                      key={w}
                      style={styles.dropdownItem}
                      onPress={() => { setForm(p => ({ ...p, ward: w })); setWardOpen(false); }}
                    >
                      <Text style={[styles.dropdownItemText, form.ward === w && { color: '#2563eb', fontWeight: '700' }]}>{w}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Visibility */}
              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>VISIBILITY</Text>
              <View style={styles.visibilityRow}>
                <TouchableOpacity
                  style={[styles.visibilityBtn, form.isPublic ? styles.visibilityBtnActiveBlue : styles.visibilityBtnInactive]}
                  onPress={() => setForm(p => ({ ...p, isPublic: true }))}
                >
                  <Eye size={22} color={form.isPublic ? '#2563eb' : '#9ca3af'} />
                  <Text style={[styles.visibilityTitle, form.isPublic ? { color: '#1d4ed8' } : { color: '#4b5563' }]}>Public</Text>
                  <Text style={styles.visibilitySub}>Visible on Civic Feed & sent to authorities</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.visibilityBtn, !form.isPublic ? styles.visibilityBtnActiveGray : styles.visibilityBtnInactive]}
                  onPress={() => setForm(p => ({ ...p, isPublic: false }))}
                >
                  <Lock size={22} color={!form.isPublic ? '#374151' : '#9ca3af'} />
                  <Text style={[styles.visibilityTitle, !form.isPublic ? { color: '#111827' } : { color: '#4b5563' }]}>Private</Text>
                  <Text style={styles.visibilitySub}>Only sent to authorities, not public</Text>
                </TouchableOpacity>
              </View>

              {/* Summary */}
              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>ISSUE SUMMARY</Text>
                {capturedPhoto && (
                  <Image source={{ uri: capturedPhoto }} style={styles.summaryPhoto} resizeMode="cover" />
                )}
                {[
                  ['Category', `${categoryIcons[form.category] || ''} ${form.category}`],
                  ['Title', form.title],
                  ['Ward', form.ward],
                  ['Visibility', form.isPublic ? '🌐 Public' : '🔒 Private'],
                ].map(([label, val]) => (
                  <View key={label} style={styles.summaryRow}>
                    <Text style={styles.summaryKey}>{label}</Text>
                    <Text style={styles.summaryVal} numberOfLines={1}>{val}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.backActionBtn} onPress={() => setStep(2)}>
                  <Text style={styles.backActionText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                  onPress={handleSubmit}
                  disabled={submitting}
                >
                  {submitting
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.submitBtnText}>Submit Issue</Text>
                  }
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { backgroundColor: '#2563eb', paddingTop: 52, paddingBottom: 24, paddingHorizontal: 20 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  backText: { color: '#93c5fd', fontSize: 13 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerSub: { color: '#93c5fd', fontSize: 13, marginTop: 4 },
  stepRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 8 },
  stepItem: { flexDirection: 'row', alignItems: 'center' },
  stepCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepCircleActive: { backgroundColor: '#fff' },
  stepCircleInactive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  stepNum: { fontSize: 12, fontWeight: '700' },
  stepLine: { width: 32, height: 2, marginHorizontal: 4 },
  stepLineDone: { backgroundColor: '#fff' },
  stepLineInactive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  stepLabel: { color: '#93c5fd', fontSize: 11, marginLeft: 8 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 16, paddingBottom: 40 },
  cameraIntro: { alignItems: 'center', paddingVertical: 16, gap: 8 },
  cameraTitle: { fontSize: 15, fontWeight: '700', color: '#1f2937' },
  cameraSub: { fontSize: 13, color: '#6b7280', textAlign: 'center' },
  photoPreviewBox: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb', height: 200 },
  photoPreview: { width: '100%', height: '100%' },
  photoOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0)' },
  photoOverlayBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  photoLocationText: { color: '#fff', fontSize: 11, flex: 1 },
  capturedBadge: { position: 'absolute', top: 10, right: 10, backgroundColor: '#16a34a', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  capturedBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  emptyPhoto: { borderWidth: 2, borderStyle: 'dashed', borderColor: '#bfdbfe', borderRadius: 16, padding: 32, alignItems: 'center', gap: 8, backgroundColor: '#eff6ff' },
  emptyPhotoText: { color: '#3b82f6', fontSize: 13, fontWeight: '500' },
  openCameraBtn: { backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  openCameraText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  continueBtn: { backgroundColor: '#16a34a', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  continueBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  cameraNote: { color: '#9ca3af', fontSize: 11, textAlign: 'center' },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#4b5563', letterSpacing: 0.5 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  categoryItem: { width: '31%', borderRadius: 14, borderWidth: 2, padding: 12, alignItems: 'center' },
  categoryItemActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  categoryItemInactive: { borderColor: '#e5e7eb', backgroundColor: '#fff' },
  categoryEmoji: { fontSize: 22, marginBottom: 4 },
  categoryLabel: { fontSize: 11, fontWeight: '500', textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, fontSize: 13, color: '#111827', backgroundColor: '#fff', marginTop: 6 },
  textarea: { height: 96, textAlignVertical: 'top' },
  nextBtn: { backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  nextBtnDisabled: { opacity: 0.5 },
  nextBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  inputIconRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#fff', marginTop: 6 },
  inputFlex: { flex: 1, fontSize: 13, color: '#111827' },
  gpsBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginTop: 8 },
  gpsText: { color: '#15803d', fontSize: 11, flex: 1 },
  dropdownBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff', marginTop: 6 },
  dropdownText: { fontSize: 13, color: '#111827' },
  dropdownList: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 14, marginTop: 4, overflow: 'hidden' },
  dropdownItem: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  dropdownItemText: { fontSize: 13, color: '#374151' },
  visibilityRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  visibilityBtn: { flex: 1, borderWidth: 2, borderRadius: 14, padding: 16, alignItems: 'center', gap: 6 },
  visibilityBtnActiveBlue: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  visibilityBtnActiveGray: { borderColor: '#4b5563', backgroundColor: '#f9fafb' },
  visibilityBtnInactive: { borderColor: '#e5e7eb', backgroundColor: '#fff' },
  visibilityTitle: { fontSize: 13, fontWeight: '600' },
  visibilitySub: { fontSize: 10, color: '#9ca3af', textAlign: 'center' },
  summaryBox: { backgroundColor: '#f9fafb', borderRadius: 14, padding: 16, gap: 8 },
  summaryLabel: { fontSize: 10, fontWeight: '700', color: '#6b7280', letterSpacing: 0.5, marginBottom: 4 },
  summaryPhoto: { width: '100%', height: 120, borderRadius: 10, marginBottom: 4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryKey: { fontSize: 12, color: '#6b7280' },
  summaryVal: { fontSize: 12, fontWeight: '600', color: '#1f2937', maxWidth: '60%' },
  actionRow: { flexDirection: 'row', gap: 12 },
  backActionBtn: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  backActionText: { color: '#374151', fontWeight: '600', fontSize: 14 },
  submitBtn: { flex: 1, backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  aiBox: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiTitle: { fontSize: 11, fontWeight: '700', color: '#1d4ed8' },
  aiSub: { fontSize: 11, color: '#3b82f6', marginTop: 2 },
  aiBoxGreen: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiTitleGreen: { fontSize: 11, fontWeight: '700', color: '#15803d' },
  aiSubGreen: { fontSize: 11, color: '#16a34a', marginTop: 2 },
  aiBoxRed: { backgroundColor: '#fff1f2', borderWidth: 1, borderColor: '#fecdd3', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  aiTitleRed: { fontSize: 11, fontWeight: '700', color: '#b91c1c' },
  aiSubRed: { fontSize: 11, color: '#ef4444', marginTop: 2 },
});

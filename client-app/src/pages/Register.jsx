import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { ArrowLeft, User, Mail, Phone, MapPin, Lock, Calendar, Home, ChevronDown } from 'lucide-react-native';
import { useClient } from '../context/ClientContext';

const wards = ['Ward 3','Ward 4','Ward 5','Ward 6','Ward 7','Ward 8','Ward 9','Ward 10','Ward 12','Ward 14'];
const genderOptions = ['Male', 'Female', 'Other'];

export default function Register({ onBack }) {
  const { register } = useClient();
  const [form, setForm] = useState({
    name: '', email: '', phone: '', ward: '',
    gender: '', dob: '', street: '', landmark: '',
    password: '', confirm: '',
  });
  const [success, setSuccess]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [wardOpen, setWardOpen] = useState(false);
  const [error, setError]       = useState('');

  // OTP UI state (non-functional — UI only)
  const [otpSent, setOtpSent]       = useState(false);
  const [otpValues, setOtpValues]   = useState(['', '', '', '', '', '']);
  const otpRefs                     = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

  const update = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const handleOtpChange = (index, val) => {
    if (val.length > 1) return;
    const next = [...otpValues];
    next[index] = val;
    setOtpValues(next);
    if (val && index < 5) otpRefs[index + 1].current?.focus();
    if (!val && index > 0) otpRefs[index - 1].current?.focus();
  };

  const handleSubmit = async () => {
    setError('');
    if (form.password !== form.confirm) { Alert.alert('Error', 'Passwords do not match'); return; }
    if (!form.name || !form.email || !form.phone || !form.ward || !form.password) {
      Alert.alert('Error', 'Please fill all required fields'); return;
    }
    setLoading(true);
    const result = await register(form);
    setLoading(false);
    if (result.success) {
      setSuccess(true);
    } else {
      setError(result.error);
    }
  };

  if (success) {
    return (
      <View style={styles.successRoot}>
        <View style={styles.successIcon}>
          <Text style={styles.checkmark}>✓</Text>
        </View>
        <Text style={styles.successTitle}>Account Created!</Text>
        <Text style={styles.successSub}>Your account has been created successfully. You can now log in.</Text>
        <TouchableOpacity onPress={onBack} style={styles.successBtn}>
          <Text style={styles.successBtnText}>Go to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <ArrowLeft size={16} color="#bfdbfe" />
          <Text style={styles.backText}>Back to Login</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Account</Text>
        <Text style={styles.headerSub}>Join CivixAI as a Citizen</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* ── Section: Personal Info ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>PERSONAL INFORMATION</Text>

          {/* Full Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Full Name <Text style={styles.required}>*</Text></Text>
            <View style={styles.inputRow}>
              <User size={15} color="#9ca3af" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={v => update('name', v)}
                placeholder="Enter your full name"
                placeholderTextColor="#9ca3af"
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Gender */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Gender</Text>
            <View style={styles.pillRow}>
              {genderOptions.map(g => (
                <TouchableOpacity
                  key={g}
                  style={[styles.pill, form.gender === g && styles.pillActive]}
                  onPress={() => update('gender', g)}
                >
                  <Text style={[styles.pillText, form.gender === g && styles.pillTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Date of Birth */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Date of Birth</Text>
            <View style={styles.inputRow}>
              <Calendar size={15} color="#9ca3af" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={form.dob}
                onChangeText={v => update('dob', v)}
                placeholder="DD/MM/YYYY"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
          </View>
        </View>

        {/* ── Section: Contact ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>CONTACT DETAILS</Text>

          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email Address <Text style={styles.required}>*</Text></Text>
            <View style={styles.inputRow}>
              <Mail size={15} color="#9ca3af" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={form.email}
                onChangeText={v => update('email', v)}
                placeholder="example@email.com"
                placeholderTextColor="#9ca3af"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Mobile + OTP */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Mobile Number <Text style={styles.required}>*</Text></Text>
            <View style={styles.phoneOtpRow}>
              <View style={[styles.inputRow, { flex: 1 }]}>
                <Phone size={15} color="#9ca3af" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={form.phone}
                  onChangeText={v => update('phone', v)}
                  placeholder="10-digit mobile number"
                  placeholderTextColor="#9ca3af"
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>
              <TouchableOpacity
                style={[styles.sendOtpBtn, otpSent && styles.sendOtpBtnSent]}
                onPress={() => setOtpSent(true)}
              >
                <Text style={styles.sendOtpText}>{otpSent ? 'Resend' : 'Send OTP'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* OTP input boxes */}
          {otpSent && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Enter OTP <Text style={styles.otpHint}>(sent to {form.phone})</Text></Text>
              <View style={styles.otpRow}>
                {otpValues.map((val, i) => (
                  <TextInput
                    key={i}
                    ref={otpRefs[i]}
                    style={[styles.otpBox, val && styles.otpBoxFilled]}
                    value={val}
                    onChangeText={v => handleOtpChange(i, v)}
                    keyboardType="numeric"
                    maxLength={1}
                    textAlign="center"
                  />
                ))}
              </View>
            </View>
          )}
        </View>

        {/* ── Section: Address ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>ADDRESS</Text>

          {/* Ward */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Ward <Text style={styles.required}>*</Text></Text>
            <TouchableOpacity style={styles.inputRow} onPress={() => setWardOpen(v => !v)}>
              <MapPin size={15} color="#9ca3af" style={styles.inputIcon} />
              <Text style={[styles.input, { color: form.ward ? '#111827' : '#9ca3af', paddingVertical: 0, flex: 1 }]}>
                {form.ward || 'Select your ward'}
              </Text>
              <ChevronDown size={15} color="#9ca3af" />
            </TouchableOpacity>
            {wardOpen && (
              <View style={styles.wardDropdown}>
                {wards.map(w => (
                  <TouchableOpacity
                    key={w}
                    onPress={() => { update('ward', w); setWardOpen(false); }}
                    style={styles.wardOption}
                  >
                    <Text style={[styles.wardOptionText, form.ward === w && styles.wardOptionSelected]}>
                      {w}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Street */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Street Address</Text>
            <View style={styles.inputRow}>
              <Home size={15} color="#9ca3af" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={form.street}
                onChangeText={v => update('street', v)}
                placeholder="House no., street name"
                placeholderTextColor="#9ca3af"
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Landmark */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Landmark <Text style={styles.optional}>(optional)</Text></Text>
            <View style={styles.inputRow}>
              <MapPin size={15} color="#9ca3af" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={form.landmark}
                onChangeText={v => update('landmark', v)}
                placeholder="Near temple, school, etc."
                placeholderTextColor="#9ca3af"
                autoCapitalize="words"
              />
            </View>
          </View>
        </View>

        {/* ── Section: Security ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>SECURITY</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password <Text style={styles.required}>*</Text></Text>
            <View style={styles.inputRow}>
              <Lock size={15} color="#9ca3af" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={form.password}
                onChangeText={v => update('password', v)}
                placeholder="Create a password"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Confirm Password <Text style={styles.required}>*</Text></Text>
            <View style={styles.inputRow}>
              <Lock size={15} color="#9ca3af" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={form.confirm}
                onChangeText={v => update('confirm', v)}
                placeholder="Repeat your password"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                autoCapitalize="none"
              />
            </View>
          </View>
        </View>

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading}
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitBtnText}>Create Account</Text>
          }
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { backgroundColor: '#2563eb', paddingTop: 52, paddingBottom: 28, paddingHorizontal: 20 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  backText: { color: '#bfdbfe', fontSize: 13 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  headerSub: { color: '#bfdbfe', fontSize: 13, marginTop: 2 },

  scroll: { padding: 16, paddingTop: 20 },

  sectionCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: '#9ca3af', letterSpacing: 0.6, marginBottom: 14 },

  fieldGroup: { marginBottom: 14 },
  label: { fontSize: 11, fontWeight: '600', color: '#4b5563', marginBottom: 6 },
  required: { color: '#ef4444' },
  optional: { color: '#9ca3af', fontWeight: '400' },

  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, backgroundColor: '#fff', paddingHorizontal: 12, minHeight: 46 },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 13, color: '#111827', paddingVertical: 12 },

  // Gender pills
  pillRow: { flexDirection: 'row', gap: 8 },
  pill: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  pillActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  pillText: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  pillTextActive: { color: '#2563eb' },

  // Ward dropdown
  wardDropdown: { marginTop: 4, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, overflow: 'hidden' },
  wardOption: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  wardOptionText: { fontSize: 13, color: '#374151' },
  wardOptionSelected: { color: '#2563eb', fontWeight: '600' },

  // Phone + OTP send
  phoneOtpRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  sendOtpBtn: { paddingHorizontal: 14, paddingVertical: 13, backgroundColor: '#2563eb', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sendOtpBtnSent: { backgroundColor: '#64748b' },
  sendOtpText: { color: '#fff', fontWeight: '600', fontSize: 12 },

  // OTP boxes
  otpHint: { color: '#9ca3af', fontWeight: '400', fontSize: 10 },
  otpRow: { flexDirection: 'row', gap: 8, justifyContent: 'flex-start' },
  otpBox: { width: 44, height: 52, borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12, fontSize: 20, fontWeight: '700', color: '#111827', backgroundColor: '#f9fafb', textAlign: 'center' },
  otpBoxFilled: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },

  errorBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14 },
  errorText: { color: '#dc2626', fontSize: 12 },

  submitBtn: { backgroundColor: '#2563eb', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  successRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, backgroundColor: '#fff' },
  successIcon: { width: 80, height: 80, backgroundColor: '#dcfce7', borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  checkmark: { fontSize: 40, color: '#16a34a' },
  successTitle: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 8 },
  successSub: { fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 24 },
  successBtn: { backgroundColor: '#2563eb', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12 },
  successBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});

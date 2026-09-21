import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff, Building2 } from 'lucide-react-native';
import { useClient } from '../context/ClientContext';

export default function Login({ onRegister }) {
  const { login } = useClient();
  const [role, setRole] = useState('citizen');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter email and password.');
      return;
    }
    setLoading(true);
    setError('');
    const result = await login(email.trim(), password, role);
    if (!result.success) setError(result.error || 'Login failed. Please try again.');
    setLoading(false);
  };

  const switchRole = (r) => {
    setRole(r);
    setEmail('');
    setPassword('');
    setError('');
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoBox}>
          <Building2 size={32} color="#fff" />
        </View>
        <Text style={styles.appName}>CivixAI</Text>
        <Text style={styles.tagline}>Agentic AI for Civic Issue Resolution</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          {/* Role toggle */}
          <View style={styles.roleToggle}>
            {['citizen', 'worker'].map(r => (
              <TouchableOpacity
                key={r}
                onPress={() => switchRole(r)}
                style={[styles.roleBtn, role === r && styles.roleBtnActive]}
              >
                <Text style={[styles.roleBtnText, role === r && styles.roleBtnTextActive]}>
                  {r === 'citizen' ? 'Citizen' : 'Worker'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder={role === 'citizen' ? 'you@example.com' : 'worker@municipality.gov.in'}
              placeholderTextColor="#9ca3af"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter password"
                placeholderTextColor="#9ca3af"
                secureTextEntry={!showPass}
              />
              <TouchableOpacity onPress={() => setShowPass(v => !v)} style={styles.eyeBtn}>
                {showPass ? <EyeOff size={18} color="#9ca3af" /> : <Eye size={18} color="#9ca3af" />}
              </TouchableOpacity>
            </View>
          </View>

          {/* Error */}
          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitBtnText}>Sign In</Text>
            }
          </TouchableOpacity>

          {/* Quick-fill credentials */}
          <View style={styles.demoBox}>
            <Text style={styles.demoTitle}>Quick Login (password: Civix@2024)</Text>
            {(role === 'citizen'
              ? [
                  { name: 'Priya Sharma',   email: 'priya.sharma@example.com' },
                  { name: 'Amit Jadhav',    email: 'amit.jadhav@example.com' },
                  { name: 'Meena Patil',    email: 'meena.patil@example.com' },
                  { name: 'Rahul Desai',    email: 'rahul.desai@example.com' },
                ]
              : [
                  { name: 'Suresh Kumar',    email: 'suresh.kumar@ichalkaranji.gov.in',    sub: 'Water' },
                  { name: 'Anjali More',     email: 'anjali.more@ichalkaranji.gov.in',     sub: 'Sanitation' },
                  { name: 'Vijay Sangle',    email: 'vijay.sangle@ichalkaranji.gov.in',    sub: 'Road' },
                  { name: 'Kavita Bhosale',  email: 'kavita.bhosale@ichalkaranji.gov.in',  sub: 'Electricity' },
                ]
            ).map(c => (
              <TouchableOpacity
                key={c.email}
                onPress={() => { setEmail(c.email); setPassword('Civix@2024'); }}
                style={styles.demoRow}
              >
                <Text style={styles.demoText}>{c.name}</Text>
                <Text style={styles.demoEmail}>{c.email}{c.sub ? `  ·  ${c.sub}` : ''}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {role === 'citizen' && (
            <View style={styles.registerRow}>
              <Text style={styles.registerPrompt}>No account? </Text>
              <TouchableOpacity onPress={onRegister}>
                <Text style={styles.registerLink}>Register</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: { backgroundColor: '#2563eb', paddingTop: 60, paddingBottom: 40, paddingHorizontal: 24, alignItems: 'center' },
  logoBox: { width: 64, height: 64, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  appName: { color: '#fff', fontSize: 24, fontWeight: '700' },
  tagline: { color: '#bfdbfe', fontSize: 13, marginTop: 4 },
  scroll: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
  roleToggle: { flexDirection: 'row', backgroundColor: '#f3f4f6', borderRadius: 12, padding: 4, marginBottom: 20 },
  roleBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  roleBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  roleBtnText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  roleBtnTextActive: { color: '#2563eb' },
  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 11, fontWeight: '600', color: '#4b5563', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 13, color: '#111827', backgroundColor: '#fff' },
  passwordRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, overflow: 'hidden' },
  eyeBtn: { paddingHorizontal: 12, paddingVertical: 12 },
  errorBox: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  errorText: { color: '#dc2626', fontSize: 12 },
  submitBtn: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  demoBox: { marginTop: 20, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 12, padding: 12 },
  demoTitle: { fontSize: 11, fontWeight: '700', color: '#1d4ed8', marginBottom: 8 },
  demoRow: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, marginBottom: 2 },
  demoText: { fontSize: 11, color: '#2563eb', fontWeight: '600' },
  demoEmail: { fontSize: 10, color: '#6b7280' },
  registerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 16 },
  registerPrompt: { fontSize: 13, color: '#6b7280' },
  registerLink: { fontSize: 13, fontWeight: '600', color: '#2563eb' },
});

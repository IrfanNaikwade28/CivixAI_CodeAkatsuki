import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Image,
  Modal, TouchableWithoutFeedback, Alert, Keyboard, useColorScheme,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useClient } from '../context/ClientContext';
import { authAPI } from '../services/api';
import {
  Lock, CheckCircle2, Eye, EyeOff,
  Phone, Mail, MapPin, Hash, LogOut, Camera,
  Calendar, Briefcase, User, Images, Shield, Save, Home,
} from 'lucide-react-native';

const genderOptions = ['Male', 'Female', 'Other'];

// ── Helper: parse 'YYYY-MM-DD' → { dd, mm, yyyy } ──────────────────────────
function parseDob(iso) {
  if (!iso) return { dd: '', mm: '', yyyy: '' };
  const [y, m, d] = iso.split('-');
  return { dd: d || '', mm: m || '', yyyy: y || '' };
}
function buildDob(dd, mm, yyyy) {
  if (dd.length === 2 && mm.length === 2 && yyyy.length === 4) return `${yyyy}-${mm}-${dd}`;
  return '';
}

// ── DOB 3-field input (DD / MM / YYYY) ──────────────────────────────────────
function DobInput({ day, month, year, onChangeDay, onChangeMonth, onChangeYear }) {
  const monthRef = useRef();
  const yearRef  = useRef();

  const handleDay = (v) => {
    const digits = v.replace(/\D/g, '').slice(0, 2);
    onChangeDay(digits);
    if (digits.length === 2) { Keyboard.dismiss(); monthRef.current?.focus(); }
  };
  const handleMonth = (v) => {
    const digits = v.replace(/\D/g, '').slice(0, 2);
    onChangeMonth(digits);
    if (digits.length === 2) { Keyboard.dismiss(); yearRef.current?.focus(); }
  };
  const handleYear = (v) => {
    const digits = v.replace(/\D/g, '').slice(0, 4);
    onChangeYear(digits);
    if (digits.length === 4) Keyboard.dismiss();
  };

  return (
    <View style={dobStyles.row}>
      <View style={dobStyles.segmentWrap}>
        <TextInput
          style={dobStyles.segment}
          value={day}
          onChangeText={handleDay}
          placeholder="DD"
          placeholderTextColor="#9ca3af"
          keyboardType="numeric"
          maxLength={2}
          returnKeyType="next"
        />
        <Text style={dobStyles.segLabel}>Day</Text>
      </View>
      <Text style={dobStyles.sep}>/</Text>
      <View style={dobStyles.segmentWrap}>
        <TextInput
          ref={monthRef}
          style={dobStyles.segment}
          value={month}
          onChangeText={handleMonth}
          placeholder="MM"
          placeholderTextColor="#9ca3af"
          keyboardType="numeric"
          maxLength={2}
          returnKeyType="next"
        />
        <Text style={dobStyles.segLabel}>Month</Text>
      </View>
      <Text style={dobStyles.sep}>/</Text>
      <View style={[dobStyles.segmentWrap, { flex: 1.6 }]}>
        <TextInput
          ref={yearRef}
          style={dobStyles.segment}
          value={year}
          onChangeText={handleYear}
          placeholder="YYYY"
          placeholderTextColor="#9ca3af"
          keyboardType="numeric"
          maxLength={4}
          returnKeyType="done"
        />
        <Text style={dobStyles.segLabel}>Year</Text>
      </View>
    </View>
  );
}

// ── OTP digit input row ──────────────────────────────────────────────────────
function OtpInput({ values, refs, onChange }) {
  return (
    <View style={styles.otpRow}>
      {values.map((val, i) => (
        <TextInput
          key={i}
          ref={refs[i]}
          style={[styles.otpBox, val && styles.otpBoxFilled]}
          value={val}
          onChangeText={v => {
            if (v.length > 1) return;
            onChange(i, v);
            if (v && i < 5) refs[i + 1]?.current?.focus();
            if (!v && i > 0) refs[i - 1]?.current?.focus();
          }}
          keyboardType="numeric"
          maxLength={1}
          textAlign="center"
        />
      ))}
    </View>
  );
}

export default function WorkerProfile({ onLogout }) {
  const { user, uploadProfilePhoto, updateProfile } = useClient();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Photo picker icon colors — dynamic for light/dark
  const photoIconBg    = isDark ? '#1e3a8a' : '#eff6ff';
  const photoIconColor = isDark ? '#93c5fd' : '#2563eb';

  // Profile photo
  const [profilePhoto, setProfilePhoto]         = useState(user?.profilePhoto || null);
  const [photoUploading, setPhotoUploading]     = useState(false);
  const [photoMenuVisible, setPhotoMenuVisible] = useState(false);

  // Editable personal details — pre-fill from context
  const initDob = parseDob(user?.dob);
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName,  setLastName]  = useState(user?.lastName  || '');
  const [gender,    setGender]    = useState(user?.gender    || '');
  const [dobDay,    setDobDay]    = useState(initDob.dd);
  const [dobMonth,  setDobMonth]  = useState(initDob.mm);
  const [dobYear,   setDobYear]   = useState(initDob.yyyy);
  const [street,    setStreet]    = useState(user?.street    || '');
  const [landmark,  setLandmark]  = useState(user?.landmark  || '');

  // Update profile state
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError,   setProfileError]   = useState('');

  // Change-password OTP flow
  const [pwStep, setPwStep]         = useState('idle'); // idle | otp | newpass | success
  const [otpValues, setOtpValues]   = useState(['', '', '', '', '', '']);
  const otpRefs                     = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];
  const [newPass, setNewPass]       = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showNew, setShowNew]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwLoading, setPwLoading]   = useState(false);
  const [pwError, setPwError]       = useState('');

  const handleOtpChange = (i, val) => {
    const next = [...otpValues];
    next[i] = val;
    setOtpValues(next);
  };

  // Upload photo
  const doUpload = async (uri) => {
    setProfilePhoto(uri);
    setPhotoUploading(true);
    try {
      const serverUrl = await uploadProfilePhoto(uri);
      if (serverUrl) setProfilePhoto(serverUrl);
    } catch (err) {
      Alert.alert('Upload failed', err?.response?.data?.detail || 'Could not upload photo. Please try again.');
      setProfilePhoto(user?.profilePhoto || null);
    } finally {
      setPhotoUploading(false);
    }
  };

  const pickFromGallery = async () => {
    setPhotoMenuVisible(false);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Please allow access to your photo library.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]?.uri) await doUpload(result.assets[0].uri);
  };

  const pickFromCamera = async () => {
    setPhotoMenuVisible(false);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Please allow camera access.'); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled && result.assets?.[0]?.uri) await doUpload(result.assets[0].uri);
  };

  // Update profile
  const handleUpdateProfile = async () => {
    setProfileError('');
    setProfileSuccess(false);

    if (!firstName.trim()) { setProfileError('First name is required.'); return; }
    if (!gender)            { setProfileError('Please select your gender.'); return; }
    if (!dobDay || !dobMonth || !dobYear) { setProfileError('Date of birth is required.'); return; }
    if (!street.trim())     { setProfileError('Street address is required.'); return; }

    const dob = buildDob(dobDay, dobMonth, dobYear);
    if (!dob) { setProfileError('Please enter a complete date of birth.'); return; }

    setProfileLoading(true);
    try {
      await updateProfile({
        first_name: firstName.trim(),
        last_name:  lastName.trim(),
        gender,
        dob,
        street:   street.trim(),
        landmark: landmark.trim(),
      });
      setProfileSuccess(true);
    } catch (err) {
      const data = err.response?.data;
      const msg  = data
        ? Object.values(data).flat().join(' ')
        : 'Failed to update profile. Please try again.';
      setProfileError(msg);
    } finally {
      setProfileLoading(false);
    }
  };

  // Change password (OTP-only flow — no current password sent)
  const handleChangePassword = async () => {
    setPwError('');
    if (newPass.length < 4) { setPwError('Password must be at least 4 characters.'); return; }
    if (newPass !== confirmPass) { setPwError('Passwords do not match.'); return; }
    setPwLoading(true);
    try {
      await authAPI.changePassword('', newPass);
      setPwStep('success');
      setNewPass(''); setConfirmPass('');
      setOtpValues(['', '', '', '', '', '']);
    } catch (err) {
      const msg = err.response?.data?.detail
        || err.response?.data?.new_password?.[0]
        || 'Failed to change password.';
      setPwError(msg);
    } finally {
      setPwLoading(false);
    }
  };

  const roleLabel = user?.category ? `${user.category} Worker` : 'Field Worker';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.root}>
        <ScrollView showsVerticalScrollIndicator={false}>

          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={styles.decCircle1} />
            <View style={styles.decCircle2} />

            <View style={styles.profileRow}>
              <TouchableOpacity style={styles.avatarWrapper} activeOpacity={0.85} onPress={() => !photoUploading && setPhotoMenuVisible(true)}>
                {photoUploading ? (
                  <View style={styles.avatarBox}><ActivityIndicator size="small" color="#fff" /></View>
                ) : profilePhoto ? (
                  <Image source={{ uri: profilePhoto }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarBox}>
                    <Text style={styles.avatarText}>{user?.name?.charAt(0)?.toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.cameraBadge}><Camera size={12} color="#fff" /></View>
              </TouchableOpacity>

              <View style={{ flex: 1 }}>
                <Text style={styles.profileName}>{user?.name}</Text>
                <Text style={styles.profileRole}>{roleLabel}</Text>
                <View style={styles.profileBadges}>
                  <View style={styles.wardBadge}>
                    <Text style={styles.wardBadgeText}>{user?.ward || '—'}</Text>
                  </View>
                  <View style={styles.idBadge}>
                    <Text style={styles.idBadgeText}>{user?.displayId}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* ── Employee Information (all read-only) ── */}
          <View style={[styles.card, styles.cardFirst]}>
            <Text style={styles.cardLabel}>EMPLOYEE INFORMATION</Text>

            <LockedRow Icon={Hash}      label="Employee ID" value={user?.displayId} />
            <LockedRow Icon={Mail}      label="Email"       value={user?.email} />
            <LockedRow Icon={Phone}     label="Mobile"      value={user?.phone} />
            <LockedRow Icon={MapPin}    label="Ward"        value={user?.ward} />
            <LockedRow Icon={Briefcase} label="Category"    value={user?.category} />
            <LockedRow Icon={Shield}    label="Role"        value={roleLabel} />
          </View>

          {/* ── Personal Details (editable: name, gender, dob, street, landmark) ── */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>PERSONAL DETAILS</Text>

            {/* First Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>First Name <Text style={styles.required}>*</Text></Text>
              <View style={styles.inputRow}>
                <User size={14} color="#9ca3af" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="Enter first name"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Last Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Last Name</Text>
              <View style={styles.inputRow}>
                <User size={14} color="#9ca3af" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Enter last name"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Gender */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Gender <Text style={styles.required}>*</Text></Text>
              <View style={styles.pillRow}>
                {genderOptions.map(g => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.pill, gender === g && styles.pillActive]}
                    onPress={() => setGender(g)}
                  >
                    <Text style={[styles.pillText, gender === g && styles.pillTextActive]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Date of Birth */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Date of Birth <Text style={styles.required}>*</Text></Text>
              <View style={styles.inputRow}>
                <Calendar size={14} color="#9ca3af" style={{ marginRight: 8 }} />
                <DobInput
                  day={dobDay} month={dobMonth} year={dobYear}
                  onChangeDay={setDobDay} onChangeMonth={setDobMonth} onChangeYear={setDobYear}
                />
              </View>
            </View>

            {/* Street */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Street Address <Text style={styles.required}>*</Text></Text>
              <View style={styles.inputRow}>
                <Home size={14} color="#9ca3af" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  value={street}
                  onChangeText={setStreet}
                  placeholder="House no., street name"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Landmark */}
            <View style={[styles.fieldGroup, { marginBottom: 0 }]}>
              <Text style={styles.fieldLabel}>Landmark <Text style={styles.optional}>(optional)</Text></Text>
              <View style={styles.inputRow}>
                <MapPin size={14} color="#9ca3af" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  value={landmark}
                  onChangeText={setLandmark}
                  placeholder="Near temple, school, etc."
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="words"
                />
              </View>
            </View>
          </View>

          {/* ── Update Profile button ── */}
          <View style={{ paddingHorizontal: 16, marginTop: 14 }}>
            {profileSuccess && (
              <View style={styles.successBox}>
                <CheckCircle2 size={16} color="#22c55e" />
                <Text style={styles.successText}>Profile updated successfully!</Text>
              </View>
            )}
            {!!profileError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{profileError}</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.updateProfileBtn, profileLoading && styles.updateBtnDisabled]}
              onPress={handleUpdateProfile}
              disabled={profileLoading}
            >
              {profileLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Save size={16} color="#fff" />
                  <Text style={styles.updateProfileBtnText}>Update Profile</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* ── Change Password (OTP flow only) ── */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.lockIconBox}><Lock size={15} color="#334155" /></View>
              <Text style={styles.cardTitle}>Change Password</Text>
            </View>

            {pwStep === 'success' && (
              <View style={styles.successBox}>
                <CheckCircle2 size={16} color="#22c55e" />
                <Text style={styles.successText}>Password changed successfully!</Text>
              </View>
            )}
            {!!pwError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{pwError}</Text>
              </View>
            )}

            {pwStep === 'idle' && (
              <>
                <Text style={styles.fieldLabel}>Mobile Number</Text>
                <View style={[styles.inputRow, { marginBottom: 14 }]}>
                  <Phone size={14} color="#9ca3af" style={{ marginRight: 8 }} />
                  <Text style={[styles.input, { color: '#6b7280' }]}>{user?.phone || '—'}</Text>
                </View>
                <TouchableOpacity
                  style={styles.otpTriggerBtn}
                  onPress={() => { setPwError(''); setPwStep('otp'); }}
                >
                  <Text style={styles.otpTriggerText}>Send OTP to verify mobile</Text>
                </TouchableOpacity>
              </>
            )}

            {pwStep === 'otp' && (
              <>
                <Text style={styles.fieldLabel}>
                  Enter OTP <Text style={styles.optional}>(sent to {user?.phone})</Text>
                </Text>
                <OtpInput values={otpValues} refs={otpRefs} onChange={handleOtpChange} />
                <TouchableOpacity
                  style={[styles.otpVerifyBtn, { marginTop: 12 }]}
                  onPress={() => { setPwError(''); setPwStep('newpass'); }}
                >
                  <Text style={styles.otpVerifyText}>Verify OTP</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setPwStep('idle')} style={{ marginTop: 8, alignItems: 'center' }}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}

            {pwStep === 'newpass' && (
              <>
                <Text style={styles.fieldLabel}>New Password</Text>
                <View style={[styles.inputRow, { marginBottom: 14 }]}>
                  <TextInput
                    style={styles.input}
                    value={newPass}
                    onChangeText={setNewPass}
                    placeholder="Minimum 4 characters"
                    placeholderTextColor="#9ca3af"
                    secureTextEntry={!showNew}
                  />
                  <TouchableOpacity onPress={() => setShowNew(v => !v)} style={{ padding: 4 }}>
                    {showNew ? <EyeOff size={16} color="#9ca3af" /> : <Eye size={16} color="#9ca3af" />}
                  </TouchableOpacity>
                </View>
                <Text style={styles.fieldLabel}>Confirm New Password</Text>
                <View style={[styles.inputRow, { marginBottom: 14 }]}>
                  <TextInput
                    style={styles.input}
                    value={confirmPass}
                    onChangeText={setConfirmPass}
                    placeholder="Re-enter new password"
                    placeholderTextColor="#9ca3af"
                    secureTextEntry={!showConfirm}
                  />
                  <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={{ padding: 4 }}>
                    {showConfirm ? <EyeOff size={16} color="#9ca3af" /> : <Eye size={16} color="#9ca3af" />}
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[styles.updateBtn, (!newPass || !confirmPass || pwLoading) && styles.updateBtnDisabled]}
                  onPress={handleChangePassword}
                  disabled={!newPass || !confirmPass || pwLoading}
                >
                  {pwLoading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.updateBtnText}>Update Password</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setPwStep('idle')} style={{ marginTop: 8, alignItems: 'center' }}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}

            {pwStep === 'success' && (
              <TouchableOpacity style={styles.otpTriggerBtn} onPress={() => { setPwStep('idle'); setPwError(''); }}>
                <Text style={styles.otpTriggerText}>Change again</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Logout ── */}
          <View style={{ paddingHorizontal: 16, marginTop: 14, marginBottom: 40 }}>
            <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
              <LogOut size={16} color="#ef4444" />
              <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>

        {/* ── Photo picker action sheet ── */}
        <Modal
          visible={photoMenuVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setPhotoMenuVisible(false)}
        >
          <TouchableWithoutFeedback onPress={() => setPhotoMenuVisible(false)}>
            <View style={styles.photoSheetOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.photoSheet}>
                  <View style={styles.photoSheetHandle} />
                  <Text style={styles.photoSheetTitle}>Profile Photo</Text>

                  <TouchableOpacity style={styles.photoSheetOption} onPress={pickFromCamera}>
                    <View style={[styles.photoSheetIcon, { backgroundColor: photoIconBg }]}><Camera size={20} color={photoIconColor} /></View>
                    <View>
                      <Text style={styles.photoSheetOptionText}>Take Photo</Text>
                      <Text style={styles.photoSheetOptionSub}>Use your camera</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.photoSheetOption} onPress={pickFromGallery}>
                    <View style={[styles.photoSheetIcon, { backgroundColor: photoIconBg }]}><Images size={20} color={photoIconColor} /></View>
                    <View>
                      <Text style={styles.photoSheetOptionText}>Choose from Gallery</Text>
                      <Text style={styles.photoSheetOptionSub}>Pick from your photos</Text>
                    </View>
                  </TouchableOpacity>

                  {profilePhoto && (
                    <TouchableOpacity
                      style={[styles.photoSheetOption, { borderTopWidth: 1, borderTopColor: '#f3f4f6' }]}
                      onPress={() => { setProfilePhoto(null); setPhotoMenuVisible(false); }}
                    >
                      <View style={[styles.photoSheetIcon, { backgroundColor: '#fef2f2' }]}>
                        <Text style={{ fontSize: 18 }}>🗑️</Text>
                      </View>
                      <View>
                        <Text style={[styles.photoSheetOptionText, { color: '#ef4444' }]}>Remove Photo</Text>
                        <Text style={styles.photoSheetOptionSub}>Revert to initials</Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity style={styles.photoSheetCancel} onPress={() => setPhotoMenuVisible(false)}>
                    <Text style={styles.photoSheetCancelText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

      </View>
    </KeyboardAvoidingView>
  );
}

// ── Read-only info row (with lock badge) ─────────────────────────────────────
function LockedRow({ Icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconBox}><Icon size={14} color="#6b7280" /></View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.infoValue} numberOfLines={1}>{value || '—'}</Text>
          <View style={styles.lockedBadge}><Lock size={9} color="#6b7280" /></View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f1f5f9' },

  // Header — dark slate
  header: { paddingTop: 52, paddingBottom: 64, paddingHorizontal: 20, backgroundColor: '#1e293b', overflow: 'hidden', position: 'relative' },
  decCircle1: { position: 'absolute', top: -24, right: -24, width: 128, height: 128, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 64 },
  decCircle2: { position: 'absolute', top: 40, right: 32, width: 56, height: 56, backgroundColor: 'rgba(59,130,246,0.12)', borderRadius: 28 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 16, zIndex: 1 },

  // Avatar
  avatarWrapper: { position: 'relative' },
  avatarBox: { width: 68, height: 68, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2563eb', borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' },
  avatarImage: { width: 68, height: 68, borderRadius: 20, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  avatarText: { color: '#fff', fontSize: 26, fontWeight: '700' },
  cameraBadge: { position: 'absolute', bottom: -4, right: -4, width: 24, height: 24, backgroundColor: '#2563eb', borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#1e293b' },

  profileName: { color: '#fff', fontSize: 20, fontWeight: '700' },
  profileRole: { color: '#94a3b8', fontSize: 13, marginTop: 2 },
  profileBadges: { flexDirection: 'row', gap: 8, marginTop: 6 },
  wardBadge: { backgroundColor: '#2563eb', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  wardBadgeText: { color: '#fff', fontSize: 11, fontWeight: '500' },
  idBadge: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  idBadgeText: { color: '#cbd5e1', fontSize: 11, fontWeight: '500' },

  // Card
  card: { marginHorizontal: 16, marginTop: 14, backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 6, zIndex: 10, marginBottom: 0 },
  cardFirst: { marginTop: -32 },
  cardLabel: { fontSize: 10, fontWeight: '700', color: '#9ca3af', letterSpacing: 0.6, marginBottom: 14 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#1f2937' },
  lockIconBox: { width: 32, height: 32, backgroundColor: '#f1f5f9', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  // Info rows
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 5 },
  infoIconBox: { width: 32, height: 32, backgroundColor: '#f3f4f6', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  infoContent: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f9fafb', paddingBottom: 5 },
  infoLabel: { fontSize: 11, color: '#9ca3af' },
  infoValue: { fontSize: 13, fontWeight: '600', color: '#1f2937', maxWidth: '65%' },
  lockedBadge: { width: 18, height: 18, backgroundColor: '#f3f4f6', borderRadius: 6, alignItems: 'center', justifyContent: 'center' },

  // Fields
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#4b5563', marginBottom: 6 },
  optional: { color: '#9ca3af', fontWeight: '400' },
  required: { color: '#ef4444', fontWeight: '700' },

  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, backgroundColor: '#f9fafb', paddingHorizontal: 12 },
  input: { flex: 1, fontSize: 13, color: '#111827', paddingVertical: 12 },

  // Gender pills
  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  pillActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  pillText: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  pillTextActive: { color: '#2563eb' },

  // Update profile button
  updateProfileBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1e293b', borderRadius: 14, paddingVertical: 14 },
  updateProfileBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // OTP
  otpTriggerBtn: { borderWidth: 1.5, borderColor: '#2563eb', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  otpTriggerText: { color: '#2563eb', fontWeight: '600', fontSize: 13 },
  otpVerifyBtn: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  otpVerifyText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  otpRow: { flexDirection: 'row', gap: 8 },
  otpBox: { width: 42, height: 50, borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10, fontSize: 18, fontWeight: '700', color: '#111827', backgroundColor: '#f9fafb', textAlign: 'center' },
  otpBoxFilled: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  cancelText: { color: '#9ca3af', fontSize: 12, fontWeight: '500' },

  // Password update
  successBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14 },
  successText: { fontSize: 13, color: '#15803d', fontWeight: '600' },
  errorBox: { backgroundColor: '#fff1f2', borderWidth: 1, borderColor: '#fecdd3', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14 },
  errorText: { fontSize: 13, color: '#b91c1c' },
  updateBtn: { borderRadius: 12, paddingVertical: 13, alignItems: 'center', backgroundColor: '#1e293b', marginTop: 4 },
  updateBtnDisabled: { opacity: 0.55 },
  updateBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Logout
  logoutBtn: { backgroundColor: '#fff', borderRadius: 16, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1.5, borderColor: '#fecaca', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  logoutText: { color: '#ef4444', fontWeight: '700', fontSize: 15 },

  // Photo picker sheet
  photoSheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  photoSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32, paddingTop: 12 },
  photoSheetHandle: { width: 40, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  photoSheetTitle: { fontSize: 15, fontWeight: '700', color: '#1f2937', paddingHorizontal: 20, marginBottom: 12 },
  photoSheetOption: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14 },
  photoSheetIcon: { width: 44, height: 44, backgroundColor: '#eff6ff', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  photoSheetOptionText: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  photoSheetOptionSub: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  photoSheetCancel: { marginHorizontal: 20, marginTop: 8, backgroundColor: '#f1f5f9', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  photoSheetCancelText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
});

const dobStyles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  segmentWrap: { flex: 1, alignItems: 'center' },
  segment: { width: '100%', fontSize: 14, fontWeight: '600', color: '#111827', textAlign: 'center', paddingVertical: 8 },
  segLabel: { fontSize: 9, color: '#9ca3af', fontWeight: '500', marginTop: 1 },
  sep: { fontSize: 16, color: '#d1d5db', fontWeight: '300', marginBottom: 12 },
});

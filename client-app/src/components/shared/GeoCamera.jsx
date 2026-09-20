import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  ActivityIndicator, Image, SafeAreaView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { Camera, X, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react-native';

// Google Static Maps thumbnail — plain <Image>, no native package needed.
// Silently hides itself if the network request fails.
function MiniMap({ lat, lng, size = 72 }) {
  const [failed, setFailed] = useState(false);
  if (!lat || !lng || failed) return null;
  const url =
    `https://maps.googleapis.com/maps/api/staticmap` +
    `?center=${lat},${lng}&zoom=15&size=${size}x${size}&scale=2` +
    `&markers=color:red%7C${lat},${lng}`;
  return (
    <Image
      source={{ uri: url }}
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
        backgroundColor: '#1e293b',
      }}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}

/**
 * GeoCamera — full-screen camera modal.
 * Props:
 *   visible: bool
 *   onCapture({ photo: uri, location: { lat, lng, label, address } })
 *   onClose()
 *   label — optional heading string
 */
export default function GeoCamera({ visible, onCapture, onClose, label = 'Take Photo' }) {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [locPermission, setLocPermission] = useState(null);
  const [facing, setFacing] = useState('back');
  const [phase, setPhase] = useState('camera'); // camera | locating | preview | error
  const [photoUri, setPhotoUri] = useState(null);
  const [geoLabel, setGeoLabel] = useState('Locating…');
  const [geoAddress, setGeoAddress] = useState('');
  const [geoCoords, setGeoCoords] = useState(null);
  const [geoDateTime, setGeoDateTime] = useState('');
  const [geoDateFull, setGeoDateFull] = useState('');
  const cameraRef = useRef(null);

  // Reset state and request permissions when modal opens
  useEffect(() => {
    if (!visible) return;
    setPhase('camera');
    setPhotoUri(null);
    setGeoLabel('Locating…');
    setGeoAddress('');
    setGeoCoords(null);
    setGeoDateTime('');
    setGeoDateFull('');
    requestAllPermissions();
  }, [visible]);

  const requestAllPermissions = async () => {
    if (cameraPermission && !cameraPermission.granted) {
      await requestCameraPermission();
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocPermission(status);
  };

  const bothGranted =
    cameraPermission?.granted &&
    locPermission === 'granted';

  const capture = async () => {
    if (!cameraRef.current) return;
    try {
      const pic = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      setPhotoUri(pic.uri);
      setPhase('locating');
      await fetchGeo();
    } catch {
      setPhase('error');
    }
  };

  const fetchGeo = async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = loc.coords;
      setGeoCoords({ lat: latitude, lng: longitude });

      // Format as DMS — "Lat 34° 58' 25.464" Long E 85° 20' 16.872""
      const toDMS = (decimal) => {
        const deg = Math.floor(Math.abs(decimal));
        const minFull = (Math.abs(decimal) - deg) * 60;
        const min = Math.floor(minFull);
        const sec = (minFull - min) * 60;
        return { deg, min, sec };
      };
      const latDMS = toDMS(latitude);
      const lngDMS = toDMS(longitude);
      const coordStr =
        `Lat ${latDMS.deg}° ${latDMS.min}' ${latDMS.sec.toFixed(3)}" ` +
        `Long ${longitude >= 0 ? 'E' : 'W'} ${lngDMS.deg}° ${lngDMS.min}' ${lngDMS.sec.toFixed(3)}"`;
      setGeoLabel(coordStr);

      // Reverse geocode
      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (place) {
        const parts = [
          place.name,
          place.street,
          place.district || place.subregion,
          place.city,
          place.region,
        ].filter(Boolean);
        setGeoAddress(parts.join(', ') || 'Unknown location');
      }
    } catch {
      setGeoLabel('GPS unavailable');
      setGeoAddress('Location could not be determined');
    }

    const now = new Date();
    setGeoDateFull(
      now.toLocaleString('en-IN', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
    );
    setGeoDateTime(
      now.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
    );
    setPhase('preview');
  };

  const retake = () => {
    setPhotoUri(null);
    setGeoLabel('Locating…');
    setGeoAddress('');
    setGeoCoords(null);
    setPhase('camera');
  };

  const confirm = () => {
    onCapture({
      photo: photoUri,
      location: {
        lat: geoCoords?.lat,
        lng: geoCoords?.lng,
        label: geoAddress || geoLabel,
        address: geoAddress,
        coordLabel: geoLabel,
      },
    });
  };

  const flipCamera = () => setFacing(f => (f === 'back' ? 'front' : 'back'));

  if (!visible) return null;

  // Still loading permissions
  if (!cameraPermission || locPermission === null) {
    return (
      <Modal visible={visible} animationType="slide" statusBarTranslucent>
        <View style={styles.centered}>
          <ActivityIndicator color="#fff" size="large" />
          <Text style={styles.waitText}>Checking permissions…</Text>
        </View>
      </Modal>
    );
  }

  // Either permission denied
  if (!bothGranted) {
    const cameraOk = cameraPermission?.granted;
    const locOk = locPermission === 'granted';
    return (
      <Modal visible={visible} animationType="slide" statusBarTranslucent>
        <SafeAreaView style={styles.root}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{label}</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={22} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
          <View style={styles.centered}>
            <AlertTriangle size={48} color="#f59e0b" />
            <Text style={styles.errorTitle}>Permissions Required</Text>
            <Text style={styles.errorBody}>
              Both Camera and Location access are required to use this feature.
              {'\n\n'}
              {!cameraOk ? '• Camera permission is denied.\n' : ''}
              {!locOk ? '• Location permission is denied.\n' : ''}
              {'\n'}Please enable them in your device Settings.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={requestAllPermissions}>
              <Text style={styles.primaryBtnText}>Grant Permissions</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <View style={styles.root}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{label}</Text>
          <TouchableOpacity onPress={onClose}>
            <X size={22} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        {/* Camera view */}
        {phase === 'camera' && (
          <View style={styles.cameraContainer}>
            <CameraView ref={cameraRef} style={styles.camera} facing={facing} />
            <View style={styles.viewfinder} pointerEvents="none" />
          </View>
        )}

        {/* Locating GPS */}
        {phase === 'locating' && photoUri && (
          <View style={styles.photoContainer}>
            <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
            <View style={styles.overlay}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.overlayText}>Getting your location…</Text>
            </View>
          </View>
        )}

        {/* Preview with rich geo-stamp */}
        {phase === 'preview' && photoUri && (
          <View style={styles.photoContainer}>
            <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />

            <View style={styles.geoStamp}>
              {/* Blue accent line — matches reference */}
              <View style={styles.geoAccentBar} />

              {/* Main row: mini-map + text */}
              <View style={styles.geoBody}>
                <MiniMap lat={geoCoords?.lat} lng={geoCoords?.lng} size={72} />

                <View style={styles.geoTextBlock}>
                  {/* Location name — large bold white */}
                  <Text style={styles.geoLocationName} numberOfLines={1}>
                    {geoAddress.split(',')[0] || 'Unknown Location'}
                  </Text>
                  {/* Full address */}
                  <Text style={styles.geoAddressLine} numberOfLines={2}>
                    {geoAddress}
                  </Text>
                  {/* DMS coordinates — green */}
                  <Text style={styles.geoCoordsLine} numberOfLines={1}>
                    {geoLabel}
                  </Text>
                  {/* Full date/time */}
                  <Text style={styles.geoDateLine}>{geoDateFull}</Text>
                </View>
              </View>

              {/* Footer: watermark + decimal coords */}
              <View style={styles.geoFooter}>
                <Text style={styles.geoWatermark}>📍 CivixAI</Text>
                {geoCoords && (
                  <Text style={styles.geoDecimalCoords}>
                    {geoCoords.lat.toFixed(6)}, {geoCoords.lng.toFixed(6)}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Error */}
        {phase === 'error' && (
          <View style={styles.centered}>
            <Camera size={48} color="#6b7280" />
            <Text style={styles.errorTitle}>Capture failed</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={retake}>
              <Text style={styles.primaryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom bar */}
        <View style={styles.bottomBar}>
          {phase === 'camera' && (
            <View style={styles.shutterRow}>
              <View style={{ width: 48 }} />
              <TouchableOpacity style={styles.shutter} onPress={capture}>
                <View style={styles.shutterInner} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.flipSmallBtn} onPress={flipCamera}>
                <RefreshCw size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
          {phase === 'preview' && (
            <View style={styles.previewActions}>
              <TouchableOpacity style={styles.retakeBtn} onPress={retake}>
                <Text style={styles.retakeBtnText}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={confirm}>
                <CheckCircle size={17} color="#fff" />
                <Text style={styles.confirmBtnText}>Use Photo</Text>
              </TouchableOpacity>
            </View>
          )}
          {phase === 'locating' && (
            <View style={styles.waitRow}>
              <Text style={styles.waitText}>Please wait…</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#111827', gap: 16, paddingHorizontal: 28,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  headerTitle: { color: '#fff', fontWeight: '600', fontSize: 14 },

  // Camera
  cameraContainer: { flex: 1, position: 'relative' },
  camera: { flex: 1 },
  viewfinder: {
    position: 'absolute', top: '25%', left: '12%', right: '12%', bottom: '25%',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', borderRadius: 12,
  },

  // Photo container (locating + preview)
  photoContainer: { flex: 1, position: 'relative' },
  photo: { flex: 1, width: '100%' },
  overlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  overlayText: { color: '#fff', fontSize: 14, fontWeight: '500' },

  // ─── Rich geo-stamp ───────────────────────────────────────────────────────
  geoStamp: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(8,12,22,0.90)',
  },
  geoAccentBar: {
    height: 3,
    backgroundColor: '#2563eb',
  },
  geoBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  geoTextBlock: {
    flex: 1,
    gap: 3,
  },
  geoLocationName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.1,
    lineHeight: 17,
  },
  geoAddressLine: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 10,
    lineHeight: 14,
  },
  geoCoordsLine: {
    color: '#4ade80',
    fontSize: 9.5,
    fontWeight: '600',
    marginTop: 1,
    letterSpacing: 0.2,
  },
  geoDateLine: {
    color: 'rgba(255,255,255,0.52)',
    fontSize: 9,
    marginTop: 1,
  },
  geoFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 10,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  geoWatermark: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  geoDecimalCoords: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 9,
  },

  // ─── Permissions error ────────────────────────────────────────────────────
  errorTitle: { color: '#fff', fontWeight: '700', fontSize: 16, textAlign: 'center' },
  errorBody: { color: '#9ca3af', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  primaryBtn: {
    backgroundColor: '#2563eb', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12,
  },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  // ─── Bottom bar ───────────────────────────────────────────────────────────
  bottomBar: { backgroundColor: '#000', paddingHorizontal: 24, paddingVertical: 24 },
  shutterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shutter: {
    width: 64, height: 64, borderRadius: 32, borderWidth: 4,
    borderColor: '#fff', backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff' },
  flipSmallBtn: {
    width: 48, height: 48, backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 24, alignItems: 'center', justifyContent: 'center',
  },
  previewActions: { flexDirection: 'row', gap: 12 },
  retakeBtn: {
    flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    paddingVertical: 12, borderRadius: 12, alignItems: 'center',
  },
  retakeBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  confirmBtn: {
    flex: 1, backgroundColor: '#22c55e', paddingVertical: 12, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  confirmBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  waitRow: { alignItems: 'center' },
  waitText: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
});

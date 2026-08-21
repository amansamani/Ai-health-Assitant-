import { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import API from '../services/api';
import { COLORS } from '../constants/theme';

// Must be the WEB-type client ID from Google Cloud Console (not Android/iOS) —
// this is what makes Google actually return an idToken your backend can verify.
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

if (!GOOGLE_WEB_CLIENT_ID && __DEV__) {
  console.warn(
    "⚠️ EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set. Copy .env.example to .env and set it, " +
    "then restart Expo (env vars are baked in at start, not hot-reloaded)."
  );
}

GoogleSignin.configure({
  webClientId: GOOGLE_WEB_CLIENT_ID,
  offlineAccess: false,
});

export default function GoogleSignInButton({ onSuccess }) {
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    try {
      setLoading(true);
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();

      const idToken = response?.data?.idToken;
      if (idToken) {
        await sendToBackend(idToken);
      } else {
        console.warn('Google sign-in succeeded but no idToken was returned — check webClientId configuration.');
      }
    } catch (err) {
      if (isErrorWithCode(err)) {
        switch (err.code) {
          case statusCodes.SIGN_IN_CANCELLED:
          case statusCodes.IN_PROGRESS:
            break; // user cancelled or double-tapped — not a real error
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            console.error('Google Play Services not available/outdated on this device.');
            break;
          default:
            console.error('Google sign-in error:', err.code, err.message);
        }
      } else {
        console.error('Google sign-in error:', err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const sendToBackend = async (idToken) => {
    try {
      const { data } = await API.post('/auth/google', { idToken });
      if (data.token) {
        onSuccess(data); // caller's onSuccess calls login(token)
      }
    } catch (err) {
      console.error('Google backend auth error:', err.response?.data?.message || err.message);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.googleBtn, loading && { opacity: 0.6 }]}
      disabled={loading}
      onPress={handlePress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
    >
      {loading ? (
        <ActivityIndicator color={COLORS.primary} />
      ) : (
        <>
          <Ionicons name="logo-google" size={18} color={COLORS.primary} />
          <Text style={styles.googleText}>Continue with Google</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    minHeight: 50,
    paddingVertical: 14,
    marginTop: 4,
    gap: 10,
  },
  googleText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textDark,
  },
});
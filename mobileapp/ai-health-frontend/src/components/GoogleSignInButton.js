import { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import API from '../services/api';

// Must be the WEB-type client ID from Google Cloud Console (not Android/iOS) —
// this is what makes Google actually return an idToken your backend can verify.
GoogleSignin.configure({
  webClientId: '701044360865-o2san4uegg1j0tpjk8q51eihm6e0g10l.apps.googleusercontent.com',
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
    >
      {loading ? (
        <ActivityIndicator color="#6366F1" />
      ) : (
        <>
          <Text style={styles.googleIcon}>G</Text>
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
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingVertical: 14,
    marginTop: 12,
    gap: 10,
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: '900',
    color: '#6366F1',
  },
  googleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
});
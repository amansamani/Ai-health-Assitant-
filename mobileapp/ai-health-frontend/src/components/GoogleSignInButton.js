import { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, Alert, View } from 'react-native';
import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { Svg, Path } from 'react-native-svg';
import API from '../services/api';
import Constants from 'expo-constants';

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || Constants.expoConfig?.extra?.googleWebClientId || '';

if (!GOOGLE_WEB_CLIENT_ID && __DEV__) {
  console.warn(
    '⚠️ EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set. Copy .env.example to .env and set it, then restart Expo (env vars are baked in at start, not hot-reloaded).'
  );
}

function GoogleLogo({ size = 20 }) {
  const scale = size / 18;
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" style={{ transform: [{ scale }] }}>
      <Path d="M17.64 9.205c0-.638-.057-1.252-.163-1.841H9v3.482h4.844a4.137 4.137 0 0 1-1.798 2.716v2.258h2.908c1.702-1.567 2.686-3.875 2.686-6.615Z" fill="#4285F4" />
      <Path d="M9 18c2.43 0 4.467-.805 5.954-2.18l-2.908-2.258c-.806.54-1.834.86-3.046.86-2.344 0-4.33-1.584-5.04-3.71H.954v2.331A9 9 0 0 0 9 18Z" fill="#34A853" />
      <Path d="M3.96 10.712A5.409 5.409 0 0 1 3.679 9c0-.594.102-1.172.281-1.712V4.957H.954A9 9 0 0 0 0 9c0 1.453.348 2.829.954 4.043L3.96 10.712Z" fill="#FBBC05" />
      <Path d="M9 3.578c1.322 0 2.507.455 3.441 1.347l2.582-2.582C13.463.885 11.426 0 9 0A9 9 0 0 0 .954 4.957L3.96 7.288C4.67 5.162 6.656 3.578 9 3.578Z" fill="#EA4335" />
    </Svg>
  );
}

export default function GoogleSignInButton({ onSuccess }) {
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    try {
      setLoading(true);
      if (!GOOGLE_WEB_CLIENT_ID || !/\.apps\.googleusercontent\.com$/.test(GOOGLE_WEB_CLIENT_ID)) {
        throw new Error('Google sign-in is not configured for this build. Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to the EAS preview environment and rebuild.');
      }
      GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, offlineAccess: false });
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      const idToken = response?.data?.idToken;
      if (idToken) {
        await sendToBackend(idToken);
      } else {
        throw new Error('Google did not return an ID token. Please try again.');
      }
    } catch (err) {
      if (isErrorWithCode(err)) {
        switch (err.code) {
          case statusCodes.SIGN_IN_CANCELLED:
          case statusCodes.IN_PROGRESS:
            break;
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            Alert.alert('Google sign-in', 'Google Play Services is unavailable or needs an update on this device.');
            break;
          default:
            console.error('Google sign-in error:', err.code, err.message);
            Alert.alert('Google sign-in', 'Unable to continue with Google. Please try again.');
        }
      } else {
        console.error('Google sign-in error:', err?.message);
        Alert.alert('Google sign-in', err?.message || 'Unable to continue with Google.');
      }
    } finally {
      setLoading(false);
    }
  };

  const sendToBackend = async (idToken) => {
    try {
      const { data } = await API.post('/auth/google', { idToken });
      if (data.token) {
        onSuccess(data);
      } else {
        throw new Error('Google authentication did not return a session token.');
      }
    } catch (err) {
      console.error('Google backend auth error:', err.response?.data?.message || err.message);
      Alert.alert('Google sign-in', err.response?.data?.message || 'We could not sign you in with Google. Please try again.');
    }
  };

  return (
    <TouchableOpacity
      style={[styles.googleBtn, loading && styles.googleBtnDisabled]}
      disabled={loading}
      onPress={handlePress}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
    >
      <View style={styles.googleLogoWrap}>
        <GoogleLogo size={20} />
      </View>
      {loading ? <ActivityIndicator color="#5F6368" /> : <Text style={styles.googleText}>Sign in with Google</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  googleBtn: {
    height: 52,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DADCE0',
    paddingHorizontal: 16,
    position: 'relative',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  googleBtnDisabled: { opacity: 0.65 },
  googleLogoWrap: {
    position: 'absolute',
    left: 16,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleText: {
    fontSize: 14.5,
    fontWeight: '600',
    color: '#3C4043',
    letterSpacing: 0,
  },
});

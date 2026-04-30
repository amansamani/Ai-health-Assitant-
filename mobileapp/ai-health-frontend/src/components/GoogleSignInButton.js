import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AuthSession from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

export default function GoogleSignInButton({ onSuccess }) {

  const redirectUri = AuthSession.makeRedirectUri({
  useProxy: true,
});

  const [request, response, promptAsync] = Google.useAuthRequest({
  expoClientId: '701044360865-o2san4uegg1j0tpjk8q51eihm6e0g10l.apps.googleusercontent.com',
  androidClientId: '701044360865-2pq4gdpjjku6ptmo3ojnqapjvirk1lco.apps.googleusercontent.com',
  webClientId: '701044360865-o2san4uegg1j0tpjk8q51eihm6e0g10l.apps.googleusercontent.com',
  scopes: ['profile', 'email'],
  redirectUri,
});

  useEffect(() => {
    if (response?.type === 'success') {
      // Use access_token instead of id_token
      const { id_token } = response.params;

      sendToBackend(id_token);
    }
    if (response?.type === 'error') {
      console.error('Google auth error:', response.error);
    }
  }, [response]);

  // Fetch user info directly from Google using access token
  const sendToBackend = async (idToken) => {
  try {
    const res = await fetch('https://ai-health-assitant-production.up.railway.app/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    const data = await res.json();

    if (data.token) {
      await AsyncStorage.setItem('token', data.token);
      onSuccess(data);
    }
  } catch (err) {
    console.error('Error:', err);
  }
};

  return (
    <TouchableOpacity
      style={[styles.googleBtn, !request && { opacity: 0.6 }]}
      disabled={!request}
      onPress={() => promptAsync({ useProxy: true })}
      activeOpacity={0.85}
    >
      <Text style={styles.googleIcon}>G</Text>
      <Text style={styles.googleText}>Continue with Google</Text>
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
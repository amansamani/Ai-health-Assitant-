import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

WebBrowser.maybeCompleteAuthSession();

export default function GoogleSignInButton({ onSuccess }) {
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: '701044360865-o2san4uegg1j0tpjk8q51eihm6e0g10l.apps.googleusercontent.com',
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      sendTokenToBackend(id_token);
    }
  }, [response]);

  const sendTokenToBackend = async (idToken) => {
    try {
      const res = await fetch('https://ai-health-assitant-production.up.railway.app/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json();
      if (data.token) {
        await AsyncStorage.setItem('token', data.token);
        onSuccess(data.user);
      }
    } catch (err) {
      console.error('Google sign-in error:', err);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.googleBtn, !request && { opacity: 0.6 }]}
      disabled={!request}
      onPress={() => promptAsync()}
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
    boxShadow: '0px 2px 8px rgba(15,23,42,0.06)',
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
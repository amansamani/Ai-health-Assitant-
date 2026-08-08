import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import AuthShell from '../components/auth/AuthShell';
import FormField from '../components/auth/FormField';
import PrimaryButton from '../components/auth/PrimaryButton';
import { AuthContext } from '../context/AuthContext';
import API from '../services/api';
import { COLORS, SPACING } from '../constants/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { Alert.alert('Missing fields', 'Please enter email and password.'); return; }
    setLoading(true);
    try {
      const res = await API.post('/auth/login', { email, password });
      await login(res.data.token);
      router.replace('/(app)/(tabs)/home');
    } catch (err) {
      Alert.alert('Login failed', err.response?.data?.message || 'Something went wrong.');
    } finally { setLoading(false); }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to continue your fitness journey.">
      <FormField label="Email" icon="mail-outline" placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <FormField label="Password" icon="lock-closed-outline" placeholder="••••••••" value={password} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} style={styles.forgotBtn}>
        <Text style={styles.forgotText}>Forgot password?</Text>
      </TouchableOpacity>
      <PrimaryButton title="Sign In" onPress={handleLogin} loading={loading} />
      <Animated.View entering={FadeInDown.delay(400)} style={styles.registerRow}>
        <Text style={styles.registerText}>Don't have an account? </Text>
        <TouchableOpacity onPress={() => router.push('/(auth)/register')}><Text style={styles.registerLink}>Sign Up</Text></TouchableOpacity>
      </Animated.View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  forgotBtn: { alignSelf: 'flex-end', marginBottom: SPACING.lg },
  forgotText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  registerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.xl },
  registerText: { fontSize: 14, color: COLORS.textSecondary },
  registerLink: { fontSize: 14, color: COLORS.primary, fontWeight: '700' },
});

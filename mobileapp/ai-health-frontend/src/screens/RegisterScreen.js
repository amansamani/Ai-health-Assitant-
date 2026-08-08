import React, { useState, useContext } from 'react';
import { Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import AuthShell from '../components/auth/AuthShell';
import FormField from '../components/auth/FormField';
import PrimaryButton from '../components/auth/PrimaryButton';
import { AuthContext } from '../context/AuthContext';
import API from '../services/api';
import { COLORS, SPACING } from '../constants/theme';

export default function RegisterScreen() {
  const router = useRouter();
  const { login } = useContext(AuthContext);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password) { Alert.alert('Missing fields', 'Please fill in all fields.'); return; }
    if (password !== confirm) { Alert.alert('Mismatch', 'Passwords do not match.'); return; }
    if (password.length < 6) { Alert.alert('Weak password', 'Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      const res = await API.post('/auth/register', { name, email, password });
      await login(res.data.token);
      router.replace('/(auth)/health-profile');
    } catch (err) {
      Alert.alert('Registration failed', err.response?.data?.message || 'Something went wrong.');
    } finally { setLoading(false); }
  };

  return (
    <AuthShell title="Create account" subtitle="Start your transformation today.">
      <FormField label="Full Name" icon="person-outline" placeholder="John Doe" value={name} onChangeText={setName} />
      <FormField label="Email" icon="mail-outline" placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <FormField label="Password" icon="lock-closed-outline" placeholder="Min 6 characters" value={password} onChangeText={setPassword} secureTextEntry />
      <FormField label="Confirm Password" icon="lock-closed-outline" placeholder="Repeat password" value={confirm} onChangeText={setConfirm} secureTextEntry />
      <PrimaryButton title="Create Account" onPress={handleRegister} loading={loading} style={{ marginTop: SPACING.sm }} />
      <Animated.View entering={FadeInDown.delay(400)} style={styles.loginRow}>
        <Text style={styles.loginText}>Already have an account? </Text>
        <TouchableOpacity onPress={() => router.push('/(auth)/login')}><Text style={styles.loginLink}>Sign In</Text></TouchableOpacity>
      </Animated.View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.xl },
  loginText: { fontSize: 14, color: COLORS.textSecondary },
  loginLink: { fontSize: 14, color: COLORS.primary, fontWeight: '700' },
});

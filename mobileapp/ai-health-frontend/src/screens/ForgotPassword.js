import React, { useState } from 'react';
import { Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import AuthShell from '../components/auth/AuthShell';
import FormField from '../components/auth/FormField';
import PrimaryButton from '../components/auth/PrimaryButton';
import API from '../services/api';
import { COLORS, SPACING } from '../constants/theme';

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!email.trim()) { Alert.alert('Missing email', 'Please enter your email address.'); return; }
    setLoading(true);
    try {
      await API.post('/auth/forgot-password', { email });
      Alert.alert('OTP Sent! 📧', 'Check your email for the 6-digit OTP.', [
        { text: 'OK', onPress: () => router.push({ pathname: '/(auth)/verify-otp', params: { email } }) },
      ]);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not send OTP.');
    } finally { setLoading(false); }
  };

  return (
    <AuthShell title="Forgot password?" subtitle="Enter your email and we'll send you a 6-digit OTP.">
      <FormField label="Email Address" icon="mail-outline" placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <PrimaryButton title="Send OTP" onPress={handleSend} loading={loading} />
      <Animated.View entering={FadeInDown.delay(300)} style={styles.backRow}>
        <Text style={styles.backText}>Remember your password? </Text>
        <Text style={styles.backLink} onPress={() => router.push('/(auth)/login')}>Sign In</Text>
      </Animated.View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  backRow: { flexDirection: 'row', justifyContent: 'center', marginTop: SPACING.xl },
  backText: { fontSize: 14, color: COLORS.textSecondary },
  backLink: { fontSize: 14, color: COLORS.primary, fontWeight: '700' },
});

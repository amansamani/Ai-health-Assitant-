import React, { useState } from 'react';
import { StyleSheet, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AuthShell from '../components/auth/AuthShell';
import FormField from '../components/auth/FormField';
import PrimaryButton from '../components/auth/PrimaryButton';
import API from '../services/api';
import { SPACING } from '../constants/theme';

export default function ResetPassword() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const email = params.email || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!password || !confirm) { Alert.alert('Missing fields', 'Please fill in both password fields.'); return; }
    if (password.length < 6) { Alert.alert('Weak password', 'Password must be at least 6 characters.'); return; }
    if (password !== confirm) { Alert.alert('Mismatch', 'Passwords do not match.'); return; }
    setLoading(true);
    try {
      await API.post('/auth/reset-password', { email, newPassword: password });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Password Reset! 🎉', 'You can now sign in with your new password.', [
        { text: 'Sign In', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not reset password.');
    } finally { setLoading(false); }
  };

  return (
    <AuthShell title="Reset password" subtitle="Create a strong new password.">
      <FormField label="New Password" icon="lock-closed-outline" placeholder="Min 6 characters" value={password} onChangeText={setPassword} secureTextEntry />
      <FormField label="Confirm New Password" icon="lock-closed-outline" placeholder="Repeat new password" value={confirm} onChangeText={setConfirm} secureTextEntry />
      <PrimaryButton title="Reset Password" onPress={handleReset} loading={loading} style={{ marginTop: SPACING.sm }} />
    </AuthShell>
  );
}

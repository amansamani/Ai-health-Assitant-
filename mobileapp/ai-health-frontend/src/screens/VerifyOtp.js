import React, { useState, useRef } from 'react';
import { Text, StyleSheet, TextInput, Alert, TouchableOpacity, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import AuthShell from '../components/auth/AuthShell';
import PrimaryButton from '../components/auth/PrimaryButton';
import API from '../services/api';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

const OTP_LENGTH = 6;

export default function VerifyOtp() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const email = params.email || '';
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef([]);

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  };

  const otpString = otp.join('');

  const handleVerify = async () => {
    if (otpString.length < OTP_LENGTH) { Alert.alert('Incomplete OTP', 'Please enter all 6 digits.'); return; }
    setLoading(true);
    try {
      await API.post('/auth/verify-otp', { email, otp: otpString });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push({ pathname: '/(auth)/reset-password', params: { email } });
    } catch (err) {
      Alert.alert('Invalid OTP', err.response?.data?.message || 'The OTP is incorrect or expired.');
    } finally { setLoading(false); }
  };

  return (
    <AuthShell title="Verify OTP" subtitle={`We sent a 6-digit code to ${email || 'your email'}.`}>
      <Animated.View entering={FadeInDown.delay(100)} style={styles.otpRow}>
        {otp.map((digit, i) => (
          <TextInput
            key={i}
            ref={el => (inputRefs.current[i] = el)}
            style={[styles.otpBox, digit && styles.otpBoxFilled]}
            value={digit}
            onChangeText={v => handleChange(i, v)}
            keyboardType="number-pad"
            maxLength={1}
            textAlign="center"
            selectionColor={COLORS.primary}
          />
        ))}
      </Animated.View>
      <PrimaryButton title="Verify OTP" onPress={handleVerify} loading={loading} style={{ marginTop: SPACING.lg }} />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.sm },
  otpBox: { flex: 1, height: 56, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  otpBoxFilled: { borderColor: COLORS.primary, backgroundColor: COLORS.surfaceElevated },
});

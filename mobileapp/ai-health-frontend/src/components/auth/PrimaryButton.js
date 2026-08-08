import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

export default function PrimaryButton({ title, onPress, loading = false, variant = 'primary', style }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const bgColor = variant === 'primary' ? COLORS.primary : COLORS.surfaceElevated;
  const textColor = variant === 'primary' ? '#fff' : COLORS.textPrimary;
  return (
    <Animated.View style={[{ borderRadius: RADIUS.md }, animatedStyle]}>
      <TouchableOpacity
        activeOpacity={0.85} onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.97); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
        onPressOut={() => { scale.value = withSpring(1); }}
        style={[styles.btn, { backgroundColor: bgColor }, style]}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color={textColor} size="small" /> : <Text style={[styles.btnText, { color: textColor }]}>{title}</Text>}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btn: { height: 52, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.lg },
  btnText: { fontSize: 16, fontWeight: '700' },
});

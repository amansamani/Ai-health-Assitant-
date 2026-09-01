import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY, SHADOW } from '../../constants/theme';
import { dismissToast, subscribeFeedback } from '../../services/uiFeedback';

const TYPE_MAP = {
  success: { icon: 'checkmark-circle', color: COLORS.success, bg: '#F5FBF6', border: '#DCEFE0' },
  error: { icon: 'alert-circle', color: COLORS.error, bg: '#FFF8F8', border: '#F4DCDC' },
  warning: { icon: 'warning', color: COLORS.warning, bg: '#FFFBF3', border: '#F1E2BF' },
  info: { icon: 'information-circle', color: COLORS.primary, bg: '#FAF7FB', border: COLORS.borderSubtle },
};

export default function FeedbackToast() {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState(null);
  const translateY = useRef(new Animated.Value(-28)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => subscribeFeedback((next) => {
    setToast(next);
    if (next) {
      translateY.setValue(-28);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, damping: 18, stiffness: 220, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(translateY, { toValue: -20, duration: 120, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 100, useNativeDriver: true }),
    ]).start();
  }), [opacity, translateY]);

  if (!toast) return null;

  const palette = TYPE_MAP[toast.type] || TYPE_MAP.info;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.container, { top: Math.max(insets.top, 12) + 4, opacity, transform: [{ translateY }] }]}
    >
      <Pressable onPress={dismissToast} style={({ pressed }) => [styles.card, { backgroundColor: palette.bg, borderColor: palette.border, opacity: pressed ? 0.92 : 1 }]}>
        <View style={[styles.iconWrap, { backgroundColor: `${palette.color}16` }]}>
          <Ionicons name={palette.icon} size={20} color={palette.color} />
        </View>
        <View style={styles.copy}>
          {!!toast.title && <Text style={styles.title}>{toast.title}</Text>}
          <Text style={styles.message}>{toast.message}</Text>
        </View>
        <Ionicons name="close" size={17} color={COLORS.textMuted} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    zIndex: 9999,
    elevation: 9999,
  },
  card: {
    minHeight: 60,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.sm,
    paddingLeft: SPACING.sm,
    paddingRight: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    ...SHADOW,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 2 },
  title: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textDark },
  message: { ...TYPOGRAPHY.caption, color: COLORS.textLight, lineHeight: 18 },
});

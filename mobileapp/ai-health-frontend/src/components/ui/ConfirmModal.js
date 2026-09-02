import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import LucideIcon from "../ui/LucideIcon";
import { COLORS, RADIUS, SPACING, TYPOGRAPHY, SHADOW } from '../../constants/theme';

export default function ConfirmModal({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  icon = 'help-circle-outline',
  tone = 'primary',
  onConfirm,
  onCancel,
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    if (!visible) return;
    opacity.setValue(0);
    translateY.setValue(18);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, damping: 18, stiffness: 220, useNativeDriver: true }),
    ]).start();
  }, [visible, opacity, translateY]);

  const accent = tone === 'danger' ? COLORS.error : tone === 'success' ? COLORS.success : COLORS.primary;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityRole="button" accessibilityLabel="Close dialog" />
        <Animated.View style={[styles.card, { opacity, transform: [{ translateY }] }]}>
          <View style={[styles.iconWrap, { backgroundColor: `${accent}14` }]}>
            <LucideIcon name={icon} size={25} color={accent} />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={cancelText}
            >
              <Text style={styles.cancelText}>{cancelText}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={({ pressed }) => [styles.confirmButton, { backgroundColor: accent }, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={confirmText}
            >
              <Text style={styles.confirmText}>{confirmText}</Text>
              <LucideIcon name="arrow-forward" size={16} color={COLORS.onPrimary} />
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.44)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  card: {
    width: '100%',
    maxWidth: 390,
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    padding: 20,
    ...SHADOW,
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  iconWrap: {
    width: 54,
    height: 54,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textDark,
    marginBottom: 6,
  },
  message: {
    ...TYPOGRAPHY.body,
    color: COLORS.textLight,
    marginBottom: SPACING.xl,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  cancelButton: {
    minHeight: 50,
    paddingHorizontal: SPACING.lg,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButton: {
    minHeight: 50,
    flex: 1,
    paddingHorizontal: SPACING.lg,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cancelText: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textDark,
  },
  confirmText: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.onPrimary,
  },
  pressed: {
    opacity: 0.88,
  },
});

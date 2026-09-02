import React, { useEffect, useRef } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import LucideIcon from "../ui/LucideIcon";
import { COLORS, SPACING, TYPOGRAPHY } from "../../constants/theme";

export default function ChoiceModal({ visible, title, message, options = [], onCancel }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    if (!visible) return;
    opacity.setValue(0);
    translateY.setValue(18);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 170, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, damping: 18, stiffness: 220, useNativeDriver: true }),
    ]).start();
  }, [visible, opacity, translateY]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityRole="button" accessibilityLabel="Close dialog" />
        <Animated.View style={[styles.card, { opacity, transform: [{ translateY }] }]}>
          <View style={styles.iconWrap}><LucideIcon name="options-outline" size={26} color={COLORS.primary} /></View>
          <Text style={styles.title}>{title}</Text>
          {!!message && <Text style={styles.message}>{message}</Text>}
          <View style={styles.options}>
            {options.map((option, index) => (
              <Pressable key={option.label} onPress={option.onPress} style={({ pressed }) => [styles.option, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={option.label}>
                <View style={styles.optionIcon}><LucideIcon name={option.icon || "chevron-forward"} size={19} color={option.danger ? COLORS.error : COLORS.primary} /></View>
                <View style={styles.optionCopy}><Text style={[styles.optionTitle, option.danger && { color: COLORS.error }]}>{option.label}</Text>{option.subtitle ? <Text style={styles.optionSubtitle}>{option.subtitle}</Text> : null}</View>
                <LucideIcon name="chevron-forward" size={17} color={COLORS.textMuted} />
              </Pressable>
            ))}
          </View>
          <Pressable onPress={onCancel} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}><Text style={styles.cancelText}>Cancel</Text></Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.44)", alignItems: "center", justifyContent: "center", paddingHorizontal: SPACING.lg },
  card: { width: "100%", maxWidth: 390, backgroundColor: COLORS.surface, borderRadius: 22, padding: 20, shadowColor: "#000", shadowOpacity: 0.14, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 10 },
  iconWrap: { width: 54, height: 54, borderRadius: 17, backgroundColor: COLORS.surfaceMuted, borderWidth: 1, borderColor: COLORS.borderSubtle, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  title: { ...TYPOGRAPHY.h2, color: COLORS.textDark, marginBottom: 5 },
  message: { ...TYPOGRAPHY.body, color: COLORS.textLight, marginBottom: 14 },
  options: { gap: 8 },
  option: { minHeight: 60, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: COLORS.borderSubtle, backgroundColor: COLORS.surfaceMuted, borderRadius: 14, paddingHorizontal: 12 },
  optionIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center", marginRight: 10 },
  optionCopy: { flex: 1 },
  optionTitle: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textDark },
  optionSubtitle: { marginTop: 2, fontSize: 11.5, lineHeight: 16, color: COLORS.textMuted },
  cancel: { minHeight: 46, borderRadius: 14, marginTop: 10, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.borderSubtle },
  cancelText: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textDark },
  pressed: { opacity: 0.84, transform: [{ scale: 0.995 }] },
});

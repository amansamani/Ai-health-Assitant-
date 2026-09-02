import { Text, Pressable, Animated, ActivityIndicator, StyleSheet } from "react-native";
import { useRef } from "react";
import LucideIcon from "../ui/LucideIcon";
import { COLORS } from "../../constants/theme";

export default function PrimaryButton({ title, onPress, loading, disabled, icon = "arrow-forward", variant = "primary" }) {
  const scale = useRef(new Animated.Value(1)).current;
  const isDisabled = disabled || loading;

  const onIn = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 40 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40 }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onIn}
      onPressOut={onOut}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: !!loading }}
      accessibilityLabel={title}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Animated.View style={[styles.btn, { backgroundColor: isDisabled ? COLORS.textMuted : COLORS.primary }]}>
          {loading ? (
            <ActivityIndicator color={COLORS.onPrimary} size="small" />
          ) : (
            <>
              <Text style={styles.text}>{title}</Text>
              {icon ? <LucideIcon name={icon} size={18} color={COLORS.onPrimary} style={{ marginLeft: 8 }} /> : null}
            </>
          )}
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    borderRadius: 12, minHeight: 48, paddingVertical: 12,
    alignItems: "center", justifyContent: "center",
    boxShadow: `0px 3px 10px ${COLORS.primary}24`,
  },
  text: { color: COLORS.onPrimary, fontSize: 15, fontWeight: "600", letterSpacing: 0.2 },
});

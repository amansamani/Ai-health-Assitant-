import { Text, Pressable, Animated, ActivityIndicator, StyleSheet } from "react-native";
import { useRef } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants/theme";

export default function PrimaryButton({ title, onPress, loading, disabled, icon = "arrow-forward", variant = "primary" }) {
  const scale = useRef(new Animated.Value(1)).current;
  const isDisabled = disabled || loading;

  const onIn = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 40 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40 }).start();

  const gradientColors = isDisabled
    ? [COLORS.textMuted, COLORS.textMuted]
    : variant === "primary"
      ? [COLORS.primary, COLORS.primaryDark]
      : [COLORS.primaryLight, COLORS.primary];

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
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.btn}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.onPrimary} size="small" />
          ) : (
            <>
              <Text style={styles.text}>{title}</Text>
              {icon ? <Ionicons name={icon} size={18} color={COLORS.onPrimary} style={{ marginLeft: 8 }} /> : null}
            </>
          )}
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    borderRadius: 16, minHeight: 52, paddingVertical: 14,
    alignItems: "center", justifyContent: "center",
    boxShadow: `0px 6px 18px ${COLORS.primary}45`,
  },
  text: { color: COLORS.onPrimary, fontSize: 16, fontWeight: "800", letterSpacing: 0.2 },
});

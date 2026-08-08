import { View, Text, TextInput, Pressable, Animated, StyleSheet } from "react-native";
import { useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants/theme";

// A visible label (not placeholder-only, per WCAG/form UX guidance) plus a
// vector icon (not emoji) and an animated focus border. Reused across every
// auth-flow input so they all look and behave identically.
export default function FormField({
  label,
  icon,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoCapitalize = "none",
  error,
  maxLength,
  helperText,
  onBlur: onBlurProp,
}) {
  const [focused, setFocused] = useState(false);
  const [reveal, setReveal] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = () => {
    setFocused(true);
    Animated.timing(borderAnim, { toValue: 1, duration: 180, useNativeDriver: false }).start();
  };
  const handleBlur = () => {
    setFocused(false);
    Animated.timing(borderAnim, { toValue: 0, duration: 180, useNativeDriver: false }).start();
    onBlurProp?.();
  };

  const borderColor = error
    ? COLORS.error
    : borderAnim.interpolate({ inputRange: [0, 1], outputRange: [COLORS.border, COLORS.primary] });

  const isPassword = !!secureTextEntry;

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Animated.View style={[styles.inputWrap, { borderColor }]}>
        {icon ? (
          <Ionicons
            name={icon}
            size={18}
            color={focused ? COLORS.primary : COLORS.textMuted}
            style={styles.icon}
          />
        ) : null}
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={isPassword && !reveal}
          keyboardType={keyboardType ?? "default"}
          autoCapitalize={autoCapitalize}
          maxLength={maxLength}
          autoComplete={isPassword ? "password" : keyboardType === "email-address" ? "email" : undefined}
          textContentType={isPassword ? "password" : keyboardType === "email-address" ? "emailAddress" : undefined}
          accessibilityLabel={label ?? placeholder}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setReveal((r) => !r)}
            hitSlop={10}
            style={styles.toggle}
            accessibilityRole="button"
            accessibilityLabel={reveal ? "Hide password" : "Show password"}
          >
            <Ionicons name={reveal ? "eye-off-outline" : "eye-outline"} size={18} color={COLORS.textMuted} />
          </Pressable>
        ) : null}
      </Animated.View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: "700", color: COLORS.textDark, marginBottom: 6, letterSpacing: 0.1 },
  inputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: COLORS.surfaceMuted, borderRadius: 14,
    borderWidth: 1.5, paddingHorizontal: 14,
    minHeight: 50,
  },
  icon: { marginRight: 10 },
  input: {
    flex: 1, paddingVertical: 13,
    fontSize: 15, color: COLORS.textDark, fontWeight: "500",
  },
  toggle: { padding: 6, marginLeft: 4, minWidth: 30, minHeight: 30, alignItems: "center", justifyContent: "center" },
  errorText: { color: COLORS.error, fontSize: 12, fontWeight: "600", marginTop: 6 },
  helperText: { color: COLORS.textMuted, fontSize: 12, fontWeight: "500", marginTop: 6 },
});

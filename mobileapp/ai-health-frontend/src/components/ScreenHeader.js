import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { COLORS } from "../constants/theme";

// Plain (non-gradient) back-button header for list-style social screens —
// TrackDetailScreen's gradient hero pattern is for "showcase" screens
// (one big number), this is for screens whose content is the list itself.
export default function ScreenHeader({ title, subtitle, rightAction }) {
  const router = useRouter();

  return (
    <View style={styles.header}>
      <Pressable
        onPress={() => router.back()}
        style={styles.backBtn}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={22} color={COLORS.textDark} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {rightAction ?? <View style={{ width: 34 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: COLORS.surfaceMuted,
    alignItems: "center", justifyContent: "center",
  },
  title:    { fontSize: 20, lineHeight: 26, fontWeight: "700", color: COLORS.textDark, letterSpacing: -0.2 },
  subtitle: { fontSize: 12.5, color: COLORS.textMuted, fontWeight: "500", marginTop: 1 },
});

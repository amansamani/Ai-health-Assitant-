import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants/theme";

export default function AuthHero({ icon = "pulse", title, subtitle, size = "large" }) {
  const compact = size === "compact";
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <LinearGradient
        colors={[COLORS.primary, COLORS.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.logo, compact && styles.logoCompact]}
      >
        <Ionicons name={icon} size={compact ? 24 : 32} color={COLORS.onPrimary} />
      </LinearGradient>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", marginBottom: 32, marginTop: 8 },
  wrapCompact: { marginBottom: 20, marginTop: 0 },
  logo: {
    width: 68, height: 68, borderRadius: 20,
    justifyContent: "center", alignItems: "center",
    marginBottom: 16,
    boxShadow: `0px 8px 20px ${COLORS.primaryDark}40`,
  },
  logoCompact: { width: 52, height: 52, borderRadius: 16, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: "900", color: COLORS.textDark, letterSpacing: -0.6, marginBottom: 6, textAlign: "center" },
  subtitle: { fontSize: 15, color: COLORS.textMuted, fontWeight: "500", textAlign: "center" },
});

import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants/theme";

export default function AuthHero({ icon = "pulse", title, subtitle, size = "large" }) {
  const compact = size === "compact";
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={[styles.logo, compact && styles.logoCompact]}>
        <Ionicons name={icon} size={compact ? 24 : 32} color={COLORS.onPrimary} />
      </View>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", marginBottom: 28, marginTop: 8 },
  wrapCompact: { marginBottom: 20, marginTop: 0 },
  logo: {
    width: 64, height: 64, borderRadius: 16,
    justifyContent: "center", alignItems: "center",
    marginBottom: 16,
    boxShadow: `0px 5px 14px ${COLORS.primaryDark}25`,
    backgroundColor: COLORS.primaryDark,
  },
  logoCompact: { width: 52, height: 52, borderRadius: 16, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: "800", color: COLORS.textDark, letterSpacing: -0.6, marginBottom: 6, textAlign: "center" },
  subtitle: { fontSize: 15, color: COLORS.textMuted, fontWeight: "500", textAlign: "center" },
});

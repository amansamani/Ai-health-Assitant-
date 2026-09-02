import { View, Text, StyleSheet, Image } from "react-native";
import { COLORS } from "../../constants/theme";

export default function AuthHero({ title, subtitle, size = "large" }) {
  const compact = size === "compact";
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={[styles.logo, compact && styles.logoCompact]}>
        <Image
          source={require("../../../assets/images/icon.png")}
          style={styles.logoImage}
          resizeMode="contain"
          accessibilityLabel="FitLip logo"
        />
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
    width: 64, height: 64, borderRadius: 18,
    justifyContent: "center", alignItems: "center",
    marginBottom: 16, overflow: "hidden",
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
    boxShadow: `0px 5px 14px ${COLORS.primaryDark}20`,
  },
  logoCompact: { width: 52, height: 52, borderRadius: 15, marginBottom: 12 },
  logoImage: { width: "100%", height: "100%" },
  title: { fontSize: 26, fontWeight: "800", color: COLORS.textDark, letterSpacing: -0.6, marginBottom: 6, textAlign: "center" },
  subtitle: { fontSize: 15, color: COLORS.textMuted, fontWeight: "500", textAlign: "center" },
});

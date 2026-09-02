import { View, Text, Pressable, StyleSheet } from "react-native";
import LucideIcon from "../ui/LucideIcon";
import { COLORS } from "../../constants/theme";

export function Divider() {
  return (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>or</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

export function Banner({ text, tone = "error" }) {
  if (!text) return null;
  const toneStyles = tone === "error" ? { bg: COLORS.errorBg, border: COLORS.errorBorder, color: COLORS.error, icon: "alert-circle" }
    : { bg: "#F0FDF4", border: "#BBF7D0", color: COLORS.success, icon: "checkmark-circle" };
  return (
    <View style={[styles.banner, { backgroundColor: toneStyles.bg, borderColor: toneStyles.border }]}>
      <LucideIcon name={toneStyles.icon} size={16} color={toneStyles.color} style={{ marginRight: 8 }} />
      <Text style={[styles.bannerText, { color: toneStyles.color }]}>{text}</Text>
    </View>
  );
}

export function BackLink({ label = "Back", onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.backLink} hitSlop={10} accessibilityRole="button">
      <LucideIcon name="chevron-back" size={18} color={COLORS.primary} />
      <Text style={styles.backLinkText}>{label}</Text>
    </Pressable>
  );
}

export function FooterLink({ prompt, label, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.footerWrap} hitSlop={10} accessibilityRole="button">
      <Text style={styles.footerText}>
        {prompt} <Text style={styles.footerLink}>{label}</Text>
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: 18, gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { fontSize: 13, color: COLORS.textMuted, fontWeight: "600" },

  banner: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 11,
    marginBottom: 14,
  },
  bannerText: { fontSize: 13, fontWeight: "600", flex: 1 },

  backLink: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", marginBottom: 12, minHeight: 44, paddingRight: 8 },
  backLinkText: { color: COLORS.primary, fontWeight: "700", fontSize: 15 },

  footerWrap: { alignItems: "center", minHeight: 44, justifyContent: "center" },
  footerText: { fontSize: 14, color: COLORS.textMuted, fontWeight: "500" },
  footerLink: { color: COLORS.primary, fontWeight: "800" },
});

import React from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import LucideIcon from "../components/ui/LucideIcon";
import { COLORS } from "../constants/theme";

const SUPPORT_EMAIL = "amanworkinfo@gmail.com";

async function openEmail(subject = "FitLip Support") {
  const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
  try {
    await Linking.openURL(url);
  } catch (error) {
    console.warn("Could not open email composer:", error);
  }
}

function ContactCard({ icon, title, subtitle, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.iconWrap}><LucideIcon name={icon} size={21} color={COLORS.primary} /></View>
      <View style={styles.copy}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSubtitle}>{subtitle}</Text>
      </View>
      <LucideIcon name="chevron-forward" size={18} color={COLORS.textMuted} />
    </Pressable>
  );
}

export default function HelpSupportScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable style={styles.back} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
            <LucideIcon name="chevron-back" size={22} color={COLORS.textDark} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>Help & Support</Text>
            <Text style={styles.headerSubtitle}>Get help with FitLip</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroIcon}><LucideIcon name="headset-outline" size={28} color={COLORS.primary} /></View>
          <Text style={styles.heroTitle}>We’re here to help</Text>
          <Text style={styles.heroText}>For account, tracking, workout, nutrition, or app issues, contact the FitLip support email and include a short description of what happened.</Text>
        </View>

        <Text style={styles.section}>CONTACT</Text>
        <ContactCard icon="mail-outline" title="Email FitLip support" subtitle={SUPPORT_EMAIL} onPress={() => openEmail()} />
        <ContactCard icon="bug-outline" title="Report a problem" subtitle="Send the issue, screen name, and steps to reproduce" onPress={() => openEmail("FitLip — Bug Report")} />
        <ContactCard icon="chatbubble-ellipses-outline" title="Send feedback" subtitle="Tell us what would make FitLip better" onPress={() => openEmail("FitLip — Product Feedback")} />

        <Text style={styles.section}>BEFORE CONTACTING US</Text>
        <View style={styles.infoCard}>
          <Info icon="refresh-outline" text="Make sure you are using the latest FitLip build." />
          <Info icon="wifi-outline" text="Check that your internet connection is working." />
          <Info icon="document-text-outline" text="Include your device, screen, and any error message you see." />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>FitLip Support</Text>
          <Text style={styles.footerText}>We’ll use this address for support communication related to the app.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Info({ icon, text }) {
  return <View style={styles.infoRow}><LucideIcon name={icon} size={17} color={COLORS.textMuted} /><Text style={styles.infoText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16, paddingBottom: 44 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  back: { width: 42, height: 42, borderRadius: 12, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, marginLeft: 12 },
  headerTitle: { fontSize: 23, fontWeight: "800", color: COLORS.textDark },
  headerSubtitle: { marginTop: 2, fontSize: 11.5, fontWeight: "600", color: COLORS.textMuted },
  hero: { backgroundColor: COLORS.surface, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, padding: 18, marginBottom: 22 },
  heroIcon: { width: 54, height: 54, borderRadius: 17, backgroundColor: COLORS.surfaceMuted, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  heroTitle: { fontSize: 20, fontWeight: "800", color: COLORS.textDark },
  heroText: { marginTop: 7, fontSize: 13, lineHeight: 20, color: COLORS.textMuted, fontWeight: "500" },
  section: { marginTop: 2, marginBottom: 9, fontSize: 10.5, letterSpacing: 1, fontWeight: "800", color: COLORS.textMuted },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 14, marginBottom: 10 },
  pressed: { opacity: 0.86, transform: [{ scale: 0.995 }] },
  iconWrap: { width: 42, height: 42, borderRadius: 13, backgroundColor: COLORS.surfaceMuted, alignItems: "center", justifyContent: "center", marginRight: 12 },
  copy: { flex: 1 },
  cardTitle: { fontSize: 14.5, fontWeight: "800", color: COLORS.textDark },
  cardSubtitle: { marginTop: 3, fontSize: 11.5, lineHeight: 16, color: COLORS.textMuted, fontWeight: "600" },
  infoCard: { backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 15, paddingVertical: 7 },
  infoRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 10 },
  infoText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: COLORS.textDark, fontWeight: "500" },
  footer: { alignItems: "center", paddingTop: 26 },
  footerTitle: { fontSize: 12.5, fontWeight: "800", color: COLORS.textDark },
  footerText: { marginTop: 5, textAlign: "center", maxWidth: 300, fontSize: 10.5, lineHeight: 16, color: COLORS.textMuted },
});

import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import Constants from "expo-constants";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/theme";

function InfoRow({ icon, title, value }) {
  return (
    <View style={styles.row}>
      <View style={styles.icon}>
        <Ionicons name={icon} size={18} color={COLORS.primary} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function AboutFitLipScreen() {
  const router = useRouter();
  const version = Constants.expoConfig?.version || "1.0.0";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable style={styles.back} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={COLORS.textDark} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>About FitLip</Text>
            <Text style={styles.headerSubtitle}>The story behind the app</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.logo}>
            <Ionicons name="fitness" size={34} color={COLORS.primary} />
          </View>
          <Text style={styles.appName}>FitLip</Text>
          <Text style={styles.tagline}>Train smarter. Track better. Stay consistent.</Text>
          <Text style={styles.version}>Version {version}</Text>
        </View>

        <Text style={styles.section}>ABOUT FITLIP</Text>
        <View style={styles.card}>
          <Text style={styles.body}>
            FitLip is a fitness and health companion built to bring workouts, running, health data, progress, and personal goals into one place. The app is designed around simple tracking, useful insights, and consistency rather than complicated fitness workflows.
          </Text>
          <Text style={[styles.body, styles.bodySpacing]}>
            From recording a run and tracking daily activity to managing workouts and health information, FitLip is being developed as an all-in-one space for building healthier habits.
          </Text>
        </View>

        <Text style={styles.section}>DEVELOPER</Text>
        <View style={styles.card}>
          <View style={styles.developerHeader}>
            <View style={styles.developerAvatar}>
              <Text style={styles.developerInitial}>A</Text>
            </View>
            <View style={styles.developerCopy}>
              <Text style={styles.developerName}>Aman Samani</Text>
              <Text style={styles.developerRole}>Developer & Creator of FitLip</Text>
            </View>
          </View>
          <Text style={styles.body}>
            FitLip is independently designed and developed by Aman Samani, who is building the product across its mobile experience, fitness tracking, health integrations, social features, and supporting backend systems.
          </Text>
        </View>

        <Text style={styles.section}>WHAT I&apos;M BUILDING</Text>
        <View style={styles.card}>
          <InfoRow icon="walk-outline" title="Activity & Running" value="GPS-based activity and run tracking" />
          <View style={styles.separator} />
          <InfoRow icon="barbell-outline" title="Workouts" value="Training plans, exercises and custom routines" />
          <View style={styles.separator} />
          <InfoRow icon="heart-outline" title="Health" value="Health profile and connected health data" />
          <View style={styles.separator} />
          <InfoRow icon="people-outline" title="Social" value="Profiles, followers and fitness activity sharing" />
          <View style={styles.separator} />
          <InfoRow icon="trophy-outline" title="Progress" value="Achievements, milestones and consistency" />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Made with care by Aman Samani</Text>
          <Text style={styles.footerSub}>© {new Date().getFullYear()} FitLip</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16, paddingBottom: 44 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  back: { width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, marginLeft: 12 },
  headerTitle: { fontSize: 23, fontWeight: "900", color: COLORS.textDark },
  headerSubtitle: { marginTop: 2, fontSize: 11.5, fontWeight: "600", color: COLORS.textMuted },
  hero: { alignItems: "center", paddingVertical: 24, paddingHorizontal: 18, backgroundColor: COLORS.surface, borderRadius: 24, borderWidth: 1, borderColor: COLORS.border },
  logo: { width: 72, height: 72, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surfaceMuted, borderWidth: 1, borderColor: COLORS.border },
  appName: { marginTop: 12, fontSize: 28, fontWeight: "900", color: COLORS.textDark },
  tagline: { marginTop: 6, fontSize: 12.5, fontWeight: "600", color: COLORS.textMuted, textAlign: "center" },
  version: { marginTop: 10, fontSize: 11, fontWeight: "800", color: COLORS.primary },
  section: { marginTop: 22, marginBottom: 9, fontSize: 10.5, letterSpacing: 1, fontWeight: "900", color: COLORS.textMuted },
  card: { padding: 16, backgroundColor: COLORS.surface, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border },
  body: { fontSize: 13, lineHeight: 20, color: COLORS.textDark, fontWeight: "500" },
  bodySpacing: { marginTop: 12 },
  developerHeader: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  developerAvatar: { width: 56, height: 56, borderRadius: 18, backgroundColor: COLORS.surfaceMuted, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center", marginRight: 12 },
  developerInitial: { fontSize: 23, fontWeight: "900", color: COLORS.primary },
  developerCopy: { flex: 1 },
  developerName: { fontSize: 17, fontWeight: "900", color: COLORS.textDark },
  developerRole: { marginTop: 3, fontSize: 11.5, fontWeight: "700", color: COLORS.primary },
  row: { minHeight: 58, flexDirection: "row", alignItems: "center" },
  icon: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.surfaceMuted, alignItems: "center", justifyContent: "center", marginRight: 12 },
  copy: { flex: 1 },
  rowTitle: { fontSize: 13.5, fontWeight: "900", color: COLORS.textDark },
  rowValue: { marginTop: 2, fontSize: 11.2, lineHeight: 15, color: COLORS.textMuted, fontWeight: "600" },
  separator: { height: 1, backgroundColor: COLORS.border, marginLeft: 50 },
  footer: { alignItems: "center", paddingTop: 26 },
  footerText: { fontSize: 12, fontWeight: "800", color: COLORS.textDark },
  footerSub: { marginTop: 4, fontSize: 10.5, fontWeight: "600", color: COLORS.textMuted },
});

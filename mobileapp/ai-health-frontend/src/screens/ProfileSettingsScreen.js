
import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/theme";

const KEYS = {
  haptics: "fitlip.settings.haptics",
  stayAwake: "fitlip.settings.stayAwake",
};

function SettingRow({
  icon,
  title,
  subtitle,
  onPress,
  trailing,
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.icon}>
        <Ionicons
          name={icon}
          size={19}
          color={COLORS.primary}
        />
      </View>

      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>

        {subtitle ? (
          <Text style={styles.subtitle}>{subtitle}</Text>
        ) : null}
      </View>

      {trailing ??
        (onPress ? (
          <Ionicons
            name="chevron-forward"
            size={18}
            color={COLORS.textMuted}
          />
        ) : null)}
    </Pressable>
  );
}

export default function ProfileSettingsScreen() {
  const router = useRouter();

  const [haptics, setHaptics] = useState(true);
  const [stayAwake, setStayAwake] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [h, s] = await Promise.all([
          AsyncStorage.getItem(KEYS.haptics),
          AsyncStorage.getItem(KEYS.stayAwake),
        ]);

        if (h !== null) {
          setHaptics(h !== "false");
        }

        if (s !== null) {
          setStayAwake(s === "true");
        }
      } catch (error) {
        console.warn("Failed to load settings:", error);
      }
    })();
  }, []);

  const toggle = async (key, value, setter) => {
    setter(value);

    try {
      await AsyncStorage.setItem(key, String(value));
    } catch (error) {
      console.warn("Failed to save setting:", error);
    }
  };

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top"]}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable
            style={styles.back}
            onPress={() => router.back()}
          >
            <Ionicons
              name="chevron-back"
              size={22}
              color={COLORS.textDark}
            />
          </Pressable>

          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>Settings</Text>

            <Text style={styles.headerSubtitle}>
              Control how FitLip behaves
            </Text>
          </View>
        </View>

        {/* ACCOUNT & PRIVACY */}
        <Text style={styles.section}>
          ACCOUNT & PRIVACY
        </Text>

        <View style={styles.card}>
          <SettingRow
            icon="person-circle-outline"
            title="Social profile"
            subtitle="Username, bio, profile photo and public/private visibility"
            onPress={() =>
              router.push(
                "/(app)/social/profile-settings"
              )
            }
          />
        </View>

        {/* APP PREFERENCES */}
        <Text style={styles.section}>
          APP PREFERENCES
        </Text>

        <View style={styles.card}>
          <SettingRow
            icon="sparkles-outline"
            title="Haptic feedback"
            subtitle="Use subtle taps for important FitLip actions"
            trailing={
              <Switch
                value={haptics}
                onValueChange={(value) =>
                  toggle(
                    KEYS.haptics,
                    value,
                    setHaptics
                  )
                }
                trackColor={{
                  false: COLORS.border,
                  true: COLORS.primaryLight,
                }}
                thumbColor={
                  haptics
                    ? COLORS.primary
                    : "#fff"
                }
              />
            }
          />

          <View style={styles.separator} />

          <SettingRow
            icon="sunny-outline"
            title="Keep screen awake"
            subtitle="Preference for long workout and tracking sessions"
            trailing={
              <Switch
                value={stayAwake}
                onValueChange={(value) =>
                  toggle(
                    KEYS.stayAwake,
                    value,
                    setStayAwake
                  )
                }
                trackColor={{
                  false: COLORS.border,
                  true: COLORS.primaryLight,
                }}
                thumbColor={
                  stayAwake
                    ? COLORS.primary
                    : "#fff"
                }
              />
            }
          />
        </View>

        {/* HEALTH & TRACKING */}
        <Text style={styles.section}>
          HEALTH & TRACKING
        </Text>

        <View style={styles.card}>
          <SettingRow
            icon="location-outline"
            title="Run tracking"
            subtitle="Background GPS, auto-pause and tracking behavior"
            onPress={() =>
              router.push(
                "/(app)/run-tracking"
              )
            }
          />

          <View style={styles.separator} />

          <SettingRow
            icon="heart-circle-outline"
            title="Health profile"
            subtitle="Body information, goals and fitness details"
            onPress={() =>
              router.push(
                "/(app)/edit-health-profile"
              )
            }
          />
        </View>

        {/* SUPPORT */}
        <Text style={styles.section}>
          SUPPORT
        </Text>

        <View style={styles.card}>
          <SettingRow
            icon="help-circle-outline"
            title="Help & Support"
            subtitle="Get help with your FitLip account and features"
            onPress={() =>
              router.push(
                "/(app)/social/index"
              )
            }
          />

          <View style={styles.separator} />

          <SettingRow
            icon="information-circle-outline"
            title="About FitLip"
            subtitle="The app, its developer and product information"
            onPress={() =>
              router.push(
                "/(app)/about-fitlip"
              )
            }
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  scroll: {
    padding: 16,
    paddingBottom: 40,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },

  back: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },

  headerCopy: {
    flex: 1,
    marginLeft: 12,
  },

  headerTitle: {
    fontSize: 23,
    fontWeight: "900",
    color: COLORS.textDark,
  },

  headerSubtitle: {
    marginTop: 2,
    fontSize: 11.5,
    fontWeight: "600",
    color: COLORS.textMuted,
  },

  section: {
    marginTop: 20,
    marginBottom: 9,
    fontSize: 10.5,
    letterSpacing: 1,
    fontWeight: "900",
    color: COLORS.textMuted,
  },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },

  row: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
  },

  pressed: {
    opacity: 0.8,
  },

  icon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: COLORS.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  copy: {
    flex: 1,
    paddingRight: 10,
  },

  title: {
    fontSize: 14.5,
    fontWeight: "900",
    color: COLORS.textDark,
  },

  subtitle: {
    marginTop: 3,
    fontSize: 11.2,
    lineHeight: 15.5,
    color: COLORS.textMuted,
    fontWeight: "600",
  },

  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: 66,
  },
});

import { useState, useCallback } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import API from "../../services/api";
import { COLORS } from "../../constants/theme";
import ScreenHeader from "../../components/ScreenHeader";
import FadeSlideIn from "../../components/FadeSlideIn";

function HubTile({ icon, color, title, subtitle, badge, onPress, delay }) {
  return (
    <FadeSlideIn delay={delay} style={{ width: "48%" }}>
      <Pressable onPress={onPress} style={styles.tile}>
        <View style={[styles.tileIconWrap, { backgroundColor: color + "18" }]}>
          <Ionicons name={icon} size={24} color={color} />
        </View>
        {badge != null && badge > 0 && (
          <View style={[styles.tileBadge, { backgroundColor: color }]}>
            <Text style={styles.tileBadgeText}>{badge}</Text>
          </View>
        )}
        <Text style={styles.tileTitle}>{title}</Text>
        <Text style={styles.tileSubtitle}>{subtitle}</Text>
      </Pressable>
    </FadeSlideIn>
  );
}

export default function CompeteHubScreen() {
  const router = useRouter();
  const [counts, setCounts] = useState({ friends: 0, activeDuels: 0, needsResponse: 0, achievements: 0 });

  const fetchCounts = useCallback(async () => {
    try {
      const [friendsRes, duelsRes, achievementsRes] = await Promise.all([
        API.get("/social/friends"),
        API.get("/social/duels"),
        API.get("/social/achievements"),
      ]);
      const duels = duelsRes.data;
      setCounts({
        friends: friendsRes.data.length,
        activeDuels: duels.filter((d) => d.status === "active").length,
        needsResponse: duels.filter((d) => d.status === "pending").length,
        achievements: achievementsRes.data.length,
      });
    } catch (err) {
      console.log("Failed to load compete counts:", err.response?.data?.message || err.message);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchCounts(); }, [fetchCounts]));

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <ScreenHeader title="Compete" subtitle="Train together, push each other" />

        <View style={styles.grid}>
          <HubTile
            icon="people-outline" color={COLORS.primary}
            title="Friends" subtitle={`${counts.friends} connected`}
            onPress={() => router.push("/(app)/social/friends")}
            delay={0}
          />
          <HubTile
            icon="flash-outline" color="#F97316"
            title="Duels" subtitle={`${counts.activeDuels} active`}
            badge={counts.needsResponse}
            onPress={() => router.push("/(app)/social/duels")}
            delay={40}
          />
          <HubTile
            icon="podium-outline" color="#22C55E"
            title="Streak Battles" subtitle="See who's ahead"
            onPress={() => router.push("/(app)/social/streaks")}
            delay={80}
          />
          <HubTile
            icon="ribbon-outline" color="#8E24AA"
            title="Achievements" subtitle={`${counts.achievements} earned`}
            onPress={() => router.push("/(app)/social/achievements")}
            delay={120}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },

  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12 },
  tile: {
    backgroundColor: COLORS.surface, borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: COLORS.border, minHeight: 130,
  },
  tileIconWrap: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  tileBadge: {
    position: "absolute", top: 14, right: 14,
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5,
    alignItems: "center", justifyContent: "center",
  },
  tileBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  tileTitle: { fontSize: 15, fontWeight: "800", color: COLORS.textDark, marginBottom: 3 },
  tileSubtitle: { fontSize: 11.5, color: COLORS.textMuted, fontWeight: "600" },
});

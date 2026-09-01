import { useState, useEffect, useMemo } from "react";
import { showToast } from "../../services/uiFeedback";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import RunRouteMap from "../../components/RunRouteMap";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

import { COLORS, SHADOW } from "../../constants/theme";
import { getDraftRun, clearDraftRun } from "../../services/runSessionStore";
import { saveRun } from "../../services/runService";
import {
  formatDuration,
  formatDistanceKm,
  formatPace,
  paceSecPerKm,
} from "../../utils/runMath";

const VISIBILITY_OPTIONS = [
  { key: "public", label: "Everyone", icon: "globe-outline" },
  { key: "followers", label: "Followers", icon: "people-outline" },
  { key: "private", label: "Only me", icon: "lock-closed-outline" },
];

// Compressed the same way meal photos are (see LogMealPhotoScreen) —
// keeps the base64 payload well under the backend's 10mb JSON body limit.
async function pickAndCompress(launcher) {
  const result = await launcher();
  if (result.canceled || !result.assets?.[0]) return null;

  const manipulated = await ImageManipulator.manipulateAsync(
    result.assets[0].uri,
    [{ resize: { width: 1080 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );

  return manipulated;
}

export default function RunSummaryScreen() {
  const router = useRouter();
  const [draft, setDraft] = useState(null);
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState("followers");
  const [photo, setPhoto] = useState(null); // { uri, base64 }
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const run = getDraftRun();
    if (!run) {
      // Landed here without a finished run in memory (deep link / reload)
      router.replace("/(app)/(tabs)/tracking");
      return;
    }
    setDraft(run);
  }, []);

  const region = useMemo(() => {
    if (!draft?.route?.length) return null;
    const lats = draft.route.map((p) => p.lat);
    const lngs = draft.route.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.004, (maxLat - minLat) * 1.4),
      longitudeDelta: Math.max(0.004, (maxLng - minLng) * 1.4),
    };
  }, [draft]);

  if (!draft) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  const handleAddPhoto = async () => {
    Alert.alert("Add a photo", "Attach a photo of your run", [
      {
        text: "Camera",
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) return;
          const img = await pickAndCompress(() =>
            ImagePicker.launchCameraAsync({ quality: 0.8 })
          );
          if (img) setPhoto(img);
        },
      },
      {
        text: "Gallery",
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) return;
          const img = await pickAndCompress(() =>
            ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.8,
            })
          );
          if (img) setPhoto(img);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleDiscard = () => {
    clearDraftRun();
    router.replace("/(app)/(tabs)/tracking");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveRun({
        activityType: draft.activityType,
        route: draft.route,
        distanceMeters: draft.distanceMeters,
        durationSeconds: draft.durationSeconds,
        caloriesBurned: draft.caloriesBurned,
        startedAt: draft.startedAt,
        endedAt: draft.endedAt,
        caption,
        visibility,
        photoBase64: photo?.base64 || null,
      });
      clearDraftRun();
      router.replace("/(app)/(tabs)/tracking");
    } catch (err) {
      showToast(
        err?.response?.data?.message || "Please try again.",
        { title: "Couldn't save run", type: "error" }
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={handleDiscard}>
          <Text style={styles.discardText}>Discard</Text>
        </Pressable>
        <Text style={styles.headerTitle}>
          {draft.activityType === "run"
            ? "Run complete"
            : draft.activityType === "cycle"
            ? "Ride complete"
            : "Walk complete"}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {region && (
          <View style={styles.mapCard}>
            <RunRouteMap
              style={styles.map}
              route={draft.route}
              initialRegion={region}
              showStartMarker
              showEndMarker
              strokeWidth={5}
            />
          </View>
        )}

        <View style={styles.statsGrid}>
          <SummaryStat label="Distance" value={`${formatDistanceKm(draft.distanceMeters)} km`} />
          <SummaryStat label="Duration" value={formatDuration(draft.durationSeconds)} />
          <SummaryStat
            label="Avg pace"
            value={paceSecPerKm(draft.distanceMeters, draft.durationSeconds) ? `${formatPace(paceSecPerKm(draft.distanceMeters, draft.durationSeconds))} /km` : "Building /km"}
          />
          <SummaryStat label="Calories" value={`${draft.caloriesBurned} kcal`} />
        </View>

        <Pressable style={styles.photoBox} onPress={handleAddPhoto}>
          {photo ? (
            <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="camera-outline" size={28} color={COLORS.textLight} />
              <Text style={styles.photoPlaceholderText}>Add a photo</Text>
            </View>
          )}
        </Pressable>

        <TextInput
          style={styles.captionInput}
          placeholder="How did it go?"
          placeholderTextColor={COLORS.textLight}
          value={caption}
          onChangeText={setCaption}
          maxLength={280}
          multiline
        />

        <Text style={styles.sectionLabel}>Who can see this</Text>
        <View style={styles.visibilityRow}>
          {VISIBILITY_OPTIONS.map((opt) => (
            <Pressable
              key={opt.key}
              style={[
                styles.visibilityChip,
                visibility === opt.key && styles.visibilityChipActive,
              ]}
              onPress={() => setVisibility(opt.key)}
            >
              <Ionicons
                name={opt.icon}
                size={16}
                color={visibility === opt.key ? COLORS.onPrimary : COLORS.textDark}
              />
              <Text
                style={[
                  styles.visibilityChipText,
                  visibility === opt.key && styles.visibilityChipTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={styles.saveBtn}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={COLORS.onPrimary} />
          ) : (
            <Text style={styles.saveBtnText}>Save & share</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function SummaryStat({ label, value }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statCardValue}>{value}</Text>
      <Text style={styles.statCardLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  discardText: { color: COLORS.error, fontWeight: "600", width: 60 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: COLORS.textDark },
  scroll: { padding: 16, paddingBottom: 32 },
  mapCard: {
    height: 200,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 16,
    ...SHADOW,
  },
  map: { flex: 1 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flexBasis: "47%",
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    ...SHADOW,
  },
  statCardValue: { fontSize: 22, fontWeight: "700", color: COLORS.textDark },
  statCardLabel: { fontSize: 12, color: COLORS.textLight, marginTop: 4 },
  photoBox: {
    height: 160,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceMuted,
    marginBottom: 12,
    overflow: "hidden",
  },
  photoPreview: { width: "100%", height: "100%" },
  photoPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6 },
  photoPlaceholderText: { color: COLORS.textLight, fontSize: 13 },
  captionInput: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    minHeight: 60,
    fontSize: 14,
    color: COLORS.textDark,
    textAlignVertical: "top",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionLabel: { fontSize: 13, fontWeight: "600", color: COLORS.textLight, marginBottom: 8 },
  visibilityRow: { flexDirection: "row", gap: 8 },
  visibilityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  visibilityChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  visibilityChipText: { fontSize: 12, fontWeight: "600", color: COLORS.textDark },
  visibilityChipTextActive: { color: COLORS.onPrimary },
  footer: { padding: 16 },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveBtnText: { color: COLORS.onPrimary, fontWeight: "700", fontSize: 16 },
});

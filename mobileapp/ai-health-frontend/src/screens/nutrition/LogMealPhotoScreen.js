import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import API from "../../services/api";
import { logMeal } from "../../services/nutritionService";

const MEAL_META = {
  breakfast: { icon: "🌅", label: "Breakfast", color: "#FF8F00" },
  lunch:     { icon: "☀️", label: "Lunch",     color: "#43A047" },
  dinner:    { icon: "🌙", label: "Dinner",     color: "#1E88E5" },
  snacks:    { icon: "🍎", label: "Snacks",     color: "#8E24AA" },
};

const CONFIDENCE_META = {
  high:   { label: "Confident",  color: "#22C55E" },
  medium: { label: "Best guess", color: "#F59E0B" },
  low:    { label: "Uncertain",  color: "#EF4444" },
};

async function prepareImageForUpload(uri) {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1024 } }],
    { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );
  return result;
}

export default function LogMealPhotoScreen({ navigation, route }) {
  const [mealType, setMealType] = useState(route?.params?.mealType || "breakfast");
  const [photo, setPhoto] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [selected, setSelected] = useState({});
  const [logging, setLogging] = useState(false);

  const resetPhoto = () => {
    setPhoto(null);
    setResults(null);
    setSelected({});
  };

  const pickFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Camera access needed", "Enable camera access in settings to take a photo of your meal.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets?.[0]) {
      await handleImageSelected(result.assets[0].uri);
    }
  };

  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Photo access needed", "Enable photo library access in settings to choose a meal photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      await handleImageSelected(result.assets[0].uri);
    }
  };

  const handleImageSelected = async (uri) => {
    try {
      const prepared = await prepareImageForUpload(uri);
      setPhoto(prepared);
      setResults(null);
      setSelected({});
    } catch (err) {
      Alert.alert("Couldn't process that photo", "Try a different photo.");
      console.warn("Image prep failed:", err.message);
    }
  };

  const analyzePhoto = async () => {
    if (!photo?.base64) return;
    setAnalyzing(true);
    try {
      const { data } = await API.post("/nutrition/analyze-meal-photo", {
        imageBase64: photo.base64,
        mimeType: "image/jpeg",
      });
      setResults(data);
      const initialSelection = {};
      (data.items || []).forEach((_, i) => { initialSelection[i] = true; });
      setSelected(initialSelection);
    } catch (err) {
      Alert.alert(
        "Couldn't analyze that photo",
        err.response?.data?.message || "Try a clearer photo, or log this meal manually instead."
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleItem = (i) => setSelected((prev) => ({ ...prev, [i]: !prev[i] }));

  const selectedCount = Object.values(selected).filter(Boolean).length;

  const logSelectedItems = async () => {
    const itemsToLog = (results?.items || []).filter((_, i) => selected[i]);
    if (itemsToLog.length === 0) return;

    setLogging(true);
    try {
      for (const item of itemsToLog) {
        await logMeal({
          mealType,
          food: {
            name:     item.name,
            brand:    "",
            quantity: item.quantity,
            unit:     item.unit,
            calories: item.calories,
            protein:  item.protein,
            carbs:    item.carbs,
            fats:     item.fats,
            fiber:    item.fiber || 0,
            sugar:    0,
            sodium:   0,
          },
        });
      }
      Alert.alert(
        "Logged! 🎉",
        `${itemsToLog.length} item${itemsToLog.length === 1 ? "" : "s"} added to ${MEAL_META[mealType].label}.`,
        [{ text: "Done", onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      Alert.alert("Something went wrong", "Some items may not have logged. Check your meal log and try again for any missing ones.");
      console.warn("Log selected items failed:", err.message);
    } finally {
      setLogging(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <View style={s.tabRow}>
          {Object.entries(MEAL_META).map(([key, meta]) => (
            <TouchableOpacity
              key={key}
              style={[s.tab, mealType === key && { backgroundColor: meta.color + "18", borderColor: meta.color }]}
              onPress={() => setMealType(key)}
            >
              <Text style={{ fontSize: 16 }}>{meta.icon}</Text>
              <Text style={[s.tabTxt, mealType === key && { color: meta.color, fontWeight: "800" }]}>
                {meta.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {!photo && (
          <View style={s.captureCard}>
            <Text style={s.captureEmoji}>📸</Text>
            <Text style={s.captureTitle}>Snap your meal</Text>
            <Text style={s.captureSub}>AI will estimate what's on your plate — you confirm before it's logged.</Text>

            <TouchableOpacity style={s.primaryBtn} onPress={pickFromCamera} activeOpacity={0.85}>
              <Text style={s.primaryBtnText}>📷  Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.secondaryBtn} onPress={pickFromGallery} activeOpacity={0.85}>
              <Text style={s.secondaryBtnText}>🖼️  Choose from Gallery</Text>
            </TouchableOpacity>
          </View>
        )}

        {photo && !results && (
          <View style={s.previewCard}>
            <Image source={{ uri: photo.uri }} style={s.previewImage} />

            {analyzing ? (
              <View style={s.analyzingRow}>
                <ActivityIndicator color="#6366F1" />
                <Text style={s.analyzingText}>Analyzing your meal...</Text>
              </View>
            ) : (
              <>
                <TouchableOpacity style={s.primaryBtn} onPress={analyzePhoto} activeOpacity={0.85}>
                  <Text style={s.primaryBtnText}>✨  Analyze Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.retakeBtn} onPress={resetPhoto} activeOpacity={0.85}>
                  <Text style={s.retakeBtnText}>Retake / Choose Different Photo</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {results && (
          <View>
            {results.items.length === 0 ? (
              <View style={s.emptyCard}>
                <Text style={s.emptyEmoji}>🤔</Text>
                <Text style={s.emptyTitle}>Couldn't identify any food</Text>
                <Text style={s.emptySub}>{results.notes || "Try a clearer, well-lit photo of your plate."}</Text>
                <TouchableOpacity style={s.retakeBtn} onPress={resetPhoto} activeOpacity={0.85}>
                  <Text style={s.retakeBtnText}>Try Another Photo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={s.sectionTitle}>Detected Items — tap to include/exclude</Text>

                {results.items.map((item, i) => {
                  const isSelected = !!selected[i];
                  const conf = CONFIDENCE_META[item.confidence] || CONFIDENCE_META.medium;
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[s.itemCard, !isSelected && s.itemCardMuted]}
                      onPress={() => toggleItem(i)}
                      activeOpacity={0.8}
                    >
                      <View style={[s.checkbox, isSelected && s.checkboxChecked]}>
                        {isSelected && <Text style={s.checkboxTick}>✓</Text>}
                      </View>

                      <View style={{ flex: 1 }}>
                        <View style={s.itemHeaderRow}>
                          <Text style={s.itemName} numberOfLines={1}>{item.name}</Text>
                          <View style={[s.confBadge, { backgroundColor: conf.color + "18" }]}>
                            <Text style={[s.confBadgeText, { color: conf.color }]}>{conf.label}</Text>
                          </View>
                        </View>
                        <Text style={s.itemMeta}>
                          {item.quantity} {item.unit} · {Math.round(item.calories)} kcal
                        </Text>
                        <Text style={s.itemMacros}>
                          P {item.protein.toFixed(1)}g · C {item.carbs.toFixed(1)}g · F {item.fats.toFixed(1)}g
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}

                {results.notes ? <Text style={s.notesText}>ℹ️ {results.notes}</Text> : null}

                <TouchableOpacity
                  style={[s.primaryBtn, selectedCount === 0 && s.primaryBtnDisabled]}
                  onPress={logSelectedItems}
                  disabled={selectedCount === 0 || logging}
                  activeOpacity={0.85}
                >
                  {logging ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={s.primaryBtnText}>
                      {selectedCount === 0
                        ? "Select at least 1 item"
                        : `Log ${selectedCount} Item${selectedCount === 1 ? "" : "s"} to ${MEAL_META[mealType].label}`}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={s.retakeBtn} onPress={resetPhoto} activeOpacity={0.85}>
                  <Text style={s.retakeBtnText}>Try Another Photo</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  scroll: { padding: 20, paddingBottom: 40 },

  tabRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  tab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 14,
    borderWidth: 1.5, borderColor: "#E2E8F0", backgroundColor: "#fff",
  },
  tabTxt: { fontSize: 12, fontWeight: "600", color: "#64748B" },

  captureCard: {
    backgroundColor: "#fff", borderRadius: 22, padding: 28,
    alignItems: "center", boxShadow: "0px 2px 12px rgba(15,23,42,0.06)",
  },
  captureEmoji: { fontSize: 44, marginBottom: 12 },
  captureTitle: { fontSize: 20, fontWeight: "900", color: "#0F172A", marginBottom: 6 },
  captureSub: { fontSize: 13, color: "#94A3B8", textAlign: "center", marginBottom: 24, lineHeight: 19 },

  previewCard: {
    backgroundColor: "#fff", borderRadius: 22, padding: 16,
    boxShadow: "0px 2px 12px rgba(15,23,42,0.06)",
  },
  previewImage: { width: "100%", height: 260, borderRadius: 16, marginBottom: 16, backgroundColor: "#F1F5F9" },

  analyzingRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16 },
  analyzingText: { fontSize: 14, fontWeight: "600", color: "#6366F1" },

  primaryBtn: {
    backgroundColor: "#6366F1", borderRadius: 16, paddingVertical: 16,
    alignItems: "center", justifyContent: "center", marginBottom: 10,
  },
  primaryBtnDisabled: { backgroundColor: "#CBD5E1" },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },

  secondaryBtn: {
    backgroundColor: "#F1F5F9", borderRadius: 16, paddingVertical: 16,
    alignItems: "center", justifyContent: "center",
  },
  secondaryBtnText: { color: "#0F172A", fontSize: 15, fontWeight: "700" },

  retakeBtn: { alignItems: "center", paddingVertical: 10 },
  retakeBtnText: { color: "#6366F1", fontSize: 13, fontWeight: "700" },

  sectionTitle: { fontSize: 13, fontWeight: "800", color: "#64748B", marginBottom: 12, letterSpacing: 0.2 },

  itemCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 10,
    borderWidth: 1.5, borderColor: "#EEF2FF",
  },
  itemCardMuted: { opacity: 0.45, borderColor: "#E2E8F0" },

  checkbox: {
    width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: "#CBD5E1",
    alignItems: "center", justifyContent: "center", marginTop: 2,
  },
  checkboxChecked: { backgroundColor: "#6366F1", borderColor: "#6366F1" },
  checkboxTick: { color: "#fff", fontSize: 13, fontWeight: "900" },

  itemHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 3 },
  itemName: { fontSize: 15, fontWeight: "800", color: "#0F172A", flex: 1, marginRight: 8 },
  confBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  confBadgeText: { fontSize: 10, fontWeight: "800" },
  itemMeta: { fontSize: 13, color: "#475569", fontWeight: "600", marginBottom: 2 },
  itemMacros: { fontSize: 11, color: "#94A3B8", fontWeight: "600" },

  notesText: { fontSize: 12, color: "#94A3B8", fontStyle: "italic", marginBottom: 14, lineHeight: 17 },

  emptyCard: {
    backgroundColor: "#fff", borderRadius: 22, padding: 28, alignItems: "center",
    boxShadow: "0px 2px 12px rgba(15,23,42,0.06)",
  },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: "#0F172A", marginBottom: 6 },
  emptySub: { fontSize: 13, color: "#94A3B8", textAlign: "center", marginBottom: 20, lineHeight: 19 },
});
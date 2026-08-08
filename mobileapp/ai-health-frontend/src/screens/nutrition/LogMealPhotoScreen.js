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
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import API from "../../services/api";
import { logMeal } from "../../services/nutritionService";
import { SunriseIcon, SunIcon, MoonStarIcon, AppleIcon } from "../../components/icons/MotionIcons";
import { useReplayOnFocus } from "../../hooks/useReplayOnFocus";

const MEAL_META = {
  breakfast: { Icon: SunriseIcon,  label: "Breakfast", color: "#FF8F00" },
  lunch:     { Icon: SunIcon,      label: "Lunch",     color: "#43A047" },
  dinner:    { Icon: MoonStarIcon, label: "Dinner",     color: "#1E88E5" },
  snacks:    { Icon: AppleIcon,    label: "Snacks",     color: "#8E24AA" },
};

const CONFIDENCE_META = {
  high:   { label: "Confident",  color: "#22C55E" },
  medium: { label: "Best guess", color: "#F59E0B" },
  low:    { label: "Uncertain",  color: "#EF4444" },
};

const MAX_ANGLES = 2;

async function prepareImageForUpload(uri) {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1024 } }],
    { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );
  return result;
}

// Scales every nutrition field on an item to a new gram amount, keeping the
// item's per-gram nutrient density constant. This is what lets a user say
// "actually that's more like 150g" and get correct calories back instantly,
// instead of trusting a single AI guess with no way to correct it.
function scaleItemToGrams(item, newGrams) {
  const baseGrams = item.weightGrams || item.quantity || 1;
  const ratio = newGrams / baseGrams;
  return {
    ...item,
    weightGrams: newGrams,
    calories: Math.round(item.calories * ratio),
    protein:  Number((item.protein * ratio).toFixed(1)),
    carbs:    Number((item.carbs * ratio).toFixed(1)),
    fats:     Number((item.fats * ratio).toFixed(1)),
    fiber:    Number((item.fiber * ratio).toFixed(1)),
  };
}

export default function LogMealPhotoScreen({ navigation, route }) {
  const [mealType, setMealType] = useState(route?.params?.mealType || "breakfast");
  const [photos, setPhotos] = useState([]); // up to MAX_ANGLES prepared photos
  const [hasReferenceObject, setHasReferenceObject] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [items, setItems] = useState([]); // editable copy of results.items
  const [selected, setSelected] = useState({});
  const [logging, setLogging] = useState(false);
  const iconTrigger = useReplayOnFocus();

  const resetPhoto = () => {
    setPhotos([]);
    setResults(null);
    setItems([]);
    setSelected({});
    setHasReferenceObject(false);
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
      setPhotos((prev) => [...prev, prepared].slice(0, MAX_ANGLES));
      setResults(null);
      setItems([]);
      setSelected({});
    } catch (err) {
      Alert.alert("Couldn't process that photo", "Try a different photo.");
      console.warn("Image prep failed:", err.message);
    }
  };

  const removePhoto = (i) => setPhotos((prev) => prev.filter((_, idx) => idx !== i));

  const analyzePhoto = async () => {
    if (photos.length === 0) return;
    setAnalyzing(true);
    try {
      const { data } = await API.post("/nutrition/analyze-meal-photo", {
        images: photos.map((p) => p.base64),
        mimeType: "image/jpeg",
        hasReferenceObject,
      });
      setResults(data);
      setItems(data.items || []);
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

  const adjustGrams = (i, delta) => {
    setItems((prev) => {
      const next = [...prev];
      const current = next[i];
      const currentGrams = current.weightGrams || current.quantity || 0;
      const newGrams = Math.max(5, Math.round(currentGrams + delta));
      next[i] = scaleItemToGrams(current, newGrams);
      return next;
    });
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  const logSelectedItems = async () => {
    const itemsToLog = items.filter((_, i) => selected[i]);
    if (itemsToLog.length === 0) return;

    setLogging(true);
    try {
      for (const item of itemsToLog) {
        await logMeal({
          mealType,
          food: {
            name:     item.name,
            brand:    "",
            // MealLog stores `quantity` in grams throughout the app (see
            // LogMealScreen's manual entry flow) — so we log weightGrams
            // here, not the AI's display "quantity" (which is a count like
            // "2 pieces" and would otherwise silently corrupt the history).
            quantity: item.weightGrams,
            unit:     "g",
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
        [{
          text: "Done",
          onPress: () => {
            // Pushed from Meal Logger — a real screen to return to. Opened
            // directly from the Camera tab — no back-stack, so goBack()
            // would silently no-op. Reset for the next capture instead.
            if (navigation.canGoBack?.()) {
              navigation.goBack();
            } else {
              setPhotos([]);
              setResults(null);
              setItems([]);
              setSelected({});
            }
          },
        }]
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
              <meta.Icon trigger={iconTrigger} size={18} color={meta.color} />
              <Text style={[s.tabTxt, mealType === key && { color: meta.color, fontWeight: "800" }]}>
                {meta.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {photos.length === 0 && (
          <View style={s.captureCard}>
            <View style={s.captureIconWrap}>
              <Ionicons name="camera-outline" size={36} color="#4C2E96" />
            </View>
            <Text style={s.captureTitle}>Snap your meal</Text>
            <Text style={s.captureSub}>AI will estimate what's on your plate — you confirm before it's logged.</Text>

            <TouchableOpacity style={s.primaryBtn} onPress={pickFromCamera} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Take photo">
              <Ionicons name="camera" size={16} color="#fff" style={{ marginRight: 8 }} />
              <Text style={s.primaryBtnText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.secondaryBtn} onPress={pickFromGallery} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Choose from gallery">
              <Ionicons name="images-outline" size={16} color="#4C2E96" style={{ marginRight: 8 }} />
              <Text style={s.secondaryBtnText}>Choose from Gallery</Text>
            </TouchableOpacity>
          </View>
        )}

        {photos.length > 0 && !results && (
          <View style={s.previewCard}>
            <View style={s.photoRow}>
              {photos.map((p, i) => (
                <View key={i} style={s.photoThumbWrap}>
                  <Image source={{ uri: p.uri }} style={s.photoThumb} />
                  <TouchableOpacity style={s.photoRemove} onPress={() => removePhoto(i)} accessibilityRole="button" accessibilityLabel="Remove photo">
                    <Ionicons name="close" size={13} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {analyzing ? (
              <View style={s.analyzingRow}>
                <ActivityIndicator color="#4C2E96" />
                <Text style={s.analyzingText}>Analyzing your meal...</Text>
              </View>
            ) : (
              <>
                {photos.length < MAX_ANGLES && (
                  <TouchableOpacity style={s.angleBtn} onPress={pickFromCamera} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Add another angle">
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="add" size={15} color="#4C2E96" style={{ marginRight: 4 }} />
                      <Text style={s.angleBtnText}>Add another angle (improves portion accuracy)</Text>
                    </View>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={s.referenceRow}
                  onPress={() => setHasReferenceObject((v) => !v)}
                  activeOpacity={0.85}
                >
                  <View style={[s.checkbox, hasReferenceObject && s.checkboxChecked]}>
                    {hasReferenceObject && <Text style={s.checkboxTick}>✓</Text>}
                  </View>
                  <Text style={s.referenceText}>My hand, a coin, or a fork/spoon is visible next to the food (helps scale)</Text>
                </TouchableOpacity>

                <TouchableOpacity style={s.primaryBtn} onPress={analyzePhoto} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Analyze photo">
                  <Ionicons name="sparkles" size={16} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={s.primaryBtnText}>Analyze Photo</Text>
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
            {items.length === 0 ? (
              <View style={s.emptyCard}>
                <Ionicons name="help-circle-outline" size={40} color="#9A94AE" style={{ marginBottom: 8 }} />
                <Text style={s.emptyTitle}>Couldn't identify any food</Text>
                <Text style={s.emptySub}>{results.notes || "Try a clearer, well-lit photo of your plate."}</Text>
                <TouchableOpacity style={s.retakeBtn} onPress={resetPhoto} activeOpacity={0.85}>
                  <Text style={s.retakeBtnText}>Try Another Photo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={s.sectionTitle}>Detected Items — tap to include/exclude, adjust grams if needed</Text>

                {items.map((item, i) => {
                  const isSelected = !!selected[i];
                  const conf = CONFIDENCE_META[item.confidence] || CONFIDENCE_META.medium;
                  const grams = Math.round(item.weightGrams || item.quantity || 0);
                  return (
                    <View key={i} style={[s.itemCard, !isSelected && s.itemCardMuted]}>
                      <TouchableOpacity
                        style={s.itemTapRow}
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
                          {item.source === "db_grounded" && (
                            <Text style={s.dbBadge}>✓ Nutrition verified against food database</Text>
                          )}
                          {!!item.portionBasis && (
                            <Text style={s.portionBasisText}>📏 {item.portionBasis}</Text>
                          )}
                        </View>
                      </TouchableOpacity>

                      <View style={s.gramStepperRow}>
                        <Text style={s.gramStepperLabel}>Amount:</Text>
                        <TouchableOpacity style={s.gramBtn} onPress={() => adjustGrams(i, -10)}>
                          <Text style={s.gramBtnText}>−</Text>
                        </TouchableOpacity>
                        <Text style={s.gramValue}>{grams}g</Text>
                        <TouchableOpacity style={s.gramBtn} onPress={() => adjustGrams(i, 10)}>
                          <Text style={s.gramBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
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
  container: { flex: 1, backgroundColor: "#F5F3FF" },
  scroll: { padding: 20, paddingBottom: 40 },

  tabRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  tab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 14,
    borderWidth: 1.5, borderColor: "#E4E0F0", backgroundColor: "#fff",
  },
  tabTxt: { fontSize: 12, fontWeight: "600", color: "#6B667D" },

  captureCard: {
    backgroundColor: "#fff", borderRadius: 22, padding: 28,
    alignItems: "center", boxShadow: "0px 2px 12px rgba(15,23,42,0.06)",
  },
  captureIconWrap: {
    width: 68, height: 68, borderRadius: 20,
    backgroundColor: "#EDE9FE",
    alignItems: "center", justifyContent: "center",
    marginBottom: 14,
  },
  captureEmoji: { fontSize: 44, marginBottom: 12 },
  captureTitle: { fontSize: 20, fontWeight: "900", color: "#1B1730", marginBottom: 6 },
  captureSub: { fontSize: 13, color: "#9A94AE", textAlign: "center", marginBottom: 24, lineHeight: 19 },

  previewCard: {
    backgroundColor: "#fff", borderRadius: 22, padding: 16,
    boxShadow: "0px 2px 12px rgba(15,23,42,0.06)",
  },
  photoRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  photoThumbWrap: { position: "relative", flex: 1 },
  photoThumb: { width: "100%", height: 180, borderRadius: 16, backgroundColor: "#EDE9FE" },
  photoRemove: {
    position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: 13,
    backgroundColor: "rgba(15,23,42,0.65)", alignItems: "center", justifyContent: "center",
  },
  photoRemoveText: { color: "#fff", fontSize: 13, fontWeight: "800" },

  angleBtn: {
    backgroundColor: "#EDE9FE", borderRadius: 14, paddingVertical: 12,
    alignItems: "center", marginBottom: 10,
  },
  angleBtnText: { color: "#4C2E96", fontSize: 13, fontWeight: "700" },

  referenceRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginBottom: 14, paddingHorizontal: 2,
  },
  referenceText: { flex: 1, fontSize: 12, color: "#6B667D", fontWeight: "600", lineHeight: 17 },

  analyzingRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16 },
  analyzingText: { fontSize: 14, fontWeight: "600", color: "#4C2E96" },

  primaryBtn: {
    backgroundColor: "#4C2E96", borderRadius: 16, paddingVertical: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 10,
    boxShadow: "0px 4px 12px rgba(76, 46, 150, 0.28)",
  },
  primaryBtnDisabled: { backgroundColor: "#E4E0F0", boxShadow: "none" },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },

  secondaryBtn: {
    backgroundColor: "#EDE9FE", borderRadius: 16, paddingVertical: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    boxShadow: "0px 2px 8px rgba(76, 46, 150, 0.08)",
  },
  secondaryBtnText: { color: "#1B1730", fontSize: 15, fontWeight: "700" },

  retakeBtn: { alignItems: "center", paddingVertical: 10 },
  retakeBtnText: { color: "#4C2E96", fontSize: 13, fontWeight: "700" },

  sectionTitle: { fontSize: 13, fontWeight: "800", color: "#6B667D", marginBottom: 12, letterSpacing: 0.2 },

  itemCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 10,
    borderWidth: 1.5, borderColor: "#EDE9FE",
  },
  itemCardMuted: { opacity: 0.45, borderColor: "#E4E0F0" },
  itemTapRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },

  checkbox: {
    width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: "#E4E0F0",
    alignItems: "center", justifyContent: "center", marginTop: 2,
  },
  checkboxChecked: { backgroundColor: "#4C2E96", borderColor: "#4C2E96" },
  checkboxTick: { color: "#fff", fontSize: 13, fontWeight: "900" },

  itemHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 3 },
  itemName: { fontSize: 15, fontWeight: "800", color: "#1B1730", flex: 1, marginRight: 8 },
  confBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  confBadgeText: { fontSize: 10, fontWeight: "800" },
  itemMeta: { fontSize: 13, color: "#6B667D", fontWeight: "600", marginBottom: 2 },
  itemMacros: { fontSize: 11, color: "#9A94AE", fontWeight: "600" },
  dbBadge: { fontSize: 10, color: "#22C55E", fontWeight: "700", marginTop: 4 },
  portionBasisText: { fontSize: 11, color: "#9A94AE", fontStyle: "italic", marginTop: 3 },

  gramStepperRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#EDE9FE",
  },
  gramStepperLabel: { fontSize: 12, color: "#6B667D", fontWeight: "700", marginRight: 2 },
  gramBtn: {
    width: 30, height: 30, borderRadius: 10, backgroundColor: "#EDE9FE",
    alignItems: "center", justifyContent: "center",
  },
  gramBtnText: { fontSize: 17, fontWeight: "800", color: "#1B1730" },
  gramValue: { fontSize: 14, fontWeight: "800", color: "#1B1730", minWidth: 48, textAlign: "center" },

  notesText: { fontSize: 12, color: "#9A94AE", fontStyle: "italic", marginBottom: 14, lineHeight: 17 },

  emptyCard: {
    backgroundColor: "#fff", borderRadius: 22, padding: 28, alignItems: "center",
    boxShadow: "0px 2px 12px rgba(15,23,42,0.06)",
  },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: "#1B1730", marginBottom: 6 },
  emptySub: { fontSize: 13, color: "#9A94AE", textAlign: "center", marginBottom: 20, lineHeight: 19 },
});

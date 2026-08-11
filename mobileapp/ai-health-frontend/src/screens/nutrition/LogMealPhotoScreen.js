import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Image,
  Animated,
  Easing,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import API from "../../services/api";
import { logMeal } from "../../services/nutritionService";
import { COLORS, BRAND, SHADOW } from "../../constants/theme";
import PrimaryButton from "../../components/auth/PrimaryButton";
import SkeletonCard from "../../components/SkeletonCard";
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

// ── Small shared press-feedback wrapper ──────────────────────────────────
// Gives secondary controls (gallery button, angle button, gram stepper,
// meal-type chips) the same tactile spring-scale the app's PrimaryButton
// already has, so every tappable surface on this screen feels consistent.
function Tappable({ onPress, style, children, scaleTo = 0.96, disabled, ...rest }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn = () => Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, speed: 50 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();
  return (
    <Pressable onPress={onPress} onPressIn={onIn} onPressOut={onOut} disabled={disabled} {...rest}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

// ── Gentle breathing pulse for the "AI is reading your plate" icon ──────
function PulseIcon({ children }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.14, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>;
}

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
    <SafeAreaView style={s.container} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <View style={s.screenHeader}>
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>LOG MEAL</Text>
            <Text style={s.screenTitle}>Snap Your Meal</Text>
            <Text style={s.screenSub}>AI reads your plate — you confirm before it's logged.</Text>
          </View>
          <View style={s.headerIconWrap}>
            <Ionicons name="camera" size={20} color={COLORS.primary} />
          </View>
        </View>

        <View style={s.tabRow}>
          {Object.entries(MEAL_META).map(([key, meta]) => (
            <Tappable
              key={key}
              style={[s.tab, mealType === key && { backgroundColor: meta.color + "18", borderColor: meta.color }]}
              onPress={() => setMealType(key)}
              accessibilityRole="button"
              accessibilityLabel={`${meta.label} meal`}
            >
              <meta.Icon trigger={iconTrigger} size={18} color={meta.color} />
              <Text style={[s.tabTxt, mealType === key && { color: meta.color, fontWeight: "800" }]}>
                {meta.label}
              </Text>
            </Tappable>
          ))}
        </View>

        {photos.length === 0 && (
          <View style={s.captureCard}>
            <LinearGradient
              colors={[BRAND[100], "#FFFFFF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.captureIconWrap}
            >
              <Ionicons name="camera-outline" size={34} color={COLORS.primary} />
            </LinearGradient>
            <Text style={s.captureTitle}>Snap your meal</Text>
            <Text style={s.captureSub}>AI will estimate what's on your plate — you confirm before it's logged.</Text>

            <View style={{ width: "100%", marginBottom: 12 }}>
              <PrimaryButton
                title="Take Photo"
                icon="camera"
                onPress={pickFromCamera}
                accessibilityLabel="Take photo"
              />
            </View>

            <Tappable
              style={[s.secondaryBtn, { width: "100%" }]}
              onPress={pickFromGallery}
              accessibilityRole="button"
              accessibilityLabel="Choose from gallery"
            >
              <Ionicons name="images-outline" size={16} color={COLORS.primary} style={{ marginRight: 8 }} />
              <Text style={s.secondaryBtnText}>Choose from Gallery</Text>
            </Tappable>
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
              <View style={s.analyzingWrap}>
                <View style={s.analyzingIconRow}>
                  <PulseIcon>
                    <View style={s.analyzingIconCircle}>
                      <Ionicons name="sparkles" size={20} color={COLORS.primary} />
                    </View>
                  </PulseIcon>
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={s.analyzingTitle}>Reading your plate…</Text>
                    <Text style={s.analyzingSub}>Identifying food and estimating portions</Text>
                  </View>
                </View>
                <SkeletonCard />
                <SkeletonCard />
              </View>
            ) : (
              <>
                {photos.length < MAX_ANGLES && (
                  <Tappable style={s.angleBtn} onPress={pickFromCamera} accessibilityRole="button" accessibilityLabel="Add another angle">
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="add" size={15} color={COLORS.primary} style={{ marginRight: 4 }} />
                      <Text style={s.angleBtnText}>Add another angle (improves portion accuracy)</Text>
                    </View>
                  </Tappable>
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

                <View style={{ marginBottom: 4 }}>
                  <PrimaryButton
                    title="Analyze Photo"
                    icon="sparkles"
                    onPress={analyzePhoto}
                    accessibilityLabel="Analyze photo"
                  />
                </View>
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
                <View style={s.emptyIconWrap}>
                  <Ionicons name="help-circle-outline" size={32} color={COLORS.textMuted} />
                </View>
                <Text style={s.emptyTitle}>Couldn't identify any food</Text>
                <Text style={s.emptySub}>{results.notes || "Try a clearer, well-lit photo of your plate."}</Text>
                <TouchableOpacity style={s.retakeBtn} onPress={resetPhoto} activeOpacity={0.85}>
                  <Text style={s.retakeBtnText}>Try Another Photo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={s.sectionTitle}>DETECTED ITEMS</Text>
                <Text style={s.sectionHint}>Tap to include or exclude, adjust grams if needed</Text>

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
                        <Tappable style={s.gramBtn} onPress={() => adjustGrams(i, -10)} accessibilityLabel="Decrease amount">
                          <Text style={s.gramBtnText}>−</Text>
                        </Tappable>
                        <Text style={s.gramValue}>{grams}g</Text>
                        <Tappable style={s.gramBtn} onPress={() => adjustGrams(i, 10)} accessibilityLabel="Increase amount">
                          <Text style={s.gramBtnText}>+</Text>
                        </Tappable>
                      </View>
                    </View>
                  );
                })}

                {results.notes ? <Text style={s.notesText}>ℹ️ {results.notes}</Text> : null}

                <PrimaryButton
                  title={
                    selectedCount === 0
                      ? "Select at least 1 item"
                      : `Log ${selectedCount} Item${selectedCount === 1 ? "" : "s"} to ${MEAL_META[mealType].label}`
                  }
                  icon={selectedCount === 0 ? null : "checkmark-circle"}
                  onPress={logSelectedItems}
                  disabled={selectedCount === 0}
                  loading={logging}
                  accessibilityLabel="Log selected items"
                />

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
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 20, paddingBottom: 40 },

  // ── Screen header — mirrors NutritionDashboardScreen's eyebrow + title
  // + icon-chip pattern so this screen reads as part of the same app.
  screenHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  eyebrow: { fontSize: 11, fontWeight: "800", color: COLORS.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 },
  screenTitle: { fontSize: 22, fontWeight: "800", color: COLORS.textDark, letterSpacing: -0.5, marginBottom: 4 },
  screenSub: { fontSize: 12.5, color: COLORS.textMuted, fontWeight: "600", lineHeight: 17, paddingRight: 12 },
  headerIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: BRAND[100], alignItems: "center", justifyContent: "center",
  },

  tabRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  tab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.card,
  },
  tabTxt: { fontSize: 12, fontWeight: "600", color: COLORS.textLight },

  captureCard: {
    backgroundColor: COLORS.card, borderRadius: 22, padding: 28,
    alignItems: "center", ...SHADOW,
  },
  captureIconWrap: {
    width: 72, height: 72, borderRadius: 24,
    alignItems: "center", justifyContent: "center",
    marginBottom: 16,
  },
  captureTitle: { fontSize: 20, fontWeight: "900", color: COLORS.textDark, marginBottom: 6 },
  captureSub: { fontSize: 13, color: COLORS.textMuted, textAlign: "center", marginBottom: 24, lineHeight: 19 },

  previewCard: {
    backgroundColor: COLORS.card, borderRadius: 22, padding: 16,
    ...SHADOW,
  },
  photoRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  photoThumbWrap: { position: "relative", flex: 1 },
  photoThumb: { width: "100%", height: 180, borderRadius: 16, backgroundColor: BRAND[100] },
  photoRemove: {
    position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: 13,
    backgroundColor: "rgba(15,23,42,0.65)", alignItems: "center", justifyContent: "center",
  },

  angleBtn: {
    backgroundColor: BRAND[50], borderRadius: 14, paddingVertical: 12,
    alignItems: "center", marginBottom: 10,
    borderWidth: 1, borderColor: BRAND[100],
  },
  angleBtnText: { color: COLORS.primary, fontSize: 13, fontWeight: "700" },

  referenceRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginBottom: 14, paddingHorizontal: 2,
  },
  referenceText: { flex: 1, fontSize: 12, color: COLORS.textLight, fontWeight: "600", lineHeight: 17 },

  // ── "AI is reading your plate" state ──
  analyzingWrap: { paddingTop: 4 },
  analyzingIconRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  analyzingIconCircle: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: BRAND[100],
    alignItems: "center", justifyContent: "center",
  },
  analyzingTitle: { fontSize: 15, fontWeight: "800", color: COLORS.textDark },
  analyzingSub: { fontSize: 12, color: COLORS.textMuted, fontWeight: "600", marginTop: 2 },

  secondaryBtn: {
    backgroundColor: BRAND[50], borderRadius: 16, paddingVertical: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: BRAND[100],
  },
  secondaryBtnText: { color: COLORS.textDark, fontSize: 15, fontWeight: "700" },

  retakeBtn: { alignItems: "center", paddingVertical: 10 },
  retakeBtnText: { color: COLORS.primary, fontSize: 13, fontWeight: "700" },

  sectionTitle: { fontSize: 11, fontWeight: "800", color: COLORS.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 },
  sectionHint: { fontSize: 12.5, color: COLORS.textMuted, fontWeight: "600", marginBottom: 14 },

  itemCard: {
    backgroundColor: COLORS.card, borderRadius: 16, padding: 14, marginBottom: 10,
    borderWidth: 1.5, borderColor: BRAND[100], ...SHADOW,
  },
  itemCardMuted: { opacity: 0.45, ...SHADOW, shadowOpacity: 0, elevation: 0, borderColor: COLORS.border },
  itemTapRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },

  checkbox: {
    width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: COLORS.border,
    alignItems: "center", justifyContent: "center", marginTop: 2,
  },
  checkboxChecked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkboxTick: { color: "#fff", fontSize: 13, fontWeight: "900" },

  itemHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 3 },
  itemName: { fontSize: 15, fontWeight: "800", color: COLORS.textDark, flex: 1, marginRight: 8 },
  confBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  confBadgeText: { fontSize: 10, fontWeight: "800" },
  itemMeta: { fontSize: 13, color: COLORS.textLight, fontWeight: "600", marginBottom: 2 },
  itemMacros: { fontSize: 11, color: COLORS.textMuted, fontWeight: "600" },
  dbBadge: { fontSize: 10, color: COLORS.success, fontWeight: "700", marginTop: 4 },
  portionBasisText: { fontSize: 11, color: COLORS.textMuted, fontStyle: "italic", marginTop: 3 },

  gramStepperRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: BRAND[100],
  },
  gramStepperLabel: { fontSize: 12, color: COLORS.textLight, fontWeight: "700", marginRight: 2 },
  gramBtn: {
    width: 32, height: 32, borderRadius: 11, backgroundColor: BRAND[100],
    alignItems: "center", justifyContent: "center",
  },
  gramBtnText: { fontSize: 17, fontWeight: "800", color: COLORS.primaryDark },
  gramValue: { fontSize: 14, fontWeight: "800", color: COLORS.textDark, minWidth: 48, textAlign: "center" },

  notesText: { fontSize: 12, color: COLORS.textMuted, fontStyle: "italic", marginBottom: 14, lineHeight: 17 },

  emptyCard: {
    backgroundColor: COLORS.card, borderRadius: 22, padding: 28, alignItems: "center",
    ...SHADOW,
  },
  emptyIconWrap: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: BRAND[50],
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: COLORS.textDark, marginBottom: 6 },
  emptySub: { fontSize: 13, color: COLORS.textMuted, textAlign: "center", marginBottom: 20, lineHeight: 19 },
});
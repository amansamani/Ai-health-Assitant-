import React, { useState, useRef, useEffect } from "react";
import { showToast } from "../../services/uiFeedback";
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
import LucideIcon from "../../components/ui/LucideIcon";
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
      showToast("Enable camera access in settings to take a photo of your meal.", { title: "Camera access needed", type: "warning" });
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
      showToast("Enable photo library access in settings to choose a meal photo.", { title: "Photo access needed", type: "warning" });
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
      showToast("Try a different photo.", { title: "Couldn't process that photo", type: "error" });
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
      showToast(
        err.response?.data?.message || "Try a clearer photo, or log this meal manually instead.",
        { title: "Couldn't analyze that photo", type: "error", duration: 4200 }
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
          source: "photo",
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
      showToast(
        `${itemsToLog.length} item${itemsToLog.length === 1 ? "" : "s"} added to ${MEAL_META[mealType].label}.`,
        { title: "Meal logged", type: "success", duration: 1800 }
      );
      setTimeout(() => {
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
      }, 450);
    } catch (err) {
      showToast("Some items may not have logged. Check your meal log and try again for any missing ones.", { title: "Something went wrong", type: "error", duration: 4200 });
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
            <LucideIcon name="camera" size={20} color={COLORS.primary} />
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
              <LucideIcon name="camera-outline" size={34} color={COLORS.primary} />
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
              <LucideIcon name="images-outline" size={16} color={COLORS.primary} style={{ marginRight: 8 }} />
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
                    <LucideIcon name="close" size={13} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {analyzing ? (
              <View style={s.analyzingWrap}>
                <View style={s.analyzingIconRow}>
                  <PulseIcon>
                    <View style={s.analyzingIconCircle}>
                      <LucideIcon name="sparkles" size={20} color={COLORS.primary} />
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
                      <LucideIcon name="add" size={15} color={COLORS.primary} style={{ marginRight: 4 }} />
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
                  <LucideIcon name="help-circle-outline" size={32} color={COLORS.textMuted} />
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
  // ============================================================
  // SCREEN
  // ============================================================
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  scroll: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 44,
  },

  // ============================================================
  // HEADER
  // ============================================================
  screenHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 22,
  },

  screenHeaderText: {
    flex: 1,
    paddingRight: 16,
  },

  eyebrow: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "800",
    color: COLORS.textMuted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 5,
  },

  screenTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    color: COLORS.textDark,
    letterSpacing: -0.7,
    marginBottom: 6,
  },

  screenSub: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.textMuted,
    fontWeight: "600",
    maxWidth: 320,
  },

  headerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: BRAND[100],
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },

  // ============================================================
  // MEAL TABS
  // ============================================================
  tabRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 22,
  },

  tab: {
    flex: 1,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },

  tabTxt: {
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: "700",
    color: COLORS.textLight,
  },

  // ============================================================
  // CAPTURE CARD
  // ============================================================
  captureCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingVertical: 28,
    alignItems: "center",
    ...SHADOW,
  },

  captureIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  captureTitle: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "800",
    color: COLORS.textDark,
    textAlign: "center",
    marginBottom: 8,
  },

  captureSub: {
    width: "100%",
    maxWidth: 310,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textMuted,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 22,
  },

  // ============================================================
  // PREVIEW / ANALYSIS CARD
  // ============================================================
  previewCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    ...SHADOW,
  },

  photoRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },

  photoThumbWrap: {
    flex: 1,
    position: "relative",
    overflow: "visible",
  },

  photoThumb: {
    width: "100%",
    height: 185,
    borderRadius: 17,
    backgroundColor: BRAND[100],
  },

  photoRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 28,
    height: 28,
    borderRadius: 12,
    backgroundColor: "rgba(15, 23, 42, 0.82)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: COLORS.card,
  },

  // ============================================================
  // ADD ANGLE
  // ============================================================
  angleBtn: {
    minHeight: 46,
    backgroundColor: BRAND[50],
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BRAND[100],
  },

  angleBtnText: {
    color: COLORS.primary,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: "800",
    textAlign: "center",
  },

  // ============================================================
  // REFERENCE OBJECT
  // ============================================================
  referenceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    marginBottom: 16,
    paddingHorizontal: 2,
  },

  referenceText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.textLight,
    fontWeight: "600",
  },

  checkbox: {
    width: 23,
    height: 23,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 0,
  },

  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  checkboxTick: {
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 15,
    fontWeight: "800",
  },

  // ============================================================
  // ANALYZING STATE
  // ============================================================
  analyzingWrap: {
    paddingTop: 4,
  },

  analyzingIconRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },

  analyzingIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: BRAND[100],
    alignItems: "center",
    justifyContent: "center",
  },

  analyzingTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    color: COLORS.textDark,
  },

  analyzingSub: {
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.textMuted,
    fontWeight: "600",
    marginTop: 3,
  },

  // ============================================================
  // SECONDARY BUTTON
  // ============================================================
  secondaryBtn: {
    minHeight: 52,
    backgroundColor: BRAND[50],
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: BRAND[100],
  },

  secondaryBtnText: {
    color: COLORS.textDark,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
  },

  // ============================================================
  // RETAKE / TEXT BUTTON
  // ============================================================
  retakeBtn: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  retakeBtnText: {
    color: COLORS.primary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },

  // ============================================================
  // SECTION HEADERS
  // ============================================================
  sectionTitle: {
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: "800",
    color: COLORS.textMuted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 5,
  },

  sectionHint: {
    fontSize: 12.5,
    lineHeight: 18,
    color: COLORS.textMuted,
    fontWeight: "600",
    marginBottom: 16,
  },

  // ============================================================
  // FOOD ITEM CARD
  // ============================================================
  itemCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BRAND[100],
    ...SHADOW,
  },

  itemCardMuted: {
    opacity: 0.48,
    shadowOpacity: 0,
    elevation: 0,
    borderColor: COLORS.border,
  },

  itemTapRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  // ============================================================
  // FOOD ITEM TEXT
  // ============================================================
  itemHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 5,
  },

  itemName: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    color: COLORS.textDark,
    marginRight: 10,
  },

  confBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9,
    alignSelf: "flex-start",
  },

  confBadgeText: {
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: "800",
  },

  itemMeta: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.textLight,
    fontWeight: "700",
    marginBottom: 3,
  },

  itemMacros: {
    fontSize: 11.5,
    lineHeight: 16,
    color: COLORS.textMuted,
    fontWeight: "600",
  },

  dbBadge: {
    fontSize: 10,
    lineHeight: 14,
    color: COLORS.success,
    fontWeight: "800",
    marginTop: 6,
  },

  portionBasisText: {
    fontSize: 11,
    lineHeight: 15,
    color: COLORS.textMuted,
    fontStyle: "italic",
    marginTop: 5,
  },

  // ============================================================
  // GRAM STEPPER
  // ============================================================
  gramStepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 14,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: BRAND[100],
  },

  gramStepperLabel: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.textLight,
    fontWeight: "800",
  },

  gramBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: BRAND[100],
    alignItems: "center",
    justifyContent: "center",
  },

  gramBtnText: {
    fontSize: 18,
    lineHeight: 21,
    fontWeight: "800",
    color: COLORS.primaryDark,
  },

  gramValue: {
    minWidth: 52,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
    color: COLORS.textDark,
    textAlign: "center",
  },

  // ============================================================
  // NOTES
  // ============================================================
  notesText: {
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.textMuted,
    fontStyle: "italic",
    marginTop: 2,
    marginBottom: 15,
  },

  // ============================================================
  // EMPTY STATE
  // ============================================================
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 30,
    alignItems: "center",
    ...SHADOW,
  },

  emptyIconWrap: {
    width: 66,
    height: 66,
    borderRadius: 20,
    backgroundColor: BRAND[50],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  emptyTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
    color: COLORS.textDark,
    textAlign: "center",
    marginBottom: 7,
  },

  emptySub: {
    maxWidth: 300,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textMuted,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 18,
  },
});

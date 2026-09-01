import { useCallback, useEffect, useMemo, useState } from "react";
import { showToast } from "../services/uiFeedback";
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import API from "../services/api";
import { COLORS } from "../constants/theme";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MUSCLES = ["all", "chest", "back", "shoulders", "biceps", "triceps", "quads", "hamstrings", "glutes", "calves", "core", "cardio"];
const TEMPLATES = [
  { key: "ppl", label: "Push / Pull / Legs", icon: "repeat-outline" },
  { key: "upper_lower", label: "Upper / Lower", icon: "body-outline" },
  { key: "full_body", label: "Full Body", icon: "fitness-outline" },
  { key: "bro_split", label: "Single Muscle", icon: "barbell-outline" },
  { key: "custom", label: "Start Empty", icon: "create-outline" },
];

const TEMPLATE_DAYS = {
  ppl: ["Push", "Pull", "Legs", "Rest", "Push", "Pull", "Rest"],
  upper_lower: ["Upper", "Lower", "Rest", "Upper", "Lower", "Rest", "Rest"],
  full_body: ["Full Body", "Full Body", "Rest", "Full Body", "Full Body", "Rest", "Rest"],
  bro_split: ["Chest", "Back", "Shoulders", "Arms", "Legs", "Core", "Rest"],
  custom: DAYS,
};

const FOCUS_MAP = {
  Push: ["chest", "shoulders", "triceps"],
  Pull: ["back", "biceps"],
  Legs: ["quads", "hamstrings", "glutes", "calves"],
  Upper: ["chest", "back", "shoulders", "biceps", "triceps"],
  Lower: ["quads", "hamstrings", "glutes", "calves"],
  Chest: ["chest"],
  Back: ["back"],
  Shoulders: ["shoulders"],
  Arms: ["biceps", "triceps"],
  Core: ["core"],
  "Full Body": ["chest", "back", "quads", "shoulders", "core"],
};

function makeEmptyDays(template) {
  return DAYS.map((_, index) => {
    const title = TEMPLATE_DAYS[template]?.[index] || DAYS[index];
    return {
      dayOfWeek: index + 1,
      title,
      focusMuscles: FOCUS_MAP[title] || [],
      isRestDay: title === "Rest",
      exercises: [],
    };
  });
}

export default function CustomWorkoutBuilderScreen() {
  const router = useRouter();
  const { planId } = useLocalSearchParams();
  const editing = Boolean(planId);

  const [name, setName] = useState(editing ? "" : "My Custom Plan");
  const [template, setTemplate] = useState("ppl");
  const [goal, setGoal] = useState("fit");
  const [mode, setMode] = useState("mixed");
  const [days, setDays] = useState(makeEmptyDays("ppl"));
  const [selectedDay, setSelectedDay] = useState(1);
  const [muscle, setMuscle] = useState("all");
  const [query, setQuery] = useState("");
  const [library, setLibrary] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const selected = days[selectedDay - 1] || days[0];
  const selectedIds = useMemo(() => new Set((selected?.exercises || []).map((item) => String(item.exerciseId))), [selected]);

  useEffect(() => {
    const load = async () => {
      try {
        if (editing) {
          const list = await API.get("/custom-workouts/plans");
          const plan = (list.data || []).find((item) => String(item._id) === String(planId));
          if (plan) {
            setName(plan.name);
            setTemplate(plan.template || "custom");
            setGoal(plan.goal || "fit");
            setMode(plan.mode || "mixed");
            setDays(plan.days || makeEmptyDays(plan.template || "custom"));
          }
        }
      } catch (error) {
        console.warn("Failed to load custom plan:", error?.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [editing, planId]);

  const loadLibrary = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (muscle !== "all") params.set("muscle", muscle);
      if (mode === "bodyweight") params.set("equipment", "bodyweight");
      if (mode === "equipment") params.set("equipment", "gym");
      params.set("limit", "100");
      const res = await API.get(`/exercises?${params.toString()}`);
      setLibrary(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.warn("Failed to load exercise library:", error?.message);
      setLibrary([]);
    }
  }, [query, muscle]);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  const applyTemplate = (nextTemplate) => {
    setTemplate(nextTemplate);
    setDays((prev) => {
      const current = [...prev];
      return current.map((day, index) => {
        const title = TEMPLATE_DAYS[nextTemplate]?.[index] || DAYS[index];
        return {
          ...day,
          title,
          focusMuscles: FOCUS_MAP[title] || [],
          isRestDay: title === "Rest",
        };
      });
    });
  };

  const toggleExercise = (exercise) => {
    if (selected?.isRestDay) return;
    setDays((prev) => prev.map((day) => {
      if (day.dayOfWeek !== selectedDay) return day;
      const exists = day.exercises.some((item) => String(item.exerciseId) === String(exercise._id));
      if (exists) {
        return { ...day, exercises: day.exercises.filter((item) => String(item.exerciseId) !== String(exercise._id)) };
      }
      if (day.exercises.length >= 12) {
        showToast("A custom workout day can contain up to 12 exercises.", { title: "Day limit reached", type: "warning" });
        return day;
      }
      return {
        ...day,
        exercises: [
          ...day.exercises,
          { exerciseId: exercise._id, sets: exercise.defaultSets || 3, reps: exercise.defaultReps || "10", restSeconds: exercise.defaultRestSeconds || 60 },
        ],
      };
    }));
  };

  const updateSelectedExercise = (exerciseId, field, value) => {
    setDays((prev) => prev.map((day) => day.dayOfWeek !== selectedDay ? day : ({
      ...day,
      exercises: day.exercises.map((entry) => String(entry.exerciseId) === String(exerciseId) ? { ...entry, [field]: value } : entry),
    })));
  };

  const removeSelectedExercise = (exerciseId) => toggleExercise({ _id: exerciseId });

  const savePlan = async () => {
    if (name.trim().length < 2) {
      showToast("Give your workout plan a name.", { title: "Plan name required", type: "warning" });
      return;
    }
    try {
      setSaving(true);
      const payload = { name: name.trim(), template, goal, mode, days, isActive: true };
      const res = editing
        ? await API.put(`/custom-workouts/plans/${planId}`, payload)
        : await API.post("/custom-workouts/plans", payload);
      await AsyncStorage.setItem("@fitlip_workout_plan_mode", "custom");
      showToast("Your custom workout plan is now active.", { title: "Plan saved", type: "success", duration: 1800 });
      setTimeout(() => router.replace("/(app)/workout"), 450);
      return res.data;
    } catch (error) {
      showToast(error?.response?.data?.message || "Please review your days and try again.", { title: "Couldn't save plan", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} style={styles.iconButton}><Ionicons name="chevron-back" size={22} color={COLORS.textDark} /></Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{editing ? "Edit Workout Plan" : "Create Your Plan"}</Text>
              <Text style={styles.subtitle}>Choose your split, days and exercises.</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>PLAN NAME</Text>
          <TextInput value={name} onChangeText={setName} placeholder="e.g. My Push Pull Legs" placeholderTextColor={COLORS.textMuted} style={styles.input} maxLength={80} />

          <Text style={styles.sectionLabel}>STARTING TEMPLATE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateRow}>
            {TEMPLATES.map((item) => (
              <Pressable key={item.key} onPress={() => applyTemplate(item.key)} style={[styles.templateChip, template === item.key && styles.templateChipActive]}>
                <Ionicons name={item.icon} size={16} color={template === item.key ? "#fff" : COLORS.textMuted} />
                <Text style={[styles.templateText, template === item.key && styles.templateTextActive]}>{item.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.inlineFields}>
            <View style={styles.inlineField}><Text style={styles.fieldLabel}>GOAL</Text><View style={styles.smallChoiceRow}>{["bulk", "lean", "fit"].map((v) => <Pressable key={v} onPress={() => setGoal(v)} style={[styles.smallChoice, goal === v && styles.smallChoiceActive]}><Text style={[styles.smallChoiceText, goal === v && styles.smallChoiceTextActive]}>{v.toUpperCase()}</Text></Pressable>)}</View></View>
            <View style={styles.inlineField}><Text style={styles.fieldLabel}>EQUIPMENT</Text><View style={styles.smallChoiceRow}>{[["bodyweight", "Bodyweight"], ["equipment", "Gym"], ["mixed", "Mixed"]].map(([v, label]) => <Pressable key={v} onPress={() => setMode(v)} style={[styles.smallChoice, mode === v && styles.smallChoiceActive]}><Text style={[styles.smallChoiceText, mode === v && styles.smallChoiceTextActive]}>{label}</Text></Pressable>)}</View></View>
          </View>

          <Text style={styles.sectionLabel}>WEEKLY SCHEDULE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
            {days.map((day) => (
              <Pressable key={day.dayOfWeek} onPress={() => setSelectedDay(day.dayOfWeek)} style={[styles.dayChip, selectedDay === day.dayOfWeek && styles.dayChipActive]}>
                <Text style={[styles.dayName, selectedDay === day.dayOfWeek && styles.dayNameActive]}>{DAYS[day.dayOfWeek - 1].slice(0, 3)}</Text>
                <Text style={[styles.dayTitle, selectedDay === day.dayOfWeek && styles.dayTitleActive]} numberOfLines={1}>{day.title}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.dayEditorHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.dayEditorTitle}>{DAYS[selectedDay - 1]}</Text>
              {!selected.isRestDay ? (
                <TextInput
                  value={selected.title}
                  onChangeText={(value) => setDays((prev) => prev.map((day) => day.dayOfWeek === selectedDay ? { ...day, title: value.slice(0, 80) } : day))}
                  style={styles.dayTitleInput}
                  placeholder="Workout title"
                  placeholderTextColor={COLORS.textMuted}
                />
              ) : <Text style={styles.dayEditorSub}>Recovery day</Text>}
              {!selected.isRestDay && <Text style={styles.dayEditorSub}>{selected.exercises.length} exercises selected</Text>}
            </View>
            <Pressable onPress={() => setDays((prev) => prev.map((day) => day.dayOfWeek === selectedDay ? { ...day, isRestDay: !day.isRestDay } : day))} style={styles.restToggle}>
              <Ionicons name={selected.isRestDay ? "bed" : "bed-outline"} size={15} color={selected.isRestDay ? "#6339B8" : COLORS.textMuted} />
              <Text style={[styles.restToggleText, selected.isRestDay && { color: "#6339B8" }]}>{selected.isRestDay ? "Rest day" : "Mark rest"}</Text>
            </Pressable>
          </View>

          {!selected.isRestDay && (
            <>
              <View style={styles.searchWrap}><Ionicons name="search" size={18} color={COLORS.textMuted} /><TextInput value={query} onChangeText={setQuery} placeholder="Search exercises" placeholderTextColor={COLORS.textMuted} style={styles.searchInput} /></View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                {MUSCLES.map((item) => <Pressable key={item} onPress={() => setMuscle(item)} style={[styles.filterChip, muscle === item && styles.filterChipActive]}><Text style={[styles.filterText, muscle === item && styles.filterTextActive]}>{item.replace("_", " ")}</Text></Pressable>)}
              </ScrollView>

              <View style={styles.libraryCard}>
                <Text style={styles.libraryTitle}>Exercise Library</Text>
                {library.map((exercise) => {
                  const active = selectedIds.has(String(exercise._id));
                  return (
                    <Pressable key={String(exercise._id)} onPress={() => toggleExercise(exercise)} style={[styles.libraryItem, active && styles.libraryItemActive]}>
                      <View style={styles.libraryIcon}><Ionicons name="barbell-outline" size={17} color={active ? "#6339B8" : COLORS.textMuted} /></View>
                      <View style={{ flex: 1 }}><Text style={styles.libraryName}>{exercise.name}</Text><Text style={styles.libraryMeta}>{exercise.primaryMuscle} · {exercise.category} · {exercise.defaultSets} × {exercise.defaultReps}</Text></View>
                      <Ionicons name={active ? "checkmark-circle" : "add-circle-outline"} size={22} color={active ? "#22C55E" : COLORS.primary} />
                    </Pressable>
                  );
                })}
                {!library.length && <Text style={styles.emptyText}>No exercises found. Try another search or muscle.</Text>}
              </View>

              {selected.exercises.length > 0 && (
                <View style={styles.selectedCard}>
                  <Text style={styles.libraryTitle}>Selected for {DAYS[selectedDay - 1]}</Text>
                  {selected.exercises.map((entry) => {
                    const ex = library.find((item) => String(item._id) === String(entry.exerciseId));
                    return (
                      <View key={String(entry.exerciseId)} style={styles.selectedItem}>
                        <View style={{ flex: 1 }}><Text style={styles.libraryName}>{ex?.name || "Exercise"}</Text><Text style={styles.libraryMeta}>{ex?.primaryMuscle || "muscle"}</Text></View>
                        <TextInput keyboardType="number-pad" value={String(entry.sets)} onChangeText={(v) => updateSelectedExercise(entry.exerciseId, "sets", v)} style={styles.tinyInput} />
                        <Text style={styles.by}>×</Text>
                        <TextInput value={String(entry.reps)} onChangeText={(v) => updateSelectedExercise(entry.exerciseId, "reps", v)} style={[styles.tinyInput, { width: 64 }]} />
                        <Pressable onPress={() => removeSelectedExercise(entry.exerciseId)} style={styles.removeButton}><Ionicons name="trash-outline" size={16} color="#DC2626" /></Pressable>
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          )}

          <Pressable onPress={savePlan} disabled={saving} style={[styles.saveButton, saving && { opacity: 0.65 }]}>
            <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={styles.saveGradient}>
              {saving ? <ActivityIndicator color="#fff" /> : <><Ionicons name="save-outline" size={19} color="#fff" /><Text style={styles.saveText}>{editing ? "Save Changes" : "Save & Activate Plan"}</Text></>}
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, paddingBottom: 50 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.background },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 22, gap: 10 },
  iconButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 25, fontWeight: "800", color: COLORS.textDark },
  subtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 3, fontWeight: "600" },
  sectionLabel: { fontSize: 11, fontWeight: "800", color: COLORS.textLight, letterSpacing: 1.2, marginTop: 16, marginBottom: 10 },
  input: { height: 52, backgroundColor: COLORS.surface, borderRadius: 16, paddingHorizontal: 16, color: COLORS.textDark, fontSize: 15, fontWeight: "700", borderWidth: 1, borderColor: COLORS.border },
  templateRow: { gap: 8, paddingBottom: 3 },
  templateChip: { minHeight: 42, paddingHorizontal: 12, borderRadius: 12, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, flexDirection: "row", alignItems: "center", gap: 6 },
  templateChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  templateText: { color: COLORS.textMuted, fontSize: 12, fontWeight: "800" },
  templateTextActive: { color: "#fff" },
  inlineFields: { marginTop: 6, gap: 12 },
  inlineField: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: COLORS.border },
  fieldLabel: { fontSize: 10, fontWeight: "800", color: COLORS.textLight, marginBottom: 8, letterSpacing: 1 },
  smallChoiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  smallChoice: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: COLORS.surfaceMuted },
  smallChoiceActive: { backgroundColor: "#EEE6FF" },
  smallChoiceText: { fontSize: 10, fontWeight: "800", color: COLORS.textMuted },
  smallChoiceTextActive: { color: COLORS.primary },
  dayRow: { gap: 8, paddingBottom: 4 },
  dayChip: { width: 82, padding: 10, borderRadius: 12, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  dayChipActive: { backgroundColor: "#6339B8", borderColor: "#6339B8" },
  dayName: { fontSize: 10, fontWeight: "800", color: COLORS.textMuted, textTransform: "uppercase" },
  dayNameActive: { color: "#DCCEFF" },
  dayTitle: { marginTop: 4, fontSize: 11, fontWeight: "800", color: COLORS.textDark },
  dayTitleActive: { color: "#fff" },
  dayEditorHeader: { marginTop: 14, padding: 14, borderRadius: 16, backgroundColor: COLORS.surface, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: COLORS.border },
  dayEditorTitle: { fontSize: 15, fontWeight: "800", color: COLORS.textDark },
  dayTitleInput: { marginTop: 4, height: 34, paddingHorizontal: 0, color: COLORS.textDark, fontSize: 12, fontWeight: "800" },
  dayEditorSub: { marginTop: 3, fontSize: 11, color: COLORS.textMuted, fontWeight: "600" },
  restToggle: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 11, backgroundColor: COLORS.surfaceMuted },
  restToggleText: { fontSize: 10, fontWeight: "800", color: COLORS.textMuted },
  searchWrap: { marginTop: 12, flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 15, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border },
  searchInput: { flex: 1, height: 46, paddingHorizontal: 8, color: COLORS.textDark, fontWeight: "600" },
  filterRow: { gap: 7, paddingVertical: 10 },
  filterChip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: COLORS.surfaceMuted },
  filterChipActive: { backgroundColor: "#EEE6FF" },
  filterText: { fontSize: 10, color: COLORS.textMuted, fontWeight: "800", textTransform: "capitalize" },
  filterTextActive: { color: COLORS.primary },
  libraryCard: { backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
  libraryTitle: { padding: 14, fontSize: 14, fontWeight: "800", color: COLORS.textDark },
  libraryItem: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  libraryItemActive: { backgroundColor: "#FBF8FF" },
  libraryIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: COLORS.surfaceMuted, alignItems: "center", justifyContent: "center" },
  libraryName: { fontSize: 13, color: COLORS.textDark, fontWeight: "800" },
  libraryMeta: { marginTop: 3, fontSize: 10, color: COLORS.textMuted, fontWeight: "600", textTransform: "capitalize" },
  emptyText: { padding: 16, color: COLORS.textMuted, fontSize: 12, fontWeight: "600", textAlign: "center" },
  selectedCard: { marginTop: 12, backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
  selectedItem: { flexDirection: "row", alignItems: "center", gap: 6, padding: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  tinyInput: { width: 44, height: 36, borderRadius: 10, backgroundColor: COLORS.surfaceMuted, textAlign: "center", color: COLORS.textDark, fontWeight: "800" },
  by: { color: COLORS.textMuted, fontWeight: "800" },
  removeButton: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#FEF2F2" },
  saveButton: { marginTop: 22, borderRadius: 16, overflow: "hidden" },
  saveGradient: { minHeight: 54, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  saveText: { color: "#fff", fontSize: 14, fontWeight: "800" },
});

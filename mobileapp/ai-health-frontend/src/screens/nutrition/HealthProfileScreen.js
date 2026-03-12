import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useContext } from "react";
import { AuthContext } from "../../context/AuthContext";
import API from "../../services/api";

export default function HealthProfileScreen({ navigation, route }) {
  const { login } = useContext(AuthContext);

  const { name, email, password } = route.params ?? {};

  if (!name || !email || !password) {
    alert("Registration data missing");
    navigation.goBack();
  }

  const [form, setForm] = useState({
    age: "",
    gender: "male",
    height: "",
    weight: "",
    activityLevel: "moderate",
    goal: "lose",
    dietType: "non-veg",
  });

  const [submitting, setSubmitting] = useState(false);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submitProfile = async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      // Step 1: Register
      console.log("1️⃣ Registering user...");
      const res = await API.post("/auth/register", { name, email, password });
      console.log("2️⃣ User created");

      const { token } = res.data;
      const authHeader = { headers: { Authorization: `Bearer ${token}` } };

      // Step 2: Save health profile (pass token manually, not stored yet)
      await API.post(
        "/health",
        {
          age: Number(form.age),
          height: Number(form.height),
          weight: Number(form.weight),
          gender: form.gender,
          activityLevel: form.activityLevel,
          goal: form.goal,
          dietType: form.dietType,
        },
        authHeader
      );
      console.log("3️⃣ Health profile saved");

      // Step 3: Generate diet plan
      await API.post("/nutrition/generate", {}, authHeader);
      console.log("4️⃣ Diet generated");

      // Step 4: Store token LAST.
      // This triggers setUserToken() in AuthContext, which causes
      // AppNavigator to re-render and swap AuthNavigator → MainNavigator.
      // The user lands on HomeScreen automatically. No navigation.replace needed.
      console.log("5️⃣ Storing token and swapping navigator...");
      await login(token);
      console.log("6️⃣ Done ✅");

    } catch (err) {
      console.log("❌ ERROR:", err.response?.data || err.message);
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* HEADER */}
      <Text style={styles.step}>Step 2 of 2</Text>
      <Text style={styles.title}>Tell us about your body</Text>
      <Text style={styles.subtitle}>
        This helps us generate your personalized diet plan
      </Text>

      {/* CARD */}
      <View style={styles.card}>

        {/* AGE */}
        <Text style={styles.label}>Age</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          placeholder="Enter age"
          value={form.age}
          onChangeText={(v) => handleChange("age", v)}
        />

        {/* HEIGHT */}
        <Text style={styles.label}>Height (cm)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          placeholder="Enter height"
          value={form.height}
          onChangeText={(v) => handleChange("height", v)}
        />

        {/* WEIGHT */}
        <Text style={styles.label}>Weight (kg)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          placeholder="Enter weight"
          value={form.weight}
          onChangeText={(v) => handleChange("weight", v)}
        />

        {/* GENDER */}
        <Text style={styles.label}>Gender</Text>
        <View style={styles.row}>
          {["male", "female"].map((g) => (
            <Pressable
              key={g}
              style={[styles.option, form.gender === g && styles.optionActive]}
              onPress={() => handleChange("gender", g)}
            >
              <Text style={[styles.optionText, form.gender === g && styles.optionTextActive]}>
                {g.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ACTIVITY */}
        <Text style={styles.label}>Activity Level</Text>
        <View style={styles.row}>
          {["sedentary", "moderate", "active"].map((a) => (
            <Pressable
              key={a}
              style={[styles.option, form.activityLevel === a && styles.optionActive]}
              onPress={() => handleChange("activityLevel", a)}
            >
              <Text style={[styles.optionText, form.activityLevel === a && styles.optionTextActive]}>
                {a}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* GOAL */}
        <Text style={styles.label}>Goal</Text>
        <View style={styles.row}>
          {["lose", "maintain", "gain"].map((g) => (
            <Pressable
              key={g}
              style={[styles.option, form.goal === g && styles.optionActive]}
              onPress={() => handleChange("goal", g)}
            >
              <Text style={[styles.optionText, form.goal === g && styles.optionTextActive]}>
                {g}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* DIET */}
        <Text style={styles.label}>Diet Type</Text>
        <View style={styles.row}>
          {["veg", "non-veg", "vegan"].map((d) => (
            <Pressable
              key={d}
              style={[styles.option, form.dietType === d && styles.optionActive]}
              onPress={() => handleChange("dietType", d)}
            >
              <Text style={[styles.optionText, form.dietType === d && styles.optionTextActive]}>
                {d}
              </Text>
            </Pressable>
          ))}
        </View>

      </View>

      {/* BUTTON */}
      <Pressable
        style={[styles.button, submitting && { opacity: 0.7 }]}
        onPress={submitProfile}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.buttonText}>Create My Plan</Text>
        )}
      </Pressable>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    padding: 20,
  },
  step: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
  },
  subtitle: {
    color: "#6B7280",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 18,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  label: {
    marginTop: 10,
    marginBottom: 6,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 10,
  },
  option: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  optionActive: {
    backgroundColor: "#4F46E5",
    borderColor: "#4F46E5",
  },
  optionText: {
    color: "#374151",
  },
  optionTextActive: {
    color: "white",
    fontWeight: "600",
  },
  button: {
    marginTop: 20,
    backgroundColor: "#4F46E5",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },
});
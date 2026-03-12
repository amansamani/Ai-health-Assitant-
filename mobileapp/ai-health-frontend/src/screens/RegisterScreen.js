import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { useState } from "react";
import { COLORS } from "../constants/theme";
import { SafeAreaView } from "react-native-safe-area-context";

export default function RegisterScreen({ navigation }) {

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [goal, setGoal] = useState("lean");
  const [error, setError] = useState("");

  const handleRegister = () => {
    if (!name || !email || !password) {
      setError("All fields are required");
      return;
    }

    const goalMap = {
      bulk: "gain",
      lean: "lose",
      fit: "maintain",
    };

    navigation.navigate("HealthProfile", {
      name,
      email,
      password,
      goal: goalMap[goal],
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Create Account</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TextInput
        placeholder="Name"
        value={name}
        onChangeText={setName}
        style={styles.input}
      />

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        style={styles.input}
      />

      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />

      {/* GOAL SELECTION */}
      <Text style={styles.label}>Fitness Goal</Text>

      <View style={styles.goalRow}>
        {["bulk", "lean", "fit"].map((g) => (
          <Pressable
            key={g}
            onPress={() => setGoal(g)}
            style={[
              styles.goalBtn,
              goal === g && styles.goalActive,
            ]}
          >
            <Text
              style={[
                styles.goalText,
                goal === g && styles.goalTextActive,
              ]}
            >
              {g.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={styles.button}
        onPress={handleRegister}
      >
        <Text style={styles.buttonText}>
          CONTINUE
        </Text>
      </Pressable>

      <Pressable onPress={() => navigation.goBack()}>
        <Text style={styles.loginText}>
          Already have an account? Login
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#fff",
  },

  title: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 20,
  },

  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },

  label: {
    marginTop: 10,
    marginBottom: 6,
    color: "#555",
    fontWeight: "500",
  },

  goalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  goalBtn: {
    borderWidth: 1,
    borderColor: "#4F46E5",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },

  goalActive: {
    backgroundColor: "#4F46E5",
  },

  goalText: {
    color: "#4F46E5",
    fontWeight: "600",
  },

  goalTextActive: {
    color: "#fff",
  },

  button: {
    backgroundColor: "#4F46E5",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },

  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  loginText: {
    marginTop: 20,
    textAlign: "center",
    color: "#4F46E5",
  },

  error: {
    color: "red",
    textAlign: "center",
    marginBottom: 10,
  },
});
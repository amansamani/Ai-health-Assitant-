import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { useState, useContext } from "react";
import API from "../services/api";
import { AuthContext } from "../context/AuthContext";
import { COLORS } from "../constants/theme";
import { SafeAreaView } from "react-native-safe-area-context";

export default function RegisterScreen({ navigation }) {
  const { login } = useContext(AuthContext);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [goal, setGoal] = useState("lean"); // default
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async () => {
    if (!name || !email || !password) {
      setError("All fields are required");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await API.post("/auth/register", {
        name,
        email,
        password,
      });

      // backend returns token → auto login
      login(res.data.token);
    } catch (err) {
  console.log("REGISTER ERROR:", err.response?.data || err.message);
  setError(JSON.stringify(err.response?.data));
}
 finally {
      setLoading(false);
    }
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
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Creating..." : "REGISTER"}
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
  },
  title: {
    fontSize: 24,
    textAlign: "center",
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
  },
  label: {
    marginTop: 10,
    marginBottom: 6,
    color: "#555",
  },
  goalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  goalBtn: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  goalActive: {
    backgroundColor: COLORS.primary,
  },
  goalText: {
    color: COLORS.primary,
    fontWeight: "bold",
  },
  goalTextActive: {
    color: "#fff",
  },
  button: {
    backgroundColor: COLORS.primary,
    padding: 14,
    borderRadius: 6,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  loginText: {
    marginTop: 20,
    textAlign: "center",
    color: COLORS.primary,
  },
  error: {
    color: "red",
    textAlign: "center",
    marginBottom: 10,
  },
});

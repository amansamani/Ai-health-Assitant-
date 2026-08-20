import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "../constants/theme";

// Matches the initials-in-a-gradient-circle pattern already used in
// ProfileScreen (avatarRing) and HomeScreen's header avatar — kept as a
// shared component here since the social screens need it in a lot of
// places (friend rows, duel cards, leaderboards).
export default function Avatar({ name, size = 40, highlight = false }) {
  const initial = (name ?? "?").trim()[0]?.toUpperCase() ?? "?";
  const fontSize = Math.round(size * 0.42);

  return (
    <LinearGradient
      colors={highlight ? ["#F97316", "#EA580C"] : [COLORS.primary, COLORS.primaryDark]}
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Text style={[styles.text, { fontSize }]}>{initial}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: "center", justifyContent: "center" },
  text: { color: "#fff", fontWeight: "800" },
});

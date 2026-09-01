import { View, Text, StyleSheet, Image } from "react-native";
import { COLORS } from "../constants/theme";

export default function Avatar({ name, size = 40, highlight = false, uri, imageSource }) {
  const initial = (name ?? "?").trim()[0]?.toUpperCase() ?? "?";
  const fontSize = Math.round(size * 0.42);

  if (uri || imageSource) {
    return (
      <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, overflow: "hidden" }]}>
        <Image
          source={imageSource || { uri }}
          style={{ width: size, height: size }}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: highlight ? COLORS.accent : COLORS.primaryDark,
        },
      ]}
    >
      <Text style={[styles.text, { fontSize }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: "center", justifyContent: "center" },
  text: { color: "#fff", fontWeight: "800" },
});

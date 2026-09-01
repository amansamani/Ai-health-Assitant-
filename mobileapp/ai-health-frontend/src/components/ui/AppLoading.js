import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { COLORS, RADIUS, TYPOGRAPHY } from "../../constants/theme";

export default function AppLoading({ label = "Loading" }) {
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.45, duration: 750, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={styles.container}>
      <Animated.View style={[styles.mark, { opacity: pulse }]}>
        <View style={styles.inner} />
      </Animated.View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center", gap: 12 },
  mark: { width: 44, height: 44, borderRadius: RADIUS.lg, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  inner: { width: 16, height: 16, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.92)" },
  label: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
});

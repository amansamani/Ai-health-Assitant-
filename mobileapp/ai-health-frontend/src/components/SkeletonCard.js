import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";
import { COLORS, SHADOW } from "../constants/theme";

export default function SkeletonCard() {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.card, { opacity }]}>
      <View style={styles.row}>
        <View style={styles.image} />
        <View style={styles.textWrap}>
          <View style={styles.lineLarge} />
          <View style={styles.lineSmall} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    ...SHADOW,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  image: {
    width: 96,
    height: 96,
    borderRadius: 12,
    backgroundColor: COLORS.border,
  },
  textWrap: {
    flex: 1,
    marginLeft: 12,
  },
  lineLarge: {
    height: 16,
    borderRadius: 6,
    backgroundColor: COLORS.border,
    marginBottom: 8,
    width: "70%",
  },
  lineSmall: {
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.border,
    width: "40%",
  },
});

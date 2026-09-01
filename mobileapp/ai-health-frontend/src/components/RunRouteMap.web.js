import React, { forwardRef, useImperativeHandle } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/theme";

const RunRouteMap = forwardRef(function RunRouteMap(
  { route = [], style },
  forwardedRef
) {
  useImperativeHandle(forwardedRef, () => ({
    animateCamera: () => {},
    animateToRegion: () => {},
    getMapRef: () => null,
  }), []);

  return (
    <View style={[styles.fallback, style]}>
      <Ionicons name="map-outline" size={30} color={COLORS.primary} />
      <Text style={styles.title}>Route preview</Text>
      <Text style={styles.sub}>
        {route.length > 1 ? `${route.length} GPS points recorded` : "GPS map is available in the mobile app"}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F6F1FA",
  },
  title: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.textDark,
  },
  sub: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.textMuted,
    textAlign: "center",
    paddingHorizontal: 18,
  },
});

export default RunRouteMap;

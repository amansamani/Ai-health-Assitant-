import { useEffect, useRef } from "react";
import { Animated } from "react-native";

// Same entrance animation already duplicated locally in a few screens
// (TrackingScreen, TrackDetailScreen) — shared here for the new social
// screens rather than adding a fourth copy.
export default function FadeSlideIn({ delay = 0, children, style }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

import { useEffect } from "react";
import { View, Pressable, StyleSheet, Platform, Image } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { COLORS } from "@/src/constants/theme";

// Floating chat-bubble entry point into the AI Coach. Lives in the tabs
// layout (above <Tabs>) so it stays put on top of every root tab screen.
//
// Two things this fixes vs. the first version:
//  1. The bubble now hides itself once the coach screen is actually the
//     active route (via usePathname) — previously it kept rendering
//     underneath/over the pushed screen, which is why it looked like the
//     logo "appeared after" the chat opened instead of disappearing before it.
//  2. Tapping now plays an expand + fade "opening" animation on the bubble
//     itself, and only pushes the coach route once that animation finishes —
//     so the sequence is bubble opens → bubble disappears → chat appears,
//     not chat appears → bubble shows up on top.
export default function AiCoachFab() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const press = useSharedValue(1);
  const pulse = useSharedValue(0);
  const expand = useSharedValue(0); // 0 = idle bubble, 1 = fully opened

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400 }),
        withTiming(0, { duration: 1400 })
      ),
      -1
    );
  }, []);

  const openCoach = () => {
    router.push("/(app)/coach");
    // Reset so the next time this mounts visible again it's a fresh bubble,
    // not the tail end of the previous expand animation.
    expand.value = 0;
    press.value = 1;
  };

  const handlePress = () => {
    if (Platform.OS === "ios") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    expand.value = withTiming(
      1,
      { duration: 260, easing: Easing.out(Easing.cubic) },
      () => runOnJS(openCoach)()
    );
  };

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value * (1 + expand.value * 5) }],
    opacity: 1 - expand.value,
  }));

  // Two concentric rings pulsing slightly out of phase reads as a soft glow
  // instead of one flat circle popping in and out.
  const outerGlowStyle = useAnimatedStyle(() => ({
    opacity: (0.18 - pulse.value * 0.14) * (1 - expand.value),
    transform: [{ scale: 1 + pulse.value * 0.45 }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: (0.28 - pulse.value * 0.18) * (1 - expand.value),
    transform: [{ scale: 1 + pulse.value * 0.22 }],
  }));

  // The coach screen is the active route — hide the bubble entirely instead
  // of letting it linger underneath/over the chat screen.
  if (pathname === "/coach") return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: insets.bottom + 88 }]}
    >
      <Animated.View style={[styles.outerGlow, outerGlowStyle]} />
      <Animated.View style={[styles.ring, ringStyle]} />
      <Pressable
        onPress={handlePress}
        onPressIn={() => {
          press.value = withSpring(0.92);
        }}
        onPressOut={() => {
          press.value = withSpring(1);
        }}
        accessibilityRole="button"
        accessibilityLabel="Open AI Coach chat"
      >
        <Animated.View style={buttonStyle}>
          <View style={styles.fab}>
            <Image
              source={require("../../assets/images/chatbot-avatar.png")}
              style={styles.avatar}
              resizeMode="contain"
              accessibilityLabel="FitLip AI Coach"
            />
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    right: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  outerGlow: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primaryLight,
  },
  ring: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(73, 34, 91, 0.08)",
    boxShadow: "0px 6px 16px rgba(73, 34, 91, 0.20)",
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
});

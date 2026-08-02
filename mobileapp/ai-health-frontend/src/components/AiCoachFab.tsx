import { useEffect } from "react";
import { View, Pressable, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { COLORS } from "@/src/constants/theme";

// Floating chat-bubble entry point into the AI Coach. Lives in the tabs
// layout (above <Tabs>) so it stays put on top of every root tab screen
// instead of being a 5th/6th tab competing for space in the bar.
export default function AiCoachFab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const press = useSharedValue(1);
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400 }),
        withTiming(0, { duration: 1400 })
      ),
      -1
    );
  }, []);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.32 - pulse.value * 0.24,
    transform: [{ scale: 1 + pulse.value * 0.3 }],
  }));

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: insets.bottom + 88 }]}
    >
      <Animated.View style={[styles.ring, ringStyle]} />
      <Pressable
        onPress={() => router.push("/(app)/coach")}
        onPressIn={() => {
          press.value = withSpring(0.92);
          if (Platform.OS === "ios") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        onPressOut={() => {
          press.value = withSpring(1);
        }}
        accessibilityRole="button"
        accessibilityLabel="Open AI Coach chat"
      >
        <Animated.View style={buttonStyle}>
          <LinearGradient
            colors={[COLORS.primaryLight, COLORS.primary, COLORS.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fab}
          >
            <Ionicons name="chatbubble-ellipses" size={26} color="#fff" />
          </LinearGradient>
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
    boxShadow: "0px 8px 20px rgba(76, 46, 150, 0.45)",
  },
});

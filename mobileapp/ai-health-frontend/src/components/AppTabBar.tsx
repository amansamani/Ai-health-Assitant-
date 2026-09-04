import { useEffect } from "react";
import { View, Pressable, StyleSheet, Platform } from "react-native";
import LucideIcon from "./ui/LucideIcon";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolateColor,
} from "react-native-reanimated";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { COLORS } from "@/src/constants/theme";

// ─── Tab config ─────────────────────────────────────────────────────────────
// Keyed by the file-based route name (app/(app)/(tabs)/<name>.tsx).
// "camera" is handled separately below — it renders as a raised, oversized
// button instead of a normal tab, since food-logging is the primary action.
type IconName = string;

const TAB_META: Record<string, { label: string; icon: IconName; iconOutline: IconName }> = {
  home:     { label: "Home",     icon: "home",          iconOutline: "home-outline" },
  workout:  { label: "Exercise", icon: "barbell",        iconOutline: "barbell-outline" },
  diet:     { label: "Diet",     icon: "nutrition",      iconOutline: "nutrition-outline" },
  tracking: { label: "Track",    icon: "footsteps-outline", iconOutline: "footsteps-outline" },
};

function TabButton({
  focused,
  meta,
  onPress,
  onLongPress,
  accessibilityLabel,
}: {
  focused: boolean;
  meta: { label: string; icon: IconName; iconOutline: IconName };
  onPress: () => void;
  onLongPress: () => void;
  accessibilityLabel: string;
}) {
  const progress = useSharedValue(focused ? 1 : 0);
  const press = useSharedValue(1);

  useEffect(() => {
    progress.value = focused
      ? withSpring(1, { damping: 17, stiffness: 240, mass: 0.65 })
      : withTiming(0, { duration: 150 });
  }, [focused]);

  const chipStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [COLORS.surfaceMuted, COLORS.primary]
    ),
    transform: [
      { scale: press.value },
      { translateY: progress.value * -2 },
    ],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + progress.value * 0.45,
  }));

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => {
        press.value = withTiming(0.9, { duration: 90 });
        if (Platform.OS === "ios") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      onPressOut={() => {
        press.value = withTiming(1, { duration: 120 });
      }}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={accessibilityLabel}
      style={styles.tabButton}
    >
      <Animated.View style={[styles.chip, chipStyle]}>
        <LucideIcon
          name={focused ? meta.icon : meta.iconOutline}
          size={20}
          color={focused ? COLORS.onPrimary : COLORS.textMuted}
        />
      </Animated.View>
      <Animated.Text
        numberOfLines={1}
        style={[styles.label, labelStyle, { color: focused ? COLORS.primary : COLORS.textMuted }]}
      >
        {meta.label}
      </Animated.Text>
    </Pressable>
  );
}

// ─── Camera tab — raised, oversized center button ──────────────────────────
function CameraTabButton({
  focused,
  onPress,
  onLongPress,
}: {
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const press = useSharedValue(1);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value }],
  }));

  return (
    <View style={styles.cameraSlot}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={() => {
          press.value = withTiming(0.92, { duration: 90 });
          if (Platform.OS === "ios") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }}
        onPressOut={() => {
          press.value = withTiming(1, { duration: 120 });
        }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel="Log meal with camera"
      >
        <Animated.View style={[styles.cameraButton, buttonStyle]}>
          <View style={styles.cameraGradient}>
            <LucideIcon name="camera" size={24} color="#fff" />
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

export default function AppTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: "tabLongPress", target: route.key });
          };

          if (route.name === "camera") {
            return (
              <CameraTabButton
                key={route.key}
                focused={focused}
                onPress={onPress}
                onLongPress={onLongPress}
              />
            );
          }

          const meta = TAB_META[route.name] ?? {
            label: options.title ?? route.name,
            icon: "ellipse" as IconName,
            iconOutline: "ellipse-outline" as IconName,
          };

          return (
            <TabButton
              key={route.key}
              focused={focused}
              meta={meta}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityLabel={`${meta.label} tab`}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSubtle,
    paddingTop: 6,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    gap: 4,
  },
  chip: {
    width: 44,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 0.1,
  },

  // Camera — raised above the bar line, bigger than the other tab chips.
  cameraSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  cameraButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    marginTop: -22,
    borderWidth: 4,
    borderColor: COLORS.background,
    overflow: "visible",
    boxShadow: "0px 5px 14px rgba(73, 34, 91, 0.22)",
  },
  cameraGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    // The outer cameraButton keeps the border/halo visible. Give the actual
    // purple fill its own inner radius so it cannot render with square corners.
    borderRadius: 12,
  },
});

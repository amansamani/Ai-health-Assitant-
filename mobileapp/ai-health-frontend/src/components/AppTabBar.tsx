import { useEffect } from "react";
import { View, Pressable, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { COLORS } from "@/src/constants/theme";

// ─── Tab config ─────────────────────────────────────────────────────────────
// Keyed by the file-based route name (app/(app)/(tabs)/<name>.tsx).
type IconName = keyof typeof Ionicons.glyphMap;

const TAB_META: Record<string, { label: string; icon: IconName; iconOutline: IconName }> = {
  home:    { label: "Home",    icon: "home",               iconOutline: "home-outline" },
  diet:    { label: "Diet",    icon: "nutrition",           iconOutline: "nutrition-outline" },
  tracking:{ label: "Track",   icon: "bar-chart",           iconOutline: "bar-chart-outline" },
  coach:   { label: "AI Coach",icon: "sparkles",            iconOutline: "sparkles-outline" },
  profile: { label: "Profile", icon: "person",              iconOutline: "person-outline" },
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
    progress.value = withSpring(focused ? 1 : 0, { damping: 16, stiffness: 220 });
  }, [focused]);

  const chipStyle = useAnimatedStyle(() => ({
    backgroundColor: focused ? COLORS.primary : "transparent",
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
        <Ionicons
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

export default function AppTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const meta = TAB_META[route.name] ?? {
            label: options.title ?? route.name,
            icon: "ellipse" as IconName,
            iconOutline: "ellipse-outline" as IconName,
          };

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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    boxShadow: "0px -6px 24px rgba(23, 15, 54, 0.10)",
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
    width: 46,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
});

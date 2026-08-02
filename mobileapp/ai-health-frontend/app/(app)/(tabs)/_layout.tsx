import { View } from "react-native";
import { Tabs } from "expo-router";
import AppTabBar from "@/src/components/AppTabBar";
import AiCoachFab from "@/src/components/AiCoachFab";

// Persistent bottom-tab shell for the 5 top-level app sections: Home,
// Exercise, Camera (food logging — raised center button), Diet, Track.
// Profile now lives behind the avatar in the Home header (top-right) and
// AI Coach is a floating chat bubble (AiCoachFab) rather than a tab, so
// both were promoted out of this group. Everything else (meal logger,
// workout detail, water tracking, weekly summary, edit health profile,
// profile, coach, etc.) lives one level up as Stack screens pushed on top
// of this group, so the tab bar only ever shows on these 5 root screens.
export default function TabsLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <AppTabBar {...props} />}
      >
        <Tabs.Screen name="home" options={{ title: "Home" }} />
        <Tabs.Screen name="workout" options={{ title: "Exercise" }} />
        <Tabs.Screen name="camera" options={{ title: "Camera" }} />
        <Tabs.Screen name="diet" options={{ title: "Diet" }} />
        <Tabs.Screen name="tracking" options={{ title: "Track" }} />
      </Tabs>

      {/* Floats above the tab bar on every root tab screen. */}
      <AiCoachFab />
    </View>
  );
}

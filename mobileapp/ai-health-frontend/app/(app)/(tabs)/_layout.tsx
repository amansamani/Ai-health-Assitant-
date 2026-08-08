import { Tabs } from "expo-router";
import AppTabBar from "@/src/components/AppTabBar";

// Persistent bottom-tab shell for the 5 top-level app sections: Home,
// Exercise, Camera (food logging — raised center button), Diet, Track.
// Profile lives behind the avatar in the Home header (top-right). AI Coach
// is a floating chat bubble, but it's rendered inside HomeScreen itself
// (not here) so it only ever appears on the Home tab, not on every screen.
// Everything else (meal logger, workout detail, water tracking, weekly
// summary, edit health profile, profile, coach, etc.) lives one level up as
// Stack screens pushed on top of this group.
export default function TabsLayout() {
  return (
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
  );
}

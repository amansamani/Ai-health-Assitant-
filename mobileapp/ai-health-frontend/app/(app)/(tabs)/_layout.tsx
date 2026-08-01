import { Tabs } from "expo-router";
import AppTabBar from "@/src/components/AppTabBar";

// Persistent bottom-tab shell for the 5 top-level app sections. Everything
// else (meal logger, workout detail, water tracking, weekly summary, edit
// health profile, etc.) lives one level up as Stack screens pushed on top of
// this group, so the tab bar only ever shows on these 5 root screens.
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <AppTabBar {...props} />}
    >
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="diet" options={{ title: "Diet" }} />
      <Tabs.Screen name="tracking" options={{ title: "Track" }} />
      <Tabs.Screen name="coach" options={{ title: "AI Coach" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}

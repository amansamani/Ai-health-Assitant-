// app/(app)/(tabs)/_layout.tsx
import { View } from "react-native";
import { Tabs, usePathname } from "expo-router";
import AppTabBar from "@/src/components/AppTabBar";
import AiCoachFab from "@/src/components/AiCoachFab";

export default function TabsLayout() {
  // Current route, e.g. "/(app)/(tabs)/home"
  const pathname = usePathname();
  const isHome = pathname.endsWith("/home");

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

      {/* ✅ Floating AI Coach button — Home tab ONLY */}
      {isHome && <AiCoachFab />}
    </View>
  );
}
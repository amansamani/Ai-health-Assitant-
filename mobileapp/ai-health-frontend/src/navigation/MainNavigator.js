import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "../screens/HomeScreen";
import ProfileScreen from "../screens/ProfileScreen";
import WorkoutScreen from "../screens/WorkoutScreen";
import TrackingScreen from "../screens/TrackingScreen";
import WeeklySummaryScreen from "../screens/WeeklySummaryScreen";
import TrackDetailScreen from "../screens/TrackDetailScreen";
import WorkoutDetailScreen from "../screens/WorkoutDetailScreen";
import NutritionDashboardScreen from "../screens/nutrition/NutritionDashboardScreen";
import LogMealScreen from "../screens/nutrition/LogMealScreen";
import ProgressScreen from "../screens/nutrition/ProgressScreen";
// ❌ REMOVED: HealthProfileScreen does not belong in MainNavigator.
// It is part of the onboarding flow and lives in AuthNavigator only.
// Having it in both navigators caused React Navigation to display it
// instead of HomeScreen when MainNavigator first mounted.

const Stack = createNativeStackNavigator();

export default function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Workout" component={WorkoutScreen} />
      <Stack.Screen name="Tracking" component={TrackingScreen} />
      <Stack.Screen name="WeeklySummary" component={WeeklySummaryScreen} />
      <Stack.Screen name="TrackDetail" component={TrackDetailScreen} />
      <Stack.Screen
        name="WorkoutDetail"
        component={WorkoutDetailScreen}
        options={{
          animation: "slide_from_right",
          animationDuration: 180,
        }}
      />
      <Stack.Screen
        name="NutritionDashboard"
        component={NutritionDashboardScreen}
        options={{ title: "My Nutrition Plan" }}
      />
      <Stack.Screen
        name="LogMeal"
        component={LogMealScreen}
        options={{ title: "Log Today's Meals" }}
      />
      <Stack.Screen
        name="Progress"
        component={ProgressScreen}
        options={{ title: "Progress" }}
      />
    </Stack.Navigator>
  );
}
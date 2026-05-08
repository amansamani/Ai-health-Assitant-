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
import MealLoggerScreen from "../screens/nutrition/MealLoggerScreen";
import EditHealthProfileScreen from "../screens/Edithealthprofilescreen";
const Stack = createNativeStackNavigator();

export default function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home"            component={HomeScreen} />
      <Stack.Screen name="Profile"         component={ProfileScreen} />
      <Stack.Screen name="Workout"         component={WorkoutScreen} />
      <Stack.Screen name="Tracking"        component={TrackingScreen} />
      <Stack.Screen name="WeeklySummary"   component={WeeklySummaryScreen} />
      <Stack.Screen name="TrackDetail"     component={TrackDetailScreen} />
      <Stack.Screen
        name="WorkoutDetail"
        component={WorkoutDetailScreen}
        options={{ animation: "slide_from_right", animationDuration: 180 }}
      />
      {/* ── Nutrition Plan (AI generated diet plan — existing) ── */}
      <Stack.Screen
        name="NutritionDashboard"
        component={NutritionDashboardScreen}
        options={{ title: "My Nutrition Plan" }}
      />
      {/* ── Meal Logger (Today's log + calorie ring — NEW) ── */}
      <Stack.Screen
        name="MealLogger"
        component={MealLoggerScreen}
        options={{ headerShown: true, title: "Log Meal", headerBackTitle: "Home" }}
      />
      {/* ── Add Food (search & add food — opened from MealLogger) ── */}
      <Stack.Screen
        name="LogMeal"
        component={LogMealScreen}
        options={{ headerShown: true, title: "Add Food", headerBackTitle: "Log Meal" }}
      />
      <Stack.Screen
        name="Progress"
        component={ProgressScreen}
        options={{ title: "Progress" }}
      />
      <Stack.Screen name="EditHealthProfile" component={EditHealthProfileScreen} />
    </Stack.Navigator>
    
  );
}
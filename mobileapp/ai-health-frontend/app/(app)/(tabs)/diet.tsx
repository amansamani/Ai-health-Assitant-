import { useLegacyNav } from "@/src/navigation/legacyAdapter";
import Screen from "@/src/screens/nutrition/NutritionDashboardScreen";

export default function Route() {
  const { navigation } = useLegacyNav();
  return <Screen navigation={navigation} />;
}

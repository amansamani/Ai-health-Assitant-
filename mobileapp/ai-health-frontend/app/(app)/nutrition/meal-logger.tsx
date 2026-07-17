import { useLegacyNav } from "@/src/navigation/legacyAdapter";
import Screen from "@/src/screens/nutrition/MealLoggerScreen";

export default function Route() {
  const { navigation } = useLegacyNav();
  return <Screen navigation={navigation} />;
}

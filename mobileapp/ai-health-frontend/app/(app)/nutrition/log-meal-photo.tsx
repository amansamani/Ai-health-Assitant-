import { useLegacyNav } from "@/src/navigation/legacyAdapter";
import Screen from "@/src/screens/nutrition/LogMealPhotoScreen";

export default function Route() {
  const { navigation, route } = useLegacyNav();
  return <Screen navigation={navigation} route={route} />;
}

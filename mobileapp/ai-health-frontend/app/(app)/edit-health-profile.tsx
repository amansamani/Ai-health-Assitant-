import { useLegacyNav } from "@/src/navigation/legacyAdapter";
import Screen from "@/src/screens/EditHealthProfileScreen";

export default function Route() {
  const { navigation } = useLegacyNav();
  return <Screen navigation={navigation} />;
}

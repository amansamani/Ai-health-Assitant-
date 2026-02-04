import { View, ActivityIndicator } from "react-native";
import { useContext } from "react";
import { AuthProvider, AuthContext } from "../src/context/AuthContext";
import AuthNavigator from "../src/navigation/AuthNavigator";
import AppNavigator from "../src/navigation/AppNavigator";

function RootNavigator() {
  const { userToken, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return userToken ? <AppNavigator /> : <AuthNavigator />;
}

export default function Page() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

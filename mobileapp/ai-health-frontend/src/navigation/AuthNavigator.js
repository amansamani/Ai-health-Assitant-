import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LoginScreen from "../screens/LoginScreen";
import ForgotPassword from "../screens/ForgotPassword";
import RegisterScreen from "../screens/RegisterScreen";
import HealthProfileScreen from "../screens/nutrition/HealthProfileScreen";
import VerifyOtp from "../screens/VerifyOtp";     
import ResetPassword from "../screens/ResetPassword"; 
const Stack = createNativeStackNavigator();

export default function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
      <Stack.Screen name="VerifyOtp" component={VerifyOtp} />  
      <Stack.Screen name="ResetPassword" component={ResetPassword} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="HealthProfile" component={HealthProfileScreen} />
    </Stack.Navigator>
  );
}

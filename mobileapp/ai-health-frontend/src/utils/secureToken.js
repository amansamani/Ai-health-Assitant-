import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

// JWT lives in SecureStore now (Keychain on iOS, Keystore-backed on Android)
// instead of AsyncStorage, which is plain unencrypted storage — readable by
// anything with filesystem access on a rooted/jailbroken device.
const TOKEN_KEY = "token";

export async function getToken() {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) return token;

  // One-time migration for anyone who already had a token saved in
  // AsyncStorage from before this change — move it over instead of
  // silently logging them out on update.
  const legacyToken = await AsyncStorage.getItem(TOKEN_KEY);
  if (legacyToken) {
    await SecureStore.setItemAsync(TOKEN_KEY, legacyToken);
    await AsyncStorage.removeItem(TOKEN_KEY);
    return legacyToken;
  }

  return null;
}

export async function setToken(token) {
  return SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function removeToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await AsyncStorage.removeItem(TOKEN_KEY); // clean up any legacy leftover too
}
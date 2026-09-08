import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "token";
const REFRESH_TOKEN_KEY = "refresh_token";
const DEVICE_ID_KEY = "fitlip_device_id";
const PENDING_ACCESS_KEY = "pending_access_token";
const PENDING_REFRESH_KEY = "pending_refresh_token";

export async function getToken() {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) return token;

  const legacyToken = await AsyncStorage.getItem(TOKEN_KEY);
  if (legacyToken) {
    await SecureStore.setItemAsync(TOKEN_KEY, legacyToken);
    await AsyncStorage.removeItem(TOKEN_KEY);
    return legacyToken;
  }

  return null;
}

export async function setToken(token) {
  if (!token) throw new Error("Cannot store an empty access token");
  return SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function setRefreshToken(token) {
  if (!token) throw new Error("Cannot store an empty refresh token");
  return SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export async function removeToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function getDeviceId() {
  let deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = Crypto.randomUUID();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

export async function setPendingSession(accessToken, refreshToken) {
  await SecureStore.setItemAsync(PENDING_ACCESS_KEY, accessToken || "");
  await SecureStore.setItemAsync(PENDING_REFRESH_KEY, refreshToken || "");
}

export async function getPendingSession() {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(PENDING_ACCESS_KEY),
    SecureStore.getItemAsync(PENDING_REFRESH_KEY),
  ]);
  return { accessToken, refreshToken };
}

export async function clearPendingSession() {
  await Promise.all([
    SecureStore.deleteItemAsync(PENDING_ACCESS_KEY),
    SecureStore.deleteItemAsync(PENDING_REFRESH_KEY),
  ]);
}

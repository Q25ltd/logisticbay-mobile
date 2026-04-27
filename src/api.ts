import axios from "axios";
import * as SecureStore from "expo-secure-store";

// ─────────────────────────────────────────────────────────────────────────────
// Config — update this to your Mac's IP when on a different network
// ─────────────────────────────────────────────────────────────────────────────

export const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://api-production-cdc9.up.railway.app";

// ─────────────────────────────────────────────────────────────────────────────
// Token storage
// ─────────────────────────────────────────────────────────────────────────────

export async function saveTokens(accessToken: string, refreshToken: string) {
  await SecureStore.setItemAsync("accessToken", accessToken);
  await SecureStore.setItemAsync("refreshToken", refreshToken);
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync("accessToken");
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync("refreshToken");
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync("accessToken");
  await SecureStore.deleteItemAsync("refreshToken");
}

// ─────────────────────────────────────────────────────────────────────────────
// Axios instance
// ─────────────────────────────────────────────────────────────────────────────

export const api = axios.create({ baseURL: API_URL });

// Attach token to every request
api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = await getRefreshToken();
        const res = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const newToken = res.data.accessToken;
        await saveTokens(newToken, refreshToken!);
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        await clearTokens();
      }
    }
    return Promise.reject(error);
  }
);

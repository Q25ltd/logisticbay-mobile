import React, { createContext, useContext, useState, useEffect } from "react";
import { api, saveTokens, clearTokens, getAccessToken } from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface User {
  id:          number;
  name:        string;
  email:       string;
  role:        string;
  companyId:   number;
  companyName: string;
}

interface CompanyOption {
  companyId:   number;
  companyName: string;
  role:        string;
}

interface LoginResult {
  requiresCompanySelection: true;
  companies: CompanyOption[];
  user: { id: number; name: string; email: string };
}

interface AuthContextType {
  user:           User | null;
  loading:        boolean;
  mustChangePin:  boolean;
  login:              (email: string, password: string, companyId?: number) => Promise<boolean | LoginResult>;
  logout:             () => Promise<void>;
  clearMustChangePin: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]             = useState<User | null>(null);
  const [loading, setLoading]       = useState(true);
  const [mustChangePin, setMustChangePin] = useState(false);

  // Check for existing session on app start
  useEffect(() => {
    (async () => {
      try {
        const token = await getAccessToken();
        if (token) {
          const res = await api.get("/auth/me");
          setUser(res.data);
        }
      } catch {
        await clearTokens();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function login(email: string, password: string, companyId?: number): Promise<boolean | { requiresCompanySelection: true; companies: Array<{ companyId: number; companyName: string; role: string }>; user: { id: number; name: string; email: string } }> {
    const res = await api.post("/auth/login", { email, password, ...(companyId ? { companyId } : {}) });
    if (res.data.requiresCompanySelection) return res.data;
    await saveTokens(res.data.accessToken, res.data.refreshToken);
    setUser(res.data.user);
    const pinChange = res.data.mustChangePin === true;
    setMustChangePin(pinChange);
    return pinChange;
  }

  async function logout() {
    await clearTokens();
    await AsyncStorage.removeItem("shiftDraft");
    setUser(null);
    setMustChangePin(false);
  }

  return (
    <AuthContext.Provider value={{ user, loading, mustChangePin, login, logout, clearMustChangePin: () => setMustChangePin(false) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

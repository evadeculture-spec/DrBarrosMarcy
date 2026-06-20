"use client";

/**
 * Sessão mock para o MVP.
 *
 * SECURITY: substituir por Supabase Auth ou Clerk antes de produção.
 * A persistência usa localStorage apenas para simular "estar autenticado"
 * entre navegações — não é segurança real.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { CURRENT_USER_ID, getUser, users } from "@/data/users";
import type { User } from "@/types";

const STORAGE_KEY = "solicitaflow.session";

interface SessionContextValue {
  user: User | null;
  isAuthenticated: boolean;
  login: (userId?: string) => void;
  logout: () => void;
  switchUser: (userId: string) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) setUserId(stored);
    setReady(true);
  }, []);

  const login = useCallback((id: string = CURRENT_USER_ID) => {
    setUserId(id);
    window.localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const logout = useCallback(() => {
    setUserId(null);
    window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  const switchUser = useCallback((id: string) => {
    setUserId(id);
    window.localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const value = useMemo<SessionContextValue>(() => {
    const user = userId ? getUser(userId) ?? null : null;
    return {
      user,
      isAuthenticated: Boolean(user),
      login,
      logout,
      switchUser,
    };
  }, [userId, login, logout, switchUser]);

  // Evita flash de conteúdo antes de ler o localStorage.
  if (!ready) return null;

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession deve ser usado dentro de SessionProvider");
  return ctx;
}

export { users };

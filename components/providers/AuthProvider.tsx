"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@/lib/types";

/** Cuando un administrador está viendo la plataforma como este usuario. `null` = sesión normal. */
export interface Suplantacion {
  admin_id: string;
  admin_email: string | null;
}

interface AuthContextValue {
  user: User | null;
  /**
   * ⚠️ Si NO es `null`, el `user` de arriba **no es quien está delante de la pantalla**:
   * es la persona a la que un administrador está mirando. Toda la aplicación debe
   * comportarse como si fuera ese usuario —esa es la función— pero la interfaz tiene que
   * decirlo bien claro, o se acaba escribiendo algo en la cuenta de un cliente sin querer.
   */
  suplantacion: Suplantacion | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, meta?: { first_name?: string; last_name?: string }) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [suplantacion, setSuplantacion] = useState<Suplantacion | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setSuplantacion(data.suplantacion ?? null);
      } else {
        setUser(null);
        setSuplantacion(null);
      }
    } catch {
      setUser(null);
      setSuplantacion(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al iniciar sesión");
    setUser(data.user);
  }, []);

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      meta?: { first_name?: string; last_name?: string }
    ) => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, ...meta }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al registrarse");
    },
    []
  );

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    window.location.href = "/";
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al enviar correo");
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        suplantacion,
        isLoading,
        signIn,
        signUp,
        signOut,
        resetPassword,
        refreshUser: fetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

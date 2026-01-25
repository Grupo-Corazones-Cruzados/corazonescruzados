"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabaseClient";
import type { User, Session } from "@supabase/supabase-js";

export interface UserProfile {
  id: string;
  nombre: string | null;
  apellido: string | null;
  avatar_url: string | null;
  telefono: string | null;
  rol: "cliente" | "miembro" | "admin";
  id_miembro: number | null;
  verificado: boolean;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    loading: true,
    error: null,
  });

  // Cargar perfil del usuario
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error al cargar perfil:", error);
        return null;
      }

      return data as UserProfile | null;
    } catch (err) {
      console.error("Error inesperado al cargar perfil:", err);
      return null;
    }
  }, []);

  // Inicializar y escuchar cambios de auth
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        // Obtener sesión actual
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (session?.user && mounted) {
          const profile = await fetchProfile(session.user.id);
          setState({
            user: session.user,
            session,
            profile,
            loading: false,
            error: null,
          });
        } else if (mounted) {
          setState({
            user: null,
            session: null,
            profile: null,
            loading: false,
            error: null,
          });
        }
      } catch (err: any) {
        if (mounted) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: err?.message || "Error de autenticación",
          }));
        }
      }
    };

    initAuth();

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (event === "SIGNED_IN" && session?.user) {
          const profile = await fetchProfile(session.user.id);
          setState({
            user: session.user,
            session,
            profile,
            loading: false,
            error: null,
          });
        } else if (event === "SIGNED_OUT") {
          setState({
            user: null,
            session: null,
            profile: null,
            loading: false,
            error: null,
          });
        } else if (event === "TOKEN_REFRESHED" && session?.user) {
          setState((prev) => ({
            ...prev,
            session,
            user: session.user,
          }));
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // Registrar usuario
  const signUp = async (
    email: string,
    password: string,
    metadata?: { nombre?: string; apellido?: string }
  ) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
        },
      });

      if (error) throw error;

      return { success: true, data };
    } catch (err: any) {
      const errorMsg = err?.message || "Error al registrarse";
      setState((prev) => ({ ...prev, loading: false, error: errorMsg }));
      return { success: false, error: errorMsg };
    }
  };

  // Iniciar sesión
  const signIn = async (email: string, password: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      return { success: true, data };
    } catch (err: any) {
      const errorMsg = err?.message || "Error al iniciar sesión";
      setState((prev) => ({ ...prev, loading: false, error: errorMsg }));
      return { success: false, error: errorMsg };
    }
  };

  // Cerrar sesión
  const signOut = async () => {
    setState((prev) => ({ ...prev, loading: true }));

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setState({
        user: null,
        session: null,
        profile: null,
        loading: false,
        error: null,
      });

      return { success: true };
    } catch (err: any) {
      setState((prev) => ({ ...prev, loading: false, error: err?.message }));
      return { success: false, error: err?.message };
    }
  };

  // Recuperar contraseña
  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset`,
      });

      if (error) throw error;

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  };

  // Actualizar perfil
  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!state.user) return { success: false, error: "No autenticado" };

    try {
      const { error } = await supabase
        .from("user_profiles")
        .update(updates)
        .eq("id", state.user.id);

      if (error) throw error;

      // Refrescar perfil
      const profile = await fetchProfile(state.user.id);
      setState((prev) => ({ ...prev, profile }));

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  };

  return {
    ...state,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updateProfile,
    isAuthenticated: !!state.user,
  };
}

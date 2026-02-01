"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";

export default function MiembroPage() {
  const router = useRouter();
  const { profile, isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        router.push("/auth");
      } else if (profile?.rol !== "miembro" && profile?.rol !== "admin") {
        // Only clients are redirected away - members and admins can access Mi Espacio
        router.push("/dashboard");
      } else {
        // Redirect to mis-acciones by default
        router.push("/dashboard/mis-acciones");
      }
    }
  }, [loading, isAuthenticated, profile, router]);

  return (
    <DashboardLayout>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "300px",
        color: "var(--text-muted)"
      }}>
        <p>Redirigiendo...</p>
      </div>
    </DashboardLayout>
  );
}

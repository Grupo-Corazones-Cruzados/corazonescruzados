"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { useToast } from "@/components/ui/Toast";
import Spinner from "@/components/ui/Spinner";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const phoneToastShown = useRef(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/auth");
    }
  }, [isLoading, user, router]);

  // Phone gate: members without phone get redirected to settings
  useEffect(() => {
    if (isLoading || !user) return;
    if (
      user.role === "member" &&
      !user.phone &&
      !pathname.startsWith("/dashboard/settings")
    ) {
      router.replace("/dashboard/settings");
      if (!phoneToastShown.current) {
        phoneToastShown.current = true;
        toast("Debes agregar tu número de teléfono para continuar", "warning");
      }
    }
  }, [isLoading, user, pathname, router, toast]);

  if (isLoading) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        background: "var(--bg-secondary)",
      }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function EncuadrePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/proyecto/reclutamiento");
  }, [router]);

  return null;
}

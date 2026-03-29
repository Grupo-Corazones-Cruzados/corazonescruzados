"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import BrandLoader from "@/components/ui/BrandLoader";

function VerifyContent() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Token no proporcionado.");
      return;
    }

    fetch(`/api/auth/verify?token=${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setStatus("success");
          setMessage(data.message);
          setTimeout(() => router.push("/dashboard"), 2000);
        } else {
          setStatus("error");
          setMessage(data.error);
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Error de conexion.");
      });
  }, [token, router]);

  const pixelFont = { fontFamily: "'Silkscreen', cursive" } as const;

  return (
    <div className="pixel-card text-center">
      {status === "loading" && (
        <BrandLoader size="lg" label="Verificando tu cuenta..." />
      )}

      {status === "success" && (
        <>
          <div className="text-4xl mb-4 text-green-400" style={pixelFont}>OK</div>
          <h2 className="pixel-heading text-base text-white mb-2">
            Cuenta Verificada
          </h2>
          <p className="text-xs opacity-50" style={{ ...pixelFont, color: "#94A3B8" }}>
            {message}
          </p>
          <p className="text-[10px] mt-4 opacity-30" style={{ ...pixelFont, color: "#7B5FBF" }}>
            Redirigiendo al dashboard...
          </p>
        </>
      )}

      {status === "error" && (
        <>
          <div className="text-4xl mb-4 text-red-400" style={pixelFont}>ERR</div>
          <h2 className="pixel-heading text-base text-white mb-2">
            Error de Verificacion
          </h2>
          <p className="text-xs opacity-50 mb-6" style={{ ...pixelFont, color: "#94A3B8" }}>
            {message}
          </p>
          <Link href="/auth">
            <button className="pixel-btn pixel-btn-primary">
              Volver al Inicio
            </button>
          </Link>
        </>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <BrandLoader size="lg" />
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}

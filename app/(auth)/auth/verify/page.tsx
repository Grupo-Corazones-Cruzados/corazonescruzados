"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { PANEL_AUTH, TITULO_AUTH, TEXTO_AUTH } from "@/components/landing/authEstilos";
import { dentroDeUnaApp } from "@/lib/sitio/appDeTelefono";

/**
 * El correo se abre en Safari aunque la cuenta se haya creado en la app (Fernando, 2026-11-13): en un iPhone, fuera
 * de la app, en vez de entrar a la web se ofrece volver a GCC World (`gccworld://`, el esquema de la app de iPhone)
 * para iniciar sesión allí; «Seguir en la web» queda debajo por si no la tiene instalada.
 */
const enIphoneFueraDeLaApp = () =>
  typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent) && !dentroDeUnaApp();

/**
 * CONFIRMAR EL CORREO — la página del enlace que llega al crear la cuenta. Con el aspecto del
 * diálogo de acceso (ver `app/(auth)/layout.tsx`).
 */
function VerifyContent() {
  const params = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [volverALaApp, setVolverALaApp] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("El enlace no trae el código de confirmación. Ábrelo de nuevo desde el correo.");
      return;
    }

    fetch(`/api/auth/verify?token=${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setStatus("success");
          setMessage(data.message);
          // Tres segundos con la confirmación a la vista y el aviso de a dónde va (Fernando,
          // 2026-09-21): antes saltaba a los dos segundos y, para un cliente, /dashboard
          // era una pantalla intermedia en negro que a su vez lo mandaba al marketplace.
          // El cliente va DIRECTO al marketplace, que es su primera pantalla.
          const destino = data.role === "client" ? "/dashboard/marketplace" : "/dashboard";
          if (enIphoneFueraDeLaApp()) { setVolverALaApp(destino); return; }
          setTimeout(() => { window.location.href = destino; }, 3000);
        } else {
          setStatus("error");
          setMessage(data.error);
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("No hay conexión. Vuelve a intentarlo en un momento.");
      });
  }, [token]);

  return (
    <div style={PANEL_AUTH}>
      {status === "loading" && <Esperando texto="Confirmando tu correo…" />}

      {status === "success" && (
        <>
          <h1 style={TITULO_AUTH} className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" /> Correo confirmado
          </h1>
          <p style={TEXTO_AUTH}>{message}</p>
          {volverALaApp ? (
            <>
              <p style={TEXTO_AUTH}>Vuelve a la app GCC World e inicia sesión con tu correo y tu contraseña.</p>
              <a href="gccworld://" className="pixel-btn pixel-btn-primary w-full flex items-center justify-center">Abrir la app GCC World</a>
              <a href={volverALaApp} className="block text-center text-[0.84rem] text-digi-muted hover:text-digi-text" style={{ fontFamily: "var(--font-body)" }}>Seguir en la web</a>
            </>
          ) : (
            <Esperando texto="Entrando a la plataforma…" />
          )}
        </>
      )}

      {status === "error" && (
        <>
          <h1 style={TITULO_AUTH} className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-400 shrink-0" /> No se pudo confirmar
          </h1>
          <p style={TEXTO_AUTH}>{message}</p>
          <a href="/auth" className="pixel-btn pixel-btn-primary w-full flex items-center justify-center">Ir a iniciar sesión</a>
        </>
      )}
    </div>
  );
}

/** Un anillo en el acento y el texto, como el «Preparando tu panel» de la carga. */
function Esperando({ texto }: { texto: string }) {
  return (
    <div className="flex items-center gap-2.5 text-[0.84rem] text-digi-muted" style={{ fontFamily: "var(--font-body)" }}>
      <span aria-hidden className="w-4 h-4 rounded-full border-2 border-digi-border border-t-accent animate-spin motion-reduce:animate-none" />
      {texto}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div style={PANEL_AUTH}><Esperando texto="Cargando…" /></div>}>
      <VerifyContent />
    </Suspense>
  );
}

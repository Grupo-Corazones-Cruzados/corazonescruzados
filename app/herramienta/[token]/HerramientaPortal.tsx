'use client';

import { useCallback, useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import PublicHeader from '@/components/public/PublicHeader';
import FormatosExcel from '@/components/herramientas/FormatosExcel';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { Link2Off, LogIn } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

type Datos = { motivo: string | null; herramienta?: string; nombre?: string; titulo?: string | null; vence_en?: string; sesion: string | null };

const MOTIVOS: Record<string, { titulo: string; texto: string }> = {
  no_existe: { titulo: 'Enlace no disponible', texto: 'Este enlace no existe. Revisa que lo hayas copiado completo.' },
  cerrado: { titulo: 'Este acceso se cerró', texto: 'Quien te lo compartió lo cerró. Pídele uno nuevo si aún lo necesitas.' },
  vencido: { titulo: 'Este acceso venció', texto: 'Pasó su fecha de vigencia. Pídele uno nuevo a quien te lo compartió.' },
};

/** `/herramienta/<token>`: la herramienta compartida, para quien no tiene cuenta (ver `lib/herramientas/accesos`). */
export default function HerramientaPortal({ token }: { token: string }) {
  const [datos, setDatos] = useState<Datos | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/herramienta-publica/${encodeURIComponent(token)}`, { cache: 'no-store' });
      const d = await r.json();
      setDatos(d.data || { motivo: 'no_existe', sesion: null });
    } catch { setDatos({ motivo: 'no_existe', sesion: null }); }
  }, [token]);
  useEffect(() => { cargar(); }, [cargar]);

  // Cuenta el uso; si el acceso se cerró o venció mientras tenía la página abierta, lo dice.
  const usar = useCallback(() => {
    fetch(`/api/herramienta-publica/${encodeURIComponent(token)}/uso`, { method: 'POST' })
      .then(async (r) => { if (r.status === 409) { const d = await r.json(); setDatos((p) => ({ ...(p as Datos), motivo: d.motivo || 'cerrado' })); } })
      .catch(() => {});
  }, [token]);

  const salir = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.reload();
  };
  const entrar = `/?acceso=cliente&redirect=${encodeURIComponent(`/herramienta/${token}`)}`;

  const tarjeta = (Icono: any, titulo: string, cuerpo: React.ReactNode, acciones?: React.ReactNode) => (
    <div className="max-w-2xl mx-auto bg-digi-card border border-digi-border rounded-xl p-8 text-center">
      <Icono className="w-8 h-8 text-accent mx-auto mb-3" />
      <p className="text-[15px] font-semibold text-digi-text" style={mf}>{titulo}</p>
      <div className="text-[13px] text-digi-muted mt-1.5" style={mf}>{cuerpo}</div>
      {acciones && <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">{acciones}</div>}
    </div>
  );

  let cuerpo: React.ReactNode;
  if (!datos) {
    cuerpo = <p className="text-[13px] text-white/60 text-center py-16" style={mf}>Cargando…</p>;
  } else if (datos.motivo === 'necesita_sesion') {
    cuerpo = tarjeta(LogIn, 'Inicia sesión para usarla',
      'Este acceso es para un cliente de GCC World: entra con tu cuenta y volverás aquí.',
      <a href={entrar} className={BTN_PRIMARY}><LogIn className="w-4 h-4" /> Iniciar sesión</a>);
  } else if (datos.motivo === 'otra_cuenta') {
    cuerpo = tarjeta(LogIn, 'Este acceso es para otra cuenta',
      <>Entraste como <strong className="text-digi-text">{datos.sesion}</strong>. Cierra sesión y entra con la cuenta del cliente al que se compartió.</>,
      <button onClick={salir} className={BTN_SECONDARY}>Cerrar sesión</button>);
  } else if (datos.motivo) {
    const m = MOTIVOS[datos.motivo] || MOTIVOS.no_existe;
    cuerpo = tarjeta(Link2Off, m.titulo, m.texto);
  } else {
    cuerpo = (
      <div className="space-y-4">
        <div className="bg-digi-card border border-digi-border rounded-xl px-5 py-4">
          <h1 className="text-[18px] font-semibold text-digi-text leading-snug" style={df}>{datos.nombre}</h1>
          {datos.titulo && <p className="text-[13px] text-digi-muted mt-1" style={mf}>{datos.titulo}</p>}
        </div>
        {datos.herramienta === 'formatos-excel' && <FormatosExcel onUso={usar} />}
      </div>
    );
  }

  return (
    <div className="corp page-dark min-h-screen">
      <Toaster position="top-center" richColors closeButton />
      <PublicHeader />
      <div className="max-w-[1400px] mx-auto px-4 py-8">{cuerpo}</div>
    </div>
  );
}

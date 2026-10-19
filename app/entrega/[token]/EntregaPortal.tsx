'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast, Toaster } from 'sonner';
import PublicHeader from '@/components/public/PublicHeader';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { mb } from '@/components/ui/SubidaArchivos';
import { Download, Link2Off, LogIn, PackageOpen, Paperclip } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

type ArchivoPub = { id: string; nombre: string; tamano: number };
type Datos = {
  motivo: string | null; sesion: string | null; abierta?: boolean; titulo?: string;
  // Sin abrir
  n_archivos?: number; total?: number; con_mensaje?: boolean;
  // Abierta en este navegador
  mensaje?: string; archivos?: ArchivoPub[]; cierra_en?: string;
};

const MOTIVOS: Record<string, { titulo: string; texto: string }> = {
  no_existe: { titulo: 'Entrega no disponible', texto: 'Este enlace no existe. Revisa que lo hayas copiado completo.' },
  usado: { titulo: 'Esta entrega ya se abrió', texto: 'Sirve una sola vez y ya se usó. Si no la abriste tú, avisa a quien te la envió.' },
  cerrado: { titulo: 'Esta entrega se cerró', texto: 'Quien te la envió la cerró. Pídele una nueva si aún la necesitas.' },
  vencido: { titulo: 'Esta entrega venció', texto: 'Pasó su fecha de vigencia. Pídele una nueva a quien te la envió.' },
};

const hora = (s?: string) => (s ? new Date(s).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false }) : '');

/**
 * La página que abre quien recibe una entrega de un solo uso (ver `lib/entregas`). Abrirla no la
 * gasta; «Ver y descargar» sí, y desde ahí este navegador tiene una hora para bajar los archivos.
 * Mismas tarjetas de estado y de inicio de sesión que `EnlacePortal`.
 */
export default function EntregaPortal({ token }: { token: string }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [abriendo, setAbriendo] = useState(false);
  const base = `/api/entrega-publica/${encodeURIComponent(token)}`;

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(base, { cache: 'no-store' });
      const d = await r.json();
      setDatos(d.data || { motivo: 'no_existe', sesion: null });
    } catch { setDatos({ motivo: 'no_existe', sesion: null }); }
  }, [base]);
  useEffect(() => { cargar(); }, [cargar]);

  // Pasada la hora, la página lo dice sola (y no deja pulsar descargas que ya darían error).
  useEffect(() => {
    if (!datos?.cierra_en) return;
    const ms = new Date(datos.cierra_en).getTime() - Date.now();
    const t = setTimeout(() => setDatos((p) => (p ? { ...p, abierta: false, motivo: 'usado' } : p)), Math.max(0, ms));
    return () => clearTimeout(t);
  }, [datos?.cierra_en]);

  const abrir = async () => {
    setAbriendo(true);
    try {
      const r = await fetch(`${base}/abrir`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) {
        if (d.motivo) { setDatos((p) => ({ ...(p as Datos), motivo: d.motivo })); return; }
        throw new Error(d.error || 'No se pudo abrir');
      }
      setDatos((p) => ({ ...(p as Datos), ...d.data }));
    } catch (e: any) { toast.error(e.message); }
    finally { setAbriendo(false); }
  };

  const salir = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.reload();
  };
  const entrar = `/?acceso=cliente&redirect=${encodeURIComponent(`/entrega/${token}`)}`;

  const tarjeta = (Icono: any, titulo: string, cuerpo: React.ReactNode, acciones?: React.ReactNode) => (
    <div className="bg-digi-card border border-digi-border rounded-xl p-8 text-center">
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
    cuerpo = tarjeta(LogIn, 'Inicia sesión para ver la entrega',
      'Esta entrega es para un cliente de GCC World: entra con tu cuenta y volverás aquí.',
      <a href={entrar} className={BTN_PRIMARY}><LogIn className="w-4 h-4" /> Iniciar sesión</a>);
  } else if (datos.motivo === 'otra_cuenta') {
    cuerpo = tarjeta(LogIn, 'Esta entrega es para otra cuenta',
      <>Entraste como <strong className="text-digi-text">{datos.sesion}</strong>. Cierra sesión y entra con la cuenta del cliente al que se envió.</>,
      <button onClick={salir} className={BTN_SECONDARY}>Cerrar sesión</button>);
  } else if (datos.motivo) {
    const m = MOTIVOS[datos.motivo] || MOTIVOS.no_existe;
    cuerpo = tarjeta(Link2Off, m.titulo, m.texto);
  } else if (!datos.abierta) {
    const n = datos.n_archivos || 0;
    const que = [n ? `${n} archivo${n === 1 ? '' : 's'} (${mb(datos.total || 0)})` : '', datos.con_mensaje ? 'un mensaje' : '']
      .filter(Boolean).join(' y ');
    cuerpo = tarjeta(PackageOpen, datos.titulo || 'Entrega',
      <>Te enviaron {que}. Se puede ver <strong className="text-digi-text">una sola vez</strong>: al pulsar el botón tendrás una hora para descargarlo en este navegador.</>,
      <button onClick={abrir} disabled={abriendo} className={`${BTN_PRIMARY} h-11 sm:h-auto`}>
        <Download className="w-4 h-4" /> {abriendo ? 'Abriendo…' : 'Ver y descargar'}
      </button>);
  } else {
    cuerpo = (
      <div className="bg-digi-card border border-digi-border rounded-xl p-5 space-y-4">
        <div>
          <h1 className="text-[18px] font-semibold text-digi-text leading-snug" style={df}>{datos.titulo}</h1>
          <p className="text-[12px] text-digi-muted mt-1" style={mf}>Disponible en este navegador hasta las {hora(datos.cierra_en)}.</p>
        </div>
        {datos.mensaje && <p className="text-[13.5px] text-digi-text whitespace-pre-wrap leading-relaxed" style={mf}>{datos.mensaje}</p>}
        {!!datos.archivos?.length && (
          <div className="space-y-1.5">
            {datos.archivos.map((a) => (
              <a key={a.id} href={`${base}/archivos/${encodeURIComponent(a.id)}`}
                className="flex items-center gap-2 rounded-lg border border-digi-border px-3 py-2.5 hover:border-accent/50 transition-colors">
                <Paperclip className="w-4 h-4 text-digi-muted shrink-0" />
                <span className="flex-1 min-w-0 text-[12.5px] text-digi-text truncate" style={mf}>{a.nombre}</span>
                <span className="text-[11px] text-digi-muted tabular-nums shrink-0" style={mf}>{mb(a.tamano)}</span>
                <Download className="w-4 h-4 text-accent shrink-0" />
              </a>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="corp page-dark min-h-screen">
      <Toaster position="top-center" richColors />
      <PublicHeader />
      <div className="max-w-2xl mx-auto px-4 py-8">{cuerpo}</div>
    </div>
  );
}

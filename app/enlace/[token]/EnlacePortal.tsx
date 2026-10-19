'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast, Toaster } from 'sonner';
import PublicHeader from '@/components/public/PublicHeader';
import AutoGrowTextarea from '@/components/ui/AutoGrowTextarea';
import { ListaSubidas, useSubidaArchivos } from '@/components/ui/SubidaArchivos';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { CheckCircle2, Link2Off, LogIn } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

type Datos = { motivo: string | null; titulo?: string; indicaciones?: string; sesion: string | null };

const MOTIVOS: Record<string, { titulo: string; texto: string }> = {
  no_existe: { titulo: 'Enlace no disponible', texto: 'Este enlace no existe. Revisa que lo hayas copiado completo.' },
  usado: { titulo: 'Este enlace ya se usó', texto: 'Sirve para una sola respuesta y ya la recibió.' },
  cerrado: { titulo: 'Este enlace se cerró', texto: 'Quien te lo envió lo cerró. Pídele uno nuevo si aún lo necesitas.' },
  vencido: { titulo: 'Este enlace venció', texto: 'Pasó su fecha de vigencia. Pídele uno nuevo a quien te lo envió.' },
};

export default function EnlacePortal({ token }: { token: string }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const { items, agregar, quitar, subiendo, listos } = useSubidaArchivos(async (archivo) => {
    const r = await fetch(`/api/enlace-publico/${encodeURIComponent(token)}/subida`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: archivo.name, tipo: archivo.type, tamano: archivo.size }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'No se pudo subir');
    return d.data.url;
  });

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/enlace-publico/${encodeURIComponent(token)}`, { cache: 'no-store' });
      const d = await r.json();
      setDatos(d.data || { motivo: 'no_existe', sesion: null });
    } catch { setDatos({ motivo: 'no_existe', sesion: null }); }
  }, [token]);
  useEffect(() => { cargar(); }, [cargar]);

  const puedeEnviar = !enviando && !subiendo && (texto.trim().length > 0 || listos.length > 0);

  const enviar = async () => {
    setEnviando(true);
    try {
      const r = await fetch(`/api/enlace-publico/${encodeURIComponent(token)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto, archivos: listos.map((x) => x.fileId) }),
      });
      const d = await r.json();
      if (!r.ok) {
        if (d.motivo) { setDatos((p) => ({ ...(p as Datos), motivo: d.motivo })); return; }
        throw new Error(d.error || 'No se pudo enviar');
      }
      setEnviado(true);
    } catch (e: any) { toast.error(e.message); }
    finally { setEnviando(false); }
  };

  const salir = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.reload();
  };
  const entrar = `/?acceso=cliente&redirect=${encodeURIComponent(`/enlace/${token}`)}`;

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
  } else if (enviado) {
    cuerpo = tarjeta(CheckCircle2, 'Respuesta enviada', 'Gracias. El enlace ya quedó cerrado.');
  } else if (datos.motivo === 'necesita_sesion') {
    cuerpo = tarjeta(LogIn, 'Inicia sesión para responder',
      'Este enlace es para un cliente de GCC World: entra con tu cuenta y volverás aquí.',
      <a href={entrar} className={BTN_PRIMARY}><LogIn className="w-4 h-4" /> Iniciar sesión</a>);
  } else if (datos.motivo === 'otra_cuenta') {
    cuerpo = tarjeta(LogIn, 'Este enlace es para otra cuenta',
      <>Entraste como <strong className="text-digi-text">{datos.sesion}</strong>. Cierra sesión y entra con la cuenta del cliente al que se envió.</>,
      <button onClick={salir} className={BTN_SECONDARY}>Cerrar sesión</button>);
  } else if (datos.motivo) {
    const m = MOTIVOS[datos.motivo] || MOTIVOS.no_existe;
    cuerpo = tarjeta(Link2Off, m.titulo, m.texto);
  } else {
    cuerpo = (
      <div className="bg-digi-card border border-digi-border rounded-xl p-5 space-y-4">
        <div>
          <h1 className="text-[18px] font-semibold text-digi-text leading-snug" style={df}>{datos.titulo}</h1>
          {datos.indicaciones && <p className="text-[13px] text-digi-muted mt-1.5 whitespace-pre-wrap" style={mf}>{datos.indicaciones}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="enlace-texto" className="text-[12px] font-semibold text-digi-text opacity-70" style={mf}>Tu respuesta</label>
          <AutoGrowTextarea id="enlace-texto" value={texto} onChange={(e) => setTexto(e.target.value)} minRows={5} maxLength={20000}
            className="field-control w-full px-3 py-2.5 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:outline-none"
            placeholder="Escribe aquí…" />
        </div>

        <ListaSubidas items={items} agregar={agregar} quitar={quitar} />

        <div className="flex justify-stretch sm:justify-end pt-1">
          <button onClick={enviar} disabled={!puedeEnviar} className={`${BTN_PRIMARY} w-full sm:w-auto h-11 sm:h-auto`}>
            {enviando ? 'Enviando…' : subiendo ? 'Subiendo archivos…' : 'Enviar respuesta'}
          </button>
        </div>
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

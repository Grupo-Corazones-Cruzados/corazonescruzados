'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast, Toaster } from 'sonner';
import PublicHeader from '@/components/public/PublicHeader';
import AutoGrowTextarea from '@/components/ui/AutoGrowTextarea';
import BotonQuitar from '@/components/ui/BotonQuitar';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { CheckCircle2, FileUp, Link2Off, LogIn, Paperclip } from 'lucide-react';
import { fmt2 } from '@/lib/format';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

const MAX_ARCHIVOS = 10;
const MAX_BYTES = 100 * 1024 * 1024;

type Datos = { motivo: string | null; titulo?: string; indicaciones?: string; sesion: string | null };
type Item = { clave: string; archivo: File; progreso: number; fileId?: string; error?: string };

const MOTIVOS: Record<string, { titulo: string; texto: string }> = {
  no_existe: { titulo: 'Enlace no disponible', texto: 'Este enlace no existe. Revisa que lo hayas copiado completo.' },
  usado: { titulo: 'Este enlace ya se usó', texto: 'Sirve para una sola respuesta y ya la recibió.' },
  cerrado: { titulo: 'Este enlace se cerró', texto: 'Quien te lo envió lo cerró. Pídele uno nuevo si aún lo necesitas.' },
  vencido: { titulo: 'Este enlace venció', texto: 'Pasó su fecha de vigencia. Pídele uno nuevo a quien te lo envió.' },
};

const mb = (b: number) => `${fmt2(b / 1024 / 1024)} MB`;

/** Sube un archivo a la URL de sesión de Drive, con progreso. Devuelve el id del archivo. */
function subir(url: string, archivo: File, onProgreso: (p: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) onProgreso(Math.round((ev.loaded / ev.total) * 100)); };
    xhr.onload = () => {
      try {
        if (xhr.status >= 200 && xhr.status < 300) return resolve(JSON.parse(xhr.responseText).id);
      } catch { /* respuesta rara: cae al rechazo */ }
      reject(new Error('No se pudo subir'));
    };
    xhr.onerror = () => reject(new Error('Se cortó la conexión'));
    xhr.send(archivo);
  });
}

export default function EnlacePortal({ token }: { token: string }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [texto, setTexto] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/enlace-publico/${encodeURIComponent(token)}`, { cache: 'no-store' });
      const d = await r.json();
      setDatos(d.data || { motivo: 'no_existe', sesion: null });
    } catch { setDatos({ motivo: 'no_existe', sesion: null }); }
  }, [token]);
  useEffect(() => { cargar(); }, [cargar]);

  const cambiar = (clave: string, c: Partial<Item>) => setItems((p) => p.map((x) => (x.clave === clave ? { ...x, ...c } : x)));

  const agregar = async (lista: FileList | null) => {
    if (!lista) return;
    const libres = MAX_ARCHIVOS - items.length;
    const elegidos = Array.from(lista);
    if (elegidos.length > libres) toast.error(`Máximo ${MAX_ARCHIVOS} archivos`);
    const nuevos: Item[] = [];
    for (const archivo of elegidos.slice(0, Math.max(0, libres))) {
      if (archivo.size > MAX_BYTES) { toast.error(`«${archivo.name}» pasa de 100 MB`); continue; }
      if (archivo.size === 0) { toast.error(`«${archivo.name}» está vacío`); continue; }
      nuevos.push({ clave: `${Date.now()}-${Math.random()}`, archivo, progreso: 0 });
    }
    setItems((p) => [...p, ...nuevos]);
    // De uno en uno: diez de 100 MB a la vez saturarían la conexión del cliente.
    for (const it of nuevos) {
      try {
        const r = await fetch(`/api/enlace-publico/${encodeURIComponent(token)}/subida`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: it.archivo.name, tipo: it.archivo.type, tamano: it.archivo.size }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'No se pudo subir');
        const fileId = await subir(d.data.url, it.archivo, (p) => cambiar(it.clave, { progreso: p }));
        cambiar(it.clave, { fileId, progreso: 100 });
      } catch (e: any) { cambiar(it.clave, { error: e.message || 'No se pudo subir' }); }
    }
  };

  const subiendo = items.some((x) => !x.fileId && !x.error);
  const listos = items.filter((x) => x.fileId);
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

        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-digi-text opacity-70" style={mf}>
            Archivos <span className="font-normal">({items.length}/{MAX_ARCHIVOS} · hasta 100 MB cada uno)</span>
          </span>
          {items.map((x) => (
            <div key={x.clave} className="flex items-center gap-2 rounded-lg border border-digi-border px-3 py-2">
              <Paperclip className="w-4 h-4 text-digi-muted shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] text-digi-text truncate" style={mf}>{x.archivo.name}</p>
                {x.error ? (
                  <p className="text-[11px] text-red-600" style={mf}>{x.error}</p>
                ) : x.fileId ? (
                  <p className="text-[11px] text-green-600" style={mf}>{mb(x.archivo.size)} · Subido</p>
                ) : (
                  <div className="mt-1 h-1.5 rounded-full bg-digi-border/60 overflow-hidden">
                    <div className="h-full bg-accent transition-all" style={{ width: `${x.progreso}%` }} />
                  </div>
                )}
              </div>
              {(x.fileId || x.error) && (
                <BotonQuitar onClick={() => setItems((p) => p.filter((y) => y.clave !== x.clave))} etiqueta="Quitar archivo" />
              )}
            </div>
          ))}
          {items.length < MAX_ARCHIVOS && (
            <button type="button" onClick={() => input.current?.click()}
              className="w-full py-5 rounded-lg border-2 border-dashed border-digi-border hover:border-accent/50 hover:bg-accent-light/40 text-center transition-colors">
              <FileUp className="w-5 h-5 text-digi-muted mx-auto mb-1" />
              <span className="text-[12px] text-digi-text" style={mf}>Adjuntar archivos</span>
            </button>
          )}
          <input ref={input} type="file" multiple className="hidden"
            onChange={(e) => { agregar(e.target.files); e.target.value = ''; }} />
        </div>

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

'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { BTN_SECONDARY, BTN_ICONO_FILA } from '@/components/ui/Button';
import PixelConfirm from '@/components/ui/PixelConfirm';
import IconoRed from '@/components/ui/IconoRed';
import { abrirFuera } from '@/lib/movil/abrir-fuera';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

type Red = 'youtube' | 'instagram' | 'facebook' | 'tiktok' | 'linkedin';
type Proveedor = 'youtube' | 'meta' | 'tiktok' | 'linkedin';
const REDES: { red: Red; etiqueta: string; proveedor: Proveedor }[] = [
  { red: 'youtube', etiqueta: 'YouTube', proveedor: 'youtube' },
  { red: 'instagram', etiqueta: 'Instagram', proveedor: 'meta' },
  { red: 'facebook', etiqueta: 'Facebook', proveedor: 'meta' },
  { red: 'tiktok', etiqueta: 'TikTok', proveedor: 'tiktok' },
  { red: 'linkedin', etiqueta: 'LinkedIn', proveedor: 'linkedin' },
];

interface Cuenta { id: number; talento: string; red: Red; nombre: string; url: string | null; estado: string }
interface Datos { talentos: string[]; cuentas: Cuenta[]; proveedores: Record<Proveedor, boolean> }

const enAppNativa = () => typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();

/**
 * LAS REDES DE CADA TALENTO (Fernando, 2026-11-10). Una cuenta por red y talento; son las que enseña el CV
 * compartido de ese talento y donde publica Generación de Contenido. Instagram y Facebook se conectan juntos
 * (una autorización de Meta). Desde la app la conexión se abre en el navegador del sistema y, al volver a la
 * app, la lista se actualiza sola.
 */
export default function RedesPorTalento() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState('');
  const [abriendo, setAbriendo] = useState('');
  const [quitar, setQuitar] = useState<Cuenta | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/redes', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'No se pudo cargar.');
      setDatos(j); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar.'); }
  }, []);

  useEffect(() => {
    cargar();
    const p = new URLSearchParams(window.location.search);
    const r = p.get('redes');
    if (r) {
      const msg = p.get('msg') || '';
      if (r === 'ok') toast.success(msg || 'Red conectada.'); else toast.error(msg || 'No se pudo conectar.');
      p.delete('redes'); p.delete('msg');
      window.history.replaceState(null, '', `${window.location.pathname}${p.size ? `?${p}` : ''}`);
    }
    // Al volver del navegador del sistema (app) o de otra pestaña, lo conectado ya está en la base.
    const alVolver = () => { if (document.visibilityState === 'visible') cargar(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [cargar]);

  async function conectar(talento: string, proveedor: Proveedor) {
    const app = enAppNativa();
    setAbriendo(`${talento}/${proveedor}`);
    try {
      const r = await fetch('/api/redes/enlace', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ talento, proveedor, origen: app ? 'app' : 'web' }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'No se pudo empezar.');
      if (app && (await abrirFuera(j.url).catch(() => null))) return;
      window.location.href = j.url;
    } catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo empezar.'); } finally { setAbriendo(''); }
  }

  async function confirmarQuitar() {
    const c = quitar;
    setQuitar(null);
    if (!c) return;
    const r = await fetch(`/api/redes?id=${c.id}`, { method: 'DELETE' });
    if (!r.ok) { toast.error('No se pudo quitar.'); return; }
    await cargar();
  }

  if (error) return <p className="text-[12.5px] text-red-500 mt-4" style={mf}>{error}</p>;
  if (!datos) return <div className="mt-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-digi-muted" /></div>;
  if (!datos.talentos.length) return null;

  return (
    <div className="mt-4 grid grid-cols-1 2xl:grid-cols-2 gap-4">
      {datos.talentos.map((talento) => (
        <section key={talento} className="bg-digi-card border border-digi-border rounded-xl p-4 min-w-0">
          <h3 className="text-[14px] font-semibold text-digi-text" style={df}>Redes · {talento}</h3>
          <ul className="mt-3 divide-y divide-digi-border">
            {REDES.map(({ red, etiqueta, proveedor }) => {
              const c = datos.cuentas.find((x) => x.talento === talento && x.red === red);
              const habilitada = datos.proveedores[proveedor];
              const ocupado = abriendo === `${talento}/${proveedor}`;
              return (
                <li key={red} className="flex items-center gap-3 py-2.5 min-w-0">
                  <IconoRed red={red} className="w-[18px] h-[18px] text-digi-muted" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-digi-text" style={mf}>{etiqueta}</p>
                    <p className={`text-[12px] truncate ${c?.estado === 'reconectar' ? 'text-amber-500' : 'text-digi-muted'}`} style={mf}>
                      {c ? (c.estado === 'reconectar' ? `${c.nombre} · hay que volver a conectarla` : c.nombre) : habilitada ? 'Sin conectar' : 'Pendiente de aprobación de la red'}
                    </p>
                  </div>
                  {c?.url && (
                    <a href={c.url} target="_blank" rel="noreferrer" title={`Abrir en ${etiqueta}`} aria-label={`Abrir en ${etiqueta}`} className={BTN_ICONO_FILA}>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  {c && (
                    <button type="button" onClick={() => setQuitar(c)} title="Quitar" aria-label={`Quitar ${etiqueta}`} className={BTN_ICONO_FILA}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  {habilitada && (!c || c.estado === 'reconectar') && (
                    <button type="button" disabled={!!abriendo} onClick={() => conectar(talento, proveedor)} className={`${BTN_SECONDARY} shrink-0`} style={mf}>
                      {ocupado && <Loader2 className="w-4 h-4 animate-spin" />}
                      {c ? 'Reconectar' : 'Conectar'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <PixelConfirm open={!!quitar} danger title="Quitar la cuenta"
        message={quitar ? `${quitar.nombre} dejará de verse en tu CV de ${quitar.talento} y no se publicará ahí.${quitar.red === 'facebook' || quitar.red === 'instagram' ? ' Instagram y Facebook se conectan juntos: para volver a conectar una, se autorizan las dos.' : ''}` : ''}
        confirmLabel="Quitar" onCancel={() => setQuitar(null)} onConfirm={confirmarQuitar} />
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Copy, Lock, Share2 } from 'lucide-react';
import PixelModal from '@/components/ui/PixelModal';
import PixelConfirm from '@/components/ui/PixelConfirm';
import PixelBadge from '@/components/ui/PixelBadge';
import BotonQuitar from '@/components/ui/BotonQuitar';
import { BTN_ICONO_FILA, BTN_PRIMARY } from '@/components/ui/Button';
import { useAuth } from '@/components/providers/AuthProvider';
import { fmtInt } from '@/lib/format';

const mf = { fontFamily: 'var(--font-body)' } as const;

type Acceso = {
  id: number; url: string; titulo: string; cliente_nombre: string | null; enviado_a: string | null;
  validacion: 'ninguna' | 'cuenta' | 'cliente'; estado: 'vigente' | 'cerrado' | 'vencido';
  vence_en: string; cerrado_en: string | null; usos: number; ultimo_uso: string | null; creador_nombre: string | null;
};

const ESTADO = {
  vigente: { label: 'Vigente', v: 'info' }, cerrado: { label: 'Cerrado', v: 'default' }, vencido: { label: 'Vencido', v: 'warning' },
} as const;
const VALIDACION = { ninguna: 'Solo el enlace', cuenta: 'Cuenta de GCC World', cliente: 'Cuenta del cliente' } as const;

const fecha = (s: string | null) => (s ? new Date(s).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' }) : '—');

/**
 * LOS ACCESOS DE UNA HERRAMIENTA, EN EL PANEL DERECHO (Fernando, 2026-11-08: «cada herramienta
 * debería tener sus propios accesos, y no quiero una página aparte sino que al seleccionar
 * accesos debería salir un panel derecho para manejarlos»). Sustituye a /dashboard/tools/accesos,
 * que mezclaba todas. Cada fila con sus acciones siempre visibles: copiar, cerrar y eliminar.
 * «Compartir» abre el formulario para crear uno nuevo (`onCompartir`).
 */
export default function PanelAccesos({ herramienta, nombre, open, onClose, onCompartir, version = 0 }: {
  herramienta: string;
  nombre: string;
  open: boolean;
  onClose: () => void;
  onCompartir: () => void;
  /** Cambia al generar un acceso nuevo: la lista se vuelve a pedir. */
  version?: number;
}) {
  const { user } = useAuth();
  const esAdmin = user?.role === 'admin';
  const [accesos, setAccesos] = useState<Acceso[] | null>(null);
  const [confirmar, setConfirmar] = useState<{ a: Acceso; accion: 'cerrar' | 'eliminar' } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/herramientas/accesos?herramienta=${encodeURIComponent(herramienta)}`, { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'No se pudieron cargar los accesos');
      setAccesos(d.data || []);
    } catch (e: any) { toast.error(e.message); setAccesos((p) => p ?? []); }
  }, [herramienta]);
  useEffect(() => { if (open) cargar(); }, [open, cargar, version]);
  useEffect(() => { setAccesos(null); }, [herramienta]);

  const copiar = (url: string) => { navigator.clipboard.writeText(url); toast.success('Enlace copiado'); };

  const ejecutar = async () => {
    if (!confirmar) return;
    const eliminar = confirmar.accion === 'eliminar';
    setOcupado(true);
    try {
      const r = await fetch(`/api/herramientas/accesos/${confirmar.a.id}`, eliminar
        ? { method: 'DELETE' }
        : { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'cerrar' }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || (eliminar ? 'No se pudo eliminar' : 'No se pudo cerrar'));
      toast.success(eliminar ? 'Acceso eliminado' : 'Acceso cerrado');
    } catch (e: any) { toast.error(e.message); }
    finally { setOcupado(false); setConfirmar(null); cargar(); }
  };

  const nombreDe = (a: Acceso) => a.titulo || a.cliente_nombre || a.enviado_a || `Acceso #${a.id}`;
  const vigentes = (accesos ?? []).filter((a) => a.estado === 'vigente').length;

  return (
    <>
      <PixelModal open={open} onClose={onClose} title={`Accesos · ${nombre}`} size="md"
        pie={
          <div className="flex items-center gap-3 w-full">
            <span className="text-[12px] text-digi-muted tabular-nums" style={mf}>
              {accesos === null ? '' : `${fmtInt(accesos.length)} ${accesos.length === 1 ? 'acceso' : 'accesos'} · ${fmtInt(vigentes)} ${vigentes === 1 ? 'vigente' : 'vigentes'}`}
            </span>
            <button onClick={onCompartir} className={`${BTN_PRIMARY} ml-auto`}>
              <Share2 className="w-4 h-4" /> Compartir
            </button>
          </div>
        }>
        {accesos === null ? (
          <p className="text-center text-[13px] text-digi-muted py-10" style={mf}>Cargando…</p>
        ) : accesos.length === 0 ? (
          <div className="text-center py-12" style={mf}>
            <Share2 className="w-8 h-8 mx-auto text-digi-muted/40 mb-2" />
            <p className="text-[14px] font-semibold text-digi-text">Sin accesos</p>
          </div>
        ) : (
          <ul className="divide-y divide-digi-border border border-digi-border rounded-lg" style={mf}>
            {accesos.map((a) => (
              <li key={a.id} className="flex items-start gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate text-[13.5px] font-medium text-digi-text">{nombreDe(a)}</span>
                    <span className="shrink-0"><PixelBadge variant={ESTADO[a.estado].v}>{ESTADO[a.estado].label}</PixelBadge></span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-digi-muted">
                    <span>{VALIDACION[a.validacion ?? 'ninguna']}{a.validacion === 'cliente' && a.cliente_nombre ? ` · ${a.cliente_nombre}` : ''}</span>
                    <span className="tabular-nums">{fmtInt(a.usos)} {a.usos === 1 ? 'uso' : 'usos'}</span>
                    <span>{a.estado === 'cerrado' ? `Cerrado ${fecha(a.cerrado_en)}` : `Vence ${fecha(a.vence_en)}`}</span>
                    {esAdmin && a.creador_nombre && <span>{a.creador_nombre}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  {a.estado === 'vigente' && (
                    <>
                      <button type="button" onClick={() => copiar(a.url)} className={BTN_ICONO_FILA} title="Copiar enlace" aria-label="Copiar enlace"><Copy className="w-4 h-4" /></button>
                      <button type="button" onClick={() => setConfirmar({ a, accion: 'cerrar' })} className={BTN_ICONO_FILA} title="Cerrar acceso" aria-label="Cerrar acceso"><Lock className="w-4 h-4" /></button>
                    </>
                  )}
                  <BotonQuitar onClick={() => setConfirmar({ a, accion: 'eliminar' })} etiqueta="Eliminar acceso" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </PixelModal>

      <PixelConfirm
        open={!!confirmar}
        title={confirmar?.accion === 'eliminar' ? 'Eliminar acceso' : 'Cerrar acceso'}
        message={confirmar?.accion === 'eliminar'
          ? 'Se borra el acceso y su registro de usos. El enlace dejará de abrir la herramienta.'
          : 'Quien tenga el enlace ya no podrá usar la herramienta. No se puede volver a abrir.'}
        confirmLabel={ocupado ? '…' : confirmar?.accion === 'eliminar' ? 'Eliminar' : 'Cerrar acceso'}
        danger
        onConfirm={ejecutar}
        onCancel={() => setConfirmar(null)}
      />
    </>
  );
}

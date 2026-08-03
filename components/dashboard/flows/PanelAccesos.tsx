'use client';

/**
 * QUIÉN ENTRA A ESTE FLUJO — panel lateral derecho.
 *
 * ── POR QUÉ NO ES UN `EditPanel` ───────────────────────────────────────────────
 * `EditPanel` es para formularios: se rellena, se pulsa «Guardar», se cierra. Aquí no hay
 * nada que rellenar — se da y se quita acceso, y **cada acción surte efecto en el acto**.
 * Un botón «Guardar» sobrando invitaría a la duda de si lo ya hecho está aplicado o no.
 * Se monta sobre `PixelModal size="md"`, que es la misma superficie lateral que usa
 * `EditPanel` por dentro, así que el sitio y el aspecto no cambian.
 *
 * ── LA REGLA QUE IMPONE ────────────────────────────────────────────────────────
 * Solo el **responsable** del flujo (y los administradores) abren esto. Un cliente con
 * acceso no puede dárselo a otro. La comprobación de verdad está en el servidor
 * (`/accesos`); aquí solo se esconde el botón, que no es seguridad.
 */

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import PixelModal from '@/components/ui/PixelModal';
import PixelInput from '@/components/ui/PixelInput';
import BrandLoader from '@/components/ui/BrandLoader';
import { BTN_SECONDARY } from '@/components/ui/Button';
import { PanelEmpty } from '@/components/dashboard/flows/FlowPanelUI';
import { Users, Search, Plus, X, ShieldCheck, AlertTriangle } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

interface Cliente {
  id: string; name: string; email: string | null;
  company: string | null; account_type: string | null;
}

export default function PanelAccesos({ flowId, abierto, alCerrar }: {
  flowId: number; abierto: boolean; alCerrar: () => void;
}) {
  const [datos, setDatos] = useState<{
    responsable: { nombre: string; email: string } | null;
    conAcceso: Cliente[];
    disponibles: Cliente[];
  } | null>(null);
  const [busca, setBusca] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    const r = await fetch(`/api/admin/flows/${flowId}/accesos`);
    const d = await r.json();
    if (!r.ok) { toast.error(d.error ?? 'No se pudo cargar'); alCerrar(); return; }
    setDatos(d.data);
  }, [flowId, alCerrar]);

  useEffect(() => { if (abierto) { setDatos(null); setBusca(''); cargar(); } }, [abierto, cargar]);

  const dar = async (cliente: Cliente) => {
    setOcupado(true);
    try {
      const r = await fetch(`/api/admin/flows/${flowId}/accesos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: cliente.id }),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error ?? 'No se pudo dar el acceso'); return; }
      // El aviso de «no tiene cuenta todavía» lo decide el servidor, que es quien sabe si
      // la ficha del cliente está enlazada a un usuario que pueda iniciar sesión.
      if (d.aviso) toast.warning(d.aviso, { duration: 8000 });
      else toast.success(`${cliente.name} ya puede entrar a este flujo`);
      await cargar();
    } finally { setOcupado(false); }
  };

  const quitar = async (cliente: Cliente) => {
    setOcupado(true);
    try {
      const r = await fetch(`/api/admin/flows/${flowId}/accesos?client_id=${cliente.id}`, { method: 'DELETE' });
      if (!r.ok) { toast.error('No se pudo quitar el acceso'); return; }
      toast.success(`${cliente.name} ya no ve este flujo`);
      await cargar();
    } finally { setOcupado(false); }
  };

  const termino = busca.trim().toLowerCase();
  const encontrados = (datos?.disponibles ?? []).filter((c) =>
    !termino
      ? false // sin buscar no se vuelca el catálogo entero: se elige, no se navega
      : [c.name, c.email, c.company].some((v) => v?.toLowerCase().includes(termino)),
  ).slice(0, 8);

  return (
    <PixelModal open={abierto} onClose={alCerrar} title="Quién entra a este flujo" size="md" busy={ocupado}>
      {!datos ? (
        <div className="flex justify-center py-16"><BrandLoader label="Cargando los accesos…" /></div>
      ) : (
        <div className="space-y-5">
          {datos.responsable && (
            <div className="rounded-md border border-digi-border bg-digi-card px-3 py-2.5 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-digi-muted" style={mf}>Responsable en GCC</p>
                <p className="text-[13px] text-digi-text truncate" style={mf}>{datos.responsable.nombre}</p>
                <p className="text-[11.5px] text-digi-muted truncate" style={mf}>{datos.responsable.email}</p>
              </div>
            </div>
          )}

          {/* ── Buscar y añadir ── */}
          <div>
            <label className="block text-[12px] font-semibold text-digi-text mb-1" style={mf}>
              Dar acceso a un cliente
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-digi-muted pointer-events-none" />
              <PixelInput
                placeholder="Buscar por nombre, correo o empresa…"
                value={busca} onChange={(e: any) => setBusca(e.target.value)}
                style={{ paddingLeft: 28 }}
              />
            </div>

            {termino && (
              <div className="mt-2 rounded-md border border-digi-border overflow-hidden">
                {encontrados.length === 0 ? (
                  <p className="px-3 py-2.5 text-[12.5px] text-digi-muted" style={mf}>
                    Ningún cliente coincide, o los que coinciden ya tienen acceso.
                  </p>
                ) : encontrados.map((c) => (
                  <button
                    key={c.id} type="button" disabled={ocupado} onClick={() => dar(c)}
                    className="w-full text-left px-3 py-2 border-b border-digi-border last:border-b-0
                               hover:bg-accent-light transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5 text-accent shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] text-digi-text truncate" style={mf}>{c.name}</span>
                      <span className="block text-[11.5px] text-digi-muted truncate" style={mf}>
                        {c.company ? `${c.company} · ` : ''}{c.email ?? 'sin correo'}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Los que ya entran ── */}
          <div>
            <p className="text-[12px] font-semibold text-digi-text mb-1.5" style={mf}>
              Clientes con acceso {datos.conAcceso.length > 0 && `(${datos.conAcceso.length})`}
            </p>

            {datos.conAcceso.length === 0 ? (
              <PanelEmpty
                Icon={Users}
                title="Nadie más entra a este flujo"
                desc="Ahora mismo solo lo ven su responsable y los administradores de GCC."
              />
            ) : (
              <div className="rounded-md border border-digi-border overflow-hidden">
                {datos.conAcceso.map((c) => (
                  <div key={c.id} className="px-3 py-2 border-b border-digi-border last:border-b-0 flex items-center gap-2">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] text-digi-text truncate" style={mf}>{c.name}</span>
                      <span className="block text-[11.5px] text-digi-muted truncate" style={mf}>
                        {c.company ? `${c.company} · ` : ''}{c.email ?? 'sin correo'}
                      </span>
                    </span>
                    <button
                      type="button" disabled={ocupado} onClick={() => quitar(c)}
                      className="shrink-0 inline-flex items-center gap-1 text-[12px] text-digi-muted
                                 hover:text-red-400 transition-colors disabled:opacity-50"
                      style={mf}
                    >
                      <X className="w-3.5 h-3.5" /> Quitar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-[11.5px] text-digi-muted leading-relaxed flex items-start gap-1.5" style={mf}>
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-[1px]" />
            Quien tenga acceso ve la bandeja completa de este flujo: las conversaciones de
            WhatsApp y quién escribió qué. Dalo solo a quien deba leerlas.
          </p>

          <div className="flex justify-end">
            <button type="button" className={BTN_SECONDARY} onClick={alCerrar}>Cerrar</button>
          </div>
        </div>
      )}
    </PixelModal>
  );
}

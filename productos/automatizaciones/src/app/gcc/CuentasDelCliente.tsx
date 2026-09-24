'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Link2, ShieldCheck, ChevronDown, UserPlus } from 'lucide-react';
import { Boton, Campo, Entrada, Selector, Insignia } from '@/componentes/ui';
import { enlazarCuentaGcc, cambiarActivoGcc } from '@/acciones/gccUsuarios';

/**
 * LAS CUENTAS DE UN CLIENTE, VISTAS Y GOBERNADAS POR GCC.
 *
 * ── POR QUÉ ESTA PANTALLA EXISTE (Fernando, 2026-09-24) ─────────────────────────
 * Porque enlazar una cuenta de GCC World con un inquilino dejó de ser cosa del cliente.
 * Si solo se quitara del panel del cliente, el producto se quedaría sin ninguna forma de
 * dar de alta al dueño de un cliente nuevo —que es justo como entró Diego Castillo—. Se
 * quita de donde no debía estar y se pone donde sí: aquí, detrás de la sesión del equipo.
 *
 * Las cuentas del producto (las que crea el cliente para su gente) se ven, pero no se
 * tocan desde aquí: son suyas.
 */

export type CuentaVista = {
  id: number;
  usuario: string;
  nombre: string;
  rol: string;
  origen: 'PRODUCTO' | 'GCC';
  activo: boolean;
  enlazadoPor: string | null;
  bloqueada: boolean;
};

const ETIQUETA_ROL: Record<string, string> = {
  ADMIN: 'Administrador', OPERADOR: 'Operador', CONSULTA: 'Consulta',
};

export default function CuentasDelCliente({
  inquilinoId,
  nombre,
  cuentas,
  soloLectura,
}: {
  inquilinoId: number;
  nombre: string;
  cuentas: CuentaVista[];
  soloLectura: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [enCurso, arranca] = useTransition();

  const deGcc = cuentas.filter((c) => c.origen === 'GCC').length;

  return (
    <div className="mt-3 border-t border-borde pt-3">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="flex h-9 items-center gap-1.5 rounded px-1.5 text-[12.5px] text-tenue hover:bg-realce hover:text-texto"
      >
        <ChevronDown className={`h-4 w-4 transition-transform ${abierto ? 'rotate-180' : ''}`} />
        Cuentas ({cuentas.length}{deGcc ? ` · ${deGcc} de GCC World` : ''})
      </button>

      {abierto && (
        <div className="mt-2 space-y-3">
          {cuentas.length === 0 ? (
            <p className="rounded border border-borde bg-realce px-3 py-3 text-center text-[12.5px] text-tenue">
              Este cliente todavía no tiene ninguna cuenta.
            </p>
          ) : (
            <ul className="divide-y divide-borde rounded border border-borde">
              {cuentas.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-texto">{c.nombre}</p>
                    <p className="truncate text-[11.5px] text-tenue">{c.usuario}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Insignia tono={c.rol === 'ADMIN' ? 'info' : 'neutro'}>
                        {ETIQUETA_ROL[c.rol] ?? c.rol}
                      </Insignia>
                      {c.origen === 'GCC' ? (
                        <Insignia tono="info" icono={Link2}>
                          GCC World · enlazó {c.enlazadoPor ?? '—'}
                        </Insignia>
                      ) : (
                        <Insignia tono="neutro" icono={ShieldCheck}>Del cliente</Insignia>
                      )}
                      {!c.activo && <Insignia tono="error">Desactivada</Insignia>}
                      {c.bloqueada && <Insignia tono="aviso">Cerrada por intentos</Insignia>}
                    </p>
                  </div>

                  {/* Solo se gobiernan desde aquí las que enlazó GCC. Las del cliente son
                      suyas y se gestionan en su propia pantalla. */}
                  {c.origen === 'GCC' && !soloLectura && (
                    <Boton
                      variante="secundario"
                      disabled={enCurso}
                      onClick={() =>
                        arranca(async () => {
                          const r = await cambiarActivoGcc(c.id, !c.activo);
                          if (!r.ok) { toast.error(r.error); return; }
                          toast.success(r.mensaje);
                          router.refresh();
                        })
                      }
                    >
                      {c.activo ? 'Desactivar' : 'Activar'}
                    </Boton>
                  )}
                </li>
              ))}
            </ul>
          )}

          {soloLectura ? (
            <p className="text-[12px] text-tenue">Es un escaparate: no se le crean cuentas.</p>
          ) : (
            <form
              action={(d) =>
                arranca(async () => {
                  d.set('inquilinoId', String(inquilinoId));
                  const r = await enlazarCuentaGcc(d);
                  if (!r.ok) { toast.error(r.error); return; }
                  toast.success(r.mensaje);
                  router.refresh();
                })
              }
              className="rounded border border-borde bg-realce p-3"
            >
              <p className="mb-1 text-[12.5px] font-semibold text-texto">
                Enlazar una cuenta de GCC World a {nombre}
              </p>
              <p className="mb-2.5 text-[11.5px] leading-relaxed text-tenue">
                Entrará con la contraseña de la plataforma, que no se copia aquí. Solo para
                quien GCC ya conoce: el cliente <strong>no</strong> puede hacer esto desde su panel.
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                <Campo etiqueta="Nombre">
                  <Entrada name="nombre" required />
                </Campo>
                <Campo etiqueta="Correo en GCC World">
                  <Entrada name="email" type="email" placeholder="persona@empresa.com" required />
                </Campo>
                <Campo etiqueta="Qué puede hacer">
                  <Selector name="rol" defaultValue="ADMIN">
                    <option value="CONSULTA">Consulta</option>
                    <option value="OPERADOR">Operador</option>
                    <option value="ADMIN">Administrador</option>
                  </Selector>
                </Campo>
              </div>
              <div className="mt-2.5 flex justify-end">
                <Boton type="submit" disabled={enCurso}>
                  <UserPlus className="h-4 w-4" /> {enCurso ? 'Enlazando…' : 'Enlazar cuenta'}
                </Boton>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

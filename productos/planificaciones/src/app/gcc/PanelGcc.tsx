'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Building2,
  Plus,
  CreditCard,
  Layers,
  ShieldOff,
  ShieldCheck,
  Eye,
  EyeOff,
  KeyRound,
  ExternalLink,
  LogOut,
  Copy,
  Save,
} from 'lucide-react';
import {
  Boton,
  Campo,
  Entrada,
  AreaTexto,
  Selector,
  Tarjeta,
  Tabla,
  Insignia,
  PanelLateral,
  RailFiltro,
  EstadoVacio,
  PieAcciones,
  type Tono,
} from '@/componentes/ui';
import { salirOperador } from '@/acciones/acceso';
import {
  crearInquilino,
  registrarPago,
  cambiarEstadoInquilino,
  cambiarPlan,
  cambiarSoloLectura,
  cambiarCortesia,
  guardarPlan,
  restablecerClaveAdmin,
} from '@/acciones/gcc';
import { dinero, fechaLarga } from '@/lib/formato';
import type { EstadoAcceso } from '@/lib/inquilino';
import { conBase } from '@/lib/base';

export type PagoGcc = {
  periodo: string;
  monto: number;
  estado: string;
  metodo: string;
  pagadoEn: string | null;
};

export type InquilinoGcc = {
  id: number;
  slug: string;
  nombre: string;
  estado: string;
  soloLectura: boolean;
  cortesia: boolean;
  creado: string;
  contactoEmail: string | null;
  contactoTelefono: string | null;
  acceso: EstadoAcceso;
  plan: { id: number; nombre: string } | null;
  precioMensual: number;
  moneda: string;
  pagadoHasta: string | null;
  estadoSuscripcion: string | null;
  cuentas: number;
  planificaciones: number;
  semanas: number;
  pagos: PagoGcc[];
};

export type PlanGcc = {
  id: number;
  slug: string;
  nombre: string;
  descripcion: string | null;
  precioMensual: number;
  moneda: string;
  maxUsuarios: number | null;
  maxGeneracionesSemana: number | null;
  mesesRetencion: number | null;
  caracteristicas: string[];
  activo: boolean;
};

const ACCESO: Record<EstadoAcceso, { texto: string; tono: Tono }> = {
  ok: { texto: 'Al día', tono: 'exito' },
  vencido: { texto: 'Vencido', tono: 'error' },
  'sin-pago': { texto: 'Sin pago', tono: 'aviso' },
  suspendido: { texto: 'Suspendido', tono: 'neutro' },
};

const periodoActual = () => new Date().toISOString().slice(0, 7);

export default function PanelGcc({
  operador,
  inquilinos,
  planes,
}: {
  operador: string;
  inquilinos: InquilinoGcc[];
  planes: PlanGcc[];
}) {
  const router = useRouter();
  const [seccion, setSeccion] = useState<'instituciones' | 'planes'>('instituciones');
  const [alta, setAlta] = useState(false);
  const [detalle, setDetalle] = useState<InquilinoGcc | null>(null);
  const [planEdit, setPlanEdit] = useState<PlanGcc | null | 'nuevo'>(null);
  const [credencial, setCredencial] = useState<{ texto: string; clave: string } | null>(null);
  const [enCurso, arranca] = useTransition();

  const cerrar = () => {
    setAlta(false);
    setDetalle(null);
    setPlanEdit(null);
  };

  const conResultado = (
    fn: () => Promise<{ ok: boolean; error?: string; mensaje?: string; clave?: string; slug?: string }>,
  ) =>
    arranca(async () => {
      const r = await fn();
      // Avisos de una línea, en un toast; el panel sigue abierto para corregir.
      if (!r.ok) return void toast.error(r.error ?? 'No se pudo completar la acción.');
      if (r.clave) setCredencial({ texto: r.mensaje ?? 'Contraseña generada', clave: r.clave });
      toast.success(r.mensaje ?? 'Hecho');
      cerrar();
      router.refresh();
    });

  const vencidos = inquilinos.filter((i) => i.acceso !== 'ok').length;
  // Ni el inquilino del grupo ni un escaparate pagan: no suman a la mensualidad activa.
  const ingresoMensual = inquilinos
    .filter((i) => i.acceso === 'ok' && !i.cortesia && !i.soloLectura)
    .reduce((a, i) => a + i.precioMensual, 0);

  return (
    // Alto de la ventana: la cabecera de 68 px, y el contenido llega hasta el pie (2026-11-08).
    <div className="flex h-[calc(100dvh-env(safe-area-inset-top))] flex-col bg-fondo">
      <header className="flex min-h-[68px] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-borde bg-tarjeta px-4 py-2 sm:px-6">
        <div className="min-w-0">
          <h1 className="truncate text-[17px] font-semibold leading-6">Planificación de Clases · Equipo GCC</h1>
          <p className="mt-0.5 text-[12px] leading-4 text-tenue">{operador}</p>
        </div>
        <form action={salirOperador}>
          <Boton variante="fantasma" icono={LogOut} type="submit">
            Cerrar sesión
          </Boton>
        </form>
      </header>

      <div className="desplaza flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6 lg:flex-row">
        <RailFiltro
          opciones={[
            { valor: 'instituciones', etiqueta: 'Instituciones', icono: Building2, conteo: inquilinos.length },
            { valor: 'planes', etiqueta: 'Planes', icono: Layers, conteo: planes.length },
          ]}
          activo={seccion}
          alElegir={(v) => setSeccion(v as 'instituciones' | 'planes')}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {credencial && (
            <Tarjeta className="flex flex-wrap items-center gap-3 border-acento p-4">
              <KeyRound className="h-5 w-5 shrink-0 text-acento" />
              <p className="min-w-0 flex-1 text-[13px] font-semibold">{credencial.texto}</p>
              <code className="rounded border border-borde bg-realce px-3 py-1.5 font-mono text-[14px] font-semibold">
                {credencial.clave}
              </code>
              <Boton
                variante="secundario"
                icono={Copy}
                onClick={() => {
                  navigator.clipboard.writeText(credencial.clave);
                  toast.success('Copiada.');
                }}
              >
                Copiar
              </Boton>
              <Boton variante="fantasma" onClick={() => setCredencial(null)}>
                Ocultar
              </Boton>
            </Tarjeta>
          )}

          {seccion === 'instituciones' && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { et: 'Instituciones', v: String(inquilinos.length) },
                  { et: 'Al día', v: String(inquilinos.length - vencidos) },
                  { et: 'Mensualidad activa', v: dinero(ingresoMensual) },
                ].map((c) => (
                  <Tarjeta key={c.et} className="p-3 sm:p-4">
                    <p className="text-[10.5px] uppercase tracking-wide text-tenue sm:text-[11px]">{c.et}</p>
                    <p className="mt-0.5 text-[19px] font-semibold tabular-nums leading-tight sm:text-[21px]">{c.v}</p>
                  </Tarjeta>
                ))}
              </div>

              <Tarjeta className="flex flex-1 flex-col overflow-hidden">
                <div className="flex items-center justify-end border-b border-borde px-4 py-3">
                  <Boton icono={Plus} onClick={() => setAlta(true)} disabled={!planes.length}>
                    Nueva institución
                  </Boton>
                </div>
                <Tabla
                  filas={inquilinos}
                  claveFila={(i) => i.id}
                  alPulsarFila={(i) => setDetalle(i)}
                  recuento={`${inquilinos.length} ${inquilinos.length === 1 ? 'institución' : 'instituciones'}`}
                  vacio={<div className="flex flex-1 flex-col justify-center"><EstadoVacio icono={Building2} titulo="Sin instituciones" /></div>}
                  columnas={[
                    {
                      clave: 'nombre',
                      titulo: 'Institución',
                      ancho: '24%',
                      render: (i) => (
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{i.nombre}</p>
                          <p className="truncate font-mono text-[11px] text-tenue">/{i.slug}</p>
                        </div>
                      ),
                    },
                    {
                      clave: 'plan',
                      titulo: 'Plan',
                      ancho: '20%',
                      render: (i) => (
                        <span className="flex flex-wrap items-center gap-x-2">
                          {i.plan?.nombre ?? '—'}
                          {i.soloLectura && <Insignia tono="info">Escaparate</Insignia>}
                          {i.cortesia && <Insignia tono="exito">Del grupo</Insignia>}
                        </span>
                      ),
                    },
                    {
                      clave: 'acceso',
                      titulo: 'Acceso',
                      ancho: '11%',
                      render: (i) => (
                        <Insignia tono={ACCESO[i.acceso].tono}>{ACCESO[i.acceso].texto}</Insignia>
                      ),
                    },
                    {
                      clave: 'pagado',
                      titulo: 'Pagado hasta',
                      ancho: '17%',
                      render: (i) =>
                        i.pagadoHasta ? (
                          fechaLarga(i.pagadoHasta, 'UTC')
                        ) : (
                          <span className="text-tenue">—</span>
                        ),
                    },
                    {
                      clave: 'uso',
                      titulo: 'Uso',
                      ancho: '22%',
                      render: (i) => (
                        <span className="block truncate text-tenue" title={`${i.planificaciones} planificaciones · ${i.semanas} semanas · ${i.cuentas} cuentas`}>
                          {i.planificaciones} planif. · {i.semanas} sem. · {i.cuentas} cuentas
                        </span>
                      ),
                    },
                    {
                      clave: 'abrir',
                      titulo: '',
                      ancho: '56px',
                      alinear: 'der',
                      // Un icono, no un botón con texto en la fila: abre la institución en otra pestaña.
                      render: (i) => (
                        <a
                          href={conBase(`/${i.slug}/acceso`)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title="Abrir"
                          aria-label={`Abrir ${i.nombre}`}
                          className="foco-visible ml-auto flex h-8 w-8 items-center justify-center rounded-md border border-borde text-tenue transition-colors hover:bg-realce hover:text-texto"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      ),
                    },
                  ]}
                />
              </Tarjeta>
            </>
          )}

          {seccion === 'planes' && (
            <>
              <div className="flex items-center justify-end">
                <Boton icono={Plus} onClick={() => setPlanEdit('nuevo')}>
                  Nuevo plan
                </Boton>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {planes.map((p) => (
                  <Tarjeta key={p.id} className="flex flex-col p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold">{p.nombre}</p>
                        <p className="font-mono text-[11px] text-tenue">{p.slug}</p>
                      </div>
                      {!p.activo && <Insignia tono="neutro">Inactivo</Insignia>}
                    </div>
                    <p className="mt-3 text-[20px] font-semibold text-acento">
                      {p.precioMensual > 0 ? `${dinero(p.precioMensual, p.moneda)}` : 'Por definir'}
                      {p.precioMensual > 0 && (
                        <span className="text-[12px] font-normal text-tenue"> / mes</span>
                      )}
                    </p>
                    {p.descripcion && <p className="mt-2 text-[12px] text-tenue">{p.descripcion}</p>}
                    <ul className="mt-3 space-y-1 text-[12px]">
                      <li className="text-tenue">
                        Histórico: {p.mesesRetencion ? `${p.mesesRetencion} mes(es)` : 'sin límite'} · Cuentas: {p.maxUsuarios ?? 'sin límite'} ·
                        Generaciones/semana: {p.maxGeneracionesSemana ?? 'sin límite'}
                      </li>
                      {p.caracteristicas.map((c) => (
                        <li key={c} className="flex items-start gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-acento" />
                          {c}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto flex justify-end pt-4">
                      <Boton variante="secundario" onClick={() => setPlanEdit(p)}>
                        Editar
                      </Boton>
                    </div>
                  </Tarjeta>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Alta de institución */}
      <PanelLateral
        abierto={alta}
        alCerrar={cerrar}
        titulo="Nueva institución"
        pie={
          <PieAcciones>
            <Boton type="button" variante="secundario" onClick={cerrar} disabled={enCurso}>Cancelar</Boton>
            <Boton form="form-alta" type="submit" icono={Save} disabled={enCurso}>{enCurso ? 'Creando…' : 'Crear institución'}</Boton>
          </PieAcciones>
        }
      >
        <form id="form-alta" action={(d) => conResultado(() => crearInquilino(d))} className="space-y-4">
          <Campo etiqueta="Nombre" requerido>
            <Entrada name="nombre" required autoFocus />
          </Campo>
          <Campo etiqueta="Código" requerido>
            <Entrada name="slug" required placeholder="mi-colegio" className="font-mono" title="El primer tramo de su dirección" />
          </Campo>
          <Campo etiqueta="Plan" requerido>
            <Selector name="planId" required>
              {planes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                  {p.precioMensual > 0 ? ` — ${dinero(p.precioMensual, p.moneda)}/mes` : ''}
                </option>
              ))}
            </Selector>
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Días de prueba">
              <Entrada name="diasPrueba" type="number" min="0" max="365" defaultValue={30} />
            </Campo>
            <Campo etiqueta="Usuario del administrador">
              <Entrada name="usuarioAdmin" defaultValue="admin" className="font-mono" />
            </Campo>
          </div>
          <Campo etiqueta="Persona de contacto">
            <Entrada name="contactoNombre" />
          </Campo>
          <label className="flex items-center gap-2 text-[13px]" title="Para la administración del Grupo Corazones Cruzados: no paga mensualidad ni tiene topes. Todos los demás pasan por la suscripción.">
            <input type="checkbox" name="cortesia" className="h-4 w-4 accent-[var(--color-acento)]" />
            Acceso del grupo
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Correo">
              <Entrada name="contactoEmail" type="email" />
            </Campo>
            <Campo etiqueta="Teléfono">
              <Entrada name="contactoTelefono" />
            </Campo>
          </div>
        </form>
      </PanelLateral>

      {/* Detalle de institución */}
      <PanelLateral
        abierto={!!detalle}
        alCerrar={cerrar}
        titulo={detalle?.nombre ?? ''}
        descripcion={detalle ? `/${detalle.slug}` : undefined}
        ancho="lg"
      >
        {detalle && (
          <div className="space-y-5">
            <dl className="grid grid-cols-2 gap-3 text-[13px]">
              <Dato et="Acceso" v={ACCESO[detalle.acceso].texto} />
              <Dato et="Estado" v={detalle.estado} />
              <Dato et="Escritura" v={detalle.soloLectura ? 'Escaparate' : 'Normal'} />
              <Dato et="Mensualidad" v={detalle.cortesia ? 'Del grupo' : 'Suscripción'} />
              <Dato et="Plan" v={detalle.plan?.nombre ?? '—'} />
              <Dato
                et="Pagado hasta"
                v={
                  detalle.pagadoHasta
                    ? fechaLarga(detalle.pagadoHasta, 'UTC')
                    : '—'
                }
              />
              <Dato et="Contacto" v={detalle.contactoEmail ?? '—'} />
              <Dato et="Teléfono" v={detalle.contactoTelefono ?? '—'} />
            </dl>

            <section>
              <h3 className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-tenue">
                <CreditCard className="h-4 w-4" /> Registrar un cobro
              </h3>
              <form action={(d) => conResultado(() => registrarPago(d))} className="space-y-3">
                <input type="hidden" name="inquilinoId" value={detalle.id} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Campo etiqueta="Periodo" requerido>
                    <Entrada name="periodo" defaultValue={periodoActual()} placeholder="2026-08" required />
                  </Campo>
                  <Campo etiqueta="Importe" requerido>
                    <Entrada
                      name="monto"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={detalle.precioMensual}
                      required
                    />
                  </Campo>
                  <Campo etiqueta="Método">
                    <Selector name="metodo" defaultValue="AUTOSERVICIO">
                      <option value="AUTOSERVICIO">Autoservicio</option>
                      <option value="TARJETA">Tarjeta</option>
                    </Selector>
                  </Campo>
                </div>
                <Campo etiqueta="Referencia">
                  <Entrada name="referencia" placeholder="Nº de transferencia, comprobante…" />
                </Campo>
                <div className="flex justify-end">
                  <Boton type="submit" icono={Save} disabled={enCurso}>
                    {enCurso ? 'Registrando…' : 'Registrar pago'}
                  </Boton>
                </div>
              </form>
            </section>

            {detalle.pagos.length > 0 && (
              <section>
                <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-tenue">
                  Últimos cobros
                </h3>
                <ul className="divide-y divide-borde rounded border border-borde">
                  {detalle.pagos.map((p) => (
                    <li key={p.periodo} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                      <span className="font-mono">{p.periodo}</span>
                      <span className="flex-1 text-tenue">
                        {p.metodo === 'TARJETA' ? 'Tarjeta' : 'Autoservicio'}
                      </span>
                      <span className="font-semibold">{dinero(p.monto, detalle.moneda)}</span>
                      <Insignia tono={p.estado === 'PAGADO' ? 'exito' : 'aviso'}>
                        {p.estado === 'PAGADO' ? 'Pagado' : 'Pendiente'}
                      </Insignia>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="space-y-2 border-t border-borde pt-4">
              <h3 className="text-[12px] font-semibold uppercase tracking-wide text-tenue">Acciones</h3>
              <div className="flex flex-wrap gap-2">
                <Selector
                  className="w-48"
                  defaultValue={String(detalle.plan?.id ?? '')}
                  onChange={(e) => conResultado(() => cambiarPlan(detalle.id, Number(e.target.value)))}
                >
                  {planes.map((p) => (
                    <option key={p.id} value={p.id}>
                      Plan: {p.nombre}
                    </option>
                  ))}
                </Selector>
                <Boton
                  variante="secundario"
                  icono={KeyRound}
                  disabled={enCurso}
                  onClick={() => conResultado(() => restablecerClaveAdmin(detalle.id))}
                >
                  Nueva contraseña
                </Boton>
                <Boton
                  variante="secundario"
                  icono={detalle.soloLectura ? EyeOff : Eye}
                  disabled={enCurso}
                  onClick={() =>
                    conResultado(() => cambiarSoloLectura(detalle.id, !detalle.soloLectura))
                  }
                >
                  {detalle.soloLectura ? 'Quitar escaparate' : 'Poner en escaparate'}
                </Boton>
                <Boton
                  variante="secundario"
                  icono={detalle.cortesia ? ShieldOff : ShieldCheck}
                  disabled={enCurso}
                  title="El inquilino de la administración del grupo: sin mensualidad ni topes"
                  onClick={() => conResultado(() => cambiarCortesia(detalle.id, !detalle.cortesia))}
                >
                  {detalle.cortesia ? 'Quitar acceso del grupo' : 'Acceso del grupo'}
                </Boton>
                {detalle.estado === 'SUSPENDIDO' ? (
                  <Boton
                    variante="secundario"
                    icono={ShieldCheck}
                    disabled={enCurso}
                    onClick={() => conResultado(() => cambiarEstadoInquilino(detalle.id, 'ACTIVO'))}
                  >
                    Reactivar
                  </Boton>
                ) : (
                  <Boton
                    variante="secundario"
                    icono={ShieldOff}
                    className="text-error hover:text-error"
                    disabled={enCurso}
                    onClick={() => conResultado(() => cambiarEstadoInquilino(detalle.id, 'SUSPENDIDO'))}
                  >
                    Suspender
                  </Boton>
                )}
              </div>
            </section>
          </div>
        )}
      </PanelLateral>

      {/* Plan */}
      <PanelLateral
        abierto={planEdit !== null}
        alCerrar={cerrar}
        titulo={planEdit === 'nuevo' ? 'Nuevo plan' : 'Editar plan'}
        pie={
          <PieAcciones>
            <Boton type="button" variante="secundario" onClick={cerrar} disabled={enCurso}>Cancelar</Boton>
            <Boton form="form-plan" type="submit" icono={Save} disabled={enCurso}>{enCurso ? 'Guardando…' : 'Guardar'}</Boton>
          </PieAcciones>
        }
      >
        {planEdit !== null && (
          <form
            id="form-plan"
            action={(d) =>
              conResultado(() => guardarPlan(planEdit === 'nuevo' ? null : planEdit.id, d))
            }
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Nombre" requerido>
                <Entrada name="nombre" required defaultValue={planEdit === 'nuevo' ? '' : planEdit.nombre} />
              </Campo>
              <Campo etiqueta="Código" requerido>
                <Entrada
                  name="slug"
                  required
                  className="font-mono"
                  defaultValue={planEdit === 'nuevo' ? '' : planEdit.slug}
                />
              </Campo>
            </div>
            <Campo etiqueta="Mensualidad">
              <Entrada
                name="precioMensual"
                type="number"
                step="0.01"
                min="0"
                defaultValue={planEdit === 'nuevo' ? 0 : planEdit.precioMensual}
              />
            </Campo>
            <Campo etiqueta="Meses de histórico">
              <Entrada
                name="mesesRetencion"
                type="number"
                min="1"
                max="120"
                placeholder="Sin límite"
                defaultValue={planEdit === 'nuevo' ? '' : planEdit.mesesRetencion ?? ''}
              />
            </Campo>
            <Campo etiqueta="Descripción">
              <Entrada name="descripcion" defaultValue={planEdit === 'nuevo' ? '' : planEdit.descripcion ?? ''} />
            </Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Máx. cuentas activas">
                <Entrada
                  name="maxUsuarios"
                  type="number"
                  min="1"
                  placeholder="Sin límite"
                  defaultValue={planEdit === 'nuevo' ? '' : planEdit.maxUsuarios ?? ''}
                />
              </Campo>
              <Campo etiqueta="Generaciones por semana">
                <Entrada
                  name="maxGeneracionesSemana"
                  type="number"
                  min="1"
                  placeholder="Sin límite"
                  defaultValue={planEdit === 'nuevo' ? '' : planEdit.maxGeneracionesSemana ?? ''}
                />
              </Campo>
            </div>
            <Campo etiqueta="Características">
              <AreaTexto
                name="caracteristicas"
                rows={5}
                placeholder="Una por línea"
                defaultValue={planEdit === 'nuevo' ? '' : planEdit.caracteristicas.join('\n')}
              />
            </Campo>
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                name="activo"
                value="true"
                defaultChecked={planEdit === 'nuevo' ? true : planEdit.activo}
                className="h-4 w-4 accent-[var(--color-acento)]"
              />
              Plan activo
            </label>
          </form>
        )}
      </PanelLateral>
    </div>
  );
}

/** Cajita de dato, la de Automatizaciones. */
const Dato = ({ et, v }: { et: string; v: string }) => (
  <div className="min-w-0 rounded border border-borde bg-realce px-3 py-2">
    <dt className="text-[10.5px] font-semibold uppercase tracking-wide text-tenue">{et}</dt>
    <dd className="truncate text-[13px] font-semibold">{v}</dd>
  </div>
);

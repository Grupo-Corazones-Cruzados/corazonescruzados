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
  Pencil,
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
  EstadoVacio,
  Secciones,
  useSeccion,
  PieAcciones,
  type OpcionRail,
  type Tono,
} from '@/componentes/ui';
import { MenuFila } from '@/componentes/Navegacion';
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
import { dinero, fechaCorta } from '@/lib/formato';
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
  mesas: number;
  pedidos: number;
  pagos: PagoGcc[];
};

export type PlanGcc = {
  id: number;
  slug: string;
  nombre: string;
  descripcion: string | null;
  precioMensual: number;
  moneda: string;
  maxMesas: number | null;
  maxProductos: number | null;
  maxUsuarios: number | null;
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

const SECCIONES: OpcionRail[] = [
  { valor: 'negocios', etiqueta: 'Negocios', icono: Building2 },
  { valor: 'planes', etiqueta: 'Planes', icono: Layers },
];

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
  const s = useSeccion(SECCIONES.map((o) => ({ ...o, conteo: o.valor === 'negocios' ? inquilinos.length : planes.length })));
  const seccion = s.activo;
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
      if (!r.ok) {
        toast.error(r.error ?? 'No se pudo completar la acción.');
        return;
      }
      if (r.clave) setCredencial({ texto: r.mensaje ?? 'Contraseña generada', clave: r.clave });
      toast.success(r.mensaje ?? 'Hecho.');
      cerrar();
      router.refresh();
    });

  const vencidos = inquilinos.filter((i) => i.acceso !== 'ok').length;
  // Ni el inquilino del grupo ni un escaparate pagan: no suman a la mensualidad activa.
  const ingresoMensual = inquilinos
    .filter((i) => i.acceso === 'ok' && !i.cortesia && !i.soloLectura)
    .reduce((a, i) => a + i.precioMensual, 0);

  return (
    // Alto completo, como el armazón de los negocios: la cabecera mide 68 px y el panel de la
    // derecha (la tarjeta de `Secciones`) llega al pie.
    <div className="flex h-dvh flex-col bg-fondo">
      <header className="flex min-h-[68px] shrink-0 items-center justify-between gap-3 border-b border-borde bg-tarjeta px-4 py-2 sm:px-6">
        <div className="min-w-0">
          <h1 className="truncate text-[17px] font-semibold leading-6 text-texto">
            {s.enUrl ? <><span className="lg:hidden">{s.etiqueta}</span><span className="hidden lg:inline">Equipo GCC</span></> : 'Equipo GCC'}
          </h1>
          <p className="mt-0.5 truncate text-[12px] leading-4 text-tenue">Gestión de Pedidos · {operador}</p>
        </div>
        <form action={salirOperador}>
          <Boton variante="fantasma" icono={LogOut} type="submit">
            Cerrar sesión
          </Boton>
        </form>
      </header>

      <Secciones opciones={SECCIONES} seccion={s}>
          {credencial && (
            <Tarjeta className="m-4 mb-0 flex flex-wrap items-center gap-3 border-acento p-4">
              <KeyRound className="h-5 w-5 shrink-0 text-acento" />
              <p className="min-w-0 flex-1 text-[13px] font-semibold">{credencial.texto}</p>
              <code className="rounded border border-borde bg-tarjeta px-3 py-1.5 font-mono text-[14px] font-semibold">
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

          {seccion === 'negocios' && (
            <div className="flex flex-1 flex-col">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
                {[
                  { et: 'Negocios', v: String(inquilinos.length) },
                  { et: 'Al día', v: String(inquilinos.length - vencidos) },
                  { et: 'Mensualidad activa', v: dinero(ingresoMensual) },
                ].map((c) => (
                  <div key={c.et}>
                    <p className="text-[10.5px] font-semibold uppercase tracking-wide text-tenue">{c.et}</p>
                    <p className="text-[17px] font-semibold tabular-nums text-texto">{c.v}</p>
                  </div>
                ))}
                <Boton icono={Plus} className="ml-auto" onClick={() => setAlta(true)} disabled={!planes.length}>
                  Nuevo negocio
                </Boton>
              </div>

                <Tabla
                  filas={inquilinos}
                  claveFila={(i) => i.id}
                  alPulsarFila={(i) => setDetalle(i)}
                  recuento={`${inquilinos.length} ${inquilinos.length === 1 ? 'negocio' : 'negocios'}`}
                  vacio={
                    <div className="flex flex-1 flex-col justify-center">
                      <EstadoVacio icono={Building2} titulo="Todavía no hay negocios" />
                    </div>
                  }
                  columnas={[
                    {
                      clave: 'nombre',
                      titulo: 'Negocio',
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
                      render: (i) => (
                        <span className="flex items-center gap-2">
                          {i.plan?.nombre ?? '—'}
                          {i.soloLectura && <Insignia tono="info">Escaparate</Insignia>}
                          {i.cortesia && <Insignia tono="exito">Del grupo</Insignia>}
                        </span>
                      ),
                    },
                    {
                      clave: 'acceso',
                      titulo: 'Acceso',
                      render: (i) => (
                        <Insignia tono={ACCESO[i.acceso].tono}>{ACCESO[i.acceso].texto}</Insignia>
                      ),
                    },
                    {
                      clave: 'pagado',
                      titulo: 'Pagado hasta',
                      render: (i) =>
                        i.pagadoHasta ? (
                          fechaCorta(i.pagadoHasta, 'UTC')
                        ) : (
                          <span className="text-tenue">—</span>
                        ),
                    },
                    {
                      clave: 'uso',
                      titulo: 'Uso',
                      render: (i) => (
                        <span className="text-tenue">
                          {i.mesas} mesas · {i.pedidos} pedidos · {i.cuentas} cuentas
                        </span>
                      ),
                    },
                    {
                      clave: 'acciones',
                      titulo: '',
                      ancho: '56px',
                      alinear: 'der',
                      render: (i) => (
                        <div className="flex justify-end">
                          <MenuFila
                            acciones={[
                              { etiqueta: 'Detalles', icono: Pencil, alPulsar: () => setDetalle(i) },
                              { etiqueta: 'Abrir', icono: ExternalLink, alPulsar: () => window.open(conBase(`/${i.slug}/acceso`), '_blank', 'noreferrer') },
                            ]}
                          />
                        </div>
                      ),
                    },
                  ]}
                />
            </div>
          )}

          {seccion === 'planes' && (
            <div className="flex flex-1 flex-col">
              <div className="flex justify-end px-4 py-3">
                <Boton icono={Plus} onClick={() => setPlanEdit('nuevo')}>
                  Nuevo plan
                </Boton>
              </div>
              <Tabla
                filas={planes}
                claveFila={(p) => p.id}
                alPulsarFila={(p) => setPlanEdit(p)}
                recuento={`${planes.length} ${planes.length === 1 ? 'plan' : 'planes'}`}
                columnas={[
                  { clave: 'nombre', titulo: 'Plan', ancho: '28%', render: (p) => (
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-texto">{p.nombre}</p>
                      <p className="truncate font-mono text-[11px] text-tenue">{p.slug}</p>
                    </div>
                  ) },
                  { clave: 'precio', titulo: 'Mensualidad', ancho: '16%', alinear: 'der', render: (p) => (
                    <span className="font-semibold tabular-nums text-acento">{p.precioMensual > 0 ? dinero(p.precioMensual, p.moneda) : 'Por definir'}</span>
                  ) },
                  { clave: 'historico', titulo: 'Histórico', ancho: '14%', render: (p) => (p.mesesRetencion ? `${p.mesesRetencion} ${p.mesesRetencion === 1 ? 'mes' : 'meses'}` : 'Sin límite') },
                  { clave: 'topes', titulo: 'Mesas · productos · cuentas', ancho: '26%', render: (p) => (
                    <span className="text-tenue">{p.maxMesas ?? '∞'} · {p.maxProductos ?? '∞'} · {p.maxUsuarios ?? '∞'}</span>
                  ) },
                  { clave: 'estado', titulo: 'Estado', ancho: '10%', render: (p) => (
                    <Insignia tono={p.activo ? 'exito' : 'neutro'}>{p.activo ? 'Activo' : 'Inactivo'}</Insignia>
                  ) },
                  { clave: 'acciones', titulo: '', ancho: '56px', alinear: 'der', render: (p) => (
                    <div className="flex justify-end">
                      <MenuFila acciones={[{ etiqueta: 'Editar', icono: Pencil, alPulsar: () => setPlanEdit(p) }]} />
                    </div>
                  ) },
                ]}
              />
            </div>
          )}
      </Secciones>
      {/* Alta de alojamiento */}
      <PanelLateral
        abierto={alta}
        alCerrar={cerrar}
        titulo="Nuevo negocio"
        pie={
          <PieAcciones>
            <Boton type="button" variante="secundario" onClick={cerrar} disabled={enCurso}>
              Cancelar
            </Boton>
            <Boton form="form-alta" type="submit" icono={Save} disabled={enCurso}>
              {enCurso ? 'Creando…' : 'Crear negocio'}
            </Boton>
          </PieAcciones>
        }
      >
        <form id="form-alta" action={(d) => conResultado(() => crearInquilino(d))} className="space-y-4">
          <Campo etiqueta="Nombre del negocio" requerido>
            <Entrada name="nombre" required autoFocus />
          </Campo>
          <Campo etiqueta="Código" requerido>
            <Entrada name="slug" required placeholder="mi-restaurante" className="font-mono" />
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
          <label className="flex items-center gap-2 text-[13px]" title="Para la administración del Grupo Corazones Cruzados: no paga mensualidad ni tiene topes">
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

      {/* Detalle de alojamiento */}
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
                    ? fechaCorta(detalle.pagadoHasta, 'UTC')
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
                  <Boton type="submit" disabled={enCurso}>
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
                  Contraseña del admin
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
                    className="text-error"
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
            <Boton type="button" variante="secundario" onClick={cerrar} disabled={enCurso}>
              Cancelar
            </Boton>
            <Boton form="form-plan" type="submit" icono={Save} disabled={enCurso}>
              {enCurso ? 'Guardando…' : 'Guardar'}
            </Boton>
          </PieAcciones>
        }
      >
        {planEdit !== null && (
          <form
            id="form-plan"
            key={planEdit === 'nuevo' ? 'nuevo' : planEdit.id}
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
                defaultValue={planEdit === 'nuevo' ? 1 : planEdit.mesesRetencion ?? ''}
              />
            </Campo>
            <Campo etiqueta="Descripción">
              <Entrada name="descripcion" defaultValue={planEdit === 'nuevo' ? '' : planEdit.descripcion ?? ''} />
            </Campo>
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo etiqueta="Máx. mesas">
                <Entrada
                  name="maxMesas"
                  type="number"
                  min="1"
                  placeholder="Sin límite"
                  defaultValue={planEdit === 'nuevo' ? '' : planEdit.maxMesas ?? ''}
                />
              </Campo>
              <Campo etiqueta="Máx. productos">
                <Entrada
                  name="maxProductos"
                  type="number"
                  min="1"
                  placeholder="Sin límite"
                  defaultValue={planEdit === 'nuevo' ? '' : planEdit.maxProductos ?? ''}
                />
              </Campo>
              <Campo etiqueta="Máx. cuentas">
                <Entrada
                  name="maxUsuarios"
                  type="number"
                  min="1"
                  placeholder="Sin límite"
                  defaultValue={planEdit === 'nuevo' ? '' : planEdit.maxUsuarios ?? ''}
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

const Dato = ({ et, v }: { et: string; v: string }) => (
  <div>
    <dt className="text-[11px] uppercase tracking-wide text-tenue">{et}</dt>
    <dd className="font-semibold text-texto">{v}</dd>
  </div>
);


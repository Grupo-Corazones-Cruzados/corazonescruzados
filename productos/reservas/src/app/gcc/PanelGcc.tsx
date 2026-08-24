'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
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
  AlertCircle,
  Copy,
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
  type Tono,
} from '@/componentes/ui';
import { salirOperador } from '@/acciones/acceso';
import {
  crearInquilino,
  registrarPago,
  cambiarEstadoInquilino,
  cambiarPlan,
  cambiarSoloLectura,
  guardarPlan,
  restablecerClaveAdmin,
} from '@/acciones/gcc';
import { dinero } from '@/lib/formato';
import type { EstadoAcceso } from '@/lib/inquilino';

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
  suites: number;
  reservas: number;
  pagos: PagoGcc[];
};

export type PlanGcc = {
  id: number;
  slug: string;
  nombre: string;
  descripcion: string | null;
  precioMensual: number;
  moneda: string;
  maxUbicaciones: number | null;
  maxSuites: number | null;
  maxUsuarios: number | null;
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
  const [seccion, setSeccion] = useState<'alojamientos' | 'planes'>('alojamientos');
  const [alta, setAlta] = useState(false);
  const [detalle, setDetalle] = useState<InquilinoGcc | null>(null);
  const [planEdit, setPlanEdit] = useState<PlanGcc | null | 'nuevo'>(null);
  const [credencial, setCredencial] = useState<{ texto: string; clave: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enCurso, arranca] = useTransition();

  const cerrar = () => {
    setAlta(false);
    setDetalle(null);
    setPlanEdit(null);
    setError(null);
  };

  const conResultado = (
    fn: () => Promise<{ ok: boolean; error?: string; mensaje?: string; clave?: string; slug?: string }>,
  ) =>
    arranca(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) {
        setError(r.error ?? 'No se pudo completar la acción');
        return;
      }
      if (r.clave) setCredencial({ texto: r.mensaje ?? 'Contraseña generada', clave: r.clave });
      toast.success(r.mensaje ?? 'Hecho');
      cerrar();
      router.refresh();
    });

  const vencidos = inquilinos.filter((i) => i.acceso !== 'ok').length;
  const ingresoMensual = inquilinos
    .filter((i) => i.acceso === 'ok')
    .reduce((a, i) => a + i.precioMensual, 0);

  return (
    <div className="min-h-screen bg-fondo">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-borde bg-tarjeta px-4 py-3.5 sm:px-6">
        <div>
          <h1 className="text-[17px] font-semibold">Gestión de Reservas · Equipo GCC</h1>
          <p className="text-[12px] text-tenue">{operador}</p>
        </div>
        <form action={salirOperador}>
          <Boton variante="fantasma" icono={LogOut} type="submit">
            Cerrar sesión
          </Boton>
        </form>
      </header>

      <div className="flex flex-col gap-4 p-4 sm:p-6 lg:flex-row">
        <RailFiltro
          opciones={[
            { valor: 'alojamientos', etiqueta: 'Alojamientos', icono: Building2, conteo: inquilinos.length },
            { valor: 'planes', etiqueta: 'Planes', icono: Layers, conteo: planes.length },
          ]}
          activo={seccion}
          alElegir={(v) => setSeccion(v as 'alojamientos' | 'planes')}
        />

        <div className="min-w-0 flex-1 space-y-4">
          {credencial && (
            <Tarjeta className="flex flex-wrap items-center gap-3 border-acento bg-acento-suave p-4">
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
                  toast.success('Copiada');
                }}
              >
                Copiar
              </Boton>
              <Boton variante="fantasma" onClick={() => setCredencial(null)}>
                Ocultar
              </Boton>
            </Tarjeta>
          )}

          {seccion === 'alojamientos' && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { et: 'Alojamientos', v: String(inquilinos.length) },
                  { et: 'Con la mensualidad al día', v: String(inquilinos.length - vencidos) },
                  { et: 'Mensualidad activa', v: dinero(ingresoMensual) },
                ].map((c) => (
                  <Tarjeta key={c.et} className="p-4">
                    <p className="text-[11px] uppercase tracking-wide text-tenue">{c.et}</p>
                    <p className="mt-1 text-[20px] font-semibold">{c.v}</p>
                  </Tarjeta>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <h2 className="text-[14px] font-semibold">Alojamientos</h2>
                <Boton icono={Plus} onClick={() => setAlta(true)} disabled={!planes.length}>
                  Nuevo alojamiento
                </Boton>
              </div>

              <Tarjeta className="overflow-hidden">
                <Tabla
                  filas={inquilinos}
                  claveFila={(i) => i.id}
                  alPulsarFila={(i) => setDetalle(i)}
                  vacio={
                    <EstadoVacio
                      icono={Building2}
                      titulo="Todavía no hay alojamientos"
                      detalle="Da de alta el primero y entrégale su dirección y su contraseña."
                    />
                  }
                  columnas={[
                    {
                      clave: 'nombre',
                      titulo: 'Alojamiento',
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
                          format(new Date(i.pagadoHasta), 'd MMM yyyy', { locale: es })
                        ) : (
                          <span className="text-tenue">—</span>
                        ),
                    },
                    {
                      clave: 'uso',
                      titulo: 'Uso',
                      render: (i) => (
                        <span className="text-tenue">
                          {i.suites} suites · {i.reservas} reservas · {i.cuentas} cuentas
                        </span>
                      ),
                    },
                    {
                      clave: 'abrir',
                      titulo: '',
                      alinear: 'der',
                      render: (i) => (
                        <a
                          href={`/${i.slug}/acceso`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[12px] font-semibold text-acento hover:underline"
                        >
                          Abrir <ExternalLink className="h-3.5 w-3.5" />
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
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[14px] font-semibold">Planes</h2>
                  <p className="text-[12px] text-tenue">
                    Los niveles de acceso por mensualidad. Un tope vacío significa «sin límite».
                  </p>
                </div>
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
                        Ubicaciones: {p.maxUbicaciones ?? 'sin límite'} · Suites:{' '}
                        {p.maxSuites ?? 'sin límite'} · Cuentas: {p.maxUsuarios ?? 'sin límite'}
                      </li>
                      {p.caracteristicas.map((c) => (
                        <li key={c} className="flex items-start gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-acento" />
                          {c}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto pt-4">
                      <Boton variante="secundario" className="w-full" onClick={() => setPlanEdit(p)}>
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

      {/* Alta de alojamiento */}
      <PanelLateral
        abierto={alta}
        alCerrar={cerrar}
        titulo="Nuevo alojamiento"
        descripcion="Se crea el alojamiento, su suscripción y la cuenta de administrador."
      >
        <form action={(d) => conResultado(() => crearInquilino(d))} className="space-y-4">
          <Campo etiqueta="Nombre del alojamiento" requerido>
            <Entrada name="nombre" required autoFocus />
          </Campo>
          <Campo etiqueta="Código (primer tramo de su dirección)" requerido>
            <Entrada name="slug" required placeholder="carliza" className="font-mono" />
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
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Correo">
              <Entrada name="contactoEmail" type="email" />
            </Campo>
            <Campo etiqueta="Teléfono">
              <Entrada name="contactoTelefono" />
            </Campo>
          </div>
          {error && <Aviso texto={error} />}
          <div className="flex justify-end gap-2 border-t border-borde pt-4">
            <Boton type="button" variante="secundario" onClick={cerrar} disabled={enCurso}>
              Cancelar
            </Boton>
            <Boton type="submit" disabled={enCurso}>
              {enCurso ? 'Creando…' : 'Crear alojamiento'}
            </Boton>
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
              <Dato et="Escritura" v={detalle.soloLectura ? 'Escaparate (solo lectura)' : 'Normal'} />
              <Dato et="Plan" v={detalle.plan?.nombre ?? '—'} />
              <Dato
                et="Pagado hasta"
                v={
                  detalle.pagadoHasta
                    ? format(new Date(detalle.pagadoHasta), 'd MMM yyyy', { locale: es })
                    : '—'
                }
              />
              <Dato et="Contacto" v={detalle.contactoEmail ?? '—'} />
              <Dato et="Teléfono" v={detalle.contactoTelefono ?? '—'} />
            </dl>

            <section>
              <h3 className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-tenue">
                <CreditCard className="h-4 w-4" /> Registrar el cobro de un mes
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
                <Boton type="submit" disabled={enCurso}>
                  {enCurso ? 'Registrando…' : 'Registrar pago'}
                </Boton>
              </form>
            </section>

            {detalle.pagos.length > 0 && (
              <section>
                <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-tenue">
                  Últimos cobros
                </h3>
                <ul className="divide-y divide-[var(--color-borde)] rounded border border-borde">
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
                  Contraseña del administrador
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
              {error && <Aviso texto={error} />}
            </section>
          </div>
        )}
      </PanelLateral>

      {/* Plan */}
      <PanelLateral
        abierto={planEdit !== null}
        alCerrar={cerrar}
        titulo={planEdit === 'nuevo' ? 'Nuevo plan' : 'Editar plan'}
        descripcion="Un tope vacío significa «sin límite»."
      >
        {planEdit !== null && (
          <form
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
            <Campo etiqueta="Descripción">
              <Entrada name="descripcion" defaultValue={planEdit === 'nuevo' ? '' : planEdit.descripcion ?? ''} />
            </Campo>
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo etiqueta="Máx. ubicaciones">
                <Entrada
                  name="maxUbicaciones"
                  type="number"
                  min="1"
                  placeholder="Sin límite"
                  defaultValue={planEdit === 'nuevo' ? '' : planEdit.maxUbicaciones ?? ''}
                />
              </Campo>
              <Campo etiqueta="Máx. suites">
                <Entrada
                  name="maxSuites"
                  type="number"
                  min="1"
                  placeholder="Sin límite"
                  defaultValue={planEdit === 'nuevo' ? '' : planEdit.maxSuites ?? ''}
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
            <Campo etiqueta="Características (una por línea)">
              <AreaTexto
                name="caracteristicas"
                rows={5}
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
            {error && <Aviso texto={error} />}
            <div className="flex justify-end gap-2 border-t border-borde pt-4">
              <Boton type="button" variante="secundario" onClick={cerrar} disabled={enCurso}>
                Cancelar
              </Boton>
              <Boton type="submit" disabled={enCurso}>
                {enCurso ? 'Guardando…' : 'Guardar plan'}
              </Boton>
            </div>
          </form>
        )}
      </PanelLateral>
    </div>
  );
}

const Dato = ({ et, v }: { et: string; v: string }) => (
  <div>
    <dt className="text-[11px] uppercase tracking-wide text-tenue">{et}</dt>
    <dd className="font-semibold">{v}</dd>
  </div>
);

const Aviso = ({ texto }: { texto: string }) => (
  <p
    role="alert"
    className="flex items-start gap-2 rounded border border-borde bg-error-suave px-3 py-2 text-[12px] text-error"
  >
    <AlertCircle className="mt-px h-4 w-4 shrink-0" />
    {texto}
  </p>
);

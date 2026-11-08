'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Building2, LayoutGrid, Users, CreditCard, KeyRound, Plus, Pencil, Trash2, Upload, Save, UserPlus } from 'lucide-react';
import { CabeceraPagina, MenuFila } from '@/componentes/Navegacion';
import {
  Boton,
  BotonIcono,
  Campo,
  Entrada,
  Selector,
  Tarjeta,
  PanelLateral,
  Confirmar,
  Insignia,
  EstadoVacio,
  Tabla,
  Secciones,
  useSeccion,
  PieAcciones,
  BotonEliminar,
  type OpcionRail,
} from '@/componentes/ui';
import { LogoHotel } from '@/componentes/Marca';
import { calcularCuenta } from '@/lib/pedidos';
import { dinero, fechaLarga, numEntero } from '@/lib/formato';
import { cambiarMiClave } from '@/acciones/usuarios';
import { guardarNegocio, subirLogo, quitarLogo } from '@/acciones/configuracion';
import { guardarZona, eliminarZona, guardarMesa, eliminarMesa } from '@/acciones/mesas';
import SeccionUsuarios, { type UsuarioVista } from './SeccionUsuarios';

type MesaVista = { id: number; nombre: string; capacidad: number | null; pedidos: number };
type ZonaVista = { id: number; nombre: string; mesas: MesaVista[] };
type NegocioVista = {
  nombre: string;
  logoUrl: string | null;
  moneda: string;
  aplicaIva: boolean;
  ivaPorcentaje: number;
  precioConIva: boolean;
};
type Plan = {
  nombre: string;
  precioMensual: number;
  moneda: string;
  pagadoHasta: string | null;
  mesesRetencion: number | null;
  caracteristicas: string[];
};
export type PagoVista = {
  id: number; periodo: string; monto: number; moneda: string; estado: string; metodo: string; pagadoEn: string | null;
};
type Cupo = { tope: number | null; usadas: number; quedan: number | null };

type Seccion = 'negocio' | 'mesas' | 'usuarios' | 'suscripcion' | 'cuenta';

/**
 * CONFIGURACIÓN COMO EN AUTOMATIZACIONES (2026-11-08): Negocio · Zonas y mesas · Usuarios ·
 * Suscripción · Mi cuenta, con la sección en `?seccion=` (portada de secciones en el teléfono).
 * «Zonas y mesas» es de este producto: el tablero de Mesas se dibuja sobre ellas.
 */
const SECCIONES: OpcionRail[] = [
  { valor: 'negocio', etiqueta: 'Negocio', icono: Building2 },
  { valor: 'mesas', etiqueta: 'Zonas y mesas', icono: LayoutGrid },
  { valor: 'usuarios', etiqueta: 'Usuarios', icono: Users },
  { valor: 'suscripcion', etiqueta: 'Suscripción', icono: CreditCard },
  { valor: 'cuenta', etiqueta: 'Mi cuenta', icono: KeyRound },
];

export default function ConfiguracionCliente({
  slug,
  zona,
  negocio,
  plan,
  pagos,
  usuarios,
  zonas,
}: {
  slug: string;
  zona: string;
  negocio: NegocioVista;
  plan: Plan | null;
  pagos: PagoVista[];
  usuarios: { lista: UsuarioVista[]; cupo: Cupo; yoSoy: number };
  zonas: ZonaVista[];
}) {
  const s = useSeccion(SECCIONES);
  const seccion = s.activo as Seccion;
  const [crearUsuario, setCrearUsuario] = useState(false);
  const [nuevaZona, setNuevaZona] = useState(false);
  const sinSitio = usuarios.cupo.quedan !== null && usuarios.cupo.quedan <= 0;

  // Los principales de cada sección: en escritorio viven en su sección; en el teléfono bajan a
  // la barra de acciones (regla §4-nonies), unidos a su formulario por `form=`.
  const principalTelefono =
    s.enUrl && seccion === 'negocio' ? <Boton form="form-negocio" type="submit" icono={Save}>Guardar</Boton>
    : s.enUrl && seccion === 'mesas' ? <Boton icono={Plus} onClick={() => setNuevaZona(true)}>Nueva zona</Boton>
    : s.enUrl && seccion === 'usuarios' ? <Boton icono={UserPlus} disabled={sinSitio} onClick={() => setCrearUsuario(true)}>Crear usuario</Boton>
    : s.enUrl && seccion === 'cuenta' ? <Boton form="form-clave" type="submit" icono={Save}>Cambiar contraseña</Boton>
    : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <CabeceraPagina
        titulo="Configuración"
        descripcion="Tu negocio, las mesas, quién entra, la suscripción y tu cuenta"
        tituloTelefono={s.enUrl ? s.etiqueta : undefined}
        volverTelefono={s.enUrl ? { href: s.hrefPortada, etiqueta: 'Volver a Configuración' } : undefined}
        accionesTelefono={principalTelefono}
      />
      <Secciones opciones={SECCIONES} seccion={s}>
        {seccion === 'negocio' && <SeccionNegocio slug={slug} negocio={negocio} />}
        {seccion === 'mesas' && <SeccionLugares slug={slug} zonas={zonas} nuevaZona={nuevaZona} setNuevaZona={setNuevaZona} />}
        {seccion === 'usuarios' && (
          <SeccionUsuarios
            slug={slug}
            zona={zona}
            usuarios={usuarios.lista}
            yoSoy={usuarios.yoSoy}
            cupo={usuarios.cupo}
            abierto={crearUsuario}
            setAbierto={setCrearUsuario}
          />
        )}
        {seccion === 'suscripcion' && <SeccionSuscripcion plan={plan} pagos={pagos} zona={zona} />}
        {seccion === 'cuenta' && <SeccionCuenta slug={slug} />}
      </Secciones>
    </div>
  );
}

// ── Negocio ─────────────────────────────────────────────────────────────────
/**
 * NEGOCIO (antes «Marca» y «Facturación», 2026-11-08): sin color ni tema —el producto tiene un
 * solo tema—. El logo se SUBE como archivo y queda puesto al subirlo; ya no se escribe una dirección.
 */
function SeccionNegocio({ slug, negocio }: { slug: string; negocio: NegocioVista }) {
  const router = useRouter();
  const [enCurso, arranca] = useTransition();
  const [quitar, setQuitar] = useState(false);
  const [aplica, setAplica] = useState(negocio.aplicaIva);
  const [dentro, setDentro] = useState(negocio.precioConIva);
  const [tasa, setTasa] = useState(String(negocio.ivaPorcentaje));
  const [moneda, setMoneda] = useState(negocio.moneda);
  const archivo = useRef<HTMLInputElement>(null);

  // Un ejemplo con números reales: es la única forma de que se entienda la diferencia entre
  // «el precio ya lleva IVA» y «se le suma». La aritmética es la del pedido (`calcularCuenta`).
  const ejemplo = calcularCuenta([{ precioUnitario: 10, cantidad: 1 }], {
    aplicaIva: aplica,
    ivaPorcentaje: Number(tasa) || 0,
    precioConIva: dentro,
  });

  function subir(f: File) {
    const fd = new FormData();
    fd.set('archivo', f);
    arranca(async () => {
      const r = await subirLogo(slug, fd);
      if (!r.ok) { toast.error(r.error); return; }
      toast.success('Logo subido.');
      router.refresh();
    });
  }

  return (
    <div className="flex flex-1 flex-col p-4 sm:p-5">
      <form
        id="form-negocio"
        action={(d) =>
          arranca(async () => {
            const r = await guardarNegocio(slug, d);
            if (!r.ok) { toast.error(r.error); return; }
            toast.success('Guardado.');
            router.refresh();
          })
        }
        className="space-y-5"
      >
        <div className="flex items-center gap-3">
          <LogoHotel nombre={negocio.nombre} logoUrl={negocio.logoUrl} tamano={52} />
          <input
            ref={archivo}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) subir(f); }}
          />
          <Boton
            variante="secundario"
            type="button"
            icono={Upload}
            onClick={() => archivo.current?.click()}
            disabled={enCurso}
          >
            {negocio.logoUrl ? 'Cambiar logo' : 'Subir logo'}
          </Boton>
          {negocio.logoUrl && (
            <BotonIcono icono={Trash2} titulo="Quitar el logo" onClick={() => setQuitar(true)} disabled={enCurso} />
          )}
        </div>

        <Grupo titulo="Negocio">
          <Campo etiqueta="Nombre comercial" requerido>
            <Entrada name="nombre" defaultValue={negocio.nombre} required />
          </Campo>
          <Campo etiqueta="Moneda" requerido>
            <Selector name="moneda" value={moneda} onChange={(e) => setMoneda(e.target.value)}>
              {['USD', 'EUR', 'COP', 'PEN', 'MXN', 'CLP', 'ARS'].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Selector>
          </Campo>
        </Grupo>

        <Grupo titulo="Facturación">
          <Campo etiqueta="IVA">
            <Selector value={aplica ? 'si' : 'no'} onChange={(e) => setAplica(e.target.value === 'si')}>
              <option value="si">Se cobra</option>
              <option value="no">No se cobra</option>
            </Selector>
            <input type="hidden" name="aplicaIva" value={aplica ? 'true' : 'false'} />
          </Campo>
          {aplica && (
            <>
              <Campo etiqueta="Porcentaje (%)" requerido>
                <Entrada name="ivaPorcentaje" type="number" step="0.01" min="0" max="99" value={tasa} onChange={(e) => setTasa(e.target.value)} />
              </Campo>
              <Campo etiqueta="Precios de la carta">
                <Selector
                  value={dentro ? 'dentro' : 'fuera'}
                  onChange={(e) => setDentro(e.target.value === 'dentro')}
                  title="Cambiarlo no toca los pedidos cobrados: cada uno guarda su tasa"
                >
                  <option value="dentro">Incluyen el IVA</option>
                  <option value="fuera">Se suma al cobrar</option>
                </Selector>
                <input type="hidden" name="precioConIva" value={dentro ? 'true' : 'false'} />
              </Campo>
            </>
          )}
        </Grupo>

        {/* El ejemplo: un producto de 10 en la carta y lo que paga el cliente. */}
        <div className="grid max-w-xl grid-cols-3 gap-3 rounded-md border border-borde bg-realce p-3 text-[13px]">
          <Dato titulo={`Carta ${dinero(10, moneda)}`}>{dinero(ejemplo.subtotal, moneda)}<span className="ml-1 text-[11px] text-tenue">base</span></Dato>
          <Dato titulo="IVA">{dinero(ejemplo.iva, moneda)}</Dato>
          <Dato titulo="Cobra">{<span className="text-acento">{dinero(ejemplo.total, moneda)}</span>}</Dato>
        </div>

        <div className="hidden justify-end lg:flex">
          <Boton type="submit" tamano="lg" icono={Save} disabled={enCurso}>
            {enCurso ? 'Guardando…' : 'Guardar'}
          </Boton>
        </div>
      </form>

      <Confirmar
        abierto={quitar}
        titulo="¿Quitar el logo?"
        mensaje="En su lugar se verá la inicial del negocio."
        textoAceptar="Quitar"
        ocupado={enCurso}
        alCerrar={() => setQuitar(false)}
        alAceptar={() =>
          arranca(async () => {
            const r = await quitarLogo(slug);
            if (!r.ok) { toast.error(r.error); return; }
            setQuitar(false);
            toast.success('Quitado.');
            router.refresh();
          })
        }
      />
    </div>
  );
}

/** Un grupo de campos con su rótulo, en rejilla: se aprovecha el ancho. */
function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-borde pt-4">
      <legend className="pr-2 text-[11px] font-semibold uppercase tracking-wide text-tenue">{titulo}</legend>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </fieldset>
  );
}

function Dato({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[10.5px] font-semibold uppercase tracking-wide text-tenue">{titulo}</p>
      <p className="truncate font-semibold tabular-nums text-texto">{children}</p>
    </div>
  );
}

// ── Zonas y mesas ───────────────────────────────────────────────────────────
type FilaLugar =
  | { tipo: 'zona'; clave: string; z: ZonaVista }
  | { tipo: 'mesa'; clave: string; z: ZonaVista; m: MesaVista };

function SeccionLugares({
  slug,
  zonas,
  nuevaZona,
  setNuevaZona,
}: {
  slug: string;
  zonas: ZonaVista[];
  /** «Nueva zona» lo abre también la barra del teléfono (en Configuración). */
  nuevaZona: boolean;
  setNuevaZona: (v: boolean) => void;
}) {
  const router = useRouter();
  const [panelZona, setPanelZona] = useState<ZonaVista | null>(null);
  const [panelMesa, setPanelMesa] = useState<{ m: MesaVista | null; zonaId: number } | null>(null);
  const [borrar, setBorrar] = useState<{ tipo: 'zona' | 'mesa'; id: number; nombre: string } | null>(null);
  const [enCurso, arranca] = useTransition();

  const cerrar = () => { setPanelZona(null); setNuevaZona(false); setPanelMesa(null); setBorrar(null); };
  const hecho = (m: string) => { toast.success(m); cerrar(); router.refresh(); };
  const zonaAbierta = nuevaZona || panelZona !== null;

  // Una tabla con la zona como fila de cabecera y sus mesas debajo: todo a la vista y con
  // las acciones de cada fila en «⋯».
  const filas: FilaLugar[] = zonas.flatMap((z) => [
    { tipo: 'zona' as const, clave: `z${z.id}`, z },
    ...z.mesas.map((m) => ({ tipo: 'mesa' as const, clave: `m${m.id}`, z, m })),
  ]);
  const totalMesas = zonas.reduce((a, z) => a + z.mesas.length, 0);

  return (
    <div className="flex flex-1 flex-col">
      <div className="hidden justify-end px-4 py-3 lg:flex">
        <Boton icono={Plus} onClick={() => setNuevaZona(true)}>Nueva zona</Boton>
      </div>

      <Tabla
        filas={filas}
        claveFila={(f) => f.clave}
        alPulsarFila={(f) => (f.tipo === 'zona' ? setPanelZona(f.z) : setPanelMesa({ m: f.m, zonaId: f.z.id }))}
        recuento={`${zonas.length} ${zonas.length === 1 ? 'zona' : 'zonas'} · ${totalMesas} ${totalMesas === 1 ? 'mesa' : 'mesas'}`}
        vacio={
          <div className="flex flex-1 flex-col justify-center">
            <EstadoVacio icono={LayoutGrid} titulo="Todavía no hay zonas" />
          </div>
        }
        columnas={[
          { clave: 'nombre', titulo: 'Zona o mesa', ancho: '50%', render: (f) =>
            f.tipo === 'zona'
              ? <p className="truncate font-semibold text-texto">{f.z.nombre}</p>
              : <p className="truncate pl-4 text-texto">Mesa {f.m.nombre}</p> },
          { clave: 'capacidad', titulo: 'Personas', ancho: '18%', alinear: 'der', render: (f) =>
            f.tipo === 'mesa' ? (f.m.capacidad ?? '—') : <span className="text-tenue">{f.z.mesas.length} {f.z.mesas.length === 1 ? 'mesa' : 'mesas'}</span> },
          { clave: 'pedidos', titulo: 'Pedidos', ancho: '18%', alinear: 'der', render: (f) =>
            f.tipo === 'mesa' ? <span className="tabular-nums">{numEntero(f.m.pedidos)}</span> : '' },
          { clave: 'acciones', titulo: '', ancho: '56px', alinear: 'der', render: (f) => (
            <div className="flex justify-end">
              <MenuFila
                acciones={f.tipo === 'zona' ? [
                  { etiqueta: 'Nueva mesa', icono: Plus, alPulsar: () => setPanelMesa({ m: null, zonaId: f.z.id }) },
                  { etiqueta: 'Editar', icono: Pencil, alPulsar: () => setPanelZona(f.z) },
                  { etiqueta: 'Eliminar', icono: Trash2, peligro: true, alPulsar: () => setBorrar({ tipo: 'zona', id: f.z.id, nombre: f.z.nombre }) },
                ] : [
                  { etiqueta: 'Editar', icono: Pencil, alPulsar: () => setPanelMesa({ m: f.m, zonaId: f.z.id }) },
                  { etiqueta: 'Eliminar', icono: Trash2, peligro: true, alPulsar: () => setBorrar({ tipo: 'mesa', id: f.m.id, nombre: f.m.nombre }) },
                ]}
              />
            </div>
          ) },
        ]}
      />

      <PanelLateral
        abierto={zonaAbierta}
        alCerrar={cerrar}
        titulo={panelZona ? 'Editar zona' : 'Nueva zona'}
        pie={
          <PieAcciones
            eliminar={panelZona ? (
              <BotonEliminar titulo="Eliminar la zona" disabled={enCurso}
                onClick={() => setBorrar({ tipo: 'zona', id: panelZona.id, nombre: panelZona.nombre })} />
            ) : undefined}
          >
            <Boton type="button" variante="secundario" onClick={cerrar} disabled={enCurso}>Cancelar</Boton>
            <Boton form="form-zona" type="submit" icono={Save} disabled={enCurso}>{enCurso ? 'Guardando…' : 'Guardar'}</Boton>
          </PieAcciones>
        }
      >
        <form
          id="form-zona"
          key={panelZona?.id ?? 'nueva'}
          action={(d) => arranca(async () => {
            const r = await guardarZona(slug, panelZona?.id ?? null, d);
            if (!r.ok) { toast.error(r.error); return; }
            hecho('Guardado.');
          })}
          className="space-y-4"
        >
          <Campo etiqueta="Nombre" requerido>
            <Entrada name="nombre" required autoFocus placeholder="Salón, Terraza, Barra…" defaultValue={panelZona?.nombre ?? ''} />
          </Campo>
        </form>
      </PanelLateral>

      <PanelLateral
        abierto={panelMesa !== null}
        alCerrar={cerrar}
        titulo={panelMesa?.m ? 'Editar mesa' : 'Nueva mesa'}
        pie={
          <PieAcciones
            eliminar={panelMesa?.m ? (
              <BotonEliminar titulo="Eliminar la mesa" disabled={enCurso}
                onClick={() => panelMesa.m && setBorrar({ tipo: 'mesa', id: panelMesa.m.id, nombre: panelMesa.m.nombre })} />
            ) : undefined}
          >
            <Boton type="button" variante="secundario" onClick={cerrar} disabled={enCurso}>Cancelar</Boton>
            <Boton form="form-mesa" type="submit" icono={Save} disabled={enCurso}>{enCurso ? 'Guardando…' : 'Guardar'}</Boton>
          </PieAcciones>
        }
      >
        <form
          id="form-mesa"
          key={panelMesa?.m?.id ?? `nueva-${panelMesa?.zonaId ?? ''}`}
          action={(d) => arranca(async () => {
            const r = await guardarMesa(slug, panelMesa?.m?.id ?? null, d);
            if (!r.ok) { toast.error(r.error); return; }
            hecho('Guardado.');
          })}
          className="space-y-4"
        >
          <Campo etiqueta="Zona" requerido>
            <Selector name="zonaId" defaultValue={panelMesa?.zonaId ?? ''}>
              {zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
            </Selector>
          </Campo>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Nombre o número" requerido>
              <Entrada name="nombre" required autoFocus placeholder="4, Terraza 2…" defaultValue={panelMesa?.m?.nombre ?? ''} />
            </Campo>
            <Campo etiqueta="Personas">
              <Entrada name="capacidad" type="number" min="1" defaultValue={panelMesa?.m?.capacidad ?? ''} />
            </Campo>
          </div>
        </form>
      </PanelLateral>

      <Confirmar
        abierto={!!borrar}
        titulo={borrar?.tipo === 'zona' ? '¿Eliminar la zona?' : '¿Eliminar la mesa?'}
        mensaje={`«${borrar?.nombre}» dejará de existir. Si tiene mesas o pedidos, no se elimina.`}
        ocupado={enCurso}
        alCerrar={() => setBorrar(null)}
        alAceptar={() => arranca(async () => {
          if (!borrar) return;
          const r = borrar.tipo === 'zona' ? await eliminarZona(slug, borrar.id) : await eliminarMesa(slug, borrar.id);
          if (!r.ok) { toast.error(r.error); return; }
          hecho('Eliminado.');
        })}
      />
    </div>
  );
}

// ── Suscripción ─────────────────────────────────────────────────────────────
const ETIQUETA_METODO: Record<string, string> = { AUTOSERVICIO: 'Registrado por GCC', TARJETA: 'Tarjeta' };

function SeccionSuscripcion({ plan, pagos, zona }: { plan: Plan | null; pagos: PagoVista[]; zona: string }) {
  if (!plan)
    return (
      <div className="flex flex-1 flex-col justify-center">
        <EstadoVacio icono={CreditCard} titulo="Sin suscripción" />
      </div>
    );
  return (
    <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
      <Tarjeta className="p-4">
        <dl className="grid gap-4 sm:grid-cols-3">
          <Dato titulo="Plan">{plan.nombre}</Dato>
          <Dato titulo="Mensualidad">
            {plan.precioMensual > 0 ? `${dinero(plan.precioMensual, plan.moneda)} / mes` : 'Por definir'}
          </Dato>
          <Dato titulo="Pagado hasta">{plan.pagadoHasta ? fechaLarga(plan.pagadoHasta, 'UTC') : '—'}</Dato>
        </dl>
        {plan.mesesRetencion && (
          <p className="mt-4 rounded border border-borde bg-aviso-suave px-3 py-2 text-[12px] text-aviso">
            Se conserva {plan.mesesRetencion === 1 ? 'un mes' : `${plan.mesesRetencion} meses`} de histórico: exporta a Excel desde Reportes lo que quieras guardar.
          </p>
        )}
        {plan.caracteristicas.length > 0 && (
          <ul className="mt-4 space-y-1.5 border-t border-borde pt-4 text-[13px] text-texto">
            {plan.caracteristicas.map((c) => (
              <li key={c} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-acento" />
                {c}
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      {pagos.length > 0 && (
        <Tarjeta className="flex flex-1 flex-col overflow-hidden">
          <p className="px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-tenue">Pagos registrados</p>
          <Tabla
            filas={pagos}
            claveFila={(p) => p.id}
            recuento={`${pagos.length} ${pagos.length === 1 ? 'pago' : 'pagos'}`}
            columnas={[
              { clave: 'periodo', titulo: 'Periodo', ancho: '22%', render: (p) => <span className="text-texto">{p.periodo}</span> },
              { clave: 'pagado', titulo: 'Pagado el', ancho: '22%', render: (p) => (p.pagadoEn ? fechaLarga(p.pagadoEn, zona) : 'sin fecha') },
              { clave: 'metodo', titulo: 'Método', ancho: '22%', render: (p) => ETIQUETA_METODO[p.metodo] ?? p.metodo },
              { clave: 'monto', titulo: 'Monto', ancho: '17%', alinear: 'der', render: (p) => <span className="tabular-nums">{dinero(p.monto, p.moneda)}</span> },
              { clave: 'estado', titulo: 'Estado', ancho: '17%', render: (p) => (
                <Insignia tono={p.estado === 'PAGADO' ? 'exito' : p.estado === 'FALLIDO' ? 'error' : 'neutro'}>
                  {p.estado === 'PAGADO' ? 'Pagado' : p.estado === 'FALLIDO' ? 'Fallido' : 'Pendiente'}
                </Insignia>
              ) },
            ]}
          />
        </Tarjeta>
      )}
    </div>
  );
}

// ── Mi cuenta ───────────────────────────────────────────────────────────────
function SeccionCuenta({ slug }: { slug: string }) {
  const [enCurso, arranca] = useTransition();
  return (
    <div className="flex flex-1 flex-col p-4 sm:p-5">
      <h2 className="hidden text-[14px] font-semibold text-texto lg:block">Tu contraseña</h2>
      <form
        id="form-clave"
        action={(d) => arranca(async () => {
          const r = await cambiarMiClave(slug, d);
          if (!r.ok) { toast.error(r.error); return; }
          toast.success('Cambiada.');
          (document.getElementById('form-clave') as HTMLFormElement | null)?.reset();
        })}
        className="space-y-4 lg:mt-3"
      >
        {/* Se aprovecha el ancho: dos columnas, no una columna estrecha. */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Contraseña actual" requerido>
            <Entrada name="actual" type="password" autoComplete="current-password" required />
          </Campo>
          <Campo etiqueta="Contraseña nueva" requerido>
            <Entrada name="nueva" type="password" autoComplete="new-password" required minLength={8} />
          </Campo>
        </div>
        <div className="hidden justify-end lg:flex">
          <Boton type="submit" tamano="lg" icono={Save} disabled={enCurso}>{enCurso ? 'Cambiando…' : 'Cambiar contraseña'}</Boton>
        </div>
      </form>
    </div>
  );
}

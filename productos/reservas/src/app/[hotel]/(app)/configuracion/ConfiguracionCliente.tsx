'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Building2,
  Users,
  CreditCard,
  KeyRound,
  Plus,
  Pencil,
  Trash2,
  BedDouble,
  Upload,
  Save,
  UserPlus,
  MapPin,
} from 'lucide-react';
import { CabeceraPagina, MenuFila } from '@/componentes/Navegacion';
import {
  Boton,
  BotonIcono,
  BotonEliminar,
  Campo,
  Entrada,
  Selector,
  Tarjeta,
  Tabla,
  PanelLateral,
  PieAcciones,
  Confirmar,
  EstadoVacio,
  Secciones,
  useSeccion,
  type OpcionRail,
} from '@/componentes/ui';
import { LogoHotel } from '@/componentes/Marca';
import { dinero, fechaLarga } from '@/lib/formato';
import { cambiarMiClave } from '@/acciones/usuarios';
import {
  guardarMarca,
  subirLogo,
  quitarLogo,
  subirFoto,
  guardarUbicacion,
  eliminarUbicacion,
  guardarSuite,
  eliminarSuite,
} from '@/acciones/configuracion';
import { miniatura } from '@/lib/miniatura';
import SeccionUsuarios, { type UsuarioVista } from './SeccionUsuarios';

type SuiteVista = {
  id: number;
  nombre: string;
  fotoUrl: string | null;
  capacidad: number | null;
  precioNoche: number | null;
  reservas: number;
};
type UbicacionVista = { id: number; nombre: string; fotoUrl: string | null; suites: SuiteVista[] };
type Marca = {
  nombre: string;
  logoUrl: string | null;
  moneda: string;
};
type Plan = {
  nombre: string;
  precioMensual: number;
  moneda: string;
  estado: string;
  pagadoHasta: string | null;
  caracteristicas: string[];
};

type Seccion = 'negocio' | 'ubicaciones' | 'usuarios' | 'suscripcion' | 'cuenta';

/**
 * CONFIGURACIÓN CON SECCIONES, como Automatizaciones (2026-11-08): Negocio · Ubicaciones ·
 * Usuarios · Suscripción · Mi cuenta. «Negocio» es la antigua «Marca» sin color ni tema (el
 * producto tiene un solo tema); «Usuarios» es la antigua página del mismo nombre, que salió del
 * menú. «Ubicaciones» es propia de este producto: las suites sobre las que se dibujan panel y agenda.
 *
 * En el teléfono, portada de secciones (`Secciones`) con la sección en `?seccion=`, y los
 * «Guardar» y las altas bajan a la barra de abajo (unidos a su formulario con `form=`).
 */
export default function ConfiguracionCliente({
  slug,
  zona,
  marca,
  plan,
  ubicaciones,
  usuarios,
  haySubida,
}: {
  slug: string;
  zona: string;
  marca: Marca;
  plan: Plan | null;
  ubicaciones: UbicacionVista[];
  usuarios: { lista: UsuarioVista[]; yoSoy: number; cupo: { tope: number | null; usadas: number; quedan: number | null } };
  haySubida: boolean;
}) {
  const s = useSeccion(SECCIONES);
  const seccion = s.activo as Seccion;
  // Las altas viven aquí y no en su sección: en el teléfono las abre la barra de abajo.
  const [panelUbicacion, setPanelUbicacion] = useState<UbicacionVista | null | 'nueva'>(null);
  const [crearUsuario, setCrearUsuario] = useState(false);
  const sinCupo = usuarios.cupo.quedan !== null && usuarios.cupo.quedan <= 0;

  const accionTelefono =
    !s.enUrl ? undefined
    : seccion === 'negocio' ? <Boton form="form-negocio" type="submit" icono={Save}>Guardar</Boton>
    : seccion === 'ubicaciones' ? <Boton icono={Plus} onClick={() => setPanelUbicacion('nueva')}>Nueva ubicación</Boton>
    : seccion === 'usuarios' ? <Boton icono={UserPlus} disabled={sinCupo} onClick={() => setCrearUsuario(true)}>Crear usuario</Boton>
    : seccion === 'cuenta' ? <Boton form="form-clave" type="submit" icono={Save}>Cambiar contraseña</Boton>
    : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <CabeceraPagina
        titulo="Configuración"
        descripcion="Los datos del alojamiento, sus ubicaciones, quién entra, tu suscripción y tu cuenta"
        tituloTelefono={s.enUrl ? s.etiqueta : undefined}
        volverTelefono={s.enUrl ? { href: s.hrefPortada, etiqueta: 'Volver a Configuración' } : undefined}
        accionesTelefono={accionTelefono}
      />
      <Secciones opciones={SECCIONES} seccion={s}>
        {seccion === 'negocio' && <SeccionNegocio slug={slug} marca={marca} haySubida={haySubida} />}
        {seccion === 'ubicaciones' && (
          <SeccionUbicaciones
            slug={slug}
            ubicaciones={ubicaciones}
            haySubida={haySubida}
            moneda={marca.moneda}
            panelUbicacion={panelUbicacion}
            setPanelUbicacion={setPanelUbicacion}
          />
        )}
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
        {seccion === 'suscripcion' && <SeccionSuscripcion plan={plan} />}
        {seccion === 'cuenta' && <SeccionCuenta slug={slug} />}
      </Secciones>
    </div>
  );
}

const SECCIONES: OpcionRail[] = [
  { valor: 'negocio', etiqueta: 'Negocio', icono: Building2 },
  { valor: 'ubicaciones', etiqueta: 'Ubicaciones', icono: MapPin },
  { valor: 'usuarios', etiqueta: 'Usuarios', icono: Users },
  { valor: 'suscripcion', etiqueta: 'Suscripción', icono: CreditCard },
  { valor: 'cuenta', etiqueta: 'Mi cuenta', icono: KeyRound },
];

// ── Negocio ─────────────────────────────────────────────────────────────────
/**
 * NEGOCIO (antes «Marca», 2026-11-08): sin color ni tema. El logo se SUBE como archivo y queda
 * puesto al subirlo; ya no se escribe una dirección.
 */
function SeccionNegocio({ slug, marca, haySubida }: { slug: string; marca: Marca; haySubida: boolean }) {
  const router = useRouter();
  const [enCurso, arranca] = useTransition();
  const [quitar, setQuitar] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);

  function subir(f: File) {
    const datos = new FormData();
    datos.set('archivo', f);
    arranca(async () => {
      const r = await subirLogo(slug, datos);
      if (!r.ok) { toast.error(r.error); return; }
      toast.success('Logo subido.');
      router.refresh();
    });
  }

  return (
    <div className="flex flex-1 flex-col p-4 sm:p-5">
      <form
        id="form-negocio"
        action={(datos) =>
          arranca(async () => {
            const r = await guardarMarca(slug, datos);
            if (!r.ok) { toast.error(r.error); return; }
            toast.success('Guardado.');
            router.refresh();
          })
        }
        className="space-y-5"
      >
        <div className="flex items-center gap-3">
          <LogoHotel nombre={marca.nombre} logoUrl={marca.logoUrl} tamano={52} />
          {haySubida && (
            <>
              <input
                ref={archivo}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) subir(f); }}
              />
              <Boton variante="secundario" type="button" icono={Upload} onClick={() => archivo.current?.click()} disabled={enCurso}>
                {marca.logoUrl ? 'Cambiar logo' : 'Subir logo'}
              </Boton>
            </>
          )}
          {marca.logoUrl && (
            <BotonIcono icono={Trash2} titulo="Quitar el logo" onClick={() => setQuitar(true)} disabled={enCurso} />
          )}
        </div>

        <Grupo titulo="Alojamiento">
          <Campo etiqueta="Nombre" requerido>
            <Entrada name="nombre" defaultValue={marca.nombre} required />
          </Campo>
          <Campo etiqueta="Moneda" requerido>
            <Selector name="moneda" defaultValue={marca.moneda}>
              {['USD', 'EUR', 'COP', 'PEN', 'MXN', 'CLP', 'ARS'].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Selector>
          </Campo>
        </Grupo>

        <div className="hidden justify-end lg:flex">
          <Boton type="submit" tamano="lg" icono={Save} disabled={enCurso}>
            {enCurso ? 'Guardando…' : 'Guardar'}
          </Boton>
        </div>
      </form>

      <Confirmar
        abierto={quitar}
        titulo="¿Quitar el logo?"
        mensaje="En su lugar se verá la inicial del alojamiento."
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

// ── Ubicaciones y suites ────────────────────────────────────────────────────
function SeccionUbicaciones({
  slug,
  ubicaciones,
  haySubida,
  moneda,
  panelUbicacion,
  setPanelUbicacion,
}: {
  slug: string;
  ubicaciones: UbicacionVista[];
  haySubida: boolean;
  moneda: string;
  panelUbicacion: UbicacionVista | null | 'nueva';
  setPanelUbicacion: (v: UbicacionVista | null | 'nueva') => void;
}) {
  const router = useRouter();
  const [panelSuite, setPanelSuite] = useState<{ suite: SuiteVista | null; ubicacionId: number } | null>(null);
  const [borrar, setBorrar] = useState<{ tipo: 'ubicacion' | 'suite'; id: number; nombre: string } | null>(null);
  const [enCurso, arranca] = useTransition();

  const cerrar = () => {
    setPanelUbicacion(null);
    setPanelSuite(null);
    setBorrar(null);
  };

  const refrescar = (mensaje: string) => {
    toast.success(mensaje);
    cerrar();
    router.refresh();
  };

  const ubicacionEditada = panelUbicacion && panelUbicacion !== 'nueva' ? panelUbicacion : null;

  return (
    <div className="flex flex-1 flex-col">
      {/* «Nueva ubicación» es la principal: arriba a la derecha en escritorio, abajo en el teléfono. */}
      <div className="hidden justify-end px-4 py-3 lg:flex">
        <Boton icono={Plus} onClick={() => setPanelUbicacion('nueva')}>Nueva ubicación</Boton>
      </div>

      {!ubicaciones.length && (
        <div className="flex flex-1 items-center justify-center">
          <EstadoVacio icono={Building2} titulo="Todavía no hay ubicaciones" detalle="Crea la primera y añádele sus suites." />
        </div>
      )}

      {ubicaciones.map((u) => (
        <section key={u.id} className="border-t border-borde first-of-type:border-t-0 lg:first-of-type:border-t">
          <div className="flex items-center gap-3 px-4 py-3">
            <Miniatura url={u.fotoUrl} icono={Building2} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-texto">{u.nombre}</p>
            </div>
            <MenuFila
              acciones={[
                { etiqueta: 'Nueva suite', icono: Plus, alPulsar: () => setPanelSuite({ suite: null, ubicacionId: u.id }) },
                { etiqueta: 'Editar', icono: Pencil, alPulsar: () => setPanelUbicacion(u) },
                { etiqueta: 'Eliminar', icono: Trash2, peligro: true, alPulsar: () => setBorrar({ tipo: 'ubicacion', id: u.id, nombre: u.nombre }) },
              ]}
            />
          </div>
          <Tabla
            filas={u.suites}
            claveFila={(s) => s.id}
            alPulsarFila={(s) => setPanelSuite({ suite: s, ubicacionId: u.id })}
            vacio={<p className="border-t border-borde px-4 py-4 text-center text-[12px] text-tenue">Sin suites</p>}
            recuento={`${u.suites.length} ${u.suites.length === 1 ? 'suite' : 'suites'}`}
            columnas={[
              { clave: 'suite', titulo: 'Suite', ancho: '40%', render: (s) => (
                <div className="flex min-w-0 items-center gap-2.5">
                  <Miniatura url={s.fotoUrl} icono={BedDouble} pequena />
                  <span className="truncate font-medium text-texto">{s.nombre}</span>
                </div>
              ) },
              { clave: 'capacidad', titulo: 'Capacidad', ancho: '18%', render: (s) => (s.capacidad ? `${s.capacidad} personas` : '—') },
              { clave: 'tarifa', titulo: 'Tarifa', ancho: '18%', alinear: 'der', render: (s) => (
                <span className="tabular-nums">{s.precioNoche ? `${dinero(s.precioNoche, moneda)}/noche` : '—'}</span>
              ) },
              { clave: 'reservas', titulo: 'Reservas', ancho: '14%', alinear: 'der', render: (s) => <span className="tabular-nums">{s.reservas}</span> },
              { clave: 'acciones', titulo: '', ancho: '56px', alinear: 'der', render: (s) => (
                <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                  <MenuFila
                    acciones={[
                      { etiqueta: 'Editar', icono: Pencil, alPulsar: () => setPanelSuite({ suite: s, ubicacionId: u.id }) },
                      { etiqueta: 'Eliminar', icono: Trash2, peligro: true, alPulsar: () => setBorrar({ tipo: 'suite', id: s.id, nombre: s.nombre }) },
                    ]}
                  />
                </div>
              ) },
            ]}
          />
        </section>
      ))}

      {/* Panel de ubicación */}
      <PanelLateral
        abierto={panelUbicacion !== null}
        alCerrar={cerrar}
        titulo={ubicacionEditada ? ubicacionEditada.nombre : 'Nueva ubicación'}
        pie={
          <PieAcciones
            eliminar={ubicacionEditada && (
              <BotonEliminar titulo="Eliminar la ubicación" disabled={enCurso}
                onClick={() => setBorrar({ tipo: 'ubicacion', id: ubicacionEditada.id, nombre: ubicacionEditada.nombre })} />
            )}
          >
            <Boton type="button" variante="secundario" onClick={cerrar} disabled={enCurso}>Cancelar</Boton>
            <Boton form="form-ubicacion" type="submit" icono={Save} disabled={enCurso}>{enCurso ? 'Guardando…' : 'Guardar'}</Boton>
          </PieAcciones>
        }
      >
        <form
          id="form-ubicacion"
          key={ubicacionEditada?.id ?? 'nueva'}
          action={(datos) =>
            arranca(async () => {
              const r = await guardarUbicacion(slug, ubicacionEditada?.id ?? null, datos);
              if (!r.ok) { toast.error(r.error); return; }
              refrescar('Guardado.');
            })
          }
          className="space-y-3"
        >
          <Campo etiqueta="Nombre" requerido>
            <Entrada name="nombre" required autoFocus defaultValue={ubicacionEditada?.nombre ?? ''} />
          </Campo>
          <CampoFoto slug={slug} haySubida={haySubida} inicial={ubicacionEditada?.fotoUrl ?? null} />
        </form>
      </PanelLateral>

      {/* Panel de suite */}
      <PanelLateral
        abierto={panelSuite !== null}
        alCerrar={cerrar}
        titulo={panelSuite?.suite ? panelSuite.suite.nombre : 'Nueva suite'}
        pie={
          <PieAcciones
            eliminar={panelSuite?.suite && (
              <BotonEliminar titulo="Eliminar la suite" disabled={enCurso}
                onClick={() => panelSuite.suite && setBorrar({ tipo: 'suite', id: panelSuite.suite.id, nombre: panelSuite.suite.nombre })} />
            )}
          >
            <Boton type="button" variante="secundario" onClick={cerrar} disabled={enCurso}>Cancelar</Boton>
            <Boton form="form-suite" type="submit" icono={Save} disabled={enCurso}>{enCurso ? 'Guardando…' : 'Guardar'}</Boton>
          </PieAcciones>
        }
      >
        <form
          id="form-suite"
          key={panelSuite?.suite?.id ?? `nueva-${panelSuite?.ubicacionId ?? 0}`}
          action={(datos) =>
            arranca(async () => {
              const r = await guardarSuite(slug, panelSuite?.suite?.id ?? null, datos);
              if (!r.ok) { toast.error(r.error); return; }
              refrescar('Guardado.');
            })
          }
          className="space-y-3"
        >
          <input type="hidden" name="ubicacionId" value={panelSuite?.ubicacionId ?? ''} />
          <Campo etiqueta="Nombre" requerido>
            <Entrada name="nombre" required autoFocus defaultValue={panelSuite?.suite?.nombre ?? ''} />
          </Campo>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Capacidad (personas)">
              <Entrada name="capacidad" type="number" min="1" defaultValue={panelSuite?.suite?.capacidad ?? ''} />
            </Campo>
            <Campo etiqueta={`Tarifa por noche (${moneda})`}>
              <Entrada name="precioNoche" type="number" step="0.01" min="0" defaultValue={panelSuite?.suite?.precioNoche ?? ''} />
            </Campo>
          </div>
          <CampoFoto slug={slug} haySubida={haySubida} inicial={panelSuite?.suite?.fotoUrl ?? null} />
        </form>
      </PanelLateral>

      <Confirmar
        abierto={!!borrar}
        titulo={borrar?.tipo === 'ubicacion' ? '¿Eliminar la ubicación?' : '¿Eliminar la suite?'}
        mensaje={`«${borrar?.nombre}» dejará de existir. Si tiene suites o reservas, no se eliminará.`}
        ocupado={enCurso}
        alCerrar={() => setBorrar(null)}
        alAceptar={() =>
          arranca(async () => {
            if (!borrar) return;
            const r = borrar.tipo === 'ubicacion' ? await eliminarUbicacion(slug, borrar.id) : await eliminarSuite(slug, borrar.id);
            if (!r.ok) { toast.error(r.error); return; }
            refrescar('Eliminado.');
          })
        }
      />
    </div>
  );
}

function Miniatura({ url, icono: Icono, pequena = false }: { url: string | null; icono: React.ComponentType<{ className?: string }>; pequena?: boolean }) {
  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded bg-realce ${pequena ? 'h-8 w-8' : 'h-9 w-9'}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img loading="lazy" src={miniatura(url, 240)} alt="" className="h-full w-full object-cover" />
      ) : (
        <Icono className="h-4 w-4 text-tenue" />
      )}
    </div>
  );
}

function CampoFoto({ slug, haySubida, inicial }: { slug: string; haySubida: boolean; inicial: string | null }) {
  const [url, setUrl] = useState(inicial ?? '');
  const [subiendo, arranca] = useTransition();
  const archivo = useRef<HTMLInputElement>(null);
  return (
    <Campo etiqueta="Foto">
      <div className="flex items-center gap-2">
        <Miniatura url={url || null} icono={BedDouble} />
        <Entrada name="fotoUrl" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="min-w-0 flex-1" />
        {haySubida && (
          <>
            <input
              ref={archivo}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                arranca(async () => {
                  const datos = new FormData();
                  datos.set('archivo', f);
                  const r = await subirFoto(slug, datos);
                  if (!r.ok) { toast.error(r.error); return; }
                  setUrl(r.url!);
                  toast.success('Foto subida.');
                });
              }}
            />
            <Boton variante="secundario" type="button" icono={Upload} disabled={subiendo} onClick={() => archivo.current?.click()}>
              {subiendo ? 'Subiendo…' : 'Subir'}
            </Boton>
          </>
        )}
      </div>
    </Campo>
  );
}

// ── Suscripción (lo que el hotel ve de su propio plan) ───────────────────────
function SeccionSuscripcion({ plan }: { plan: Plan | null }) {
  if (!plan)
    return (
      <div className="flex flex-1 items-center justify-center">
        <EstadoVacio icono={CreditCard} titulo="Sin suscripción registrada" />
      </div>
    );

  return (
    <div className="space-y-3 p-4 sm:p-5">
      <Tarjeta className="p-4">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Dato titulo="Plan">{plan.nombre}</Dato>
          <Dato titulo="Mensualidad">{plan.precioMensual > 0 ? `${dinero(plan.precioMensual, plan.moneda)} / mes` : 'Por definir'}</Dato>
          {/* En UTC, como se guarda: es un día, no un instante. */}
          <Dato titulo="Pagado hasta">{plan.pagadoHasta ? fechaLarga(plan.pagadoHasta, 'UTC') : '—'}</Dato>
        </dl>
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
    </div>
  );
}

function Dato({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-tenue">{titulo}</dt>
      <dd className="mt-0.5 truncate text-[14px] font-semibold text-texto">{children}</dd>
    </div>
  );
}

// ── Mi cuenta ───────────────────────────────────────────────────────────────
function SeccionCuenta({ slug }: { slug: string }) {
  const [enCurso, arranca] = useTransition();
  const formulario = useRef<HTMLFormElement>(null);
  return (
    <div className="flex flex-1 flex-col p-4 sm:p-5">
      <h2 className="hidden text-[14px] font-semibold text-texto lg:block">Tu contraseña</h2>
      <form
        ref={formulario}
        id="form-clave"
        action={(datos) =>
          arranca(async () => {
            const r = await cambiarMiClave(slug, datos);
            if (!r.ok) { toast.error(r.error); return; }
            toast.success('Cambiada.');
            formulario.current?.reset();
          })
        }
        className="space-y-4 lg:mt-3"
      >
        {/* Se aprovecha el ancho: dos columnas, no una columna estrecha. */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Contraseña actual" requerido>
            <Entrada name="actual" type="password" autoComplete="current-password" required />
          </Campo>
          <Campo etiqueta="Contraseña nueva" requerido>
            <Entrada name="nueva" type="password" autoComplete="new-password" required minLength={8} placeholder="Mínimo 8 caracteres" />
          </Campo>
        </div>
        <div className="hidden justify-end lg:flex">
          <Boton type="submit" tamano="lg" icono={Save} disabled={enCurso}>
            {enCurso ? 'Cambiando…' : 'Cambiar contraseña'}
          </Boton>
        </div>
      </form>
    </div>
  );
}

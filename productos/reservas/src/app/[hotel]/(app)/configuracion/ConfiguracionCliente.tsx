'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Palette,
  Building2,
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  BedDouble,
  Upload,
  AlertCircle,
  KeyRound,
} from 'lucide-react';
import { CabeceraPagina } from '@/componentes/Navegacion';
import {
  Boton,
  BotonIcono,
  Campo,
  Entrada,
  Selector,
  Tarjeta,
  RailFiltro,
  PanelLateral,
  Confirmar,
  Insignia,
  EstadoVacio,
} from '@/componentes/ui';
import { LogoHotel } from '@/componentes/Marca';
import { ACENTO_GCC, tokensDeMarca } from '@/lib/marca';
import { dinero } from '@/lib/formato';
import { cambiarMiClave } from '@/acciones/usuarios';
import {
  guardarMarca,
  subirLogo,
  subirFoto,
  guardarUbicacion,
  eliminarUbicacion,
  guardarSuite,
  eliminarSuite,
} from '@/acciones/configuracion';
import { cn } from '@/lib/utils';

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
  colorAcento: string;
  tema: 'CLARO' | 'OSCURO';
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

type Seccion = 'marca' | 'lugares' | 'suscripcion' | 'cuenta';

/** Colores sugeridos. El primero es el del grupo, que es el que trae por defecto. */
const SUGERIDOS = [ACENTO_GCC, '#C9952C', '#0F6CBD', '#0F7B0F', '#B4009E', '#C4314B', '#1B1A19'];

export default function ConfiguracionCliente({
  slug,
  marca,
  plan,
  ubicaciones,
  hayCloudinary,
}: {
  slug: string;
  marca: Marca;
  plan: Plan | null;
  ubicaciones: UbicacionVista[];
  hayCloudinary: boolean;
}) {
  const [seccion, setSeccion] = useState<Seccion>('marca');

  return (
    <>
      <CabeceraPagina titulo="Configuración" descripcion="La marca, los lugares y tu cuenta" />
      <div className="flex flex-col gap-4 p-4 sm:p-6 lg:flex-row">
        <RailFiltro
          opciones={[
            { valor: 'marca', etiqueta: 'Marca', icono: Palette },
            { valor: 'lugares', etiqueta: 'Ubicaciones y suites', icono: Building2 },
            { valor: 'suscripcion', etiqueta: 'Suscripción', icono: CreditCard },
            { valor: 'cuenta', etiqueta: 'Mi cuenta', icono: KeyRound },
          ]}
          activo={seccion}
          alElegir={(v) => setSeccion(v as Seccion)}
        />
        <div className="min-w-0 flex-1">
          {seccion === 'marca' && <SeccionMarca slug={slug} marca={marca} hayCloudinary={hayCloudinary} />}
          {seccion === 'lugares' && (
            <SeccionLugares slug={slug} ubicaciones={ubicaciones} hayCloudinary={hayCloudinary} moneda={marca.moneda} />
          )}
          {seccion === 'suscripcion' && <SeccionSuscripcion plan={plan} />}
          {seccion === 'cuenta' && <SeccionCuenta slug={slug} />}
        </div>
      </div>
    </>
  );
}

// ── Marca ───────────────────────────────────────────────────────────────────
function SeccionMarca({
  slug,
  marca,
  hayCloudinary,
}: {
  slug: string;
  marca: Marca;
  hayCloudinary: boolean;
}) {
  const router = useRouter();
  const [color, setColor] = useState(marca.colorAcento);
  const [tema, setTema] = useState<'CLARO' | 'OSCURO'>(marca.tema);
  const [logoUrl, setLogoUrl] = useState(marca.logoUrl ?? '');
  const [nombre, setNombre] = useState(marca.nombre);
  const [error, setError] = useState<string | null>(null);
  const [enCurso, arranca] = useTransition();

  const subir = (archivo: File) =>
    arranca(async () => {
      const datos = new FormData();
      datos.set('archivo', archivo);
      const r = await subirLogo(slug, datos);
      if (!r.ok) return setError(r.error);
      setLogoUrl(r.url!);
      toast.success('Logo subido. No olvides guardar.');
    });

  return (
    <div className="space-y-4">
      <Tarjeta className="p-5">
        <h2 className="text-[14px] font-semibold">Marca del alojamiento</h2>
        <p className="mt-0.5 text-[12px] text-tenue">
          El nombre, el logo, el color y el tema que ve tu equipo dentro de la aplicación.
        </p>

        <form
          action={(datos) =>
            arranca(async () => {
              setError(null);
              const r = await guardarMarca(slug, datos);
              if (!r.ok) return setError(r.error);
              toast.success('Marca actualizada');
              router.refresh();
            })
          }
          className="mt-5 space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Nombre de la empresa" requerido>
              <Entrada name="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </Campo>
            <Campo etiqueta="Moneda" requerido>
              <Selector name="moneda" defaultValue={marca.moneda}>
                {['USD', 'EUR', 'COP', 'PEN', 'MXN', 'CLP', 'ARS'].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Selector>
            </Campo>
          </div>

          <Campo etiqueta="Logo">
            <div className="flex flex-wrap items-center gap-3">
              <LogoHotel nombre={nombre} logoUrl={logoUrl || null} tamano={48} />
              <Entrada
                name="logoUrl"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://…  (o sube una imagen)"
                className="min-w-0 flex-1"
              />
              {hayCloudinary && (
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && subir(e.target.files[0])}
                  />
                  <span className="inline-flex h-8 items-center gap-2 rounded border border-borde bg-tarjeta px-3 text-[13px] font-semibold hover:bg-realce">
                    <Upload className="h-4 w-4" /> Subir
                  </span>
                </label>
              )}
            </div>
          </Campo>

          <Campo etiqueta="Color de la marca" requerido>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value.toUpperCase())}
                className="h-9 w-12 cursor-pointer rounded border border-borde bg-tarjeta p-1"
                aria-label="Elegir color"
              />
              <Entrada
                name="colorAcento"
                value={color}
                onChange={(e) => setColor(e.target.value.toUpperCase())}
                className="w-32 font-mono"
              />
              <div className="flex gap-1.5">
                {SUGERIDOS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    title={c === ACENTO_GCC ? 'Violeta del grupo' : c}
                    className={cn(
                      'h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 foco-visible',
                      color.toUpperCase() === c.toUpperCase() ? 'border-texto' : 'border-borde',
                    )}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          </Campo>

          <Campo etiqueta="Tema">
            <div className="flex gap-2">
              {(['CLARO', 'OSCURO'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTema(t)}
                  className={cn(
                    'h-9 flex-1 rounded border text-[13px] font-semibold transition-colors foco-visible',
                    tema === t ? 'border-acento bg-acento-suave text-acento' : 'border-borde hover:bg-realce',
                  )}
                >
                  {t === 'CLARO' ? 'Claro' : 'Oscuro'}
                </button>
              ))}
              <input type="hidden" name="tema" value={tema} />
            </div>
          </Campo>

          <VistaPrevia nombre={nombre} logoUrl={logoUrl} color={color} tema={tema} />

          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded border border-borde bg-error-suave px-3 py-2 text-[12px] text-error"
            >
              <AlertCircle className="mt-px h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          <div className="flex justify-end border-t border-borde pt-4">
            <Boton type="submit" disabled={enCurso}>
              {enCurso ? 'Guardando…' : 'Guardar marca'}
            </Boton>
          </div>
        </form>
      </Tarjeta>
    </div>
  );
}

/** Se ve el cambio ANTES de guardarlo: elegir un color a ciegas es elegir mal. */
function VistaPrevia({
  nombre,
  logoUrl,
  color,
  tema,
}: {
  nombre: string;
  logoUrl: string;
  color: string;
  tema: 'CLARO' | 'OSCURO';
}) {
  const oscuro = tema === 'OSCURO';
  return (
    <div>
      <p className="mb-1 text-[12px] font-semibold">Vista previa</p>
      <div
        className={cn('rounded-md border border-borde p-4', oscuro && 'oscuro')}
        style={{ ...tokensDeMarca(color, oscuro), background: 'var(--color-fondo)' } as React.CSSProperties}
      >
        <div className="flex items-center gap-3">
          <LogoHotel nombre={nombre || 'H'} logoUrl={logoUrl || null} tamano={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold" style={{ color: 'var(--color-texto)' }}>
              {nombre || 'Tu alojamiento'}
            </p>
            <p className="text-[11px]" style={{ color: 'var(--color-tenue)' }}>
              Gestión de Reservas
            </p>
          </div>
          <span
            className="rounded px-3 py-1.5 text-[12px] font-semibold"
            style={{ background: 'var(--color-acento)', color: 'var(--color-acento-contraste)' }}
          >
            Nueva reserva
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Ubicaciones y suites ────────────────────────────────────────────────────
function SeccionLugares({
  slug,
  ubicaciones,
  hayCloudinary,
  moneda,
}: {
  slug: string;
  ubicaciones: UbicacionVista[];
  hayCloudinary: boolean;
  moneda: string;
}) {
  const router = useRouter();
  const [panelUbicacion, setPanelUbicacion] = useState<UbicacionVista | null | 'nueva'>(null);
  const [panelSuite, setPanelSuite] = useState<
    { suite: SuiteVista | null; ubicacionId: number } | null
  >(null);
  const [borrar, setBorrar] = useState<
    { tipo: 'ubicacion' | 'suite'; id: number; nombre: string } | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [enCurso, arranca] = useTransition();

  const cerrar = () => {
    setPanelUbicacion(null);
    setPanelSuite(null);
    setBorrar(null);
    setError(null);
  };

  const refrescar = (mensaje: string) => {
    toast.success(mensaje);
    cerrar();
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[14px] font-semibold">Ubicaciones y suites</h2>
          <p className="text-[12px] text-tenue">
            Las ubicaciones agrupan las suites; la agenda y el panel se dibujan sobre ellas.
          </p>
        </div>
        <Boton icono={Plus} onClick={() => setPanelUbicacion('nueva')}>
          Nueva ubicación
        </Boton>
      </div>

      {!ubicaciones.length && (
        <Tarjeta>
          <EstadoVacio
            icono={Building2}
            titulo="Todavía no hay ubicaciones"
            detalle="Crea la primera —una sede, un edificio— y añádele sus suites."
          />
        </Tarjeta>
      )}

      {ubicaciones.map((u) => (
        <Tarjeta key={u.id} className="overflow-hidden">
          <div className="flex items-center gap-3 border-b border-borde px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded bg-realce">
              {u.fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={u.fotoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <Building2 className="h-4 w-4 text-tenue" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold">{u.nombre}</p>
              <p className="text-[11px] text-tenue">{u.suites.length} suites</p>
            </div>
            <Boton
              variante="secundario"
              tamano="sm"
              icono={Plus}
              onClick={() => setPanelSuite({ suite: null, ubicacionId: u.id })}
            >
              Suite
            </Boton>
            <BotonIcono icono={Pencil} titulo="Editar ubicación" onClick={() => setPanelUbicacion(u)} />
            <BotonIcono
              icono={Trash2}
              titulo="Eliminar ubicación"
              className="hover:bg-error-suave hover:text-error"
              onClick={() => setBorrar({ tipo: 'ubicacion', id: u.id, nombre: u.nombre })}
            />
          </div>

          {u.suites.length === 0 ? (
            <p className="px-4 py-5 text-center text-[12px] text-tenue">
              Esta ubicación todavía no tiene suites.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--color-borde)]">
              {u.suites.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded bg-realce">
                    {s.fotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.fotoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <BedDouble className="h-4 w-4 text-tenue" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{s.nombre}</p>
                    <p className="text-[11px] text-tenue">
                      {s.capacidad ? `${s.capacidad} personas · ` : ''}
                      {s.precioNoche ? `${dinero(s.precioNoche, moneda)}/noche` : 'Sin tarifa'}
                    </p>
                  </div>
                  {s.reservas > 0 && <Insignia tono="neutro">{s.reservas} reservas</Insignia>}
                  <BotonIcono
                    icono={Pencil}
                    titulo="Editar suite"
                    onClick={() => setPanelSuite({ suite: s, ubicacionId: u.id })}
                  />
                  <BotonIcono
                    icono={Trash2}
                    titulo="Eliminar suite"
                    className="hover:bg-error-suave hover:text-error"
                    onClick={() => setBorrar({ tipo: 'suite', id: s.id, nombre: s.nombre })}
                  />
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      ))}

      {/* Panel de ubicación */}
      <PanelLateral
        abierto={panelUbicacion !== null}
        alCerrar={cerrar}
        titulo={panelUbicacion === 'nueva' ? 'Nueva ubicación' : 'Editar ubicación'}
      >
        <form
          action={(datos) =>
            arranca(async () => {
              setError(null);
              const id = panelUbicacion && panelUbicacion !== 'nueva' ? panelUbicacion.id : null;
              const r = await guardarUbicacion(slug, id, datos);
              if (!r.ok) return setError(r.error);
              refrescar('Ubicación guardada');
            })
          }
          className="space-y-4"
        >
          <Campo etiqueta="Nombre" requerido>
            <Entrada
              name="nombre"
              required
              autoFocus
              defaultValue={panelUbicacion && panelUbicacion !== 'nueva' ? panelUbicacion.nombre : ''}
            />
          </Campo>
          <CampoFoto
            slug={slug}
            hayCloudinary={hayCloudinary}
            inicial={panelUbicacion && panelUbicacion !== 'nueva' ? panelUbicacion.fotoUrl : null}
          />
          {error && <Aviso texto={error} />}
          <div className="flex justify-end gap-2 border-t border-borde pt-4">
            <Boton type="button" variante="secundario" onClick={cerrar} disabled={enCurso}>
              Cancelar
            </Boton>
            <Boton type="submit" disabled={enCurso}>
              {enCurso ? 'Guardando…' : 'Guardar'}
            </Boton>
          </div>
        </form>
      </PanelLateral>

      {/* Panel de suite */}
      <PanelLateral
        abierto={panelSuite !== null}
        alCerrar={cerrar}
        titulo={panelSuite?.suite ? 'Editar suite' : 'Nueva suite'}
      >
        <form
          action={(datos) =>
            arranca(async () => {
              setError(null);
              const r = await guardarSuite(slug, panelSuite?.suite?.id ?? null, datos);
              if (!r.ok) return setError(r.error);
              refrescar('Suite guardada');
            })
          }
          className="space-y-4"
        >
          <input type="hidden" name="ubicacionId" value={panelSuite?.ubicacionId ?? ''} />
          <Campo etiqueta="Nombre" requerido>
            <Entrada name="nombre" required autoFocus defaultValue={panelSuite?.suite?.nombre ?? ''} />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Capacidad (personas)">
              <Entrada
                name="capacidad"
                type="number"
                min="1"
                defaultValue={panelSuite?.suite?.capacidad ?? ''}
              />
            </Campo>
            <Campo etiqueta={`Tarifa por noche (${moneda})`}>
              <Entrada
                name="precioNoche"
                type="number"
                step="0.01"
                min="0"
                defaultValue={panelSuite?.suite?.precioNoche ?? ''}
              />
            </Campo>
          </div>
          <CampoFoto slug={slug} hayCloudinary={hayCloudinary} inicial={panelSuite?.suite?.fotoUrl ?? null} />
          {error && <Aviso texto={error} />}
          <div className="flex justify-end gap-2 border-t border-borde pt-4">
            <Boton type="button" variante="secundario" onClick={cerrar} disabled={enCurso}>
              Cancelar
            </Boton>
            <Boton type="submit" disabled={enCurso}>
              {enCurso ? 'Guardando…' : 'Guardar'}
            </Boton>
          </div>
        </form>
      </PanelLateral>

      <Confirmar
        abierto={!!borrar}
        titulo={borrar?.tipo === 'ubicacion' ? 'Eliminar la ubicación' : 'Eliminar la suite'}
        mensaje={`«${borrar?.nombre}» dejará de existir. Si tiene suites o reservas asociadas, la aplicación se negará y te dirá cuántas.`}
        ocupado={enCurso}
        alCerrar={cerrar}
        alAceptar={() =>
          arranca(async () => {
            if (!borrar) return;
            const r =
              borrar.tipo === 'ubicacion'
                ? await eliminarUbicacion(slug, borrar.id)
                : await eliminarSuite(slug, borrar.id);
            if (!r.ok) {
              toast.error(r.error);
              return;
            }
            refrescar('Eliminado');
          })
        }
      />
    </div>
  );
}

function CampoFoto({
  slug,
  hayCloudinary,
  inicial,
}: {
  slug: string;
  hayCloudinary: boolean;
  inicial: string | null;
}) {
  const [url, setUrl] = useState(inicial ?? '');
  const [, arranca] = useTransition();
  return (
    <Campo etiqueta="Foto">
      <div className="flex items-center gap-2">
        <Entrada
          name="fotoUrl"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          className="min-w-0 flex-1"
        />
        {hayCloudinary && (
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                arranca(async () => {
                  const datos = new FormData();
                  datos.set('archivo', f);
                  const r = await subirFoto(slug, datos);
                  if (!r.ok) {
                    toast.error(r.error);
                    return;
                  }
                  setUrl(r.url!);
                  toast.success('Foto subida');
                });
              }}
            />
            <span className="inline-flex h-8 items-center gap-2 rounded border border-borde bg-tarjeta px-3 text-[13px] font-semibold hover:bg-realce">
              <Upload className="h-4 w-4" /> Subir
            </span>
          </label>
        )}
      </div>
    </Campo>
  );
}

// ── Suscripción (lo que el hotel ve de su propio plan) ───────────────────────
function SeccionSuscripcion({ plan }: { plan: Plan | null }) {
  if (!plan)
    return (
      <Tarjeta>
        <EstadoVacio icono={CreditCard} titulo="Sin suscripción registrada" />
      </Tarjeta>
    );

  return (
    <Tarjeta className="p-5">
      <h2 className="text-[14px] font-semibold">Tu suscripción</h2>
      <p className="mt-0.5 text-[12px] text-tenue">
        La gestiona el Grupo Corazones Cruzados. Aquí solo se consulta.
      </p>
      <dl className="mt-5 grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-tenue">Plan</dt>
          <dd className="text-[14px] font-semibold">{plan.nombre}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-tenue">Mensualidad</dt>
          <dd className="text-[14px] font-semibold">
            {plan.precioMensual > 0 ? `${dinero(plan.precioMensual, plan.moneda)} / mes` : 'Por definir'}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-tenue">Pagado hasta</dt>
          <dd className="text-[14px] font-semibold">
            {plan.pagadoHasta
              ? new Date(plan.pagadoHasta).toLocaleDateString('es-EC', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  timeZone: 'UTC',
                })
              : '—'}
          </dd>
        </div>
      </dl>
      {plan.caracteristicas.length > 0 && (
        <ul className="mt-5 space-y-1.5 border-t border-borde pt-4 text-[13px]">
          {plan.caracteristicas.map((c) => (
            <li key={c} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-acento" />
              {c}
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

// ── Mi cuenta ───────────────────────────────────────────────────────────────
function SeccionCuenta({ slug }: { slug: string }) {
  const [error, setError] = useState<string | null>(null);
  const [enCurso, arranca] = useTransition();
  return (
    <Tarjeta className="p-5">
      <h2 className="text-[14px] font-semibold">Cambiar mi contraseña</h2>
      <form
        action={(datos) =>
          arranca(async () => {
            setError(null);
            const r = await cambiarMiClave(slug, datos);
            if (!r.ok) return setError(r.error);
            toast.success('Contraseña cambiada');
            (document.getElementById('form-clave') as HTMLFormElement | null)?.reset();
          })
        }
        id="form-clave"
        className="mt-4 max-w-sm space-y-4"
      >
        <Campo etiqueta="Contraseña actual" requerido>
          <Entrada name="actual" type="password" autoComplete="current-password" required />
        </Campo>
        <Campo etiqueta="Contraseña nueva" requerido>
          <Entrada name="nueva" type="password" autoComplete="new-password" required minLength={8} />
        </Campo>
        {error && <Aviso texto={error} />}
        <Boton type="submit" disabled={enCurso}>
          {enCurso ? 'Cambiando…' : 'Cambiar contraseña'}
        </Boton>
      </form>
    </Tarjeta>
  );
}

const Aviso = ({ texto }: { texto: string }): ReactNode => (
  <p
    role="alert"
    className="flex items-start gap-2 rounded border border-borde bg-error-suave px-3 py-2 text-[12px] text-error"
  >
    <AlertCircle className="mt-px h-4 w-4 shrink-0" />
    {texto}
  </p>
);

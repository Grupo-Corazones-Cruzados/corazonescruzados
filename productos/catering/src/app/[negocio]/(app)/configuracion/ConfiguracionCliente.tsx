'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Building2, Users, CreditCard, KeyRound, Upload, Save, Trash2, UserPlus } from 'lucide-react';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Boton, BotonIcono, Campo, Confirmar, Entrada, Selector, Tarjeta, EstadoVacio, Secciones, useSeccion, type OpcionRail } from '@/componentes/ui';
import { Aviso, Chips, Casilla } from '@/componentes/campos';
import { LogoNegocio } from '@/componentes/Marca';
import { dinero } from '@/lib/formato';
import { TIPOS_COMIDA, ETIQUETA_COMIDA, DIAS_SEMANA, ETIQUETA_DIA } from '@/lib/catalogo';
import { cambiarMiClave } from '@/acciones/usuarios';
import { guardarNegocio, subirLogo, quitarLogo } from '@/acciones/configuracion';
import SeccionUsuarios, { type UsuarioVista, type Cupo } from './SeccionUsuarios';
import type { TipoComida, DiaSemana } from '@/generated/prisma/enums';

type Negocio = {
  nombre: string;
  logoUrl: string | null;
  moneda: string;
  tiposComida: TipoComida[];
  diasServicio: DiaSemana[];
  horaLimiteCancelacion: number;
  porcentajeCancelacion: number;
  registroAbierto: boolean;
};
type Plan = {
  nombre: string;
  precioMensual: number;
  moneda: string;
  /** Ya formateada en el servidor. */
  pagadoHasta: string | null;
  mesesRetencion: number | null;
  caracteristicas: string[];
};

type Seccion = 'negocio' | 'usuarios' | 'suscripcion' | 'cuenta';

/**
 * CONFIGURACIÓN COMO EN AUTOMATIZACIONES (Fernando, 2026-11-08): Negocio · Usuarios ·
 * Suscripción · Mi cuenta. «Marca» pasa a «Negocio» sin color ni tema (un solo tema en el
 * producto) y con «Operativa» dentro, como un grupo más; «Usuarios» deja de ser un módulo del
 * menú. En el teléfono, portada de secciones (`Secciones`) con la sección en `?seccion=` y los
 * «Guardar» en la barra de abajo.
 */
export default function ConfiguracionCliente({
  slug,
  negocio,
  usuarios,
  plan,
  zonaHoraria,
}: {
  slug: string;
  negocio: Negocio;
  usuarios: { lista: UsuarioVista[]; yoSoy: number; cupo: Cupo };
  plan: Plan | null;
  zonaHoraria: string;
}) {
  const s = useSeccion(SECCIONES);
  const seccion = s.activo as Seccion;
  const [crearUsuario, setCrearUsuario] = useState(false);
  const sinSitio = usuarios.cupo.quedan !== null && usuarios.cupo.quedan <= 0;
  // Los «Guardar» de cada sección: en escritorio viven al pie de su sección; en el teléfono
  // bajan a la barra de acciones (regla §4-nonies), unidos a su formulario por `form=`.
  const guardarTelefono =
    s.enUrl && seccion === 'negocio' ? <Boton form="form-negocio" type="submit" icono={Save}>Guardar</Boton>
    : s.enUrl && seccion === 'usuarios' ? <Boton icono={UserPlus} disabled={sinSitio} onClick={() => setCrearUsuario(true)}>Nuevo usuario</Boton>
    : s.enUrl && seccion === 'cuenta' ? <Boton form="form-clave" type="submit" icono={Save}>Cambiar contraseña</Boton>
    : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CabeceraPagina
        titulo="Configuración"
        descripcion="Los datos del negocio, quién entra, la suscripción y tu cuenta"
        tituloTelefono={s.enUrl ? s.etiqueta : undefined}
        volverTelefono={s.enUrl ? { href: s.hrefPortada, etiqueta: 'Volver a Configuración' } : undefined}
        accionesTelefono={guardarTelefono}
      />
      <Secciones opciones={SECCIONES} seccion={s}>
        {seccion === 'negocio' && <SeccionNegocio slug={slug} negocio={negocio} />}
        {seccion === 'usuarios' && (
          <SeccionUsuarios
            slug={slug}
            usuarios={usuarios.lista}
            yoSoy={usuarios.yoSoy}
            cupo={usuarios.cupo}
            zonaHoraria={zonaHoraria}
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
  { valor: 'usuarios', etiqueta: 'Usuarios', icono: Users },
  { valor: 'suscripcion', etiqueta: 'Suscripción', icono: CreditCard },
  { valor: 'cuenta', etiqueta: 'Mi cuenta', icono: KeyRound },
];

// ── Negocio ─────────────────────────────────────────────────────────────────
/**
 * NEGOCIO (antes «Marca» + «Operativa»): sin color ni tema. El logo se SUBE como archivo (PNG, JPG o WebP de hasta 512 KB), se
 * guarda al subirlo en la columna de siempre y se sirve desde `/<slug>/logo`; ya no se escribe una dirección. Cambiar la operativa no toca los
 * servicios ya vendidos.
 */
function SeccionNegocio({ slug, negocio }: { slug: string; negocio: Negocio }) {
  const router = useRouter();
  const [comidas, setComidas] = useState<TipoComida[]>(negocio.tiposComida);
  const [dias, setDias] = useState<DiaSemana[]>(negocio.diasServicio);
  const [registro, setRegistro] = useState(negocio.registroAbierto);
  const [error, setError] = useState<string | null>(null);
  const [quitar, setQuitar] = useState(false);
  const [enCurso, arranca] = useTransition();
  const archivo = useRef<HTMLInputElement>(null);

  function subir(f: File) {
    const d = new FormData();
    d.set('archivo', f);
    arranca(async () => {
      const r = await subirLogo(slug, d);
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
            setError(null);
            d.set('registroAbierto', registro ? 'true' : 'false');
            const r = await guardarNegocio(slug, d);
            if (!r.ok) return setError(r.error);
            toast.success('Guardado.');
            router.refresh();
          })
        }
        className="space-y-5"
      >
        <div className="flex items-center gap-3">
          <LogoNegocio nombre={negocio.nombre} logoUrl={negocio.logoUrl} tamano={52} />
          <input
            ref={archivo}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) subir(f); }}
          />
          <Boton variante="secundario" type="button" icono={Upload} onClick={() => archivo.current?.click()}
            disabled={enCurso} title="PNG, JPG o WebP de hasta 512 KB">
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
            <Selector name="moneda" defaultValue={negocio.moneda}>
              {['USD', 'EUR', 'COP', 'PEN', 'MXN', 'CLP', 'ARS'].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Selector>
          </Campo>
        </Grupo>

        <Grupo titulo="Operativa" columnas={1}>
          <Campo etiqueta="Comidas" requerido>
            <Chips nombre="tiposComida" opciones={TIPOS_COMIDA} etiquetas={ETIQUETA_COMIDA} valor={comidas} alCambiar={setComidas} />
          </Campo>
          <Campo etiqueta="Días de reparto" requerido>
            <Chips nombre="diasServicio" opciones={DIAS_SEMANA} etiquetas={ETIQUETA_DIA} valor={dias} alCambiar={setDias} />
          </Campo>
        </Grupo>

        <Grupo titulo="Cancelaciones">
          {/* Lo que antes era una nota bajo el campo va en `title` (regla: sin notas de ayuda). */}
          <Campo etiqueta="Hora límite (0-23)" requerido>
            <Entrada name="horaLimiteCancelacion" type="number" min={0} max={23} defaultValue={negocio.horaLimiteCancelacion} required
              title="Hasta esa hora el cliente puede cancelar o reactivar el día en curso" />
          </Campo>
          <Campo etiqueta="Días cancelables (%)" requerido>
            <Entrada name="porcentajeCancelacion" type="number" min={0} max={100} defaultValue={negocio.porcentajeCancelacion} required
              title="Por defecto en un servicio nuevo: con 20 días y 20 %, el cliente puede cancelar 4" />
          </Campo>
          <div className="flex items-end pb-2">
            <Casilla etiqueta="Registro público abierto" marcado={registro} alCambiar={setRegistro} />
          </div>
        </Grupo>

        {error && <Aviso texto={error} />}
        <div className="hidden justify-end lg:flex">
          <Boton type="submit" tamano="lg" icono={Save} disabled={enCurso}>{enCurso ? 'Guardando…' : 'Guardar'}</Boton>
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
function Grupo({ titulo, columnas = 3, children }: { titulo: string; columnas?: 1 | 3; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-borde pt-4">
      <legend className="pr-2 text-[11px] font-semibold uppercase tracking-wide text-tenue">{titulo}</legend>
      <div className={columnas === 1 ? 'grid gap-3' : 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3'}>{children}</div>
    </fieldset>
  );
}

// ── Suscripción ─────────────────────────────────────────────────────────────
function SeccionSuscripcion({ plan }: { plan: Plan | null }) {
  if (!plan)
    return <div className="flex flex-1 flex-col items-center justify-center"><EstadoVacio icono={CreditCard} titulo="Sin suscripción" /></div>;
  return (
    <div className="space-y-3 p-4 sm:p-5">
      <Tarjeta className="p-4 sm:p-5">
        <dl className="grid gap-4 sm:grid-cols-3">
          <Dato titulo="Plan">{plan.nombre}</Dato>
          <Dato titulo="Mensualidad">{plan.precioMensual > 0 ? `${dinero(plan.precioMensual, plan.moneda)} / mes` : 'Por definir'}</Dato>
          <Dato titulo="Pagado hasta">{plan.pagadoHasta ?? '—'}</Dato>
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
      {plan.mesesRetencion && (
        <Aviso
          tono="aviso"
          texto={`Se conserva ${plan.mesesRetencion === 1 ? 'un mes' : `${plan.mesesRetencion} meses`} de histórico: lo anterior se borra el último día de cada mes. Exporta desde Reportes lo que quieras guardar.`}
        />
      )}
    </div>
  );
}

function Dato({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] font-semibold uppercase tracking-wide text-tenue">{titulo}</dt>
      <dd className="truncate text-[14px] font-semibold text-texto">{children}</dd>
    </div>
  );
}

// ── Mi cuenta ───────────────────────────────────────────────────────────────
function SeccionCuenta({ slug }: { slug: string }) {
  const [error, setError] = useState<string | null>(null);
  const [enCurso, arranca] = useTransition();
  return (
    <div className="flex flex-1 flex-col p-4 sm:p-5">
      <h2 className="hidden text-[14px] font-semibold text-texto lg:block">Tu contraseña</h2>
      <form
        id="form-clave"
        action={(d) =>
          arranca(async () => {
            setError(null);
            const r = await cambiarMiClave(slug, d);
            if (!r.ok) return setError(r.error);
            toast.success('Cambiada.');
            (document.getElementById('form-clave') as HTMLFormElement | null)?.reset();
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
            <Entrada name="nueva" type="password" autoComplete="new-password" required minLength={8} />
          </Campo>
        </div>
        {error && <Aviso texto={error} />}
        <div className="hidden justify-end lg:flex">
          <Boton type="submit" tamano="lg" icono={Save} disabled={enCurso}>{enCurso ? 'Cambiando…' : 'Cambiar contraseña'}</Boton>
        </div>
      </form>
    </div>
  );
}

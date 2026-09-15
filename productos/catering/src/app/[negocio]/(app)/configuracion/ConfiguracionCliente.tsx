'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Palette, SlidersHorizontal, CreditCard, KeyRound, Upload } from 'lucide-react';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Boton, Campo, Entrada, Selector, Tarjeta, RailFiltro, EstadoVacio } from '@/componentes/ui';
import { Aviso, Chips, Casilla } from '@/componentes/campos';
import { LogoNegocio } from '@/componentes/Marca';
import { ACENTO_GCC, tokensDeMarca } from '@/lib/marca';
import { dinero } from '@/lib/formato';
import { TIPOS_COMIDA, ETIQUETA_COMIDA, DIAS_SEMANA, ETIQUETA_DIA } from '@/lib/catalogo';
import { cambiarMiClave } from '@/acciones/usuarios';
import { guardarMarca, guardarOperativa, subirLogo } from '@/acciones/configuracion';
import { cn } from '@/lib/utils';
import type { TipoComida, DiaSemana } from '@/generated/prisma/enums';

type Marca = { nombre: string; colorAcento: string; tema: 'CLARO' | 'OSCURO'; logoUrl: string | null; moneda: string };
type Operativa = { tiposComida: TipoComida[]; diasServicio: DiaSemana[]; horaLimiteCancelacion: number; porcentajeCancelacion: number; registroAbierto: boolean };
type Plan = {
  nombre: string;
  precioMensual: number;
  moneda: string;
  pagadoHasta: string | null;
  mesesRetencion: number | null;
  caracteristicas: string[];
};

type Seccion = 'marca' | 'operativa' | 'suscripcion' | 'cuenta';

const SUGERIDOS = [ACENTO_GCC, '#C9952C', '#0F6CBD', '#0F7B0F', '#B4009E', '#C4314B', '#1B1A19'];

export default function ConfiguracionCliente({
  slug,
  marca,
  operativa,
  plan,
  hayCloudinary,
}: {
  slug: string;
  marca: Marca;
  operativa: Operativa;
  plan: Plan | null;
  hayCloudinary: boolean;
}) {
  const [seccion, setSeccion] = useState<Seccion>('marca');
  return (
    <>
      <CabeceraPagina titulo="Configuración" descripcion="La marca, cómo trabaja el negocio, la suscripción y tu cuenta" />
      <div className="flex flex-col gap-4 p-4 sm:p-6 lg:flex-row">
        <RailFiltro
          opciones={[
            { valor: 'marca', etiqueta: 'Marca', icono: Palette },
            { valor: 'operativa', etiqueta: 'Operativa', icono: SlidersHorizontal },
            { valor: 'suscripcion', etiqueta: 'Suscripción', icono: CreditCard },
            { valor: 'cuenta', etiqueta: 'Mi cuenta', icono: KeyRound },
          ]}
          activo={seccion}
          alElegir={(v) => setSeccion(v as Seccion)}
        />
        <div className="min-w-0 flex-1">
          {seccion === 'marca' && <SeccionMarca slug={slug} marca={marca} hayCloudinary={hayCloudinary} />}
          {seccion === 'operativa' && <SeccionOperativa slug={slug} o={operativa} />}
          {seccion === 'suscripcion' && <SeccionSuscripcion plan={plan} />}
          {seccion === 'cuenta' && <SeccionCuenta slug={slug} />}
        </div>
      </div>
    </>
  );
}

// ── Marca ───────────────────────────────────────────────────────────────────
function SeccionMarca({ slug, marca, hayCloudinary }: { slug: string; marca: Marca; hayCloudinary: boolean }) {
  const router = useRouter();
  const [color, setColor] = useState(marca.colorAcento);
  const [tema, setTema] = useState<'CLARO' | 'OSCURO'>(marca.tema);
  const [logoUrl, setLogoUrl] = useState(marca.logoUrl ?? '');
  const [nombre, setNombre] = useState(marca.nombre);
  const [error, setError] = useState<string | null>(null);
  const [enCurso, arranca] = useTransition();

  return (
    <Tarjeta className="p-5">
      <h2 className="text-[14px] font-semibold">Marca del negocio</h2>
      <p className="mt-0.5 text-[12px] text-tenue">
        El nombre, el logo, el color y el tema que ve tu equipo dentro de la aplicación.
      </p>
      <form
        action={(d) =>
          arranca(async () => {
            setError(null);
            const r = await guardarMarca(slug, d);
            if (!r.ok) return setError(r.error);
            toast.success('Marca actualizada');
            router.refresh();
          })
        }
        className="mt-5 space-y-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre del negocio" requerido>
            <Entrada name="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </Campo>
          <Campo etiqueta="Moneda" requerido>
            <Selector name="moneda" defaultValue={marca.moneda}>
              {['USD', 'EUR', 'COP', 'PEN', 'MXN', 'CLP', 'ARS'].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Selector>
          </Campo>
        </div>

        <Campo etiqueta="Logo">
          <div className="flex flex-wrap items-center gap-3">
            <LogoNegocio nombre={nombre} logoUrl={logoUrl || null} tamano={48} />
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
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    arranca(async () => {
                      const d = new FormData();
                      d.set('archivo', f);
                      const r = await subirLogo(slug, d);
                      if (!r.ok) {
                        setError(r.error);
                        return;
                      }
                      setLogoUrl(r.url!);
                      toast.success('Logo subido. No olvides guardar.');
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

        <Campo etiqueta="Color de la marca" requerido>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value.toUpperCase())}
              className="h-9 w-12 cursor-pointer rounded border border-borde bg-tarjeta p-1"
              aria-label="Elegir color"
            />
            <Entrada name="colorAcento" value={color} onChange={(e) => setColor(e.target.value.toUpperCase())} className="w-32 font-mono" />
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

        <div>
          <p className="mb-1 text-[12px] font-semibold">Vista previa</p>
          <div
            className={cn('rounded-md border border-borde p-4', tema === 'OSCURO' && 'oscuro')}
            style={{ ...tokensDeMarca(color, tema === 'OSCURO'), background: 'var(--color-fondo)' } as React.CSSProperties}
          >
            <div className="flex items-center gap-3">
              <LogoNegocio nombre={nombre || 'N'} logoUrl={logoUrl || null} tamano={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold" style={{ color: 'var(--color-texto)' }}>
                  {nombre || 'Tu negocio'}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--color-tenue)' }}>Gestión de Catering</p>
              </div>
              <span
                className="rounded px-3 py-1.5 text-[12px] font-semibold"
                style={{ background: 'var(--color-acento)', color: 'var(--color-acento-contraste)' }}
              >
                Nuevo cliente
              </span>
            </div>
          </div>
        </div>

        {error && <Aviso texto={error} />}
        <div className="flex justify-end border-t border-borde pt-4">
          <Boton type="submit" disabled={enCurso}>{enCurso ? 'Guardando…' : 'Guardar marca'}</Boton>
        </div>
      </form>
    </Tarjeta>
  );
}

// ── Operativa ───────────────────────────────────────────────────────────────
function SeccionOperativa({ slug, o }: { slug: string; o: Operativa }) {
  const router = useRouter();
  const [comidas, setComidas] = useState<TipoComida[]>(o.tiposComida);
  const [dias, setDias] = useState<DiaSemana[]>(o.diasServicio);
  const [registro, setRegistro] = useState(o.registroAbierto);
  const [error, setError] = useState<string | null>(null);
  const [enCurso, arranca] = useTransition();
  return (
    <Tarjeta className="p-5">
      <h2 className="text-[14px] font-semibold">Cómo trabaja el negocio</h2>
      <p className="mt-0.5 text-[12px] text-tenue">Lo que ofreces, cuándo repartes y las reglas de cancelación. Cambiarlo no toca los servicios ya vendidos.</p>
      <form
        action={(d) => arranca(async () => {
          setError(null);
          d.set('registroAbierto', registro ? 'true' : 'false');
          const r = await guardarOperativa(slug, d);
          if (!r.ok) return setError(r.error);
          toast.success('Operativa guardada');
          router.refresh();
        })}
        className="mt-5 space-y-5"
      >
        <Campo etiqueta="Comidas que ofrece el negocio" requerido>
          <Chips nombre="tiposComida" opciones={TIPOS_COMIDA} etiquetas={ETIQUETA_COMIDA} valor={comidas} alCambiar={setComidas} />
        </Campo>
        <Campo etiqueta="Días en que reparte" requerido>
          <Chips nombre="diasServicio" opciones={DIAS_SEMANA} etiquetas={ETIQUETA_DIA} valor={dias} alCambiar={setDias} />
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Hora límite para cancelar el día de hoy" requerido>
            <div className="flex items-center gap-2">
              <Entrada name="horaLimiteCancelacion" type="number" min={0} max={23} defaultValue={o.horaLimiteCancelacion} className="w-24" required />
              <span className="text-[12px] text-tenue">:00 · hasta esa hora el cliente puede cancelar o reactivar el día en curso</span>
            </div>
          </Campo>
          <Campo etiqueta="% de días cancelables (por defecto en un servicio nuevo)" requerido>
            <div className="flex items-center gap-2">
              <Entrada name="porcentajeCancelacion" type="number" min={0} max={100} defaultValue={o.porcentajeCancelacion} className="w-24" required />
              <span className="text-[12px] text-tenue">% · con 20 días y 20 %, el cliente puede cancelar 4</span>
            </div>
          </Campo>
        </div>
        <Casilla etiqueta="Registro público abierto" descripcion={`Los clientes pueden registrarse solos en /${slug}/registro y quedan pendientes de tu aprobación.`} marcado={registro} alCambiar={setRegistro} />
        {error && <Aviso texto={error} />}
        <div className="flex justify-end border-t border-borde pt-4">
          <Boton type="submit" disabled={enCurso}>{enCurso ? 'Guardando…' : 'Guardar operativa'}</Boton>
        </div>
      </form>
    </Tarjeta>
  );
}

// ── Suscripción ─────────────────────────────────────────────────────────────
function SeccionSuscripcion({ plan }: { plan: Plan | null }) {
  if (!plan) return <Tarjeta><EstadoVacio icono={CreditCard} titulo="Sin suscripción registrada" /></Tarjeta>;
  return (
    <Tarjeta className="p-5">
      <h2 className="text-[14px] font-semibold">Tu suscripción</h2>
      <p className="mt-0.5 text-[12px] text-tenue">La gestiona el Grupo Corazones Cruzados. Aquí solo se consulta.</p>
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
              ? new Date(plan.pagadoHasta).toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })
              : '—'}
          </dd>
        </div>
      </dl>
      {plan.mesesRetencion && (
        <p className="mt-4 rounded border border-borde bg-aviso-suave px-3 py-2 text-[12px] text-aviso">
          Tu plan conserva <strong>{plan.mesesRetencion === 1 ? 'un mes' : `${plan.mesesRetencion} meses`}</strong> de
          histórico. En la última hora del último día de cada mes se borra lo anterior, automáticamente.
          Exporta a Excel desde <strong>Reportes</strong> lo que quieras guardar.
        </p>
      )}
      {plan.caracteristicas.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-borde pt-4 text-[13px]">
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
        id="form-clave"
        action={(d) => arranca(async () => {
          setError(null);
          const r = await cambiarMiClave(slug, d);
          if (!r.ok) return setError(r.error);
          toast.success('Contraseña cambiada');
          (document.getElementById('form-clave') as HTMLFormElement | null)?.reset();
        })}
        className="mt-4 max-w-sm space-y-4"
      >
        <Campo etiqueta="Contraseña actual" requerido>
          <Entrada name="actual" type="password" autoComplete="current-password" required />
        </Campo>
        <Campo etiqueta="Contraseña nueva" requerido>
          <Entrada name="nueva" type="password" autoComplete="new-password" required minLength={8} />
        </Campo>
        {error && <Aviso texto={error} />}
        <Boton type="submit" disabled={enCurso}>{enCurso ? 'Cambiando…' : 'Cambiar contraseña'}</Boton>
      </form>
    </Tarjeta>
  );
}

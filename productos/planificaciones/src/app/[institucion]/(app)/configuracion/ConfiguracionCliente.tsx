'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Palette, CreditCard, Upload, FileText } from 'lucide-react';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Boton, Campo, Entrada, Selector, Tarjeta, RailFiltro, EstadoVacio } from '@/componentes/ui';
import { Aviso } from '@/componentes/campos';
import { LogoNegocio } from '@/componentes/Marca';
import { ACENTO_GCC, tokensDeMarca } from '@/lib/marca';
import { dinero } from '@/lib/formato';
import { guardarMarca, subirLogo } from '@/acciones/configuracion';
import { cn } from '@/lib/utils';

type Marca = { nombre: string; colorAcento: string; tema: 'CLARO' | 'OSCURO'; logoUrl: string | null; plantillaPorDefecto: string };
type PlantillaVista = { clave: string; nombre: string; descripcion: string };
type Plan = {
  nombre: string;
  precioMensual: number;
  moneda: string;
  pagadoHasta: string | null;
  mesesRetencion: number | null;
  maxUsuarios: number | null;
  maxGeneracionesSemana: number | null;
  caracteristicas: string[];
};

type Seccion = 'marca' | 'suscripcion';

const SUGERIDOS = [ACENTO_GCC, '#C9952C', '#0F6CBD', '#0F7B0F', '#B4009E', '#C4314B', '#1B1A19'];

export default function ConfiguracionCliente({
  slug,
  marca,
  plantillas,
  plan,
  cortesia,
  hayCloudinary,
}: {
  slug: string;
  marca: Marca;
  plantillas: PlantillaVista[];
  plan: Plan | null;
  cortesia: boolean;
  hayCloudinary: boolean;
}) {
  const [seccion, setSeccion] = useState<Seccion>('marca');
  return (
    <>
      <CabeceraPagina titulo="Configuración" descripcion="La marca de la institución, la plantilla por defecto y la suscripción" />
      <div className="flex flex-col gap-4 p-4 sm:p-6 lg:flex-row">
        <RailFiltro
          opciones={[
            { valor: 'marca', etiqueta: 'Marca y plantilla', icono: Palette },
            { valor: 'suscripcion', etiqueta: 'Suscripción', icono: CreditCard },
          ]}
          activo={seccion}
          alElegir={(v) => setSeccion(v as Seccion)}
        />
        <div className="min-w-0 flex-1">
          {seccion === 'marca' && <SeccionMarca slug={slug} marca={marca} plantillas={plantillas} hayCloudinary={hayCloudinary} />}
          {seccion === 'suscripcion' && <SeccionSuscripcion plan={plan} cortesia={cortesia} />}
        </div>
      </div>
    </>
  );
}

// ── Marca ───────────────────────────────────────────────────────────────────
function SeccionMarca({ slug, marca, plantillas, hayCloudinary }: { slug: string; marca: Marca; plantillas: PlantillaVista[]; hayCloudinary: boolean }) {
  const router = useRouter();
  const [color, setColor] = useState(marca.colorAcento);
  const [tema, setTema] = useState<'CLARO' | 'OSCURO'>(marca.tema);
  const [logoUrl, setLogoUrl] = useState(marca.logoUrl ?? '');
  const [nombre, setNombre] = useState(marca.nombre);
  const [error, setError] = useState<string | null>(null);
  const [enCurso, arranca] = useTransition();

  return (
    <Tarjeta className="p-5">
      <h2 className="text-[14px] font-semibold">Marca de la institución</h2>
      <p className="mt-0.5 text-[12px] text-tenue">
        El nombre, el logo, el color y el tema que ven los docentes dentro de la aplicación, y la plantilla con la que nacen las planificaciones.
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
        <Campo etiqueta="Nombre de la institución" requerido>
          <Entrada name="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        </Campo>
        <Campo etiqueta="Plantilla por defecto de las planificaciones nuevas" requerido>
          <Selector name="plantillaPorDefecto" defaultValue={marca.plantillaPorDefecto}>
            {plantillas.map((t) => (
              <option key={t.clave} value={t.clave}>{t.nombre}</option>
            ))}
          </Selector>
          <p className="mt-1 flex items-start gap-1.5 text-[11px] text-tenue"><FileText className="mt-px h-3.5 w-3.5 shrink-0" />{plantillas.find((t) => t.clave === marca.plantillaPorDefecto)?.descripcion ?? ''} El diseño del formato y los datos de la institución que lleva impresos los configura el Grupo Corazones Cruzados.</p>
        </Campo>

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
                  {nombre || 'Tu institución'}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--color-tenue)' }}>Planificación de Clases</p>
              </div>
              <span
                className="rounded px-3 py-1.5 text-[12px] font-semibold"
                style={{ background: 'var(--color-acento)', color: 'var(--color-acento-contraste)' }}
              >
                Nueva planificación
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

// ── Suscripción ─────────────────────────────────────────────────────────────
function SeccionSuscripcion({ plan, cortesia }: { plan: Plan | null; cortesia: boolean }) {
  if (cortesia)
    return (
      <Tarjeta className="p-5">
        <h2 className="text-[14px] font-semibold">Acceso del grupo</h2>
        <p className="mt-1 text-[13px] text-tenue">Esta institución es la del Grupo Corazones Cruzados: el acceso es completo, sin mensualidad ni topes de cuentas o de planificaciones.</p>
      </Tarjeta>
    );
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
      <p className="mt-4 rounded border border-borde bg-acento-suave px-3 py-2 text-[12px] text-acento">
        Topes del plan: <strong>{plan.maxUsuarios ?? 'sin límite de'}</strong> cuentas activas y{' '}
        <strong>{plan.maxGeneracionesSemana ?? 'sin límite de'}</strong> planificaciones semanales generadas por semana natural, para toda la institución.
        {plan.mesesRetencion ? ` Se conserva ${plan.mesesRetencion === 1 ? 'un mes' : `${plan.mesesRetencion} meses`} de histórico.` : ' Las planificaciones se conservan sin límite de tiempo.'}
      </p>
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

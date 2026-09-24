'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Palette, CreditCard, KeyRound, Upload } from 'lucide-react';
import { Boton, Campo, Entrada, Selector, Insignia, Tarjeta, RailFiltro } from '@/componentes/ui';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { LogoHotel } from '@/componentes/Marca';
import { guardarMarca, subirLogo, cambiarMiClave } from '@/acciones/configuracion';
import { cn } from '@/lib/utils';
import PanelSuscripcion, { type SuscripcionVista } from '@/componentes/PanelSuscripcion';

export type MarcaVista = {
  nombre: string;
  colorAcento: string;
  tema: 'CLARO' | 'OSCURO';
  logoUrl: string | null;
  zonaHoraria: string;
};

/**
 * La suscripción la pinta `PanelSuscripcion`, que es el MISMO que ve un cliente
 * bloqueado en `/‹cliente›/suscripcion`. Por eso el tipo viene de allí y no se
 * declara aquí: con dos tipos, una de las dos pantallas acabaría sin el botón de
 * pagar —que es exactamente lo que pasó—.
 */
export type { SuscripcionVista };

export type PagoVista = {
  id: number; periodo: string; monto: number; moneda: string; estado: string; metodo: string; pagadoEn: string | null;
};

type Seccion = 'marca' | 'suscripcion' | 'cuenta';

/**
 * CONFIGURACIÓN CON SUBMENÚ, como en Gestión de Pedidos (Fernando, 2026-09-23: «no
 * debería haber módulo de suscripción, sino que en el módulo de configuración están las
 * opciones o un submenú»).
 *
 * La suscripción deja de ser un destino del menú principal: no es algo que se mire a
 * diario, es algo que se consulta cuando toca. Lo que se mira a diario —conversaciones,
 * estudio, envíos— es lo que merece un sitio arriba.
 */
export default function ConfiguracionCliente({
  slug,
  marca,
  suscripcion,
  pagos,
  hayCloudinary,
  miOrigen,
}: {
  slug: string;
  marca: MarcaVista;
  suscripcion: SuscripcionVista;
  pagos: PagoVista[];
  hayCloudinary: boolean;
  miOrigen: 'GCC' | 'PRODUCTO' | null;
}) {
  const [seccion, setSeccion] = useState<Seccion>('marca');
  return (
    <div className="flex h-full flex-col">
      <CabeceraPagina titulo="Configuración" descripcion="La marca, tu suscripción y tu cuenta" />
      {/* La misma norma que el Estudio: el contenedor ocupa el alto disponible. */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6 lg:flex-row">
        <RailFiltro
          opciones={[
            { valor: 'marca', etiqueta: 'Marca', icono: Palette },
            { valor: 'suscripcion', etiqueta: 'Suscripción', icono: CreditCard },
            { valor: 'cuenta', etiqueta: 'Mi cuenta', icono: KeyRound },
          ]}
          activo={seccion}
          alElegir={(v) => setSeccion(v as Seccion)}
        />
        <div className="desplaza min-h-0 min-w-0 flex-1 overflow-y-auto">
          {seccion === 'marca' && <SeccionMarca slug={slug} marca={marca} hayCloudinary={hayCloudinary} />}
          {seccion === 'suscripcion' && <SeccionSuscripcion slug={slug} s={suscripcion} pagos={pagos} />}
          {seccion === 'cuenta' && <SeccionCuenta slug={slug} miOrigen={miOrigen} />}
        </div>
      </div>
    </div>
  );
}

// ── Marca ────────────────────────────────────────────────────────────────────
const SUGERIDOS = ['#4B2D8E', '#C9952C', '#2563EB', '#15803D', '#BE185D', '#B91C1C', '#1F2937'];

function SeccionMarca({ slug, marca, hayCloudinary }: { slug: string; marca: MarcaVista; hayCloudinary: boolean }) {
  const router = useRouter();
  const [enCurso, arranca] = useTransition();
  const [color, setColor] = useState(marca.colorAcento);
  const [tema, setTema] = useState<'CLARO' | 'OSCURO'>(marca.tema);
  const [logo, setLogo] = useState(marca.logoUrl ?? '');
  const [nombre, setNombre] = useState(marca.nombre);
  const archivo = useRef<HTMLInputElement>(null);

  return (
    <Tarjeta className="p-4 sm:p-5">
      <h2 className="text-[14px] font-semibold text-texto">Tu marca</h2>
      <p className="mb-4 text-[12px] text-tenue">
        El nombre, el logo, el color y el tema que ve tu equipo dentro de la aplicación.
      </p>

      <form
        action={(d) =>
          arranca(async () => {
            const r = await guardarMarca(slug, d);
            if (!r.ok) { toast.error(r.error); return; }
            toast.success(r.mensaje ?? 'Guardado.');
            router.refresh();
          })
        }
        className="space-y-4"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Nombre" requerido>
            <Entrada name="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </Campo>
          <Campo etiqueta="Zona horaria">
            <Selector name="zonaHoraria" defaultValue={marca.zonaHoraria}>
              <option value="America/Guayaquil">Ecuador (America/Guayaquil)</option>
              <option value="America/Bogota">Colombia (America/Bogota)</option>
              <option value="America/Lima">Perú (America/Lima)</option>
              <option value="America/Mexico_City">México (America/Mexico_City)</option>
              <option value="Europe/Madrid">España (Europe/Madrid)</option>
            </Selector>
          </Campo>
        </div>

        <Campo etiqueta="Logo">
          <div className="flex items-center gap-2">
            <LogoHotel nombre={nombre} logoUrl={logo || null} tamano={44} />
            <Entrada
              name="logoUrl"
              value={logo}
              onChange={(e) => setLogo(e.target.value)}
              placeholder="https://…  (o sube una imagen)"
            />
            {hayCloudinary && (
              <>
                <input
                  ref={archivo}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const fd = new FormData();
                    fd.set('archivo', f);
                    arranca(async () => {
                      const r = await subirLogo(slug, fd);
                      if (!r.ok) { toast.error(r.error); return; }
                      setLogo(r.url ?? '');
                      toast.success('Logo subido. Acuérdate de guardar.');
                    });
                  }}
                />
                <Boton variante="secundario" type="button" onClick={() => archivo.current?.click()} disabled={enCurso}>
                  <Upload className="h-4 w-4" /> Subir
                </Boton>
              </>
            )}
          </div>
        </Campo>

        <Campo etiqueta="Color" requerido>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value.toUpperCase())}
                className="h-9 w-12 cursor-pointer rounded border border-borde bg-tarjeta p-1"
                aria-label="Elegir color"
              />
              <Entrada name="colorAcento" value={color} onChange={(e) => setColor(e.target.value.toUpperCase())} required />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SUGERIDOS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={cn('h-7 w-7 rounded-full border-2', color === c ? 'border-texto' : 'border-transparent')}
                  aria-label={`Usar ${c}`}
                />
              ))}
            </div>
          </div>
        </Campo>

        <Campo etiqueta="Tema">
          <input type="hidden" name="tema" value={tema} />
          <div className="grid grid-cols-2 gap-2">
            {(['CLARO', 'OSCURO'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTema(t)}
                className={cn(
                  'h-11 rounded border text-[13px] transition-colors',
                  tema === t ? 'border-acento bg-acento-suave font-semibold text-acento' : 'border-borde text-texto hover:bg-realce',
                )}
              >
                {t === 'CLARO' ? 'Claro' : 'Oscuro'}
              </button>
            ))}
          </div>
        </Campo>

        {/* La vista previa enseña el cambio ANTES de guardarlo: un color se elige
            mirándolo, no leyendo su código hexadecimal. */}
        <div>
          <p className="mb-1 text-[12px] text-tenue">Vista previa</p>
          <div className="flex items-center justify-between gap-3 rounded border border-borde bg-realce px-3 py-2.5">
            <div className="flex items-center gap-2.5">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded text-[13px] font-bold text-white"
                style={{ backgroundColor: color }}
              >
                {(nombre || '?').charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-texto">{nombre || 'Tu negocio'}</p>
                <p className="text-[11px] text-tenue">Automatizaciones de WhatsApp</p>
              </div>
            </div>
            <span
              className="rounded px-3 py-1.5 text-[12px] font-medium text-white"
              style={{ backgroundColor: color }}
            >
              Conversaciones
            </span>
          </div>
        </div>

        <div className="flex justify-end">
          <Boton type="submit" tamano="lg" disabled={enCurso}>
            {enCurso ? 'Guardando…' : 'Guardar marca'}
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}

// ── Suscripción ──────────────────────────────────────────────────────────────
const ETIQUETA_METODO: Record<string, string> = {
  AUTOSERVICIO: 'Registrado por GCC', TARJETA: 'Tarjeta', APP_STORE: 'App Store', GOOGLE_PLAY: 'Google Play',
};

/**
 * ⭐ AQUÍ SE PAGA (Fernando, 2026-09-23: «aquí no debería estar la opción para pagar,
 * no veo la interfaz que permita pagar»).
 *
 * Tenía razón: el botón existía, pero solo en la pantalla que se ve con el acceso ya
 * cerrado. Y esta —Configuración → Suscripción— es la que se mira normalmente, y la que
 * él pidió desde el principio. Ahora las dos son el mismo componente, así que no puede
 * volver a haber una con botón y otra sin él.
 */
function SeccionSuscripcion({ slug, s, pagos }: { slug: string; s: SuscripcionVista; pagos: PagoVista[] }) {
  return (
    <div className="space-y-3">
      <PanelSuscripcion slug={slug} s={s} />

      {pagos.length > 0 && (
        <Tarjeta className="divide-y divide-borde">
          <p className="px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-tenue">Pagos registrados</p>
          {pagos.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="text-[13.5px] text-texto">{p.periodo}</p>
                <p className="truncate text-[11.5px] text-tenue">
                  {p.pagadoEn ?? 'sin fecha'} · {ETIQUETA_METODO[p.metodo] ?? p.metodo}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[13.5px] tabular-nums text-texto">{p.monto.toFixed(2)} {p.moneda}</p>
                <Insignia tono={p.estado === 'PAGADO' ? 'exito' : p.estado === 'FALLIDO' ? 'error' : 'neutro'}>
                  {p.estado === 'PAGADO' ? 'Pagado' : p.estado === 'FALLIDO' ? 'Fallido' : 'Pendiente'}
                </Insignia>
              </div>
            </div>
          ))}
        </Tarjeta>
      )}
    </div>
  );
}

// ── Mi cuenta ────────────────────────────────────────────────────────────────
function SeccionCuenta({ slug, miOrigen }: { slug: string; miOrigen: 'GCC' | 'PRODUCTO' | null }) {
  const [enCurso, arranca] = useTransition();
  const esDeGcc = miOrigen === 'GCC';

  return (
    <Tarjeta className="p-4 sm:p-5">
      <h2 className="text-[14px] font-semibold text-texto">Tu contraseña</h2>

      {esDeGcc ? (
        /* Se le dice ANTES de que lo intente. Un formulario que siempre falla es peor
           que no tener formulario. */
        <p className="mt-2 rounded border border-borde bg-realce px-3 py-2.5 text-[12.5px] leading-relaxed text-tenue">
          Entras con tu <strong>cuenta de cliente de GCC World</strong>, así que aquí no hay ninguna
          contraseña que cambiar: la tuya vive en la plataforma y se cambia allí. El día que la
          cambies, cambia también tu entrada aquí.
        </p>
      ) : (
        <form
          action={(d) =>
            arranca(async () => {
              const r = await cambiarMiClave(slug, d);
              if (!r.ok) { toast.error(r.error); return; }
              toast.success(r.mensaje ?? 'Cambiada.');
            })
          }
          className="mt-3 max-w-sm space-y-3"
        >
          <Campo etiqueta="Contraseña actual">
            <Entrada name="actual" type="password" autoComplete="current-password" required />
          </Campo>
          <Campo etiqueta="Contraseña nueva">
            <Entrada name="nueva" type="password" autoComplete="new-password" minLength={8} required />
          </Campo>
          <Boton type="submit" disabled={enCurso}>{enCurso ? 'Cambiando…' : 'Cambiar contraseña'}</Boton>
        </form>
      )}
    </Tarjeta>
  );
}


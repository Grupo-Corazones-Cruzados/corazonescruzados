'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Palette, Building2, Receipt, CreditCard, KeyRound, Plus, Pencil, Trash2, Upload, AlertCircle, Users } from 'lucide-react';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Boton, BotonIcono, Campo, Entrada, Selector, Tarjeta, RailFiltro, PanelLateral, Confirmar, Insignia, EstadoVacio } from '@/componentes/ui';
import { LogoHotel } from '@/componentes/Marca';
import { ACENTO_GCC, tokensDeMarca } from '@/lib/marca';
import { calcularCuenta } from '@/lib/pedidos';
import { dinero } from '@/lib/formato';
import { cambiarMiClave } from '@/acciones/usuarios';
import { guardarMarca, guardarFacturacion, subirLogo } from '@/acciones/configuracion';
import { guardarZona, eliminarZona, guardarMesa, eliminarMesa } from '@/acciones/mesas';
import { cn } from '@/lib/utils';

type MesaVista = { id: number; nombre: string; capacidad: number | null; pedidos: number };
type ZonaVista = { id: number; nombre: string; mesas: MesaVista[] };
type Marca = { nombre: string; colorAcento: string; tema: 'CLARO' | 'OSCURO'; logoUrl: string | null; moneda: string };
type Facturacion = { aplicaIva: boolean; ivaPorcentaje: number; precioConIva: boolean };
type Plan = {
  nombre: string;
  precioMensual: number;
  moneda: string;
  pagadoHasta: string | null;
  mesesRetencion: number | null;
  caracteristicas: string[];
};

type Seccion = 'marca' | 'facturacion' | 'lugares' | 'suscripcion' | 'cuenta';

const SUGERIDOS = [ACENTO_GCC, '#C9952C', '#0F6CBD', '#0F7B0F', '#B4009E', '#C4314B', '#1B1A19'];

export default function ConfiguracionCliente({
  slug,
  marca,
  facturacion,
  plan,
  zonas,
  hayCloudinary,
}: {
  slug: string;
  marca: Marca;
  facturacion: Facturacion;
  plan: Plan | null;
  zonas: ZonaVista[];
  hayCloudinary: boolean;
}) {
  const [seccion, setSeccion] = useState<Seccion>('marca');
  return (
    <>
      <CabeceraPagina titulo="Configuración" descripcion="La marca, cómo facturas, el local y tu cuenta" />
      <div className="flex flex-col gap-4 p-4 sm:p-6 lg:flex-row">
        <RailFiltro
          opciones={[
            { valor: 'marca', etiqueta: 'Marca', icono: Palette },
            { valor: 'facturacion', etiqueta: 'Facturación', icono: Receipt },
            { valor: 'lugares', etiqueta: 'Zonas y mesas', icono: Building2 },
            { valor: 'suscripcion', etiqueta: 'Suscripción', icono: CreditCard },
            { valor: 'cuenta', etiqueta: 'Mi cuenta', icono: KeyRound },
          ]}
          activo={seccion}
          alElegir={(v) => setSeccion(v as Seccion)}
        />
        <div className="min-w-0 flex-1">
          {seccion === 'marca' && <SeccionMarca slug={slug} marca={marca} hayCloudinary={hayCloudinary} />}
          {seccion === 'facturacion' && <SeccionFacturacion slug={slug} f={facturacion} moneda={marca.moneda} />}
          {seccion === 'lugares' && <SeccionLugares slug={slug} zonas={zonas} />}
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
              <LogoHotel nombre={nombre || 'N'} logoUrl={logoUrl || null} tamano={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold" style={{ color: 'var(--color-texto)' }}>
                  {nombre || 'Tu negocio'}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--color-tenue)' }}>Gestión de Pedidos</p>
              </div>
              <span
                className="rounded px-3 py-1.5 text-[12px] font-semibold"
                style={{ background: 'var(--color-acento)', color: 'var(--color-acento-contraste)' }}
              >
                Tomar pedido
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

// ── Facturación ─────────────────────────────────────────────────────────────
function SeccionFacturacion({ slug, f, moneda }: { slug: string; f: Facturacion; moneda: string }) {
  const router = useRouter();
  const [aplica, setAplica] = useState(f.aplicaIva);
  const [dentro, setDentro] = useState(f.precioConIva);
  const [tasa, setTasa] = useState(String(f.ivaPorcentaje));
  const [error, setError] = useState<string | null>(null);
  const [enCurso, arranca] = useTransition();

  // Un ejemplo con números reales: es la única forma de que se entienda la
  // diferencia entre «el precio ya lleva IVA» y «se le suma».
  const ejemplo = calcularCuenta([{ precioUnitario: 10, cantidad: 1 }], {
    aplicaIva: aplica,
    ivaPorcentaje: Number(tasa) || 0,
    precioConIva: dentro,
  });

  return (
    <Tarjeta className="p-5">
      <h2 className="text-[14px] font-semibold">Cómo facturas</h2>
      <p className="mt-0.5 text-[12px] text-tenue">
        Decide si cobras IVA y si los precios de la carta ya lo llevan dentro.
      </p>
      <form
        action={(d) =>
          arranca(async () => {
            setError(null);
            const r = await guardarFacturacion(slug, d);
            if (!r.ok) return setError(r.error);
            toast.success('Facturación actualizada');
            router.refresh();
          })
        }
        className="mt-5 max-w-lg space-y-4"
      >
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" name="aplicaIva" checked={aplica} onChange={(e) => setAplica(e.target.checked)} className="h-4 w-4 accent-[var(--color-acento)]" />
          Este negocio cobra IVA
        </label>

        {aplica && (
          <>
            <Campo etiqueta="Porcentaje de IVA" requerido>
              <Entrada name="ivaPorcentaje" type="number" step="0.01" min="0" max="99" value={tasa} onChange={(e) => setTasa(e.target.value)} className="w-32" />
            </Campo>
            <label className="flex items-start gap-2 text-[13px]">
              <input type="checkbox" name="precioConIva" checked={dentro} onChange={(e) => setDentro(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-acento)]" />
              <span>
                Los precios de la carta <strong>ya incluyen</strong> el IVA
                <span className="block text-[12px] text-tenue">
                  Lo normal en un menú: el cliente ve {dinero(10, moneda)} y paga {dinero(10, moneda)}.
                  Si lo desmarcas, al cobrar se le sumará el impuesto encima.
                </span>
              </span>
            </label>
          </>
        )}

        <div className="rounded-md border border-borde bg-realce p-3 text-[13px]">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-tenue">
            Un producto de {dinero(10, moneda)} en la carta
          </p>
          <div className="flex justify-between"><span className="text-tenue">Base imponible</span><span>{dinero(ejemplo.subtotal, moneda)}</span></div>
          <div className="flex justify-between"><span className="text-tenue">IVA</span><span>{dinero(ejemplo.iva, moneda)}</span></div>
          <div className="flex justify-between border-t border-borde pt-1 font-semibold"><span>Cobra al cliente</span><span className="text-acento">{dinero(ejemplo.total, moneda)}</span></div>
        </div>

        <p className="text-[12px] leading-relaxed text-tenue">
          Cambiar esto <strong>no toca los pedidos ya cobrados</strong>: cada pedido guarda la tasa que
          se le aplicó, para que la caja de ayer siga cuadrando con lo que se cobró de verdad.
        </p>

        {error && <Aviso texto={error} />}
        <div className="flex justify-end border-t border-borde pt-4">
          <Boton type="submit" disabled={enCurso}>{enCurso ? 'Guardando…' : 'Guardar'}</Boton>
        </div>
      </form>
    </Tarjeta>
  );
}

// ── Zonas y mesas ───────────────────────────────────────────────────────────
function SeccionLugares({ slug, zonas }: { slug: string; zonas: ZonaVista[] }) {
  const router = useRouter();
  const [panelZona, setPanelZona] = useState<ZonaVista | null | 'nueva'>(null);
  const [panelMesa, setPanelMesa] = useState<{ m: MesaVista | null; zonaId: number } | null>(null);
  const [borrar, setBorrar] = useState<{ tipo: 'zona' | 'mesa'; id: number; nombre: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enCurso, arranca] = useTransition();

  const cerrar = () => { setPanelZona(null); setPanelMesa(null); setBorrar(null); setError(null); };
  const hecho = (m: string) => { toast.success(m); cerrar(); router.refresh(); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[14px] font-semibold">Zonas y mesas</h2>
          <p className="text-[12px] text-tenue">Las zonas agrupan las mesas; el tablero se dibuja sobre ellas.</p>
        </div>
        <Boton icono={Plus} onClick={() => setPanelZona('nueva')}>Nueva zona</Boton>
      </div>

      {!zonas.length && (
        <Tarjeta>
          <EstadoVacio icono={Building2} titulo="Todavía no hay zonas" detalle="Crea la primera —Salón, Terraza, Barra— y añádele sus mesas." />
        </Tarjeta>
      )}

      {zonas.map((z) => (
        <Tarjeta key={z.id} className="overflow-hidden">
          <div className="flex items-center gap-3 border-b border-borde px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold">{z.nombre}</p>
              <p className="text-[11px] text-tenue">{z.mesas.length} mesas</p>
            </div>
            <Boton variante="secundario" tamano="sm" icono={Plus} onClick={() => setPanelMesa({ m: null, zonaId: z.id })}>Mesa</Boton>
            <BotonIcono icono={Pencil} titulo="Editar zona" onClick={() => setPanelZona(z)} />
            <BotonIcono icono={Trash2} titulo="Eliminar zona" className="hover:bg-error-suave hover:text-error" onClick={() => setBorrar({ tipo: 'zona', id: z.id, nombre: z.nombre })} />
          </div>
          {z.mesas.length === 0 ? (
            <p className="px-4 py-5 text-center text-[12px] text-tenue">Esta zona todavía no tiene mesas.</p>
          ) : (
            <ul className="divide-y divide-[var(--color-borde)]">
              {z.mesas.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">Mesa {m.nombre}</p>
                    {m.capacidad && (
                      <p className="flex items-center gap-1 text-[11px] text-tenue"><Users className="h-3 w-3" /> {m.capacidad} personas</p>
                    )}
                  </div>
                  {m.pedidos > 0 && <Insignia tono="neutro">{m.pedidos} pedidos</Insignia>}
                  <BotonIcono icono={Pencil} titulo="Editar mesa" onClick={() => setPanelMesa({ m, zonaId: z.id })} />
                  <BotonIcono icono={Trash2} titulo="Eliminar mesa" className="hover:bg-error-suave hover:text-error" onClick={() => setBorrar({ tipo: 'mesa', id: m.id, nombre: m.nombre })} />
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      ))}

      <PanelLateral abierto={panelZona !== null} alCerrar={cerrar} titulo={panelZona === 'nueva' ? 'Nueva zona' : 'Editar zona'}>
        <form
          action={(d) => arranca(async () => {
            setError(null);
            const id = panelZona && panelZona !== 'nueva' ? panelZona.id : null;
            const r = await guardarZona(slug, id, d);
            if (!r.ok) return setError(r.error);
            hecho('Zona guardada');
          })}
          className="space-y-4"
        >
          <Campo etiqueta="Nombre" requerido>
            <Entrada name="nombre" required autoFocus placeholder="Salón, Terraza, Barra…" defaultValue={panelZona && panelZona !== 'nueva' ? panelZona.nombre : ''} />
          </Campo>
          {error && <Aviso texto={error} />}
          <div className="flex justify-end gap-2 border-t border-borde pt-4">
            <Boton type="button" variante="secundario" onClick={cerrar} disabled={enCurso}>Cancelar</Boton>
            <Boton type="submit" disabled={enCurso}>{enCurso ? 'Guardando…' : 'Guardar'}</Boton>
          </div>
        </form>
      </PanelLateral>

      <PanelLateral abierto={panelMesa !== null} alCerrar={cerrar} titulo={panelMesa?.m ? 'Editar mesa' : 'Nueva mesa'}>
        <form
          action={(d) => arranca(async () => {
            setError(null);
            const r = await guardarMesa(slug, panelMesa?.m?.id ?? null, d);
            if (!r.ok) return setError(r.error);
            hecho('Mesa guardada');
          })}
          className="space-y-4"
        >
          <input type="hidden" name="zonaId" value={panelMesa?.zonaId ?? ''} />
          <Campo etiqueta="Nombre o número" requerido>
            <Entrada name="nombre" required autoFocus placeholder="4, Terraza 2, Barra A…" defaultValue={panelMesa?.m?.nombre ?? ''} />
          </Campo>
          <Campo etiqueta="Capacidad (personas)">
            <Entrada name="capacidad" type="number" min="1" defaultValue={panelMesa?.m?.capacidad ?? ''} />
          </Campo>
          {error && <Aviso texto={error} />}
          <div className="flex justify-end gap-2 border-t border-borde pt-4">
            <Boton type="button" variante="secundario" onClick={cerrar} disabled={enCurso}>Cancelar</Boton>
            <Boton type="submit" disabled={enCurso}>{enCurso ? 'Guardando…' : 'Guardar'}</Boton>
          </div>
        </form>
      </PanelLateral>

      <Confirmar
        abierto={!!borrar}
        titulo={borrar?.tipo === 'zona' ? 'Eliminar la zona' : 'Eliminar la mesa'}
        mensaje={`«${borrar?.nombre}» dejará de existir. Si tiene mesas o pedidos asociados, la aplicación se negará y te dirá cuántos.`}
        ocupado={enCurso}
        alCerrar={cerrar}
        alAceptar={() => arranca(async () => {
          if (!borrar) return;
          const r = borrar.tipo === 'zona' ? await eliminarZona(slug, borrar.id) : await eliminarMesa(slug, borrar.id);
          if (!r.ok) { toast.error(r.error); return; }
          hecho('Eliminado');
        })}
      />
    </div>
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

const Aviso = ({ texto }: { texto: string }) => (
  <p role="alert" className="flex items-start gap-2 rounded border border-borde bg-error-suave px-3 py-2 text-[12px] text-error">
    <AlertCircle className="mt-px h-4 w-4 shrink-0" />
    {texto}
  </p>
);

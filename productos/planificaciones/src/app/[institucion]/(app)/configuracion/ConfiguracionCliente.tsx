'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Building2, Users, CreditCard, Upload, Trash2, Save, UserPlus, ImageOff } from 'lucide-react';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Boton, BotonIcono, Campo, Confirmar, Entrada, Selector, Tarjeta, EstadoVacio, Secciones, useSeccion, type OpcionRail } from '@/componentes/ui';
import { LogoNegocio } from '@/componentes/Marca';
import { dinero, fechaLarga } from '@/lib/formato';
import { subirLogo, quitarLogo } from '@/acciones/configuracion';
import { guardarNegocio } from '@/acciones/negocio';
import { COLORES_FORMATO } from '@/plantillas/pud/documento';
import SeccionUsuarios, { type UsuarioVista, type Cupo } from './SeccionUsuarios';

export type NegocioVista = {
  nombre: string;
  logoUrl: string | null;
  plantillaPorDefecto: string;
  contactoNombre: string | null;
  contactoEmail: string | null;
  contactoTelefono: string | null;
  cabeceraLinea1: string | null;
  cabeceraLinea2: string | null;
  cabeceraLinea3: string | null;
  anioLectivo: string | null;
  logoInstitucionUrl: string | null;
  logoOrganizacionUrl: string | null;
  logoOpcionalUrl: string | null;
};
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

type Seccion = 'negocio' | 'usuarios' | 'suscripcion';

const SECCIONES: OpcionRail[] = [
  { valor: 'negocio', etiqueta: 'Negocio', icono: Building2 },
  { valor: 'usuarios', etiqueta: 'Usuarios', icono: Users },
  { valor: 'suscripcion', etiqueta: 'Suscripción', icono: CreditCard },
];

/**
 * CONFIGURACIÓN CON SECCIONES, como Automatizaciones (Fernando, 2026-11-08): raíl a la izquierda
 * y la sección en un panel que llega hasta abajo; en el teléfono, portada de secciones y la
 * sección en `?seccion=`. Los «Guardar» viven al pie de su sección en escritorio y bajan a la
 * barra de abajo en el teléfono, unidos a su formulario con `form=`.
 */
export default function ConfiguracionCliente({
  slug,
  negocio,
  plantillas,
  usuarios,
  plan,
  cortesia,
}: {
  slug: string;
  negocio: NegocioVista;
  plantillas: PlantillaVista[];
  usuarios: { lista: UsuarioVista[]; cupo: Cupo };
  plan: Plan | null;
  cortesia: boolean;
}) {
  const s = useSeccion(SECCIONES);
  const seccion = s.activo as Seccion;
  const [crearCuenta, setCrearCuenta] = useState(false);
  const sinSitio = usuarios.cupo.quedan !== null && usuarios.cupo.quedan <= 0;
  const guardarTelefono =
    s.enUrl && seccion === 'negocio' ? <Boton form="form-negocio" type="submit" icono={Save}>Guardar</Boton>
    : s.enUrl && seccion === 'usuarios' ? <Boton icono={UserPlus} disabled={sinSitio} onClick={() => setCrearCuenta(true)}>Nueva cuenta</Boton>
    : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <CabeceraPagina
        titulo="Configuración"
        descripcion="Los datos de la institución, quién entra y la suscripción"
        tituloTelefono={s.enUrl ? s.etiqueta : undefined}
        volverTelefono={s.enUrl ? { href: s.hrefPortada, etiqueta: 'Volver a Configuración' } : undefined}
        accionesTelefono={guardarTelefono}
      />
      <Secciones opciones={SECCIONES} seccion={s}>
        {seccion === 'negocio' && <SeccionNegocio slug={slug} negocio={negocio} plantillas={plantillas} />}
        {seccion === 'usuarios' && <SeccionUsuarios slug={slug} usuarios={usuarios.lista} cupo={usuarios.cupo} abierto={crearCuenta} setAbierto={setCrearCuenta} />}
        {seccion === 'suscripcion' && <SeccionSuscripcion plan={plan} cortesia={cortesia} />}
      </Secciones>
    </div>
  );
}

// ── Negocio ──────────────────────────────────────────────────────────────────
const LOGOS: { clave: 'logoInstitucionUrl' | 'logoOrganizacionUrl' | 'logoOpcionalUrl'; etiqueta: string; pista: string }[] = [
  { clave: 'logoInstitucionUrl', etiqueta: 'Institución', pista: 'El primero, a la izquierda de la cabecera' },
  { clave: 'logoOrganizacionUrl', etiqueta: 'Organización', pista: 'El segundo: la red o el grupo al que pertenece' },
  { clave: 'logoOpcionalUrl', etiqueta: 'Tercero', pista: 'Opcional: solo se ve si lo agregas' },
];

/**
 * NEGOCIO = el antiguo módulo «Negocio» + la antigua sección «Marca» (2026-11-08). Es el mismo
 * inquilino: nombre, logo de la aplicación (SOLO como archivo), plantilla por defecto, contacto y
 * lo que lleva impreso el formato (tres líneas de cabecera, año lectivo y tres logos), con la
 * vista previa de esa cabecera. Sin color ni tema: el producto tiene uno solo.
 *
 * ⚠️ La vista previa es el DOCUMENTO, no la interfaz: lleva los colores del formato original
 * (`COLORES_FORMATO`) sobre papel blanco, también en el tema oscuro.
 */
function SeccionNegocio({ slug, negocio, plantillas }: { slug: string; negocio: NegocioVista; plantillas: PlantillaVista[] }) {
  const router = useRouter();
  const [enCurso, arranca] = useTransition();
  const [quitarApp, setQuitarApp] = useState(false);
  const archivoApp = useRef<HTMLInputElement>(null);
  const archivos = useRef<Record<string, HTMLInputElement | null>>({});
  const [d, setD] = useState(negocio);
  const [logos, setLogos] = useState<Record<string, string | null>>({
    logoInstitucionUrl: negocio.logoInstitucionUrl,
    logoOrganizacionUrl: negocio.logoOrganizacionUrl,
    logoOpcionalUrl: negocio.logoOpcionalUrl,
  });
  const [quitar, setQuitar] = useState<Record<string, boolean>>({});
  const C = COLORES_FORMATO;
  const cambia = (k: keyof NegocioVista) => (e: React.ChangeEvent<HTMLInputElement>) => setD({ ...d, [k]: e.target.value });
  const plantilla = plantillas.find((t) => t.clave === negocio.plantillaPorDefecto);

  function subir(f: File) {
    const fd = new FormData();
    fd.set('archivo', f);
    arranca(async () => {
      const r = await subirLogo(slug, fd);
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.mensaje ?? 'Logo subido.');
      router.refresh();
    });
  }

  return (
    <div className="flex flex-1 flex-col p-4 sm:p-5">
      <form
        id="form-negocio"
        action={(fd) =>
          arranca(async () => {
            for (const k of Object.keys(quitar)) if (quitar[k]) fd.set(`${k}Quitar`, 'true');
            const r = await guardarNegocio(slug, fd);
            if (!r.ok) return void toast.error(r.error);
            toast.success('Guardado.');
            setQuitar({});
            for (const i of Object.values(archivos.current)) if (i) i.value = '';
            router.refresh();
          })
        }
        className="space-y-5"
      >
        {/* ── El logo de la aplicación: se sube al instante, fuera del «Guardar» ── */}
        <div className="flex items-center gap-3">
          <LogoNegocio nombre={d.nombre} logoUrl={negocio.logoUrl} tamano={52} />
          <input
            ref={archivoApp}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) subir(f); }}
          />
          <Boton variante="secundario" type="button" icono={Upload} onClick={() => archivoApp.current?.click()} disabled={enCurso}>
            {negocio.logoUrl ? 'Cambiar logo' : 'Subir logo'}
          </Boton>
          {negocio.logoUrl && <BotonIcono type="button" icono={Trash2} titulo="Quitar el logo" onClick={() => setQuitarApp(true)} disabled={enCurso} />}
        </div>

        <Grupo titulo="Institución">
          <Campo etiqueta="Nombre" requerido>
            <Entrada name="nombre" required value={d.nombre} onChange={cambia('nombre')} />
          </Campo>
          <Campo etiqueta="Plantilla por defecto" requerido>
            <Selector name="plantillaPorDefecto" defaultValue={negocio.plantillaPorDefecto} title={plantilla?.descripcion}>
              {plantillas.map((t) => (
                <option key={t.clave} value={t.clave}>{t.nombre}</option>
              ))}
            </Selector>
          </Campo>
        </Grupo>

        <Grupo titulo="Contacto">
          <Campo etiqueta="Persona de contacto">
            <Entrada name="contactoNombre" defaultValue={d.contactoNombre ?? ''} autoComplete="name" />
          </Campo>
          <Campo etiqueta="Correo">
            <Entrada name="contactoEmail" type="email" defaultValue={d.contactoEmail ?? ''} autoComplete="email" />
          </Campo>
          <Campo etiqueta="Teléfono">
            <Entrada name="contactoTelefono" type="tel" defaultValue={d.contactoTelefono ?? ''} autoComplete="tel" />
          </Campo>
        </Grupo>

        <Grupo titulo="Cabecera del formato">
          <Campo etiqueta="Línea 1">
            <Entrada name="cabeceraLinea1" value={d.cabeceraLinea1 ?? ''} onChange={cambia('cabeceraLinea1')} placeholder="Unidad Educativa Particular" title="Tipo de institución" />
          </Campo>
          <Campo etiqueta="Línea 2">
            <Entrada name="cabeceraLinea2" value={d.cabeceraLinea2 ?? ''} onChange={cambia('cabeceraLinea2')} placeholder="“Nombre de la institución”" title="El nombre: va en grande" />
          </Campo>
          <Campo etiqueta="Línea 3">
            <Entrada name="cabeceraLinea3" value={d.cabeceraLinea3 ?? ''} onChange={cambia('cabeceraLinea3')} placeholder="Red Educativa …" title="Red u organización: va en color" />
          </Campo>
          <Campo etiqueta="Año lectivo">
            <Entrada name="anioLectivo" value={d.anioLectivo ?? ''} onChange={cambia('anioLectivo')} placeholder="2026 - 2027" />
          </Campo>
        </Grupo>

        <Grupo titulo="Logos del formato">
          {LOGOS.map((l) => {
            const actual = quitar[l.clave] ? null : logos[l.clave];
            return (
              <Campo key={l.clave} etiqueta={l.etiqueta}>
                <div className="flex items-center gap-2" title={`${l.pista}. PNG o JPG, hasta 600 KB.`}>
                  <div className="flex h-14 w-[120px] shrink-0 items-center justify-center rounded border border-borde bg-realce">
                    {actual ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={actual} alt="" className="h-12 w-auto max-w-[112px] object-contain" />
                    ) : (
                      <ImageOff className="h-4 w-4 text-tenue" />
                    )}
                  </div>
                  {/* El archivo viaja con el formulario (`guardarNegocio`); se ve en el acto. */}
                  <input
                    ref={(i) => { archivos.current[l.clave] = i; }}
                    type="file"
                    name={`${l.clave}Archivo`}
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setQuitar({ ...quitar, [l.clave]: false });
                      const lector = new FileReader();
                      lector.onload = () => setLogos((v) => ({ ...v, [l.clave]: String(lector.result) }));
                      lector.readAsDataURL(f);
                    }}
                  />
                  <Boton type="button" variante="secundario" tamano="sm" icono={Upload} onClick={() => archivos.current[l.clave]?.click()} disabled={enCurso}>
                    {actual ? 'Cambiar' : 'Subir'}
                  </Boton>
                  {actual && (
                    <BotonIcono
                      type="button"
                      icono={Trash2}
                      titulo="Quitar"
                      onClick={() => {
                        const i = archivos.current[l.clave];
                        if (i) i.value = '';
                        setQuitar({ ...quitar, [l.clave]: true });
                      }}
                    />
                  )}
                </div>
              </Campo>
            );
          })}
        </Grupo>

        {/* Cómo queda la cabecera del formato, con lo que se está escribiendo. */}
        <fieldset className="border-t border-borde pt-4">
          <legend className="pr-2 text-[11px] font-semibold uppercase tracking-wide text-tenue">Vista previa</legend>
          <div className="max-w-3xl bg-white p-3 text-[10px] text-black shadow" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
            <div className="flex border" style={{ borderColor: C.borde }}>
              <div className="flex w-[24%] items-center justify-center gap-1.5 border-r px-1.5 py-1.5" style={{ borderColor: C.borde }}>
                {LOGOS.map((l) => (quitar[l.clave] ? null : logos[l.clave])).filter(Boolean).map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={src!} alt="" className="h-10 w-auto max-w-[44px] object-contain" />
                ))}
              </div>
              <div className="flex flex-1 flex-col items-center justify-center py-1.5 text-center">
                {d.cabeceraLinea1 || d.cabeceraLinea2 || d.cabeceraLinea3 ? (
                  <>
                    {d.cabeceraLinea1 && <p className="text-[11px]" style={{ color: C.gris }}>{d.cabeceraLinea1}</p>}
                    {d.cabeceraLinea2 && <p className="text-[15px] font-bold" style={{ color: C.gris }}>{d.cabeceraLinea2}</p>}
                    {d.cabeceraLinea3 && <p className="text-[12px] font-semibold" style={{ color: C.acentoCabecera }}>{d.cabeceraLinea3}</p>}
                  </>
                ) : (
                  <p className="text-[15px] font-bold" style={{ color: C.gris }}>{d.nombre}</p>
                )}
              </div>
              <div className="w-[16%] border-l text-center" style={{ borderColor: C.borde }}>
                <p className="py-1 text-[10px] font-bold" style={{ background: C.etiqueta }}>Año Lectivo</p>
                <p className="py-1.5 text-[10px]">{d.anioLectivo}</p>
              </div>
            </div>
            {/* Blanco sobre la barra roja: es el formato impreso, no la interfaz. */}
            <div className="mt-1.5 py-1 text-center text-[12px] font-bold" style={{ background: C.barra, color: '#FFFFFF' }}>PLAN UNIDAD DIDÁCTICA</div>
          </div>
        </fieldset>

        <div className="hidden justify-end lg:flex">
          <Boton type="submit" tamano="lg" icono={Save} disabled={enCurso}>
            {enCurso ? 'Guardando…' : 'Guardar'}
          </Boton>
        </div>
      </form>

      <Confirmar
        abierto={quitarApp}
        titulo="¿Quitar el logo?"
        mensaje="En su lugar se verá la inicial de la institución."
        textoAceptar="Quitar"
        ocupado={enCurso}
        alCerrar={() => setQuitarApp(false)}
        alAceptar={() =>
          arranca(async () => {
            const r = await quitarLogo(slug);
            if (!r.ok) return void toast.error(r.error);
            setQuitarApp(false);
            toast.success(r.mensaje ?? 'Quitado.');
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

// ── Suscripción ─────────────────────────────────────────────────────────────
function SeccionSuscripcion({ plan, cortesia }: { plan: Plan | null; cortesia: boolean }) {
  if (cortesia)
    return (
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <dl className="grid gap-3 sm:grid-cols-3">
          <Dato titulo="Plan">Acceso del grupo</Dato>
          <Dato titulo="Mensualidad">Sin mensualidad</Dato>
          <Dato titulo="Topes">Sin topes</Dato>
        </dl>
      </div>
    );
  if (!plan)
    return (
      <div className="flex flex-1 flex-col justify-center">
        <EstadoVacio icono={CreditCard} titulo="Sin suscripción registrada" />
      </div>
    );
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
      <dl className="grid gap-3 sm:grid-cols-3">
        <Dato titulo="Plan">{plan.nombre}</Dato>
        <Dato titulo="Mensualidad">{plan.precioMensual > 0 ? `${dinero(plan.precioMensual, plan.moneda)} / mes` : 'Por definir'}</Dato>
        <Dato titulo="Pagado hasta">{plan.pagadoHasta ? fechaLarga(plan.pagadoHasta, 'UTC') : '—'}</Dato>
        <Dato titulo="Cuentas activas">{plan.maxUsuarios ?? 'Sin límite'}</Dato>
        <Dato titulo="Generaciones por semana">{plan.maxGeneracionesSemana ?? 'Sin límite'}</Dato>
        <Dato titulo="Histórico">{plan.mesesRetencion ? (plan.mesesRetencion === 1 ? '1 mes' : `${plan.mesesRetencion} meses`) : 'Sin límite'}</Dato>
      </dl>
      {plan.caracteristicas.length > 0 && (
        <Tarjeta className="p-4">
          <ul className="space-y-1.5 text-[13px]">
            {plan.caracteristicas.map((c) => (
              <li key={c} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-acento" />
                {c}
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
    </div>
  );
}

/** Cajita de dato, la misma de Automatizaciones (Configuración ▸ WhatsApp / Mi cuenta). */
function Dato({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded border border-borde bg-realce px-3 py-2">
      <dt className="text-[10.5px] font-semibold uppercase tracking-wide text-tenue">{titulo}</dt>
      <dd className="truncate text-[13px] font-semibold text-texto">{children}</dd>
    </div>
  );
}

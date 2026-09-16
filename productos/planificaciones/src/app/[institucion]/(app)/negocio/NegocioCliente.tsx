'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ImageOff } from 'lucide-react';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Boton, Campo, Entrada, Tarjeta } from '@/componentes/ui';
import { Aviso } from '@/componentes/campos';
import { guardarNegocio } from '@/acciones/negocio';
import { COLORES_FORMATO } from '@/plantillas/pud/documento';

type Datos = {
  nombre: string;
  contactoNombre: string | null;
  contactoEmail: string | null;
  contactoTelefono: string | null;
  cabeceraLinea1: string | null;
  cabeceraLinea2: string | null;
  cabeceraLinea3: string | null;
  anioLectivo: string | null;
  deceResponsable: string | null;
  logoInstitucionUrl: string | null;
  logoOrganizacionUrl: string | null;
  logoOpcionalUrl: string | null;
};

const LOGOS: { clave: 'logoInstitucionUrl' | 'logoOrganizacionUrl' | 'logoOpcionalUrl'; etiqueta: string; pista: string }[] = [
  { clave: 'logoInstitucionUrl', etiqueta: 'Logo de la institución', pista: 'El primero, a la izquierda de la cabecera' },
  { clave: 'logoOrganizacionUrl', etiqueta: 'Logo de la organización principal', pista: 'El segundo (la red o el grupo al que pertenece)' },
  { clave: 'logoOpcionalUrl', etiqueta: 'Tercer logo (opcional)', pista: 'Solo se ve si lo agregas' },
];

/**
 * EL MÓDULO «NEGOCIO» (Fernando, 2026-09-16): los datos de la institución que lleva
 * impresos el formato —tres líneas de cabecera, año lectivo y tres logos— más su
 * nombre y contacto. Lo que se escribe aquí se ve en la cabecera de todos sus
 * documentos; la vista previa de abajo enseña cómo queda.
 */
export default function NegocioCliente({ slug, datos }: { slug: string; datos: Datos }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [enCurso, arranca] = useTransition();
  const [d, setD] = useState(datos);
  const [logos, setLogos] = useState<Record<string, string | null>>({ logoInstitucionUrl: datos.logoInstitucionUrl, logoOrganizacionUrl: datos.logoOrganizacionUrl, logoOpcionalUrl: datos.logoOpcionalUrl });
  const [quitar, setQuitar] = useState<Record<string, boolean>>({});
  const C = COLORES_FORMATO;
  const cambia = (k: keyof Datos) => (e: React.ChangeEvent<HTMLInputElement>) => setD({ ...d, [k]: e.target.value });

  return (
    <>
      <CabeceraPagina titulo="Negocio" descripcion="Los datos de la institución que lleva impresos el formato" />
      <div className="grid gap-4 p-4 sm:p-6 xl:grid-cols-[1fr_520px]">
        <Tarjeta className="p-5">
          <form
            action={(fd) =>
              arranca(async () => {
                setError(null);
                for (const k of Object.keys(quitar)) if (quitar[k]) fd.set(`${k}Quitar`, 'true');
                const r = await guardarNegocio(slug, fd);
                if (!r.ok) return setError(r.error);
                toast.success('Datos del negocio guardados');
                setQuitar({});
                router.refresh();
              })
            }
            className="space-y-5"
          >
            <section className="space-y-4">
              <h2 className="text-[12px] font-semibold uppercase tracking-wide text-tenue">La institución</h2>
              <Campo etiqueta="Nombre de la institución" requerido>
                <Entrada name="nombre" required value={d.nombre} onChange={cambia('nombre')} />
              </Campo>
              <div className="grid gap-4 sm:grid-cols-3">
                <Campo etiqueta="Persona de contacto">
                  <Entrada name="contactoNombre" defaultValue={d.contactoNombre ?? ''} />
                </Campo>
                <Campo etiqueta="Correo">
                  <Entrada name="contactoEmail" type="email" defaultValue={d.contactoEmail ?? ''} />
                </Campo>
                <Campo etiqueta="Teléfono">
                  <Entrada name="contactoTelefono" defaultValue={d.contactoTelefono ?? ''} />
                </Campo>
              </div>
            </section>

            <section className="space-y-4 border-t border-borde pt-4">
              <h2 className="text-[12px] font-semibold uppercase tracking-wide text-tenue">La cabecera del formato</h2>
              <Campo etiqueta="Línea 1 (tipo de institución)">
                <Entrada name="cabeceraLinea1" value={d.cabeceraLinea1 ?? ''} onChange={cambia('cabeceraLinea1')} placeholder="Unidad Educativa Particular" />
              </Campo>
              <Campo etiqueta="Línea 2 (nombre, va en grande)">
                <Entrada name="cabeceraLinea2" value={d.cabeceraLinea2 ?? ''} onChange={cambia('cabeceraLinea2')} placeholder="“Nombre de la institución”" />
              </Campo>
              <Campo etiqueta="Línea 3 (red u organización, va en color)">
                <Entrada name="cabeceraLinea3" value={d.cabeceraLinea3 ?? ''} onChange={cambia('cabeceraLinea3')} placeholder="Red Educativa …" />
              </Campo>
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo etiqueta="Año lectivo">
                  <Entrada name="anioLectivo" value={d.anioLectivo ?? ''} onChange={cambia('anioLectivo')} placeholder="2026 - 2027" />
                </Campo>
                <Campo etiqueta="Responsable del DECE (espacio del DECE del formato)">
                  <Entrada name="deceResponsable" defaultValue={d.deceResponsable ?? ''} placeholder="Psic. …" />
                </Campo>
              </div>
            </section>

            <section className="space-y-4 border-t border-borde pt-4">
              <h2 className="text-[12px] font-semibold uppercase tracking-wide text-tenue">Los logos de la cabecera</h2>
              {LOGOS.map((l) => {
                const actual = quitar[l.clave] ? null : logos[l.clave];
                return (
                  <Campo key={l.clave} etiqueta={`${l.etiqueta} · ${l.pista}`}>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex h-14 w-[120px] items-center justify-center rounded border border-borde bg-realce">
                        {actual ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={actual} alt="" className="h-12 w-auto max-w-[112px] object-contain" />
                        ) : (
                          <ImageOff className="h-4 w-4 text-tenue" />
                        )}
                      </div>
                      <input
                        type="file"
                        name={`${l.clave}Archivo`}
                        accept="image/png,image/jpeg"
                        className="text-[12px] text-tenue file:mr-2 file:rounded file:border file:border-borde file:bg-tarjeta file:px-2.5 file:py-1 file:text-[12px] file:font-semibold file:text-texto hover:file:bg-realce"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          setQuitar({ ...quitar, [l.clave]: false });
                          const lector = new FileReader();
                          lector.onload = () => setLogos({ ...logos, [l.clave]: String(lector.result) });
                          lector.readAsDataURL(f);
                        }}
                      />
                      {actual && (
                        <Boton type="button" variante="fantasma" tamano="sm" onClick={() => setQuitar({ ...quitar, [l.clave]: true })}>
                          Quitar
                        </Boton>
                      )}
                    </div>
                    <Entrada name={l.clave} className="mt-2" placeholder="…o pega la dirección de la imagen" />
                  </Campo>
                );
              })}
              <p className="text-[11px] text-tenue">PNG o JPG, hasta 600 KB cada uno.</p>
            </section>

            {error && <Aviso texto={error} />}
            <div className="flex justify-end border-t border-borde pt-4">
              <Boton type="submit" disabled={enCurso}>
                {enCurso ? 'Guardando…' : 'Guardar'}
              </Boton>
            </div>
          </form>
        </Tarjeta>

        {/* Cómo queda la cabecera del formato, con lo que se está escribiendo */}
        <div className="xl:sticky xl:top-4 xl:self-start">
          <p className="mb-2 text-[12px] font-semibold text-tenue">Así queda la cabecera del formato</p>
          <div className="bg-white p-3 text-[10px] text-black shadow" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
            <div className="flex border border-[#808080]">
              <div className="flex w-[24%] items-center justify-center gap-1.5 border-r border-[#808080] px-1.5 py-1.5">
                {LOGOS.map((l) => (quitar[l.clave] ? null : logos[l.clave])).filter(Boolean).map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={src!} alt="" className="h-10 w-auto max-w-[44px] object-contain" />
                ))}
              </div>
              <div className="flex flex-1 flex-col items-center justify-center py-1.5 text-center">
                {(d.cabeceraLinea1 || d.cabeceraLinea2 || d.cabeceraLinea3) ? (
                  <>
                    {d.cabeceraLinea1 && <p className="text-[11px]" style={{ color: C.gris }}>{d.cabeceraLinea1}</p>}
                    {d.cabeceraLinea2 && <p className="text-[15px] font-bold" style={{ color: C.gris }}>{d.cabeceraLinea2}</p>}
                    {d.cabeceraLinea3 && <p className="text-[12px] font-semibold" style={{ color: C.acentoCabecera }}>{d.cabeceraLinea3}</p>}
                  </>
                ) : (
                  <p className="text-[15px] font-bold" style={{ color: C.gris }}>{d.nombre}</p>
                )}
              </div>
              <div className="w-[16%] border-l border-[#808080] text-center">
                <p className="py-1 text-[10px] font-bold" style={{ background: C.etiqueta }}>Año Lectivo</p>
                <p className="py-1.5 text-[10px]">{d.anioLectivo}</p>
              </div>
            </div>
            <div className="mt-1.5 py-1 text-center text-[12px] font-bold text-white" style={{ background: C.barra }}>PLAN UNIDAD DIDÁCTICA</div>
          </div>
        </div>
      </div>
    </>
  );
}

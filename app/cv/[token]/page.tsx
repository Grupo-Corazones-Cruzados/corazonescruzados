/**
 * CV PÚBLICO — la página que abre un reclutador con el enlace.
 *
 * ── DECISIONES DE MAQUETA (las tres que la definen) ───────────────────────────
 * 1. **VISTAS DISTINTAS, NO UNA COLUMNA QUE SE ESTRECHA.** En escritorio hay una
 *    **ficha fija** a la izquierda —foto, disponibilidad, sueldo, contacto, índice—
 *    que no se mueve mientras el contenido pasa al lado: quien lee un CV vuelve
 *    todo el rato a «quién es y cuánto pide». En tableta esa ficha se convierte en
 *    una **portada horizontal** y el índice baja a una barra pegajosa de píldoras.
 *    En teléfono, la portada se centra, el índice se desliza y las acciones —PDF y
 *    contacto— caen a una **barra inferior fija**, que es donde alcanza el pulgar.
 * 2. **TODO DE UN VISTAZO.** Bajo la portada va una **franja de cifras**
 *    (disponibilidad · años · talentos · proyectos) y el índice: sin desplazarse ya
 *    se sabe qué hay y se salta a ello. Las animaciones no esconden nada.
 * 3. **SERVER COMPONENT.** Los datos se piden a la misma puerta que usan el JSON y
 *    el PDF, no por HTTP a la propia app: una página que se llama a sí misma paga
 *    dos viajes y se cae si cambia el dominio.
 *
 * ── LO QUE NO ESTÁ AQUÍ ───────────────────────────────────────────────────────
 * Ni un solo filtro de privacidad. Lo que no debe verse **no sale del servidor**
 * (`armarCvPublico`), así que aquí no hay ningún `if (mostrarTelefono)`: si el
 * teléfono llega, es que se publica.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  BadgeCheck, Briefcase, CalendarClock, Clock3, Download, GraduationCap,
  Globe, Languages, Linkedin, Mail, MapPin, Phone, Sparkles, Wallet,
} from 'lucide-react';
import {
  DIAS_SEMANA, ETIQUETA_JORNADA, ETIQUETA_MODALIDAD, cvPublicoDeToken, textoSalario,
  type CvPublico,
} from '@/lib/members/cv-share';
import PortafolioPublico from '@/components/cv/PortafolioPublico';
import IndiceSecciones, { type Seccion } from '@/components/cv/IndiceSecciones';

export const dynamic = 'force-dynamic';

/** El título de la pestaña lleva el nombre; el resto no se declara: es `noindex`. */
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const cv = await cvPublicoDeToken(token);
  return {
    title: cv ? `${cv.nombre} — Currículum` : 'Currículum',
    robots: { index: false, follow: false, nocache: true },
  };
}

/* ── Cálculos de la franja de cifras ────────────────────────────────────────── */

/** Años de trayectoria: del primer año declarado a hoy. Devuelve 0 si no hay años. */
function aniosDeTrayectoria(cv: CvPublico): number {
  const anios = cv.talentos
    .flatMap((t) => t.experiencia.map((e) => parseInt(e.desde, 10)))
    .filter((n) => Number.isFinite(n) && n > 1950 && n <= new Date().getFullYear());
  if (!anios.length) return 0;
  return Math.max(0, new Date().getFullYear() - Math.min(...anios));
}

function textoDisponibilidad(d: CvPublico['disponibilidad']): string {
  if (d.estado === 'not_available') return 'No disponible';
  if (d.estado === 'from_date' && d.desde) {
    return new Date(`${d.desde}T12:00:00`).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return 'Inmediata';
}

/* ── Página ─────────────────────────────────────────────────────────────────── */

export default async function CvPublicoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const cv = await cvPublicoDeToken(token);
  // Un token revocado, regenerado o inventado responde igual: 404. La página no
  // distingue «no existe» de «ya no vale».
  if (!cv) notFound();

  const anios = aniosDeTrayectoria(cv);
  const nProyectos = cv.portafolio.length;
  const hayTrayectoria = cv.talentos.some((t) => t.experiencia.length || t.educacion.length);

  const secciones: Seccion[] = [
    cv.bio ? { id: 'perfil', label: 'Perfil' } : null,
    hayTrayectoria ? { id: 'trayectoria', label: 'Trayectoria' } : null,
    cv.skills.length || cv.idiomas.length ? { id: 'aptitudes', label: 'Aptitudes' } : null,
    nProyectos ? { id: 'portafolio', label: 'Portafolio' } : null,
    { id: 'disponibilidad', label: 'Disponibilidad' },
  ].filter(Boolean) as Seccion[];

  const urlPdf = `/api/cv/${token}/pdf`;

  return (
    <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 pb-28 lg:pb-16">
      {/* ══ ESCRITORIO: ficha fija + contenido · TABLETA Y MÓVIL: apilado ══ */}
      <div className="lg:grid lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)] lg:gap-10 xl:gap-14">

        {/* ── Ficha de identidad ──────────────────────────────────────────── */}
        <aside className="lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:py-10 pt-8 lg:pt-10">
          <div className="cv-entra cv-entra-1 flex flex-col items-center text-center lg:items-start lg:text-left">
            <Foto cv={cv} />

            <h1 className="mt-5 text-[26px] sm:text-[30px] font-semibold leading-tight text-white">
              {cv.nombre}
            </h1>
            {(cv.titular || cv.cargo) && (
              <p className="mt-1.5 text-[15px] text-[#a78bfa]">{cv.titular || cv.cargo}</p>
            )}
            {cv.ubicacion && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-white/45">
                <MapPin className="w-3.5 h-3.5" aria-hidden /> {cv.ubicacion}
              </p>
            )}
          </div>

          {/* Disponibilidad y sueldo: lo primero que se busca, arriba del todo. */}
          <div className="cv-entra cv-entra-2 mt-6 space-y-2.5">
            <PildoraDisponibilidad d={cv.disponibilidad} />
            {cv.salario && (
              <div className="rounded-xl border border-[#7b5fbf]/35 bg-[#7b5fbf]/[0.12] px-4 py-3">
                <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-white/45">
                  <Wallet className="w-3.5 h-3.5" aria-hidden /> Aspiración salarial
                </p>
                <p className="mt-1 text-[22px] font-semibold text-[#c4b5fd] tabular-nums">
                  {textoSalario(cv.salario)}
                </p>
                <p className="text-[12px] text-white/40">al mes · USD</p>
              </div>
            )}
          </div>

          {/* Contacto y enlaces. Solo aparece lo que la persona publicó. */}
          {(cv.correo || cv.telefono || cv.linkedin || cv.web) && (
            <div className="cv-entra cv-entra-3 mt-5 flex flex-col gap-1">
              {cv.correo && <Enlace href={`mailto:${cv.correo}`} icono={<Mail className="w-4 h-4" />} texto={cv.correo} />}
              {cv.telefono && <Enlace href={`tel:${cv.telefono.replace(/[^\d+]/g, '')}`} icono={<Phone className="w-4 h-4" />} texto={cv.telefono} />}
              {cv.linkedin && <Enlace href={cv.linkedin} externo icono={<Linkedin className="w-4 h-4" />} texto="LinkedIn" />}
              {cv.web && <Enlace href={cv.web} externo icono={<Globe className="w-4 h-4" />} texto={cv.web.replace(/^https?:\/\//, '')} />}
            </div>
          )}

          {/* En escritorio la descarga vive en la ficha; en móvil, en la barra
              inferior — dos sitios, un solo enlace, y sin JavaScript. */}
          <a
            href={urlPdf}
            className="cv-entra cv-entra-4 cv-no-imprimir mt-5 hidden lg:inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#7b5fbf] px-5 h-11 text-[14px] font-medium text-white transition-colors hover:bg-[#8b6fd0]"
          >
            <Download className="w-4 h-4" aria-hidden /> Descargar en PDF
          </a>

          {/* El índice solo en escritorio: en pantallas menores va en la barra
              pegajosa, donde no roba altura al contenido. */}
          {secciones.length > 1 && (
            <IndiceSecciones secciones={secciones} className="cv-no-imprimir mt-7 hidden lg:flex" />
          )}

          {cv.actualizado && (
            <p className="mt-7 hidden lg:block text-[11.5px] text-white/25">
              Actualizado el{' '}
              {new Date(cv.actualizado).toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          )}
        </aside>

        {/* ── Contenido ───────────────────────────────────────────────────── */}
        <main className="lg:py-10">
          {/* Franja de cifras: el «de un vistazo» que pidió el encargo. */}
          <div className="cv-entra cv-entra-3 mt-8 lg:mt-2 grid grid-cols-2 xl:grid-cols-4 gap-3">
            <Cifra icono={<CalendarClock className="w-4 h-4" />} rotulo="Disponibilidad" valor={textoDisponibilidad(cv.disponibilidad)} />
            {anios > 0 && <Cifra icono={<Clock3 className="w-4 h-4" />} rotulo="Trayectoria" valor={`${anios} ${anios === 1 ? 'año' : 'años'}`} />}
            {cv.talentos.length > 0 && <Cifra icono={<Sparkles className="w-4 h-4" />} rotulo="Talentos" valor={String(cv.talentos.length)} />}
            {nProyectos > 0 && <Cifra icono={<Briefcase className="w-4 h-4" />} rotulo="Portafolio" valor={String(nProyectos)} />}
          </div>

          {/* Índice pegajoso para tableta y móvil. */}
          {secciones.length > 1 && (
            <div className="cv-no-imprimir lg:hidden sticky top-0 z-20 -mx-4 sm:-mx-6 mt-6 border-y border-white/[0.08] bg-[#0b0d14]/85 px-4 sm:px-6 py-2.5 backdrop-blur-md">
              <IndiceSecciones secciones={secciones} orientacion="horizontal" />
            </div>
          )}

          {cv.bio && (
            <Seccion id="perfil" titulo="Perfil">
              <p className="max-w-[62ch] text-[15.5px] sm:text-[16.5px] leading-relaxed text-white/65">{cv.bio}</p>
            </Seccion>
          )}

          {hayTrayectoria && (
            <Seccion id="trayectoria" titulo="Trayectoria por talento">
              <div className="space-y-10">
                {cv.talentos.map((t) => (
                  <div key={t.nombre}>
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h3 className="text-[20px] font-semibold text-white">{t.nombre}</h3>
                      {t.servicios.length > 0 && (
                        <p className="text-[13px] text-[#a78bfa]">{t.servicios.join(' · ')}</p>
                      )}
                    </div>

                    {t.experiencia.length > 0 && (
                      <Bloque titulo="Experiencia" icono={<Briefcase className="w-3.5 h-3.5" />}>
                        {t.experiencia.map((e, i) => (
                          <Hito key={i}
                            titulo={e.cargo || e.empresa || 'Experiencia'}
                            sub={e.cargo ? e.empresa : ''}
                            texto={e.descripcion}
                            fecha={[e.desde, e.hasta].filter(Boolean).join(' – ')} />
                        ))}
                      </Bloque>
                    )}

                    {t.educacion.length > 0 && (
                      <Bloque titulo="Formación" icono={<GraduationCap className="w-3.5 h-3.5" />}>
                        {t.educacion.map((e, i) => (
                          <Hito key={i}
                            titulo={e.titulo || e.institucion || 'Formación'}
                            sub={[e.institucion, e.campo].filter(Boolean).join(' · ')}
                            texto=""
                            fecha={[e.desde, e.hasta].filter(Boolean).join(' – ')} />
                        ))}
                      </Bloque>
                    )}
                  </div>
                ))}
              </div>
            </Seccion>
          )}

          {(cv.skills.length > 0 || cv.idiomas.length > 0) && (
            <Seccion id="aptitudes" titulo="Aptitudes">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {cv.skills.length > 0 && (
                  <Chips titulo="Skills" icono={<BadgeCheck className="w-3.5 h-3.5" />} valores={cv.skills} destacado />
                )}
                {cv.idiomas.length > 0 && (
                  <Chips titulo="Idiomas" icono={<Languages className="w-3.5 h-3.5" />} valores={cv.idiomas} />
                )}
              </div>
            </Seccion>
          )}

          {nProyectos > 0 && (
            <Seccion id="portafolio" titulo="Portafolio">
              <PortafolioPublico token={token} items={cv.portafolio} />
            </Seccion>
          )}

          <Seccion id="disponibilidad" titulo="Disponibilidad">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="cv-tarjeta p-5">
                <ul className="space-y-2.5 text-[14.5px] text-white/65">
                  <li className="flex items-start gap-2.5">
                    <CalendarClock className="mt-0.5 w-4 h-4 shrink-0 text-[#a78bfa]" aria-hidden />
                    <span>
                      {cv.disponibilidad.estado === 'not_available'
                        ? 'No disponible para nuevas oportunidades por ahora'
                        : cv.disponibilidad.estado === 'from_date' && cv.disponibilidad.desde
                          ? `Disponible a partir del ${new Date(`${cv.disponibilidad.desde}T12:00:00`).toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' })}`
                          : 'Disponible de inmediato'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Clock3 className="mt-0.5 w-4 h-4 shrink-0 text-[#a78bfa]" aria-hidden />
                    <span>{ETIQUETA_JORNADA[cv.disponibilidad.jornada]}</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <MapPin className="mt-0.5 w-4 h-4 shrink-0 text-[#a78bfa]" aria-hidden />
                    <span>{ETIQUETA_MODALIDAD[cv.disponibilidad.modalidad]}</span>
                  </li>
                </ul>
                {cv.disponibilidad.nota && (
                  <p className="mt-4 border-t border-white/[0.08] pt-3 text-[13.5px] leading-relaxed text-white/45">
                    {cv.disponibilidad.nota}
                  </p>
                )}
              </div>

              {/* El horario de atención es un dato secundario: acompaña, no manda. */}
              {cv.disponibilidad.horario.length > 0 && (
                <div className="cv-tarjeta p-5">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-white/35">Horario de atención</p>
                  <dl className="mt-3 space-y-1.5">
                    {cv.disponibilidad.horario.map((f) => (
                      <div key={f.dia} className="flex items-center justify-between gap-4 text-[13.5px]">
                        <dt className="text-white/55">{DIAS_SEMANA[f.dia - 1]}</dt>
                        <dd className="tabular-nums text-white/40">{f.inicio} – {f.fin}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          </Seccion>

          <footer className="mt-16 border-t border-white/[0.08] pt-6 text-[12px] text-white/25">
            <p>
              Currículum compartido por {cv.nombre} desde GCC World.
              {cv.actualizado && (
                <> Actualizado el{' '}
                  {new Date(cv.actualizado).toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' })}.
                </>
              )}
            </p>
          </footer>
        </main>
      </div>

      {/* ── Barra inferior fija: solo en tableta y móvil ────────────────────
          El pulgar llega abajo; una acción principal arriba del todo en un
          teléfono obliga a subir toda la página cada vez que se quiere usar. */}
      <div className="cv-no-imprimir lg:hidden fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.08] bg-[#0b0d14]/92 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center gap-2.5">
          <a href={urlPdf}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#7b5fbf] px-5 text-[14px] font-medium text-white transition-colors hover:bg-[#8b6fd0]">
            <Download className="w-4 h-4" aria-hidden /> Descargar en PDF
          </a>
          {cv.correo && (
            <a href={`mailto:${cv.correo}`} aria-label="Escribir un correo"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/15 text-white/70 transition-colors hover:border-white/30 hover:text-white">
              <Mail className="w-4 h-4" />
            </a>
          )}
          {cv.telefono && (
            <a href={`tel:${cv.telefono.replace(/[^\d+]/g, '')}`} aria-label="Llamar"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/15 text-white/70 transition-colors hover:border-white/30 hover:text-white">
              <Phone className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Piezas ─────────────────────────────────────────────────────────────────── */

function Foto({ cv }: { cv: CvPublico }) {
  const iniciales = cv.nombre.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const clases = 'h-28 w-28 sm:h-32 sm:w-32 rounded-2xl border border-[#7b5fbf]/40 object-cover';
  return cv.foto ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={cv.foto} alt={cv.nombre} className={clases} />
  ) : (
    <div className={`${clases} flex items-center justify-center bg-[#7b5fbf]/15 text-3xl font-semibold text-[#c4b5fd]`}>
      {iniciales}
    </div>
  );
}

function PildoraDisponibilidad({ d }: { d: CvPublico['disponibilidad'] }) {
  const libre = d.estado !== 'not_available';
  return (
    <p className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] ${
      libre ? 'border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-300/90'
            : 'border-white/12 bg-white/[0.03] text-white/50'}`}>
      <span className={`h-2 w-2 rounded-full ${libre ? 'bg-emerald-400' : 'bg-white/35'}`} aria-hidden />
      {d.estado === 'not_available'
        ? 'No disponible por ahora'
        : d.estado === 'from_date' && d.desde
          ? `Disponible desde el ${new Date(`${d.desde}T12:00:00`).toLocaleDateString('es-EC', { day: '2-digit', month: 'short' })}`
          : 'Disponible de inmediato'}
    </p>
  );
}

function Enlace({ href, texto, icono, externo = false }: { href: string; texto: string; icono: React.ReactNode; externo?: boolean }) {
  return (
    <a href={href} {...(externo ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}
      className="inline-flex items-center gap-2.5 rounded-md py-1.5 text-[13.5px] text-white/55 transition-colors hover:text-[#c4b5fd]">
      <span className="text-[#a78bfa]" aria-hidden>{icono}</span>
      <span className="truncate">{texto}</span>
    </a>
  );
}

function Cifra({ icono, rotulo, valor }: { icono: React.ReactNode; rotulo: string; valor: string }) {
  return (
    <div className="cv-tarjeta px-4 py-3.5">
      <p className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.13em] text-white/35">
        <span className="text-[#a78bfa]" aria-hidden>{icono}</span> {rotulo}
      </p>
      <p className="mt-1 text-[17px] font-semibold text-white">{valor}</p>
    </div>
  );
}

function Seccion({ id, titulo, children }: { id: string; titulo: string; children: React.ReactNode }) {
  return (
    <section id={id} className="cv-seccion cv-anima mt-14 sm:mt-16">
      <h2 className="text-[11px] uppercase tracking-[0.18em] text-[#a78bfa]">{titulo}</h2>
      <div className="mt-1.5 mb-7 h-px w-full bg-white/[0.08]" aria-hidden />
      {children}
    </section>
  );
}

function Bloque({ titulo, icono, children }: { titulo: string; icono: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-white/35">
        <span className="text-white/30" aria-hidden>{icono}</span> {titulo}
      </p>
      <div className="mt-3 space-y-5">{children}</div>
    </div>
  );
}

/** Un hito de la trayectoria. El filete de la izquierda da ritmo a la lista sin
 *  dibujar una caja por entrada, que a diez entradas cansa la vista. */
function Hito({ titulo, sub, texto, fecha }: { titulo: string; sub: string; texto: string; fecha: string }) {
  return (
    <div className="border-l border-white/[0.1] pl-4 sm:pl-5 transition-colors hover:border-[#7b5fbf]/60">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <h4 className="text-[16px] font-medium text-white">{titulo}</h4>
        {fecha && <span className="shrink-0 text-[12.5px] tabular-nums text-white/35">{fecha}</span>}
      </div>
      {sub && <p className="mt-0.5 text-[13.5px] text-[#a78bfa]">{sub}</p>}
      {texto && <p className="mt-2 max-w-[62ch] text-[14.5px] leading-relaxed text-white/50">{texto}</p>}
    </div>
  );
}

function Chips({ titulo, icono, valores, destacado = false }: { titulo: string; icono: React.ReactNode; valores: string[]; destacado?: boolean }) {
  return (
    <div>
      <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-white/35">
        <span className="text-white/30" aria-hidden>{icono}</span> {titulo}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {valores.map((v) => (
          <span key={v} className={`rounded-full px-3 py-1.5 text-[13px] transition-colors ${
            destacado
              ? 'border border-[#7b5fbf]/35 bg-[#7b5fbf]/[0.12] text-[#c4b5fd] hover:border-[#7b5fbf]/60'
              : 'border border-white/10 bg-white/[0.02] text-white/55 hover:border-white/20'}`}>
            {v}
          </span>
        ))}
      </div>
    </div>
  );
}

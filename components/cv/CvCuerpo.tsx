'use client';

/**
 * CUERPO DEL CV PÚBLICO — ficha fija a la izquierda + panel por pestaña a la derecha.
 *
 * ── LA REORGANIZACIÓN QUE PIDIÓ FERNANDO (2026-08-14) ─────────────────────────
 * Antes era una sola columna de secciones que se recorrían con el scroll y un
 * índice que solo saltaba. Ahora:
 *   · **La ficha de la izquierda concentra lo que se consulta**: foto, datos,
 *     disponibilidad completa y aptitudes. Son bloques cortos que en el panel
 *     grande dejaban medio ancho vacío, y son justo lo que alguien vuelve a mirar.
 *   · **El panel derecho enseña SOLO la pestaña activa** — Perfil, Trayectoria o
 *     Portafolio—, no todo seguido.
 *
 * ── POR QUÉ ES UN COMPONENTE DE CLIENTE Y NO PASA NADA ────────────────────────
 * Conmutar pestañas exige estado. Los datos llegan **ya filtrados por el servidor**
 * (`armarCvPublico`), así que lo que viaja al navegador es exactamente lo que la
 * página publica: nada que ocultar aquí. Y Next lo renderiza en el servidor, así
 * que el contenido está en el HTML.
 *
 * ⚠️ **Los paneles no activos siguen en el DOM, con `hidden`.** Desmontarlos haría
 * que un navegador sin JavaScript —o un lector de pantalla que recorre el
 * documento— viera un CV con una sola sección.
 */
import { useState } from 'react';
import {
  BadgeCheck, Briefcase, CalendarClock, Clock3, Download, Facebook, FileText, GraduationCap,
  Globe, Instagram, Languages, Linkedin, Mail, MapPin, Phone, Sparkles, Wallet, Youtube,
} from 'lucide-react';
import { textoCorto, type Red } from '@/lib/members/redes';
import {
  DIAS_SEMANA, ETIQUETA_JORNADA, ETIQUETA_MODALIDAD, textoSalario, type CvPublico,
} from '@/lib/members/cv-tipos';
import PortafolioPublico from '@/components/cv/PortafolioPublico';

type Pestana = 'perfil' | 'trayectoria' | 'portafolio';

const fechaLarga = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' });

export default function CvCuerpo({
  cv, token, anios, urlPdf,
}: {
  cv: CvPublico; token: string; anios: number; urlPdf: string;
}) {
  const hayTrayectoria = cv.talentos.some((t) => t.experiencia.length || t.educacion.length);
  const nProyectos = cv.portafolio.length;

  const pestanas: { id: Pestana; label: string; icono: React.ReactNode }[] = [
    cv.bio ? { id: 'perfil' as const, label: 'Perfil', icono: <FileText className="w-4 h-4" /> } : null,
    hayTrayectoria ? { id: 'trayectoria' as const, label: 'Trayectoria', icono: <Briefcase className="w-4 h-4" /> } : null,
    nProyectos ? { id: 'portafolio' as const, label: 'Portafolio', icono: <Sparkles className="w-4 h-4" /> } : null,
  ].filter(Boolean) as { id: Pestana; label: string; icono: React.ReactNode }[];

  const [activa, setActiva] = useState<Pestana>(pestanas[0]?.id ?? 'perfil');

  return (
    <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 pb-28 lg:pb-16">
      <div className="lg:grid lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[400px_minmax(0,1fr)] lg:gap-10 xl:gap-14">

        {/* ══ FICHA ══════════════════════════════════════════════════════════ */}
        <aside className="lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:py-10 pt-8 lg:pt-10 space-y-6">
          <div className="cv-entra cv-entra-1 flex flex-col items-center text-center lg:items-start lg:text-left">
            <Foto cv={cv} />
            <h1 className="mt-5 text-[26px] sm:text-[30px] font-semibold leading-tight text-[#1c1b22]">{cv.nombre}</h1>
            {(cv.titular || cv.cargo) && (
              <p className="mt-1.5 text-[15px] text-[#5b3fa8]">{cv.titular || cv.cargo}</p>
            )}
            {cv.ubicacion && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-[#86838f]">
                <MapPin className="w-3.5 h-3.5" aria-hidden /> {cv.ubicacion}
              </p>
            )}
          </div>

          {/* Sueldo: la otra mitad de lo que se busca en tres segundos. */}
          {cv.salario && (
            <div className="cv-entra cv-entra-2 rounded-xl border border-[#7b5fbf]/30 bg-[#7b5fbf]/[0.07] px-4 py-3">
              <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-[#86838f]">
                <Wallet className="w-3.5 h-3.5" aria-hidden /> Aspiración salarial
              </p>
              <p className="mt-1 text-[22px] font-semibold text-[#4b2d8e] tabular-nums">{textoSalario(cv.salario)}</p>
              <p className="text-[12px] text-[#86838f]">al mes · USD</p>
            </div>
          )}

          {/* ── Disponibilidad, ahora en la ficha ── */}
          <FichaBloque titulo="Disponibilidad" className="cv-entra cv-entra-2">
            <ul className="space-y-2 text-[13.5px] text-[#56545f]">
              <Dato icono={<CalendarClock className="w-4 h-4" />}>
                {cv.disponibilidad.estado === 'not_available'
                  ? 'No disponible por ahora'
                  : cv.disponibilidad.estado === 'from_date' && cv.disponibilidad.desde
                    ? `A partir del ${fechaLarga(cv.disponibilidad.desde)}`
                    : 'De inmediato'}
              </Dato>
              <Dato icono={<Clock3 className="w-4 h-4" />}>{ETIQUETA_JORNADA[cv.disponibilidad.jornada]}</Dato>
              <Dato icono={<MapPin className="w-4 h-4" />}>{ETIQUETA_MODALIDAD[cv.disponibilidad.modalidad]}</Dato>
            </ul>
            {cv.disponibilidad.nota && (
              <p className="mt-3 border-t border-[#e6e3ee] pt-2.5 text-[12.5px] leading-relaxed text-[#86838f]">
                {cv.disponibilidad.nota}
              </p>
            )}
            {/* El horario de atención acompaña; no manda. */}
            {cv.disponibilidad.horario.length > 0 && (
              <div className="mt-3 border-t border-[#e6e3ee] pt-2.5">
                <p className="text-[10.5px] uppercase tracking-[0.13em] text-[#a3a0ac]">Horario de atención</p>
                <dl className="mt-1.5 space-y-1">
                  {cv.disponibilidad.horario.map((f) => (
                    <div key={f.dia} className="flex items-center justify-between gap-4 text-[12.5px]">
                      <dt className="text-[#56545f]">{DIAS_SEMANA[f.dia - 1]}</dt>
                      <dd className="tabular-nums text-[#86838f]">{f.inicio} – {f.fin}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </FichaBloque>

          {/* ── Aptitudes, también en la ficha: es poco contenido y en el panel
                 grande dejaba medio ancho vacío ── */}
          {(cv.skills.length > 0 || cv.idiomas.length > 0) && (
            <FichaBloque titulo="Aptitudes" className="cv-entra cv-entra-3">
              {cv.skills.length > 0 && (
                <Chips titulo="Skills" icono={<BadgeCheck className="w-3.5 h-3.5" />} valores={cv.skills} destacado />
              )}
              {cv.idiomas.length > 0 && (
                <div className={cv.skills.length ? 'mt-3.5' : ''}>
                  <Chips titulo="Idiomas" icono={<Languages className="w-3.5 h-3.5" />} valores={cv.idiomas} />
                </div>
              )}
            </FichaBloque>
          )}

          {(cv.correo || cv.telefono) && (
            <div className="cv-entra cv-entra-3 flex flex-col gap-0.5">
              {cv.correo && <Enlace href={`mailto:${cv.correo}`} icono={<Mail className="w-4 h-4" />} texto={cv.correo} />}
              {cv.telefono && <Enlace href={`tel:${cv.telefono.replace(/[^\d+]/g, '')}`} icono={<Phone className="w-4 h-4" />} texto={cv.telefono} />}
            </div>
          )}

          {/* ── Redes: botones que LLEVAN al perfil ──────────────────────────
              Antes había una fila «LinkedIn» que no llevaba a ninguna parte. Ahora
              cada red es un botón con su icono y su enlace comprobado; debajo, la
              dirección en pequeño, para que se vea a dónde va antes de pulsar. */}
          {cv.redes.length > 0 && (
            <div className="cv-entra cv-entra-3 flex flex-wrap gap-2">
              {cv.redes.map((r) => (
                <a key={r.red} href={r.url} target="_blank" rel="noopener noreferrer nofollow"
                  title={`${r.etiqueta}: ${textoCorto(r.url)}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#e6e3ee] bg-white px-3 py-2 text-[13px] text-[#56545f] transition-colors hover:border-[#7b5fbf] hover:text-[#4b2d8e]">
                  <IconoRed red={r.red} /> {r.etiqueta}
                </a>
              ))}
            </div>
          )}

          <a href={urlPdf}
            className="cv-entra cv-entra-4 cv-no-imprimir hidden lg:inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#4b2d8e] px-5 h-11 text-[14px] font-medium text-white transition-colors hover:bg-[#5b3fa8]">
            <Download className="w-4 h-4" aria-hidden /> Descargar en PDF
          </a>

          {/* Pestañas: en escritorio viven en la ficha, bajo el botón. */}
          {pestanas.length > 1 && (
            <nav aria-label="Secciones del currículum"
              className="cv-pestanas cv-pestanas-v cv-no-imprimir hidden lg:flex flex-col gap-1">
              {pestanas.map((p) => (
                <button key={p.id} type="button" role="tab" aria-selected={activa === p.id}
                  aria-controls={`panel-${p.id}`} onClick={() => setActiva(p.id)}
                  className="inline-flex items-center gap-2.5 rounded-r-md px-3 py-2 text-left text-[13.5px] text-[#56545f] hover:text-[#4b2d8e]">
                  <span aria-hidden>{p.icono}</span> {p.label}
                </button>
              ))}
            </nav>
          )}

          {cv.actualizado && (
            <p className="hidden lg:block text-[11.5px] text-[#a3a0ac]">
              Actualizado el {new Date(cv.actualizado).toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          )}
        </aside>

        {/* ══ PANEL ══════════════════════════════════════════════════════════ */}
        <main className="lg:py-10 flex flex-col lg:min-h-screen">
          {/* Franja de cifras: sigue arriba y siempre visible — es el «de un
              vistazo», y perderlo al cambiar de pestaña sería un paso atrás. */}
          <div className="cv-entra cv-entra-3 mt-8 lg:mt-2 grid grid-cols-2 xl:grid-cols-4 gap-3">
            <Cifra icono={<CalendarClock className="w-4 h-4" />} rotulo="Disponibilidad"
              valor={cv.disponibilidad.estado === 'not_available' ? 'No disponible'
                : cv.disponibilidad.estado === 'from_date' && cv.disponibilidad.desde
                  ? new Date(`${cv.disponibilidad.desde}T12:00:00`).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' })
                  : 'Inmediata'} />
            {anios > 0 && <Cifra icono={<Clock3 className="w-4 h-4" />} rotulo="Trayectoria" valor={`${anios} ${anios === 1 ? 'año' : 'años'}`} />}
            {cv.talentos.length > 0 && <Cifra icono={<Sparkles className="w-4 h-4" />} rotulo="Talentos" valor={String(cv.talentos.length)} />}
            {nProyectos > 0 && <Cifra icono={<Briefcase className="w-4 h-4" />} rotulo="Portafolio" valor={String(nProyectos)} />}
          </div>

          {/* Pestañas para tableta y móvil: pegajosas arriba. */}
          {pestanas.length > 1 && (
            <div className="cv-no-imprimir lg:hidden sticky top-0 z-20 -mx-4 sm:-mx-6 mt-6 border-y border-[#e6e3ee] bg-[#f6f5f9]/90 px-4 sm:px-6 py-2.5 backdrop-blur-md">
              <nav aria-label="Secciones del currículum" className="cv-pestanas cv-pestanas-h flex gap-1.5 overflow-x-auto">
                {pestanas.map((p) => (
                  <button key={p.id} type="button" role="tab" aria-selected={activa === p.id}
                    aria-controls={`panel-${p.id}`} onClick={() => setActiva(p.id)}
                    className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[#e6e3ee] bg-white px-3.5 py-1.5 text-[13px] text-[#56545f]">
                    <span aria-hidden>{p.icono}</span> {p.label}
                  </button>
                ))}
              </nav>
            </div>
          )}

          {/* ⚠️ Los tres paneles SIEMPRE están en el DOM; solo se oculta el que no
              toca. `key={activa}` en el envoltorio hace que la animación de entrada
              se vuelva a disparar en cada cambio. */}
          <div key={activa} className="cv-panel mt-10 sm:mt-12">
            <Panel id="perfil" activa={activa} titulo="Perfil">
              {cv.bio && (
                <p className="max-w-[68ch] text-[15.5px] sm:text-[16.5px] leading-relaxed text-[#56545f]">{cv.bio}</p>
              )}
            </Panel>

            <Panel id="trayectoria" activa={activa} titulo="Trayectoria por talento">
              <div className="space-y-10">
                {cv.talentos.filter((t) => t.experiencia.length || t.educacion.length).map((t) => (
                  <div key={t.nombre}>
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h3 className="text-[20px] font-semibold text-[#1c1b22]">{t.nombre}</h3>
                      {t.servicios.length > 0 && <p className="text-[13px] text-[#5b3fa8]">{t.servicios.join(' · ')}</p>}
                    </div>
                    {t.experiencia.length > 0 && (
                      <Bloque titulo="Experiencia" icono={<Briefcase className="w-3.5 h-3.5" />}>
                        {t.experiencia.map((e, i) => (
                          <Hito key={i} titulo={e.cargo || e.empresa || 'Experiencia'} sub={e.cargo ? e.empresa : ''}
                            texto={e.descripcion} fecha={[e.desde, e.hasta].filter(Boolean).join(' – ')} />
                        ))}
                      </Bloque>
                    )}
                    {t.educacion.length > 0 && (
                      <Bloque titulo="Formación" icono={<GraduationCap className="w-3.5 h-3.5" />}>
                        {t.educacion.map((e, i) => (
                          <Hito key={i} titulo={e.titulo || e.institucion || 'Formación'}
                            sub={[e.institucion, e.campo].filter(Boolean).join(' · ')} texto=""
                            fecha={[e.desde, e.hasta].filter(Boolean).join(' – ')} />
                        ))}
                      </Bloque>
                    )}
                  </div>
                ))}
              </div>
            </Panel>

            <Panel id="portafolio" activa={activa} titulo="Portafolio">
              <PortafolioPublico token={token} items={cv.portafolio} />
            </Panel>
          </div>

          {/* `mt-auto`: el pie baja al fondo del panel. Sin esto, en la pestaña
              «Perfil» —tres líneas de biografía— quedaba colgado a media pantalla
              con un vacío enorme debajo. */}
          <footer className="mt-auto pt-10 border-t border-[#e6e3ee] text-[12px] text-[#a3a0ac]">
            <p>
              Currículum compartido por {cv.nombre} desde GCC World.
              {cv.actualizado && <> Actualizado el {new Date(cv.actualizado).toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' })}.</>}
            </p>
          </footer>
        </main>
      </div>

      {/* Barra inferior fija: solo en tableta y móvil, donde alcanza el pulgar. */}
      <div className="cv-no-imprimir lg:hidden fixed inset-x-0 bottom-0 z-30 border-t border-[#e6e3ee] bg-white/95 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center gap-2.5">
          <a href={urlPdf} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#4b2d8e] px-5 text-[14px] font-medium text-white transition-colors hover:bg-[#5b3fa8]">
            <Download className="w-4 h-4" aria-hidden /> Descargar en PDF
          </a>
          {cv.correo && (
            <a href={`mailto:${cv.correo}`} aria-label="Escribir un correo"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#cfc9de] text-[#56545f] transition-colors hover:border-[#7b5fbf] hover:text-[#4b2d8e]">
              <Mail className="w-4 h-4" />
            </a>
          )}
          {cv.telefono && (
            <a href={`tel:${cv.telefono.replace(/[^\d+]/g, '')}`} aria-label="Llamar"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#cfc9de] text-[#56545f] transition-colors hover:border-[#7b5fbf] hover:text-[#4b2d8e]">
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
  const clases = 'h-28 w-28 sm:h-32 sm:w-32 rounded-2xl border border-[#7b5fbf]/35 object-cover';
  return cv.foto ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={cv.foto} alt={cv.nombre} className={clases} />
  ) : (
    <div className={`${clases} flex items-center justify-center bg-[#7b5fbf]/10 text-3xl font-semibold text-[#4b2d8e]`}>
      {iniciales}
    </div>
  );
}

/** Bloque de la ficha: rótulo en versalitas sobre una tarjeta clara. */
function FichaBloque({ titulo, className = '', children }: { titulo: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`cv-tarjeta p-4 ${className}`}>
      <h2 className="text-[10.5px] uppercase tracking-[0.15em] text-[#5b3fa8]">{titulo}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Dato({ icono, children }: { icono: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0 text-[#7b5fbf]" aria-hidden>{icono}</span>
      <span>{children}</span>
    </li>
  );
}

function Enlace({ href, texto, icono, externo = false }: { href: string; texto: string; icono: React.ReactNode; externo?: boolean }) {
  return (
    <a href={href} {...(externo ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}
      className="inline-flex items-center gap-2.5 rounded-md py-1.5 text-[13.5px] text-[#56545f] transition-colors hover:text-[#4b2d8e]">
      <span className="text-[#7b5fbf]" aria-hidden>{icono}</span>
      <span className="truncate">{texto}</span>
    </a>
  );
}

function Cifra({ icono, rotulo, valor }: { icono: React.ReactNode; rotulo: string; valor: string }) {
  return (
    <div className="cv-tarjeta px-4 py-3.5">
      <p className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.13em] text-[#86838f]">
        <span className="text-[#7b5fbf]" aria-hidden>{icono}</span> {rotulo}
      </p>
      <p className="mt-1 text-[17px] font-semibold text-[#1c1b22]">{valor}</p>
    </div>
  );
}

/** Panel de una pestaña. Presente siempre en el DOM; `hidden` si no es la activa. */
function Panel({ id, activa, titulo, children }: { id: Pestana; activa: Pestana; titulo: string; children: React.ReactNode }) {
  return (
    <section id={`panel-${id}`} role="tabpanel" hidden={activa !== id} aria-label={titulo}>
      <h2 className="text-[11px] uppercase tracking-[0.18em] text-[#5b3fa8]">{titulo}</h2>
      <div className="mt-1.5 mb-7 h-px w-full bg-[#e6e3ee]" aria-hidden />
      {children}
    </section>
  );
}

function Bloque({ titulo, icono, children }: { titulo: string; icono: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-[#86838f]">
        <span className="text-[#a3a0ac]" aria-hidden>{icono}</span> {titulo}
      </p>
      <div className="mt-3 space-y-5">{children}</div>
    </div>
  );
}

/** Un hito de la trayectoria. El filete de la izquierda da ritmo a la lista sin
 *  dibujar una caja por entrada, que a diez entradas cansa la vista. */
function Hito({ titulo, sub, texto, fecha }: { titulo: string; sub: string; texto: string; fecha: string }) {
  return (
    <div className="border-l border-[#e6e3ee] pl-4 sm:pl-5 transition-colors hover:border-[#7b5fbf]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <h4 className="text-[16px] font-medium text-[#1c1b22]">{titulo}</h4>
        {fecha && <span className="shrink-0 text-[12.5px] tabular-nums text-[#a3a0ac]">{fecha}</span>}
      </div>
      {sub && <p className="mt-0.5 text-[13.5px] text-[#5b3fa8]">{sub}</p>}
      {texto && <p className="mt-2 max-w-[68ch] text-[14.5px] leading-relaxed text-[#56545f]">{texto}</p>}
    </div>
  );
}

function Chips({ titulo, icono, valores, destacado = false }: { titulo: string; icono: React.ReactNode; valores: string[]; destacado?: boolean }) {
  return (
    <div>
      <p className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.13em] text-[#a3a0ac]">
        <span aria-hidden>{icono}</span> {titulo}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {valores.map((v) => (
          <span key={v} className={`rounded-full px-2.5 py-1 text-[12.5px] transition-colors ${
            destacado
              ? 'border border-[#7b5fbf]/30 bg-[#7b5fbf]/[0.08] text-[#4b2d8e] hover:border-[#7b5fbf]/60'
              : 'border border-[#e6e3ee] bg-white text-[#56545f] hover:border-[#cfc9de]'}`}>
            {v}
          </span>
        ))}
      </div>
    </div>
  );
}

/** ⚠️ TikTok NO existe en lucide, así que va como SVG propio. Los demás iconos de
 *  marca sí están en la versión que usa el repo (0.468). */
function IconoRed({ red }: { red: Red }) {
  const c = 'w-4 h-4 shrink-0';
  if (red === 'linkedin') return <Linkedin className={c} aria-hidden />;
  if (red === 'youtube') return <Youtube className={c} aria-hidden />;
  if (red === 'instagram') return <Instagram className={c} aria-hidden />;
  if (red === 'facebook') return <Facebook className={c} aria-hidden />;
  if (red === 'web') return <Globe className={c} aria-hidden />;
  return (
    <svg className={c} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.59 2.59 0 1 1 .77-5.06V9.7a5.68 5.68 0 0 0-.77-.05A5.66 5.66 0 1 0 15.54 15.3V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.28 4.28 0 0 1-3.24-1.48Z" />
    </svg>
  );
}

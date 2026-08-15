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

type Pestana = 'perfil' | 'portafolio';

const fechaLarga = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' });

export default function CvCuerpo({
  cv, token, anios, urlPdf,
}: {
  cv: CvPublico; token: string; anios: number; urlPdf: string;
}) {
  const hayTrayectoria = cv.talentos.some((t) => t.experiencia.length || t.educacion.length);
  const nProyectos = cv.portafolio.length;

  /* ── DOS pestañas, no tres (Fernando, 2026-08-14) ──────────────────────────
   * «Perfil» se quedaba prácticamente vacío: tres líneas de biografía en un panel
   * enorme. Ahora **Perfil y Trayectoria van juntos** en la misma pestaña —que es
   * como se lee un currículum, seguido— y la segunda es el Portafolio, que sí
   * tiene entidad propia. */
  const pestanas: { id: Pestana; label: string; icono: React.ReactNode }[] = [
    cv.bio || hayTrayectoria ? { id: 'perfil' as const, label: 'Perfil', icono: <FileText className="w-4 h-4" /> } : null,
    nProyectos ? { id: 'portafolio' as const, label: 'Portafolio', icono: <Briefcase className="w-4 h-4" /> } : null,
  ].filter(Boolean) as { id: Pestana; label: string; icono: React.ReactNode }[];

  const [activa, setActiva] = useState<Pestana>(pestanas[0]?.id ?? 'perfil');

  return (
    /* ── DOS COLUMNAS SOLO SI CABE (Fernando, 2026-08-15) ────────────────────
     * La ficha **no tiene desplazamiento propio**: una ficha de identidad que hay
     * que recorrer deja de ser un vistazo. Si no cabe entera en la pantalla, se usa
     * la vista **apilada** —la del teléfono— y se desplaza la página.
     *
     * Quién decide es una consulta de medios de ANCHO **y ALTO** en
     * `cv-publico.css`; medirlo con JavaScript entraba en bucle (al apilar cambia el
     * ancho, la ficha vuelve a caber, se desapila…) y daba un salto en el primer
     * pintado. Aquí solo se ponen los nombres de clase. */
    <div className="cv-marco mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
      <div className="cv-cols">

        {/* ══ FICHA ══════════════════════════════════════════════════════════ */}
        <aside className="cv-ficha pt-8">
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
            {/* El horario de atención se fue al panel: acompaña, no manda, y siete
                filas en la ficha son justo lo que impedía que cupiera entera. */}
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

          {/* Contacto, redes y descarga viven ahora en la barra del pie: son
              ACCIONES, no identidad, y sacarlas de aquí es lo que hace que la ficha
              quepa en pantallas más bajas sin necesitar desplazamiento. */}

          {cv.actualizado && (
            <p className="hidden lg:block text-[11.5px] text-[#a3a0ac]">
              Actualizado el {new Date(cv.actualizado).toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          )}
        </aside>

        {/* ══ PANEL ══════════════════════════════════════════════════════════ */}
        <main className="cv-panel-col">
          {/* Franja de cifras: sigue arriba y siempre visible — es el «de un
              vistazo», y perderlo al cambiar de pestaña sería un paso atrás. */}
          <div className="cv-entra cv-entra-3 cv-cifras shrink-0 grid grid-cols-2 xl:grid-cols-4 gap-3">
            <Cifra icono={<CalendarClock className="w-4 h-4" />} rotulo="Disponibilidad"
              valor={cv.disponibilidad.estado === 'not_available' ? 'No disponible'
                : cv.disponibilidad.estado === 'from_date' && cv.disponibilidad.desde
                  ? new Date(`${cv.disponibilidad.desde}T12:00:00`).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' })
                  : 'Inmediata'} />
            {anios > 0 && <Cifra icono={<Clock3 className="w-4 h-4" />} rotulo="Trayectoria" valor={`${anios} ${anios === 1 ? 'año' : 'años'}`} />}
            {cv.talentos.length > 0 && <Cifra icono={<Sparkles className="w-4 h-4" />} rotulo="Talentos" valor={String(cv.talentos.length)} />}
            {nProyectos > 0 && <Cifra icono={<Briefcase className="w-4 h-4" />} rotulo="Portafolio" valor={String(nProyectos)} />}
          </div>

          {/* ── PESTAÑAS: en el panel derecho, JUSTO DEBAJO de las cifras ──────
              Lo pidió Fernando ahí (2026-08-14): son la navegación del contenido que
              tienen debajo, así que van pegadas a él y no en la ficha de identidad,
              que es otra cosa. Horizontales, una al lado de otra, en todos los
              tamaños — ya no hay una versión para móvil y otra para escritorio. */}
          {pestanas.length > 1 && (
            <nav aria-label="Secciones del currículum"
              className="cv-pestanas cv-pestanas-h cv-no-imprimir shrink-0 mt-7 flex gap-1.5 overflow-x-auto">
              {pestanas.map((p) => (
                <button key={p.id} type="button" role="tab" aria-selected={activa === p.id}
                  aria-controls={`panel-${p.id}`} onClick={() => setActiva(p.id)}
                  className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[#e6e3ee] bg-white px-4 py-2 text-[13.5px] text-[#56545f]">
                  <span aria-hidden>{p.icono}</span> {p.label}
                </button>
              ))}
            </nav>
          )}

          {/* ⚠️ Los tres paneles SIEMPRE están en el DOM; solo se oculta el que no
              toca. `key={activa}` en el envoltorio hace que la animación de entrada
              se vuelva a disparar en cada cambio. */}
          <div key={activa} className="cv-panel cv-scroll cv-rueda mt-8">
            <Panel id="perfil" activa={activa} titulo="Perfil" conRotulo={pestanas.length < 2}>
              {cv.bio && (
                <p className="max-w-[68ch] text-[15.5px] sm:text-[16.5px] leading-relaxed text-[#56545f]">{cv.bio}</p>
              )}

              {hayTrayectoria && (
                <div className={cv.bio ? 'mt-11' : ''}>
                  <h3 className="text-[11px] uppercase tracking-[0.18em] text-[#5b3fa8]">Trayectoria por talento</h3>
                  <div className="mt-1.5 mb-7 h-px w-full bg-[#e6e3ee]" aria-hidden />
                  <div className="space-y-10">
                    {cv.talentos.filter((t) => t.experiencia.length || t.educacion.length).map((t) => (
                      <div key={t.nombre}>
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <h4 className="text-[20px] font-semibold text-[#1c1b22]">{t.nombre}</h4>
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
                </div>
              )}

              {/* Horario de atención: dato secundario, al final y a varias columnas
                  —siete días en una lista vertical ocupan una pantalla para nada. */}
              {cv.disponibilidad.horario.length > 0 && (
                <div className="mt-11">
                  <h3 className="text-[11px] uppercase tracking-[0.18em] text-[#5b3fa8]">Horario de atención</h3>
                  <div className="mt-1.5 mb-5 h-px w-full bg-[#e6e3ee]" aria-hidden />
                  <dl className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-2">
                    {cv.disponibilidad.horario.map((f) => (
                      <div key={f.dia} className="flex items-center justify-between gap-3 border-b border-[#e6e3ee] pb-1.5 text-[13.5px]">
                        <dt className="text-[#56545f]">{DIAS_SEMANA[f.dia - 1]}</dt>
                        <dd className="tabular-nums text-[#86838f]">{f.inicio} – {f.fin}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </Panel>

            <Panel id="portafolio" activa={activa} titulo="Portafolio" conRotulo={pestanas.length < 2}>
              <PortafolioPublico token={token} items={cv.portafolio} />
            </Panel>
          </div>

          <footer className="shrink-0 mt-6 pt-4 border-t border-[#e6e3ee] text-[12px] text-[#a3a0ac]">
            <p>
              Currículum compartido por {cv.nombre} desde GCC World.
              {cv.actualizado && <> Actualizado el {new Date(cv.actualizado).toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' })}.</>}
            </p>
          </footer>

          {/* La barra de contacto: pie del panel cuando hay dos columnas, barra
              flotante cuando está apilado. Es LA MISMA, solo cambia dónde se ancla. */}
          <BarraContacto cv={cv} urlPdf={urlPdf} />
        </main>
      </div>
    </div>
  );
}

/* ── BARRA DE CONTACTO ────────────────────────────────────────────────────────
 * Correo, teléfono, redes y la descarga, todo en una tira.
 *
 * ── UNA SOLA BARRA PARA LAS DOS VISTAS ───────────────────────────────────────
 * En dos columnas se ancla al pie del panel como una tarjeta; apilada se vuelve
 * `position: fixed` a lo ancho de la ventana. **El componente es el mismo** y lo
 * único que cambia es el CSS de `.cv-barra`: una segunda barra «para móvil» serían
 * dos definiciones del mismo control y dos sitios que mantener.
 *
 * ── POR QUÉ ESTO BAJA AQUÍ ───────────────────────────────────────────────────
 * Correo, teléfono y redes son **acciones**, no identidad. Sacarlas de la ficha es
 * lo que hace que quepa entera en pantallas más bajas y, de paso, las pone donde se
 * usan: al alcance del pulgar en el teléfono y a la vista sin desplazarse en el
 * escritorio.
 *
 * ── LO QUE SE ENCOGE PRIMERO CUANDO NO HAY SITIO ─────────────────────────────
 * El texto del correo y del teléfono (`hidden sm:inline`): el icono ya dice qué es
 * y son enlaces, no información que haya que leer. Las redes son solo iconos desde
 * el principio. La descarga **nunca** se encoge: es la acción principal.
 */
function BarraContacto({ cv, urlPdf }: { cv: CvPublico; urlPdf: string }) {
  const hayContacto = !!(cv.correo || cv.telefono);
  return (
    <div className="cv-barra cv-no-imprimir">
      <div className="mx-auto flex max-w-[1400px] items-center gap-2 sm:gap-3">
        {/* Contacto directo */}
        {cv.correo && (
          <a href={`mailto:${cv.correo}`} title={cv.correo}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[#e6e3ee] bg-white px-2.5 h-[2.1rem] text-[13px] text-[#56545f] transition-colors hover:border-[#7b5fbf] hover:text-[#4b2d8e]">
            <Mail className="w-4 h-4 shrink-0" aria-hidden />
            <span className="hidden sm:inline max-w-[16ch] truncate">{cv.correo}</span>
            <span className="sr-only sm:hidden">Escribir un correo</span>
          </a>
        )}
        {cv.telefono && (
          <a href={`tel:${cv.telefono.replace(/[^\d+]/g, '')}`} title={cv.telefono}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[#e6e3ee] bg-white px-2.5 h-[2.1rem] text-[13px] text-[#56545f] transition-colors hover:border-[#7b5fbf] hover:text-[#4b2d8e]">
            <Phone className="w-4 h-4 shrink-0" aria-hidden />
            <span className="hidden sm:inline">{cv.telefono}</span>
            <span className="sr-only sm:hidden">Llamar</span>
          </a>
        )}

        {hayContacto && cv.redes.length > 0 && (
          <span className="hidden sm:block h-5 w-px shrink-0 bg-[#e6e3ee]" aria-hidden />
        )}

        {/* Redes: solo iconos. El nombre va en el `title` y en la etiqueta accesible. */}
        {cv.redes.length > 0 && (
          <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto">
            {cv.redes.map((r) => (
              <a key={r.red} href={r.url} target="_blank" rel="noopener noreferrer nofollow"
                className="cv-red shrink-0" title={`${r.etiqueta}: ${textoCorto(r.url)}`} aria-label={r.etiqueta}>
                <IconoRed red={r.red} />
              </a>
            ))}
          </div>
        )}

        {/* La acción principal, siempre a la derecha y sin encogerse. */}
        <a href={urlPdf}
          className="ml-auto inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#4b2d8e] px-4 h-[2.1rem] text-[13.5px] font-medium text-white transition-colors hover:bg-[#5b3fa8]">
          <Download className="w-4 h-4" aria-hidden />
          <span className="hidden sm:inline">Descargar en PDF</span>
          <span className="sm:hidden">PDF</span>
        </a>
      </div>
    </div>
  );
}

/* ── Piezas ─────────────────────────────────────────────────────────────────── */

function Foto({ cv }: { cv: CvPublico }) {
  const iniciales = cv.nombre.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const clases = 'cv-foto rounded-2xl border border-[#7b5fbf]/35 object-cover';
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

/**
 * Panel de una pestaña. Presente siempre en el DOM; `hidden` si no es la activa.
 *
 * ⚠️ **Con pestañas a la vista, el rótulo NO se pinta.** La pestaña activa dice
 * «Portafolio» y el panel repetía «PORTAFOLIO» justo debajo: el mismo nombre dos
 * veces en dos centímetros. El `aria-label` se queda, que es lo que necesita un
 * lector de pantalla para saber dónde está.
 */
function Panel({ id, activa, titulo, conRotulo = true, children }: {
  id: Pestana; activa: Pestana; titulo: string; conRotulo?: boolean; children: React.ReactNode;
}) {
  return (
    <section id={`panel-${id}`} role="tabpanel" hidden={activa !== id} aria-label={titulo}>
      {conRotulo && (
        <>
          <h2 className="text-[11px] uppercase tracking-[0.18em] text-[#5b3fa8]">{titulo}</h2>
          <div className="mt-1.5 mb-7 h-px w-full bg-[#e6e3ee]" aria-hidden />
        </>
      )}
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

'use client';

import { Suspense, useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import ProfilePanel from '@/components/settings/ProfilePanel';
import CvPanel from '@/components/settings/CvPanel';
import AvailabilityPanel from '@/components/settings/AvailabilityPanel';
import PortfolioPanel from '@/components/settings/PortfolioPanel';
import PanelCompartirCv from '@/components/settings/PanelCompartirCv';
import ConexionesPanel from '@/components/settings/ConexionesPanel';
import NotificacionesPanel from '@/components/settings/NotificacionesPanel';
import DetailHeader from '@/components/ui/DetailHeader';
import PortadaSecciones from '@/components/ui/PortadaSecciones';
import { useAltoHastaElPie } from '@/lib/hooks/useAltoHastaElPie';
import { useConsultaMedia, PANTALLA_LG } from '@/lib/hooks/useConsultaMedia';
import { FileText, CalendarClock, Briefcase, Share2, Link2, Bell, User, ChevronRight, type LucideIcon } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

type TabKey = 'cv' | 'availability' | 'portfolio' | 'conexiones' | 'notificaciones';
const TABS: { key: TabKey; label: string; Icon: LucideIcon; soloMiembro: boolean; grupo: 'Profesional' | 'Cuenta' }[] = [
  { key: 'cv', label: 'Mi CV', Icon: FileText, soloMiembro: true, grupo: 'Profesional' },
  { key: 'availability', label: 'Disponibilidad', Icon: CalendarClock, soloMiembro: true, grupo: 'Profesional' },
  { key: 'portfolio', label: 'Portafolio', Icon: Briefcase, soloMiembro: true, grupo: 'Profesional' },
  // Conexiones (Google) es de miembros Y candidatos: la usan las Experiencias personales.
  { key: 'conexiones', label: 'Conexiones', Icon: Link2, soloMiembro: false, grupo: 'Cuenta' },
  // Qué avisos recibe cada uno y por dónde (Fernando, 2026-10-29: miembros y administradores).
  { key: 'notificaciones', label: 'Notificaciones', Icon: Bell, soloMiembro: true, grupo: 'Cuenta' },
];

/**
 * Configuración: **Perfil fijo a la izquierda** + a la derecha una zona con **pestañas**
 * (CV · Disponibilidad · Portafolio). El contenido de la pestaña activa llena todo el
 * ancho disponible (layouts multi-columna) sin scroll interno — la página se desplaza si
 * hace falta. Las pestañas de miembro solo aparecen si el usuario tiene member_id;
 * «Conexiones» la ven también los candidatos. `?tab=conexiones` abre esa pestaña (es a
 * donde vuelve la conexión con Google).
 */
export default function SettingsPage() {
  // `useSearchParams` pide un Suspense por encima para poder compilar la página.
  return <Suspense fallback={null}><Configuracion /></Suspense>;
}

const sinSuscripcion = () => () => {};

function Configuracion() {
  const { user } = useAuth();
  const isMember = !!user?.member_id;
  const [tab, setTab] = useState<TabKey>('cv');
  const [compartir, setCompartir] = useState(false);
  const esCandidato = user?.account_type === 'candidate';
  const tabs = TABS.filter((t) => isMember || (!t.soloMiembro && esCandidato));
  const tabActiva = tabs.some((t) => t.key === tab) ? tab : tabs[0]?.key;
  const enTelefono = !useConsultaMedia(PANTALLA_LG);
  // Hasta hidratar no se sabe el ancho (el servidor no tiene ventana): sin esto el escritorio
  // pintaría un instante la portada del teléfono.
  const hidratado = useSyncExternalStore(sinSuscripcion, () => true, () => false);
  const tabUrl = useSearchParams().get('tab');

  useEffect(() => {
    if (tabUrl && TABS.some((x) => x.key === tabUrl)) setTab(tabUrl as TabKey);
  }, [tabUrl]);

  /* ── EL ALTO LO PONE EL PIE DE LA APP, NO EL CONTENIDO (Fernando, 2026-08-15) ──
   * Antes la fila crecía con los campos y la página se desplazaba entera, así que
   * el botón «Guardar» acababa fuera de la vista. Ahora los dos paneles miden **lo
   * que queda hasta el pie** y cada uno se desplaza por dentro.
   *
   * `useAltoHastaElPie` es el hook del repo que ya resuelve esto: mide el hueco
   * descontando el pie por `[data-app-footer]` —no por unos píxeles a ojo—, usa
   * referencia como FUNCIÓN (el bloque puede no existir al montar) y observa al
   * PADRE, porque dentro de un contenedor con desplazamiento propio el `body` no
   * cambia de tamaño nunca. */
  const alto = useAltoHastaElPie({ minimo: 480 });

  if (!hidratado) return null;
  if (enTelefono) {
    return (
      <>
        <ConfiguracionMovil tabs={tabs} seccion={tabUrl} isMember={isMember} onCompartir={() => setCompartir(true)} />
        <PanelCompartirCv open={compartir} onClose={() => setCompartir(false)} />
      </>
    );
  }

  return (
    <div>
      {/* El alto medido solo se impone en pantallas anchas: apiladas en vertical, dos
          columnas recortadas a media pantalla no se leerían. */}
      <div
        ref={alto.ref}
        style={alto.style}
        className="flex flex-col xl:flex-row gap-4 items-stretch max-xl:!h-auto xl:min-h-0"
      >
        <ProfilePanel />

        {tabs.length > 0 && (
          <div className="flex-1 min-w-0 w-full h-full min-h-0 flex flex-col bg-digi-card border border-digi-border rounded-xl shadow-sm overflow-hidden">
            {/* Barra de pestañas + «Compartir CV» a la derecha, como el «Compartir
                acceso» de un proyecto.

                ⚠️ **NADA DE `overflow-x-auto` AQUÍ.** La primera versión lo puso en
                el grupo de pestañas «por si algún día no caben», y con tres pestañas
                y sitio de sobra el navegador dibujaba igualmente su barra horizontal:
                se comía alto y asomaba un cuadrito en la esquina. Lo vio Fernando.
                Un contenedor de scroll que nunca desplaza nada solo estorba; si algún
                día hicieran falta más pestañas, se envuelven (`flex-wrap`), que en
                una barra ancha es mejor gesto que arrastrar de lado.

                `justify-between` en vez del hueco `flex-1`: es la misma colocación con
                un elemento menos. */}
            <div className="flex items-stretch justify-between gap-2 border-b border-digi-border shrink-0">
              <div className="flex items-stretch flex-wrap">
                {tabs.map((t) => {
                  const active = tabActiva === t.key;
                  return (
                    <button key={t.key} onClick={() => setTab(t.key)}
                      className={`inline-flex items-center gap-2 px-4 py-3 text-[13px] font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${active ? 'border-accent text-accent bg-accent-light/40' : 'border-transparent text-digi-muted hover:text-digi-text'}`} style={mf}>
                      <t.Icon className="w-4 h-4" /> {t.label}
                    </button>
                  );
                })}
              </div>
              {isMember && <div className="flex items-center shrink-0 px-2">
                <button onClick={() => setCompartir(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-accent text-accent text-[13px] font-medium rounded hover:bg-accent-light transition-colors whitespace-nowrap" style={mf}>
                  <Share2 className="w-4 h-4" /> Compartir CV
                </button>
              </div>}
            </div>

            {/* ⚠️ Este hueco NO lleva `overflow` ni relleno: **cada panel decide** qué
                parte suya se desplaza y qué parte queda fija al fondo. Si el scroll
                estuviera aquí, el botón «Guardar CV» se iría con el contenido, que es
                justo lo que se quería evitar. */}
            <div className="flex-1 min-h-0 flex flex-col">
              {tabActiva === 'cv' && <CvPanel />}
              {tabActiva === 'availability' && <AvailabilityPanel />}
              {tabActiva === 'portfolio' && <PortfolioPanel />}
              {tabActiva === 'conexiones' && <ConexionesPanel />}
              {tabActiva === 'notificaciones' && <NotificacionesPanel />}
            </div>
          </div>
        )}
      </div>

      {/* Panel lateral derecho con overlay: el mismo diseño que «Compartir acceso»
          de una cotización. */}
      <PanelCompartirCv open={compartir} onClose={() => setCompartir(false)} />
    </div>
  );
}

/* ── TELÉFONO: portada de ajustes → sección (Fernando, 2026-10-29) ──────────────────────
 * Antes el teléfono apilaba el Perfil entero (≈ 3 pantallas) y debajo un selector con las
 * demás secciones: para llegar a Notificaciones había que bajar por todo el perfil. Ahora la
 * portada es la tarjeta de quién eres + la lista de secciones con su icono, y cada sección
 * se abre en su propia pantalla con la flecha de volver (`DetailHeader`).
 *
 * La sección abierta vive en la URL (`?tab=`), no en un estado: así el «atrás» del teléfono
 * vuelve a la portada, y `?tab=conexiones` (la vuelta de Google) abre esa sección directa.
 * Desde `lg` se usa la disposición de escritorio de siempre: Perfil a la izquierda + pestañas. */
type Seccion = { key: 'perfil' | TabKey; label: string; Icon: LucideIcon };

function ConfiguracionMovil({ tabs, seccion, isMember, onCompartir }: {
  tabs: typeof TABS; seccion: string | null; isMember: boolean; onCompartir: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const secciones: Seccion[] = [{ key: 'perfil', label: 'Perfil', Icon: User }, ...tabs];
  const abierta = secciones.find((x) => x.key === seccion);
  const abrir = (key: Seccion['key']) => router.push(`/dashboard/settings?tab=${key}`, { scroll: false });

  // Sin más secciones que el Perfil (un cliente) no hay nada que elegir: el Perfil directo.
  if (abierta || secciones.length === 1) {
    const s = abierta ?? secciones[0];
    return (
      <div>
        {secciones.length > 1 ? (
          <DetailHeader breadcrumb={{ label: 'Configuración', href: '/dashboard/settings' }} title={s.label} />
        ) : <h1 className="page-title pixel-heading text-digi-text mb-4">Perfil</h1>}
        {s.key === 'perfil' ? <ProfilePanel /> : (
          // Sin tarjeta alrededor (2026-10-30): cada sección pinta sus bloques como tarjetas propias
          // sobre el fondo; una tarjeta dentro de otra se comía el ancho de los campos.
          <div className="flex flex-col">
            {s.key === 'cv' && <CvPanel />}
            {s.key === 'availability' && <AvailabilityPanel />}
            {s.key === 'portfolio' && <PortfolioPanel />}
            {s.key === 'conexiones' && <ConexionesPanel />}
            {s.key === 'notificaciones' && <NotificacionesPanel />}
          </div>
        )}
      </div>
    );
  }

  const nombre = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email || '';
  return (
    <PortadaSecciones
      titulo="Configuración"
      onAbrir={(key) => abrir(key as Seccion['key'])}
      secciones={[
        ...tabs.map((t) => ({ key: t.key, label: t.label, Icon: t.Icon, grupo: t.grupo })),
        ...(isMember ? [{ key: 'compartir', label: 'Compartir CV', Icon: Share2, grupo: 'Profesional', onClick: onCompartir }] : []),
      ].sort((a, b) => (a.grupo === b.grupo ? 0 : a.grupo === 'Profesional' ? -1 : 1))}
      cabecera={(
        /* Quién eres: al tocarla se abre el Perfil. */
        <button type="button" onClick={() => abrir('perfil')}
          className="w-full flex items-center gap-3.5 p-3.5 text-left bg-digi-card border border-digi-border rounded-xl shadow-sm active:bg-accent-light/40 transition-colors">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="" className="w-14 h-14 rounded-xl border border-digi-border object-cover shrink-0" />
          ) : (
            <span className="w-14 h-14 rounded-xl flex items-center justify-center bg-accent-light text-accent text-xl font-semibold shrink-0">
              {(user?.first_name?.[0] || user?.email?.[0] || '?').toUpperCase()}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-semibold text-digi-text truncate">{nombre}</span>
            <span className="block text-[12.5px] text-digi-muted truncate">{user?.email}</span>
          </span>
          <ChevronRight className="w-5 h-5 text-digi-muted shrink-0" />
        </button>
      )}
    />
  );
}

'use client';

import { Suspense, useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import DetailHeader from '@/components/ui/DetailHeader';
import PortadaSecciones from '@/components/ui/PortadaSecciones';
import { useConsultaMedia, PANTALLA_LG } from '@/lib/hooks/useConsultaMedia';
import PageHeader from '@/components/ui/PageHeader';
import RazonesPanel from '@/components/razones/RazonesPanel';
import FuentesPanel from '@/components/admin/FuentesPanel';
import TutorialesPanel from '@/components/admin/TutorialesPanel';
import ListasPanel from '@/components/admin/ListasPanel';
import FaqsPanel from '@/components/admin/FaqsPanel';
import SolucionesPanel from '@/components/admin/SolucionesPanel';
import PromptsPanel from '@/components/admin/PromptsPanel';
import { Flame, ShieldAlert, Database, Video, ListChecks, HelpCircle, Layers, NotebookPen } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

// Panel de administración: "Razones" (cuaderno personal del admin, tipo
// Pensamientos, sin clasificación por IA) y las
// utilidades de administrador: "Fuentes" (tablas de la base), "Tutoriales" (videos
// que se ven desde el botón ⓘ de cada módulo) y "Listas" (las listas globales del
// proyecto: talentos, valores, materias… las mismas de Encuadre Condiciológico).
const TABS = [
  { value: 'razones', label: 'Razones', Icon: Flame, grupo: 'Personal' },
  { value: 'fuentes', label: 'Fuentes', Icon: Database, grupo: 'Datos' },
  { value: 'tutoriales', label: 'Tutoriales', Icon: Video, grupo: 'Contenido público' },
  { value: 'listas', label: 'Listas', Icon: ListChecks, grupo: 'Datos' },
  // Las preguntas frecuentes que se PUBLICAN en /clientes/<seccion>. Es la única pestaña
  // del admin cuyo contenido sale de cara al mundo, y de la que salen los datos
  // estructurados `FAQPage` que Google convierte en respuestas dentro de sus resultados.
  { value: 'faqs', label: 'FAQs', Icon: HelpCircle, grupo: 'Contenido público' },
  // Los ÁMBITOS que se publican en /soluciones: los tipos de proyecto que maneja el grupo y
  // los talentos de cada uno. Segunda pestaña cuyo contenido sale de cara al mundo.
  { value: 'soluciones', label: 'Soluciones', Icon: Layers, grupo: 'Contenido público' },
  // La documentación de cada proyecto, escrita como en Word y exportable como prompt
  // (Markdown) para dársela a una IA (Fernando, 2026-10-01).
  { value: 'prompts', label: 'Prompts', Icon: NotebookPen, grupo: 'Personal' },
];


const sinSuscripcion = () => () => {};

export default function AdminPage() {
  // `useSearchParams` pide un Suspense por encima para poder compilar la página.
  return <Suspense fallback={null}><Admin /></Suspense>;
}

function Admin() {
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState('razones');
  const tabUrl = useSearchParams().get('tab');
  const enTelefono = !useConsultaMedia(PANTALLA_LG);
  const hidratado = useSyncExternalStore(sinSuscripcion, () => true, () => false);

  useEffect(() => {
    if (tabUrl && TABS.some((t) => t.value === tabUrl)) setTab(tabUrl);
  }, [tabUrl]);

  if (user?.role !== 'admin') {
    return (
      <div className="bg-digi-card border border-digi-border rounded-lg text-center py-12">
        <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center mx-auto mb-2"><ShieldAlert className="w-5 h-5 text-red-600" /></div>
        <p className="text-sm font-semibold text-digi-text" style={mf}>Acceso denegado</p>
        <p className="text-[12px] text-digi-muted mt-1" style={mf}>Solo administradores pueden ver esta página.</p>
      </div>
    );
  }

  if (!hidratado) return null;

  /* Teléfono: la portada de secciones estándar (`PortadaSecciones`) en vez de un <select>; cada
     sección se abre en su pantalla con la flecha de volver, y vive en `?tab=`. */
  if (enTelefono) {
    const abierta = TABS.find((t) => t.value === tabUrl);
    if (!abierta) {
      return (
        <PortadaSecciones titulo="Admin"
          secciones={TABS.map((t) => ({ key: t.value, label: t.label, Icon: t.Icon, grupo: t.grupo }))}
          onAbrir={(key) => router.push(`/dashboard/admin?tab=${key}`, { scroll: false })} />
      );
    }
    return (
      <div>
        <DetailHeader breadcrumb={{ label: 'Admin', href: '/dashboard/admin' }} title={abierta.label} />
        <Contenido tab={abierta.value} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Admin" description="Mundo, sprites, tus razones de lucha y las utilidades de administrador" />

      <div className="flex items-center gap-1 bg-digi-card border border-digi-border rounded-lg p-1 mb-4">
        {TABS.map((t) => {
          const active = tab === t.value;
          return (
            <button key={t.value} onClick={() => setTab(t.value)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-md whitespace-nowrap transition-colors ${
                active ? 'bg-accent-light text-accent' : 'text-digi-muted hover:text-digi-text hover:bg-black/[0.03]'
              }`}>
              <t.Icon className={`w-4 h-4 shrink-0 ${active ? 'text-accent' : 'text-digi-muted'}`} />
              <span className="text-[12.5px] font-medium" style={mf}>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Contenido ── */}
      <Contenido tab={tab} />
    </div>
  );
}

function Contenido({ tab }: { tab: string }) {
  return (
    <div className="w-full">
      {tab === 'razones' && <RazonesPanel />}
      {tab === 'fuentes' && <FuentesPanel />}
      {tab === 'tutoriales' && <TutorialesPanel />}
      {tab === 'listas' && <ListasPanel />}
      {tab === 'faqs' && <FaqsPanel />}
      {tab === 'soluciones' && <SolucionesPanel />}
      {tab === 'prompts' && <PromptsPanel />}
    </div>
  );
}

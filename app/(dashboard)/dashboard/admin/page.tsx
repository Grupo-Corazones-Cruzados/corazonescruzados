'use client';

import { useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import PageHeader from '@/components/ui/PageHeader';
import RazonesPanel from '@/components/razones/RazonesPanel';
import FuentesPanel from '@/components/admin/FuentesPanel';
import TutorialesPanel from '@/components/admin/TutorialesPanel';
import ListasPanel from '@/components/admin/ListasPanel';
import FaqsPanel from '@/components/admin/FaqsPanel';
import { Flame, ShieldAlert, Database, Video, ListChecks, HelpCircle } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

// Panel de administración: "Razones" (cuaderno personal del admin, tipo
// Pensamientos, sin clasificación por IA) y las
// utilidades de administrador: "Fuentes" (tablas de la base), "Tutoriales" (videos
// que se ven desde el botón ⓘ de cada módulo) y "Listas" (las listas globales del
// proyecto: talentos, valores, materias… las mismas de Encuadre Condiciológico).
const TABS = [
  { value: 'razones', label: 'Razones', Icon: Flame },
  { value: 'fuentes', label: 'Fuentes', Icon: Database },
  { value: 'tutoriales', label: 'Tutoriales', Icon: Video },
  { value: 'listas', label: 'Listas', Icon: ListChecks },
  // Las preguntas frecuentes que se PUBLICAN en /soluciones/<seccion>. Es la única pestaña
  // del admin cuyo contenido sale de cara al mundo, y de la que salen los datos
  // estructurados `FAQPage` que Google convierte en respuestas dentro de sus resultados.
  { value: 'faqs', label: 'FAQs', Icon: HelpCircle },
];


export default function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('razones');

  if (user?.role !== 'admin') {
    return (
      <div className="bg-digi-card border border-digi-border rounded-lg text-center py-12">
        <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center mx-auto mb-2"><ShieldAlert className="w-5 h-5 text-red-600" /></div>
        <p className="text-sm font-semibold text-digi-text" style={mf}>Acceso denegado</p>
        <p className="text-[12px] text-digi-muted mt-1" style={mf}>Solo administradores pueden ver esta página.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Admin" description="Mundo, sprites, tus razones de lucha y las utilidades de administrador" />

      {/* ── Pestañas horizontales (arriba) ── */}
      <div className="flex items-center gap-1 bg-digi-card border border-digi-border rounded-lg p-1 mb-4 overflow-x-auto">
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
      <div className="w-full">
                {tab === 'razones' && <RazonesPanel />}
        {tab === 'fuentes' && <FuentesPanel />}
        {tab === 'tutoriales' && <TutorialesPanel />}
        {tab === 'listas' && <ListasPanel />}
        {tab === 'faqs' && <FaqsPanel />}
      </div>
    </div>
  );
}

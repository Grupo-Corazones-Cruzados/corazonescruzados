'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  Send, ImagePlus, X, Clock, CheckCircle, XCircle, Loader2,
  AlertTriangle, ChevronDown, ChevronUp, Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Incident, IncidentStatus, IncidentSeverity } from '@/types/incidents';
import type { ProjectStructure, Module, Section } from '@/types/projects';

const STATUS_CONFIG: Record<IncidentStatus, { label: string; color: string; icon: typeof Clock }> = {
  pending:   { label: 'Pendiente',   color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30', icon: Clock },
  approved:  { label: 'Aprobada',    color: 'text-blue-400 bg-blue-400/10 border-blue-400/30',     icon: CheckCircle },
  rejected:  { label: 'Rechazada',   color: 'text-red-400 bg-red-400/10 border-red-400/30',        icon: XCircle },
  reviewing: { label: 'En revisión', color: 'text-purple-400 bg-purple-400/10 border-purple-400/30', icon: Clock },
  completed: { label: 'Completada',  color: 'text-green-400 bg-green-400/10 border-green-400/30',   icon: CheckCircle },
};

const SEVERITY_CONFIG: Record<IncidentSeverity, { label: string; color: string }> = {
  low:      { label: 'Baja',     color: 'text-blue-300 bg-blue-400/10 border-blue-400/30' },
  medium:   { label: 'Media',    color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30' },
  high:     { label: 'Alta',     color: 'text-orange-400 bg-orange-400/10 border-orange-400/30' },
  critical: { label: 'Critica',  color: 'text-red-400 bg-red-400/10 border-red-400/30' },
};

export default function PortalPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'new' | 'list'>('new');
  const [expanded, setExpanded] = useState<string | null>(null);

  // project structure
  const [project, setProject] = useState<ProjectStructure | null>(null);
  const [selectedModule, setSelectedModule] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedSubsection, setSelectedSubsection] = useState('');

  // form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [clientName, setClientName] = useState('');
  const [severity, setSeverity] = useState<IncidentSeverity>('medium');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // derived options
  const modules = project?.modules || [];
  const currentModule = modules.find(m => m.id === selectedModule);
  const sections = currentModule?.sections || [];
  const currentSection = sections.find(s => s.id === selectedSection);
  const subsections = currentSection?.subsections || [];

  const fetchIncidents = async () => {
    const res = await fetch(`/api/incidents?projectId=${projectId}`);
    const data = await res.json();
    setIncidents(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchIncidents();
    // Load project structure
    fetch('/api/project-structures').then(r => r.json()).then((structs: ProjectStructure[]) => {
      const found = structs.find(s => s.id === projectId);
      if (found) setProject(found);
    });
  }, [projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    if (modules.length > 0 && !selectedModule) return;
    setSubmitting(true);

    // Build location label
    const locationParts: string[] = [];
    const modLabel = selectedModule === '__all__' ? 'Todas' : currentModule?.name || '';
    locationParts.push(modLabel);

    if (selectedModule !== '__all__') {
      const secLabel = selectedSection ? (currentSection?.name || '') : 'Todas';
      locationParts.push(secLabel);

      if (selectedSection) {
        const subLabel = selectedSubsection
          ? (subsections.find(ss => ss.id === selectedSubsection)?.name || '')
          : 'Todas';
        locationParts.push(subLabel);
      }
    }

    const location = locationParts.filter(Boolean).join(' > ');

    const form = new FormData();
    form.append('projectId', projectId);
    form.append('title', title.trim());
    form.append('description', `[${location}]\n\n${description.trim()}`);
    form.append('clientName', clientName.trim() || 'Cliente');
    form.append('severity', severity);
    for (const f of files) form.append('images', f);

    await fetch('/api/incidents', { method: 'POST', body: form });

    setTitle('');
    setDescription('');
    setSeverity('medium');
    setSelectedModule('');
    setSelectedSection('');
    setSelectedSubsection('');
    setFiles([]);
    setSubmitting(false);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
    await fetchIncidents();
    setTab('list');
  };

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handlePasteImage = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const pastedFiles: File[] = [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) pastedFiles.push(file);
      }
    }
    if (pastedFiles.length > 0) {
      e.preventDefault();
      setFiles(prev => [...prev, ...pastedFiles]);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5]">
      {/* header */}
      <div className="border-b border-[#2a2a2a] bg-[#111111]">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-lg font-bold tracking-wide" style={{ fontFamily: 'Silkscreen, cursive' }}>
            <span className="text-white">Portal de Incidencias</span>
          </h1>
          <p className="text-xs text-[#737373] mt-1 font-mono">
            Proyecto: {projectId}
          </p>
        </div>
      </div>

      {/* tabs */}
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <div className="flex gap-1 bg-[#1a1a1a] rounded-lg p-1 border border-[#2a2a2a]">
          <button
            onClick={() => setTab('list')}
            className={cn(
              'flex-1 py-2 px-3 rounded text-xs font-medium transition-colors',
              tab === 'list'
                ? 'bg-white/10 text-white'
                : 'text-[#737373] hover:text-white',
            )}
          >
            Incidencias ({incidents.length})
          </button>
          <button
            onClick={() => setTab('new')}
            className={cn(
              'flex-1 py-2 px-3 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5',
              tab === 'new'
                ? 'bg-white/10 text-white'
                : 'text-[#737373] hover:text-white',
            )}
          >
            <Plus size={12} /> Nueva incidencia
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {/* ─── NEW FORM ─── */}
        {tab === 'new' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {submitted && (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-400/10 border border-green-400/30 rounded text-green-400 text-xs">
                <CheckCircle size={14} /> Incidencia enviada correctamente
              </div>
            )}

            <div>
              <label className="block text-[11px] text-[#737373] mb-1.5">Tu nombre</label>
              <input
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white outline-none focus:border-[#4a4a4a] transition-colors"
                placeholder="Nombre (opcional)"
              />
            </div>

            <div>
              <label className="block text-[11px] text-[#737373] mb-1.5">Titulo *</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white outline-none focus:border-[#4a4a4a] transition-colors"
                placeholder="Breve resumen de la incidencia"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] text-[#737373] mb-1.5">Criticidad *</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(Object.entries(SEVERITY_CONFIG) as [IncidentSeverity, { label: string; color: string }][]).map(([key, cfg]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSeverity(key)}
                    className={cn(
                      'py-2 rounded border text-xs font-medium transition-all',
                      severity === key
                        ? cfg.color
                        : 'text-[#737373] bg-[#1a1a1a] border-[#2a2a2a] hover:border-[#4a4a4a]'
                    )}
                  >
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>

            {/* module / section / subsection selectors */}
            {modules.length > 0 && (
              <>
                <div>
                  <label className="block text-[11px] text-[#737373] mb-1.5">Modulo *</label>
                  <select
                    value={selectedModule}
                    onChange={e => { setSelectedModule(e.target.value); setSelectedSection(''); setSelectedSubsection(''); }}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white outline-none focus:border-[#4a4a4a] transition-colors"
                    required
                  >
                    <option value="">Selecciona un modulo</option>
                    <option value="__all__">Todas</option>
                    {modules.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                {selectedModule && selectedModule !== '__all__' && sections.length > 0 && (
                  <div>
                    <label className="block text-[11px] text-[#737373] mb-1.5">Seccion</label>
                    <select
                      value={selectedSection}
                      onChange={e => { setSelectedSection(e.target.value); setSelectedSubsection(''); }}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white outline-none focus:border-[#4a4a4a] transition-colors"
                    >
                      <option value="">Todas</option>
                      {sections.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedSection && selectedSection !== '' && subsections.length > 0 && (
                  <div>
                    <label className="block text-[11px] text-[#737373] mb-1.5">Subseccion</label>
                    <select
                      value={selectedSubsection}
                      onChange={e => setSelectedSubsection(e.target.value)}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white outline-none focus:border-[#4a4a4a] transition-colors"
                    >
                      <option value="">Todas</option>
                      {subsections.map(ss => (
                        <option key={ss.id} value={ss.id}>{ss.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            <div>
              <label className="block text-[11px] text-[#737373] mb-1.5">Descripcion *</label>
              {modules.length > 0 && !selectedModule && (
                <p className="text-[10px] text-yellow-400/70 mb-1.5 flex items-center gap-1">
                  <AlertTriangle size={10} /> Selecciona un módulo primero
                </p>
              )}
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                onPaste={handlePasteImage}
                rows={5}
                className={cn(
                  "w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white outline-none focus:border-[#4a4a4a] transition-colors resize-none",
                  modules.length > 0 && !selectedModule && "opacity-40 cursor-not-allowed"
                )}
                placeholder="Describe con detalle la incidencia encontrada... (puedes pegar imágenes aquí)"
                required
                disabled={modules.length > 0 && !selectedModule}
              />
            </div>

            {/* images */}
            <div>
              <label className="block text-[11px] text-[#737373] mb-1.5">Imagenes (opcional)</label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => {
                  if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 bg-[#1a1a1a] border border-dashed border-[#2a2a2a] rounded text-xs text-[#737373] hover:text-white hover:border-[#4a4a4a] transition-colors w-full justify-center"
              >
                <ImagePlus size={14} /> Agregar imagenes o pegar (Ctrl+V)
              </button>
              {files.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {files.map((f, i) => (
                    <div key={i} className="relative group">
                      <img
                        src={URL.createObjectURL(f)}
                        alt=""
                        className="w-16 h-16 object-cover rounded border border-[#2a2a2a]"
                      />
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={10} className="text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || !title.trim() || !description.trim() || (modules.length > 0 && !selectedModule)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-black rounded text-sm font-medium hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Enviar incidencia
            </button>
          </form>
        )}

        {/* ─── LIST ─── */}
        {tab === 'list' && (
          <div className="space-y-2">
            {loading && (
              <div className="flex items-center justify-center py-8 text-[#737373]">
                <Loader2 size={18} className="animate-spin mr-2" /> Cargando...
              </div>
            )}

            {!loading && incidents.length === 0 && (
              <div className="text-center py-8 text-[#737373] text-sm">
                No hay incidencias registradas para este proyecto.
              </div>
            )}

            {incidents.map(inc => {
              const cfg = STATUS_CONFIG[inc.status];
              const Icon = cfg.icon;
              const sevCfg = SEVERITY_CONFIG[(inc.severity as IncidentSeverity) || 'medium'];
              const isOpen = expanded === inc.id;

              return (
                <div key={inc.id} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpanded(isOpen ? null : inc.id)}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-white/5 transition-colors"
                  >
                    <div className={cn('flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] shrink-0', cfg.color)}>
                      <Icon size={10} /> {cfg.label}
                    </div>
                    <div className={cn('px-1.5 py-0.5 rounded border text-[9px] shrink-0', sevCfg.color)}>
                      {sevCfg.label}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{inc.title}</p>
                      <p className="text-[10px] text-[#737373] font-mono mt-0.5">
                        {inc.clientName} — {new Date(inc.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {inc.images.length > 0 && (
                      <span className="text-[10px] text-[#737373] shrink-0">{inc.images.length} img</span>
                    )}
                    {isOpen ? <ChevronUp size={14} className="text-[#737373]" /> : <ChevronDown size={14} className="text-[#737373]" />}
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 border-t border-[#2a2a2a] pt-3 space-y-3">
                      <p className="text-sm text-[#e5e5e5] whitespace-pre-wrap">{inc.description}</p>
                      {inc.images.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {inc.images.map((img, i) => (
                            <a
                              key={i}
                              href={`${img}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <img
                                src={`${img}`}
                                alt=""
                                className="w-24 h-24 object-cover rounded border border-[#2a2a2a] hover:border-white/30 transition-colors cursor-pointer"
                              />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

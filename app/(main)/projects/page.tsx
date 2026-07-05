'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Plus, Trash2, ChevronRight, ChevronDown,
  FolderTree, Box, Layers, FileText,
  Save, Loader2, Link2, Check, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProjectStructure, Module, Section, Subsection } from '@/types/projects';

/* ────────── helpers ────────── */

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

type AgentInfo = Record<string, { projectPath?: string; port?: number; productionUrl?: string }>;

/** Inline-editable text: transparent until hover/focus, then a subtle field appears. */
function InlineText({ value, onChange, placeholder, className }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        'min-w-0 bg-transparent border border-transparent rounded-md px-1.5 py-1 outline-none transition-colors',
        'hover:bg-black/[0.03] focus:bg-digi-darker focus:border-accent/50 focus:ring-1 focus:ring-accent/20',
        'placeholder:text-digi-muted/50',
        className,
      )}
    />
  );
}

function CountChip({ n, suffix }: { n: number; suffix?: string }) {
  return (
    <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] tabular-nums text-digi-muted bg-black/[0.05]">
      {n}{suffix ? ` ${suffix}` : ''}
    </span>
  );
}

/* ────────── page ────────── */

export default function ProjectsPage() {
  const [structures, setStructures] = useState<ProjectStructure[]>([]);
  const [agents, setAgents] = useState<AgentInfo>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/project-structures').then(r => r.json()),
      fetch('/api/agent-links').then(r => r.json()),
    ]).then(([structs, agentData]) => {
      setStructures(structs);
      setAgents(agentData);
      setSelectedId(structs[0]?.id ?? null);
      setLoaded(true);
    });
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/project-structures', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(structures),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error('Error al guardar: ' + (data.error || res.statusText));
        return;
      }
      setDirty(false);
      toast.success('Estructura guardada');
    } catch (e: any) {
      toast.error('Error al guardar: ' + e.message);
    } finally {
      setSaving(false);
    }
  }, [structures]);

  const update = useCallback((fn: (draft: ProjectStructure[]) => ProjectStructure[]) => {
    setStructures(prev => {
      const next = fn([...prev]);
      setDirty(true);
      return next;
    });
  }, []);

  const availableAgents = Object.entries(agents).filter(
    ([id]) => !structures.some(s => s.agentId === id),
  );

  const addProject = (agentId: string) => {
    const agentName = agentId.charAt(0).toUpperCase() + agentId.slice(1);
    const id = uid();
    update(draft => [...draft, { id, agentId, name: agentName, modules: [] }]);
    setSelectedId(id);
  };
  const removeProject = (id: string) => {
    update(draft => draft.filter(p => p.id !== id));
    setSelectedId(prev => (prev === id ? structures.find(p => p.id !== id)?.id ?? null : prev));
  };
  const updateProject = (id: string, patch: Partial<ProjectStructure>) =>
    update(draft => draft.map(p => (p.id === id ? { ...p, ...patch } : p)));

  const selected = structures.find(s => s.id === selectedId) || null;

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-64 text-digi-muted text-sm">
        <Loader2 className="animate-spin mr-2" size={18} /> Cargando...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* header */}
      <div className="flex items-start justify-between gap-3 mb-4 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-accent-light flex items-center justify-center shrink-0">
            <FolderTree size={18} className="text-accent" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-digi-text leading-tight">Proyectos</h2>
            <p className="text-[13px] text-digi-muted">Estructura de módulos, secciones y subsecciones por proyecto</p>
          </div>
        </div>
        <button
          onClick={save}
          disabled={!dirty || saving}
          className={cn(
            'inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-[13px] font-medium transition-colors shrink-0',
            dirty
              ? 'bg-accent text-white hover:bg-accent-hover shadow-sm'
              : 'bg-digi-darker border border-digi-border text-digi-muted cursor-not-allowed',
          )}
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {dirty ? 'Guardar cambios' : 'Guardado'}
        </button>
      </div>

      {/* master — detail */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-4">
        {/* projects list */}
        <aside className="bg-digi-card border border-digi-border rounded-xl overflow-hidden flex flex-col min-h-0">
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-digi-border shrink-0">
            <span className="text-[12px] font-semibold text-digi-text uppercase tracking-wide">Proyectos</span>
            <CountChip n={structures.length} />
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 min-h-0">
            {structures.length === 0 && (
              <p className="text-[12px] text-digi-muted/60 text-center py-6">Sin proyectos</p>
            )}
            {structures.map(p => {
              const active = p.id === selectedId;
              return (
                <button key={p.id} onClick={() => setSelectedId(p.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors border-l-2',
                    active ? 'bg-accent-light border-accent' : 'border-transparent hover:bg-black/[0.03]',
                  )}>
                  <FolderTree size={15} className={cn('shrink-0', active ? 'text-accent' : 'text-digi-muted')} />
                  <span className="flex-1 min-w-0">
                    <span className={cn('block text-[13px] font-medium truncate', active ? 'text-accent' : 'text-digi-text')}>{p.name}</span>
                    <span className="block text-[10px] text-digi-muted font-mono truncate">{p.agentId}</span>
                  </span>
                  <CountChip n={p.modules.length} />
                </button>
              );
            })}
          </div>
          {availableAgents.length > 0 && (
            <div className="p-2 border-t border-digi-border shrink-0 relative">
              <button onClick={() => setDropdownOpen(v => !v)}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-[12px] font-medium border border-dashed border-digi-border text-digi-muted hover:border-accent hover:text-accent transition-colors">
                <Plus size={14} /> Agregar proyecto
              </button>
              {dropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                  <div className="absolute left-2 right-2 bottom-full mb-1.5 bg-digi-card border border-digi-border rounded-lg p-1.5 z-20 shadow-lg max-h-[280px] overflow-y-auto">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-digi-muted px-2.5 pt-1 pb-1.5">Agentes disponibles</p>
                    {availableAgents.map(([agentId, info]) => (
                      <button key={agentId} onClick={() => { addProject(agentId); setDropdownOpen(false); }}
                        className="flex items-center gap-2 px-2.5 py-2 w-full text-left rounded-md text-[13px] text-digi-text hover:bg-accent-light hover:text-accent transition-colors">
                        <Box size={13} className="shrink-0 text-digi-muted" />
                        <span className="font-medium truncate">{agentId}</span>
                        {info.projectPath && <span className="text-digi-muted/60 ml-auto truncate max-w-[110px] text-[11px]">{info.projectPath.split('/').pop()}</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </aside>

        {/* detail */}
        <section className="min-w-0 min-h-0">
          {selected ? (
            <ProjectDetail
              key={selected.id}
              project={selected}
              agentInfo={agents[selected.agentId]}
              onUpdate={patch => updateProject(selected.id, patch)}
              onRemove={() => removeProject(selected.id)}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center bg-digi-card border border-digi-border rounded-xl py-12">
              <div className="w-12 h-12 rounded-xl bg-black/[0.03] flex items-center justify-center mb-3">
                <FolderTree size={22} className="text-digi-muted" />
              </div>
              <p className="text-sm font-medium text-digi-text">Selecciona un proyecto</p>
              <p className="text-[13px] text-digi-muted mt-1">o agrega uno desde los agentes conectados.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* ────────── Project Detail (full-width tree editor) ────────── */

function ProjectDetail({
  project, agentInfo, onUpdate, onRemove,
}: {
  project: ProjectStructure;
  agentInfo?: { projectPath?: string; port?: number; productionUrl?: string };
  onUpdate: (patch: Partial<ProjectStructure>) => void;
  onRemove: () => void;
}) {
  const [linkCopied, setLinkCopied] = useState(false);
  const appUrl = agentInfo?.productionUrl || (agentInfo?.port ? `http://localhost:${agentInfo.port}` : null);

  const copyPortalLink = () => {
    const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    navigator.clipboard.writeText(`${base}/portal/${project.id}`);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const addModule = () => onUpdate({ modules: [...project.modules, { id: uid(), name: 'Nuevo módulo', sections: [] }] });
  const updateModule = (moduleId: string, patch: Partial<Module>) =>
    onUpdate({ modules: project.modules.map(m => (m.id === moduleId ? { ...m, ...patch } : m)) });
  const removeModule = (moduleId: string) =>
    onUpdate({ modules: project.modules.filter(m => m.id !== moduleId) });

  const iconBtn = 'w-8 h-8 flex items-center justify-center rounded-md text-digi-muted transition-colors shrink-0';

  return (
    <div className="h-full flex flex-col bg-digi-card border border-digi-border rounded-xl overflow-hidden min-h-0">
      {/* header */}
      <div className="px-4 py-3.5 border-b border-digi-border shrink-0">
        <div className="flex items-center gap-2">
          <FolderTree size={18} className="text-accent shrink-0" />
          <InlineText value={project.name} onChange={v => onUpdate({ name: v })} placeholder="Nombre del proyecto" className="flex-1 text-[16px] font-semibold text-digi-text" />
          <button onClick={copyPortalLink} className={cn(iconBtn, linkCopied ? 'text-green-600' : 'hover:text-accent hover:bg-accent-light')} title="Copiar enlace del portal">
            {linkCopied ? <Check size={15} /> : <Link2 size={15} />}
          </button>
          <button onClick={onRemove} className={cn(iconBtn, 'hover:text-red-600 hover:bg-red-50')} title="Eliminar proyecto">
            <Trash2 size={15} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-2 pl-7">
          <span className="text-[11px] text-digi-muted font-mono px-1.5 py-0.5 rounded bg-black/[0.04]">{project.agentId}</span>
          <CountChip n={project.modules.length} suffix={project.modules.length === 1 ? 'módulo' : 'módulos'} />
          {appUrl && (
            <a href={appUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-accent-light border border-accent/20 rounded-md text-[11px] text-accent hover:border-accent/40 transition-colors max-w-[360px]">
              <ExternalLink size={11} className="shrink-0" />
              <span className="truncate">{appUrl}</span>
            </a>
          )}
        </div>
        {agentInfo?.projectPath && (
          <p className="text-[10px] text-digi-muted/60 font-mono truncate mt-1.5 pl-7">{agentInfo.projectPath}</p>
        )}
      </div>

      {/* modules */}
      <div className="flex-1 overflow-y-auto p-3 min-h-0">
        <div className="max-w-3xl mx-auto space-y-2">
          {project.modules.length === 0 && (
            <div className="text-center py-10">
              <div className="w-11 h-11 rounded-lg bg-black/[0.03] flex items-center justify-center mx-auto mb-2"><Box size={20} className="text-digi-muted" /></div>
              <p className="text-[13px] text-digi-muted">Este proyecto no tiene módulos todavía.</p>
            </div>
          )}
          {project.modules.map(mod => (
            <ModuleCard key={mod.id} module={mod} onUpdate={patch => updateModule(mod.id, patch)} onRemove={() => removeModule(mod.id)} />
          ))}
          <button onClick={addModule}
            className="flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium text-digi-muted hover:text-accent hover:bg-accent-light rounded-lg transition-colors w-full justify-center border border-dashed border-digi-border hover:border-accent/40">
            <Plus size={15} /> Agregar módulo
          </button>
        </div>
      </div>
    </div>
  );
}

/* ────────── Module Card ────────── */

function ModuleCard({ module: mod, onUpdate, onRemove }: {
  module: Module; onUpdate: (patch: Partial<Module>) => void; onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const addSection = () => onUpdate({ sections: [...mod.sections, { id: uid(), name: 'Nueva sección', subsections: [] }] });
  const updateSection = (sectionId: string, patch: Partial<Section>) =>
    onUpdate({ sections: mod.sections.map(s => (s.id === sectionId ? { ...s, ...patch } : s)) });
  const removeSection = (sectionId: string) => onUpdate({ sections: mod.sections.filter(s => s.id !== sectionId) });

  return (
    <div className="group/mod rounded-lg border border-digi-border bg-digi-darker overflow-hidden">
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <button onClick={() => setExpanded(!expanded)} className="text-digi-muted hover:text-digi-text shrink-0 transition-colors">
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>
        <Box size={14} className="text-accent shrink-0" />
        <InlineText value={mod.name} onChange={v => onUpdate({ name: v })} placeholder="Nombre del módulo" className="flex-1 text-[13px] font-medium text-digi-text" />
        <CountChip n={mod.sections.length} suffix="sec" />
        <button onClick={onRemove} className="w-6 h-6 flex items-center justify-center rounded text-digi-muted hover:text-red-600 hover:bg-red-50 transition-colors shrink-0 opacity-0 group-hover/mod:opacity-100">
          <Trash2 size={13} />
        </button>
      </div>

      {expanded && (
        <div className="px-2 pb-2.5 pl-8 space-y-1.5 border-t border-digi-border/60 pt-2">
          <InlineText value={mod.description || ''} onChange={v => onUpdate({ description: v || undefined })} placeholder="Descripción del módulo (opcional)" className="w-full text-[11px] text-digi-muted" />
          {mod.sections.map(sec => (
            <SectionCard key={sec.id} section={sec} onUpdate={patch => updateSection(sec.id, patch)} onRemove={() => removeSection(sec.id)} />
          ))}
          <button onClick={addSection}
            className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-digi-muted hover:text-accent hover:bg-accent-light rounded-md transition-colors w-full justify-center border border-dashed border-digi-border/70 hover:border-accent/40">
            <Plus size={11} /> Agregar sección
          </button>
        </div>
      )}
    </div>
  );
}

/* ────────── Section Card ────────── */

function SectionCard({ section: sec, onUpdate, onRemove }: {
  section: Section; onUpdate: (patch: Partial<Section>) => void; onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const addSubsection = () => onUpdate({ subsections: [...sec.subsections, { id: uid(), name: 'Nueva subsección' }] });
  const updateSubsection = (subId: string, patch: Partial<Subsection>) =>
    onUpdate({ subsections: sec.subsections.map(ss => (ss.id === subId ? { ...ss, ...patch } : ss)) });
  const removeSubsection = (subId: string) => onUpdate({ subsections: sec.subsections.filter(ss => ss.id !== subId) });

  return (
    <div className="group/sec rounded-md border border-digi-border/70 bg-digi-card">
      <div className="flex items-center gap-1.5 px-1.5 py-1.5">
        <button onClick={() => setExpanded(!expanded)} className="text-digi-muted hover:text-digi-text shrink-0 transition-colors">
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        <Layers size={12} className="text-digi-muted shrink-0" />
        <InlineText value={sec.name} onChange={v => onUpdate({ name: v })} placeholder="Nombre de la sección" className="flex-1 text-[12px] text-digi-text" />
        <CountChip n={sec.subsections.length} />
        <button onClick={onRemove} className="w-6 h-6 flex items-center justify-center rounded text-digi-muted hover:text-red-600 hover:bg-red-50 transition-colors shrink-0 opacity-0 group-hover/sec:opacity-100">
          <Trash2 size={12} />
        </button>
      </div>

      {expanded && (
        <div className="px-1.5 pb-2 pl-7 space-y-1 border-t border-digi-border/50 pt-1.5">
          <InlineText value={sec.description || ''} onChange={v => onUpdate({ description: v || undefined })} placeholder="Descripción de la sección (opcional)" className="w-full text-[10px] text-digi-muted" />
          {sec.subsections.map(sub => (
            <div key={sub.id} className="group/sub flex items-center gap-1.5 pl-1.5 rounded border border-transparent hover:border-digi-border/50 hover:bg-black/[0.02] transition-colors">
              <FileText size={11} className="text-digi-muted/70 shrink-0" />
              <InlineText value={sub.name} onChange={v => updateSubsection(sub.id, { name: v })} placeholder="Subsección" className="flex-1 text-[11px] text-digi-text" />
              <button onClick={() => removeSubsection(sub.id)} className="w-5 h-5 flex items-center justify-center rounded text-digi-muted hover:text-red-600 hover:bg-red-50 transition-colors shrink-0 opacity-0 group-hover/sub:opacity-100">
                <Trash2 size={11} />
              </button>
            </div>
          ))}
          <button onClick={addSubsection}
            className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium text-digi-muted hover:text-accent hover:bg-accent-light rounded transition-colors w-full justify-center border border-dashed border-digi-border/50 hover:border-accent/40">
            <Plus size={10} /> Agregar subsección
          </button>
        </div>
      )}
    </div>
  );
}

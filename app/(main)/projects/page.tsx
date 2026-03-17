'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Trash2, ChevronRight, ChevronDown,
  FolderTree, Box, Layers, FileText,
  Save, Loader2, Link2, Check, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  ProjectStructure, Module, Section, Subsection,
} from '@/types/projects';

/* ────────── helpers ────────── */

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

type AgentInfo = Record<string, { projectPath?: string; port?: number; productionUrl?: string }>;

/* ────────── page ────────── */

export default function ProjectsPage() {
  const [structures, setStructures] = useState<ProjectStructure[]>([]);
  const [agents, setAgents] = useState<AgentInfo>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/project-structures').then(r => r.json()),
      fetch('/api/agent-links').then(r => r.json()),
    ]).then(([structs, agentData]) => {
      setStructures(structs);
      setAgents(agentData);
      setLoaded(true);
    });
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    await fetch('/api/project-structures', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(structures),
    });
    setSaving(false);
    setDirty(false);
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
    update(draft => [
      ...draft,
      { id: uid(), agentId, name: agentName, modules: [] },
    ]);
  };

  const removeProject = (id: string) => {
    update(draft => draft.filter(p => p.id !== id));
  };

  const updateProject = (id: string, patch: Partial<ProjectStructure>) => {
    update(draft =>
      draft.map(p => (p.id === id ? { ...p, ...patch } : p)),
    );
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-64 text-digi-muted">
        <Loader2 className="animate-spin mr-2" size={18} />
        Cargando...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h2 className="font-pixel text-lg text-digi-green">Proyectos</h2>
          <p className="text-sm text-digi-muted mt-1">
            Estructura de módulos, secciones y subsecciones por proyecto
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* add project dropdown */}
          {availableAgents.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(v => !v)}
                className="flex items-center gap-2 px-3 py-2 rounded text-xs font-medium bg-digi-card border border-digi-border text-digi-muted hover:text-digi-green hover:border-digi-green/30 transition-colors"
              >
                <Plus size={14} />
                Agregar proyecto
              </button>
              {dropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 bg-digi-dark border border-digi-border rounded-lg p-2 min-w-[220px] z-20 shadow-xl">
                    {availableAgents.map(([agentId, info]) => (
                      <button
                        key={agentId}
                        onClick={() => { addProject(agentId); setDropdownOpen(false); }}
                        className="flex items-center gap-2 px-3 py-2 w-full text-left rounded text-xs text-digi-muted hover:text-digi-green hover:bg-digi-green/10 transition-colors"
                      >
                        <Plus size={10} />
                        <span className="font-medium">{agentId}</span>
                        {info.projectPath && (
                          <span className="text-digi-muted/60 ml-auto truncate max-w-[120px]">
                            {info.projectPath.split('/').pop()}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          <button
            onClick={save}
            disabled={!dirty || saving}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded text-xs font-medium transition-colors',
              dirty
                ? 'bg-digi-green/20 border border-digi-green/40 text-digi-green hover:bg-digi-green/30'
                : 'bg-digi-card border border-digi-border text-digi-muted cursor-not-allowed',
            )}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar
          </button>
        </div>
      </div>

      {/* planner columns */}
      {structures.length === 0 ? (
        <div className="text-center py-12 text-digi-muted text-sm">
          No hay proyectos configurados. Agrega uno desde los agentes conectados.
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden pb-2">
          <div className="flex gap-4 h-full" style={{ minWidth: structures.length * 320 }}>
            {structures.map(project => (
              <ProjectColumn
                key={project.id}
                project={project}
                agentInfo={agents[project.agentId]}
                onUpdate={patch => updateProject(project.id, patch)}
                onRemove={() => removeProject(project.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────── Project Column ────────── */

function ProjectColumn({
  project,
  agentInfo,
  onUpdate,
  onRemove,
}: {
  project: ProjectStructure;
  agentInfo?: { projectPath?: string; port?: number; productionUrl?: string };
  onUpdate: (patch: Partial<ProjectStructure>) => void;
  onRemove: () => void;
}) {
  const [linkCopied, setLinkCopied] = useState(false);
  const appUrl = agentInfo?.productionUrl || (agentInfo?.port ? `http://localhost:${agentInfo.port}` : null);

  const copyPortalLink = () => {
    const url = `${window.location.origin}/portal/${project.id}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const addModule = () => {
    onUpdate({
      modules: [
        ...project.modules,
        { id: uid(), name: 'Nuevo módulo', sections: [] },
      ],
    });
  };

  const updateModule = (moduleId: string, patch: Partial<Module>) => {
    onUpdate({
      modules: project.modules.map(m =>
        m.id === moduleId ? { ...m, ...patch } : m,
      ),
    });
  };

  const removeModule = (moduleId: string) => {
    onUpdate({
      modules: project.modules.filter(m => m.id !== moduleId),
    });
  };

  return (
    <div className="w-[320px] shrink-0 flex flex-col bg-digi-card border border-digi-border rounded-lg overflow-hidden h-full">
      {/* column header */}
      <div className="px-4 py-3 border-b border-digi-border shrink-0">
        <div className="flex items-center gap-2">
          <FolderTree size={14} className="text-digi-green shrink-0" />
          <input
            value={project.name}
            onChange={e => onUpdate({ name: e.target.value })}
            className="flex-1 bg-transparent text-sm font-pixel text-digi-green border-none outline-none placeholder:text-digi-muted min-w-0"
            placeholder="Nombre del proyecto"
          />
          <button
            onClick={copyPortalLink}
            className={cn(
              'shrink-0 transition-colors',
              linkCopied ? 'text-green-400' : 'text-digi-muted hover:text-blue-400',
            )}
            title="Copiar enlace del portal"
          >
            {linkCopied ? <Check size={13} /> : <Link2 size={13} />}
          </button>
          <button
            onClick={onRemove}
            className="text-digi-muted hover:text-red-400 transition-colors shrink-0"
          >
            <Trash2 size={13} />
          </button>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-digi-muted font-mono">{project.agentId}</span>
          <span className="text-[10px] text-digi-muted">{project.modules.length} módulos</span>
        </div>
        {appUrl && (
          <a
            href={appUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 mt-2 px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] text-blue-400 hover:bg-blue-500/20 transition-colors truncate"
          >
            <ExternalLink size={10} className="shrink-0" />
            <span className="truncate">{appUrl}</span>
          </a>
        )}
        {agentInfo?.projectPath && (
          <p className="text-[9px] text-digi-muted/60 font-mono truncate mt-1">
            {agentInfo.projectPath}
          </p>
        )}
      </div>

      {/* scrollable module list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {project.modules.length === 0 && (
          <p className="text-xs text-digi-muted/50 text-center py-4">Sin módulos</p>
        )}

        {project.modules.map(mod => (
          <ModuleCard
            key={mod.id}
            module={mod}
            onUpdate={patch => updateModule(mod.id, patch)}
            onRemove={() => removeModule(mod.id)}
          />
        ))}
      </div>

      {/* add module footer */}
      <div className="p-2 border-t border-digi-border shrink-0">
        <button
          onClick={addModule}
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-digi-muted hover:text-digi-green hover:bg-digi-green/10 rounded transition-colors w-full justify-center"
        >
          <Plus size={12} /> Agregar módulo
        </button>
      </div>
    </div>
  );
}

/* ────────── Module Card ────────── */

function ModuleCard({
  module: mod,
  onUpdate,
  onRemove,
}: {
  module: Module;
  onUpdate: (patch: Partial<Module>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const addSection = () => {
    onUpdate({
      sections: [
        ...mod.sections,
        { id: uid(), name: 'Nueva sección', subsections: [] },
      ],
    });
  };

  const updateSection = (sectionId: string, patch: Partial<Section>) => {
    onUpdate({
      sections: mod.sections.map(s =>
        s.id === sectionId ? { ...s, ...patch } : s,
      ),
    });
  };

  const removeSection = (sectionId: string) => {
    onUpdate({
      sections: mod.sections.filter(s => s.id !== sectionId),
    });
  };

  return (
    <div className="bg-digi-darker border border-digi-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2">
        <button onClick={() => setExpanded(!expanded)} className="text-digi-muted hover:text-digi-text">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <Box size={14} className="text-blue-400 shrink-0" />
        <input
          value={mod.name}
          onChange={e => onUpdate({ name: e.target.value })}
          className="flex-1 bg-transparent text-xs font-medium text-digi-text border-none outline-none placeholder:text-digi-muted min-w-0"
          placeholder="Nombre del módulo"
        />
        <span className="text-[10px] text-digi-muted shrink-0">
          {mod.sections.length}s
        </span>
        <button onClick={onRemove} className="text-digi-muted hover:text-red-400 transition-colors shrink-0">
          <Trash2 size={12} />
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pl-7 space-y-2">
          <input
            value={mod.description || ''}
            onChange={e => onUpdate({ description: e.target.value || undefined })}
            className="w-full bg-transparent text-[11px] text-digi-muted border-none outline-none placeholder:text-digi-muted/50"
            placeholder="Descripción del módulo (opcional)"
          />

          {mod.sections.map(sec => (
            <SectionCard
              key={sec.id}
              section={sec}
              onUpdate={patch => updateSection(sec.id, patch)}
              onRemove={() => removeSection(sec.id)}
            />
          ))}

          <button
            onClick={addSection}
            className="flex items-center gap-2 px-2 py-1 text-[11px] text-digi-muted hover:text-blue-400 hover:bg-blue-400/10 rounded transition-colors w-full justify-center border border-dashed border-digi-border/50 hover:border-blue-400/30"
          >
            <Plus size={10} /> Agregar sección
          </button>
        </div>
      )}
    </div>
  );
}

/* ────────── Section Card ────────── */

function SectionCard({
  section: sec,
  onUpdate,
  onRemove,
}: {
  section: Section;
  onUpdate: (patch: Partial<Section>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const addSubsection = () => {
    onUpdate({
      subsections: [
        ...sec.subsections,
        { id: uid(), name: 'Nueva subsección' },
      ],
    });
  };

  const updateSubsection = (subId: string, patch: Partial<Subsection>) => {
    onUpdate({
      subsections: sec.subsections.map(ss =>
        ss.id === subId ? { ...ss, ...patch } : ss,
      ),
    });
  };

  const removeSubsection = (subId: string) => {
    onUpdate({
      subsections: sec.subsections.filter(ss => ss.id !== subId),
    });
  };

  return (
    <div className="bg-digi-card/50 border border-digi-border/50 rounded">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <button onClick={() => setExpanded(!expanded)} className="text-digi-muted hover:text-digi-text">
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        <Layers size={12} className="text-purple-400 shrink-0" />
        <input
          value={sec.name}
          onChange={e => onUpdate({ name: e.target.value })}
          className="flex-1 bg-transparent text-[11px] text-digi-text border-none outline-none placeholder:text-digi-muted min-w-0"
          placeholder="Nombre de la sección"
        />
        <span className="text-[10px] text-digi-muted shrink-0">
          {sec.subsections.length}ss
        </span>
        <button onClick={onRemove} className="text-digi-muted hover:text-red-400 transition-colors shrink-0">
          <Trash2 size={11} />
        </button>
      </div>

      {expanded && (
        <div className="px-2 pb-2 pl-6 space-y-1.5">
          <input
            value={sec.description || ''}
            onChange={e => onUpdate({ description: e.target.value || undefined })}
            className="w-full bg-transparent text-[10px] text-digi-muted border-none outline-none placeholder:text-digi-muted/50"
            placeholder="Descripción de la sección (opcional)"
          />

          {sec.subsections.map(sub => (
            <div key={sub.id} className="flex items-center gap-2 px-2 py-1 bg-digi-darker/50 rounded border border-digi-border/30">
              <FileText size={10} className="text-amber-400 shrink-0" />
              <input
                value={sub.name}
                onChange={e => updateSubsection(sub.id, { name: e.target.value })}
                className="flex-1 bg-transparent text-[11px] text-digi-text border-none outline-none placeholder:text-digi-muted min-w-0"
                placeholder="Subsección"
              />
              <button
                onClick={() => removeSubsection(sub.id)}
                className="text-digi-muted hover:text-red-400 transition-colors shrink-0"
              >
                <Trash2 size={10} />
              </button>
            </div>
          ))}

          <button
            onClick={addSubsection}
            className="flex items-center gap-2 px-2 py-1 text-[10px] text-digi-muted hover:text-amber-400 hover:bg-amber-400/10 rounded transition-colors w-full justify-center border border-dashed border-digi-border/30 hover:border-amber-400/30"
          >
            <Plus size={9} /> Agregar subsección
          </button>
        </div>
      )}
    </div>
  );
}

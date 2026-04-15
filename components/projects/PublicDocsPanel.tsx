'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import type { ChatBlock } from '@/components/world/ChatPanel';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;

interface PublicDocsPanelProps {
  projectId: string | number;
  agentId: string;
  agentName: string;
  projectPath: string;
  projectTitle: string;
  projectDescription?: string;
  projectImages: string[];
  onClose: () => void;
  onSaved: (token: string) => void;
}

let blockCounter = 0;
function newId() { return `pd-${Date.now()}-${blockCounter++}`; }

interface Bi { es: string; en: string }

interface PublicDocsSection {
  imageIndex: number;
  title: Bi;
  narrative: Bi;
}

interface HighlightItem {
  label: Bi;
  value: Bi;
}

interface TechItem {
  name: string;
  category?: string;
  description?: Bi;
}

interface PublicDocsData {
  hero: {
    title: Bi;
    subtitle: Bi;
  };
  highlights?: HighlightItem[];
  sections: PublicDocsSection[];
  techStack?: {
    title: Bi;
    items: TechItem[];
  };
}

const DOCS_START = '---DOCS_JSON_INICIO---';
const DOCS_END = '---DOCS_JSON_FIN---';

function tryExtractDocs(text: string): PublicDocsData | null {
  const start = text.indexOf(DOCS_START);
  const end = text.indexOf(DOCS_END);
  if (start === -1 || end === -1 || end <= start) return null;
  let jsonStr = text.substring(start + DOCS_START.length, end).trim();
  const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) jsonStr = fence[1].trim();
  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed?.hero || !Array.isArray(parsed?.sections)) return null;
    return parsed as PublicDocsData;
  } catch { return null; }
}

export default function PublicDocsPanel({
  projectId, agentId, agentName, projectPath,
  projectTitle, projectDescription, projectImages,
  onClose, onSaved,
}: PublicDocsPanelProps) {
  const docsAgentId = `publicdocs-${agentId}`;
  const projectSessionKey = `project-${projectId}`;

  const [blocks, setBlocks] = useState<ChatBlock[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extractedDocs, setExtractedDocs] = useState<PublicDocsData | null>(null);
  const [savedToken, setSavedToken] = useState<string | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editSections, setEditSections] = useState<PublicDocsSection[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const runIdRef = useRef<string | null>(null);
  const streamingRef = useRef(false);
  const textStateRef = useRef({ currentTextBlockId: null as string | null, accumulatedText: '' });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/public-docs`);
        if (res.ok) {
          const { data } = await res.json();
          if (data?.public_docs_token) setSavedToken(data.public_docs_token);
          if (data?.public_docs) setExtractedDocs(data.public_docs);
        }
      } catch {}
      finally { setLoadingExisting(false); }
    })();
  }, [projectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [blocks]);

  const readSSEStream = useCallback(async (reader: ReadableStreamDefaultReader<Uint8Array>) => {
    const decoder = new TextDecoder();
    let buffer = '';
    const ts = textStateRef.current;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') { runIdRef.current = null; continue; }

        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'run_id') { runIdRef.current = parsed.runId; continue; }

          switch (parsed.type) {
            case 'thinking':
              setBlocks(prev => [...prev, { id: newId(), type: 'thinking', content: parsed.text, collapsed: true }]);
              ts.currentTextBlockId = null;
              break;
            case 'tool_use':
              setBlocks(prev => [...prev, {
                id: newId(), type: 'tool_use',
                content: parsed.tool === 'Bash' ? parsed.input?.command || '' : JSON.stringify(parsed.input || {}).slice(0, 80),
                tool: parsed.tool, input: parsed.input,
              }]);
              ts.currentTextBlockId = null;
              break;
            case 'tool_result':
              setBlocks(prev => [...prev, { id: newId(), type: 'tool_result', content: parsed.result || '(empty)', collapsed: true }]);
              ts.currentTextBlockId = null;
              break;
            case 'text': {
              if (ts.currentTextBlockId) {
                ts.accumulatedText += parsed.text;
                const capturedText = ts.accumulatedText;
                const capturedId = ts.currentTextBlockId;
                setBlocks(prev => prev.map(b => b.id === capturedId ? { ...b, content: capturedText } : b));
              } else {
                ts.accumulatedText = parsed.text;
                const id = newId();
                ts.currentTextBlockId = id;
                setBlocks(prev => [...prev, { id, type: 'text', content: parsed.text }]);
              }
              break;
            }
            case 'error':
              setBlocks(prev => [...prev, { id: newId(), type: 'error', content: parsed.text }]);
              ts.currentTextBlockId = null;
              break;
            case 'result':
              setBlocks(prev => [...prev, { id: newId(), type: 'result', content: '', cost: parsed.cost, duration: parsed.duration, turns: parsed.turns }]);
              ts.currentTextBlockId = null;
              break;
          }
        } catch {}
      }
    }
    setStreaming(false);
    streamingRef.current = false;
  }, []);

  // Auto-extract + auto-save once a result block arrives
  useEffect(() => {
    if (extractedDocs || streaming) return;
    for (let i = blocks.length - 1; i >= 0; i--) {
      if (blocks[i].type !== 'text') continue;
      const docs = tryExtractDocs(blocks[i].content);
      if (docs) {
        setExtractedDocs(docs);
        saveDocs(docs);
        break;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, streaming]);

  const sendMessage = useCallback(async (message: string) => {
    if (streamingRef.current) return;
    setBlocks(prev => [...prev, { id: newId(), type: 'user', content: 'Generar documentacion publica...' }]);
    setStreaming(true);
    streamingRef.current = true;
    textStateRef.current = { currentTextBlockId: null, accumulatedText: '' };

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: docsAgentId,
          agentName: `${agentName} (Public Docs)`,
          message,
          projectPath,
          sessionKey: projectSessionKey,
        }),
      });
      if (!res.ok || !res.body) {
        setBlocks(prev => [...prev, { id: newId(), type: 'error', content: 'Error conectando con Claude CLI' }]);
        setStreaming(false);
        streamingRef.current = false;
        return;
      }
      await readSSEStream(res.body.getReader());
    } catch (err: any) {
      setBlocks(prev => [...prev, { id: newId(), type: 'error', content: err.message }]);
      setStreaming(false);
      streamingRef.current = false;
    }
  }, [docsAgentId, projectSessionKey, agentName, projectPath, readSSEStream]);

  const startGeneration = () => {
    setExtractedDocs(null);

    const imagesBlock = projectImages.length > 0
      ? projectImages.map((_, i) => `  - IMAGEN ${i}`).join('\n')
      : '  (sin imagenes)';

    const lastIdx = Math.max(0, projectImages.length - 1);

    const prompt = `IMPORTANTE: NO uses herramientas de escritura (Write, Edit). NO crees archivos. Tu UNICA respuesta debe ser una explicacion breve seguida de un bloque JSON bilingue.

OBJETIVO: Generar documentacion PUBLICA bilingue (es/en) del proyecto, para publicar en el marketplace como caso de estudio. Debe contar la solucion REAL (no inventada) sin filtrar informacion interna, sensible o del negocio del cliente.

FASE 1 — INVESTIGACION OBLIGATORIA (antes de escribir NADA):
Tu proyecto esta UNICAMENTE en: ${projectPath}
Haz lo siguiente, en este orden, SIN saltarte pasos:
1. Lista la estructura: usa Glob con patrones como "${projectPath}/**/package.json", "${projectPath}/**/README*", "${projectPath}/app/**/page.tsx", "${projectPath}/src/**/*.ts*", "${projectPath}/pages/**/*.tsx". Ajusta segun lo que encuentres (puede NO ser un proyecto tecnologico).
2. Lee el README principal si existe.
3. Lee package.json (si existe) para identificar dependencias REALES (framework, DB, UI lib, integraciones). NO inventes tecnologias.
4. Explora las paginas/rutas principales para entender features REALES que existen en codigo. Lee 3-8 archivos clave.
5. Si NO es un proyecto de software (ej. documentacion, diseno, consultoria, marketing), explora los archivos existentes (.md, .pdf, assets, configs) para entender de que trata.
PROHIBIDO: acceder fuera de "${projectPath}", usar ".." en rutas, leer archivos de otros clientes.

REGLAS ANTI-ALUCINACION (CRITICAS):
- SOLO puedes describir features, pantallas, flujos o capacidades que hayas verificado leyendo archivos reales del proyecto.
- Cada afirmacion de la narrativa debe poder trazarse a un archivo concreto que leiste. Si no puedes trazarla, NO la escribas.
- Si dudas si algo existe, OMITELO. Es mejor una doc corta y verdadera que una larga con invenciones.
- PROHIBIDO mencionar funcionalidades genericas que "podrian existir" (ej. "permite detectar inconsistencias en fechas de despacho" si nunca leiste codigo que haga eso).
- PROHIBIDO inventar entidades del dominio, campos, reglas de negocio, metricas, integraciones o flujos que no viste en codigo.
- En "techStack.items" SOLO lista tecnologias presentes en package.json / imports reales / configs reales. Si no hay archivos tecnicos (proyecto no-tech), omite techStack entero.

REGLAS DE SANITIZACION:
1. NO menciones nombres reales de clientes, empresas, marcas, personas, dominios ni URLs internas.
2. NO expongas: credenciales, tokens, endpoints internos, rutas de archivos, schema de base de datos, precios internos, contactos, direcciones, emails.
3. Reemplaza entidades reales por nombres FICTICIOS genericos coherentes entre secciones (ej. "una empresa del sector retail", "el equipo de operaciones", "la plataforma").
4. Explica QUE hace y QUE valor aporta, NO el COMO interno (no queries, no nombres de tablas, no endpoints).
5. NO uses acentos ni caracteres especiales en los textos.
6. Tono profesional, claro, orientado a mostrar capacidades.

DATOS DEL PROYECTO (contexto solamente, NO copies literal):
- Titulo interno: ${projectTitle}
${projectDescription ? `- Descripcion interna: ${projectDescription.slice(0, 500)}` : ''}
- Imagenes disponibles (indices 0..${lastIdx}):
${imagesBlock}

INSTRUCCIONES PARA LAS SECCIONES NARRATIVAS:
- Crea UNA seccion por imagen disponible, en el mismo orden inicial (indices 0, 1, 2...). El admin podra reordenar despues.
- Cada seccion describe lo que REALMENTE representa esa imagen basandote en los features que verificaste en codigo.
- Si no hay imagenes, deja "sections" como array vacio y concentra la narrativa en hero + highlights.

INSTRUCCIONES PARA HIGHLIGHTS (opcional pero recomendado):
- Lista entre 3 y 6 datos rapidos del proyecto: tipo de solucion, industria/sector, idioma(s), plataforma (web/mobile/desktop/fisico), duracion estimada, tamano de equipo, categoria, etc.
- Usa lo que sea RELEVANTE para este proyecto — no fuerces campos irrelevantes.
- Funciona para cualquier tipo de proyecto (software, diseno, consultoria, marketing, etc).

INSTRUCCIONES PARA TECHSTACK (opcional, SOLO si es proyecto tecnologico):
- Incluye ESTE bloque unicamente si encontraste package.json, dependencias reales, o archivos de codigo.
- Lista 5-15 herramientas/tecnologias/frameworks que VERIFICASTE en el proyecto (imports, package.json, configs).
- Agrupa por categoria libre: "Frontend", "Backend", "Base de datos", "Infraestructura", "Integraciones", "Diseno", etc.
- Si el proyecto NO es tecnologico, OMITE el campo techStack completamente del JSON.

FORMATO DE RESPUESTA (OBLIGATORIO):
Primero una breve intro (1-2 lineas) describiendo que exploraste, luego el JSON EXACTAMENTE entre marcadores:

${DOCS_START}
{
  "hero": {
    "title": { "es": "...", "en": "..." },
    "subtitle": { "es": "...", "en": "..." }
  },
  "highlights": [
    { "label": { "es": "Tipo", "en": "Type" }, "value": { "es": "...", "en": "..." } },
    { "label": { "es": "Sector", "en": "Industry" }, "value": { "es": "...", "en": "..." } },
    { "label": { "es": "Plataforma", "en": "Platform" }, "value": { "es": "...", "en": "..." } }
  ],
  "sections": [
    {
      "imageIndex": 0,
      "title": { "es": "...", "en": "..." },
      "narrative": { "es": "parrafo verificado en codigo, sin invenciones", "en": "paragraph grounded in real code, no invention" }
    }
  ],
  "techStack": {
    "title": { "es": "Herramientas y tecnologias", "en": "Tools and technologies" },
    "items": [
      { "name": "Next.js", "category": "Frontend", "description": { "es": "...", "en": "..." } }
    ]
  }
}
${DOCS_END}

REGLAS DEL JSON:
- JSON VALIDO (comillas dobles, sin comas colgantes, sin comentarios, sin markdown).
- "imageIndex" es entero 0..${lastIdx}.
- Cada "narrative" entre 60 y 180 palabras, con afirmaciones trazables a archivos leidos.
- "hero.title" debe ser nombre comercial generico/ficticio (NO el titulo interno).
- Ambos idiomas OBLIGATORIOS en todos los campos bilingues.
- "highlights" y "techStack" son OPCIONALES: omitelos si no aplican al proyecto.

Recuerda: vale mas una doc corta y verificada que una larga con invenciones. Si solo pudiste verificar 2 features reales, escribe solo 2 secciones narrativas — no rellenes con contenido generico.`;

    sendMessage(prompt);
  };

  const saveDocs = async (docs: PublicDocsData) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/public-docs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_docs: docs }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      const { token } = await res.json();
      setSavedToken(token);
      toast.success('Documentacion publica publicada');
      onSaved(token);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const openEditMode = () => {
    if (!extractedDocs) return;
    setEditSections(extractedDocs.sections.map(s => ({ ...s })));
    setEditMode(true);
  };

  const updateSectionImage = (idx: number, newImageIndex: number) => {
    setEditSections(prev => prev.map((s, i) => i === idx ? { ...s, imageIndex: newImageIndex } : s));
  };

  const moveSection = (idx: number, dir: -1 | 1) => {
    setEditSections(prev => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const deleteSection = (idx: number) => {
    setEditSections(prev => prev.filter((_, i) => i !== idx));
  };

  const saveEdits = async () => {
    if (!extractedDocs) return;
    const updated: PublicDocsData = { ...extractedDocs, sections: editSections };
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/public-docs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_docs: updated }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      const { token } = await res.json();
      setExtractedDocs(updated);
      setSavedToken(token);
      setEditMode(false);
      toast.success('Cambios guardados');
      onSaved(token);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const cancelEdits = () => {
    setEditMode(false);
    setEditSections([]);
  };

  const revokeDocs = async () => {
    if (!confirm('Revocar la documentacion publica? El enlace dejara de funcionar.')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/public-docs`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setSavedToken(null);
      toast.success('Documentacion revocada');
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const publicBase = process.env.NEXT_PUBLIC_BASE_URL || 'https://app.grupocc.org';
  const publicUrl = savedToken ? `${publicBase}/docs/${savedToken}` : null;

  const copyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success('Enlace copiado');
    } catch { toast.error('No se pudo copiar'); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-digi-card border-2 border-digi-border flex flex-col mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-digi-border bg-digi-darker">
          <div>
            <h3 className="text-[11px] text-accent-glow" style={pf}>Documentacion Publica</h3>
            <p className="text-[9px] text-digi-muted" style={mf}>{projectTitle}</p>
          </div>
          <button onClick={onClose} className="text-digi-muted hover:text-white transition-colors px-2 py-1 text-[10px]" style={pf}>X</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
          {editMode ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between sticky top-0 bg-digi-card py-2 z-10">
                <h4 className="text-[10px] text-accent-glow" style={pf}>Editar Secciones</h4>
                <div className="flex gap-1">
                  <button onClick={cancelEdits} disabled={saving} className="px-2 py-1 text-[8px] text-digi-muted border border-digi-border hover:text-white transition-colors disabled:opacity-40" style={pf}>
                    Cancelar
                  </button>
                  <button onClick={saveEdits} disabled={saving} className="px-2 py-1 text-[8px] text-green-400 border border-green-700/50 hover:bg-green-900/20 transition-colors disabled:opacity-40" style={pf}>
                    {saving ? '...' : 'Guardar'}
                  </button>
                </div>
              </div>
              <p className="text-[9px] text-digi-muted" style={mf}>
                Reasigna la imagen de cada seccion y reordena con las flechas. El texto no cambia — usa Regenerar si quieres nueva narrativa.
              </p>
              {editSections.length === 0 && (
                <p className="text-[9px] text-yellow-400/70 text-center py-4" style={mf}>Sin secciones. Elimina todo o cancela.</p>
              )}
              {editSections.map((section, idx) => {
                const imgUrl = projectImages[section.imageIndex] || projectImages[0];
                return (
                  <div key={idx} className="border border-digi-border bg-digi-darker p-2 space-y-2">
                    <div className="flex items-start gap-2">
                      {imgUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imgUrl} alt="" className="w-20 h-20 object-cover border border-digi-border/50 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-1">
                          <span className="text-[8px] text-accent-glow" style={pf}>#{String(idx + 1).padStart(2, '0')}</span>
                          <span className="text-[9px] text-digi-text truncate" style={mf}>{section.title.es}</span>
                        </div>
                        <p className="text-[8px] text-digi-muted line-clamp-2" style={mf}>{section.narrative.es}</p>
                        <div className="flex items-center gap-1">
                          <label className="text-[8px] text-digi-muted" style={mf}>Imagen:</label>
                          <select
                            value={section.imageIndex}
                            onChange={(e) => updateSectionImage(idx, Number(e.target.value))}
                            className="flex-1 px-1 py-0.5 bg-digi-card border border-digi-border text-[9px] text-digi-text focus:border-accent focus:outline-none"
                            style={mf}
                          >
                            {projectImages.map((_, i) => (
                              <option key={i} value={i}>Imagen {i + 1}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => moveSection(idx, -1)}
                        disabled={idx === 0}
                        className="px-2 py-0.5 text-[8px] text-digi-muted border border-digi-border/50 hover:text-white hover:border-accent transition-colors disabled:opacity-30"
                        style={pf}
                        title="Subir"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveSection(idx, 1)}
                        disabled={idx === editSections.length - 1}
                        className="px-2 py-0.5 text-[8px] text-digi-muted border border-digi-border/50 hover:text-white hover:border-accent transition-colors disabled:opacity-30"
                        style={pf}
                        title="Bajar"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => deleteSection(idx)}
                        className="px-2 py-0.5 text-[8px] text-red-400 border border-red-700/50 hover:bg-red-900/20 transition-colors"
                        style={pf}
                        title="Eliminar"
                      >
                        X
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : loadingExisting ? (
            <p className="text-[9px] text-digi-muted text-center py-8" style={mf}>Cargando...</p>
          ) : (
            <>
              {blocks.length === 0 && !savedToken && (
                <div className="text-center py-8 space-y-3">
                  <p className="text-[9px] text-digi-muted" style={mf}>
                    Claude CLI usara el contexto ya acumulado en la sesion del proyecto para generar documentacion publica bilingue (ES/EN), sanitizada y lista para marketplace.
                  </p>
                  <p className="text-[9px] text-digi-muted" style={mf}>
                    Imagenes disponibles: {projectImages.length}
                  </p>
                  <button
                    onClick={startGeneration}
                    disabled={projectImages.length === 0}
                    className="px-4 py-2 text-[9px] text-accent-glow border border-accent/40 hover:bg-accent/10 transition-colors disabled:opacity-40"
                    style={pf}
                  >
                    Generar y Publicar
                  </button>
                  {projectImages.length === 0 && (
                    <p className="text-[8px] text-yellow-400/70" style={mf}>Sube imagenes al proyecto antes de generar</p>
                  )}
                </div>
              )}

              {blocks.map(b => (
                <div key={b.id} className={`text-[9px] px-2 py-1 ${
                  b.type === 'user' ? 'bg-accent/10 border-l-2 border-accent text-digi-text' :
                  b.type === 'thinking' ? 'text-digi-muted/50 italic cursor-pointer' :
                  b.type === 'tool_use' ? 'text-yellow-400/70 border-l border-yellow-500/30 pl-2' :
                  b.type === 'tool_result' ? 'text-digi-muted/40 cursor-pointer' :
                  b.type === 'error' ? 'text-red-400 border-l-2 border-red-500' :
                  b.type === 'result' ? 'text-green-400/70 border-t border-digi-border/30 pt-1' :
                  'text-digi-text'
                }`} style={mf}
                  onClick={() => {
                    if (b.type === 'thinking' || b.type === 'tool_result') {
                      setBlocks(prev => prev.map(x => x.id === b.id ? { ...x, collapsed: !x.collapsed } : x));
                    }
                  }}
                >
                  {b.type === 'thinking' && <span className="text-[8px] text-digi-muted" style={pf}>[thinking] </span>}
                  {b.type === 'tool_use' && <span className="text-[8px] text-yellow-400" style={pf}>[{b.tool}] </span>}
                  {b.type === 'result' ? (
                    <span>Completado{b.cost ? ` — $${b.cost}` : ''}{b.duration ? ` — ${b.duration}` : ''}</span>
                  ) : (
                    <span className={b.collapsed ? 'line-clamp-1' : 'whitespace-pre-wrap'}>{b.content}</span>
                  )}
                </div>
              ))}

              {streaming && (
                <div className="flex items-center gap-2 px-2 py-1">
                  <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
                  <span className="text-[8px] text-digi-muted" style={mf}>Generando documentacion...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {savedToken && publicUrl && (
          <div className="border-t-2 border-digi-border px-4 py-3 bg-digi-darker space-y-2">
            <h4 className="text-[9px] text-green-400" style={pf}>Publicada</h4>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={publicUrl}
                className="flex-1 px-2 py-1.5 bg-digi-card border border-digi-border text-[9px] text-digi-text focus:outline-none"
                style={mf}
                onFocus={(e) => e.currentTarget.select()}
              />
              <button onClick={copyLink} className="px-2 py-1.5 text-[8px] text-accent-glow border border-accent/40 hover:bg-accent/10 transition-colors" style={pf}>
                Copiar
              </button>
              <a href={publicUrl} target="_blank" rel="noreferrer" className="px-2 py-1.5 text-[8px] text-green-400 border border-green-700/50 hover:bg-green-900/20 transition-colors" style={pf}>
                Abrir
              </a>
            </div>
            <div className="flex gap-2 justify-between items-center">
              <div className="flex gap-1">
                <button
                  onClick={startGeneration}
                  disabled={streaming || saving || editMode}
                  className="px-2 py-1 text-[8px] text-accent-glow border border-accent/40 hover:bg-accent/10 transition-colors disabled:opacity-40"
                  style={pf}
                >
                  Regenerar
                </button>
                <button
                  onClick={openEditMode}
                  disabled={streaming || saving || editMode || !extractedDocs}
                  className="px-2 py-1 text-[8px] text-purple-400 border border-purple-500/40 hover:bg-purple-900/20 transition-colors disabled:opacity-40"
                  style={pf}
                >
                  Editar Imagenes
                </button>
              </div>
              <button
                onClick={revokeDocs}
                disabled={saving || editMode}
                className="px-2 py-1 text-[8px] text-red-400 border border-red-700/50 hover:bg-red-900/20 transition-colors disabled:opacity-40"
                style={pf}
              >
                Revocar
              </button>
            </div>
            {saving && <p className="text-[8px] text-digi-muted" style={mf}>Guardando...</p>}
          </div>
        )}
      </div>
    </div>
  );
}

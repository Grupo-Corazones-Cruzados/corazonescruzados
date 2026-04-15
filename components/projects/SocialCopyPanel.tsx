'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import type { ChatBlock } from '@/components/world/ChatPanel';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;

interface SocialCopyPanelProps {
  projectId: string | number;
  agentId: string;
  agentName: string;
  projectPath: string;
  projectTitle: string;
  projectDescription?: string;
  onClose: () => void;
}

interface PlatformCopy {
  title: string;
  description: string;
  hashtags: string[];
}

interface SocialCopyData {
  youtube: PlatformCopy;
  tiktok: PlatformCopy;
  instagram: PlatformCopy;
  facebook: PlatformCopy;
}

type PlatformKey = keyof SocialCopyData;

const PLATFORMS: { key: PlatformKey; label: string; color: string }[] = [
  { key: 'youtube', label: 'YouTube', color: 'text-red-400 border-red-500/40 hover:bg-red-900/20' },
  { key: 'tiktok', label: 'TikTok', color: 'text-pink-400 border-pink-500/40 hover:bg-pink-900/20' },
  { key: 'instagram', label: 'Instagram', color: 'text-purple-400 border-purple-500/40 hover:bg-purple-900/20' },
  { key: 'facebook', label: 'Facebook', color: 'text-blue-400 border-blue-500/40 hover:bg-blue-900/20' },
];

const SOCIAL_START = '---SOCIAL_JSON_INICIO---';
const SOCIAL_END = '---SOCIAL_JSON_FIN---';

let blockCounter = 0;
function newId() { return `sc-${Date.now()}-${blockCounter++}`; }

function normalizeHashtags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((h) => String(h).trim())
    .filter(Boolean)
    .map((h) => (h.startsWith('#') ? h : `#${h}`));
}

function normalizePlatform(raw: any): PlatformCopy {
  return {
    title: typeof raw?.title === 'string' ? raw.title : '',
    description: typeof raw?.description === 'string' ? raw.description : '',
    hashtags: normalizeHashtags(raw?.hashtags),
  };
}

function tryExtractSocial(text: string): SocialCopyData | null {
  const start = text.indexOf(SOCIAL_START);
  const end = text.indexOf(SOCIAL_END);
  if (start === -1 || end === -1 || end <= start) return null;
  let jsonStr = text.substring(start + SOCIAL_START.length, end).trim();
  const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) jsonStr = fence[1].trim();
  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.youtube || !parsed.tiktok || !parsed.instagram || !parsed.facebook) return null;
    return {
      youtube: normalizePlatform(parsed.youtube),
      tiktok: normalizePlatform(parsed.tiktok),
      instagram: normalizePlatform(parsed.instagram),
      facebook: normalizePlatform(parsed.facebook),
    };
  } catch {
    return null;
  }
}

export default function SocialCopyPanel({
  projectId, agentId, agentName, projectPath,
  projectTitle, projectDescription,
  onClose,
}: SocialCopyPanelProps) {
  const socialAgentId = `social-${agentId}`;
  const projectSessionKey = `project-${projectId}`;

  const [blocks, setBlocks] = useState<ChatBlock[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copy, setCopy] = useState<SocialCopyData | null>(null);
  const [activeTab, setActiveTab] = useState<PlatformKey>('youtube');
  const [loadingExisting, setLoadingExisting] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const runIdRef = useRef<string | null>(null);
  const streamingRef = useRef(false);
  const textStateRef = useRef({ currentTextBlockId: null as string | null, accumulatedText: '' });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/social`);
        if (res.ok) {
          const { data } = await res.json();
          if (data?.social_copy) setCopy(data.social_copy);
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

  const saveCopy = async (data: SocialCopyData) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/social`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ social_copy: data }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast.success('Copy guardado');
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  useEffect(() => {
    if (copy || streaming) return;
    for (let i = blocks.length - 1; i >= 0; i--) {
      if (blocks[i].type !== 'text') continue;
      const extracted = tryExtractSocial(blocks[i].content);
      if (extracted) {
        setCopy(extracted);
        saveCopy(extracted);
        break;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, streaming]);

  const sendMessage = useCallback(async (message: string) => {
    if (streamingRef.current) return;
    setBlocks(prev => [...prev, { id: newId(), type: 'user', content: 'Generar copy para redes sociales...' }]);
    setStreaming(true);
    streamingRef.current = true;
    textStateRef.current = { currentTextBlockId: null, accumulatedText: '' };

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: socialAgentId,
          agentName: `${agentName} (Social Copy)`,
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
  }, [socialAgentId, projectSessionKey, agentName, projectPath, readSSEStream]);

  const startGeneration = () => {
    setCopy(null);
    const prompt = `IMPORTANTE: NO uses herramientas de escritura (Write, Edit). NO crees archivos. Tu UNICA respuesta debe ser una breve intro seguida de un bloque JSON con copy para redes sociales.

OBJETIVO: Generar titulo, descripcion y hashtags para YouTube, TikTok, Instagram y Facebook, promocionando este proyecto como caso de exito / contenido educativo. Enfocado a la audiencia de Fernando Gonzalez y GCC (Grupo Corazones Cruzados) en Ecuador y LATAM.

FASE 1 — INVESTIGACION OBLIGATORIA:
Tu proyecto esta UNICAMENTE en: ${projectPath}
Antes de escribir copy:
1. Lee package.json si existe (dependencias reales).
2. Lee README si existe.
3. Explora 3-6 archivos clave (rutas principales, paginas, componentes, configs) para entender de QUE trata REALMENTE el proyecto.
4. Si no es un proyecto tecnologico, revisa .md, .pdf, assets y estructura para entender el contenido.
PROHIBIDO: acceder fuera de "${projectPath}", usar "..", leer archivos de otros clientes.

REGLAS ANTI-ALUCINACION:
- SOLO promociona features que verificaste leyendo codigo o archivos reales.
- NO inventes funcionalidades, integraciones, ni metricas.
- Si no verificaste algo, omitelo.

REGLAS DE SANITIZACION:
- NO menciones nombres reales de clientes, empresas, marcas, dominios ni URLs internas.
- Reemplaza entidades reales por terminos genericos (ej. "una empresa del sector retail").
- NO expongas credenciales, endpoints, DB, precios internos, contactos.
- NO uses acentos ni caracteres especiales.

REGLAS POR PLATAFORMA:

YouTube:
- title: max 70 caracteres, con hook + beneficio o palabra clave fuerte al inicio.
- description: 600-1500 caracteres. Primeros 125 caracteres deben enganchar (se muestran antes del "mostrar mas"). Despues: que problema resuelve, que hace la solucion, a quien le sirve, llamada a la accion (seguir canal, contactar GCC). Incluir al final "Sigueme en redes" y mencionar TikTok/Instagram/Facebook como referencia.
- hashtags: 8-15 hashtags relevantes, mezcla de nicho (tema del proyecto) + tendencia (desarrollo, automatizacion, emprendimiento, tech LATAM, etc).

TikTok:
- title: max 60 caracteres. Punchy, directo, con hook emocional o dato sorprendente.
- description: 150-300 caracteres. Muy conversacional, con pregunta o CTA. Incluye emojis solo si aportan (sin excederse).
- hashtags: 5-10 hashtags. Mezcla de trending virales (#fyp #parati #foryou #viral) + nicho del proyecto + ubicacion (#ecuador #latam).

Instagram:
- title: max 80 caracteres (se usa como primer gancho del caption).
- description: 400-1500 caracteres. Tono caption de Instagram: hook en linea 1, historia/valor en el medio, CTA al final. Separa con saltos de linea.
- hashtags: 15-25 hashtags. Mezcla de alto volumen (trending general) + medio (nicho) + bajo (ultra especifico). Ubicacion incluida.

Facebook:
- title: max 90 caracteres.
- description: 500-1200 caracteres. Tono mas conversacional y comunitario, como contando una historia a amigos o colegas. Menos hashtags que IG, mas texto narrativo.
- hashtags: 3-8 hashtags, los mas relevantes.

REGLAS DE HASHTAGS:
- Todos los hashtags SIN espacios, en minusculas o camelCase, empezando con "#".
- Incluir siempre al menos uno de marca (#gccworld o #grupocorazonescruzados).
- Priorizar hashtags con tendencia real relacionada al tema del proyecto.

DATOS DEL PROYECTO (contexto, NO copies literal):
- Titulo interno: ${projectTitle}
${projectDescription ? `- Descripcion interna: ${projectDescription.slice(0, 500)}` : ''}

FORMATO DE RESPUESTA (OBLIGATORIO):
Una breve intro (1-2 lineas) de que exploraste, luego JSON exacto entre marcadores:

${SOCIAL_START}
{
  "youtube": {
    "title": "...",
    "description": "...",
    "hashtags": ["#tag1", "#tag2"]
  },
  "tiktok": {
    "title": "...",
    "description": "...",
    "hashtags": ["#fyp", "#parati"]
  },
  "instagram": {
    "title": "...",
    "description": "...",
    "hashtags": ["#tag1", "#tag2"]
  },
  "facebook": {
    "title": "...",
    "description": "...",
    "hashtags": ["#tag1"]
  }
}
${SOCIAL_END}

REGLAS DEL JSON:
- JSON VALIDO (comillas dobles, sin comas colgantes, sin comentarios).
- Todos los campos obligatorios en las 4 plataformas.
- hashtags siempre array de strings con "#".
- Idioma: espanol (audiencia EC/LATAM).`;

    sendMessage(prompt);
  };

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado`);
    } catch { toast.error('No se pudo copiar'); }
  };

  const revokeCopy = async () => {
    if (!confirm('Eliminar el copy generado?')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/social`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setCopy(null);
      toast.success('Copy eliminado');
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const current = copy?.[activeTab];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-digi-card border-2 border-digi-border flex flex-col mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-digi-border bg-digi-darker">
          <div>
            <h3 className="text-[11px] text-accent-glow" style={pf}>Copy para Redes Sociales</h3>
            <p className="text-[9px] text-digi-muted" style={mf}>{projectTitle}</p>
          </div>
          <button onClick={onClose} className="text-digi-muted hover:text-white transition-colors px-2 py-1 text-[10px]" style={pf}>X</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
          {loadingExisting ? (
            <p className="text-[9px] text-digi-muted text-center py-8" style={mf}>Cargando...</p>
          ) : (
            <>
              {blocks.length === 0 && !copy && (
                <div className="text-center py-8 space-y-3">
                  <p className="text-[9px] text-digi-muted max-w-md mx-auto" style={mf}>
                    Claude CLI explorara el proyecto y generara titulo, descripcion y hashtags optimizados para YouTube, TikTok, Instagram y Facebook, con tendencias asociadas al tema.
                  </p>
                  <button
                    onClick={startGeneration}
                    className="px-4 py-2 text-[9px] text-accent-glow border border-accent/40 hover:bg-accent/10 transition-colors"
                    style={pf}
                  >
                    Generar Copy
                  </button>
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
                  <span className="text-[8px] text-digi-muted" style={mf}>Generando copy...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {copy && (
          <div className="border-t-2 border-digi-border bg-digi-darker">
            <div className="flex border-b border-digi-border/50">
              {PLATFORMS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setActiveTab(p.key)}
                  className={`flex-1 px-2 py-2 text-[9px] border-r border-digi-border/30 last:border-r-0 transition-colors ${
                    activeTab === p.key ? 'text-accent-glow bg-accent/10' : 'text-digi-muted hover:text-white'
                  }`}
                  style={pf}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {current && (
              <div className="p-3 space-y-3 max-h-[40vh] overflow-y-auto">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] text-accent-glow/80" style={pf}>TITULO ({current.title.length} ch)</span>
                    <button
                      onClick={() => copyText(current.title, 'Titulo')}
                      className="px-2 py-0.5 text-[8px] text-accent-glow border border-accent/40 hover:bg-accent/10 transition-colors"
                      style={pf}
                    >
                      Copiar
                    </button>
                  </div>
                  <p className="text-[10px] text-digi-text px-2 py-1.5 bg-digi-card border border-digi-border/50 whitespace-pre-wrap" style={mf}>
                    {current.title}
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] text-accent-glow/80" style={pf}>DESCRIPCION ({current.description.length} ch)</span>
                    <button
                      onClick={() => copyText(current.description, 'Descripcion')}
                      className="px-2 py-0.5 text-[8px] text-accent-glow border border-accent/40 hover:bg-accent/10 transition-colors"
                      style={pf}
                    >
                      Copiar
                    </button>
                  </div>
                  <p className="text-[10px] text-digi-text px-2 py-1.5 bg-digi-card border border-digi-border/50 whitespace-pre-wrap leading-relaxed" style={mf}>
                    {current.description}
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] text-accent-glow/80" style={pf}>HASHTAGS ({current.hashtags.length})</span>
                    <button
                      onClick={() => copyText(current.hashtags.join(' '), 'Hashtags')}
                      className="px-2 py-0.5 text-[8px] text-accent-glow border border-accent/40 hover:bg-accent/10 transition-colors"
                      style={pf}
                    >
                      Copiar
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1 px-2 py-1.5 bg-digi-card border border-digi-border/50">
                    {current.hashtags.map((h, i) => (
                      <span key={i} className="text-[9px] text-accent-glow/80 px-1.5 py-0.5 border border-accent/30" style={mf}>
                        {h}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-digi-border/30 flex items-center justify-between">
                  <button
                    onClick={() => {
                      const full = `${current.title}\n\n${current.description}\n\n${current.hashtags.join(' ')}`;
                      copyText(full, 'Todo');
                    }}
                    className="px-2 py-1 text-[8px] text-green-400 border border-green-700/50 hover:bg-green-900/20 transition-colors"
                    style={pf}
                  >
                    Copiar Todo
                  </button>
                  <div className="flex gap-1">
                    <button
                      onClick={startGeneration}
                      disabled={streaming || saving}
                      className="px-2 py-1 text-[8px] text-accent-glow border border-accent/40 hover:bg-accent/10 transition-colors disabled:opacity-40"
                      style={pf}
                    >
                      Regenerar
                    </button>
                    <button
                      onClick={revokeCopy}
                      disabled={saving}
                      className="px-2 py-1 text-[8px] text-red-400 border border-red-700/50 hover:bg-red-900/20 transition-colors disabled:opacity-40"
                      style={pf}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

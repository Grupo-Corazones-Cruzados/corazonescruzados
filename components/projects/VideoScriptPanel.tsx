'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import type { ChatBlock } from '@/components/world/ChatPanel';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;

interface VideoScriptPanelProps {
  projectId: string | number;
  agentId: string;
  agentName: string;
  projectPath: string;
  projectTitle: string;
  projectDescription?: string;
  projectImages: string[];
  existingScript: string | null;
  onClose: () => void;
  onSaved: (script: string) => void;
}

let blockCounter = 0;
function newId() { return `vs-${Date.now()}-${blockCounter++}`; }

export default function VideoScriptPanel({
  projectId, agentId, agentName, projectPath,
  projectTitle, projectDescription, projectImages,
  existingScript, onClose, onSaved,
}: VideoScriptPanelProps) {
  const scriptAgentId = `videoscript-${agentId}`;
  // Shared session key: same Claude CLI conversation as the proforma panel
  // for this project, so the video script generation reuses that context
  // (project analysis, client data, decisions) without re-reading everything.
  const projectSessionKey = `project-${projectId}`;

  const [blocks, setBlocks] = useState<ChatBlock[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extractedScript, setExtractedScript] = useState<string | null>(existingScript);
  const [editingScript, setEditingScript] = useState(false);
  const [editText, setEditText] = useState('');
  const [input, setInput] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const runIdRef = useRef<string | null>(null);
  const streamingRef = useRef(false);
  const textStateRef = useRef({ currentTextBlockId: null as string | null, accumulatedText: '' });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [blocks]);

  // --- SSE Stream Reader ---
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

  // --- Detect script in text blocks ---
  useEffect(() => {
    for (let i = blocks.length - 1; i >= 0; i--) {
      const b = blocks[i];
      if (b.type === 'text' && b.content.includes('---GUION_INICIO---')) {
        const start = b.content.indexOf('---GUION_INICIO---') + '---GUION_INICIO---'.length;
        const end = b.content.indexOf('---GUION_FIN---');
        if (end !== -1) {
          setExtractedScript(b.content.substring(start, end).trim());
        }
        break;
      }
      // Fallback: if no markers, take the last long text block as the script
      if (b.type === 'result' && !extractedScript) {
        for (let j = i - 1; j >= 0; j--) {
          if (blocks[j].type === 'text' && blocks[j].content.length > 200) {
            setExtractedScript(blocks[j].content.trim());
            break;
          }
        }
        break;
      }
    }
  }, [blocks, extractedScript]);

  // --- Send message to Claude CLI ---
  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim() || streamingRef.current) return;

    setBlocks(prev => [...prev, { id: newId(), type: 'user', content: message }]);
    setInput('');
    setStreaming(true);
    streamingRef.current = true;
    textStateRef.current = { currentTextBlockId: null, accumulatedText: '' };

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: scriptAgentId,
          agentName: `${agentName} (Video Script)`,
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
  }, [scriptAgentId, projectSessionKey, agentName, projectPath, readSSEStream]);

  // --- Start generation ---
  const startGeneration = () => {
    setExtractedScript(null);

    const imageDescriptions = projectImages.length > 0
      ? `\nEl proyecto tiene ${projectImages.length} imagenes que se usaran como material visual para el video. Analiza cada imagen para entender que muestra (capturas de pantalla de la app, interfaces, diagramas, etc.) y referencia las imagenes en el guion indicando cuando deberia mostrarse cada una. Usa el formato [IMAGEN X] donde X es el numero de la imagen (del 1 al ${projectImages.length}).`
      : '';

    const prompt = `IMPORTANTE: NO uses herramientas de escritura (Write, Edit). NO crees archivos. Tu respuesta debe contener el guion como texto plano.

RESTRICCION DE DIRECTORIO — LEE ESTO PRIMERO:
Tu proyecto esta UNICAMENTE en: ${projectPath}
- TODAS las rutas que leas DEBEN empezar con "${projectPath}/"
- PROHIBIDO usar ".." en rutas
- PROHIBIDO acceder a carpetas padre o hermanas
- Para explorar el proyecto usa: find "${projectPath}" -type f -name "*.tsx" -o -name "*.ts" | head -50
- NO leas archivos fuera de "${projectPath}" bajo ninguna circunstancia

Analiza este proyecto leyendo su codigo fuente, estructura, README, y cualquier archivo relevante DENTRO DE "${projectPath}" para comprender completamente de que se trata, que tecnologias usa, que funcionalidades tiene, su proposito y como funciona.

DATOS DEL PROYECTO:
- Nombre: ${projectTitle}
${projectDescription ? `- Descripcion: ${projectDescription}` : ''}
${imageDescriptions}

Luego, genera un guion de video promocional/explicativo para este proyecto completado.

ESTILO DE GUIONIZACION (referencia - adapta al proyecto actual):
El guion debe seguir un estilo conversacional, directo, emocional y persuasivo. Como si estuvieras hablando directamente a la camara explicando el proyecto a potenciales clientes. Ejemplos del estilo:
- "Mira, este es mi sistema. Como veras puedo crear aplicaciones..."
- "Quizas te preguntaras. Como, Cuanto o Cuando te puedo entregar tu proyecto..."
- "Si te gusta este tipo de soluciones, y quieres crear automatizaciones para tu negocio, ya sabes..."
- "Asi que si te interesa este tipo de aplicaciones, a implementar en tu empresa, sigueme o escribeme..."

ESTRUCTURA DEL GUION:
1. Introduccion enganchadora - Presenta el problema que resuelve o la necesidad del proyecto
2. Demostracion - Explica como funciona, que puede hacer, muestra las funcionalidades principales
3. Beneficios - Por que usar esta solucion, que ventajas tiene
4. Cierre con llamada a la accion - Invita a contactar, seguir, probar

REGLAS:
- El guion debe estar basado en las funcionalidades REALES del proyecto (leidas del codigo)
- No uses acentos ni caracteres especiales
- Habla en primera persona como Fernando Gonzalez, desarrollador de GCC (Grupo Corazones Cruzados)
- Incluye pausas naturales con "..." y saltos de linea entre secciones
- Si hay imagenes, indica entre corchetes [IMAGEN X] donde deberia mostrarse cada imagen segun lo que se este narrando
- El guion debe durar aproximadamente 1-3 minutos al ser narrado
- Finaliza siempre con "Nos vemos."

FORMATO DE RESPUESTA:
Envuelve el guion final entre los marcadores ---GUION_INICIO--- y ---GUION_FIN--- para que pueda ser extraido automaticamente.
Antes del guion puedes explicar brevemente tu analisis del proyecto.`;

    sendMessage(prompt);
  };

  // --- Save script ---
  const saveScript = async (scriptText?: string) => {
    const text = scriptText || extractedScript;
    if (!text) { toast.error('No hay guion para guardar'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_script: text }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast.success('Guion guardado');
      onSaved(text);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleEditSave = () => {
    setExtractedScript(editText);
    setEditingScript(false);
    saveScript(editText);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-digi-card border-2 border-digi-border flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-digi-border bg-digi-darker">
          <div>
            <h3 className="text-[11px] text-accent-glow" style={pf}>Generar Guion de Video</h3>
            <p className="text-[9px] text-digi-muted" style={mf}>{projectTitle}</p>
          </div>
          <button onClick={onClose} className="text-digi-muted hover:text-white transition-colors px-2 py-1 text-[10px]" style={pf}>X</button>
        </div>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
          {blocks.length === 0 && !extractedScript && (
            <div className="text-center py-8 space-y-3">
              <p className="text-[9px] text-digi-muted" style={mf}>
                Claude CLI analizara el proyecto y generara un guion de video basado en el codigo, funcionalidades e imagenes.
              </p>
              <p className="text-[9px] text-digi-muted" style={mf}>
                Imagenes disponibles: {projectImages.length}/30
              </p>
              <button
                onClick={startGeneration}
                className="px-4 py-2 text-[9px] text-accent-glow border border-accent/40 hover:bg-accent/10 transition-colors"
                style={pf}
              >
                Generar Guion
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
              <span className="text-[8px] text-digi-muted" style={mf}>Claude esta analizando el proyecto...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Extracted script preview */}
        {extractedScript && (
          <div className="border-t-2 border-digi-border px-4 py-3 space-y-2 bg-digi-darker max-h-[30vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h4 className="text-[9px] text-green-400" style={pf}>Guion Generado</h4>
              <div className="flex gap-1">
                <button
                  onClick={() => { setEditText(extractedScript); setEditingScript(true); }}
                  className="px-2 py-0.5 text-[8px] text-accent-glow border border-accent/30 hover:bg-accent/10 transition-colors"
                  style={pf}
                >
                  Editar
                </button>
                <button
                  onClick={() => saveScript()}
                  disabled={saving}
                  className="px-2 py-0.5 text-[8px] text-green-400 border border-green-700/50 hover:bg-green-900/20 transition-colors disabled:opacity-50"
                  style={pf}
                >
                  {saving ? '...' : 'Guardar'}
                </button>
              </div>
            </div>

            {editingScript ? (
              <div className="space-y-2">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={10}
                  className="w-full px-2 py-1.5 bg-digi-card border border-digi-border text-[9px] text-digi-text focus:border-accent focus:outline-none resize-y"
                  style={mf}
                />
                <div className="flex gap-1 justify-end">
                  <button onClick={() => setEditingScript(false)} className="px-2 py-0.5 text-[8px] text-digi-muted border border-digi-border hover:text-white transition-colors" style={pf}>Cancelar</button>
                  <button onClick={handleEditSave} className="px-2 py-0.5 text-[8px] text-green-400 border border-green-700/50 hover:bg-green-900/20 transition-colors" style={pf}>Guardar Edicion</button>
                </div>
              </div>
            ) : (
              <p className="text-[9px] text-digi-text whitespace-pre-wrap leading-relaxed" style={mf}>
                {extractedScript}
              </p>
            )}
          </div>
        )}

        {/* Input area for follow-up messages */}
        {blocks.length > 0 && (
          <div className="border-t border-digi-border px-4 py-2 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !streaming && sendMessage(input)}
              placeholder="Ajustar guion..."
              disabled={streaming}
              className="flex-1 px-2 py-1.5 bg-digi-darker border border-digi-border text-[9px] text-digi-text placeholder:text-digi-muted/40 focus:border-accent focus:outline-none disabled:opacity-50"
              style={mf}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={streaming || !input.trim()}
              className="px-3 py-1.5 text-[8px] text-accent-glow border border-accent/40 hover:bg-accent/10 transition-colors disabled:opacity-40"
              style={pf}
            >
              Enviar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

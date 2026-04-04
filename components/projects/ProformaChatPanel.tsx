'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import type { ChatBlock } from '@/components/world/ChatPanel';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;

interface ProformaChatPanelProps {
  projectId: string | number;
  agentId: string;
  agentName: string;
  projectPath: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  projectTitle: string;
  hasProforma?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

type Step = 'choice' | 'form' | 'chat';

interface SavedChatState {
  blocks: ChatBlock[];
  latestHtml: string | null;
  hasDocumentation: boolean;
  sender: string;
  amount: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
}

let blockCounter = 0;
function newId() { return `pb-${Date.now()}-${blockCounter++}`; }

export default function ProformaChatPanel({
  projectId, agentId, agentName, projectPath,
  clientName: initialClientName, clientEmail: initialClientEmail, clientPhone: initialClientPhone,
  projectTitle, hasProforma, onClose, onSaved,
}: ProformaChatPanelProps) {
  const storageKey = `proforma-chat-${projectId}`;
  const proformaAgentId = `proforma-${agentId}`;

  // Check for saved state on mount
  const getSavedState = (): SavedChatState | null => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const saved = JSON.parse(raw) as SavedChatState;
      if (!saved.blocks?.length) return null;
      return saved;
    } catch { return null; }
  };

  const savedState = useRef(getSavedState());
  const hasSavedContext = !!savedState.current;

  // Form state
  const [step, setStep] = useState<Step>(hasSavedContext ? 'choice' : 'form');
  const [sender, setSender] = useState(savedState.current?.sender || '');
  const [amount, setAmount] = useState(savedState.current?.amount || '');
  const [clientName, setClientName] = useState(savedState.current?.clientName || initialClientName || '');
  const [clientEmail, setClientEmail] = useState(savedState.current?.clientEmail || initialClientEmail || '');
  const [clientPhone, setClientPhone] = useState(savedState.current?.clientPhone || initialClientPhone || '');

  // Chat state
  const [blocks, setBlocks] = useState<ChatBlock[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [latestHtml, setLatestHtml] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showSendEmails, setShowSendEmails] = useState(false);
  const [sendEmails, setSendEmails] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [hasDocumentation, setHasDocumentation] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const runIdRef = useRef<string | null>(null);
  const eventIndexRef = useRef(0);
  const streamingRef = useRef(false);
  const textStateRef = useRef({ currentTextBlockId: null as string | null, accumulatedText: '' });

  // Save state on every meaningful change (blocks update)
  useEffect(() => {
    if (step !== 'chat' || blocks.length === 0) return;
    try {
      const state: SavedChatState = {
        blocks, latestHtml, hasDocumentation,
        sender, amount, clientName, clientEmail, clientPhone,
      };
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {}
  }, [blocks, latestHtml, hasDocumentation, step, storageKey, sender, amount, clientName, clientEmail, clientPhone]);

  // Resume from saved context
  const resumeFromSaved = () => {
    const saved = savedState.current;
    if (!saved) return;
    setBlocks(saved.blocks);
    setLatestHtml(saved.latestHtml);
    setHasDocumentation(saved.hasDocumentation);
    setSender(saved.sender);
    setAmount(saved.amount);
    setClientName(saved.clientName);
    setClientEmail(saved.clientEmail);
    setClientPhone(saved.clientPhone);
    setStep('chat');
  };

  // Start fresh: clear saved state and server session
  const startFresh = async () => {
    localStorage.removeItem(storageKey);
    savedState.current = null;
    await fetch('/api/chat/clear-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: proformaAgentId }),
    }).catch(() => {});
    setBlocks([]);
    setLatestHtml(null);
    setHasDocumentation(false);
    setStep('form');
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [blocks]);

  // --- SSE Stream Reader (same pattern as ChatPanel) ---
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

        eventIndexRef.current++;
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

  // --- Detect HTML in text blocks ---
  useEffect(() => {
    for (let i = blocks.length - 1; i >= 0; i--) {
      const b = blocks[i];
      if (b.type === 'text' && b.content.includes('<!DOCTYPE')) {
        const start = b.content.indexOf('<!DOCTYPE');
        let end = b.content.lastIndexOf('</html>');
        if (end !== -1) {
          const html = b.content.substring(start, end + 7);
          setLatestHtml(html);
        }
        break;
      }
    }
  }, [blocks]);

  // --- Send message to Claude CLI via /api/chat ---
  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim() || streamingRef.current) return;

    setBlocks(prev => [...prev, { id: newId(), type: 'user', content: message }]);
    setInput('');
    setStreaming(true);
    streamingRef.current = true;
    textStateRef.current = { currentTextBlockId: null, accumulatedText: '' };
    eventIndexRef.current = 0;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: proformaAgentId,
          agentName: `${agentName} (Proforma)`,
          message,
          projectPath,
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
  }, [proformaAgentId, agentName, projectPath, readSSEStream]);

  // --- Start proforma generation ---
  const startGeneration = async () => {
    if (!sender.trim() || !amount || !clientName.trim()) return;

    setStep('chat');

    const now = new Date();
    const proformaNumber = `PRO-${now.getFullYear()}-${String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0')}`;
    const dateStr = now.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

    const prompt = `IMPORTANTE: NO uses herramientas de escritura (Write, Edit). NO crees archivos. Tu respuesta debe ser UNICAMENTE el HTML puro como texto plano en tu mensaje.

RESTRICCION DE DIRECTORIO CRITICA: Solo debes leer archivos dentro de la carpeta actual del proyecto (${projectPath}). NO navegues a carpetas padre ni hermanas. NO uses rutas como "../" ni accedas a directorios fuera del proyecto. Todos los comandos find, ls, glob y lecturas deben estar limitados a "${projectPath}" y sus subdirectorios.

Analiza este proyecto leyendo su codigo fuente, estructura, README, y cualquier archivo relevante para comprender de que se trata, que tecnologias usa, que funcionalidades tiene y su proposito.

Luego, responde DIRECTAMENTE con el HTML completo de una proforma profesional para este proyecto.

DATOS FIJOS (usa estos exactamente, NO inventes otros):
- Numero de proforma: ${proformaNumber}
- Remitente: ${sender}
- Nombre de la empresa: Grupo Corazones Cruzados
- Subtitulo de la empresa: GCC
- Email de la empresa: lfgonzalezm0@grupocc.org
- Cliente: ${clientName}
- Email cliente: ${clientEmail}
- Telefono cliente: ${clientPhone}
- Nombre del proyecto: ${projectTitle}
- Fecha de emision: ${dateStr}
- Validez: 30 dias
- Moneda: USD (Dolares americanos)
- Monto total objetivo: $${amount} USD

INSTRUCCIONES PARA EL CONTENIDO:
1. Los items de la proforma deben ser un desglose profesional del trabajo que implica este proyecto, basado en tu analisis real del codigo y estructura.
2. Cada item debe tener un titulo claro, una descripcion detallada de 1-2 lineas, y un monto.
3. Los montos deben sumar EXACTAMENTE $${amount}.00 USD.
4. La seccion de "Alcance del entregable" debe listar las funcionalidades reales del proyecto.
5. Los terminos y condiciones deben ser especificos para este tipo de proyecto.
6. No uses acentos ni caracteres especiales (usa "Analisis" no "Análisis").
7. En el header usa una imagen para el logo: <div class="brand-icon"><img src="/LogoApp.png" alt="GCC"></div>

DEBES usar EXACTAMENTE este template HTML/CSS:

<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proforma ${proformaNumber} | Grupo Corazones Cruzados</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1d1d1f; background: #ffffff; font-size: 14px; line-height: 1.6; -webkit-font-smoothing: antialiased; }
    .page { max-width: 800px; margin: 0 auto; padding: 60px 64px; min-height: 100vh; }
    @media print { .page { padding: 40px 48px; min-height: auto; } .no-print { display: none !important; } }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 56px; padding-bottom: 32px; border-bottom: 1px solid #e5e5e7; }
    .brand { display: flex; align-items: center; gap: 14px; }
    .brand-icon { width: 44px; height: 44px; border-radius: 10px; overflow: hidden; }
    .brand-icon img { width: 100%; height: 100%; object-fit: cover; }
    .brand-text h1 { font-size: 20px; font-weight: 700; letter-spacing: -0.3px; color: #1d1d1f; }
    .brand-text p { font-size: 11px; color: #86868b; font-weight: 500; letter-spacing: 0.5px; text-transform: uppercase; }
    .doc-type { text-align: right; }
    .doc-type h2 { font-size: 28px; font-weight: 300; color: #1d1d1f; letter-spacing: -0.5px; }
    .doc-type .doc-number { font-size: 13px; color: #86868b; font-weight: 500; margin-top: 4px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 48px; }
    .info-block h3 { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.2px; color: #86868b; margin-bottom: 12px; }
    .info-block p { font-size: 14px; color: #1d1d1f; line-height: 1.7; }
    .info-block .name { font-weight: 600; font-size: 15px; }
    .dates-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-bottom: 48px; padding: 20px 24px; background: #f5f5f7; border-radius: 12px; }
    .date-item label { display: block; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #86868b; margin-bottom: 4px; }
    .date-item span { font-size: 14px; font-weight: 500; color: #1d1d1f; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
    .items-table thead th { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #86868b; padding: 0 0 12px 0; text-align: left; border-bottom: 1px solid #e5e5e7; }
    .items-table thead th:last-child { text-align: right; }
    .items-table tbody td { padding: 20px 0; vertical-align: top; border-bottom: 1px solid #f0f0f2; }
    .items-table tbody tr:last-child td { border-bottom: 1px solid #e5e5e7; }
    .item-number { font-size: 12px; color: #86868b; font-weight: 500; width: 32px; }
    .item-title { font-weight: 600; font-size: 14px; color: #1d1d1f; margin-bottom: 4px; }
    .item-desc { font-size: 12px; color: #6e6e73; line-height: 1.5; max-width: 420px; }
    .item-amount { text-align: right; font-weight: 500; font-size: 14px; white-space: nowrap; }
    .totals { display: flex; justify-content: flex-end; margin-bottom: 48px; }
    .totals-box { width: 280px; }
    .totals-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; color: #6e6e73; }
    .totals-row.total { padding: 16px 0 0 0; margin-top: 8px; border-top: 2px solid #1d1d1f; font-size: 20px; font-weight: 600; color: #1d1d1f; letter-spacing: -0.3px; }
    .scope { margin-bottom: 48px; padding: 28px 32px; background: #f5f5f7; border-radius: 12px; }
    .scope h3 { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.2px; color: #86868b; margin-bottom: 16px; }
    .scope-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 32px; }
    .scope-item { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: #1d1d1f; line-height: 1.5; }
    .scope-item .check { color: #34c759; font-weight: 700; flex-shrink: 0; margin-top: 1px; }
    .scope-item .pending { color: #ff9500; font-weight: 700; flex-shrink: 0; margin-top: 1px; }
    .scope-item .tag { display: inline-block; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; padding: 1px 6px; border-radius: 4px; margin-left: 4px; }
    .scope-item .tag-future { background: #fff3e0; color: #e65100; }
    .terms { margin-bottom: 48px; }
    .terms h3 { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.2px; color: #86868b; margin-bottom: 16px; }
    .terms ol { padding-left: 20px; }
    .terms li { font-size: 12px; color: #6e6e73; line-height: 1.7; margin-bottom: 6px; }
    .footer { padding-top: 32px; border-top: 1px solid #e5e5e7; display: flex; justify-content: space-between; align-items: flex-end; }
    .footer-left p { font-size: 11px; color: #86868b; line-height: 1.7; }
    .footer-right { text-align: right; }
    .footer-right .signature-line { width: 200px; border-bottom: 1px solid #d2d2d7; margin-bottom: 8px; margin-left: auto; padding-top: 48px; }
    .footer-right .signature-label { font-size: 10px; color: #86868b; text-transform: uppercase; letter-spacing: 1px; font-weight: 500; }
    .print-btn { position: fixed; bottom: 32px; right: 32px; background: #1d1d1f; color: white; border: none; padding: 12px 24px; border-radius: 980px; font-family: inherit; font-size: 13px; font-weight: 500; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,0.15); transition: all 0.2s ease; }
    .print-btn:hover { background: #424245; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0,0,0,0.2); }
  </style>
</head>
<body>
<div class="page">
  <!-- Header: Logo (img src="/LogoApp.png") + "Grupo Corazones Cruzados" + subtitulo "GCC" left, "Proforma" + number right -->
  <!-- Info Grid: "De" (Grupo Corazones Cruzados + remitente + lfgonzalezm0@grupocc.org) left, "Para" (cliente + proyecto) right -->
  <!-- Dates Row: fecha emision, validez 30 dias, moneda USD -->
  <!-- Items Table: # | Descripcion (titulo + desc) | Monto -->
  <!-- Totals: subtotal, impuestos $0.00, total -->
  <!-- Scope: grid 2 cols con checks verdes para incluidos, puntos naranjas para fase 2 -->
  <!-- Terms: ol con terminos especificos -->
  <!-- Footer: "Grupo Corazones Cruzados" + proforma number left, firma de aceptacion right -->
</div>
<button class="print-btn no-print" onclick="window.print()">Imprimir / Guardar PDF</button>
</body>
</html>

REGLAS DE RESPUESTA CRITICAS:
- NO uses la herramienta Write ni Edit. NO crees ningun archivo.
- NO uses bloques de codigo markdown (no uses triple backticks).
- NO agregues explicaciones, comentarios ni tablas antes o despues del HTML.
- Tu respuesta completa debe ser SOLAMENTE el documento HTML, empezando con <!DOCTYPE html> y terminando con </html>.
- Escribe el HTML directamente como texto plano en tu mensaje de respuesta.`;

    // Small delay so the UI switches to chat before sending
    setTimeout(() => sendMessage(prompt), 300);
  };

  // --- Save proforma ---
  const saveProforma = async () => {
    if (!latestHtml) { toast.error('No hay proforma para guardar'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/proforma`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: latestHtml }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast.success('Proforma guardada');
      onSaved();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  // --- Save and send ---
  const saveAndSend = async () => {
    if (!latestHtml) return;
    setSaving(true);
    try {
      // First save
      const saveRes = await fetch(`/api/projects/${projectId}/proforma`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: latestHtml }),
      });
      if (!saveRes.ok) { const d = await saveRes.json(); throw new Error(d.error); }

      // Then send
      if (sendEmails.trim()) {
        const sendRes = await fetch(`/api/projects/${projectId}/proforma`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            emails: sendEmails,
            clientName, projectTitle,
            senderName: sender,
            targetAmount: Number(amount),
          }),
        });
        if (!sendRes.ok) { const d = await sendRes.json(); throw new Error(d.error); }
        const { emailsSent } = await sendRes.json();
        toast.success(`Proforma guardada y enviada a ${emailsSent} destinatario${emailsSent > 1 ? 's' : ''}`);
      }
      onSaved();
      setShowSendEmails(false);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  // --- Add documentation ---
  const addDocumentation = () => {
    const docPrompt = `IMPORTANTE: NO uses herramientas de escritura (Write, Edit). NO crees archivos. Responde UNICAMENTE con el HTML puro.

RESTRICCION DE DIRECTORIO CRITICA: Solo debes leer archivos dentro de la carpeta del proyecto (${projectPath}). NO navegues a carpetas padre ni hermanas. NO uses rutas como "../" ni accedas a directorios fuera del proyecto.

Ahora necesito que generes un documento HTML COMPLETO de documentacion profesional del proyecto Y la proforma que ya generaste. El documento final debe ser un solo archivo HTML auto-contenido. Debe ser una documentacion COMPLETA, lista para presentar a un cliente o stakeholder.

El documento DEBE tener estas secciones BASE en este orden (basandote en tu analisis real del proyecto):

1. **Navegacion fija** - Nav bar sticky con links a TODAS las secciones del documento. Debe incluir cada seccion que generes, incluyendo las secciones dinamicas que tu agregues segun el tipo de proyecto.

2. **Hero/Portada** - Titulo del proyecto con subtitulo descriptivo, badge "Propuesta Tecnica y Documentacion", metricas clave del proyecto (4-6 datos: usuarios estimados, endpoints, modulos, lineas de codigo, etc.)

3. **Resumen Ejecutivo** - Parrafo profesional de 3-5 oraciones que resuma que es el proyecto, que problema resuelve, para quien, y cual es el valor principal que entrega. Debe ser entendible por alguien no tecnico.

4. **El problema y la solucion** - Dos cards lado a lado: "Situacion Actual" vs "Con la Solucion". Describe el problema real que resuelve el proyecto con puntos concretos en cada card.

5. **Objetivos del Proyecto** - Lista numerada de 4-6 objetivos SMART (especificos, medibles) del proyecto, basados en lo que hace el codigo. Ejemplo: "Reducir el tiempo de generacion de reportes de 2 horas a 5 minutos".

6. **Usuarios y Audiencia** - Describe los tipos de usuario/roles del sistema (los que encontraste en el codigo), que puede hacer cada uno, y el perfil de audiencia objetivo. Usa cards por cada tipo de usuario.

7. **Como funciona paso a paso** - Steps verticales numerados (4-6 pasos) explicando el flujo principal del sistema basado en el codigo real. Cada paso con icono emoji, titulo y descripcion.

8. **Caracteristicas principales** - Grid de 6-8 features del sistema basadas en funcionalidades REALES del codigo. Cada feature con emoji, titulo y descripcion de 2 lineas.

9. **Arquitectura del Sistema** - Diagrama visual usando divs estilizados que muestre las capas del sistema: Frontend, Backend/API, Base de Datos, Servicios Externos. Conectalos con flechas. Describe brevemente cada capa y que tecnologias usa.

10. **Diagrama de Flujo** - Flujo visual del proceso principal del sistema usando divs estilizados como nodos con flechas (flow-node, flow-arrow). Debe reflejar el flujo real que encontraste en el codigo.

11. **Modelo de Datos** - Tabla o diagrama que muestre las entidades/tablas principales de la base de datos, sus campos clave y relaciones. Basado en lo que encontraste en el codigo (schemas, migrations, queries SQL, modelos ORM, etc). Si no hay BD visible, describe las estructuras de datos principales.

12. **Integraciones y APIs** - Lista de todas las integraciones externas que el proyecto usa (APIs de terceros, webhooks, servicios). Para cada una indica: nombre del servicio, proposito, endpoints principales que consume. Si el proyecto EXPONE una API, documenta los endpoints principales con metodo HTTP, ruta y descripcion.

13. **Seguridad y Privacidad** - Grid con las medidas de seguridad implementadas: autenticacion, autorizacion, encriptacion, validacion de datos, proteccion CSRF/XSS, manejo de tokens, etc. Basado en lo que realmente implementa el codigo.

14. **Stack Tecnologico** - Grid con las tecnologias reales del proyecto (package.json, imports, etc). Agrupa por categoria: Frontend, Backend, Base de Datos, DevOps/Infra, Servicios Externos. Cada una con version si es visible.

15. **Plan de Despliegue e Infraestructura** - Describe como se despliega el proyecto: plataforma de hosting, CI/CD si existe, variables de entorno necesarias (sin valores, solo nombres), proceso de build y deploy.

16. **Cronograma Estimado** - Timeline visual con las fases del proyecto (Diseno, Desarrollo, Testing, Deploy, Ajustes). Usa una barra de progreso horizontal estilizada o tabla con fechas estimadas relativas (Semana 1-2, Semana 3-4, etc).

17. **Riesgos y Mitigaciones** - Tabla con 4-6 riesgos potenciales del proyecto, su nivel de impacto (Alto/Medio/Bajo), probabilidad, y estrategia de mitigacion. Piensa en riesgos tecnicos, de dependencias, de escalabilidad, etc.

18. **Mantenimiento y Soporte** - Describe que incluye el mantenimiento post-entrega: actualizaciones de dependencias, monitoreo, backups, soporte tecnico. Incluye recomendaciones de mantenimiento preventivo.

19. **Estimacion de Costos Operativos** - Tabla profesional con los costos mensuales/anuales de los servicios que el proyecto consume. Analiza el codigo para identificar:
   - APIs de inteligencia artificial (Claude, OpenAI, etc): estima tokens/llamadas mensuales y costo
   - Hosting/servidor (Vercel, AWS, Railway, etc): plan estimado segun trafico
   - Base de datos (Supabase, PlanetScale, MongoDB Atlas, etc): tier estimado
   - Servicios de email (Resend, SendGrid, etc): volumen estimado
   - Almacenamiento (S3, Cloudinary, etc): si aplica
   - Dominios y SSL: si aplica
   - Cualquier otro servicio de terceros que el codigo integre
   Columnas: Servicio, Proveedor, Plan/Tier, Costo Mensual, Costo Anual. Incluye totales y nota aclarando que son estimaciones.

20. **PROFORMA** - Incluye la proforma EXACTAMENTE como la generaste antes, sin modificarla. Usa la seccion con clase .proforma-page

=== SECCIONES DINAMICAS (OBLIGATORIO) ===
Ademas de las secciones base, DEBES agregar secciones adicionales segun lo que detectes en el proyecto. Insertalas donde tenga mas sentido logico en el documento. Ejemplos:

- Si es un proyecto con IA/ML: agrega "Modelos de IA y Pipelines" (que modelos usa, como se entrenan, metricas)
- Si tiene autenticacion de usuarios: agrega "Gestion de Usuarios y Roles" (flujo de registro, login, permisos)
- Si maneja pagos: agrega "Procesamiento de Pagos" (pasarelas, flujo de pago, seguridad PCI)
- Si tiene notificaciones: agrega "Sistema de Notificaciones" (canales: email, push, SMS, triggers)
- Si es e-commerce: agrega "Catalogo y Gestion de Productos", "Carrito y Checkout"
- Si tiene reportes/analytics: agrega "Reportes y Analiticas" (que reportes genera, dashboards)
- Si tiene chat/mensajeria: agrega "Sistema de Comunicacion en Tiempo Real"
- Si maneja archivos/media: agrega "Gestion de Archivos y Media"
- Si tiene internacionalizacion: agrega "Soporte Multi-idioma"
- Si tiene PWA/mobile: agrega "Experiencia Movil y Offline"
- Si tiene workflows/automaciones: agrega "Automatizaciones y Flujos de Trabajo"
- Si tiene multi-tenancy: agrega "Arquitectura Multi-tenant"

Usa tu criterio: analiza el codigo y agrega TODAS las secciones que sean relevantes. No te limites a los ejemplos anteriores. El objetivo es que la documentacion sea lo mas completa posible para que el cliente entienda exactamente que esta recibiendo.

REGLAS DE ESTILO:
- Fuente Inter de Google Fonts
- Estilo Apple: minimalista, limpio, espaciado generoso
- Colores: #1d1d1f texto, #86868b subtitulos, #f5f5f7 fondos claros, #e5e5e7 bordes
- Gradiente azul para highlights: linear-gradient(90deg, #0071e3, #40c8e0)
- Nav sticky con backdrop-filter blur
- Emojis Unicode como iconos (no libreria)
- La proforma al final con su propio estilo (prefijos pro- para clases)
- Boton de imprimir (class no-print)
- No uses acentos ni caracteres especiales
- Logo: <img src="/LogoApp.png" alt="GCC">
- Empresa: Grupo Corazones Cruzados (subtitulo: GCC)
- CSS en el <style> del head, no inline excepto casos minimos
- @media print: ocultar nav y no-print, page-break-before en la proforma
- Cada seccion debe tener un id para que el nav pueda linkear a ella

REGLAS DE RESPUESTA CRITICAS:
- NO uses la herramienta Write ni Edit. NO crees ningun archivo.
- NO uses bloques de codigo markdown.
- Tu respuesta debe ser SOLAMENTE el HTML completo desde <!DOCTYPE html> hasta </html>.`;

    sendMessage(docPrompt);
    setHasDocumentation(true);
  };

  // --- Preview proforma ---
  const previewHtml = () => {
    if (!latestHtml) return;
    const w = window.open('', '_blank');
    if (w) { w.document.write(latestHtml); w.document.close(); }
  };

  // --- Toggle collapse ---
  const toggleCollapse = (id: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, collapsed: !b.collapsed } : b));
  };

  // --- Render text block without HTML (show summary instead) ---
  const renderTextContent = (content: string) => {
    if (content.includes('<!DOCTYPE')) {
      const beforeHtml = content.substring(0, content.indexOf('<!DOCTYPE')).trim();
      return (
        <div>
          {beforeHtml && <ReactMarkdown remarkPlugins={[remarkGfm]}>{beforeHtml}</ReactMarkdown>}
          <button onClick={previewHtml} className="mt-1 px-3 py-1.5 text-[9px] bg-accent/20 text-accent-glow border border-accent/40 hover:bg-accent/30 transition-colors" style={pf}>
            {hasDocumentation ? 'Ver Documento Completo' : 'Ver Proforma Generada'}
          </button>
        </div>
      );
    }
    return <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>;
  };

  // =========== RENDER ===========

  const savedHasDoc = savedState.current?.hasDocumentation;
  const contextLabel = savedHasDoc ? 'documentacion y proforma' : 'proforma';

  // --- Choice Step (saved context exists) ---
  if (step === 'choice') {
    return (
      <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-digi-card border-2 border-digi-border rounded-lg w-full max-w-md" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-digi-border">
            <h3 className="text-[11px] text-accent-glow" style={pf}>Proforma y Documentacion</h3>
            <button onClick={onClose} className="text-digi-muted hover:text-digi-text text-xs">&times;</button>
          </div>
          <div className="px-4 py-5 space-y-4">
            <div className="px-3 py-2.5 bg-accent/10 border border-accent/30 rounded">
              <p className="text-[9px] text-accent-glow" style={pf}>Contexto guardado</p>
              <p className="text-[10px] text-digi-muted mt-1" style={mf}>
                Tienes una {contextLabel} generada previamente con {savedState.current?.blocks.filter(b => b.type === 'user').length || 0} mensajes de conversacion.
                Puedes continuar editando o empezar desde cero.
              </p>
            </div>
            <button onClick={resumeFromSaved}
              className="pixel-btn pixel-btn-primary w-full">
              Continuar editando
            </button>
            <button onClick={startFresh}
              className="w-full px-3 py-2.5 text-[9px] text-red-400 border-2 border-red-500/30 hover:bg-red-900/20 transition-colors" style={pf}>
              {savedHasDoc ? 'Generar documentacion desde cero' : 'Generar proforma desde cero'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Form Step ---
  if (step === 'form') {
    return (
      <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-digi-card border-2 border-digi-border rounded-lg w-full max-w-md" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-digi-border">
            <h3 className="text-[11px] text-accent-glow" style={pf}>Generar Proforma</h3>
            <button onClick={onClose} className="text-digi-muted hover:text-digi-text text-xs">&times;</button>
          </div>
          <div className="px-4 py-4 space-y-3">
            <p className="text-[9px] text-digi-muted" style={mf}>Claude leera el proyecto y generara la proforma. Podras corregirla en el chat.</p>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-accent-glow opacity-70" style={pf}>Remitente *</label>
              <input value={sender} onChange={e => setSender(e.target.value)} placeholder="Tu nombre"
                className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-xs text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none" style={mf} />
            </div>
            <div className="border-t border-digi-border/30 pt-3">
              <p className="text-[9px] text-digi-muted mb-2" style={pf}>Datos del cliente</p>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-accent-glow opacity-70" style={pf}>Nombre del cliente *</label>
              <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nombre completo"
                className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-xs text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none" style={mf} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-accent-glow opacity-70" style={pf}>Email</label>
                <input value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="email@ej.com"
                  className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-xs text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none" style={mf} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-accent-glow opacity-70" style={pf}>Telefono</label>
                <input value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="+593..."
                  className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-xs text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none" style={mf} />
              </div>
            </div>
            <div className="border-t border-digi-border/30 pt-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-accent-glow opacity-70" style={pf}>Monto objetivo (USD) *</label>
                <input value={amount} onChange={e => setAmount(e.target.value)} type="number" placeholder="2000" min="1"
                  className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-xs text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none" style={mf} />
              </div>
            </div>
            <button onClick={startGeneration} disabled={!sender.trim() || !amount || !clientName.trim()}
              className="pixel-btn pixel-btn-primary w-full disabled:opacity-50">
              Iniciar Generacion
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Chat Step ---
  const isComplete = blocks.some(b => b.type === 'result');

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-[#0d1117] border border-[#21262d] rounded-lg w-full max-w-2xl h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#21262d] bg-[#161b22] rounded-t-lg">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-accent-glow" style={pf}>Proforma Chat</span>
            <span className="text-[8px] text-digi-muted" style={mf}>{projectTitle}</span>
            {streaming && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
          </div>
          <div className="flex items-center gap-2">
            {latestHtml && (
              <button onClick={previewHtml} className="px-2 py-1 text-[8px] text-accent-glow border border-accent/40 hover:bg-accent/10 transition-colors" style={pf}>
                {hasDocumentation ? 'Ver Documento' : 'Ver Proforma'}
              </button>
            )}
            <button onClick={onClose} className="text-digi-muted hover:text-digi-text text-sm">&times;</button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
          {blocks.map(block => {
            switch (block.type) {
              case 'user':
                return (
                  <div key={block.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded px-2.5 py-1.5 text-[11px] bg-[#1f2937] text-[#c9d1d9]">
                      <span className="whitespace-pre-wrap break-words">{block.content.length > 200 ? block.content.slice(0, 200) + '...' : block.content}</span>
                    </div>
                  </div>
                );
              case 'thinking':
                return (
                  <div key={block.id}>
                    <button onClick={() => toggleCollapse(block.id)} className="flex items-center gap-1 text-[9px] text-purple-400/70 hover:text-purple-400">
                      <span>{block.collapsed ? '\u25B6' : '\u25BC'}</span> thinking...
                    </button>
                    {!block.collapsed && (
                      <div className="mt-0.5 ml-3 px-2 py-1 border-l border-purple-400/30 text-[10px] text-purple-300/60 whitespace-pre-wrap max-h-32 overflow-y-auto" style={mf}>{block.content}</div>
                    )}
                  </div>
                );
              case 'tool_use':
                return (
                  <div key={block.id} className="rounded bg-[#161b22] border border-[#21262d] px-2 py-1">
                    <div className="flex items-center gap-1 text-[10px] text-blue-400" style={mf}>
                      <span className="font-bold">{block.tool}</span>
                      <span className="text-[#8b949e] truncate flex-1">{block.content}</span>
                      {streaming && blocks[blocks.length - 1]?.id === block.id && <span className="w-2 h-2 border border-blue-400/50 border-t-transparent rounded-full animate-spin" />}
                    </div>
                  </div>
                );
              case 'tool_result':
                return (
                  <div key={block.id}>
                    <button onClick={() => toggleCollapse(block.id)} className="flex items-center gap-1 text-[9px] text-[#8b949e] hover:text-[#c9d1d9]">
                      <span>{block.collapsed ? '\u25B6' : '\u25BC'}</span>
                      <span className="text-green-400/40">\u2713</span> result ({block.content.length}c)
                    </button>
                    {!block.collapsed && (
                      <div className="mt-0.5 ml-3 px-2 py-1 bg-[#161b22] border border-[#21262d] rounded text-[9px] max-h-32 overflow-y-auto text-[#8b949e]" style={mf}>{block.content}</div>
                    )}
                  </div>
                );
              case 'text':
                return (
                  <div key={block.id}>
                    <span className="text-[9px] text-green-400 font-bold" style={mf}>{agentName}:</span>
                    <div className="text-[11px] text-[#c9d1d9] break-words leading-relaxed mt-0.5 prose prose-invert prose-sm max-w-none">
                      {renderTextContent(block.content)}
                      {streaming && blocks[blocks.length - 1]?.id === block.id && (
                        <span className="inline-block w-1 h-3 bg-green-400/70 ml-0.5 animate-pulse" />
                      )}
                    </div>
                  </div>
                );
              case 'error':
                return (
                  <div key={block.id} className="flex items-center gap-1.5 text-[10px] text-red-400/80" style={mf}>
                    <span>\u26A0</span> <span>{block.content}</span>
                  </div>
                );
              case 'result':
                return (
                  <div key={block.id} className="flex items-center gap-2 text-[8px] text-[#484f58] py-0.5" style={mf}>
                    <span>{block.turns}t</span>
                    <span>{((block.duration || 0) / 1000).toFixed(1)}s</span>
                    {block.cost != null && <span>${block.cost.toFixed(3)}</span>}
                  </div>
                );
              default: return null;
            }
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Actions bar (when proforma is ready) */}
        {latestHtml && !streaming && (
          <div className="px-4 py-2 border-t border-[#21262d] bg-[#161b22]">
            {showSendEmails ? (
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-[8px] text-digi-muted" style={pf}>Correos destinatarios</label>
                  <input value={sendEmails} onChange={e => setSendEmails(e.target.value)} placeholder="email1@ej.com, email2@ej.com"
                    className="w-full px-2 py-1.5 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                </div>
                <button onClick={saveAndSend} disabled={saving || !sendEmails.trim()}
                  className="px-3 py-1.5 text-[8px] bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors" style={pf}>
                  {saving ? '...' : 'Enviar'}
                </button>
                <button onClick={() => setShowSendEmails(false)} className="px-2 py-1.5 text-[8px] text-digi-muted border border-digi-border hover:text-digi-text" style={pf}>X</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={saveProforma} disabled={saving}
                  className="flex-1 px-3 py-1.5 text-[9px] bg-green-700 text-white hover:bg-green-600 disabled:opacity-50 transition-colors" style={pf}>
                  {saving ? '...' : 'Guardar'}
                </button>
                <button onClick={() => { setSendEmails(clientEmail); setShowSendEmails(true); }}
                  className="flex-1 px-3 py-1.5 text-[9px] bg-blue-700 text-white hover:bg-blue-600 transition-colors" style={pf}>
                  Guardar y Enviar
                </button>
                {!hasDocumentation && (
                  <button onClick={addDocumentation} disabled={streaming}
                    className="flex-1 px-3 py-1.5 text-[9px] bg-purple-700 text-white hover:bg-purple-600 disabled:opacity-50 transition-colors" style={pf}>
                    + Documentacion
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Input */}
        <div className="px-4 py-2.5 border-t border-[#21262d]">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
              placeholder={streaming ? 'Esperando respuesta...' : 'Escribe correcciones o indicaciones...'}
              disabled={streaming}
              className="flex-1 px-3 py-2 bg-[#0d1117] border border-[#21262d] text-[11px] text-[#c9d1d9] placeholder:text-[#484f58] focus:border-accent focus:outline-none disabled:opacity-50"
              style={mf}
            />
            <button onClick={() => sendMessage(input)} disabled={streaming || !input.trim()}
              className="px-3 py-2 text-[9px] text-accent-glow border border-accent/40 hover:bg-accent/10 disabled:opacity-30 transition-colors" style={pf}>
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

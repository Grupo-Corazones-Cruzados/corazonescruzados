'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { CitizenDef } from '@/types/world';
import AnimatedSprite from '@/components/shared/AnimatedSprite';
import MarkdownRenderer from '@/components/shared/MarkdownRenderer';

// Face crop config per sprite (same as world page bubbles)
const FACE_CROPS: Record<string, { srcX: number; srcY: number; srcW: number; srcH: number; flip?: boolean }> = {
  gabumon:   { srcX: 26, srcY: 25, srcW: 28, srcH: 28 },
  agumon:    { srcX: 21, srcY: 28, srcW: 28, srcH: 28 },
  gumdramon: { srcX: 14, srcY: 26, srcW: 28, srcH: 28, flip: true },
  shoutmon:  { srcX: 27, srcY: 21.5, srcW: 19, srcH: 19 },
  patamon:   { srcX: 23, srcY: 42, srcW: 22, srcH: 22 },
};

function FaceBubble({ sprite, size = 48 }: { sprite: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = size;
    canvas.height = size;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const crop = FACE_CROPS[sprite] || { srcX: 12, srcY: 14, srcW: 28, srcH: 28 };
      ctx.clearRect(0, 0, size, size);

      // Circular clip
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();

      // Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fill();

      ctx.imageSmoothingEnabled = false;
      if (crop.flip) {
        ctx.save();
        ctx.translate(size, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, crop.srcX, crop.srcY, crop.srcW, crop.srcH, 0, 0, size, size);
        ctx.restore();
      } else {
        ctx.drawImage(img, crop.srcX, crop.srcY, crop.srcW, crop.srcH, 0, 0, size, size);
      }

      // Border
      ctx.strokeStyle = '#1D9E75';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
      ctx.stroke();
    };
    img.src = `/api/assets/universal_assets/citizens/${sprite}_walk.png`;
  }, [sprite, size]);

  return <canvas ref={canvasRef} style={{ imageRendering: 'pixelated', width: size, height: size }} />;
}
import {
  X,
  Send,
  FolderOpen,
  Trash2,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Terminal,
  FileText,
  Pencil,
  Search,
  Code,
  CheckCircle2,
  Clock,
  ExternalLink,
  ImagePlus,
  CodeXml,
  Mic,
  MicOff,
  Link,
  Check,
} from 'lucide-react';

// Each block in the conversation
export interface ChatBlock {
  id: string;
  type: 'user' | 'thinking' | 'tool_use' | 'tool_result' | 'text' | 'error' | 'result';
  content: string;
  tool?: string;
  input?: any;
  collapsed?: boolean;
  cost?: number;
  duration?: number;
  turns?: number;
}

interface ChatPanelProps {
  citizen: CitizenDef;
  onClose: () => void;
  blocks: ChatBlock[];
  onBlocksChange: (blocks: ChatBlock[]) => void;
  onOpenPreview?: (title: string, url: string, projectPath?: string) => void;
  externalMessage?: string | null;
  onExternalMessageConsumed?: () => void;
}

const TOOL_ICONS: Record<string, typeof Terminal> = {
  Bash: Terminal,
  Read: FileText,
  Edit: Pencil,
  Write: Pencil,
  Grep: Search,
  Glob: Search,
  Agent: Code,
};

function ToolIcon({ name }: { name: string }) {
  const Icon = TOOL_ICONS[name] || Code;
  return <Icon size={12} />;
}

function formatToolInput(tool: string, input: any): string {
  if (!input) return '';
  if (tool === 'Bash') return input.command || '';
  if (tool === 'Read') return input.file_path || '';
  if (tool === 'Edit') return input.file_path || '';
  if (tool === 'Write') return input.file_path || '';
  if (tool === 'Grep') return `${input.pattern || ''} ${input.path || ''}`.trim();
  if (tool === 'Glob') return input.pattern || '';
  return JSON.stringify(input).slice(0, 120);
}

export default function ChatPanel({ citizen, onClose, blocks, onBlocksChange, onOpenPreview, externalMessage, onExternalMessageConsumed }: ChatPanelProps) {
  const blocksRef = useRef(blocks);
  // Only sync ref from prop when NOT streaming (to avoid overwriting in-flight updates)
  const streamingRef = useRef(false);
  if (!streamingRef.current) {
    blocksRef.current = blocks;
  }

  const setBlocks = useCallback((update: ChatBlock[] | ((prev: ChatBlock[]) => ChatBlock[])) => {
    const next = typeof update === 'function' ? update(blocksRef.current) : update;
    blocksRef.current = next;
    onBlocksChange(next);
  }, [onBlocksChange]);

  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const runIdRef = useRef<string | null>(null);
  const eventIndexRef = useRef(0);
  const reconnectingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [projectPath, setProjectPath] = useState('');
  const [previewPort, setPreviewPort] = useState<number | null>(null);
  const [productionUrl, setProductionUrl] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [attachedImages, setAttachedImages] = useState<{ name: string; path: string; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [showAppLinkInput, setShowAppLinkInput] = useState(false);
  const [appLinkDraft, setAppLinkDraft] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const idCounter = useRef(0);
  // On mount, start counter after highest existing ID
  useEffect(() => {
    let max = 0;
    for (const b of blocks) {
      const m = b.id.match(/^block-(\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1]));
    }
    idCounter.current = max;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const newId = () => `block-${Date.now()}-${++idCounter.current}`;

  useEffect(() => {
    // Reset all internal state when switching characters
    setProjectPath('');
    setPreviewPort(null);
    setProductionUrl(null);
    setStreaming(false);
    streamingRef.current = false;
    setError(null);
    setInput('');
    setAttachedImages([]);
    fetch('/api/agent-links')
      .then(r => r.json())
      .then(config => {
        const c = config[citizen.agentId];
        if (c?.projectPath) setProjectPath(c.projectPath);
        if (c?.port) setPreviewPort(c.port);
        if (c?.productionUrl) setProductionUrl(c.productionUrl);
      })
      .catch(() => {});
  }, [citizen.agentId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [blocks]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const saveSettings = async (path: string, port: number | null) => {
    setProjectPath(path);
    setPreviewPort(port);
    try {
      await fetch('/api/agent-links', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: citizen.agentId, projectPath: path, port: port || undefined }),
      });
    } catch {}
  };

  const saveAppLink = async (url: string) => {
    const trimmed = url.trim();
    setProductionUrl(trimmed || null);
    setShowAppLinkInput(false);
    setAppLinkDraft('');
    try {
      await fetch('/api/agent-links', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: citizen.agentId, productionUrl: trimmed || '' }),
      });
    } catch {}
  };

  const uploadImage = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/chat-upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const preview = URL.createObjectURL(file);
      setAttachedImages(prev => [...prev, { name: file.name, path: data.path, preview }]);
    } catch (e: any) {
      setError(`Upload failed: ${e.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) uploadImage(file);
        return;
      }
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    for (const file of e.dataTransfer.files) {
      if (file.type.startsWith('image/')) uploadImage(file);
    }
  }, []);

  const toggleMic = useCallback(async () => {
    if (recording) {
      // Stop recording and send to Whisper
      const recorder = mediaRecorderRef.current;
      mediaRecorderRef.current = null;
      recorder?.stop();
      setRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const opts: MediaRecorderOptions = {};
      if (MediaRecorder.isTypeSupported('audio/webm')) opts.mimeType = 'audio/webm';
      const recorder = new MediaRecorder(stream, opts);
      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const chunks = audioChunksRef.current;
        if (chunks.length === 0) return;

        const blob = new Blob(chunks, { type: recorder.mimeType });
        setTranscribing(true);

        try {
          const form = new FormData();
          form.append('audio', blob);
          form.append('mimeType', recorder.mimeType);
          const res = await fetch('/api/transcribe', { method: 'POST', body: form });
          const data = await res.json();
          if (data.text) {
            setInput(prev => prev ? `${prev} ${data.text}` : data.text);
          } else if (data.error) {
            setError(data.error);
          }
        } catch (e: any) {
          setError('Error transcribing audio');
        } finally {
          setTranscribing(false);
        }
      };

      recorder.start();
      setRecording(true);
    } catch {
      setError('Microphone access denied');
    }
  }, [recording]);

  const toggleCollapse = (id: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, collapsed: !b.collapsed } : b));
  };

  // Use ref so sendMessage always has the latest values
  const projectPathRef = useRef(projectPath);
  projectPathRef.current = projectPath;
  const citizenRef = useRef(citizen);
  citizenRef.current = citizen;

  const sendMessage = useCallback(async () => {
    const msg = input.trim();
    if (!msg || streaming) return;

    setInput('');
    setError(null);
    setStreaming(true);
    streamingRef.current = true;

    // Build message with image references
    const imageRefs = attachedImages.map(img => img.path);
    const displayContent = attachedImages.length > 0
      ? `${msg}\n[${attachedImages.map(i => i.name).join(', ')}]`
      : msg;

    let fullMessage = msg;
    if (imageRefs.length > 0) {
      const imagePaths = imageRefs.map(p => `"${p}"`).join(', ');
      fullMessage = `${msg}\n\n[The user has attached ${imageRefs.length} image(s). Read them with the Read tool to see them: ${imagePaths}]`;
    }

    const userBlock: ChatBlock = { id: newId(), type: 'user', content: displayContent };
    setBlocks(prev => [...prev, userBlock]);
    setAttachedImages([]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: citizenRef.current.agentId,
          agentName: citizenRef.current.name,
          message: fullMessage,
          projectPath: projectPathRef.current || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Chat failed');
      }

      await readSSEStream(res.body!.getReader());
    } catch (e: any) {
      // If connection dropped but we have a runId, don't error — we'll reconnect
      if (runIdRef.current && streamingRef.current) return;
      setError(e.message);
    } finally {
      if (!reconnectingRef.current) {
        setStreaming(false);
        streamingRef.current = false;
        runIdRef.current = null;
        eventIndexRef.current = 0;
      }
      inputRef.current?.focus();
    }
  }, [input, streaming, citizen, projectPath]);

  // ─── Shared SSE stream reader ───
  const textStateRef = useRef<{ currentTextBlockId: string | null; accumulatedText: string }>({
    currentTextBlockId: null, accumulatedText: '',
  });

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
        if (data === '[DONE]') {
          runIdRef.current = null;
          continue;
        }

        eventIndexRef.current++;

        try {
          const parsed = JSON.parse(data);

          // Capture runId for reconnection
          if (parsed.type === 'run_id') {
            runIdRef.current = parsed.runId;
            continue;
          }

          switch (parsed.type) {
            case 'thinking': {
              setBlocks(prev => [...prev, {
                id: newId(),
                type: 'thinking',
                content: parsed.text,
                collapsed: true,
              }]);
              ts.currentTextBlockId = null;
              break;
            }
            case 'tool_use': {
              setBlocks(prev => [...prev, {
                id: newId(),
                type: 'tool_use',
                content: formatToolInput(parsed.tool, parsed.input),
                tool: parsed.tool,
                input: parsed.input,
                collapsed: false,
              }]);
              ts.currentTextBlockId = null;
              break;
            }
            case 'tool_result': {
              setBlocks(prev => [...prev, {
                id: newId(),
                type: 'tool_result',
                content: parsed.result || '(empty result)',
                collapsed: true,
              }]);
              ts.currentTextBlockId = null;
              break;
            }
            case 'text': {
              if (ts.currentTextBlockId) {
                ts.accumulatedText += parsed.text;
                const capturedText = ts.accumulatedText;
                const capturedId = ts.currentTextBlockId;
                setBlocks(prev => prev.map(b =>
                  b.id === capturedId ? { ...b, content: capturedText } : b
                ));
              } else {
                ts.accumulatedText = parsed.text;
                const id = newId();
                ts.currentTextBlockId = id;
                setBlocks(prev => [...prev, {
                  id,
                  type: 'text',
                  content: parsed.text,
                }]);
              }
              break;
            }
            case 'error': {
              setBlocks(prev => [...prev, {
                id: newId(),
                type: 'error',
                content: parsed.text,
              }]);
              ts.currentTextBlockId = null;
              break;
            }
            case 'result': {
              setBlocks(prev => [...prev, {
                id: newId(),
                type: 'result',
                content: '',
                cost: parsed.cost,
                duration: parsed.duration,
                turns: parsed.turns,
              }]);
              break;
            }
          }
        } catch (parseErr: any) {
          if (parseErr.message && !parseErr.message.includes('JSON')) {
            throw parseErr;
          }
        }
      }
    }
  }, [setBlocks]);

  // ─── Reconnect on visibility change (iOS Safari background resume) ───
  const reconnect = useCallback(async () => {
    if (!runIdRef.current || !streamingRef.current || reconnectingRef.current) return;
    reconnectingRef.current = true;
    try {
      const res = await fetch(`/api/chat?runId=${runIdRef.current}&from=${eventIndexRef.current}`);
      if (!res.ok) {
        // Run expired or finished while away
        setStreaming(false);
        streamingRef.current = false;
        runIdRef.current = null;
        return;
      }
      await readSSEStream(res.body!.getReader());
    } catch {
      // Connection failed, will retry on next visibility change
    } finally {
      reconnectingRef.current = false;
      if (!runIdRef.current) {
        setStreaming(false);
        streamingRef.current = false;
        eventIndexRef.current = 0;
      }
    }
  }, [readSSEStream]);

  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible' && streamingRef.current && runIdRef.current) {
        reconnect();
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [reconnect]);

  // Handle external voice messages
  const externalProcessedRef = useRef<string | null>(null);
  useEffect(() => {
    if (externalMessage && !streaming && externalProcessedRef.current !== externalMessage) {
      externalProcessedRef.current = externalMessage;
      setInput(externalMessage);
      onExternalMessageConsumed?.();
      // Delay to let input state update, then send
      setTimeout(() => {
        const fakeInput = externalMessage;
        setInput('');
        setError(null);
        setStreaming(true);
        streamingRef.current = true;

        const userBlock: ChatBlock = { id: newId(), type: 'user', content: fakeInput };
        setBlocks(prev => [...prev, userBlock]);

        fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId: citizenRef.current.agentId,
            agentName: citizenRef.current.name,
            message: fakeInput,
            projectPath: projectPathRef.current || undefined,
          }),
        }).then(async (res) => {
          if (!res.ok) throw new Error('Chat failed');
          const reader = res.body?.getReader();
          if (!reader) return;
          const decoder = new TextDecoder();
          let currentTextBlockId: string | null = null;
          let accumulatedText = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value, { stream: true });
            for (const line of text.split('\n')) {
              if (!line.startsWith('data: ')) continue;
              const payload = line.slice(6);
              if (payload === '[DONE]') break;
              try {
                const parsed = JSON.parse(payload);
                if (parsed.type === 'text') {
                  if (currentTextBlockId) {
                    accumulatedText += parsed.text;
                    const t = accumulatedText, id = currentTextBlockId;
                    setBlocks(prev => prev.map(b => b.id === id ? { ...b, content: t } : b));
                  } else {
                    accumulatedText = parsed.text;
                    const id = newId();
                    currentTextBlockId = id;
                    setBlocks(prev => [...prev, { id, type: 'text', content: parsed.text }]);
                  }
                } else if (parsed.type === 'result') {
                  setBlocks(prev => [...prev, { id: newId(), type: 'result', content: '', cost: parsed.cost, duration: parsed.duration, turns: parsed.turns }]);
                }
              } catch {}
            }
          }
        }).catch((e) => setError(e.message))
          .finally(() => { setStreaming(false); streamingRef.current = false; });
      }, 50);
    }
  }, [externalMessage]);

  const clearChat = () => {
    setBlocks([]);
    setError(null);
  };

  return (
    <div className="flex flex-col h-full text-[#c9d1d9] overflow-hidden max-w-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1 shrink-0 border-b border-[#21262d]">
        {projectPath && (
          <button
            onClick={() => {
              fetch('/api/open-vscode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectPath }),
              }).catch(() => {});
            }}
            className="p-1 rounded text-[#8b949e] hover:text-blue-400"
            title="Open in VS Code"
          >
            <CodeXml size={12} />
          </button>
        )}
        {productionUrl ? (
          <div className="flex items-center">
            <a
              href={productionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded text-digi-green hover:text-digi-green/80 flex items-center gap-0.5"
              title={productionUrl}
            >
              <ExternalLink size={12} />
              <span className="text-[9px] font-mono">App</span>
            </a>
            <button
              onClick={() => { setShowAppLinkInput(true); setAppLinkDraft(productionUrl); }}
              className="p-0.5 rounded text-[#484f58] hover:text-[#8b949e]"
              title="Editar enlace"
            >
              <Pencil size={8} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setShowAppLinkInput(true); setAppLinkDraft(''); }}
            className="p-1 rounded text-[#8b949e] hover:text-digi-green flex items-center gap-0.5"
            title="Agregar enlace de app"
          >
            <Link size={12} />
            <span className="text-[9px] font-mono">+ App</span>
          </button>
        )}
        {previewPort && onOpenPreview && (
          <button
            onClick={() => {
              const name = projectPath.split('/').pop() || 'Preview';
              onOpenPreview(`${name} :${previewPort}`, `http://localhost:${previewPort}`, projectPath);
            }}
            className="p-1 rounded text-[#8b949e] hover:text-blue-400"
            title={`Open localhost:${previewPort}`}
          >
            <ExternalLink size={12} />
          </button>
        )}
        <button onClick={() => setShowSettings(!showSettings)} className="p-1 rounded text-[#8b949e] hover:text-[#c9d1d9]" title="Settings">
          <FolderOpen size={12} />
        </button>
        <button onClick={clearChat} className="p-1 rounded text-[#8b949e] hover:text-[#c9d1d9]" title="Clear">
          <Trash2 size={12} />
        </button>
      </div>

      {/* Settings */}
      {showSettings && (
        <div className="px-2 pb-1.5 shrink-0 space-y-1">
          <input
            type="text"
            value={projectPath}
            onChange={e => setProjectPath(e.target.value)}
            placeholder="/path/to/project"
            className="w-full px-2 py-1 bg-[#0d1117] border border-[#30363d] rounded text-[10px] font-mono text-[#c9d1d9] focus:outline-none focus:border-digi-green/50"
          />
          <div className="flex gap-1.5 items-center">
            <span className="text-[9px] text-white/30 font-mono">Port:</span>
            <input
              type="number"
              value={previewPort || ''}
              onChange={e => setPreviewPort(e.target.value ? parseInt(e.target.value) : null)}
              placeholder="3000"
              className="w-16 px-2 py-1 bg-[#0d1117] border border-[#30363d] rounded text-[10px] font-mono text-[#c9d1d9] focus:outline-none focus:border-digi-green/50"
            />
            <button
              onClick={() => { saveSettings(projectPath, previewPort); setShowSettings(false); }}
              className="px-2 py-1 bg-digi-green/20 border border-digi-green/30 rounded text-[10px] text-digi-green ml-auto"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* App link input */}
      {showAppLinkInput && (
        <div className="px-2 py-1.5 shrink-0 border-b border-[#21262d]">
          <div className="flex gap-1 items-center">
            <Link size={10} className="text-digi-green shrink-0" />
            <input
              type="url"
              value={appLinkDraft}
              onChange={e => setAppLinkDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveAppLink(appLinkDraft); if (e.key === 'Escape') setShowAppLinkInput(false); }}
              placeholder="https://mi-app.vercel.app"
              autoFocus
              className="flex-1 min-w-0 px-2 py-1 bg-[#0d1117] border border-[#30363d] rounded text-[10px] font-mono text-[#c9d1d9] focus:outline-none focus:border-digi-green/50"
            />
            <button
              onClick={() => saveAppLink(appLinkDraft)}
              disabled={!appLinkDraft.trim()}
              className="p-1 text-digi-green hover:text-digi-green/80 disabled:opacity-30"
              title="Guardar"
            >
              <Check size={12} />
            </button>
            <button
              onClick={() => setShowAppLinkInput(false)}
              className="p-1 text-[#8b949e] hover:text-red-400"
              title="Cancelar"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Conversation blocks */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-1 space-y-1.5 min-w-0">
        {blocks.length === 0 && (
          <div className="flex items-center gap-2 py-3 px-1">
            <div className="shrink-0">
              <FaceBubble sprite={citizen.sprite} size={48} />
            </div>
            <div>
              <p className="text-[11px] text-[#8b949e]">
                Chat with <span className="text-digi-green">{citizen.name}</span>
              </p>
              <p className="text-[9px] text-[#484f58] font-mono">
                {projectPath ? projectPath.split('/').pop() : 'No project linked'}
              </p>
            </div>
          </div>
        )}

        {blocks.map(block => {
          switch (block.type) {
            case 'user':
              return (
                <div key={block.id} className="flex justify-end">
                  <div className="max-w-[90%] rounded px-2.5 py-1.5 text-[11px] bg-[#1f2937] text-[#c9d1d9]">
                    <span className="whitespace-pre-wrap">{block.content}</span>
                  </div>
                </div>
              );

            case 'thinking':
              return (
                <div key={block.id}>
                  <button
                    onClick={() => toggleCollapse(block.id)}
                    className="flex items-center gap-1 text-[9px] text-purple-400/70 hover:text-purple-400 font-mono"
                  >
                    {block.collapsed ? <ChevronRight size={8} /> : <ChevronDown size={8} />}
                    <Clock size={8} />
                    thinking...
                  </button>
                  {!block.collapsed && (
                    <div className="mt-0.5 ml-3 px-2 py-1 border-l border-purple-400/30 text-[10px] text-[#8b949e] font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {block.content}
                    </div>
                  )}
                </div>
              );

            case 'tool_use':
              return (
                <div key={block.id} className="rounded bg-[#161b22] border border-[#21262d] px-2 py-1">
                  <div className="flex items-center gap-1 text-[10px] text-blue-400 font-mono">
                    <ToolIcon name={block.tool || ''} />
                    <span className="font-bold">{block.tool}</span>
                    <span className="text-[#8b949e] truncate flex-1">{block.content}</span>
                    {streaming && <Loader2 size={8} className="animate-spin text-blue-400/50" />}
                  </div>
                  {block.input && block.tool === 'Bash' && block.input.command && (
                    <code className="text-[9px] font-mono text-yellow-300/80 block mt-0.5 truncate">$ {block.input.command}</code>
                  )}
                </div>
              );

            case 'tool_result':
              return (
                <div key={block.id}>
                  <button
                    onClick={() => toggleCollapse(block.id)}
                    className="flex items-center gap-1 text-[9px] text-[#8b949e]/60 hover:text-[#8b949e] font-mono"
                  >
                    {block.collapsed ? <ChevronRight size={8} /> : <ChevronDown size={8} />}
                    <CheckCircle2 size={8} className="text-green-400/40" />
                    result ({block.content.length}c)
                  </button>
                  {!block.collapsed && (
                    <div className="mt-0.5 ml-3 px-2 py-1 bg-[#161b22] border border-[#21262d] rounded text-[9px] font-mono text-[#8b949e] whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {block.content}
                    </div>
                  )}
                </div>
              );

            case 'text':
              return (
                <div key={block.id}>
                  <span className="text-[9px] text-digi-green font-bold font-mono">{citizen.name}:</span>
                  <div className="text-[11px] text-[#c9d1d9] break-words leading-relaxed mt-0.5">
                    <MarkdownRenderer content={block.content} />
                    {streaming && blocks[blocks.length - 1]?.id === block.id && (
                      <span className="inline-block w-1 h-3 bg-digi-green/70 ml-0.5 animate-pulse" />
                    )}
                  </div>
                </div>
              );

            case 'error':
              return (
                <div key={block.id} className="flex items-center gap-1.5 text-[10px] text-red-400/80 font-mono">
                  <AlertCircle size={10} />
                  <span className="truncate">{block.content}</span>
                </div>
              );

            case 'result':
              return (
                <div key={block.id} className="flex items-center gap-2 text-[8px] font-mono text-[#484f58] py-0.5">
                  <span>{block.turns}t</span>
                  <span>{((block.duration || 0) / 1000).toFixed(1)}s</span>
                  {block.cost != null && <span>${block.cost.toFixed(3)}</span>}
                </div>
              );

            default:
              return null;
          }
        })}

        {streaming && blocks.length > 0 && blocks[blocks.length - 1]?.type !== 'text' && (
          <div className="flex items-center gap-1.5 text-[9px] text-[#8b949e] font-mono">
            <Loader2 size={8} className="animate-spin" />
            processing...
          </div>
        )}

        {error && (
          <div className="text-[10px] text-red-400/70 font-mono">{error}</div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="px-2 py-1.5 shrink-0" onDrop={handleDrop} onDragOver={e => e.preventDefault()}>
        {attachedImages.length > 0 && (
          <div className="flex gap-1.5 mb-1">
            {attachedImages.map((img, i) => (
              <div key={i} className="relative group">
                <img src={img.preview} alt={img.name} className="w-10 h-10 object-cover rounded border border-white/10" />
                <button
                  onClick={() => setAttachedImages(prev => prev.filter((_, j) => j !== i))}
                  className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100"
                >
                  <X size={7} className="text-white" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1">
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
            onChange={e => { for (const file of e.target.files || []) uploadImage(file); e.target.value = ''; }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={streaming || uploading}
            className="p-2 text-[#8b949e] active:text-[#c9d1d9] disabled:opacity-30 shrink-0"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
          </button>
          <button
            onClick={toggleMic}
            disabled={streaming || transcribing}
            className={`p-2 shrink-0 transition-colors ${
              recording
                ? 'text-red-400 animate-pulse'
                : transcribing
                  ? 'text-yellow-400 animate-pulse'
                  : 'text-[#8b949e] active:text-[#c9d1d9]'
            } disabled:opacity-30`}
            title={recording ? 'Stop & transcribe' : transcribing ? 'Transcribing...' : 'Voice input'}
          >
            {transcribing ? <Loader2 size={16} className="animate-spin" /> : recording ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
          <input
            ref={inputRef as any}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendMessage(); } }}
            onPaste={handlePaste as any}
            placeholder={`Message ${citizen.name}...`}
            className="flex-1 min-w-0 px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg text-[13px] text-[#c9d1d9] placeholder:text-[#484f58] focus:outline-none focus:border-digi-green/50"
            disabled={streaming}
          />
          <button
            onClick={sendMessage}
            disabled={streaming || !input.trim()}
            className="p-2 text-digi-green active:text-digi-green disabled:opacity-20 shrink-0"
          >
            {streaming ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}

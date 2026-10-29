'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import PageHeader from '@/components/ui/PageHeader';
import FilterRail from '@/components/ui/FilterRail';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelSelect from '@/components/ui/PixelSelect';
import PixelModal from '@/components/ui/PixelModal';
import { useConsultaMedia, PANTALLA_XL } from '@/lib/hooks/useConsultaMedia';
import { fmt2 } from '@/lib/format';
import PanelCompartirEnlace from '@/components/ui/PanelCompartirEnlace';
import Interruptor from '@/components/ui/Interruptor';
import PanelHastaElPie from '@/components/ui/PanelHastaElPie';
import BarraLista from '@/components/ui/BarraLista';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { EditField, EDIT_INPUT } from '@/components/ui/EditDialog';
import AutoGrowTextarea from '@/components/ui/AutoGrowTextarea';
import { ListaSubidas, useSubidaArchivos } from '@/components/ui/SubidaArchivos';
import {
  Repeat2, Captions, UploadCloud, Download, CheckCircle2, LayoutGrid, Wand2, Wrench,
  Briefcase, Link2, Plus, Table2, PackageOpen, QrCode, Smartphone, MonitorDown, Printer, Share2, ExternalLink,
} from 'lucide-react';
import GeneradorQR from '@/components/herramientas/GeneradorQR';
import AppMovil from '@/components/herramientas/AppMovil';
import { useAuth } from '@/components/providers/AuthProvider';
import { accessRoleOf } from '@/lib/dashboard/access';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

/** `compartible`: el equipo puede compartirla por enlace con token (`lib/herramientas/accesos`).
 * `soloEquipo`: miembros y admin. Los candidatos usan las demás (las de «un solo uso» atan
 * clientes de GCC y guardan en el Drive de la empresa; sus APIs exigen `esEquipo`). */
type Tool = { id: string; name: string; Icon: any; description: string; category: string; soloEquipo?: boolean; compartible?: boolean };

// Categorías (tipos de herramienta).
const CATEGORIES = [
  { value: 'all', label: 'Todas', Icon: LayoutGrid },
  { value: 'edicion', label: 'Edición', Icon: Wand2 },
  { value: 'gestion', label: 'Gestión', Icon: Briefcase },
  { value: 'app', label: 'Apps para el teléfono', Icon: Smartphone },
];

const CATEGORY_LABEL: Record<string, string> = { edicion: 'Herramienta de edición', gestion: 'Herramienta de gestión', app: 'App para el teléfono' };

// Vigencias del enlace de un solo uso: se cierra al responder o al vencer, lo que pase antes.
const VIGENCIAS = [
  { v: 24, l: '1 día' }, { v: 72, l: '3 días' }, { v: 168, l: '1 semana' }, { v: 720, l: '1 mes' },
];
// Un acceso a una herramienta no se gasta: sirve hasta que vence, así que admite plazos largos.
const VIGENCIAS_ACCESO = [...VIGENCIAS, { v: 2160, l: '3 meses' }, { v: 8760, l: '1 año' }];

type ClienteConCuenta = { id: number; nombre: string; email: string };

const TOOLS: Tool[] = [
  { id: 'convert', name: 'Convertir Archivos', Icon: Repeat2, category: 'edicion', description: 'Convierte archivos de audio entre formatos (M4A, MP4, WAV, OGG → MP3, etc.).' },
  { id: 'transcribe', name: 'Transcribir Audio', Icon: Captions, category: 'edicion', description: 'Transcribe archivos de audio a texto usando inteligencia artificial (Whisper).' },
  { id: 'formatos-excel', name: 'Formatos de impresión para Excel', Icon: Printer, category: 'edicion', compartible: true, description: 'Corrige la impresión de un libro de Excel (papel, márgenes, títulos y número de página) y lo descarga en Excel o PDF.' },
  { id: 'qr', name: 'Enlace a código QR', Icon: QrCode, category: 'edicion', description: 'Convierte un enlace en un código QR para descargar en PNG o SVG.' },
  { id: 'enlace-unico', name: 'Enlace de un solo uso', Icon: Link2, category: 'gestion', soloEquipo: true, description: 'Pide un texto y hasta 10 archivos con un enlace que se cierra al recibir la respuesta.' },
  { id: 'descargador-video', name: 'Descargador de video', Icon: MonitorDown, category: 'app', description: 'App para Android que guarda en el teléfono videos o audio a partir de un enlace.' },
  { id: 'entrega-unica', name: 'Entrega de un solo uso', Icon: PackageOpen, category: 'gestion', soloEquipo: true, description: 'Envía un mensaje y hasta 10 archivos con un enlace que se cierra cuando lo descargan.' },
];

const CONVERSIONS: Record<string, string[]> = {
  m4a: ['mp3'], mp4: ['mp3'], wav: ['mp3'], ogg: ['mp3'], webm: ['mp3'], mp3: ['wav', 'ogg'],
};

export default function ToolsPage() {
  const { user } = useAuth();
  const rol = accessRoleOf(user);
  const esEquipo = rol === 'admin' || rol === 'member';
  const tools = useMemo(() => TOOLS.filter((t) => !t.soloEquipo || esEquipo), [esEquipo]);
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('all');
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  // `?herramienta=<id>` la deja abierta (el QR de las apps para el teléfono apunta aquí).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('herramienta');
    if (id && tools.some((t) => t.id === id)) setSelectedTool(id);
  }, [tools]);

  // Convert state
  const [convertFrom, setConvertFrom] = useState('m4a');
  const [convertTo, setConvertTo] = useState('mp3');
  const [convertFile, setConvertFile] = useState<File | null>(null);
  const [converting, setConverting] = useState(false);
  const [convertProgress, setConvertProgress] = useState(0);
  const [convertResult, setConvertResult] = useState<{ blob: Blob; name: string } | null>(null);
  const convertInputRef = useRef<HTMLInputElement>(null);

  // Transcribe state
  const [transcribeFile, setTranscribeFile] = useState<File | null>(null);
  const [transcribePhase, setTranscribePhase] = useState<'idle' | 'processing' | 'done'>('idle');
  const [transcribeProgress, setTranscribeProgress] = useState(0);
  const [transcribeResult, setTranscribeResult] = useState<{ blob: Blob; name: string } | null>(null);
  const transcribeInputRef = useRef<HTMLInputElement>(null);

  // Enlace de un solo uso (lo que el panel compartido no trae: título, indicaciones, cliente)
  const [enlaceOpen, setEnlaceOpen] = useState(false);
  const [enlaceTitulo, setEnlaceTitulo] = useState('');
  const [enlaceIndicaciones, setEnlaceIndicaciones] = useState('');
  const [enlaceExigeCuenta, setEnlaceExigeCuenta] = useState(false);
  const [enlaceCliente, setEnlaceCliente] = useState('');
  const [clientesConCuenta, setClientesConCuenta] = useState<ClienteConCuenta[] | null>(null);

  useEffect(() => {
    if (!enlaceOpen || clientesConCuenta) return;
    fetch('/api/enlaces/clientes').then((r) => r.json()).then((d) => setClientesConCuenta(d.data || [])).catch(() => setClientesConCuenta([]));
  }, [enlaceOpen, clientesConCuenta]);

  const abrirEnlace = () => {
    setEnlaceTitulo(''); setEnlaceIndicaciones(''); setEnlaceExigeCuenta(false); setEnlaceCliente('');
    setEnlaceOpen(true);
  };
  const clienteElegido = clientesConCuenta?.find((c) => String(c.id) === enlaceCliente);

  // Compartir el acceso a una herramienta (Fernando, 2026-10-27): el mismo formulario del enlace,
  // con «para quién» en vez de título y sin texto que pedir. Ver `lib/herramientas/accesos`.
  const [accesoOpen, setAccesoOpen] = useState(false);
  const [accesoTitulo, setAccesoTitulo] = useState('');
  const [accesoExigeCuenta, setAccesoExigeCuenta] = useState(false);
  const [accesoCliente, setAccesoCliente] = useState('');
  useEffect(() => {
    if (!accesoOpen || clientesConCuenta) return;
    fetch('/api/enlaces/clientes').then((r) => r.json()).then((d) => setClientesConCuenta(d.data || [])).catch(() => setClientesConCuenta([]));
  }, [accesoOpen, clientesConCuenta]);
  const abrirAcceso = () => {
    setAccesoTitulo(''); setAccesoExigeCuenta(false); setAccesoCliente('');
    setAccesoOpen(true);
  };
  const clienteAcceso = clientesConCuenta?.find((c) => String(c.id) === accesoCliente);

  // Entrega de un solo uso (Fernando, 2026-10-19): misma forma que el enlace, pero los archivos
  // los sube el miembro. Se suben al elegirlos, a un BORRADOR que nace con el primero; si el
  // panel se cierra sin generar, el borrador se descarta. Ver `lib/entregas`.
  const [entregaOpen, setEntregaOpen] = useState(false);
  const [entregaTitulo, setEntregaTitulo] = useState('');
  const [entregaMensaje, setEntregaMensaje] = useState('');
  const [entregaExigeCuenta, setEntregaExigeCuenta] = useState(false);
  const [entregaCliente, setEntregaCliente] = useState('');
  const entregaId = useRef<Promise<number> | null>(null);
  const entregaPublicada = useRef(false);
  const borradorEntrega = () => {
    if (!entregaId.current) {
      entregaId.current = fetch('/api/entregas', { method: 'POST' }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) { entregaId.current = null; throw new Error(d.error || 'No se pudo preparar la entrega'); }
        return d.data.id as number;
      });
    }
    return entregaId.current;
  };
  const subidaEntrega = useSubidaArchivos(async (archivo) => {
    const id = await borradorEntrega();
    const r = await fetch(`/api/entregas/${id}/subida`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: archivo.name, tipo: archivo.type, tamano: archivo.size }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'No se pudo subir');
    return d.data.url;
  });
  useEffect(() => {
    if (!entregaOpen || clientesConCuenta) return;
    fetch('/api/enlaces/clientes').then((r) => r.json()).then((d) => setClientesConCuenta(d.data || [])).catch(() => setClientesConCuenta([]));
  }, [entregaOpen, clientesConCuenta]);
  const abrirEntrega = () => {
    setEntregaTitulo(''); setEntregaMensaje(''); setEntregaExigeCuenta(false); setEntregaCliente('');
    subidaEntrega.setItems([]);
    entregaId.current = null; entregaPublicada.current = false;
    setEntregaOpen(true);
  };
  const cerrarEntrega = () => {
    if (subidaEntrega.subiendo) { toast.error('Espera a que terminen de subir los archivos'); return; }
    setEntregaOpen(false);
    // Sin generar: el borrador y sus archivos sobran (van a la papelera de Drive).
    const p = entregaId.current;
    if (p && !entregaPublicada.current) p.then((id) => fetch(`/api/entregas/${id}`, { method: 'DELETE' })).catch(() => {});
  };
  const clienteEntrega = clientesConCuenta?.find((c) => String(c.id) === entregaCliente);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: tools.length };
    for (const t of tools) c[t.category] = (c[t.category] || 0) + 1;
    return c;
  }, [tools]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tools.filter((t) => {
      if (cat !== 'all' && t.category !== cat) return false;
      if (q && !t.name.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [cat, search, tools]);

  const resetConvert = () => { setConvertFrom('m4a'); setConvertTo('mp3'); setConvertFile(null); setConverting(false); setConvertProgress(0); setConvertResult(null); };
  const resetTranscribe = () => { setTranscribeFile(null); setTranscribePhase('idle'); setTranscribeProgress(0); setTranscribeResult(null); };

  const selectTool = (id: string) => {
    setSelectedTool(id);
    if (id === 'convert') resetConvert();
    else if (id === 'transcribe') resetTranscribe();
  };

  const triggerDownload = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  // --- Convert ---
  const handleConvert = async () => {
    if (!convertFile) return;
    setConverting(true); setConvertProgress(0); setConvertResult(null);
    const interval = setInterval(() => setConvertProgress(prev => Math.min(prev + Math.random() * 8, 90)), 300);
    try {
      const formData = new FormData();
      formData.append('file', convertFile);
      formData.append('from', convertFrom);
      formData.append('to', convertTo);
      const res = await fetch('/api/tools/convert', { method: 'POST', body: formData });
      clearInterval(interval);
      if (!res.ok) {
        let msg = 'Error al convertir';
        try { const err = await res.json(); msg = err.error || msg; } catch { /* response wasn't JSON */ }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const name = convertFile.name.replace(/\.[^.]+$/, '') + '.' + convertTo;
      setConvertProgress(100);
      setConvertResult({ blob, name });
      triggerDownload(blob, name);
      toast.success('Conversión completada');
    } catch (err: any) {
      clearInterval(interval);
      toast.error(err.message || 'Error al convertir');
      setConvertProgress(0);
      setConverting(false);
    }
  };

  // --- Transcribe (server-side via /api/tools/transcribe with FFmpeg segmentation) ---
  const handleTranscribe = async () => {
    if (!transcribeFile) return;
    setTranscribePhase('processing'); setTranscribeProgress(0); setTranscribeResult(null);
    const progressInterval = setInterval(() => setTranscribeProgress(prev => Math.min(prev + Math.random() * 6, 90)), 500);
    try {
      const form = new FormData();
      form.append('file', transcribeFile);
      const res = await fetch('/api/tools/transcribe', { method: 'POST', body: form });
      clearInterval(progressInterval);
      if (!res.ok) {
        let msg = 'Error al transcribir';
        try { const err = await res.json(); msg = err.error || msg; } catch {}
        throw new Error(msg);
      }
      const blob = await res.blob();
      const name = transcribeFile.name.replace(/\.[^.]+$/, '') + '.txt';
      setTranscribeProgress(100);
      setTranscribeResult({ blob, name });
      setTranscribePhase('done');
      triggerDownload(blob, name);
      toast.success('Transcripción completada');
    } catch (err: any) {
      clearInterval(progressInterval);
      toast.error(err.message || 'Error al transcribir');
      setTranscribeProgress(0);
      setTranscribePhase('idle');
    }
  };

  const ProgressBar = ({ value, done }: { value: number; done?: boolean }) => (
    <div className="w-full h-2 rounded-full bg-digi-border/60 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-300 ${done ? 'bg-green-500' : 'bg-accent'}`} style={{ width: `${value}%` }} />
    </div>
  );

  const ResultBlock = ({ result, onReset, label }: { result: { blob: Blob; name: string }; onReset: () => void; label: string }) => (
    <div className="space-y-2 pt-3 border-t border-digi-border">
      <p className="flex items-center justify-center gap-1.5 text-[12px] text-green-700 font-medium" style={mf}>
        <CheckCircle2 className="w-4 h-4" /> {label}
      </p>
      <button onClick={() => triggerDownload(result.blob, result.name)}
        className="w-full inline-flex items-center justify-center gap-1.5 py-2 bg-accent text-white text-sm font-medium rounded hover:bg-accent-hover transition-colors" style={mf}>
        <Download className="w-4 h-4" /> Descargar {result.name}
      </button>
      <button onClick={onReset} className="pixel-btn pixel-btn-secondary w-full text-sm" style={mf}>Usar de nuevo</button>
    </div>
  );

  const Dropzone = ({ onClick, file, hint }: { onClick: () => void; file: File | null; hint: string }) => (
    <div onClick={onClick}
      className="w-full py-6 px-3 rounded-lg border-2 border-dashed border-digi-border hover:border-accent/50 hover:bg-accent-light/40 cursor-pointer text-center transition-colors">
      <UploadCloud className="w-6 h-6 text-digi-muted mx-auto mb-1.5" />
      <p className="text-[12px] text-digi-text" style={mf}>{file ? file.name : hint}</p>
      {file && <p className="text-[11px] text-digi-muted mt-0.5" style={mf}>{fmt2((file.size / 1024 / 1024))} MB</p>}
    </div>
  );

  const tool = tools.find((t) => t.id === selectedTool) || null;
  // Por debajo de `xl` la herramienta se abre ENCIMA, no bajo la lista (Fernando, 2026-10-23).
  // Se decide qué se MONTA: un <dialog> montado y escondido deja inerte toda la página.
  const enTelefono = !useConsultaMedia(PANTALLA_XL);
  const cuerpoHerramienta = () => !tool ? null
    : tool.id === 'convert' ? renderConvert() : tool.id === 'transcribe' ? renderTranscribe() : tool.id === 'entrega-unica' ? renderEntrega() : tool.id === 'qr' ? <GeneradorQR /> : tool.id === 'formatos-excel' ? renderFormatosExcel() : tool.id === 'descargador-video' ? renderDescargador() : renderEnlace();

  // Panel derecho: usar la herramienta seleccionada.
  const renderToolPanel = () => {
    if (!tool) {
      return (
        <PanelHastaElPie desdeAncho={1280} className="bg-digi-card border border-digi-border rounded-lg p-6 text-center flex flex-col items-center justify-center">
          <div className="w-10 h-10 rounded-lg bg-black/[0.03] flex items-center justify-center mx-auto mb-2">
            <Wrench className="w-5 h-5 text-digi-muted" />
          </div>
          <p className="text-[12px] text-digi-muted" style={mf}>Selecciona una herramienta para usarla.</p>
        </PanelHastaElPie>
      );
    }
    // Fernando, 2026-10-29: la tarjeta del panel derecho llega hasta el pie aunque tenga poco;
    // lo que no quepa se desplaza dentro.
    return (
      <PanelHastaElPie desdeAncho={1280} className="bg-digi-card border border-digi-border rounded-lg shadow-sm">
        <div className="flex items-center gap-2.5 p-4 border-b border-digi-border">
          <div className="w-9 h-9 rounded-lg bg-accent-light border border-accent/15 flex items-center justify-center shrink-0">
            <tool.Icon className="w-5 h-5 text-accent" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold text-digi-text leading-tight" style={mf}>{tool.name}</h3>
            <p className="text-[11px] text-digi-muted" style={mf}>{CATEGORY_LABEL[tool.category]}</p>
          </div>
        </div>
        <div className="p-4">{cuerpoHerramienta()}</div>
      </PanelHastaElPie>
    );
  };

  // Descargador GCC (`movil/descargador/`): el video se descarga en el propio teléfono, nunca en el servidor.
  const renderDescargador = () => (
    <AppMovil
      slug="descargador-video"
      descripcion="Pega o comparte un enlace de video y elige la calidad o solo el audio; queda guardado en la galería del teléfono. Úsala solo con videos propios, con permiso de su autor o con licencia libre."
      pasos={[
        'Descarga el archivo desde el teléfono.',
        'Ábrelo y, si Android lo pide, permite instalar apps de este origen.',
        'Abre «Descargador GCC» y comparte con ella el enlace del video.',
      ]}
    />
  );

  const renderConvert = () => {
    if (converting) {
      return (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-[12px]" style={mf}>
              <span className="text-digi-muted">{convertProgress < 100 ? 'Convirtiendo...' : 'Completado'}</span>
              <span className="text-accent font-medium">{Math.round(convertProgress)}%</span>
            </div>
            <ProgressBar value={convertProgress} done={convertProgress >= 100} />
          </div>
          {convertResult ? (
            <ResultBlock result={convertResult} onReset={resetConvert} label="Archivo convertido exitosamente" />
          ) : (
            <p className="text-[11px] text-digi-muted text-center" style={mf}>Procesando… no cierres la página</p>
          )}
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <p className="text-[12px] text-digi-muted" style={mf}>{TOOLS[0].description}</p>
        <div className="grid grid-cols-2 gap-3">
          <PixelSelect label="Formato origen" value={convertFrom}
            onChange={(e) => {
              setConvertFrom(e.target.value);
              const targets = CONVERSIONS[e.target.value] || [];
              if (targets.length > 0 && !targets.includes(convertTo)) setConvertTo(targets[0]);
            }}
            options={Object.keys(CONVERSIONS).map((f) => ({ value: f, label: f.toUpperCase() }))} />
          <PixelSelect label="Formato destino" value={convertTo}
            onChange={(e) => setConvertTo(e.target.value)}
            options={(CONVERSIONS[convertFrom] || []).map((f) => ({ value: f, label: f.toUpperCase() }))} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="field-label text-[10px] text-accent-glow opacity-70" style={df}>Archivo</label>
          <Dropzone onClick={() => convertInputRef.current?.click()} file={convertFile}
            hint={`Haz clic para seleccionar un archivo .${convertFrom}`} />
          <input ref={convertInputRef} type="file" accept={`.${convertFrom}`} onChange={e => setConvertFile(e.target.files?.[0] || null)} className="hidden" />
        </div>
        <button onClick={handleConvert} disabled={!convertFile} className="pixel-btn pixel-btn-primary w-full text-sm disabled:opacity-50" style={mf}>
          Iniciar conversión
        </button>
      </div>
    );
  };

  const renderTranscribe = () => {
    if (transcribePhase === 'processing') {
      return (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-[12px]" style={mf}>
              <span className="text-digi-muted">Transcribiendo...</span>
              <span className="text-accent font-medium">{Math.round(transcribeProgress)}%</span>
            </div>
            <ProgressBar value={transcribeProgress} />
          </div>
          <p className="text-[11px] text-digi-muted text-center" style={mf}>Procesando… no cierres la página</p>
        </div>
      );
    }
    if (transcribePhase === 'done' && transcribeResult) {
      return (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-[12px]" style={mf}>
              <span className="text-green-700 font-medium">Completado</span>
              <span className="text-green-700 font-medium">100%</span>
            </div>
            <ProgressBar value={100} done />
          </div>
          <ResultBlock result={transcribeResult} onReset={resetTranscribe} label="Audio transcrito exitosamente" />
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <p className="text-[12px] text-digi-muted" style={mf}>Sube un archivo de audio (MP3, M4A, WAV, OGG, WEBM) para transcribirlo a texto.</p>
        <div className="flex flex-col gap-1">
          <label className="field-label text-[10px] text-accent-glow opacity-70" style={df}>Archivo de audio</label>
          <Dropzone onClick={() => transcribeInputRef.current?.click()} file={transcribeFile}
            hint="Haz clic para seleccionar un archivo de audio" />
          <input ref={transcribeInputRef} type="file" accept=".mp3,.m4a,.mp4,.wav,.ogg,.webm" onChange={e => setTranscribeFile(e.target.files?.[0] || null)} className="hidden" />
        </div>
        <button onClick={handleTranscribe} disabled={!transcribeFile} className="pixel-btn pixel-btn-primary w-full text-sm disabled:opacity-50" style={mf}>
          Iniciar transcripción
        </button>
      </div>
    );
  };

  const renderEnlace = () => (
    <div className="space-y-3">
      <p className="text-[12px] text-digi-muted" style={mf}>{tool?.description}</p>
      <button onClick={abrirEnlace} className={`${BTN_PRIMARY} w-full`}><Plus className="w-4 h-4" /> Generar enlace</button>
      <Link href="/dashboard/tools/enlaces" className={`${BTN_SECONDARY} w-full`}><Table2 className="w-4 h-4" /> Ver enlaces generados</Link>
    </div>
  );

  // Corre a página completa: la vista previa de la hoja impresa no cabe en esta columna.
  const renderFormatosExcel = () => (
    <div className="space-y-3">
      <p className="text-[12px] text-digi-muted" style={mf}>{tool?.description}</p>
      <Link href="/dashboard/tools/formatos-excel" className={`${BTN_PRIMARY} w-full`}><ExternalLink className="w-4 h-4" /> Abrir herramienta</Link>
      {esEquipo && (
        <>
          <button onClick={abrirAcceso} className={`${BTN_SECONDARY} w-full`}><Share2 className="w-4 h-4" /> Compartir acceso</button>
          <Link href="/dashboard/tools/accesos" className={`${BTN_SECONDARY} w-full`}><Table2 className="w-4 h-4" /> Ver accesos compartidos</Link>
        </>
      )}
    </div>
  );

  const renderEntrega = () => (
    <div className="space-y-3">
      <p className="text-[12px] text-digi-muted" style={mf}>{tool?.description}</p>
      <button onClick={abrirEntrega} className={`${BTN_PRIMARY} w-full`}><Plus className="w-4 h-4" /> Generar entrega</button>
      <Link href="/dashboard/tools/entregas" className={`${BTN_SECONDARY} w-full`}><Table2 className="w-4 h-4" /> Ver entregas generadas</Link>
    </div>
  );

  return (
    <div>
      <PageHeader title="Herramientas" description="Utilidades de uso interno" />

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* ── Left rail: categorías ── */}
        <FilterRail
          title="Categoría"
          items={CATEGORIES.filter((c) => c.value === 'all' || counts[c.value]).map((c) => ({ value: c.value, label: c.label, Icon: c.Icon, count: counts[c.value] }))}
          value={cat}
          onChange={setCat}
        />

        {/* ── Right region: buscador + tabla + panel de uso ── */}
        <div className="flex-1 min-w-0 w-full">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
            {/* La barra va en la columna de la tabla: así el panel de uso empieza arriba. */}
            <div className="min-w-0">
              <BarraLista busqueda={search} onBusqueda={setSearch} placeholder="Buscar herramienta..." />
              <PixelDataTable
                singleLine
                columns={[
                  { key: 'name', header: 'Herramienta', render: (t: Tool) => (
                    <span className="flex items-center gap-2 min-w-0">
                      <t.Icon className={`w-4 h-4 shrink-0 ${selectedTool === t.id ? 'text-accent' : 'text-digi-muted'}`} />
                      <span className={`truncate text-[13px] font-medium ${selectedTool === t.id ? 'text-accent' : 'text-digi-text'}`} style={mf}>{t.name}</span>
                    </span>
                  ) },
                  { key: 'description', header: 'Descripción', hideOnMobile: true, render: (t: Tool) => (
                    <span className="text-[12px] text-digi-muted line-clamp-2 md:line-clamp-1" style={mf}>{t.description}</span>
                  ) },
                ]}
                data={filtered}
                onRowClick={(t: Tool) => selectTool(t.id)}
                emptyTitle="Sin herramientas"
                emptyDesc="No se encontraron herramientas en esta categoría."
              />
            </div>

            {/* ── Panel de uso ── */}
            {/* La columna solo en escritorio; por debajo, el panel que se abre encima (abajo). */}
            {!enTelefono && (
              <aside className="w-full xl:w-[360px]">
                {renderToolPanel()}
              </aside>
            )}
          </div>
        </div>
      </div>

      {/* La herramienta en teléfono y tableta. En escritorio NO se monta: ver `enTelefono`. */}
      {enTelefono && (
        <PixelModal open={!!tool} onClose={() => setSelectedTool(null)} title={tool?.name || 'Herramienta'} size="md">
          {cuerpoHerramienta()}
        </PixelModal>
      )}

      <PanelCompartirEnlace
        open={enlaceOpen} onClose={() => setEnlaceOpen(false)}
        title="Generar enlace de un solo uso"
        intro={<>Quien lo abra podrá enviar <strong>un texto y hasta 10 archivos</strong> (100 MB cada uno). Al enviar, el enlace se cierra.</>}
        duraciones={VIGENCIAS} duracionInicial={168}
        correoInicial={clienteElegido?.email || ''}
        etiquetaCorreo="Correo de quien responde (para enviarlo)"
        aviso={enlaceExigeCuenta
          ? <>Solo podrá responder quien inicie sesión con la cuenta de <strong>{clienteElegido?.nombre}</strong>.</>
          : 'Cualquiera con este enlace puede responder una vez.'}
        puedeGenerar={!!enlaceTitulo.trim() && (!enlaceExigeCuenta || !!enlaceCliente)}
        generar={async ({ horas, email, enviar }) => {
          const r = await fetch('/api/enlaces', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              titulo: enlaceTitulo, indicaciones: enlaceIndicaciones, horas, email: enviar ? email : undefined,
              exige_cuenta: enlaceExigeCuenta, client_id: enlaceExigeCuenta ? Number(enlaceCliente) : null,
            }),
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || 'Error');
          if (enviar && !d.data.enviado) return { url: d.data.url, mensaje: 'Enlace generado, pero el correo no salió: cópialo y envíalo tú', ok: false };
          return { url: d.data.url, mensaje: enviar ? 'Enlace enviado por correo' : 'Enlace generado' };
        }}
      >
        <EditField label="Título">
          <input value={enlaceTitulo} onChange={(e) => setEnlaceTitulo(e.target.value)} maxLength={200}
            placeholder="Ej.: Documentos para la declaración" className={EDIT_INPUT} style={mf} />
        </EditField>
        <EditField label="Indicaciones para quien responde">
          <AutoGrowTextarea value={enlaceIndicaciones} onChange={(e) => setEnlaceIndicaciones(e.target.value)} minRows={3} maxLength={4000}
            placeholder="Qué necesitas que te envíen" className={EDIT_INPUT} style={mf} />
        </EditField>
        <div className="flex items-center justify-between gap-3 py-1">
          <span className="text-[12px] font-semibold text-digi-text opacity-70" style={mf}>Pedir la cuenta del cliente</span>
          <Interruptor activo={enlaceExigeCuenta} onChange={setEnlaceExigeCuenta} etiqueta="Pedir la cuenta del cliente" />
        </div>
        {enlaceExigeCuenta && (
          <PixelSelect label="Cliente" value={enlaceCliente} onChange={(e) => setEnlaceCliente(e.target.value)}
            placeholder={clientesConCuenta === null ? 'Cargando…' : clientesConCuenta.length ? 'Elige el cliente' : 'Ningún cliente tiene cuenta'}
            options={(clientesConCuenta || []).map((c) => ({ value: String(c.id), label: `${c.nombre} · ${c.email}` }))} />
        )}
      </PanelCompartirEnlace>

      <PanelCompartirEnlace
        open={accesoOpen} onClose={() => setAccesoOpen(false)}
        title="Compartir acceso a la herramienta"
        intro={<>Quien abra el enlace podrá usar <strong>{tool?.name}</strong> las veces que necesite, sin cuenta, hasta que venza o lo cierres.</>}
        duraciones={VIGENCIAS_ACCESO} duracionInicial={720}
        correoInicial={clienteAcceso?.email || ''}
        etiquetaCorreo="Correo de quien la usará (para enviarlo)"
        aviso={accesoExigeCuenta
          ? <>Solo podrá usarla quien inicie sesión con la cuenta de <strong>{clienteAcceso?.nombre}</strong>.</>
          : 'Cualquiera con este enlace puede usarla mientras esté vigente.'}
        puedeGenerar={!!tool?.compartible && (!accesoExigeCuenta || !!accesoCliente)}
        generar={async ({ horas, email, enviar }) => {
          const r = await fetch('/api/herramientas/accesos', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              herramienta: tool?.id, titulo: accesoTitulo, horas, email: enviar ? email : undefined,
              exige_cuenta: accesoExigeCuenta, client_id: accesoExigeCuenta ? Number(accesoCliente) : null,
            }),
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || 'Error');
          if (enviar && !d.data.enviado) return { url: d.data.url, mensaje: 'Acceso generado, pero el correo no salió: cópialo y envíalo tú', ok: false };
          return { url: d.data.url, mensaje: enviar ? 'Acceso enviado por correo' : 'Acceso generado' };
        }}
      >
        <EditField label="Para quién">
          <input value={accesoTitulo} onChange={(e) => setAccesoTitulo(e.target.value)} maxLength={200}
            placeholder="Ej.: Contabilidad de la empresa" className={EDIT_INPUT} style={mf} />
        </EditField>
        <div className="flex items-center justify-between gap-3 py-1">
          <span className="text-[12px] font-semibold text-digi-text opacity-70" style={mf}>Pedir la cuenta del cliente</span>
          <Interruptor activo={accesoExigeCuenta} onChange={setAccesoExigeCuenta} etiqueta="Pedir la cuenta del cliente" />
        </div>
        {accesoExigeCuenta && (
          <PixelSelect label="Cliente" value={accesoCliente} onChange={(e) => setAccesoCliente(e.target.value)}
            placeholder={clientesConCuenta === null ? 'Cargando…' : clientesConCuenta.length ? 'Elige el cliente' : 'Ningún cliente tiene cuenta'}
            options={(clientesConCuenta || []).map((c) => ({ value: String(c.id), label: `${c.nombre} · ${c.email}` }))} />
        )}
      </PanelCompartirEnlace>

      <PanelCompartirEnlace
        open={entregaOpen} onClose={cerrarEntrega}
        title="Generar entrega de un solo uso"
        intro={<>Quien abra el enlace podrá ver el mensaje y <strong>descargar los archivos una sola vez</strong>: al pulsar «Ver y descargar» tiene una hora en ese navegador y después se cierra.</>}
        duraciones={VIGENCIAS} duracionInicial={168}
        correoInicial={clienteEntrega?.email || ''}
        etiquetaCorreo="Correo de quien recibe (para enviarlo)"
        aviso={entregaExigeCuenta
          ? <>Solo podrá abrirla quien inicie sesión con la cuenta de <strong>{clienteEntrega?.nombre}</strong>.</>
          : 'Cualquiera con este enlace puede abrirla una vez.'}
        puedeGenerar={!!entregaTitulo.trim() && !subidaEntrega.subiendo
          && (!!entregaMensaje.trim() || subidaEntrega.listos.length > 0)
          && (!entregaExigeCuenta || !!entregaCliente)}
        generar={async ({ horas, email, enviar }) => {
          const id = await borradorEntrega();
          const r = await fetch(`/api/entregas/${id}/publicar`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              titulo: entregaTitulo, mensaje: entregaMensaje, horas, email: enviar ? email : undefined,
              exige_cuenta: entregaExigeCuenta, client_id: entregaExigeCuenta ? Number(entregaCliente) : null,
              archivos: subidaEntrega.listos.map((x) => x.fileId),
            }),
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || 'Error');
          entregaPublicada.current = true;
          if (enviar && !d.data.enviado) return { url: d.data.url, mensaje: 'Entrega generada, pero el correo no salió: cópialo y envíalo tú', ok: false };
          return { url: d.data.url, mensaje: enviar ? 'Entrega enviada por correo' : 'Entrega generada' };
        }}
      >
        <EditField label="Título">
          <input value={entregaTitulo} onChange={(e) => setEntregaTitulo(e.target.value)} maxLength={200}
            placeholder="Ej.: Accesos del sistema" className={EDIT_INPUT} style={mf} />
        </EditField>
        <EditField label="Mensaje para quien recibe">
          <AutoGrowTextarea value={entregaMensaje} onChange={(e) => setEntregaMensaje(e.target.value)} minRows={3} maxLength={20000}
            placeholder="La información que le compartes" className={EDIT_INPUT} style={mf} />
        </EditField>
        <ListaSubidas items={subidaEntrega.items} agregar={subidaEntrega.agregar} quitar={subidaEntrega.quitar} />
        <div className="flex items-center justify-between gap-3 py-1">
          <span className="text-[12px] font-semibold text-digi-text opacity-70" style={mf}>Pedir la cuenta del cliente</span>
          <Interruptor activo={entregaExigeCuenta} onChange={setEntregaExigeCuenta} etiqueta="Pedir la cuenta del cliente" />
        </div>
        {entregaExigeCuenta && (
          <PixelSelect label="Cliente" value={entregaCliente} onChange={(e) => setEntregaCliente(e.target.value)}
            placeholder={clientesConCuenta === null ? 'Cargando…' : clientesConCuenta.length ? 'Elige el cliente' : 'Ningún cliente tiene cuenta'}
            options={(clientesConCuenta || []).map((c) => ({ value: String(c.id), label: `${c.nombre} · ${c.email}` }))} />
        )}
      </PanelCompartirEnlace>
    </div>
  );
}

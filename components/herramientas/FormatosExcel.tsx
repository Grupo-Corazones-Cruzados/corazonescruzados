'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { UploadCloud, FileSpreadsheet, FileDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ZoomIn, ZoomOut, Check } from 'lucide-react';
import { BTN_PRIMARY, BTN_SECONDARY, BTN_ICONO_SECUNDARIO } from '@/components/ui/Button';
import { FilaMarcable } from '@/components/ui/ListaMarcable';
import PixelBadge from '@/components/ui/PixelBadge';
import { fmtNum, fmtInt } from '@/lib/format';
import Segmentado from '@/components/ui/Segmentado';
import { FORMATS, XlsxPdf, abrirLibro, configDeHoja, excelCorregido, pdfDe } from '@/lib/herramientas/formatos-excel/motor';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

type Formato = (typeof FORMATS)[number];
/** Lo que devuelve `abrirLibro` (el motor no está tipado: ver su cabecera). */
type Libro = {
  files: Record<string, Uint8Array>; fileName: string; wbPath: string; book: any;
  sheets: { name: string; index: number; path: string | null; isWorksheet: boolean }[];
  /** Por formato, un plan por hoja de cálculo (en el orden del libro). */
  recomendado: string | null; planes: Record<string, any[]>;
};

const orientacion = (f: { orientation: string }) => (f.orientation === 'landscape' ? 'horizontal' : 'vertical');
const tamano = (b: number) => (b > 1048576 ? `${fmtNum(b / 1048576, 1)} MB` : `${fmtInt(b / 1024)} KB`);

/** Descarga un Blob con el nombre dado (sin pasar por el servidor). */
function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 120000);
}

/** Una página del plan dibujada en un canvas al ancho dado. */
function Pagina({ plan, indice, ancho, libro }: { plan: any; indice: number; ancho: number; libro: Libro }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    if (!ref.current || ancho <= 0) return;
    try { XlsxPdf.drawCanvas(plan, indice, ref.current, ancho, libro.book, { fileName: libro.fileName }); }
    catch (e) { console.error('[formatos-excel] vista previa', e); }
  }, [plan, indice, ancho, libro]);
  // El papel es blanco en los dos temas: es la hoja impresa, no la interfaz.
  return <canvas ref={ref} className="block bg-white shadow-md" />;
}

/**
 * FORMATOS DE IMPRESIÓN PARA EXCEL (Herramientas → Edición; Fernando, 2026-10-27).
 *
 * El motor (`lib/herramientas/formatos-excel/motor.ts`) es el de la herramienta que entregó
 * Fernando, sin cambios; esta pantalla es la suya rehecha con las piezas del panel. Todo corre
 * en el navegador: el archivo no se sube a ningún servidor. La usa el panel y la página pública
 * del acceso compartido (`/herramienta/<token>`); `onUso` avisa cada vez que se abre un libro.
 */
export default function FormatosExcel({ onUso }: { onUso?: () => void }) {
  const [libro, setLibro] = useState<Libro | null>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [cargando, setCargando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fmtId, setFmtId] = useState<string>(FORMATS[0].id);
  const [pagina, setPagina] = useState(0);
  /** Qué hoja del libro se ve en la vista previa (índice entre las hojas de cálculo). */
  const [hojaVista, setHojaVista] = useState(0);
  const [cerca, setCerca] = useState(false);
  const [hojas, setHojas] = useState<Set<number>>(new Set());
  const [progreso, setProgreso] = useState<{ texto: string; valor: number } | null>(null);
  const [encima, setEncima] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const escenario = useRef<HTMLDivElement>(null);
  const [anchoEscenario, setAnchoEscenario] = useState(0);

  useEffect(() => {
    const el = escenario.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAnchoEscenario(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [libro]);

  const formato = FORMATS.find((f) => f.id === fmtId)!;
  const plan = libro?.planes[fmtId]?.[hojaVista];
  const hojasLibro = libro?.sheets.filter((s: any) => s.isWorksheet) || [];
  const cfgVista = plan ? configDeHoja(formato, plan.sheet.name) : formato;
  const elegidas = hojasLibro.filter((s: any) => hojas.has(s.index));
  const ocupado = !!cargando || !!progreso;

  const cargar = useCallback(async (f: File | undefined) => {
    if (!f || ocupado) return;
    if (!/\.xls[xm]$/i.test(f.name)) { setError('El archivo debe ser .xlsx o .xlsm. Si es .xls, guárdalo primero como .xlsx en Excel.'); return; }
    setError(null); setLibro(null); setArchivo(f); setPagina(0); setHojaVista(0); setCargando('Leyendo el archivo…');
    try {
      const l = (await abrirLibro(f, (t: string) => setCargando(t))) as Libro;
      setLibro(l);
      setHojas(new Set(l.sheets.filter((s: any) => s.isWorksheet).map((s: any) => s.index)));
      if (l.recomendado) setFmtId(l.recomendado);
      onUso?.();
    } catch (e: any) {
      console.error('[formatos-excel]', e);
      setError(`No se pudo leer el archivo: ${e?.message || 'formato no válido'}. Verifica que sea un .xlsx sin contraseña.`);
    } finally { setCargando(null); }
  }, [ocupado, onUso]);

  const base = () => (libro?.fileName || 'libro').replace(/\.xls[xm]$/i, '');

  const bajarExcel = async () => {
    if (!libro || !elegidas.length) return;
    setProgreso({ texto: 'Aplicando el formato…', valor: -1 });
    try {
      const blob = await excelCorregido(libro, formato, elegidas);
      const ext = (libro.fileName.match(/\.(xls[xm])$/i) || [, 'xlsx'])[1];
      descargar(blob, `${base()}_${formato.paperName}.${ext}`);
      toast.success('Excel descargado');
    } catch (e: any) { console.error(e); toast.error(`No se pudo generar el Excel: ${e?.message || e}`); }
    finally { setProgreso(null); }
  };

  const bajarPdf = async () => {
    if (!libro || !elegidas.length) return;
    setProgreso({ texto: 'Preparando el PDF…', valor: 0 });
    try {
      const r = await pdfDe(libro, formato, elegidas, (texto: string, valor: number) => setProgreso({ texto, valor: valor || 0.001 }));
      descargar(r.blob, `${base()}_${formato.paperName}.pdf`);
      toast.success(`PDF descargado: ${fmtInt(r.pages)} ${r.pages === 1 ? 'hoja' : 'hojas'}, ${tamano(r.blob.size)}`);
    } catch (e: any) { console.error(e); toast.error(`No se pudo generar el PDF: ${e?.message || e}`); }
    finally { setProgreso(null); }
  };

  const total = plan?.pages.length || 0;
  const pag = Math.max(0, Math.min(pagina, total - 1));
  const filas = plan ? plan.pages[pag]?.rp : null;
  const anchoPagina = Math.max(240, anchoEscenario - 32);
  const anchoVista = Math.round(cerca ? Math.max(anchoPagina * 2, 1400) : anchoPagina);

  const titulo = (n: number, t: string) => (
    <h3 className="flex items-center gap-2 text-[11px] font-semibold text-digi-muted uppercase tracking-wide" style={mf}>
      <span className="w-5 h-5 rounded-full border border-digi-border text-digi-text flex items-center justify-center text-[10.5px] tabular-nums">{n}</span>
      {t}
    </h3>
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)] gap-4 items-start">
      {/* ── Columna de trabajo: archivo, formato y hojas ── */}
      <div className="space-y-4 min-w-0">
        <section className="bg-digi-card border border-digi-border rounded-lg p-4 space-y-3">
          {titulo(1, 'Archivo de Excel')}
          <div
            role="button" tabIndex={0}
            onClick={() => !ocupado && inputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
            onDragEnter={(e) => { e.preventDefault(); setEncima(true); }}
            onDragOver={(e) => { e.preventDefault(); setEncima(true); }}
            onDragLeave={(e) => { e.preventDefault(); setEncima(false); }}
            onDrop={(e) => { e.preventDefault(); setEncima(false); cargar(e.dataTransfer.files[0]); }}
            className={`w-full py-6 px-3 rounded-lg border-2 border-dashed cursor-pointer text-center transition-colors ${
              encima ? 'border-accent bg-accent-light/40' : 'border-digi-border hover:border-accent/50 hover:bg-accent-light/40'}`}
          >
            <UploadCloud className="w-6 h-6 text-digi-muted mx-auto mb-1.5" />
            {archivo ? (
              <>
                <p className="text-[12.5px] font-medium text-digi-text break-all" style={mf}>{archivo.name}</p>
                <p className="text-[11px] text-digi-muted mt-0.5 tabular-nums" style={mf}>
                  {tamano(archivo.size)}{libro ? ` · ${fmtInt(hojasLibro.length)} ${hojasLibro.length === 1 ? 'hoja' : 'hojas'}` : ''}
                </p>
              </>
            ) : (
              <p className="text-[12.5px] text-digi-text" style={mf}>Arrastra aquí el archivo .xlsx o haz clic para elegirlo</p>
            )}
          </div>
          <input ref={inputRef} type="file" className="hidden"
            accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => { cargar(e.target.files?.[0]); e.target.value = ''; }} />
          {cargando && (
            <div className="space-y-1.5">
              <div className="w-full h-1.5 rounded-full bg-digi-border/60 overflow-hidden">
                <div className="h-full w-1/3 rounded-full bg-accent animate-pulse" />
              </div>
              <p className="text-[11.5px] text-digi-muted" style={mf}>{cargando}</p>
            </div>
          )}
          {error && <p className="text-[12px] text-red-600" style={mf}>{error}</p>}
        </section>

        <section className="bg-digi-card border border-digi-border rounded-lg p-4 space-y-3">
          {titulo(2, 'Formato')}
          <div role="radiogroup" aria-label="Formatos disponibles" className="space-y-2">
            {FORMATS.map((f) => {
              // La hoja principal (la de más páginas) da la escala; las páginas son las de todo el libro.
              const ps = libro?.planes[f.id];
              const p = ps?.length ? ps.reduce((a, b) => (b.pages.length > a.pages.length ? b : a)) : null;
              const paginas = ps ? ps.reduce((n, x) => n + x.pages.length, 0) : 0;
              const elegido = f.id === fmtId;
              return (
                <button key={f.id} type="button" role="radio" aria-checked={elegido}
                  onClick={() => { setFmtId(f.id); setPagina(0); }}
                  className={`w-full text-left rounded-lg border p-3 transition-colors ${
                    elegido ? 'border-accent ring-1 ring-accent' : 'border-digi-border hover:border-accent/50'}`}>
                  <div className="flex items-start gap-2.5">
                    <span className={`mt-0.5 w-4 h-4 shrink-0 rounded-full border flex items-center justify-center ${
                      elegido ? 'bg-accent border-accent text-white' : 'border-digi-border'}`}>
                      {elegido && <Check className="w-3 h-3" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold text-digi-text leading-snug" style={mf}>{f.name}</span>
                        {libro?.recomendado === f.id && <PixelBadge variant="info">Recomendado</PixelBadge>}
                      </span>
                      <span className="block text-[12px] text-digi-muted mt-0.5" style={mf}>{f.summary}</span>
                      <span className="block text-[11.5px] text-digi-muted mt-1 tabular-nums" style={mf}>
                        {f.paperName} {orientacion(f)} · 1 página de ancho · {f.titleRows.from === f.titleRows.to ? `fila ${f.titleRows.from}` : `filas ${f.titleRows.from}–${f.titleRows.to}`} en cada hoja
                        {p && ` · escala ${fmtInt(p.scale * 100)} % · ${fmtInt(paginas)} ${paginas === 1 ? 'hoja' : 'hojas'}`}
                      </span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {hojasLibro.length > 1 && (
          <section className="bg-digi-card border border-digi-border rounded-lg py-3 space-y-2">
            <div className="px-4">{titulo(3, 'Hojas a descargar')}</div>
            <div>
              {hojasLibro.map((s: any) => (
                <FilaMarcable key={s.index} etiqueta={s.name} marcada={hojas.has(s.index)}
                  onClick={() => setHojas((prev) => { const n = new Set(prev); if (n.has(s.index)) n.delete(s.index); else n.add(s.index); return n; })} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ── Vista previa + descargas ── */}
      <section className="bg-digi-card border border-digi-border rounded-lg min-w-0 flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-digi-border">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-digi-text truncate" style={df}>Vista previa</p>
            {plan && (
              <p className="text-[11.5px] text-digi-muted tabular-nums truncate" style={mf}>
                {cfgVista.paperName} {orientacion(cfgVista)} · escala {fmtInt(plan.scale * 100)} % · letra ≈ {fmtNum(plan.fontPt, 1)} pt
                {filas?.length ? ` · filas ${fmtInt(filas[0].r)}–${fmtInt(filas[filas.length - 1].r)}` : ''}
              </p>
            )}
          </div>
          {plan && (
            <div className="flex items-center gap-1">
              <button type="button" className={BTN_ICONO_SECUNDARIO} onClick={() => setPagina(0)} disabled={pag === 0} aria-label="Primera página"><ChevronsLeft className="w-4 h-4" /></button>
              <button type="button" className={BTN_ICONO_SECUNDARIO} onClick={() => setPagina(pag - 1)} disabled={pag === 0} aria-label="Página anterior"><ChevronLeft className="w-4 h-4" /></button>
              <span className="px-2 text-[12px] text-digi-text tabular-nums whitespace-nowrap" style={mf}>{fmtInt(pag + 1)} de {fmtInt(total)}</span>
              <button type="button" className={BTN_ICONO_SECUNDARIO} onClick={() => setPagina(pag + 1)} disabled={pag >= total - 1} aria-label="Página siguiente"><ChevronRight className="w-4 h-4" /></button>
              <button type="button" className={BTN_ICONO_SECUNDARIO} onClick={() => setPagina(total - 1)} disabled={pag >= total - 1} aria-label="Última página"><ChevronsRight className="w-4 h-4" /></button>
              <button type="button" className={BTN_ICONO_SECUNDARIO} onClick={() => setCerca((v) => !v)} aria-pressed={cerca}
                aria-label={cerca ? 'Ajustar al ancho' : 'Acercar'} title={cerca ? 'Ajustar al ancho' : 'Acercar'}>
                {cerca ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>

        {libro && hojasLibro.length > 1 && (
          <div className="px-4 py-2.5 border-b border-digi-border">
            {hojasLibro.length <= 3 ? (
              <Segmentado etiqueta="Hoja de la vista previa" className="max-w-md"
                opciones={hojasLibro.map((h, i) => ({ valor: String(i), texto: h.name }))}
                valor={String(hojaVista)} onChange={(v) => { setHojaVista(Number(v)); setPagina(0); }} />
            ) : (
              <select value={hojaVista} onChange={(e) => { setHojaVista(Number(e.target.value)); setPagina(0); }} aria-label="Hoja de la vista previa"
                className="field-control w-full sm:max-w-xs px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:outline-none" style={mf}>
                {hojasLibro.map((h, i) => <option key={h.index} value={i}>{h.name}</option>)}
              </select>
            )}
          </div>
        )}

        <div ref={escenario} className="bg-black/[0.04] overflow-auto max-h-[78vh] min-h-[320px] p-4 grid justify-items-center items-start">
          {libro && plan ? (
            <Pagina plan={plan} indice={pag} ancho={anchoVista} libro={libro} />
          ) : (
            <div className="self-center text-center py-10">
              <FileSpreadsheet className="w-8 h-8 text-digi-muted mx-auto mb-2" />
              <p className="text-[12.5px] text-digi-muted" style={mf}>Sube un archivo para ver cómo saldrá impreso.</p>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-digi-border space-y-2">
          {progreso && (
            <div className="space-y-1.5">
              <div className="w-full h-1.5 rounded-full bg-digi-border/60 overflow-hidden">
                <div className={`h-full rounded-full bg-accent transition-all duration-200 ${progreso.valor < 0 ? 'w-1/3 animate-pulse' : ''}`}
                  style={progreso.valor >= 0 ? { width: `${Math.round(progreso.valor * 100)}%` } : undefined} />
              </div>
              <p className="text-[11.5px] text-digi-muted" style={mf}>{progreso.texto}</p>
            </div>
          )}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button type="button" onClick={bajarExcel} disabled={!libro || ocupado || !elegidas.length} className={BTN_SECONDARY}>
              <FileSpreadsheet className="w-4 h-4" /> Descargar Excel corregido
            </button>
            <button type="button" onClick={bajarPdf} disabled={!libro || ocupado || !elegidas.length} className={BTN_PRIMARY}>
              <FileDown className="w-4 h-4" /> Descargar PDF
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

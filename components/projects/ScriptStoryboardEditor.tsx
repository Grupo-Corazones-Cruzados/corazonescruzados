'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;

export interface StoryboardSegment {
  id: string;
  text: string;
  imageIndex: number | null;
  mode: 'image' | 'ai-video' | 'custom-clip' | 'none';
  aiPrompt?: string;
  clipData?: string;      // base64 video (temporary, for generation only)
  clipDuration?: number;  // seconds
  clipName?: string;      // original filename
}

interface ScriptStoryboardEditorProps {
  projectId: string | number;
  script: string;
  projectImages: string[];
  existingStoryboard: StoryboardSegment[] | null;
  onClose: () => void;
  onSaved: (storyboard: StoryboardSegment[]) => void;
}

function splitScript(script: string): string[] {
  // Remove [IMAGEN X] markers and split by double newlines or meaningful breaks
  const cleaned = script
    .replace(/---GUION_(INICIO|FIN)---/g, '')
    .replace(/\[IMAGEN\s*\d+\]/gi, '')
    .trim();

  return cleaned
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

let idCounter = 0;
function newSegId() { return `seg-${Date.now()}-${idCounter++}`; }

export default function ScriptStoryboardEditor({
  projectId, script, projectImages, existingStoryboard, onClose, onSaved,
}: ScriptStoryboardEditorProps) {
  // Initialize segments from existing storyboard or by splitting script
  const [segments, setSegments] = useState<StoryboardSegment[]>(() => {
    if (existingStoryboard && existingStoryboard.length > 0) {
      // Migrate old storyboards that don't have mode field
      return existingStoryboard.map(s => {
        const mode = s.mode || (s.imageIndex !== null ? 'image' : 'none');
        return { ...s, mode: mode as 'image' | 'ai-video' | 'none' };
      });
    }
    return splitScript(script).map(text => ({ id: newSegId(), text, imageIndex: null, mode: 'none' as const }));
  });

  const [saving, setSaving] = useState(false);
  const [pickerSegId, setPickerSegId] = useState<string | null>(null);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [draggedImg, setDraggedImg] = useState<number | null>(null);
  const segmentRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Close picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerSegId && !(e.target as Element)?.closest('.image-picker-popover')) {
        setPickerSegId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pickerSegId]);

  const assignImage = useCallback((segId: string, imgIdx: number | null) => {
    setSegments(prev => prev.map(s => s.id === segId ? { ...s, imageIndex: imgIdx, mode: imgIdx !== null ? 'image' as const : 'none' as const, aiPrompt: undefined } : s));
    setPickerSegId(null);
  }, []);

  const setAiMode = useCallback((segId: string, customPrompt?: string) => {
    setSegments(prev => prev.map(s => s.id === segId ? { ...s, imageIndex: null, mode: 'ai-video' as const, aiPrompt: customPrompt } : s));
    setPickerSegId(null);
  }, []);

  const clearSegment = useCallback((segId: string) => {
    setSegments(prev => prev.map(s => s.id === segId ? { ...s, imageIndex: null, mode: 'none' as const, aiPrompt: undefined, clipData: undefined, clipDuration: undefined, clipName: undefined } : s));
    setPickerSegId(null);
  }, []);

  const uploadClip = useCallback((segId: string, file: File) => {
    // Read file as base64 and get duration via HTML5 video element
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        setSegments(prev => prev.map(s => s.id === segId ? {
          ...s,
          mode: 'custom-clip' as const,
          imageIndex: null,
          aiPrompt: undefined,
          clipData: base64,
          clipDuration: Math.round(video.duration * 10) / 10,
          clipName: file.name,
        } : s));
        setPickerSegId(null);
        toast.success(`Clip "${file.name}" cargado (${Math.round(video.duration)}s)`);
      };
      video.onerror = () => toast.error('No se pudo leer el video');
      video.src = URL.createObjectURL(file);
    };
    reader.onerror = () => toast.error('Error al leer archivo');
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((segId: string) => {
    if (draggedImg !== null) {
      assignImage(segId, draggedImg);
      setDraggedImg(null);
    }
  }, [draggedImg, assignImage]);

  // Merge two segments
  const mergeWithNext = (idx: number) => {
    if (idx >= segments.length - 1) return;
    setSegments(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], text: next[idx].text + '\n\n' + next[idx + 1].text };
      next.splice(idx + 1, 1);
      return next;
    });
  };

  // Split a segment at cursor position
  const splitSegment = (idx: number) => {
    const seg = segments[idx];
    const mid = Math.floor(seg.text.length / 2);
    // Find nearest paragraph break or newline near middle
    let splitPos = seg.text.indexOf('\n', mid);
    if (splitPos === -1 || splitPos === seg.text.length - 1) splitPos = mid;

    const firstText = seg.text.slice(0, splitPos).trim();
    const secondText = seg.text.slice(splitPos).trim();
    if (!firstText || !secondText) return;

    setSegments(prev => {
      const next = [...prev];
      next.splice(idx, 1,
        { id: newSegId(), text: firstText, imageIndex: seg.imageIndex, mode: seg.mode, aiPrompt: seg.aiPrompt },
        { id: newSegId(), text: secondText, imageIndex: null, mode: 'none' as const },
      );
      return next;
    });
  };

  const saveStoryboard = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_metadata: { storyboard: segments } }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast.success('Storyboard guardado');
      onSaved(segments);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const imageCount = segments.filter(s => s.mode === 'image').length;
  const aiCount = segments.filter(s => s.mode === 'ai-video').length;
  const clipCount = segments.filter(s => s.mode === 'custom-clip').length;
  const noneCount = segments.filter(s => s.mode === 'none').length;
  const totalSegments = segments.length;

  // Calculate which image is "active" for each segment (inherits from previous if mode=none)
  const activeImages: (number | null)[] = [];
  let lastImg: number | null = null;
  for (const seg of segments) {
    if (seg.mode === 'image' && seg.imageIndex !== null) lastImg = seg.imageIndex;
    else if (seg.mode === 'ai-video' || seg.mode === 'custom-clip') lastImg = null;
    activeImages.push(seg.mode === 'none' ? lastImg : (seg.mode === 'image' ? seg.imageIndex : null));
  }

  return (
    <div className="fixed inset-0 z-50 flex bg-black/60 backdrop-blur-sm">
      <div className="flex flex-1 max-h-screen m-2 sm:m-4 gap-0 overflow-hidden">

        {/* ===== LEFT: Timeline segments ===== */}
        <div className="flex-1 flex flex-col bg-digi-card border-2 border-digi-border min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b-2 border-digi-border bg-digi-darker shrink-0">
            <div>
              <h3 className="text-[11px] text-accent-glow" style={pf}>Storyboard del Video</h3>
              <p className="text-[9px] text-digi-muted" style={mf}>
                {imageCount} img + {aiCount} IA + {clipCount} clip + {noneCount} heredan / {totalSegments}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={saveStoryboard} disabled={saving}
                className="px-3 py-1.5 text-[9px] text-green-400 border border-green-700/50 hover:bg-green-900/20 transition-colors disabled:opacity-50" style={pf}>
                {saving ? '...' : 'Guardar'}
              </button>
              <button onClick={onClose}
                className="px-3 py-1.5 text-[9px] text-digi-muted border border-digi-border hover:text-white transition-colors" style={pf}>
                Cerrar
              </button>
            </div>
          </div>

          {/* Segments list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {segments.map((seg, idx) => {
              const activeImg = activeImages[idx];
              const isAi = seg.mode === 'ai-video';
              const isClip = seg.mode === 'custom-clip';
              const isImage = seg.mode === 'image';
              const isInherited = seg.mode === 'none' && activeImg !== null;

              return (
                <div
                  key={seg.id}
                  ref={el => { segmentRefs.current[seg.id] = el; }}
                  className={`flex gap-2 border transition-colors group ${
                    isClip ? 'border-green-500/40 bg-green-900/5' :
                    isAi ? 'border-purple-500/40 bg-purple-900/5' :
                    isImage ? 'border-accent/40 bg-accent/5' :
                    isInherited ? 'border-digi-border/30 bg-digi-darker/30' :
                    'border-digi-border/20'
                  }`}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-accent', 'bg-accent/10'); }}
                  onDragLeave={(e) => { e.currentTarget.classList.remove('border-accent', 'bg-accent/10'); }}
                  onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-accent', 'bg-accent/10'); handleDrop(seg.id); }}
                >
                  {/* Visual slot */}
                  <div
                    className={`w-20 shrink-0 flex flex-col items-center justify-center cursor-pointer border-r transition-colors relative ${
                      isAi ? 'border-purple-500/30 min-h-[80px]' :
                      isImage ? 'border-accent/30 h-20' :
                      'border-digi-border/20 h-20'
                    } hover:bg-accent/10`}
                    onClick={() => setPickerSegId(pickerSegId === seg.id ? null : seg.id)}
                  >
                    {isClip ? (
                      <div className="text-center px-1">
                        <div className="text-[14px]">🎥</div>
                        <div className="text-[7px] text-green-400" style={pf}>{seg.clipDuration}s</div>
                        <div className="text-[6px] text-digi-muted truncate w-full" style={mf}>{seg.clipName}</div>
                        <button
                          onClick={(e) => { e.stopPropagation(); clearSegment(seg.id); }}
                          className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-900/80 text-red-300 text-[7px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          style={pf}
                        >x</button>
                      </div>
                    ) : isAi ? (
                      <div className="text-center px-1">
                        <div className="text-[14px]">🎬</div>
                        <div className="text-[7px] text-purple-400" style={pf}>IA Video</div>
                        <button
                          onClick={(e) => { e.stopPropagation(); clearSegment(seg.id); }}
                          className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-900/80 text-red-300 text-[7px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          style={pf}
                        >x</button>
                      </div>
                    ) : activeImg !== null && projectImages[activeImg] ? (
                      <div className="relative w-full h-full">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={projectImages[activeImg]} alt={`Img ${activeImg + 1}`}
                          className={`w-full h-full object-cover ${isInherited ? 'opacity-40' : ''}`} />
                        <span className="absolute bottom-0.5 right-0.5 text-[7px] bg-black/70 text-white px-1" style={mf}>
                          {activeImg + 1}{isInherited ? '↑' : ''}
                        </span>
                        {isImage && (
                          <button onClick={(e) => { e.stopPropagation(); clearSegment(seg.id); }}
                            className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-900/80 text-red-300 text-[7px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            style={pf}>x</button>
                        )}
                      </div>
                    ) : (
                      <div className="text-center">
                        <div className="text-[16px] text-digi-muted/30">+</div>
                        <div className="text-[7px] text-digi-muted/40" style={mf}>visual</div>
                      </div>
                    )}

                    {/* Picker popover */}
                    {pickerSegId === seg.id && (
                      <div
                        className="image-picker-popover absolute left-full top-0 ml-1 z-30 w-72 max-h-72 bg-digi-card border-2 border-accent/50 shadow-xl overflow-y-auto p-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* AI Video option */}
                        <button
                          onClick={() => setAiMode(seg.id)}
                          className={`w-full mb-1.5 px-2 py-2 text-left border-2 transition-colors flex items-center gap-2 ${
                            isAi ? 'border-purple-500 bg-purple-900/20' : 'border-digi-border/50 hover:border-purple-500/50 hover:bg-purple-900/10'
                          }`}
                        >
                          <span className="text-[14px]">🎬</span>
                          <div>
                            <p className="text-[9px] text-purple-400" style={pf}>Generar con IA</p>
                            <p className="text-[7px] text-digi-muted" style={mf}>Clip generado por IA basado en el texto</p>
                          </div>
                        </button>

                        {/* Upload custom clip */}
                        <label
                          className={`w-full mb-2 px-2 py-2 text-left border-2 transition-colors flex items-center gap-2 cursor-pointer ${
                            isClip ? 'border-green-500 bg-green-900/20' : 'border-digi-border/50 hover:border-green-500/50 hover:bg-green-900/10'
                          }`}
                        >
                          <span className="text-[14px]">🎥</span>
                          <div>
                            <p className="text-[9px] text-green-400" style={pf}>Subir clip</p>
                            <p className="text-[7px] text-digi-muted" style={mf}>
                              {isClip && seg.clipName ? seg.clipName : 'Tu video con audio propio'}
                            </p>
                          </div>
                          <input
                            type="file"
                            accept="video/*"
                            className="hidden"
                            onChange={(e) => { if (e.target.files?.[0]) uploadClip(seg.id, e.target.files[0]); e.target.value = ''; }}
                          />
                        </label>

                        <p className="text-[8px] text-accent-glow mb-1.5" style={pf}>O seleccionar captura</p>
                        <div className="grid grid-cols-4 gap-1">
                          {projectImages.map((img, imgIdx) => (
                            <button key={imgIdx} onClick={() => assignImage(seg.id, imgIdx)}
                              className={`aspect-square border-2 overflow-hidden transition-colors ${
                                seg.imageIndex === imgIdx ? 'border-accent' : 'border-digi-border/30 hover:border-accent/50'
                              }`}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={img} alt={`${imgIdx + 1}`} className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                        <button onClick={() => clearSegment(seg.id)}
                          className="w-full mt-1.5 px-2 py-1 text-[8px] text-digi-muted border border-digi-border hover:text-red-400 hover:border-red-500/30 transition-colors"
                          style={pf}>
                          Quitar visual
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Text content */}
                  <div className="flex-1 py-1.5 px-2 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-[9px] text-digi-text whitespace-pre-wrap leading-relaxed flex-1" style={mf}>
                        {seg.text}
                      </p>
                      <div className="flex flex-col gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[7px] text-digi-muted/50" style={mf}>#{idx + 1}</span>
                        {idx < segments.length - 1 && (
                          <button onClick={() => mergeWithNext(idx)} title="Unir con siguiente"
                            className="text-[7px] text-digi-muted hover:text-accent-glow transition-colors" style={pf}>
                            ⊕
                          </button>
                        )}
                        {seg.text.length > 80 && (
                          <button onClick={() => splitSegment(idx)} title="Dividir segmento"
                            className="text-[7px] text-digi-muted hover:text-accent-glow transition-colors" style={pf}>
                            ✂
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer stats */}
          <div className="px-4 py-2 border-t-2 border-digi-border bg-digi-darker shrink-0">
            <div className="flex items-center justify-between">
              <p className="text-[8px] text-digi-muted" style={mf}>
                {noneCount} heredan | {segments.filter(s => s.mode === 'none' && activeImages[segments.indexOf(s)] === null).length} sin visual
              </p>
              <p className="text-[8px] text-digi-muted" style={mf}>
                Arrastra imagenes del panel derecho o haz clic en el slot
              </p>
            </div>
          </div>
        </div>

        {/* ===== RIGHT: Image pool ===== */}
        <div className="w-48 flex flex-col bg-digi-darker border-2 border-l-0 border-digi-border shrink-0">
          <div className="px-3 py-2 border-b border-digi-border">
            <h4 className="text-[9px] text-accent-glow" style={pf}>Imagenes ({projectImages.length})</h4>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {projectImages.map((img, idx) => {
              const usedInSegments = segments.filter(s => s.imageIndex === idx).length;
              return (
                <div
                  key={idx}
                  draggable
                  onDragStart={() => setDraggedImg(idx)}
                  onDragEnd={() => setDraggedImg(null)}
                  className={`relative cursor-grab active:cursor-grabbing border-2 transition-colors ${
                    usedInSegments > 0 ? 'border-accent/50' : 'border-digi-border/30'
                  } hover:border-accent/70`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img}
                    alt={`Imagen ${idx + 1}`}
                    className="w-full aspect-video object-cover"
                    onClick={() => setPreviewImg(img)}
                  />
                  <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-1.5 py-0.5 bg-black/70">
                    <span className="text-[8px] text-white" style={mf}>{idx + 1}</span>
                    {usedInSegments > 0 && (
                      <span className="text-[7px] text-accent-glow" style={mf}>×{usedInSegments}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Image preview modal */}
      {previewImg && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80" onClick={() => setPreviewImg(null)}>
          <div className="relative max-w-[80vw] max-h-[80vh]" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreviewImg(null)}
              className="absolute -top-3 -right-3 w-7 h-7 flex items-center justify-center bg-digi-card border-2 border-digi-border text-digi-muted hover:text-white z-10" style={pf}>
              X
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewImg} alt="Preview" className="max-w-[80vw] max-h-[80vh] object-contain border-2 border-digi-border" />
          </div>
        </div>
      )}
    </div>
  );
}

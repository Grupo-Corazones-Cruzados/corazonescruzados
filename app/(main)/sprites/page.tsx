'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Wand2, Wifi, WifiOff, Upload, Sparkles, RefreshCw, Pencil, Check, X, SlidersHorizontal, RotateCcw, Plus, ChevronDown } from 'lucide-react';
import SpriteJobCard from '@/components/sprites/SpriteJobCard';
import DropZone from '@/components/shared/DropZone';
import AnimatedSprite from '@/components/shared/AnimatedSprite';
import FrameSelector from '@/components/sprites/FrameSelector';
import RawSheetPreview from '@/components/sprites/RawSheetPreview';
import AvatarCropEditor from '@/components/sprites/AvatarCropEditor';
import type { SpriteJob } from '@/types/sprites';
import type { FrameConfig, AnimationPhase } from '@/types/world';

interface Citizen {
  agentId: string;
  name: string;
  sprite: string;
  scale?: number;
  flipWalk?: boolean;
  frameConfig?: FrameConfig;
  yShift?: number;
  avatarCrop?: { x: number; y: number; size: number };
}

const KNOWN_DIGIMON = [
  'Agumon', 'Gabumon', 'Patamon', 'Piyomon',
  'Shoutmon', 'Greymon', 'Metalgreymon',
  'Gatomon', 'Angemon', 'Devimon',
  'Gomamon', 'Biyomon', 'Palmon', 'Veemon', 'Guilmon',
  'Wargreymon', 'Omnimon', 'Leomon', 'Megadramon',
];

export default function SpritesPage() {
  const [falAvailable, setFalAvailable] = useState(false);
  const [checking, setChecking] = useState(true);
  const [citizens, setCitizens] = useState<Citizen[]>([]);
  const [jobs, setJobs] = useState<SpriteJob[]>([]);
  const [generating, setGenerating] = useState<string | null>(null); // agentId being generated
  const [error, setError] = useState('');

  // New citizen form
  const [newDigimon, setNewDigimon] = useState('');
  const [newAgentId, setNewAgentId] = useState('');
  const [createRepo, setCreateRepo] = useState(true);
  const [repoPrivate, setRepoPrivate] = useState(true);

  // Editing digimon name per citizen
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');

  // Frame editing
  const [editingFrames, setEditingFrames] = useState<string | null>(null); // agentId being edited
  const [reprocessing, setReprocessing] = useState<string | null>(null); // agentId being reprocessed
  const [reprocessUrl, setReprocessUrl] = useState<Record<string, string>>({}); // per-agent URL input
  const [reprocessYShift, setReprocessYShift] = useState<Record<string, number>>({}); // per-agent Y shift (local override)
  const [spriteVer, setSpriteVer] = useState(Date.now()); // cache-buster for sprite previews

  // Upload & add citizen
  const [showUpload, setShowUpload] = useState(false);
  const [showAddCitizen, setShowAddCitizen] = useState(false);

  // Regenerate confirmation
  const [confirmRegenerate, setConfirmRegenerate] = useState<{ agentId: string; name: string } | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hadActiveRef = useRef(false);

  // Check fal.ai
  const checkFal = useCallback(async () => {
    try {
      const res = await fetch('/api/sprites/comfyui-status');
      const data = await res.json();
      setFalAvailable(data.available);
    } catch {
      setFalAvailable(false);
    } finally {
      setChecking(false);
    }
  }, []);

  // Load citizens from world
  const loadCitizens = useCallback(async () => {
    try {
      const res = await fetch('/api/world');
      const data = await res.json();
      setCitizens(data.citizens || []);
    } catch { /* ignore */ }
  }, []);

  // Load jobs
  const loadJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/sprites/status?all=true');
      const data = await res.json();
      if (Array.isArray(data)) setJobs(data.reverse());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    checkFal();
    loadCitizens();
    loadJobs();
  }, [checkFal, loadCitizens, loadJobs]);

  // Poll active jobs
  useEffect(() => {
    const hasActive = jobs.some((j) =>
      ['pending', 'generating', 'processing', 'converting'].includes(j.status)
    );

    if (hasActive && !pollRef.current) {
      hadActiveRef.current = true;
      pollRef.current = setInterval(loadJobs, 2000);
    } else if (!hasActive && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
      if (hadActiveRef.current) {
        hadActiveRef.current = false;
        setTimeout(loadJobs, 500);
        setTimeout(loadJobs, 3000);
      }
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [jobs, loadJobs]);

  // Get latest job for an agent
  const getLatestJob = (agentId: string): SpriteJob | undefined => {
    return jobs.find(j => j.agentId === agentId);
  };

  // Generate/regenerate sprite for a citizen
  const handleGenerate = async (agentId: string, digimonName: string) => {
    setError('');
    setGenerating(agentId);

    try {
      const res = await fetch('/api/sprites/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, digimonName }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al generar');
        return;
      }

      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexion');
    } finally {
      setGenerating(null);
    }
  };

  // Add new citizen
  const handleAddCitizen = async () => {
    if (!newDigimon.trim() || !newAgentId.trim()) return;
    setError('');

    try {
      // Create GitHub repo if checked
      if (createRepo) {
        const repoRes = await fetch('/api/github', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repoName: newDigimon.trim(),
            description: `Digimon citizen: ${newDigimon.trim()} (${newAgentId.trim()})`,
            isPrivate: repoPrivate,
          }),
        });
        const repoData = await repoRes.json();
        if (!repoRes.ok) {
          setError(`GitHub: ${repoData.error}`);
          return;
        }
      }

      // Add to world via generate endpoint (it auto-registers)
      await handleGenerate(newAgentId.toLowerCase().trim(), newDigimon.trim());
      setNewDigimon('');
      setNewAgentId('');
      await loadCitizens();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  };

  // Update citizen scale in world.json
  const handleScaleChange = async (agentId: string, scale: number) => {
    // Update local state immediately
    setCitizens(prev => prev.map(c => c.agentId === agentId ? { ...c, scale } : c));
    try {
      const res = await fetch('/api/world');
      const config = await res.json();
      const citizen = config.citizens?.find((c: Citizen) => c.agentId === agentId);
      if (citizen) {
        citizen.scale = scale;
        await fetch('/api/world', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
        });
      }
    } catch { /* ignore */ }
  };

  // Toggle walk flip direction in world.json
  const handleFlipWalkToggle = async (agentId: string, flipWalk: boolean) => {
    setCitizens(prev => prev.map(c => c.agentId === agentId ? { ...c, flipWalk } : c));
    try {
      const res = await fetch('/api/world');
      const config = await res.json();
      const citizen = config.citizens?.find((c: Citizen) => c.agentId === agentId);
      if (citizen) {
        citizen.flipWalk = flipWalk;
        await fetch('/api/world', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
        });
      }
    } catch { /* ignore */ }
  };

  // Update frame config for a specific animation phase
  const handleFrameConfigChange = async (agentId: string, phase: AnimationPhase, frames: number[]) => {
    // Update local state immediately
    setCitizens(prev => prev.map(c => {
      if (c.agentId !== agentId) return c;
      const fc = { ...c.frameConfig, [phase]: frames };
      return { ...c, frameConfig: fc };
    }));
    // Persist to world.json
    try {
      const res = await fetch('/api/world');
      const config = await res.json();
      const citizen = config.citizens?.find((c: Citizen) => c.agentId === agentId);
      if (citizen) {
        if (!citizen.frameConfig) citizen.frameConfig = {};
        citizen.frameConfig[phase] = frames;
        await fetch('/api/world', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
        });
      }
    } catch { /* ignore */ }
  };

  // Update avatar crop for bubble face
  const avatarSaveTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const handleAvatarCropChange = (agentId: string, crop: { x: number; y: number; size: number }) => {
    // Update local state immediately for live preview
    setCitizens(prev => prev.map(c => c.agentId === agentId ? { ...c, avatarCrop: crop } : c));
    // Debounce persist to world.json (300ms)
    if (avatarSaveTimerRef.current[agentId]) clearTimeout(avatarSaveTimerRef.current[agentId]);
    avatarSaveTimerRef.current[agentId] = setTimeout(async () => {
      try {
        const res = await fetch('/api/world');
        const config = await res.json();
        const citizen = config.citizens?.find((c: Citizen) => c.agentId === agentId);
        if (citizen) {
          citizen.avatarCrop = crop;
          await fetch('/api/world', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config),
          });
        }
      } catch { /* ignore */ }
    }, 300);
  };

  // Rename digimon — updates world.json + digimon-data.json + regenerates profile
  const [renaming, setRenaming] = useState<string | null>(null);
  const handleSaveName = async (agentId: string) => {
    if (!editNameValue.trim()) return;
    setRenaming(agentId);
    try {
      const res = await fetch('/api/digimon-data/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, newName: editNameValue.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al renombrar');
      }
      await loadCitizens();
    } catch { /* ignore */ }
    setEditingName(null);
    setRenaming(null);
  };

  const handleUpload = async (files: File[]) => {
    if (!files.length || !newAgentId.trim() || !newDigimon.trim()) return;
    setError('');

    const formData = new FormData();
    formData.append('file', files[0]);
    formData.append('agentId', newAgentId.toLowerCase().trim());
    formData.append('digimonName', newDigimon.trim());

    try {
      const res = await fetch('/api/sprites/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al procesar');
        return;
      }

      setNewDigimon('');
      setNewAgentId('');
      setShowUpload(false);
      await loadJobs();
      await loadCitizens();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexion');
    }
  };

  // Reprocess sprites from saved raw image or a provided URL (no regeneration)
  const handleReprocess = async (agentId: string) => {
    setError('');
    setReprocessing(agentId);
    try {
      const citizen = citizens.find(c => c.agentId === agentId);
      const imageUrl = reprocessUrl[agentId]?.trim() || undefined;
      const yShift = reprocessYShift[agentId] ?? citizen?.yShift ?? 0;
      const res = await fetch('/api/sprites/reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, imageUrl, yShift }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al reprocesar');
        return;
      }
      // Persist yShift to world.json
      try {
        const wRes = await fetch('/api/world');
        const config = await wRes.json();
        const cit = config.citizens?.find((c: Citizen) => c.agentId === agentId);
        if (cit) {
          cit.yShift = yShift;
          await fetch('/api/world', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config),
          });
        }
      } catch { /* ignore */ }
      // Clear URL input on success, bump cache
      setReprocessUrl(prev => { const n = { ...prev }; delete n[agentId]; return n; });
      setSpriteVer(Date.now());
      await loadCitizens();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexion');
    } finally {
      setReprocessing(null);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wand2 size={20} className="text-digi-green" />
          <h1 className="font-pixel text-lg text-digi-green tracking-wider">
            Generador de Sprites
          </h1>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          {checking ? (
            <span className="text-digi-muted">Verificando...</span>
          ) : falAvailable ? (
            <span className="flex items-center gap-1.5 text-digi-green">
              <Wifi size={14} />
              fal.ai Ready
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-red-400">
              <WifiOff size={14} />
              fal.ai No configurado
            </span>
          )}
        </div>
      </div>

      {/* Add new citizen — collapsible */}
      <div className="bg-digi-card border border-digi-border rounded-lg">
        <button
          onClick={() => setShowAddCitizen(!showAddCitizen)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-digi-text hover:bg-white/5 transition-colors rounded-lg"
        >
          <span className="flex items-center gap-2">
            <Plus size={14} className="text-digi-green" />
            Agregar nuevo ciudadano
          </span>
          <ChevronDown size={14} className={`text-digi-muted transition-transform ${showAddCitizen ? 'rotate-180' : ''}`} />
        </button>

        {showAddCitizen && (
          <div className="px-4 pb-4 space-y-3 border-t border-digi-border/50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
              <div className="space-y-1">
                <label className="text-xs text-digi-muted">Nombre del Digimon</label>
                <input
                  type="text"
                  list="digimon-list"
                  value={newDigimon}
                  onChange={(e) => {
                    setNewDigimon(e.target.value);
                    if (!newAgentId || newAgentId === newDigimon.toLowerCase().replace(/[^a-z0-9]/g, '')) {
                      setNewAgentId(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''));
                    }
                  }}
                  placeholder="ej. Agumon, Gabumon..."
                  className="w-full bg-digi-dark border border-digi-border rounded px-3 py-2 text-sm text-digi-text placeholder:text-digi-muted/50 focus:outline-none focus:border-digi-green/50"
                />
                <datalist id="digimon-list">
                  {KNOWN_DIGIMON.map((d) => <option key={d} value={d} />)}
                </datalist>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-digi-muted">Agent ID</label>
                <input
                  type="text"
                  value={newAgentId}
                  onChange={(e) => setNewAgentId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="ej. agumon, gabumon..."
                  className="w-full bg-digi-dark border border-digi-border rounded px-3 py-2 text-sm text-digi-text placeholder:text-digi-muted/50 focus:outline-none focus:border-digi-green/50 font-mono"
                />
              </div>
            </div>

            {/* GitHub repo options */}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createRepo}
                  onChange={(e) => setCreateRepo(e.target.checked)}
                  className="accent-digi-green"
                />
                <span className="text-xs text-digi-text">Crear repo en <strong className="text-digi-green">Grupo-Corazones-Cruzados</strong></span>
              </label>
              {createRepo && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={repoPrivate}
                    onChange={(e) => setRepoPrivate(e.target.checked)}
                    className="accent-amber-400"
                  />
                  <span className="text-xs text-digi-muted">Privado</span>
                </label>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleAddCitizen}
                disabled={!!generating || !falAvailable || !newDigimon.trim() || !newAgentId.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-digi-green/20 border border-digi-green/40 text-digi-green rounded text-sm font-medium hover:bg-digi-green/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Sparkles size={16} />
                Generar y agregar
              </button>
              <button
                onClick={() => setShowUpload(!showUpload)}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-digi-border text-digi-muted rounded text-sm hover:text-digi-text hover:bg-white/10 transition-colors"
              >
                <Upload size={16} />
                Subir manual
              </button>
            </div>

            {showUpload && (
              <div className="pt-2">
                <p className="text-xs text-digi-muted mb-2">Sube una sprite sheet PNG (grilla 4x4 de 64x64 con fondo transparente)</p>
                <DropZone onDrop={handleUpload} accept={{ 'image/png': ['.png'] }} maxFiles={1} />
              </div>
            )}

            {!checking && !falAvailable && (
              <div className="text-xs text-amber-400/80 bg-amber-400/10 border border-amber-400/20 rounded px-3 py-2">
                fal.ai no esta configurado. Agrega <code className="text-amber-400">FAL_KEY</code> en .env.local
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-400/10 rounded px-3 py-2">{error}</p>
      )}

      {/* Citizens list — each with regenerate option */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-digi-text">Ciudadanos del mundo</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(() => {
            // Reorder so expanded citizen starts at an even index (beginning of a grid row)
            if (!editingFrames) return citizens;
            const idx = citizens.findIndex(c => c.agentId === editingFrames);
            if (idx <= 0) return citizens; // already first or not found
            if (idx % 2 === 0) return citizens; // already at row start
            // Swap with the previous citizen so expanded is at even index
            const reordered = [...citizens];
            [reordered[idx - 1], reordered[idx]] = [reordered[idx], reordered[idx - 1]];
            return reordered;
          })().map((c) => {
            const job = getLatestJob(c.agentId);
            const isGenerating = generating === c.agentId || (job && ['pending', 'generating', 'processing', 'converting'].includes(job.status));
            const isEditing = editingName === c.agentId;

            const isExpanded = editingFrames === c.agentId;

            return (
              <div
                key={c.agentId}
                className={`bg-digi-card border rounded-lg p-4 ${isExpanded ? 'md:col-span-2' : ''} ${isGenerating ? 'border-amber-400/30' : 'border-digi-border'}`}
              >
                <div className={`${isExpanded ? 'flex flex-col md:flex-row gap-4' : ''}`}>
                  {/* ── Left side: normal card content ── */}
                  <div className={`space-y-3 ${isExpanded ? 'md:flex-1 md:min-w-0' : ''}`}>
                    {/* Header: name + agentId + action buttons */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              list="digimon-list-edit"
                              value={editNameValue}
                              onChange={(e) => setEditNameValue(e.target.value)}
                              className="bg-digi-dark border border-digi-border rounded px-2 py-1 text-sm text-digi-text font-pixel w-full focus:outline-none focus:border-digi-green/50"
                              autoFocus
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveName(c.agentId)}
                            />
                            <button onClick={() => handleSaveName(c.agentId)} className="text-digi-green hover:text-digi-green/80">
                              <Check size={14} />
                            </button>
                            <button onClick={() => setEditingName(null)} className="text-digi-muted hover:text-red-400">
                              <X size={14} />
                            </button>
                            <datalist id="digimon-list-edit">
                              {KNOWN_DIGIMON.map((d) => <option key={d} value={d} />)}
                            </datalist>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <h3 className="font-pixel text-sm text-digi-green truncate">{c.name}</h3>
                            <button
                              onClick={() => { setEditingName(c.agentId); setEditNameValue(c.name); }}
                              className="text-digi-muted hover:text-digi-text transition-colors shrink-0"
                              title="Cambiar nombre del Digimon"
                            >
                              <Pencil size={12} />
                            </button>
                          </div>
                        )}
                        <p className="text-xs text-digi-muted font-mono mt-0.5">
                          {c.agentId}
                          {renaming === c.agentId && (
                            <span className="ml-2 text-amber-400 animate-pulse">regenerando perfil...</span>
                          )}
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => setConfirmRegenerate({ agentId: c.agentId, name: c.name })}
                          disabled={!!isGenerating || !falAvailable}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-digi-green/15 border border-digi-green/30 text-digi-green rounded text-[10px] font-medium hover:bg-digi-green/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Regenerar sprites con fal.ai (nueva imagen)"
                        >
                          {isGenerating ? (
                            <><RefreshCw size={11} className="animate-spin" /> Generando</>
                          ) : (
                            <><RefreshCw size={11} /> Regenerar</>
                          )}
                        </button>
                        <button
                          onClick={() => setEditingFrames(isExpanded ? null : c.agentId)}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded border text-[10px] font-medium transition-colors ${
                            isExpanded
                              ? 'border-amber-400/50 bg-amber-400/15 text-amber-400'
                              : 'border-digi-border text-digi-muted hover:text-digi-text hover:border-digi-border/80'
                          }`}
                          title="Configurar frames y Y Shift"
                        >
                          <SlidersHorizontal size={11} />
                          Ajustar
                        </button>
                      </div>
                    </div>

                    {/* Controls row: scale + flip */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-digi-muted">Escala:</span>
                        <input
                          type="range"
                          min="0.5"
                          max="2"
                          step="0.1"
                          value={c.scale ?? 1}
                          onChange={(e) => handleScaleChange(c.agentId, parseFloat(e.target.value))}
                          className="w-20 h-1 accent-digi-green"
                        />
                        <span className="text-[9px] text-digi-muted font-mono w-6">{(c.scale ?? 1).toFixed(1)}</span>
                      </div>
                      <button
                        onClick={() => handleFlipWalkToggle(c.agentId, !(c.flipWalk ?? true))}
                        className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
                          (c.flipWalk ?? true)
                            ? 'text-digi-green border-digi-green/30 bg-digi-green/10'
                            : 'text-amber-400 border-amber-400/30 bg-amber-400/10'
                        }`}
                        title="Controla qué dirección se invierte al caminar"
                      >
                        Flip: {(c.flipWalk ?? true) ? '← izq' : '→ der'}
                      </button>
                    </div>

                    {/* Active job status */}
                    {job && ['pending', 'generating', 'processing', 'converting'].includes(job.status) && (
                      <div className="flex items-center gap-2 text-xs text-amber-400 animate-pulse">
                        <RefreshCw size={12} className="animate-spin" />
                        <span>
                          {job.status === 'generating' ? 'Generando sprites con fal.ai...' :
                           job.status === 'processing' ? 'Procesando imagen...' :
                           job.status === 'converting' ? 'Preparando sheets...' : 'En cola...'}
                        </span>
                      </div>
                    )}

                    {/* Error */}
                    {job && job.status === 'error' && (
                      <p className="text-xs text-red-400 font-mono bg-red-400/10 rounded p-2">
                        {job.errorMessage || 'Error desconocido'}
                      </p>
                    )}

                    {/* Sprite previews — 7 states */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {([
                        { phase: 'idle' as AnimationPhase, src: `_actions.png`, row: 3, fps: 3, label: 'idle' },
                        { phase: 'walk' as AnimationPhase, src: `_walk.png`, row: 3, fps: 5, label: 'walk' },
                        { phase: 'work' as AnimationPhase, src: `_actions.png`, row: 0, fps: 3, label: 'work' },
                        { phase: 'excited' as AnimationPhase, src: `_actions.png`, row: 2, fps: 4, label: 'excited' },
                        { phase: 'rest' as AnimationPhase, src: `_actions.png`, row: 1, fps: 2, label: 'rest' },
                        { phase: 'done' as AnimationPhase, src: `_done.png`, row: 0, fps: 4, label: 'done' },
                        { phase: 'eating' as AnimationPhase, src: `_eating.png`, row: 0, fps: 4, label: 'eating' },
                      ]).map((anim) => {
                        const selFrames = c.frameConfig?.[anim.phase];
                        return (
                          <div key={anim.phase} className="text-center">
                            <AnimatedSprite
                              src={`/api/assets/universal_assets/citizens/${c.sprite}${anim.src}?v=${spriteVer}`}
                              row={anim.row}
                              frameCount={4}
                              fps={anim.fps}
                              scale={1.5}
                              className="mx-auto"
                              selectedFrames={selFrames}
                            />
                            <span className="text-[9px] text-digi-muted block">
                              {anim.label}
                              {selFrames && selFrames.length < 4 && (
                                <span className="text-digi-green ml-0.5">({selFrames.length})</span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Y Shift preview + controls — visible in left area when expanded */}
                    {isExpanded && (
                      <div className="bg-digi-dark/50 border border-digi-border/50 rounded-lg p-3 space-y-2">
                        <p className="text-[9px] text-digi-muted font-medium">Ajuste vertical de corte</p>
                        <RawSheetPreview
                          src={`/api/assets/universal_assets/citizens/${c.sprite}_raw.png?v=${spriteVer}`}
                          yShift={reprocessYShift[c.agentId] ?? c.yShift ?? 0}
                        />
                        <p className="text-[9px] text-digi-muted">Negativo = mas pies, Positivo = mas cabeza.</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-amber-400 font-mono w-14 shrink-0">Y Shift:</span>
                          <input
                            type="range"
                            min="-15"
                            max="15"
                            step="1"
                            value={reprocessYShift[c.agentId] ?? c.yShift ?? 0}
                            onChange={(e) => setReprocessYShift(prev => ({ ...prev, [c.agentId]: parseInt(e.target.value) }))}
                            className="flex-1 h-1.5 accent-amber-400"
                          />
                          <span className="text-[10px] text-amber-400 font-mono w-10 text-right font-bold">
                            {reprocessYShift[c.agentId] ?? c.yShift ?? 0}%
                          </span>
                        </div>
                        <input
                          type="text"
                          value={reprocessUrl[c.agentId] || ''}
                          onChange={(e) => setReprocessUrl(prev => ({ ...prev, [c.agentId]: e.target.value }))}
                          placeholder="URL imagen raw (opcional)"
                          className="w-full bg-digi-dark border border-digi-border rounded px-2 py-1.5 text-[9px] text-digi-text placeholder:text-digi-muted/40 focus:outline-none focus:border-amber-400/40 font-mono"
                        />
                        <button
                          onClick={() => handleReprocess(c.agentId)}
                          disabled={reprocessing === c.agentId}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-400/15 border border-amber-400/30 text-amber-400 rounded text-xs font-medium hover:bg-amber-400/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed w-full justify-center"
                        >
                          {reprocessing === c.agentId ? (
                            <><RotateCcw size={12} className="animate-spin" /> Reprocesando...</>
                          ) : (
                            <><RotateCcw size={12} /> Aplicar Y Shift y Reprocesar</>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* ── Right side: adjustment panel (only when expanded) ── */}
                  {isExpanded && (
                    <div className="w-full md:w-[340px] shrink-0 bg-digi-dark/50 border border-digi-border/50 rounded-lg p-3 space-y-3 overflow-y-auto max-h-[75vh]">
                      {/* Avatar crop editor */}
                      <div className="space-y-1.5">
                        <p className="text-[9px] text-digi-muted font-medium">Foto de burbuja</p>
                        <AvatarCropEditor
                          src={`/api/assets/universal_assets/citizens/${c.sprite}_walk.png?v=${spriteVer}`}
                          crop={c.avatarCrop ?? { x: 12, y: 14, size: 28 }}
                          onChange={(crop) => handleAvatarCropChange(c.agentId, crop)}
                        />
                      </div>

                      {/* Frame selectors */}
                      <div className="border-t border-digi-border/30 pt-3 space-y-1.5">
                        <p className="text-[9px] text-digi-muted">Toca cada frame para activar/desactivar.</p>
                        {([
                          { phase: 'idle' as AnimationPhase, src: `_actions.png`, row: 3, label: 'Idle' },
                          { phase: 'walk' as AnimationPhase, src: `_walk.png`, row: 3, label: 'Walk' },
                          { phase: 'work' as AnimationPhase, src: `_actions.png`, row: 0, label: 'Work' },
                          { phase: 'excited' as AnimationPhase, src: `_actions.png`, row: 2, label: 'Excited' },
                          { phase: 'rest' as AnimationPhase, src: `_actions.png`, row: 1, label: 'Rest' },
                          { phase: 'done' as AnimationPhase, src: `_done.png`, row: 0, label: 'Done' },
                          { phase: 'eating' as AnimationPhase, src: `_eating.png`, row: 0, label: 'Eating' },
                        ]).map((anim) => (
                          <div key={anim.phase} className="flex items-center gap-2">
                            <span className="text-[10px] text-digi-muted font-mono w-12 shrink-0">{anim.label}</span>
                            <FrameSelector
                              src={`/api/assets/universal_assets/citizens/${c.sprite}${anim.src}?v=${spriteVer}`}
                              row={anim.row}
                              frameCount={4}
                              selectedFrames={c.frameConfig?.[anim.phase] ?? [0, 1, 2, 3]}
                              onChange={(frames) => handleFrameConfigChange(c.agentId, anim.phase, frames)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Info */}
      <div className="text-xs text-digi-muted space-y-1 border-t border-digi-border pt-4">
        <p>Generacion via <strong className="text-digi-text">fal.ai nano-banana-pro</strong> + remocion de fondo con <strong className="text-digi-text">bria</strong> + perfil via <strong className="text-digi-text">OpenAI GPT-4o</strong>.</p>
      </div>

      {/* Regenerate confirmation modal */}
      {confirmRegenerate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setConfirmRegenerate(null)}>
          <div className="bg-digi-card border border-digi-border rounded-lg p-5 max-w-sm mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-pixel text-sm text-amber-400">Confirmar regeneracion</h3>
            <p className="text-xs text-digi-text">
              Esto generara una <strong>nueva imagen</strong> con fal.ai para <strong className="text-digi-green">{confirmRegenerate.name}</strong>, reemplazando los sprites actuales. Esta accion no se puede deshacer.
            </p>
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setConfirmRegenerate(null)}
                className="px-3 py-1.5 text-xs text-digi-muted border border-digi-border rounded hover:text-digi-text hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  handleGenerate(confirmRegenerate.agentId, confirmRegenerate.name);
                  setConfirmRegenerate(null);
                }}
                className="px-3 py-1.5 text-xs text-amber-400 bg-amber-400/15 border border-amber-400/30 rounded font-medium hover:bg-amber-400/25 transition-colors"
              >
                Si, regenerar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

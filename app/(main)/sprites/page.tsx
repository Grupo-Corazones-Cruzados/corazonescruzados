'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Wand2, Wifi, WifiOff, Upload, Sparkles, RefreshCw, Pencil, Check, X } from 'lucide-react';
import SpriteJobCard from '@/components/sprites/SpriteJobCard';
import DropZone from '@/components/shared/DropZone';
import AnimatedSprite from '@/components/shared/AnimatedSprite';
import type { SpriteJob } from '@/types/sprites';

interface Citizen {
  agentId: string;
  name: string;
  sprite: string;
}

const KNOWN_DIGIMON = [
  'Agumon', 'Gabumon', 'Patamon', 'Gumdramon',
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

  // Editing digimon name per citizen
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');

  // Upload
  const [showUpload, setShowUpload] = useState(false);

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
      // Add to world via generate endpoint (it auto-registers)
      await handleGenerate(newAgentId.toLowerCase().trim(), newDigimon.trim());
      setNewDigimon('');
      setNewAgentId('');
      await loadCitizens();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  };

  // Update citizen name in world.json
  const handleSaveName = async (agentId: string) => {
    if (!editNameValue.trim()) return;
    try {
      const res = await fetch('/api/world');
      const config = await res.json();
      const citizen = config.citizens?.find((c: Citizen) => c.agentId === agentId);
      if (citizen) {
        citizen.name = editNameValue.trim();
        await fetch('/api/world', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
        });
        await loadCitizens();
      }
    } catch { /* ignore */ }
    setEditingName(null);
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

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
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

      {/* Citizens list — each with regenerate option */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-digi-text">Ciudadanos del mundo</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {citizens.map((c) => {
            const job = getLatestJob(c.agentId);
            const isGenerating = generating === c.agentId || (job && ['pending', 'generating', 'processing', 'converting'].includes(job.status));
            const isEditing = editingName === c.agentId;

            return (
              <div
                key={c.agentId}
                className={`bg-digi-card border rounded-lg p-4 space-y-3 ${isGenerating ? 'border-amber-400/30' : 'border-digi-border'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
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
                    <p className="text-xs text-digi-muted font-mono mt-0.5">{c.agentId}</p>
                  </div>

                  <button
                    onClick={() => handleGenerate(c.agentId, c.name)}
                    disabled={!!isGenerating || !falAvailable}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-digi-green/15 border border-digi-green/30 text-digi-green rounded text-xs font-medium hover:bg-digi-green/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 ml-2"
                    title="Regenerar sprites con fal.ai"
                  >
                    {isGenerating ? (
                      <><RefreshCw size={12} className="animate-spin" /> Generando...</>
                    ) : (
                      <><RefreshCw size={12} /> Regenerar</>
                    )}
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
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <div className="text-center">
                    <AnimatedSprite
                      src={`/api/assets/universal_assets/citizens/${c.sprite}_actions.png`}
                      row={3}
                      frameCount={4}
                      fps={3}
                      scale={2}
                      className="mx-auto"
                    />
                    <span className="text-[9px] text-digi-muted block">idle</span>
                  </div>
                  <div className="text-center">
                    <AnimatedSprite
                      src={`/api/assets/universal_assets/citizens/${c.sprite}_walk.png`}
                      row={3}
                      frameCount={4}
                      fps={5}
                      scale={2}
                      className="mx-auto"
                    />
                    <span className="text-[9px] text-digi-muted block">walk</span>
                  </div>
                  <div className="text-center">
                    <AnimatedSprite
                      src={`/api/assets/universal_assets/citizens/${c.sprite}_actions.png`}
                      row={0}
                      frameCount={4}
                      fps={3}
                      scale={2}
                      className="mx-auto"
                    />
                    <span className="text-[9px] text-digi-muted block">work</span>
                  </div>
                  <div className="text-center">
                    <AnimatedSprite
                      src={`/api/assets/universal_assets/citizens/${c.sprite}_actions.png`}
                      row={2}
                      frameCount={4}
                      fps={4}
                      scale={2}
                      className="mx-auto"
                    />
                    <span className="text-[9px] text-digi-muted block">excited</span>
                  </div>
                  <div className="text-center">
                    <AnimatedSprite
                      src={`/api/assets/universal_assets/citizens/${c.sprite}_actions.png`}
                      row={1}
                      frameCount={4}
                      fps={2}
                      scale={2}
                      className="mx-auto"
                    />
                    <span className="text-[9px] text-digi-muted block">rest</span>
                  </div>
                  <div className="text-center">
                    <AnimatedSprite
                      src={`/api/assets/universal_assets/citizens/${c.sprite}_done.png`}
                      row={0}
                      frameCount={4}
                      fps={4}
                      scale={2}
                      className="mx-auto"
                    />
                    <span className="text-[9px] text-digi-muted block">done</span>
                  </div>
                  <div className="text-center">
                    <AnimatedSprite
                      src={`/api/assets/universal_assets/citizens/${c.sprite}_eating.png`}
                      row={0}
                      frameCount={4}
                      fps={4}
                      scale={2}
                      className="mx-auto"
                    />
                    <span className="text-[9px] text-digi-muted block">eating</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-400/10 rounded px-3 py-2">{error}</p>
      )}

      {/* Add new citizen */}
      <div className="bg-digi-card border border-digi-border rounded-lg p-4 space-y-4">
        <h2 className="text-sm font-medium text-digi-text">Agregar nuevo ciudadano</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
            <p className="text-xs text-digi-muted mb-2">
              Sube una sprite sheet PNG (grilla 4x4 de 64x64 con fondo transparente)
            </p>
            <DropZone
              onDrop={handleUpload}
              accept={{ 'image/png': ['.png'] }}
              maxFiles={1}
            />
          </div>
        )}

        {!checking && !falAvailable && (
          <div className="text-xs text-amber-400/80 bg-amber-400/10 border border-amber-400/20 rounded px-3 py-2">
            fal.ai no esta configurado. Agrega <code className="text-amber-400">FAL_KEY</code> en .env.local
          </div>
        )}
      </div>

      {/* Info */}
      <div className="text-xs text-digi-muted space-y-1 border-t border-digi-border pt-4">
        <p>Generacion via <strong className="text-digi-text">fal.ai nano-banana-pro</strong> + remocion de fondo con <strong className="text-digi-text">bria</strong> + perfil via <strong className="text-digi-text">OpenAI GPT-4o</strong>.</p>
        <p>Se generan 3 sprite sheets por personaje (walk + actions + eating) con 7 estados: idle, walking, working, excited, resting, celebration y eating.</p>
      </div>
    </div>
  );
}

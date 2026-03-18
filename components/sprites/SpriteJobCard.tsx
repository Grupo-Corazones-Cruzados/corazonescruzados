'use client';

import { Loader2, Check, AlertCircle, RefreshCw } from 'lucide-react';
import type { SpriteJob } from '@/types/sprites';
import AnimatedSprite from '@/components/shared/AnimatedSprite';

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode; pulse?: boolean }> = {
  pending: { label: 'En cola...', color: 'text-gray-400', icon: <Loader2 size={14} className="animate-spin" />, pulse: true },
  generating: { label: 'Generando sprites...', color: 'text-amber-400', icon: <Loader2 size={14} className="animate-spin" />, pulse: true },
  processing: { label: 'Procesando imagen...', color: 'text-blue-400', icon: <Loader2 size={14} className="animate-spin" />, pulse: true },
  converting: { label: 'Preparando sheets...', color: 'text-purple-400', icon: <Loader2 size={14} className="animate-spin" />, pulse: true },
  ready: { label: 'Listo', color: 'text-digi-green', icon: <Check size={14} /> },
  error: { label: 'Error', color: 'text-red-400', icon: <AlertCircle size={14} /> },
};

interface SpriteJobCardProps {
  job: SpriteJob;
  onRetry?: (job: SpriteJob) => void;
}

export default function SpriteJobCard({ job, onRetry }: SpriteJobCardProps) {
  const status = statusConfig[job.status] || statusConfig.pending;
  const isActive = !['ready', 'error'].includes(job.status);

  return (
    <div className={`bg-digi-card border rounded-lg p-4 space-y-3 ${isActive ? 'border-amber-400/30 animate-pulse' : 'border-digi-border'}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-pixel text-sm text-digi-green">{job.digimonName}</h3>
          <p className="text-xs text-digi-muted font-mono mt-0.5">{job.agentId}</p>
        </div>
        <div className={`flex items-center gap-1.5 text-xs font-medium ${status.color}`}>
          {status.icon}
          <span>{status.label}</span>
        </div>
      </div>

      {/* Error message */}
      {job.status === 'error' && (
        <div className="space-y-2">
          <p className="text-xs text-red-400 font-mono bg-red-400/10 rounded p-2">
            {job.errorMessage || 'Error desconocido'}
          </p>
          {onRetry && (
            <button
              onClick={() => onRetry(job)}
              className="flex items-center gap-1.5 text-xs text-digi-green hover:text-digi-green/80 transition-colors"
            >
              <RefreshCw size={12} />
              Reintentar
            </button>
          )}
        </div>
      )}

      {/* Preview when ready */}
      {job.status === 'ready' && (
        <div className="flex items-center gap-3 pt-1">
          <div className="text-center">
            <AnimatedSprite
              src={`/api/assets/universal_assets/citizens/${job.agentId}_actions.png`}
              row={3}
              frameCount={4}
              fps={4}
              scale={2}
              className="mx-auto"
            />
            <span className="text-[10px] text-digi-muted mt-1 block">idle</span>
          </div>
          <div className="text-center">
            <AnimatedSprite
              src={`/api/assets/universal_assets/citizens/${job.agentId}_walk.png`}
              row={3}
              frameCount={4}
              fps={6}
              scale={2}
              className="mx-auto"
            />
            <span className="text-[10px] text-digi-muted mt-1 block">walk</span>
          </div>
          <div className="text-center">
            <AnimatedSprite
              src={`/api/assets/universal_assets/citizens/${job.agentId}_actions.png`}
              row={0}
              frameCount={4}
              fps={4}
              scale={2}
              className="mx-auto"
            />
            <span className="text-[10px] text-digi-muted mt-1 block">working</span>
          </div>
          <div className="text-center">
            <AnimatedSprite
              src={`/api/assets/universal_assets/citizens/${job.agentId}_actions.png`}
              row={1}
              frameCount={4}
              fps={2}
              scale={2}
              className="mx-auto"
            />
            <span className="text-[10px] text-digi-muted mt-1 block">rest</span>
          </div>
        </div>
      )}

      {/* Timestamp */}
      <p className="text-[10px] text-digi-muted font-mono">
        {new Date(job.createdAt).toLocaleString('es-CR')}
      </p>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { CheckCircle, AlertTriangle, Globe } from 'lucide-react';
import Link from 'next/link';
import type { ValidationResult } from '@/types/world';

export default function Dashboard() {
  const { world, fetchWorld } = useAppStore();

  useEffect(() => {
    fetchWorld();
  }, [fetchWorld]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-pixel text-lg text-digi-green">Dashboard</h2>
        <p className="text-sm text-digi-muted mt-1">
          Overview of your GCC World
        </p>
      </div>

      {/* World preview banner */}
      <Link
        href="/world"
        className="block bg-digi-card border border-digi-border rounded-lg p-4 hover:border-digi-green/30 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <Globe size={24} className="text-digi-green" />
          <div>
            <p className="font-pixel text-xs text-digi-green group-hover:text-digi-green/80">
              View World
            </p>
            <p className="text-xs text-digi-muted">
              Open the interactive world viewer with live rendering
            </p>
          </div>
        </div>
      </Link>

      {/* World info */}
      <div className="bg-digi-card border border-digi-border rounded-lg p-4">
        <h3 className="font-pixel text-xs text-digi-green mb-3">
          World Info
        </h3>
        <div className="space-y-2 text-sm font-mono">
          <InfoRow label="Grid Size" value={`${world?.gridCols}x${world?.gridRows}`} />
          <InfoRow label="Citizens" value={world?.citizens.length} />
          <InfoRow label="Props Placed" value={world?.props.length} />
          <InfoRow label="Wander Points" value={world?.wanderPoints.length} />
        </div>
      </div>

      {/* Validation */}
      <ValidationPanel />
    </div>
  );
}

function InfoRow({
  label,
  value,
  className,
}: {
  label: string;
  value: any;
  className?: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-digi-muted">{label}</span>
      <span className={className}>{value}</span>
    </div>
  );
}

function ValidationPanel() {
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const runValidation = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/world/validate', { method: 'POST' });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ valid: false, errors: ['Failed to run validation'], warnings: [] });
    }
    setLoading(false);
  };

  return (
    <div className="bg-digi-card border border-digi-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-pixel text-xs text-digi-green">Validation</h3>
        <button
          onClick={runValidation}
          disabled={loading}
          className="px-3 py-1.5 bg-digi-green/20 border border-digi-green/30 rounded text-xs text-digi-green hover:bg-digi-green/30 transition-colors disabled:opacity-50"
        >
          {loading ? 'Checking...' : 'Run Validation Check'}
        </button>
      </div>

      {result && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {result.valid ? (
              <CheckCircle size={16} className="text-green-400" />
            ) : (
              <AlertTriangle size={16} className="text-red-400" />
            )}
            <span className="text-sm font-medium">
              {result.valid
                ? 'All checks passed'
                : `${result.errors.length} error(s) found`}
            </span>
          </div>
          {result.errors.map((err, i) => (
            <p key={i} className="text-xs text-red-400 font-mono ml-6">
              {err}
            </p>
          ))}
          {result.warnings.map((w, i) => (
            <p key={i} className="text-xs text-yellow-400 font-mono ml-6">
              {w}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, type FormEvent } from 'react';
import { Loader2, Lock } from 'lucide-react';
import PixelInput from '@/components/ui/PixelInput';
import { BTN_PRIMARY } from '@/components/ui/Button';
import { TONO } from '@/components/ui/tonos';
import { ProveedorTemaPanel, useTemaPanel } from '@/components/providers/TemaPanel';
import { destinoSeguro } from './api';
import '../../app/tema-progreso.css';
import '../../app/temas.css';

function Formulario({ servicio, claveConfigurada }: { servicio: boolean; claveConfigurada: boolean }) {
  const { tema, oscuro } = useTemaPanel();
  const [clave, setClave] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const crear = !claveConfigurada;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (crear && clave !== repetida) { setError('Las contraseñas no coinciden.'); return; }
    setCargando(true); setError('');
    const r = await fetch('/api/espacio-trabajo/acceso', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: crear ? 'crear' : 'entrar', clave }),
    }).catch(() => null);
    const j = await r?.json().catch(() => ({}));
    if (r?.ok) { window.location.href = destinoSeguro(new URLSearchParams(window.location.search).get('volver')); return; }
    setCargando(false);
    setError(j?.error || 'No se pudo entrar.');
  }

  return (
    <div className={`corp tema-progreso tema-${tema} ${oscuro ? 'dark' : ''} min-h-dvh flex items-center justify-center p-4 bg-digi-dark`}>
      <form onSubmit={enviar} className="w-full max-w-sm bg-digi-card border border-digi-border rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-lg bg-accent-light flex items-center justify-center"><Lock className="w-4 h-4 text-accent" /></span>
          <h1 className="text-[15px] font-semibold text-digi-text">{crear ? 'Crea la contraseña' : 'Espacio de trabajo'}</h1>
        </div>
        {!servicio && <p className={`text-[13px] ${TONO.error.texto}`}>El servicio local no está en marcha.</p>}
        <PixelInput type="password" label="Contraseña" autoFocus autoComplete={crear ? 'new-password' : 'current-password'} value={clave} onChange={(e) => setClave(e.target.value)} />
        {crear && <PixelInput type="password" label="Repite la contraseña" autoComplete="new-password" value={repetida} onChange={(e) => setRepetida(e.target.value)} />}
        {error && <p className={`text-[13px] ${TONO.error.texto}`}>{error}</p>}
        <button type="submit" disabled={!clave || cargando || !servicio} className={`${BTN_PRIMARY} w-full`}>
          {cargando && <Loader2 className="w-4 h-4 animate-spin" />} {crear ? 'Crear y entrar' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

export default function FormAcceso(p: { servicio: boolean; claveConfigurada: boolean }) {
  return <ProveedorTemaPanel><Formulario {...p} /></ProveedorTemaPanel>;
}

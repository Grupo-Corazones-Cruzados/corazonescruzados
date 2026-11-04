'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, Lock } from 'lucide-react';
import PixelInput from '@/components/ui/PixelInput';
import { BTN_PRIMARY } from '@/components/ui/Button';
import { TONO } from '@/components/ui/tonos';
import EspacioTrabajo from './EspacioTrabajo';
import { cabeceras, guardarToken } from './api';
import '../../app/tema-progreso.css';
import '../../app/temas.css';

/**
 * EL ESPACIO DE TRABAJO DENTRO DE LA APP. Se sirve desde la Mac por la red privada y va en un marco
 * del panel; el tema se recibe de la app, porque aquí no se comparte su almacenamiento.
 */
export default function EspacioEmbebido() {
  const params = useSearchParams();
  const [tema] = useState(() => (/^[a-z0-9-]{1,30}$/.test(params.get('tema') || '') ? params.get('tema') : 'por-defecto'));
  const [oscuro] = useState(() => params.get('oscuro') === '1');
  const [estado, setEstado] = useState<'cargando' | 'clave' | 'dentro'>('cargando');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    window.parent?.postMessage('espacio-listo', '*');
    fetch('/api/espacio-trabajo/estado', { headers: cabeceras() })
      .then((r) => r.json())
      .then((j) => {
        if (!j.servicio) setError('El servicio local no está en marcha.');
        setEstado(j.autenticado ? 'dentro' : 'clave');
      })
      .catch(() => { setError('No se pudo conectar con la Mac.'); setEstado('clave'); });
    const salir = () => setEstado('clave');
    window.addEventListener('espacio-sin-sesion', salir);
    return () => window.removeEventListener('espacio-sin-sesion', salir);
  }, []);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true); setError('');
    const r = await fetch('/api/espacio-trabajo/acceso', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'token', clave }),
    }).catch(() => null);
    const j = await r?.json().catch(() => ({}));
    setEnviando(false);
    if (r?.ok && j?.token) { guardarToken(j.token); setClave(''); setEstado('dentro'); return; }
    setError(j?.error || 'No se pudo entrar.');
  }

  return (
    <div className={`corp tema-progreso tema-${tema} ${oscuro ? 'dark' : ''} h-dvh p-0 bg-digi-dark`}>
      {estado === 'dentro' && <EspacioTrabajo />}
      {estado === 'cargando' && <div className="h-full flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-digi-muted" /></div>}
      {estado === 'clave' && (
        <div className="h-full flex items-center justify-center p-4">
          <form onSubmit={entrar} className="w-full max-w-sm bg-digi-card border border-digi-border rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-lg bg-accent-light flex items-center justify-center"><Lock className="w-4 h-4 text-accent" /></span>
              <h1 className="text-[15px] font-semibold text-digi-text">Espacio de trabajo</h1>
            </div>
            <PixelInput type="password" label="Contraseña" autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} />
            {error && <p className={`text-[13px] ${TONO.error.texto}`}>{error}</p>}
            <button type="submit" disabled={!clave || enviando} className={`${BTN_PRIMARY} w-full`}>
              {enviando && <Loader2 className="w-4 h-4 animate-spin" />} Entrar
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

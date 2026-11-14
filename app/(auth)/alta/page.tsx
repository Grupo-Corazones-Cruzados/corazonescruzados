'use client';

import { useEffect, useState } from 'react';
import { PANEL_AUTH, TITULO_AUTH, TEXTO_AUTH, CAMPO_AUTH, ERROR_AUTH } from '@/components/landing/authEstilos';
import FormularioAlta from './FormularioAlta';

/**
 * EL FORMULARIO DE ALTA DEL CANDIDATO ACEPTADO (Fernando, 2026-11-12). Se llega por el enlace de la credencial que
 * recibió en su correo corporativo. Dos pasos con las piezas del inicio de sesión (familia «acceso»):
 *  1. Ingreso: correo corporativo + contraseña temporal (sin eso no se ve el formulario).
 *  2. Datos de la cuenta: su contraseña, país, teléfono y dirección. Al guardar entra al panel con el correo
 *     corporativo, que desde ahí es el único con el que inicia sesión.
 */
export default function AltaCandidato() {
  const [paso, setPaso] = useState<'cargando' | 'ingreso' | 'datos'>('cargando');
  const [cuenta, setCuenta] = useState<{ correo: string; nombres: string; apellidos: string; talentos: string[] } | null>(null);
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Si ya hay una sesión de alta abierta (recargó la página), se sigue en el paso 2.
  useEffect(() => {
    fetch('/api/candidate/alta/completar').then(async (r) => {
      if (r.ok) { setCuenta(await r.json()); setPaso('datos'); } else setPaso('ingreso');
    }).catch(() => setPaso('ingreso'));
  }, []);

  const ingresar = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setEnviando(true);
    try {
      const r = await fetch('/api/candidate/alta/entrar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo, clave }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(j.error || 'No se pudo ingresar.'); return; }
      // Con la sesión abierta se piden los datos del formulario (nombres de la postulación y talentos).
      const d = await fetch('/api/candidate/alta/completar');
      if (!d.ok) { setError('No se pudo abrir el formulario. Vuelve a intentarlo.'); return; }
      setCuenta(await d.json()); setPaso('datos');
    } catch { setError('Revisa tu conexión e inténtalo de nuevo.'); }
    finally { setEnviando(false); }
  };

  const boton = (texto: string, enCurso: string) => (
    <button type="submit" disabled={enviando} className="pixel-btn pixel-btn-primary w-full" style={{ marginTop: 4, opacity: enviando ? 0.6 : 1 }}>
      {enviando ? enCurso : texto}
    </button>
  );
  if (paso === 'cargando') return <div style={PANEL_AUTH} />;

  if (paso === 'ingreso') {
    return (
      <div style={PANEL_AUTH}>
        <h1 style={TITULO_AUTH}>Creación de cuenta</h1>
        <p style={TEXTO_AUTH}>Ingresa con el correo corporativo y la contraseña temporal que recibiste.</p>
        <form onSubmit={ingresar} className="flex flex-col gap-2.5">
          <input type="email" required autoFocus autoComplete="username" value={correo} onChange={(e) => setCorreo(e.target.value)}
            placeholder="Correo corporativo (@grupocc.org)" aria-label="Correo corporativo" style={CAMPO_AUTH} />
          <input type="password" required autoComplete="one-time-code" value={clave} onChange={(e) => setClave(e.target.value)}
            placeholder="Contraseña temporal" aria-label="Contraseña temporal" style={CAMPO_AUTH} />
          {error && <div role="alert" style={ERROR_AUTH}>{error}</div>}
          {boton('Ingresar', 'Ingresando…')}
        </form>
      </div>
    );
  }

  if (!cuenta) return <div style={PANEL_AUTH} />;
  return <FormularioAlta cuenta={cuenta} alTerminar={(destino) => { window.location.href = destino; }} />;
}

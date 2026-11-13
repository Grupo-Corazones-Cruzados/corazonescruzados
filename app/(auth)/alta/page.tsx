'use client';

import { useEffect, useState } from 'react';
import { PANEL_AUTH, TITULO_AUTH, TEXTO_AUTH, CAMPO_AUTH, ERROR_AUTH } from '@/components/landing/authEstilos';

/**
 * EL FORMULARIO DE ALTA DEL CANDIDATO ACEPTADO (Fernando, 2026-11-12). Se llega por el enlace de la credencial que
 * recibió en su correo corporativo. Dos pasos con las piezas del inicio de sesión (familia «acceso»):
 *  1. Ingreso: correo corporativo + contraseña temporal (sin eso no se ve el formulario).
 *  2. Datos de la cuenta: su contraseña, país, teléfono y dirección. Al guardar entra al panel con el correo
 *     corporativo, que desde ahí es el único con el que inicia sesión.
 */
export default function AltaCandidato() {
  const [paso, setPaso] = useState<'cargando' | 'ingreso' | 'datos'>('cargando');
  const [cuenta, setCuenta] = useState<{ nombre: string | null; correo: string } | null>(null);
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [datos, setDatos] = useState({ password: '', confirmar: '', pais: '', telefono: '', direccion: '' });
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
      setCuenta({ nombre: j.nombre, correo: j.correo }); setPaso('datos');
    } catch { setError('Revisa tu conexión e inténtalo de nuevo.'); }
    finally { setEnviando(false); }
  };

  const completar = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (datos.password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return; }
    if (datos.password !== datos.confirmar) { setError('Las contraseñas no coinciden.'); return; }
    setEnviando(true);
    try {
      const r = await fetch('/api/candidate/alta/completar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(j.error || 'No se pudo crear la cuenta.'); if (r.status === 401) setPaso('ingreso'); return; }
      window.location.href = j.destino || '/dashboard';
    } catch { setError('Revisa tu conexión e inténtalo de nuevo.'); }
    finally { setEnviando(false); }
  };

  const boton = (texto: string, enCurso: string) => (
    <button type="submit" disabled={enviando} className="pixel-btn pixel-btn-primary w-full" style={{ marginTop: 4, opacity: enviando ? 0.6 : 1 }}>
      {enviando ? enCurso : texto}
    </button>
  );
  const campo = (clave: keyof typeof datos, marcador: string, tipo = 'text', auto?: string) => (
    <input type={tipo} required value={datos[clave]} autoComplete={auto} placeholder={marcador} aria-label={marcador}
      onChange={(e) => setDatos({ ...datos, [clave]: e.target.value })} style={CAMPO_AUTH} />
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

  return (
    <div style={PANEL_AUTH}>
      <h1 style={TITULO_AUTH}>Datos de la cuenta</h1>
      <p style={TEXTO_AUTH}>{cuenta?.nombre ? `${cuenta.nombre} · ` : ''}{cuenta?.correo}</p>
      <form onSubmit={completar} className="flex flex-col gap-2.5">
        {campo('password', 'Contraseña (mín. 8)', 'password', 'new-password')}
        {campo('confirmar', 'Repite la contraseña', 'password', 'new-password')}
        {campo('pais', 'País', 'text', 'country-name')}
        {campo('telefono', 'Teléfono', 'tel', 'tel')}
        {campo('direccion', 'Dirección', 'text', 'street-address')}
        {error && <div role="alert" style={ERROR_AUTH}>{error}</div>}
        {boton('Crear cuenta e ingresar', 'Creando…')}
      </form>
    </div>
  );
}

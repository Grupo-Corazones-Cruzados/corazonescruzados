'use client';

import { useMemo, useState } from 'react';
import { Camera, Check, Plus, Trash2, ArrowLeft, ArrowRight } from 'lucide-react';
import { PANEL_AUTH, TITULO_AUTH, TEXTO_AUTH, CAMPO_AUTH, ERROR_AUTH } from '@/components/landing/authEstilos';
import Segmentado from '@/components/ui/Segmentado';
import Interruptor from '@/components/ui/Interruptor';
import MultiSelectSearch from '@/components/ui/MultiSelectSearch';
import { REGIMEN_TEXTO } from '@/components/facturacion/comun';
import type { Regimen } from '@/lib/integrations/sri/regimen';
import { IDIOMAS, ESTADOS, JORNADAS, MODALIDADES, DIAS_SEMANA, type EstadoLaboral } from '@/lib/perfil/opciones';

/**
 * EL FORMULARIO DEL ALTA, POR PASOS (Fernando, 2026-11-14: «que el formulario sea por pasos… usando nuestro diseño»).
 * Seis pasos con un recorrido de puntos numerados arriba: Cuenta, Perfil, Talentos (opcional), Disponibilidad,
 * Facturación (opcional) y Revisión. Cada paso se comprueba antes de avanzar; el servidor lo vuelve a comprobar todo.
 * Pide lo mismo que Configuración y lo guarda en el mismo sitio: sin esto no se crea la cuenta.
 */

type Edu = { institution: string; degree: string; field: string; start_year: string; end_year: string };
type Exp = { company: string; position: string; description: string; start_year: string; end_year: string };
type Talento = { key: string; education: Edu[]; experience: Exp[] };
const EDU: Edu = { institution: '', degree: '', field: '', start_year: '', end_year: '' };
const EXP: Exp = { company: '', position: '', description: '', start_year: '', end_year: '' };

const PASOS = [
  { titulo: 'Cuenta' }, { titulo: 'Perfil' }, { titulo: 'Talentos', opcional: true },
  { titulo: 'Disponibilidad' }, { titulo: 'Facturación', opcional: true }, { titulo: 'Revisión' },
] as const;

const mf = { fontFamily: 'var(--font-body)' } as const;
const etiqueta = 'block text-[12px] font-medium text-digi-text mb-1';

/** Reduce la foto a un cuadrado de 400 px en JPEG (así cabe en la cuenta sin subirla a ningún servicio). */
function reducirFoto(archivo: File): Promise<string> {
  return new Promise((ok, mal) => {
    const img = new Image();
    img.onload = () => {
      const lado = Math.min(img.width, img.height);
      const c = document.createElement('canvas'); c.width = 400; c.height = 400;
      c.getContext('2d')!.drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, 400, 400);
      URL.revokeObjectURL(img.src);
      ok(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => mal(new Error('No se pudo leer la imagen.'));
    img.src = URL.createObjectURL(archivo);
  });
}

/** El recorrido de arriba: puntos numerados unidos por una línea que se llena hasta el paso actual. */
function Recorrido({ paso, irA }: { paso: number; irA: (i: number) => void }) {
  return (
    <ol className="flex items-start" aria-label="Pasos">
      {PASOS.map((p, i) => {
        const hecho = i < paso; const actual = i === paso;
        return (
          <li key={p.titulo} className="flex-1 flex flex-col items-center relative min-w-0">
            {i > 0 && (
              <span aria-hidden className="absolute top-[13px] right-1/2 w-full h-px bg-digi-border">
                <span className="block h-full bg-accent transition-[width] duration-300 ease-out" style={{ width: i <= paso ? '100%' : '0%' }} />
              </span>
            )}
            <button type="button" onClick={() => hecho && irA(i)} disabled={!hecho} aria-current={actual ? 'step' : undefined}
              className={`relative z-10 w-[27px] h-[27px] rounded-full grid place-items-center text-[12px] font-semibold transition-colors ${
                hecho ? 'bg-accent text-white cursor-pointer' : actual ? 'bg-digi-card text-accent ring-2 ring-accent' : 'bg-digi-card text-digi-muted ring-1 ring-digi-border'}`}>
              {hecho ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </button>
            <span className={`mt-1.5 text-[11.5px] text-center leading-tight px-1 ${actual ? 'text-digi-text font-medium' : 'text-digi-muted'} ${actual ? '' : 'hidden sm:block'}`}>
              {p.titulo}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default function FormularioAlta({ cuenta, alTerminar }: {
  cuenta: { correo: string; nombres: string; apellidos: string; talentos: string[] };
  alTerminar: (destino: string) => void;
}) {
  const [paso, setPaso] = useState(0);
  const [password, setPassword] = useState(''); const [confirmar, setConfirmar] = useState('');
  const [foto, setFoto] = useState('');
  const [nombre, setNombre] = useState(cuenta.nombres); const [apellido, setApellido] = useState(cuenta.apellidos);
  const [telefono, setTelefono] = useState(''); const [ubicacion, setUbicacion] = useState('');
  const [salarioMin, setSalarioMin] = useState(''); const [salarioMax, setSalarioMax] = useState('');
  const [idiomas, setIdiomas] = useState<string[]>([]);
  const [bio, setBio] = useState('');
  const [talentos, setTalentos] = useState<Talento[]>([]);
  const [jobStatus, setJobStatus] = useState<EstadoLaboral>('immediate'); const [jobDesde, setJobDesde] = useState('');
  const [jornada, setJornada] = useState('full'); const [modalidad, setModalidad] = useState('any');
  const [horario, setHorario] = useState(() => Object.fromEntries(DIAS_SEMANA.map((d, i) => [d.k, { active: i < 5, start: '09:00', end: '18:00' }])) as Record<string, { active: boolean; start: string; end: string }>);
  const [fact, setFact] = useState({ ruc: '', razonSocial: '', nombreComercial: '', dirMatriz: '', regimen: 'rimpe_emprendedor' as Regimen, obligadoContabilidad: false, cobraIva: false, tarifaIva: '4' });
  const [error, setError] = useState(''); const [enviando, setEnviando] = useState(false);

  const opcionesIdioma = useMemo(() => IDIOMAS.map((l) => ({ value: l, label: l })), []);
  const opcionesTalento = useMemo(() => cuenta.talentos.map((t) => ({ value: t, label: t })), [cuenta.talentos]);

  const elegirTalentos = (keys: string[]) => setTalentos((prev) => keys.slice(0, 10).map((k) => prev.find((t) => t.key === k) ?? { key: k, education: [{ ...EDU }], experience: [{ ...EXP }] }));
  const tocar = <K extends 'education' | 'experience'>(ti: number, campo: K, fn: (l: Talento[K]) => Talento[K]) =>
    setTalentos((prev) => prev.map((t, i) => (i === ti ? { ...t, [campo]: fn(t[campo]) } : t)));

  const elegirFoto = async (f?: File | null) => {
    if (!f) return;
    try { setFoto(await reducirFoto(f)); setError(''); } catch { setError('No se pudo leer la imagen. Prueba con otra.'); }
  };

  /** Lo que le falta a cada paso, en palabras; vacío = puede avanzar. Las mismas reglas que el servidor. */
  const faltaEn = (i: number): string => {
    const anio = (v: string) => /^(19[5-9]\d|20\d\d|2100)$/.test(v);
    if (i === 0) {
      if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
      if (password !== confirmar) return 'Las contraseñas no coinciden.';
      if (!foto) return 'Sube tu foto de perfil.';
      if (!nombre.trim() || !apellido.trim()) return 'Escribe tus nombres y tus apellidos.';
      if (!/^\+?[0-9 ()-]{7,30}$/.test(telefono.trim())) return 'Escribe un teléfono válido, con el código del país.';
      if (!ubicacion.trim()) return 'Escribe tu ubicación (ciudad y país).';
    }
    if (i === 1) {
      if (!(Number(salarioMin) > 0) || !(Number(salarioMax) >= Number(salarioMin))) return 'Escribe tu aspiración salarial: «hasta» no puede ser menor que «desde».';
      if (!idiomas.length) return 'Elige al menos un idioma.';
      if (bio.trim().length < 30) return 'Escribe tu biografía (al menos 30 caracteres).';
    }
    if (i === 2) {
      for (const t of talentos) {
        if (t.education.some((e) => !e.institution.trim() || !e.degree.trim() || !anio(e.start_year))) return `En «${t.key}», completa la educación: institución, título y año de inicio.`;
        if (t.experience.some((e) => !e.company.trim() || !e.position.trim() || !anio(e.start_year))) return `En «${t.key}», completa la experiencia: empresa, cargo y año de inicio.`;
      }
    }
    if (i === 3) {
      if (jobStatus === 'from_date' && !jobDesde) return 'Elige la fecha desde la que puedes empezar.';
      const activos = Object.values(horario).filter((h) => h.active);
      if (!activos.length) return 'Marca al menos un día en tu horario.';
      if (activos.some((h) => h.end <= h.start)) return 'En el horario, la hora de fin debe ser posterior a la de inicio.';
    }
    if (i === 4 && fact.ruc) {
      if (!/^\d{10}001$/.test(fact.ruc)) return 'El RUC son 13 dígitos y termina en 001.';
      if (fact.razonSocial.trim().length < 3) return 'Escribe la razón social tal como está en tu RUC.';
      if (fact.dirMatriz.trim().length < 5) return 'Escribe la dirección de la matriz.';
    }
    return '';
  };

  const avanzar = () => {
    const falta = faltaEn(paso);
    if (falta) { setError(falta); return; }
    setError(''); setPaso((p) => Math.min(p + 1, PASOS.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const volver = () => { setError(''); setPaso((p) => Math.max(0, p - 1)); };

  const enviar = async () => {
    for (let i = 0; i < PASOS.length - 1; i++) { const f = faltaEn(i); if (f) { setPaso(i); setError(f); return; } }
    setError(''); setEnviando(true);
    try {
      const r = await fetch('/api/candidate/alta/completar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, foto, nombre, apellido, telefono, ubicacion, salarioMin, salarioMax, idiomas, bio,
          talentos, jobStatus, jobDesde, jornada, modalidad, horario, facturacion: fact.ruc ? fact : null }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(j.error || 'No se pudo crear la cuenta.'); return; }
      alTerminar(j.destino || '/dashboard');
    } catch { setError('Revisa tu conexión e inténtalo de nuevo.'); }
    finally { setEnviando(false); }
  };

  const campo = (valor: string, cambiar: (v: string) => void, marcador: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input value={valor} onChange={(e) => cambiar(e.target.value)} placeholder={marcador} aria-label={marcador} style={{ ...CAMPO_AUTH, minWidth: 0 }} {...extra} />
  );
  const fila = (t: string, v: React.ReactNode) => (
    <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-3 py-2 border-b border-digi-border/60 text-[13px]">
      <dt className="text-digi-muted">{t}</dt><dd className="text-digi-text break-words">{v || '—'}</dd>
    </div>
  );
  const textoDe = <T extends { v: string; label: string }>(l: readonly T[], v: string) => l.find((x) => x.v === v)?.label ?? v;

  const ultimo = paso === PASOS.length - 1;

  return (
    <div className="alta-ancha w-full" style={PANEL_AUTH}>
      <h1 style={TITULO_AUTH}>Creación de cuenta</h1>
      <p style={TEXTO_AUTH}>{cuenta.correo}</p>

      <Recorrido paso={paso} irA={(i) => { setError(''); setPaso(i); }} />

      <div key={paso} className="mt-6 flex flex-col gap-3 animate-[pixelFadeIn_0.25s_ease-out] motion-reduce:animate-none" style={mf}>
        <h2 className="text-[15px] font-semibold text-digi-text">
          {PASOS[paso].titulo}{'opcional' in PASOS[paso] && <span className="ml-2 text-[12px] font-normal text-digi-muted">opcional</span>}
        </h2>

        {paso === 0 && <>
          <div className="flex items-center gap-4">
            <label className="w-20 h-20 shrink-0 rounded-lg border border-digi-border bg-digi-darker grid place-items-center overflow-hidden cursor-pointer" title="Foto de perfil">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {foto ? <img src={foto} alt="Tu foto" className="w-full h-full object-cover" /> : <Camera className="w-6 h-6 text-digi-muted" />}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => elegirFoto(e.target.files?.[0])} />
            </label>
            <div className="min-w-0">
              <p className="text-[13px] text-digi-text">Foto de perfil</p>
              <p className="text-[12px] text-digi-muted">{foto ? 'Toca la foto para cambiarla.' : 'Toca el recuadro para subirla.'}</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-2.5">
            {campo(password, setPassword, 'Contraseña (mín. 8)', { type: 'password', autoComplete: 'new-password' })}
            {campo(confirmar, setConfirmar, 'Repite la contraseña', { type: 'password', autoComplete: 'new-password' })}
            {campo(nombre, setNombre, 'Nombres', { autoComplete: 'given-name' })}
            {campo(apellido, setApellido, 'Apellidos', { autoComplete: 'family-name' })}
            {campo(telefono, setTelefono, 'Teléfono (+593…)', { type: 'tel', autoComplete: 'tel' })}
            {campo(ubicacion, setUbicacion, 'Ubicación (ciudad, país)')}
          </div>
        </>}

        {paso === 1 && <>
          <div>
            <label className={etiqueta}>Aspiración salarial (USD/mes)</label>
            <div className="grid grid-cols-2 gap-2.5">
              {campo(salarioMin, setSalarioMin, 'Desde', { type: 'number', min: 1, inputMode: 'numeric' })}
              {campo(salarioMax, setSalarioMax, 'Hasta', { type: 'number', min: 1, inputMode: 'numeric' })}
            </div>
          </div>
          <div>
            <label className={etiqueta}>Idiomas</label>
            <MultiSelectSearch options={opcionesIdioma} selected={idiomas} onChange={setIdiomas} placeholder="Elegir idiomas…" />
          </div>
          <div>
            <label className={etiqueta}>Biografía</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={5} placeholder="Describe tu experiencia…" style={{ ...CAMPO_AUTH, resize: 'vertical' }} />
          </div>
        </>}

        {paso === 2 && <>
          <MultiSelectSearch options={opcionesTalento} selected={talentos.map((t) => t.key)} onChange={elegirTalentos} placeholder="Buscar y elegir talento…" />
          {!talentos.length && <p className="text-[12.5px] text-digi-muted">Si todavía no tienes un talento, puedes continuar y agregarlo después en Configuración ▸ Mi CV.</p>}
          {talentos.map((t, ti) => (
            <div key={t.key} className="flex flex-col gap-3 border-l-2 border-accent/60 pl-3">
              <p className="text-[13.5px] font-semibold text-digi-text">{t.key}</p>
              <div className="flex flex-col gap-2">
                <p className="text-[12px] font-medium text-digi-text">Educación</p>
                {t.education.map((e, i) => (
                  <div key={i} className="grid sm:grid-cols-[1fr_1fr_1fr_88px_88px_32px] gap-2 items-center">
                    {campo(e.institution, (v) => tocar(ti, 'education', (l) => l.map((x, k) => (k === i ? { ...x, institution: v } : x))), 'Institución')}
                    {campo(e.degree, (v) => tocar(ti, 'education', (l) => l.map((x, k) => (k === i ? { ...x, degree: v } : x))), 'Título')}
                    {campo(e.field, (v) => tocar(ti, 'education', (l) => l.map((x, k) => (k === i ? { ...x, field: v } : x))), 'Área')}
                    {campo(e.start_year, (v) => tocar(ti, 'education', (l) => l.map((x, k) => (k === i ? { ...x, start_year: v } : x))), 'Inicio', { type: 'number', min: 1950, max: 2100 })}
                    {campo(e.end_year, (v) => tocar(ti, 'education', (l) => l.map((x, k) => (k === i ? { ...x, end_year: v } : x))), 'Fin', { type: 'number', min: 1950, max: 2100 })}
                    <button type="button" aria-label="Quitar" disabled={t.education.length < 2} onClick={() => tocar(ti, 'education', (l) => l.filter((_, k) => k !== i))}
                      className="w-8 h-8 grid place-items-center text-digi-muted hover:text-red-400 disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                <button type="button" onClick={() => tocar(ti, 'education', (l) => [...l, { ...EDU }])} className="self-start inline-flex items-center gap-1 text-[12.5px] text-accent"><Plus className="w-3.5 h-3.5" /> Agregar educación</button>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-[12px] font-medium text-digi-text">Experiencia</p>
                {t.experience.map((e, i) => (
                  <div key={i} className="grid gap-2">
                    <div className="grid sm:grid-cols-[1fr_1fr_88px_88px_32px] gap-2 items-center">
                      {campo(e.company, (v) => tocar(ti, 'experience', (l) => l.map((x, k) => (k === i ? { ...x, company: v } : x))), 'Empresa')}
                      {campo(e.position, (v) => tocar(ti, 'experience', (l) => l.map((x, k) => (k === i ? { ...x, position: v } : x))), 'Cargo')}
                      {campo(e.start_year, (v) => tocar(ti, 'experience', (l) => l.map((x, k) => (k === i ? { ...x, start_year: v } : x))), 'Inicio', { type: 'number', min: 1950, max: 2100 })}
                      {campo(e.end_year, (v) => tocar(ti, 'experience', (l) => l.map((x, k) => (k === i ? { ...x, end_year: v } : x))), 'Fin', { type: 'number', min: 1950, max: 2100 })}
                      <button type="button" aria-label="Quitar" disabled={t.experience.length < 2} onClick={() => tocar(ti, 'experience', (l) => l.filter((_, k) => k !== i))}
                        className="w-8 h-8 grid place-items-center text-digi-muted hover:text-red-400 disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    {campo(e.description, (v) => tocar(ti, 'experience', (l) => l.map((x, k) => (k === i ? { ...x, description: v } : x))), 'Qué hiciste (opcional)')}
                  </div>
                ))}
                <button type="button" onClick={() => tocar(ti, 'experience', (l) => [...l, { ...EXP }])} className="self-start inline-flex items-center gap-1 text-[12.5px] text-accent"><Plus className="w-3.5 h-3.5" /> Agregar experiencia</button>
              </div>
            </div>
          ))}
        </>}

        {paso === 3 && <>
          <div>
            <label className={etiqueta}>Cuándo puedes empezar</label>
            <Segmentado etiqueta="Cuándo puedes empezar" className="w-full" valor={jobStatus} onChange={setJobStatus}
              opciones={ESTADOS.map((e) => ({ valor: e.v, texto: e.label }))} />
          </div>
          {jobStatus === 'from_date' && campo(jobDesde, setJobDesde, 'Fecha', { type: 'date' })}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={etiqueta}>Jornada</label>
              <Segmentado etiqueta="Jornada" className="w-full" valor={jornada} onChange={setJornada} opciones={JORNADAS.map((j) => ({ valor: j.v, texto: j.label }))} />
            </div>
            <div>
              <label className={etiqueta}>Modalidad</label>
              <Segmentado etiqueta="Modalidad" className="w-full" valor={modalidad} onChange={setModalidad} opciones={MODALIDADES.map((m) => ({ valor: m.v, texto: m.label }))} />
            </div>
          </div>
          <div>
            <label className={etiqueta}>Horario</label>
            <div className="flex flex-col gap-1.5">
              {DIAS_SEMANA.map((d) => {
                const h = horario[d.k];
                const poner = (cambio: Partial<typeof h>) => setHorario((prev) => ({ ...prev, [d.k]: { ...prev[d.k], ...cambio } }));
                return (
                  <div key={d.k} className="grid grid-cols-[96px_minmax(0,1fr)_minmax(0,1fr)] sm:grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)] gap-2 items-center">
                    <label className="flex items-center gap-2 text-[13px] text-digi-text cursor-pointer">
                      <input type="checkbox" checked={h.active} onChange={(e) => poner({ active: e.target.checked })} className="w-4 h-4 accent-[var(--color-accent)]" />
                      {d.label}
                    </label>
                    <input type="time" value={h.start} disabled={!h.active} onChange={(e) => poner({ start: e.target.value })} aria-label={`${d.label} desde`} style={{ ...CAMPO_AUTH, minWidth: 0, opacity: h.active ? 1 : 0.4 }} />
                    <input type="time" value={h.end} disabled={!h.active} onChange={(e) => poner({ end: e.target.value })} aria-label={`${d.label} hasta`} style={{ ...CAMPO_AUTH, minWidth: 0, opacity: h.active ? 1 : 0.4 }} />
                  </div>
                );
              })}
            </div>
          </div>
        </>}

        {paso === 4 && <>
          <p className="text-[12.5px] text-digi-muted">Con tu RUC puedes emitir tus propias facturas desde la plataforma. Si no lo tienes, continúa; puedes agregarlo después en Configuración ▸ Facturación, junto con tu firma electrónica.</p>
          <div className="grid sm:grid-cols-2 gap-2.5">
            {campo(fact.ruc, (v) => setFact({ ...fact, ruc: v.replace(/\D/g, '').slice(0, 13) }), 'RUC (13 dígitos)', { inputMode: 'numeric' })}
            {campo(fact.razonSocial, (v) => setFact({ ...fact, razonSocial: v }), 'Razón social')}
            {campo(fact.nombreComercial, (v) => setFact({ ...fact, nombreComercial: v }), 'Nombre comercial (opcional)')}
            {campo(fact.dirMatriz, (v) => setFact({ ...fact, dirMatriz: v }), 'Dirección matriz')}
          </div>
          {fact.ruc && <>
            <div>
              <label className={etiqueta}>Régimen</label>
              <Segmentado etiqueta="Régimen" className="w-full" valor={fact.regimen}
                onChange={(regimen) => setFact({ ...fact, regimen, cobraIva: regimen === 'rimpe_negocio_popular' ? false : fact.cobraIva })}
                opciones={(['rimpe_negocio_popular', 'rimpe_emprendedor', 'general'] as Regimen[]).map((r) => ({ valor: r, texto: REGIMEN_TEXTO[r] }))} />
            </div>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              <label className="flex items-center gap-3 text-[13px] text-digi-text">
                <Interruptor activo={fact.obligadoContabilidad} etiqueta="Obligado a llevar contabilidad" onChange={(v) => setFact({ ...fact, obligadoContabilidad: v })} />
                Obligado a llevar contabilidad
              </label>
              <label className="flex items-center gap-3 text-[13px] text-digi-text">
                <Interruptor activo={fact.cobraIva} etiqueta="Cobra IVA" disabled={fact.regimen === 'rimpe_negocio_popular'} onChange={(v) => setFact({ ...fact, cobraIva: v })} />
                Cobra IVA
              </label>
              {fact.cobraIva && (
                <Segmentado etiqueta="Tarifa de IVA" className="max-w-[220px]" valor={fact.tarifaIva} onChange={(tarifaIva) => setFact({ ...fact, tarifaIva })}
                  opciones={[{ valor: '4', texto: '15 %' }, { valor: '5', texto: '5 %' }]} />
              )}
            </div>
          </>}
        </>}

        {paso === 5 && (
          <dl>
            {fila('Foto', foto ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={foto} alt="" className="w-10 h-10 rounded-md object-cover" /> : '')}
            {fila('Nombre', `${nombre} ${apellido}`)}
            {fila('Teléfono', telefono)}
            {fila('Ubicación', ubicacion)}
            {fila('Aspiración', salarioMin && salarioMax ? `${salarioMin} – ${salarioMax} USD/mes` : '')}
            {fila('Idiomas', idiomas.join(', '))}
            {fila('Biografía', bio)}
            {fila('Talentos', talentos.length ? talentos.map((t) => t.key).join(', ') : 'Ninguno por ahora')}
            {fila('Disponibilidad', `${textoDe(ESTADOS, jobStatus)}${jobStatus === 'from_date' && jobDesde ? ` (${jobDesde})` : ''} · ${textoDe(JORNADAS, jornada)} · ${textoDe(MODALIDADES, modalidad)}`)}
            {fila('Horario', DIAS_SEMANA.filter((d) => horario[d.k].active).map((d) => `${d.label.slice(0, 3)} ${horario[d.k].start}–${horario[d.k].end}`).join(' · '))}
            {fila('Facturación', fact.ruc ? `${fact.ruc} · ${fact.razonSocial}` : 'Sin RUC por ahora')}
          </dl>
        )}

        {error && <div role="alert" style={ERROR_AUTH}>{error}</div>}

        {/* Atrás a la izquierda y la acción principal a la derecha, como en todos los pies. */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-digi-border">
          <button type="button" onClick={volver} disabled={paso === 0 || enviando}
            className="h-10 px-4 inline-flex items-center gap-2 rounded border border-digi-border text-[13px] text-digi-text disabled:opacity-0">
            <ArrowLeft className="w-4 h-4" /> Atrás
          </button>
          {ultimo ? (
            <button type="button" onClick={enviar} disabled={enviando}
              className="h-10 px-5 inline-flex items-center gap-2 rounded bg-accent hover:bg-accent-hover text-white text-[13.5px] font-medium disabled:opacity-60">
              {enviando ? 'Creando…' : 'Crear cuenta e ingresar'}
            </button>
          ) : (
            <button type="button" onClick={avanzar}
              className="h-10 px-5 inline-flex items-center gap-2 rounded bg-accent hover:bg-accent-hover text-white text-[13.5px] font-medium">
              Siguiente: {PASOS[paso + 1].titulo} <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { Camera, Plus, Trash2 } from 'lucide-react';
import { PANEL_AUTH, TITULO_AUTH, TEXTO_AUTH, CAMPO_AUTH, ERROR_AUTH } from '@/components/landing/authEstilos';
import Segmentado from '@/components/ui/Segmentado';
import MultiSelectSearch from '@/components/ui/MultiSelectSearch';
import { IDIOMAS, ESTADOS, JORNADAS, MODALIDADES, DIAS_SEMANA, type EstadoLaboral } from '@/lib/perfil/opciones';

/**
 * EL FORMULARIO COMPLETO DEL ALTA (Fernando, 2026-11-14). Pide, obligatorio, todo lo que el candidato tendría que llenar
 * después en Configuración: foto, nombre, teléfono, ubicación, aspiración salarial, idiomas, biografía, talentos con su
 * educación y experiencia, disponibilidad y horario. La facturación es opcional y se llena después en Configuración.
 * Sin todo esto no se crea la cuenta (lo vuelve a comprobar el servidor). Mismas listas que Configuración.
 */

type Edu = { institution: string; degree: string; field: string; start_year: string; end_year: string };
type Exp = { company: string; position: string; description: string; start_year: string; end_year: string };
type Talento = { key: string; education: Edu[]; experience: Exp[] };
const EDU: Edu = { institution: '', degree: '', field: '', start_year: '', end_year: '' };
const EXP: Exp = { company: '', position: '', description: '', start_year: '', end_year: '' };

const mf = { fontFamily: 'var(--font-body)' } as const;
const etiqueta = 'block text-[12px] font-medium text-digi-text mb-1';
const seccion = 'text-[11px] font-semibold uppercase tracking-wide text-digi-muted';

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

export default function FormularioAlta({ cuenta, alTerminar }: {
  cuenta: { correo: string; nombres: string; apellidos: string; talentos: string[] };
  alTerminar: (destino: string) => void;
}) {
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
  const [error, setError] = useState(''); const [enviando, setEnviando] = useState(false);

  const opcionesIdioma = useMemo(() => IDIOMAS.map((l) => ({ value: l, label: l })), []);
  const opcionesTalento = useMemo(() => cuenta.talentos.map((t) => ({ value: t, label: t })), [cuenta.talentos]);

  const elegirTalentos = (keys: string[]) => setTalentos((prev) => keys.slice(0, 10).map((k) => prev.find((t) => t.key === k) ?? { key: k, education: [{ ...EDU }], experience: [{ ...EXP }] }));
  const tocar = <K extends 'education' | 'experience'>(ti: number, campo: K, fn: (l: Talento[K]) => Talento[K]) =>
    setTalentos((prev) => prev.map((t, i) => (i === ti ? { ...t, [campo]: fn(t[campo]) } : t)));

  const elegirFoto = async (f?: File | null) => {
    if (!f) return;
    try { setFoto(await reducirFoto(f)); } catch { setError('No se pudo leer la imagen. Prueba con otra.'); }
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    if (password !== confirmar) return setError('Las contraseñas no coinciden.');
    if (!foto) return setError('Sube tu foto de perfil.');
    setEnviando(true);
    try {
      const r = await fetch('/api/candidate/alta/completar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, foto, nombre, apellido, telefono, ubicacion, salarioMin, salarioMax, idiomas, bio,
          talentos, jobStatus, jobDesde, jornada, modalidad, horario }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(j.error || 'No se pudo crear la cuenta.'); return; }
      alTerminar(j.destino || '/dashboard');
    } catch { setError('Revisa tu conexión e inténtalo de nuevo.'); }
    finally { setEnviando(false); }
  };

  const campo = (valor: string, cambiar: (v: string) => void, marcador: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input value={valor} onChange={(e) => cambiar(e.target.value)} placeholder={marcador} aria-label={marcador} style={CAMPO_AUTH} {...extra} />
  );

  return (
    <div className="alta-ancha w-full" style={PANEL_AUTH}>
      <h1 style={TITULO_AUTH}>Datos de la cuenta</h1>
      <p style={TEXTO_AUTH}>{cuenta.correo}</p>
      <form onSubmit={enviar} className="flex flex-col gap-6" style={mf}>

        <section className="flex flex-col gap-2.5">
          <p className={seccion}>Cuenta</p>
          <div className="grid sm:grid-cols-2 gap-2.5">
            {campo(password, setPassword, 'Contraseña (mín. 8)', { type: 'password', autoComplete: 'new-password', required: true })}
            {campo(confirmar, setConfirmar, 'Repite la contraseña', { type: 'password', autoComplete: 'new-password', required: true })}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <p className={seccion}>Perfil</p>
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
            {campo(nombre, setNombre, 'Nombres', { required: true, autoComplete: 'given-name' })}
            {campo(apellido, setApellido, 'Apellidos', { required: true, autoComplete: 'family-name' })}
            {campo(telefono, setTelefono, 'Teléfono (+593…)', { required: true, type: 'tel', autoComplete: 'tel' })}
            {campo(ubicacion, setUbicacion, 'Ubicación (ciudad, país)', { required: true })}
          </div>
          <div>
            <label className={etiqueta}>Aspiración salarial (USD/mes)</label>
            <div className="grid grid-cols-2 gap-2.5">
              {campo(salarioMin, setSalarioMin, 'Desde', { required: true, type: 'number', min: 1, inputMode: 'numeric' })}
              {campo(salarioMax, setSalarioMax, 'Hasta', { required: true, type: 'number', min: 1, inputMode: 'numeric' })}
            </div>
          </div>
          <div>
            <label className={etiqueta}>Idiomas</label>
            <MultiSelectSearch options={opcionesIdioma} selected={idiomas} onChange={setIdiomas} placeholder="Elegir idiomas…" />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <p className={seccion}>Currículum</p>
          <div>
            <label className={etiqueta}>Biografía</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} required minLength={30} rows={4} placeholder="Describe tu experiencia…"
              style={{ ...CAMPO_AUTH, resize: 'vertical' }} />
          </div>
          <div>
            <label className={etiqueta}>Talentos</label>
            <MultiSelectSearch options={opcionesTalento} selected={talentos.map((t) => t.key)} onChange={elegirTalentos} placeholder="Buscar y elegir talento…" />
          </div>
          {talentos.map((t, ti) => (
            <div key={t.key} className="flex flex-col gap-3 border-l-2 border-accent/60 pl-3">
              <p className="text-[13.5px] font-semibold text-digi-text">{t.key}</p>
              <div className="flex flex-col gap-2">
                <p className="text-[12px] font-medium text-digi-text">Educación</p>
                {t.education.map((e, i) => (
                  <div key={i} className="grid sm:grid-cols-[1fr_1fr_1fr_90px_90px_32px] gap-2 items-center">
                    {campo(e.institution, (v) => tocar(ti, 'education', (l) => l.map((x, k) => (k === i ? { ...x, institution: v } : x))), 'Institución', { required: true })}
                    {campo(e.degree, (v) => tocar(ti, 'education', (l) => l.map((x, k) => (k === i ? { ...x, degree: v } : x))), 'Título', { required: true })}
                    {campo(e.field, (v) => tocar(ti, 'education', (l) => l.map((x, k) => (k === i ? { ...x, field: v } : x))), 'Área')}
                    {campo(e.start_year, (v) => tocar(ti, 'education', (l) => l.map((x, k) => (k === i ? { ...x, start_year: v } : x))), 'Inicio', { required: true, type: 'number', min: 1950, max: 2100 })}
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
                    <div className="grid sm:grid-cols-[1fr_1fr_90px_90px_32px] gap-2 items-center">
                      {campo(e.company, (v) => tocar(ti, 'experience', (l) => l.map((x, k) => (k === i ? { ...x, company: v } : x))), 'Empresa', { required: true })}
                      {campo(e.position, (v) => tocar(ti, 'experience', (l) => l.map((x, k) => (k === i ? { ...x, position: v } : x))), 'Cargo', { required: true })}
                      {campo(e.start_year, (v) => tocar(ti, 'experience', (l) => l.map((x, k) => (k === i ? { ...x, start_year: v } : x))), 'Inicio', { required: true, type: 'number', min: 1950, max: 2100 })}
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
        </section>

        <section className="flex flex-col gap-3">
          <p className={seccion}>Disponibilidad</p>
          <div>
            <label className={etiqueta}>Cuándo puedes empezar</label>
            <Segmentado etiqueta="Cuándo puedes empezar" className="w-full" valor={jobStatus} onChange={setJobStatus}
              opciones={ESTADOS.map((e) => ({ valor: e.v, texto: e.label }))} />
          </div>
          {jobStatus === 'from_date' && campo(jobDesde, setJobDesde, 'Fecha', { type: 'date', required: true })}
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
        </section>

        {error && <div role="alert" style={ERROR_AUTH}>{error}</div>}
        <button type="submit" disabled={enviando} className="pixel-btn pixel-btn-primary w-full" style={{ opacity: enviando ? 0.6 : 1 }}>
          {enviando ? 'Creando…' : 'Crear cuenta e ingresar'}
        </button>
      </form>
    </div>
  );
}

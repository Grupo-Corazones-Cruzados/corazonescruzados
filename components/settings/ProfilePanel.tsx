'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import PixelInput from '@/components/ui/PixelInput';
import PixelBadge from '@/components/ui/PixelBadge';
import SettingsPanel from '@/components/settings/SettingsPanel';
import { BTN_PRIMARY } from '@/components/ui/Button';
import MultiSelectSearch from '@/components/ui/MultiSelectSearch';

/** Idiomas del selector. Vive aquí porque aquí es donde se eligen. */
const IDIOMAS = ['Español', 'Inglés', 'Portugués', 'Francés', 'Italiano', 'Alemán', 'Chino (Mandarín)', 'Japonés', 'Coreano', 'Ruso', 'Árabe', 'Kichwa', 'Catalán', 'Neerlandés', 'Hindi']
  .map((l) => ({ value: l, label: l }));
import { normalizarRed, REDES, type Red } from '@/lib/members/redes';
import { User, Camera, RefreshCw, ExternalLink, Save } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

/** Panel de Perfil: avatar, datos personales, redes y cuenta. Autónomo (usa el usuario actual). */
export default function ProfilePanel() {
  const { user, refreshUser } = useAuth();
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar_url || '');
  const [youtube, setYoutube] = useState(user?.youtube_handle || '');
  const [tiktok, setTiktok] = useState(user?.tiktok_handle || '');
  const [instagram, setInstagram] = useState(user?.instagram_handle || '');
  const [facebook, setFacebook] = useState(user?.facebook_handle || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Ajustes del CV público. Solo se cargan/guardan si el usuario es miembro: quien no
  // lo es no tiene fila en `member_cv_profiles` y el endpoint le responde 403.
  const esMiembro = !!user?.member_id;
  // Ubicación se queda en Perfil (el titular se fue a «Mi CV»); LinkedIn y el sitio
  // web se editan aquí, con el resto de redes, aunque vivan en la tabla del CV.
  const [ubicacion, setUbicacion] = useState('');
  // Aspiración salarial e idiomas se mudaron aquí desde «Mi CV» (Fernando,
  // 2026-08-15): son datos de la persona, no de un talento concreto.
  const [salarioMin, setSalarioMin] = useState('');
  const [salarioMax, setSalarioMax] = useState('');
  const [idiomas, setIdiomas] = useState<string[]>([]);
  const [linkedin, setLinkedin] = useState('');
  const [web, setWeb] = useState('');

  useEffect(() => {
    if (!esMiembro) return;
    fetch('/api/members/cv/publico')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setUbicacion(d.location || '');
        setSalarioMin(d.salary_min != null ? String(d.salary_min) : '');
        setSalarioMax(d.salary_max != null ? String(d.salary_max) : '');
        setIdiomas(Array.isArray(d.languages) ? d.languages : []);
        setLinkedin(d.linkedin_url || '');
        setWeb(d.website_url || '');
      })
      .catch(() => {});
  }, [esMiembro]);

  // Trae nombre/teléfono/foto desde el perfil de Google del usuario.
  const handleGoogleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/users/google-sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al sincronizar');
      if (data.first_name != null) setFirstName(data.first_name);
      if (data.last_name != null) setLastName(data.last_name);
      if (data.phone != null) setPhone(data.phone);
      if (data.avatar_url) setAvatarPreview(data.avatar_url);
      await refreshUser();
      toast.success('Sincronizado con Google');
    } catch (err: any) {
      toast.error(err.message || 'Error al sincronizar');
    } finally {
      setSyncing(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('La imagen no puede superar 2MB'); return; }

    const localPreview = URL.createObjectURL(file);
    setAvatarPreview(localPreview);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('avatar', file);
      const res = await fetch('/api/users/avatar', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al subir');
      setAvatarPreview(data.avatar_url);
      await refreshUser();
      toast.success('Foto actualizada');
    } catch (err: any) {
      toast.error(err.message || 'Error al subir imagen');
      setAvatarPreview(user?.avatar_url || '');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Se comprueba ANTES de la petición: así el aviso señala el campo concreto en
      // vez de devolver un 400 genérico con el resto del formulario ya enviado.
      for (const [red, valor] of [['linkedin', linkedin], ['web', web], ['youtube', youtube], ['tiktok', tiktok], ['instagram', instagram], ['facebook', facebook]] as [Red, string][]) {
        const { error } = normalizarRed(red, valor);
        if (error) throw new Error(`${REDES[red].etiqueta}: ${error}`);
      }

      const res = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName, last_name: lastName, phone,
          youtube_handle: youtube, tiktok_handle: tiktok,
          instagram_handle: instagram, facebook_handle: facebook,
        }),
      });
      if (!res.ok) throw new Error('Error al actualizar');

      // Los datos del CV público viven en otra tabla y tienen su propia puerta
      // (`/api/members/cv/publico`), pero el botón es UNO: dos «Guardar» en un panel
      // de 400 px es una trampa para dejarse la mitad sin guardar.
      if (esMiembro) {
        const resCv = await fetch('/api/members/cv/publico', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: ubicacion, linkedin_url: linkedin, website_url: web,
            salary_min: salarioMin, salary_max: salarioMax, languages: idiomas,
          }),
        });
        if (!resCv.ok) {
          const d = await resCv.json().catch(() => ({}));
          throw new Error(d.error || 'Error al guardar el CV público');
        }
      }

      // Refleja la URL ya compuesta: quien escribió «@fulano» ve en el acto el
      // enlace completo que se ha guardado, sin tener que recargar para creérselo.
      setYoutube(normalizarRed('youtube', youtube).url || '');
      setTiktok(normalizarRed('tiktok', tiktok).url || '');
      setInstagram(normalizarRed('instagram', instagram).url || '');
      setFacebook(normalizarRed('facebook', facebook).url || '');
      setLinkedin(normalizarRed('linkedin', linkedin).url || '');
      setWeb(normalizarRed('web', web).url || '');

      await refreshUser();
      toast.success('Perfil actualizado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsPanel
      Icon={User} title="Perfil" subtitle="Tus datos personales y redes"
      bodyClassName="p-0" className="w-full xl:w-[400px] shrink-0 h-full"
      /* ⚠️ El botón vive en el PIE, fuera del `<form>`, así que se ata a él con
         `form="perfil-form"` — atributo HTML estándar. Es lo que permite tener la
         acción fija al fondo sin renunciar a enviar con Intro desde un campo. */
      pie={(
        <button type="submit" form="perfil-form" disabled={saving} className={`${BTN_PRIMARY} w-full sm:w-auto`}>
          <Save className="w-4 h-4" /> {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      )}
    >
      <form id="perfil-form" onSubmit={handleSave} className="p-4 space-y-4">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            {avatarPreview ? (
              <img src={avatarPreview} alt="" className="w-20 h-20 rounded-lg border border-digi-border object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-lg flex items-center justify-center bg-accent-light border border-accent/20 text-accent text-2xl font-semibold" style={mf}>
                {(user?.first_name?.[0] || user?.email?.[0] || '?').toUpperCase()}
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 rounded-lg bg-black/50 flex items-center justify-center">
                <span className="text-[10px] text-white animate-pulse" style={mf}>...</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-digi-text font-medium truncate" style={mf}>{user?.email}</p>
            <p className="text-[11px] text-digi-muted mb-2.5" style={mf}>ID: {user?.id?.slice(0, 8)}…</p>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={handleAvatarUpload} className="hidden" />
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="inline-flex items-center gap-1.5 text-[12px] text-digi-text border border-digi-border rounded px-3 py-1.5 hover:border-accent hover:text-accent transition-colors disabled:opacity-50" style={mf}>
                <Camera className="w-3.5 h-3.5" /> {uploading ? 'Subiendo...' : 'Cambiar foto'}
              </button>
              <button type="button" onClick={handleGoogleSync} disabled={syncing}
                className="inline-flex items-center gap-1.5 text-[12px] text-digi-text border border-digi-border rounded px-3 py-1.5 hover:border-accent hover:text-accent transition-colors disabled:opacity-50" style={mf}
                title="Traer nombre, teléfono y foto desde tu perfil de Google">
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} /> {syncing ? 'Sincronizando...' : 'Sincronizar con Google'}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <PixelInput label="Nombre" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Juan" />
          <PixelInput label="Apellido" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Pérez" />
        </div>
        <PixelInput label="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+593999999999" />
        {esMiembro && (
          <PixelInput label="Ubicación" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} placeholder="Guayaquil, Ecuador" />
        )}

        {esMiembro && (
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-digi-text" style={mf}>Aspiración salarial (USD/mes)</label>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min={0} step={50} inputMode="numeric" value={salarioMin}
                onChange={(e) => setSalarioMin(e.target.value)} placeholder="Desde"
                className="field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border rounded-md text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none" style={mf} />
              <input type="number" min={0} step={50} inputMode="numeric" value={salarioMax}
                onChange={(e) => setSalarioMax(e.target.value)} placeholder="Hasta"
                className="field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border rounded-md text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none" style={mf} />
            </div>
          </div>
        )}

        {esMiembro && (
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-digi-text" style={mf}>Idiomas</label>
            <MultiSelectSearch options={IDIOMAS} selected={idiomas} onChange={setIdiomas} placeholder="Elegir idiomas…" />
          </div>
        )}

        <div className="pt-3 border-t border-digi-border space-y-3">
          {/* Regla de formularios: solo el título del campo y el campo. La
              explicación va dentro del botón de ayuda, no como párrafo fijo. */}
          <h4 className="text-[13px] font-semibold text-digi-text" style={mf}>Redes sociales</h4>
          {/* LinkedIn y el sitio web viven aquí desde 2026-08-14: son enlaces, y
              tenerlos en «Mi CV» los separaba de los otros cuatro sin motivo. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {esMiembro && <CampoRed red="linkedin" valor={linkedin} onChange={setLinkedin} />}
            {esMiembro && <CampoRed red="web" valor={web} onChange={setWeb} />}
            <CampoRed red="youtube" valor={youtube} onChange={setYoutube} />
            <CampoRed red="tiktok" valor={tiktok} onChange={setTiktok} />
            <CampoRed red="instagram" valor={instagram} onChange={setInstagram} />
            <CampoRed red="facebook" valor={facebook} onChange={setFacebook} />
          </div>
        </div>

        {/* Cuenta */}
        <div className="pt-3 border-t border-digi-border space-y-3">
          <h4 className="text-[13px] font-semibold text-digi-text" style={mf}>Cuenta</h4>
          <dl className="space-y-2.5">
            {[
              ['Correo', <span key="e" className="text-digi-text" style={mf}>{user?.email}</span>],
              ['ID', <span key="i" className="text-digi-muted tabular-nums" style={mf}>{user?.id?.slice(0, 8)}…</span>],
              ['Rol', <PixelBadge key="r" variant="info">{user?.role}</PixelBadge>],
              ['Verificado', <PixelBadge key="v" variant={user?.is_verified ? 'success' : 'warning'}>{user?.is_verified ? 'Sí' : 'No'}</PixelBadge>],
            ].map(([k, v]) => (
              <div key={k as string} className="flex items-center justify-between gap-3 text-[12.5px]">
                <dt className="text-digi-muted" style={mf}>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>

      </form>
    </SettingsPanel>
  );
}

/* ── Campo de una red social: enlace + aviso en vivo + atajo para abrirlo ─────
 * El aviso aparece mientras se escribe, no al guardar: descubrir en el botón
 * «Guardar» que un campo de arriba está mal obliga a volver a buscarlo.        */
function CampoRed({ red, valor, onChange }: { red: Red; valor: string; onChange: (v: string) => void }) {
  const def = REDES[red];
  const { url, error } = normalizarRed(red, valor);
  // Nada de gritar sobre un campo que aún se está escribiendo: solo se avisa
  // cuando ya parece una dirección terminada.
  const avisar = !!error && valor.trim().length > 3;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[12px] font-medium text-digi-text" style={mf}>{def.etiqueta}</label>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-digi-muted hover:text-accent transition-colors" style={mf}
            title="Abrir el enlace para comprobar que lleva a tu perfil">
            <ExternalLink className="w-3 h-3" /> Probar
          </a>
        )}
      </div>
      <input
        type="url" inputMode="url" value={valor} onChange={(e) => onChange(e.target.value)}
        placeholder={def.ejemplo}
        aria-invalid={avisar || undefined}
        className={`field-control w-full px-3 py-2 bg-digi-darker border-2 rounded-md text-sm text-digi-text placeholder:text-digi-muted/50 focus:outline-none transition-colors
          ${avisar ? 'border-red-400 focus:border-red-500' : 'border-digi-border focus:border-accent'}`}
        style={mf}
      />
      {avisar && <p className="text-[11px] text-red-600" style={mf}>{error}</p>}
    </div>
  );
}

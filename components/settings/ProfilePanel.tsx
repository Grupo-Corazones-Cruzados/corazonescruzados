'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { accessRoleOf } from '@/lib/dashboard/access';
import { toast } from 'sonner';
import PixelInput from '@/components/ui/PixelInput';
import PixelBadge from '@/components/ui/PixelBadge';
import SettingsPanel from '@/components/settings/SettingsPanel';
import GrupoForm from '@/components/settings/GrupoForm';
import { BTN_PRIMARY } from '@/components/ui/Button';
import PieAcciones from '@/components/ui/PieAcciones';
import EliminarCuenta from '@/components/settings/EliminarCuenta';
import PasskeysPanel from '@/components/settings/PasskeysPanel';
import MultiSelectSearch from '@/components/ui/MultiSelectSearch';

/** Idiomas del selector. Vive aquí porque aquí es donde se eligen. */
const IDIOMAS = ['Español', 'Inglés', 'Portugués', 'Francés', 'Italiano', 'Alemán', 'Chino (Mandarín)', 'Japonés', 'Coreano', 'Ruso', 'Árabe', 'Kichwa', 'Catalán', 'Neerlandés', 'Hindi']
  .map((l) => ({ value: l, label: l }));
import { User, Camera, RefreshCw, Save } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

/** Panel de Perfil: avatar, datos personales, redes y cuenta. Autónomo (usa el usuario actual). */
/** `accion`: un botón a la derecha del título (p. ej. «Compartir CV», Fernando 2026-11-09). */
export default function ProfilePanel({ accion }: { accion?: React.ReactNode } = {}) {
  const { user, refreshUser } = useAuth();
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar_url || '');
  /* Las redes ya no se escriben aquí: cada talento las conecta en Configuración ▸ Conexiones (Fernando,
     2026-11-10). Lo que había se reenvía tal cual para que guardar el perfil no lo borre. */
  const youtube = user?.youtube_handle || '';
  const tiktok = user?.tiktok_handle || '';
  const instagram = user?.instagram_handle || '';
  const facebook = user?.facebook_handle || '';
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Ajustes del CV público. Solo se cargan/guardan si el usuario es miembro: quien no
  // lo es no tiene fila en `member_cv_profiles` y el endpoint le responde 403.
  const esMiembro = !!user?.member_id;

  /**
   * «Sincronizar con Google» es para quien tiene cuenta corporativa de GCC: trae su
   * nombre, teléfono y foto desde Google Workspace.
   *
   * ⚠️ A un CLIENTE no se le ofrece, y no es cosmética. La ruta exige una
   * `workspace_email` y a un cliente le responde «Tu cuenta no tiene una cuenta de Google
   * asociada»: un botón que falla siempre al pulsarlo, y que además le sugiere que
   * tenemos algo suyo en Google. Ver `app/api/users/google-sync/route.ts`, que sigue
   * comprobándolo por su cuenta — esconderlo aquí es no ofrecer lo imposible, no la
   * seguridad.
   *
   * Se decide con `accessRoleOf`, que es quien sabe distinguir un cliente de un candidato
   * (los dos tienen `role = 'client'`).
   */
  const esCliente = accessRoleOf(user) === 'client';
  // Ubicación se queda en Perfil (el titular se fue a «Mi CV»); LinkedIn y el sitio
  // web se editan aquí, con el resto de redes, aunque vivan en la tabla del CV.
  const [ubicacion, setUbicacion] = useState('');
  // Aspiración salarial e idiomas se mudaron aquí desde «Mi CV» (Fernando,
  // 2026-08-15): son datos de la persona, no de un talento concreto.
  const [salarioMin, setSalarioMin] = useState('');
  const [salarioMax, setSalarioMax] = useState('');
  const [idiomas, setIdiomas] = useState<string[]>([]);

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
            location: ubicacion,
            salary_min: salarioMin, salary_max: salarioMax, languages: idiomas,
          }),
        });
        if (!resCv.ok) {
          const d = await resCv.json().catch(() => ({}));
          throw new Error(d.error || 'Error al guardar el CV público');
        }
      }

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
      /* Sin subtítulo «Tus datos personales y redes» (Fernando, 2026-10-23: bajo el título
         no van frases descriptivas; los campos ya lo dicen). */
      Icon={User} title="Perfil" headerExtra={accion}
      bodyClassName="p-0" className="w-full xl:w-[400px] shrink-0 h-full"
      /* ⚠️ El botón vive en el PIE, fuera del `<form>`, así que se ata a él con
         `form="perfil-form"` — atributo HTML estándar. Es lo que permite tener la
         acción fija al fondo sin renunciar a enviar con Intro desde un campo. */
      pie={(
        <PieAcciones
          onEliminar={user?.role === 'client' ? () => setEliminando(true) : undefined}
          etiquetaEliminar="Eliminar mi cuenta"
        >
          <button type="submit" form="perfil-form" disabled={saving} className={BTN_PRIMARY}>
            <Save className="w-4 h-4" /> {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </PieAcciones>
      )}
    >
      {/* En el teléfono, cada bloque es un grupo con su tarjeta y su nombre encima (`GrupoForm`,
          Fernando 2026-10-30); en escritorio, la misma columna de siempre. */}
      <form id="perfil-form" onSubmit={handleSave} className="p-4 max-lg:p-0 space-y-4 max-lg:space-y-5">
        <GrupoForm titulo="Cuenta" tituloEscritorio={false} primero>
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
              {!esCliente && (
                <button type="button" onClick={handleGoogleSync} disabled={syncing}
                  className="inline-flex items-center gap-1.5 text-[12px] text-digi-text border border-digi-border rounded px-3 py-1.5 hover:border-accent hover:text-accent transition-colors disabled:opacity-50" style={mf}
                  title="Traer nombre, teléfono y foto desde tu perfil de Google">
                  <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} /> {syncing ? 'Sincronizando...' : 'Sincronizar con Google'}
                </button>
              )}
            </div>
          </div>
        </div>

        </GrupoForm>

        <GrupoForm titulo="Datos personales" tituloEscritorio={false} primero>
        <div className="grid grid-cols-2 gap-3">
          <PixelInput label="Nombre" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Juan" />
          <PixelInput label="Apellido" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Pérez" />
        </div>
        <PixelInput label="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+593999999999" />
        {esMiembro && (
          <PixelInput label="Ubicación" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} placeholder="Guayaquil, Ecuador" />
        )}

        </GrupoForm>

        {esMiembro && (
        <GrupoForm titulo="Perfil profesional" tituloEscritorio={false} primero>
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-digi-text" style={mf}>Aspiración salarial (USD/mes)</label>
            {/* «Desde» y «Hasta» con su nombre a la vista: como texto de ejemplo desaparecían en
                cuanto había un número, y «1500 · 2000» no decía cuál era cuál (2026-10-30). */}
            <div className="grid grid-cols-2 gap-2">
              {([['Desde', salarioMin, setSalarioMin], ['Hasta', salarioMax, setSalarioMax]] as const).map(([nombre, valor, poner]) => (
                <label key={nombre} className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[11px] text-digi-muted" style={mf}>{nombre}</span>
                  <input type="number" min={0} step={50} inputMode="numeric" value={valor}
                    onChange={(e) => poner(e.target.value)} placeholder="0"
                    className="field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border rounded-md text-sm text-digi-text tabular-nums placeholder:text-digi-muted/50 focus:border-accent focus:outline-none" style={mf} />
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-digi-text" style={mf}>Idiomas</label>
            <MultiSelectSearch options={IDIOMAS} selected={idiomas} onChange={setIdiomas} placeholder="Elegir idiomas…" />
          </div>
        </GrupoForm>
        )}

        {/* Sin la sección «Cuenta»: correo, ID, rol y verificado son datos del
            sistema, no del perfil que se edita. Quien entra ya sabe con qué cuenta
            está, y el correo está arriba junto a la foto. Lo quitó Fernando. */}

        {/* Las passkeys sí van aquí: no son un dato del sistema, son algo que se
            gestiona —se añade la de este equipo, se quita la que ya no se usa—. Antes
            solo se podían crear desde el modal de acceso, y solo si no tenías ninguna.
            ⚠️ Sus botones llevan `type="button"`: dentro de un <form>, un botón sin
            tipo envía el formulario. */}
        <PasskeysPanel />

      </form>
      <EliminarCuenta open={eliminando} onClose={() => setEliminando(false)} />
    </SettingsPanel>
  );
}

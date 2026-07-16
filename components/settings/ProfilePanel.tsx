'use client';

import { useRef, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import PixelInput from '@/components/ui/PixelInput';
import PixelBadge from '@/components/ui/PixelBadge';
import SettingsPanel from '@/components/settings/SettingsPanel';
import { User, Camera, RefreshCw } from 'lucide-react';

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
      await refreshUser();
      toast.success('Perfil actualizado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsPanel Icon={User} title="Perfil" subtitle="Tus datos personales y redes" bodyClassName="p-0" className="w-full xl:w-[400px] shrink-0">
      <form onSubmit={handleSave} className="p-4 space-y-4">
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

        <div className="pt-3 border-t border-digi-border space-y-3">
          <div>
            <h4 className="text-[13px] font-semibold text-digi-text mb-0.5" style={mf}>Redes sociales</h4>
            <p className="text-[11px] text-digi-muted" style={mf}>
              Se usarán al generar copy para promocionar tus proyectos. Formato @usuario o nombre de página.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <PixelInput label="YouTube" value={youtube} onChange={(e) => setYoutube(e.target.value)} placeholder="@canal" />
            <PixelInput label="TikTok" value={tiktok} onChange={(e) => setTiktok(e.target.value)} placeholder="@usuario" />
            <PixelInput label="Instagram" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@usuario" />
            <PixelInput label="Facebook" value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="Nombre de página" />
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

        <button type="submit" disabled={saving} className="pixel-btn pixel-btn-primary w-full disabled:opacity-50">
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>
    </SettingsPanel>
  );
}

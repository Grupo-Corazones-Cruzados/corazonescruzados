'use client';

import { useRef, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import PixelInput from '@/components/ui/PixelInput';
import PixelBadge from '@/components/ui/PixelBadge';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;

export default function SettingsPage() {
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
  const fileRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('La imagen no puede superar 2MB');
      return;
    }

    // Show local preview immediately
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
          first_name: firstName,
          last_name: lastName,
          phone,
          youtube_handle: youtube,
          tiktok_handle: tiktok,
          instagram_handle: instagram,
          facebook_handle: facebook,
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
    <div className="max-w-2xl">
      <PageHeader title="Configuracion" description="Administra tu perfil" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile form */}
        <div className="md:col-span-2">
          <form onSubmit={handleSave} className="pixel-card space-y-4">
            {/* Avatar */}
            <div className="flex items-center gap-4 mb-2">
              <div className="relative shrink-0">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="" className="w-20 h-20 border-2 border-accent/30 object-cover" />
                ) : (
                  <div className="w-20 h-20 flex items-center justify-center bg-accent/20 border-2 border-accent/30 text-accent-glow text-2xl" style={pf}>
                    {(user?.first_name?.[0] || user?.email?.[0] || '?').toUpperCase()}
                  </div>
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-[8px] text-white animate-pulse" style={pf}>...</span>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <p className="text-xs text-white mb-0.5" style={pf}>{user?.email}</p>
                <p className="text-[9px] text-digi-muted mb-3" style={mf}>ID: {user?.id?.slice(0, 8)}...</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="text-[9px] text-accent-glow border border-accent/30 px-3 py-1 hover:bg-accent/10 transition-colors disabled:opacity-50"
                  style={pf}
                >
                  {uploading ? 'Subiendo...' : 'Cambiar foto'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <PixelInput label="Nombre" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Juan" />
              <PixelInput label="Apellido" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Perez" />
            </div>

            <PixelInput label="Telefono" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+593999999999" />

            <div className="pt-2 border-t border-digi-border/30 space-y-3">
              <div>
                <h4 className="text-[10px] text-accent-glow mb-1" style={pf}>Redes Sociales</h4>
                <p className="text-[9px] text-digi-muted" style={mf}>
                  Se usaran al generar copy para promocionar tus proyectos. Formato @usuario o nombre de pagina.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <PixelInput label="YouTube" value={youtube} onChange={(e) => setYoutube(e.target.value)} placeholder="@canal" />
                <PixelInput label="TikTok" value={tiktok} onChange={(e) => setTiktok(e.target.value)} placeholder="@usuario" />
                <PixelInput label="Instagram" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@usuario" />
                <PixelInput label="Facebook" value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="Nombre de pagina" />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="pixel-btn pixel-btn-primary w-full disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </form>
        </div>

        {/* Sidebar info */}
        <div className="space-y-4">
          <div className="pixel-card">
            <h3 className="text-[10px] text-accent-glow mb-3" style={pf}>Cuenta</h3>
            <div className="space-y-2 text-[10px]" style={mf}>
              <div className="flex justify-between">
                <span className="text-digi-muted">Rol</span>
                <PixelBadge variant="info">{user?.role}</PixelBadge>
              </div>
              <div className="flex justify-between">
                <span className="text-digi-muted">Verificado</span>
                <PixelBadge variant={user?.is_verified ? 'success' : 'warning'}>
                  {user?.is_verified ? 'Si' : 'No'}
                </PixelBadge>
              </div>
            </div>
          </div>

          {(user?.role === 'member' || user?.role === 'admin') && (
            <div className="pixel-card">
              <h3 className="text-[10px] text-accent-glow mb-3" style={pf}>Miembro</h3>
              <div className="space-y-1.5">
                {[
                  { label: 'Disponibilidad', href: '/dashboard/settings/availability' },
                  { label: 'Mi CV', href: '/dashboard/settings/cv' },
                  { label: 'Portafolio', href: '/dashboard/settings/portfolio' },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center justify-between px-2 py-1.5 text-[10px] text-digi-muted hover:text-accent-glow border border-digi-border hover:border-accent/30 transition-colors"
                    style={pf}
                  >
                    {link.label} <span>&gt;</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

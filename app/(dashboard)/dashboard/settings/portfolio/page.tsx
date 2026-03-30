'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import PageHeader from '@/components/ui/PageHeader';
import PixelTabs from '@/components/ui/PixelTabs';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelModal from '@/components/ui/PixelModal';
import PixelInput from '@/components/ui/PixelInput';

const TABS = [
  { value: 'project', label: 'Proyectos' },
  { value: 'product', label: 'Productos' },
  { value: 'automation', label: 'Automatizaciones' },
];

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;

const emptyForm = { title: '', description: '', price: '', tags: '', project_url: '', images: [''] };

export default function PortfolioPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('project');
  const [items, setItems] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Gallery modal
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryTitle, setGalleryTitle] = useState('');

  const fetchItems = useCallback(async () => {
    if (!user?.member_id) return;
    try {
      const res = await fetch(`/api/members/${user.member_id}/portfolio?type=${tab}`);
      const data = await res.json();
      setItems(data.data || []);
    } catch { setItems([]); }
  }, [user?.member_id, tab]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const openCreate = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setModal(true);
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    const imgs = item.images?.length > 0 ? [...item.images] : item.image_url ? [item.image_url] : [''];
    setForm({
      title: item.title || '',
      description: item.description || '',
      price: item.price != null ? String(item.price) : '',
      tags: item.tags?.join(', ') || '',
      project_url: item.project_url || '',
      images: imgs,
    });
    setModal(true);
  };

  const openGallery = (item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const imgs: string[] = item.images?.length > 0 ? item.images : item.image_url ? [item.image_url] : [];
    if (imgs.length === 0) {
      toast.info('Este registro no tiene imagenes');
      return;
    }
    setGalleryImages(imgs);
    setGalleryIndex(0);
    setGalleryTitle(item.title || '');
    setGalleryOpen(true);
  };

  // --- Images form helpers ---
  const updateImage = (index: number, value: string) => {
    const next = [...form.images];
    next[index] = value;
    setForm({ ...form, images: next });
  };

  const addImageField = () => {
    setForm({ ...form, images: [...form.images, ''] });
  };

  const removeImageField = (index: number) => {
    const next = form.images.filter((_, i) => i !== index);
    setForm({ ...form, images: next.length === 0 ? [''] : next });
  };

  const handleSave = async () => {
    if (!user?.member_id) return;
    if (!form.title.trim()) {
      toast.error('El titulo es requerido');
      return;
    }

    setSaving(true);
    try {
      const cleanImages = form.images.filter((u) => u.trim());
      const payload = {
        title: form.title,
        description: form.description || null,
        price: Number(form.price) || 0,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        project_url: form.project_url || null,
        image_url: cleanImages[0] || null,
        images: cleanImages,
        type: tab,
      };

      let res: Response;
      if (editingItem) {
        res = await fetch(`/api/members/${user.member_id}/portfolio/${editingItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/members/${user.member_id}/portfolio`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) throw new Error();
      toast.success(editingItem ? 'Item actualizado' : 'Item creado');
      setModal(false);
      setForm(emptyForm);
      setEditingItem(null);
      fetchItems();
    } catch {
      toast.error(editingItem ? 'Error al actualizar' : 'Error al crear');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!user?.member_id) return;
    try {
      await fetch(`/api/members/${user.member_id}/portfolio/${id}`, { method: 'DELETE' });
      toast.success('Eliminado');
      fetchItems();
    } catch {
      toast.error('Error al eliminar');
    }
  };

  // --- Team projects (marketplace published) ---
  const [teamProjects, setTeamProjects] = useState<any[]>([]);
  const [teamEditModal, setTeamEditModal] = useState(false);
  const [teamEditItem, setTeamEditItem] = useState<any>(null);
  const [teamForm, setTeamForm] = useState({ title: '', price: '', images: [''] as string[] });
  const [teamSaving, setTeamSaving] = useState(false);

  const fetchTeamProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/marketplace/projects?member=true');
      const data = await res.json();
      setTeamProjects(data.data || []);
    } catch { setTeamProjects([]); }
  }, []);

  useEffect(() => { if (tab === 'project') fetchTeamProjects(); }, [tab, fetchTeamProjects]);

  const openTeamEdit = (p: any) => {
    setTeamEditItem(p);
    setTeamForm({
      title: p.title || '',
      price: p.final_cost != null ? String(p.final_cost) : '',
      images: p.images?.length > 0 ? [...p.images] : [''],
    });
    setTeamEditModal(true);
  };

  const handleTeamSave = async () => {
    if (!teamEditItem) return;
    setTeamSaving(true);
    try {
      const cleanImages = teamForm.images.filter(u => u.trim());
      const res = await fetch(`/api/marketplace/projects/${teamEditItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: teamForm.title, final_cost: Number(teamForm.price) || 0, images: cleanImages }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast.success('Proyecto actualizado');
      setTeamEditModal(false);
      fetchTeamProjects();
    } catch (e: any) { toast.error(e.message || 'Error al guardar'); }
    finally { setTeamSaving(false); }
  };

  const teamUpdateImage = (i: number, v: string) => {
    const next = [...teamForm.images]; next[i] = v;
    setTeamForm({ ...teamForm, images: next });
  };
  const teamAddImage = () => setTeamForm({ ...teamForm, images: [...teamForm.images, ''] });
  const teamRemoveImage = (i: number) => {
    const next = teamForm.images.filter((_, idx) => idx !== i);
    setTeamForm({ ...teamForm, images: next.length === 0 ? [''] : next });
  };

  const imageCount = (item: any) => {
    if (item.images?.length > 0) return item.images.length;
    return item.image_url ? 1 : 0;
  };

  const tabLabel = tab === 'project' ? 'Proyecto' : tab === 'product' ? 'Producto' : 'Automatizacion';

  if (!user?.member_id) {
    return (
      <div className="pixel-card text-center py-12">
        <p className="pixel-heading text-sm text-digi-muted">Solo disponible para miembros</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Portafolio"
        description="Gestiona tus proyectos, productos y automatizaciones"
        action={
          <button onClick={openCreate} className="pixel-btn pixel-btn-primary">
            + Nuevo
          </button>
        }
      />

      <PixelTabs tabs={TABS} active={tab} onChange={setTab} />

      <PixelDataTable
        columns={[
          { key: 'id', header: 'ID', render: (item: any) => `#${item.id}`, width: '60px' },
          {
            key: 'images', header: 'Fotos', width: '70px',
            render: (item: any) => {
              const count = imageCount(item);
              return (
                <button
                  onClick={(e) => openGallery(item, e)}
                  className={`flex items-center gap-1 px-1.5 py-0.5 border transition-colors ${
                    count > 0
                      ? 'border-accent/40 text-accent-glow hover:bg-accent/10'
                      : 'border-digi-border/30 text-digi-muted/40 cursor-default'
                  }`}
                  disabled={count === 0}
                  title={count > 0 ? `Ver ${count} foto(s)` : 'Sin fotos'}
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="1" y="3" width="14" height="10" rx="1" />
                    <circle cx="5.5" cy="7" r="1.5" />
                    <path d="M14 13L10.5 9L7.5 12L5.5 10.5L2 13" />
                  </svg>
                  <span className="text-[9px]" style={mf}>{count}</span>
                </button>
              );
            },
          },
          { key: 'title', header: 'Titulo', render: (item: any) => (
            <span className="text-white">{item.title}</span>
          )},
          {
            key: 'tags', header: 'Tags', render: (item: any) => (
              <div className="flex flex-wrap gap-1">
                {(item.tags || []).slice(0, 3).map((t: string) => (
                  <PixelBadge key={t}>{t}</PixelBadge>
                ))}
              </div>
            ),
          },
          {
            key: 'price', header: 'Precio', width: '100px',
            render: (item: any) => (
              <span className="text-accent-glow">${Number(item.price || 0).toFixed(2)}</span>
            ),
          },
          {
            key: 'actions', header: '', width: '140px',
            render: (item: any) => (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={(e) => { e.stopPropagation(); openEdit(item); }}
                  className="text-[9px] text-accent-glow border border-accent/30 px-2 py-0.5 hover:bg-accent/10 transition-colors"
                  style={pf}
                >
                  Editar
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                  className="text-[9px] text-red-400 border border-red-500/30 px-2 py-0.5 hover:bg-red-900/20 transition-colors"
                  style={pf}
                >
                  Eliminar
                </button>
              </div>
            ),
          },
        ]}
        data={items}
        emptyTitle="Sin items"
        emptyDesc={`No hay ${tabLabel.toLowerCase()}s registrados aun.`}
      />

      {/* ========== TEAM PROJECTS SECTION ========== */}
      {tab === 'project' && teamProjects.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xs text-accent-glow mb-3" style={pf}>Proyectos del Equipo (Marketplace)</h2>
          <PixelDataTable
            columns={[
              {
                key: 'images', header: 'Fotos', width: '70px',
                render: (p: any) => {
                  const count = p.images?.length || 0;
                  return (
                    <button
                      onClick={(e) => openGallery(p, e)}
                      className={`flex items-center gap-1 px-1.5 py-0.5 border transition-colors ${
                        count > 0 ? 'border-accent/40 text-accent-glow hover:bg-accent/10' : 'border-digi-border/30 text-digi-muted/40 cursor-default'
                      }`}
                      disabled={count === 0}
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="1" y="3" width="14" height="10" rx="1" /><circle cx="5.5" cy="7" r="1.5" /><path d="M14 13L10.5 9L7.5 12L5.5 10.5L2 13" />
                      </svg>
                      <span className="text-[9px]" style={mf}>{count}</span>
                    </button>
                  );
                },
              },
              { key: 'title', header: 'Proyecto', render: (p: any) => <span className="text-white">{p.title}</span> },
              { key: 'team', header: 'Equipo', render: (p: any) => {
                const team = p.team || [];
                return (
                  <div className="flex items-center gap-1">
                    {team.slice(0, 4).map((m: any, i: number) => (
                      m.photo_url ? (
                        <img key={i} src={m.photo_url} alt={m.name} className="w-5 h-5 rounded-full object-cover border border-digi-border" title={m.name} />
                      ) : (
                        <div key={i} className="w-5 h-5 rounded-full bg-accent/30 border border-accent/50 flex items-center justify-center" title={m.name}>
                          <span className="text-[7px] text-accent-glow" style={pf}>{m.name?.charAt(0)}</span>
                        </div>
                      )
                    ))}
                  </div>
                );
              }, width: '120px' },
              { key: 'price', header: 'Precio', width: '100px', render: (p: any) => (
                <span className="text-accent-glow" style={mf}>${Number(p.final_cost || 0).toFixed(2)}</span>
              )},
              { key: 'actions', header: '', width: '80px', render: (p: any) => (
                <button
                  onClick={(e) => { e.stopPropagation(); openTeamEdit(p); }}
                  className="text-[9px] text-accent-glow border border-accent/30 px-2 py-0.5 hover:bg-accent/10 transition-colors"
                  style={pf}
                >
                  Editar
                </button>
              )},
            ]}
            data={teamProjects}
            emptyTitle="Sin proyectos"
            emptyDesc="No tienes proyectos publicados en equipo."
          />
        </div>
      )}

      {/* ========== TEAM EDIT MODAL ========== */}
      <PixelModal open={teamEditModal} onClose={() => setTeamEditModal(false)} title="Editar Proyecto del Equipo" size="lg">
        {teamEditItem && (
          <div className="space-y-3">
            <PixelInput label="Titulo" value={teamForm.title} onChange={(e) => setTeamForm({ ...teamForm, title: e.target.value })} />
            <PixelInput label="Precio (USD)" type="number" value={teamForm.price} onChange={(e) => setTeamForm({ ...teamForm, price: e.target.value })} placeholder="0.00" />
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-accent-glow opacity-70" style={pf}>Imagenes (URLs)</label>
                <button type="button" onClick={teamAddImage} className="text-[9px] text-accent-glow border border-accent/30 px-2 py-0.5 hover:bg-accent/10 transition-colors" style={pf}>+ Agregar</button>
              </div>
              <div className="space-y-2">
                {teamForm.images.map((img, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={img} onChange={(e) => teamUpdateImage(i, e.target.value)} placeholder="https://..." className="flex-1 px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none" style={mf} />
                    {teamForm.images.length > 1 && (
                      <button type="button" onClick={() => teamRemoveImage(i)} className="px-2 text-red-400 border border-red-500/30 hover:bg-red-900/20 transition-colors text-[10px]" style={pf}>X</button>
                    )}
                  </div>
                ))}
              </div>
              {teamForm.images.filter(Boolean).length > 0 && (
                <div className="flex gap-2 flex-wrap mt-1">
                  {teamForm.images.filter(Boolean).map((img, i) => (
                    <div key={i} className="w-16 h-16 border-2 border-digi-border overflow-hidden">
                      <img src={img} alt={`Preview ${i + 1}`} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={handleTeamSave} disabled={teamSaving || !teamForm.title.trim()} className="pixel-btn pixel-btn-primary w-full disabled:opacity-50">
              {teamSaving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        )}
      </PixelModal>

      {/* ========== CREATE / EDIT MODAL ========== */}
      <PixelModal
        open={modal}
        onClose={() => { setModal(false); setEditingItem(null); }}
        title={editingItem ? `Editar ${tabLabel}` : `Nuevo ${tabLabel}`}
        size="lg"
      >
        <div className="space-y-3">
          <PixelInput
            label="Titulo *"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-accent-glow opacity-70" style={pf}>Descripcion</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none resize-none"
              style={mf}
            />
          </div>

          {/* Multiple images */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-accent-glow opacity-70" style={pf}>Imagenes (URLs)</label>
              <button
                type="button"
                onClick={addImageField}
                className="text-[9px] text-accent-glow border border-accent/30 px-2 py-0.5 hover:bg-accent/10 transition-colors"
                style={pf}
              >
                + Agregar
              </button>
            </div>
            <div className="space-y-2">
              {form.images.map((img, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={img}
                    onChange={(e) => updateImage(i, e.target.value)}
                    placeholder="https://..."
                    className="flex-1 px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none"
                    style={mf}
                  />
                  {form.images.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeImageField(i)}
                      className="px-2 text-red-400 border border-red-500/30 hover:bg-red-900/20 transition-colors text-[10px]"
                      style={pf}
                    >
                      X
                    </button>
                  )}
                </div>
              ))}
            </div>
            {/* Preview thumbnails */}
            {form.images.filter(Boolean).length > 0 && (
              <div className="flex gap-2 flex-wrap mt-1">
                {form.images.filter(Boolean).map((img, i) => (
                  <div key={i} className="w-16 h-16 border-2 border-digi-border overflow-hidden">
                    <img
                      src={img}
                      alt={`Preview ${i + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {tab === 'project' && (
            <PixelInput
              label="URL del proyecto"
              value={form.project_url}
              onChange={(e) => setForm({ ...form, project_url: e.target.value })}
              placeholder="https://..."
            />
          )}
          <PixelInput
            label="Precio (USD)"
            type="number"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            placeholder="0.00"
          />
          <PixelInput
            label="Tags (separados por coma)"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            placeholder="React, API, ..."
          />
          <button
            onClick={handleSave}
            disabled={saving || !form.title.trim()}
            className="pixel-btn pixel-btn-primary w-full disabled:opacity-50"
          >
            {saving ? 'Guardando...' : editingItem ? 'Guardar Cambios' : 'Crear'}
          </button>
        </div>
      </PixelModal>

      {/* ========== IMAGE GALLERY MODAL ========== */}
      <PixelModal open={galleryOpen} onClose={() => setGalleryOpen(false)} title={galleryTitle || 'Galeria'} size="lg">
        {galleryImages.length > 0 && (
          <div className="space-y-3">
            <div className="relative border-2 border-digi-border bg-black/20 flex items-center justify-center min-h-[200px]">
              <img
                src={galleryImages[galleryIndex]}
                alt={`Foto ${galleryIndex + 1}`}
                className="max-w-full max-h-[50vh] object-contain"
              />
              {galleryImages.length > 1 && (
                <>
                  <button
                    onClick={() => setGalleryIndex((p) => (p - 1 + galleryImages.length) % galleryImages.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-digi-darker/80 border border-digi-border text-digi-text hover:border-accent hover:text-accent-glow transition-colors"
                    style={pf}
                  >
                    &lt;
                  </button>
                  <button
                    onClick={() => setGalleryIndex((p) => (p + 1) % galleryImages.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-digi-darker/80 border border-digi-border text-digi-text hover:border-accent hover:text-accent-glow transition-colors"
                    style={pf}
                  >
                    &gt;
                  </button>
                </>
              )}
            </div>
            <div className="text-center">
              <span className="text-[10px] text-digi-muted" style={mf}>
                {galleryIndex + 1} / {galleryImages.length}
              </span>
            </div>
            {galleryImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {galleryImages.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setGalleryIndex(i)}
                    className={`flex-shrink-0 w-16 h-16 border-2 overflow-hidden transition-colors ${
                      i === galleryIndex ? 'border-accent' : 'border-digi-border/50 hover:border-digi-border'
                    }`}
                  >
                    <img src={img} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </PixelModal>
    </div>
  );
}

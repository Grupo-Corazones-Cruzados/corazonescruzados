'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';
import PixelInput from '@/components/ui/PixelInput';
import ImageGallery from '@/components/ui/ImageGallery';
import { BTN_PRIMARY } from '@/components/ui/Button';
import { fmt2 } from '@/lib/format';
import { Briefcase, FolderKanban, Package, Workflow, Plus, Pencil, Trash2, UploadCloud, X, Image as ImageIcon } from 'lucide-react';

const TABS = [
  { value: 'project', label: 'Proyectos', Icon: FolderKanban },
  { value: 'product', label: 'Productos', Icon: Package },
  { value: 'automation', label: 'Automatizaciones', Icon: Workflow },
];

const mf = { fontFamily: 'var(--font-body)' } as const;
const emptyForm = { title: '', description: '', price: '', tags: '', project_url: '', images: [''] };

/** Panel de Portafolio: proyectos/productos/automatizaciones propios + proyectos del equipo.
 *  Adaptado a columna angosta: pestañas en píldoras, lista vertical y detalle/galería en modal. */
export default function PortfolioPanel() {
  const { user } = useAuth();
  const [tab, setTab] = useState('project');
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Gallery modal
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
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

  const imageCount = (item: any) => (item.images?.length > 0 ? item.images.length : item.image_url ? 1 : 0);
  const imagesOf = (item: any): string[] => (item.images?.length ? item.images : item.image_url ? [item.image_url] : []);

  const openCreate = () => { setEditingItem(null); setForm(emptyForm); setModal(true); };
  const openEdit = (item: any) => {
    setEditingItem(item);
    const imgs = item.images?.length > 0 ? [...item.images] : item.image_url ? [item.image_url] : [''];
    setForm({
      title: item.title || '', description: item.description || '',
      price: item.price != null ? String(item.price) : '',
      tags: item.tags?.join(', ') || '', project_url: item.project_url || '', images: imgs,
    });
    setModal(true);
  };

  const openGalleryFor = (imgs: string[], title: string) => {
    const clean = (imgs || []).filter(Boolean);
    if (!clean.length) { toast.info('Este registro no tiene imágenes'); return; }
    setGalleryImages(clean); setGalleryTitle(title); setGalleryOpen(true);
  };
  const openRowGallery = async (item: any) => {
    if (item.__team) {
      if (!item.image_count) { toast.info('Este proyecto no tiene imágenes'); return; }
      try { const res = await fetch(`/api/marketplace/projects/${item.id}`); const d = await res.json(); openGalleryFor(d?.data?.images || (item.cover_image ? [item.cover_image] : []), item.title); }
      catch { toast.error('No se pudieron cargar las imágenes'); }
      return;
    }
    openGalleryFor(imagesOf(item), item.title);
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result as string); r.onerror = reject; r.readAsDataURL(file); });
  const handleFileUpload = async (files: FileList | null, setter: (imgs: string[]) => void, current: string[]) => {
    if (!files) return;
    const next = [...current.filter(Boolean)];
    for (const file of Array.from(files)) { if (file.type.startsWith('image/')) next.push(await fileToBase64(file)); }
    setter(next);
  };
  const removeImage = (index: number, setter: (imgs: string[]) => void, current: string[]) => setter(current.filter((_, i) => i !== index));

  const handleSave = async () => {
    if (!user?.member_id) return;
    if (!form.title.trim()) { toast.error('El título es requerido'); return; }
    setSaving(true);
    try {
      const cleanImages = form.images.filter((u) => u.trim());
      const payload = {
        title: form.title, description: form.description || null, price: Number(form.price) || 0,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        project_url: form.project_url || null, image_url: cleanImages[0] || null, images: cleanImages, type: tab,
      };
      const res = editingItem
        ? await fetch(`/api/members/${user.member_id}/portfolio/${editingItem.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch(`/api/members/${user.member_id}/portfolio`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      toast.success(editingItem ? 'Item actualizado' : 'Item creado');
      setModal(false); setForm(emptyForm); setEditingItem(null); fetchItems();
    } catch { toast.error(editingItem ? 'Error al actualizar' : 'Error al crear'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!user?.member_id) return;
    try {
      await fetch(`/api/members/${user.member_id}/portfolio/${id}`, { method: 'DELETE' });
      toast.success('Eliminado');
      fetchItems();
    } catch { toast.error('Error al eliminar'); }
  };

  // --- Team projects (marketplace published) ---
  const [teamProjects, setTeamProjects] = useState<any[]>([]);
  const [teamEditModal, setTeamEditModal] = useState(false);
  const [teamEditItem, setTeamEditItem] = useState<any>(null);
  const [teamForm, setTeamForm] = useState({ title: '', price: '', images: [''] as string[] });
  const [teamSaving, setTeamSaving] = useState(false);

  const fetchTeamProjects = useCallback(async () => {
    try { const res = await fetch('/api/marketplace/projects?member=true'); const data = await res.json(); setTeamProjects(data.data || []); }
    catch { setTeamProjects([]); }
  }, []);
  useEffect(() => { if (tab === 'project') fetchTeamProjects(); }, [tab, fetchTeamProjects]);

  const openTeamEdit = (p: any) => {
    setTeamEditItem(p);
    setTeamForm({ title: p.title || '', price: p.final_cost != null ? String(p.final_cost) : '', images: p.images?.length > 0 ? [...p.images] : [''] });
    setTeamEditModal(true);
  };
  const handleTeamSave = async () => {
    if (!teamEditItem) return;
    setTeamSaving(true);
    try {
      const cleanImages = teamForm.images.filter((u) => u.trim());
      const res = await fetch(`/api/marketplace/projects/${teamEditItem.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: teamForm.title, final_cost: Number(teamForm.price) || 0, images: cleanImages }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast.success('Proyecto actualizado'); setTeamEditModal(false); fetchTeamProjects();
    } catch (e: any) { toast.error(e.message || 'Error al guardar'); }
    finally { setTeamSaving(false); }
  };

  const tabMeta = TABS.find((t) => t.value === tab)!;
  const tabLabel = tabMeta.label.replace(/s$/, '');
  const q = search.toLowerCase();
  const ownFiltered = items.filter((i: any) => !search || i.title?.toLowerCase().includes(q));
  const teamRows = (tab === 'project' ? teamProjects : [])
    .filter((p: any) => !search || p.title?.toLowerCase().includes(q))
    .map((p: any) => ({ ...p, __team: true, price: p.final_cost }));
  const rows = [...ownFiltered, ...teamRows];

  const dropzone = (images: string[], setImages: (imgs: string[]) => void) => (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-medium text-digi-text" style={mf}>Imágenes</label>
      <label className="flex items-center justify-center gap-2 py-4 border-2 border-dashed border-digi-border rounded-lg hover:border-accent/50 cursor-pointer transition-colors">
        <UploadCloud className="w-4 h-4 text-digi-muted" />
        <span className="text-[12px] text-digi-muted" style={mf}>Subir imágenes</span>
        <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFileUpload(e.target.files, setImages, images)} />
      </label>
      {images.filter(Boolean).length > 0 && (
        <div className="flex gap-2 flex-wrap mt-1">
          {images.filter(Boolean).map((img, i) => (
            <div key={i} className="relative w-16 h-16 rounded-md border border-digi-border overflow-hidden group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt={`${i + 1}`} className="w-full h-full object-cover" />
              <button type="button" onClick={() => removeImage(i, setImages, images)} className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (!user?.member_id) {
    return <p className="text-[12px] text-digi-muted text-center py-8" style={mf}>Solo disponible para miembros.</p>;
  }

  return (
    <div className="space-y-3">
      {/* Pestañas (catálogo) + buscador + Nuevo en una fila */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {TABS.map((t) => {
            const active = tab === t.value;
            return (
              <button key={t.value} onClick={() => setTab(t.value)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium border transition-colors ${active ? 'bg-accent-light border-accent text-accent' : 'border-digi-border text-digi-muted hover:border-accent/40 hover:text-digi-text'}`} style={mf}>
                <t.Icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            );
          })}
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..."
          className="field-control flex-1 min-w-[160px] px-3 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none rounded-md" style={mf} />
        <button onClick={openCreate} className={`${BTN_PRIMARY} shrink-0`}><Plus className="w-4 h-4" /> Nuevo {tabLabel.toLowerCase()}</button>
      </div>

      {/* Grilla de tarjetas: llena el ancho disponible en varias columnas */}
      {rows.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-10 h-10 rounded-lg bg-black/[0.03] flex items-center justify-center mx-auto mb-2"><tabMeta.Icon className="w-5 h-5 text-digi-muted" /></div>
          <p className="text-[12px] text-digi-muted" style={mf}>Sin {tabMeta.label.toLowerCase()}. Agrega tu primer registro con “Nuevo”.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 items-start">
          {rows.map((item: any) => {
            const count = item.__team ? (item.image_count || 0) : imageCount(item);
            const key = item.__team ? `t-${item.id}` : `o-${item.id}`;
            return (
              <div key={key} className="rounded-lg border border-digi-border bg-digi-darker/40 p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="truncate text-[13px] font-medium text-digi-text" style={mf}>{item.title}</span>
                      {item.__team && <PixelBadge variant="info">Equipo</PixelBadge>}
                    </div>
                    <p className="text-[12px] text-accent font-semibold tabular-nums mt-0.5" style={mf}>${fmt2(Number(item.price || 0))}</p>
                    {Array.isArray(item.tags) && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">{item.tags.slice(0, 3).map((t: string) => <PixelBadge key={t}>{t}</PixelBadge>)}</div>
                    )}
                  </div>
                  {count > 0 && (
                    <button onClick={() => openRowGallery(item)} title={`Ver ${count} foto(s)`}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-accent/40 text-accent text-[11px] hover:bg-accent-light transition-colors shrink-0"><ImageIcon className="w-3.5 h-3.5" /> {count}</button>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  <button onClick={() => (item.__team ? openTeamEdit(item) : openEdit(item))}
                    className="inline-flex items-center gap-1 text-[12px] font-medium text-digi-text border border-digi-border rounded px-2.5 py-1 hover:border-accent hover:text-accent transition-colors" style={mf}><Pencil className="w-3.5 h-3.5" /> Editar</button>
                  {!item.__team && (
                    <button onClick={() => handleDelete(item.id)} title="Eliminar"
                      className="inline-flex items-center justify-center w-7 h-7 rounded border border-digi-border text-digi-muted hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit modal ── */}
      <PixelModal open={modal} onClose={() => { setModal(false); setEditingItem(null); }} title={editingItem ? `Editar ${tabLabel.toLowerCase()}` : `Nuevo ${tabLabel.toLowerCase()}`} size="lg">
        <div className="space-y-3">
          <PixelInput label="Título *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-digi-text" style={mf}>Descripción</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3}
              className="field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border rounded-md text-sm text-digi-text focus:border-accent focus:outline-none resize-none" style={mf} />
          </div>
          {dropzone(form.images, (imgs) => setForm({ ...form, images: imgs }))}
          {tab === 'project' && <PixelInput label="URL del proyecto" value={form.project_url} onChange={(e) => setForm({ ...form, project_url: e.target.value })} placeholder="https://…" />}
          <PixelInput label="Precio (USD)" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0.00" />
          <PixelInput label="Tags (separados por coma)" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="React, API, …" />
          <button onClick={handleSave} disabled={saving || !form.title.trim()} className={`${BTN_PRIMARY} w-full`}>{saving ? 'Guardando…' : editingItem ? 'Guardar cambios' : 'Crear'}</button>
        </div>
      </PixelModal>

      {/* ── Team edit modal ── */}
      <PixelModal open={teamEditModal} onClose={() => setTeamEditModal(false)} title="Editar proyecto del equipo" size="lg">
        {teamEditItem && (
          <div className="space-y-3">
            <PixelInput label="Título" value={teamForm.title} onChange={(e) => setTeamForm({ ...teamForm, title: e.target.value })} />
            <PixelInput label="Precio (USD)" type="number" value={teamForm.price} onChange={(e) => setTeamForm({ ...teamForm, price: e.target.value })} placeholder="0.00" />
            {dropzone(teamForm.images, (imgs) => setTeamForm({ ...teamForm, images: imgs }))}
            <button onClick={handleTeamSave} disabled={teamSaving || !teamForm.title.trim()} className={`${BTN_PRIMARY} w-full`}>{teamSaving ? 'Guardando…' : 'Guardar cambios'}</button>
          </div>
        )}
      </PixelModal>

      {/* ── Gallery modal ── */}
      <PixelModal open={galleryOpen} onClose={() => setGalleryOpen(false)} title={galleryTitle || 'Galería'} size="lg">
        <ImageGallery images={galleryImages} alt={galleryTitle} />
      </PixelModal>
    </div>
  );
}

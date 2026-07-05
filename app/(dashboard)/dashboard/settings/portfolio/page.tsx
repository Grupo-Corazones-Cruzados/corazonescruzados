'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';
import PixelInput from '@/components/ui/PixelInput';
import ImageGallery from '@/components/ui/ImageGallery';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { fmt2 } from '@/lib/format';
import { FolderKanban, Package, Workflow, Plus, Pencil, Trash2, UploadCloud, X, ChevronLeft, Image as ImageIcon } from 'lucide-react';

const TABS = [
  { value: 'project', label: 'Proyectos', Icon: FolderKanban },
  { value: 'product', label: 'Productos', Icon: Package },
  { value: 'automation', label: 'Automatizaciones', Icon: Workflow },
];

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;
const emptyForm = { title: '', description: '', price: '', tags: '', project_url: '', images: [''] };

export default function PortfolioPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('project');
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Right detail panel
  const [selected, setSelected] = useState<any>(null);
  const [panelImages, setPanelImages] = useState<string[]>([]);

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
  useEffect(() => { setSelected(null); setPanelImages([]); }, [tab]);

  const firstImage = (item: any): string | null => (Array.isArray(item.images) && item.images[0]) || item.image_url || item.cover_image || null;
  const imageCount = (item: any) => (item.images?.length > 0 ? item.images.length : item.image_url ? 1 : 0);
  const imagesOf = (item: any): string[] => (item.images?.length ? item.images : item.image_url ? [item.image_url] : []);

  const selectItem = (item: any) => { setSelected(item); setPanelImages(imagesOf(item)); };

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
      if (selected?.id === id) { setSelected(null); setPanelImages([]); }
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
  const filtered = items.filter((i: any) => !search || i.title?.toLowerCase().includes(search.toLowerCase()));

  if (!user?.member_id) {
    return (
      <div className="max-w-3xl">
        <Link href="/dashboard/settings" className="inline-flex items-center gap-1 text-[12px] text-digi-muted hover:text-accent transition-colors mb-2" style={mf}><ChevronLeft className="w-4 h-4" /> Configuración</Link>
        <PageHeader title="Portafolio" description="Tus proyectos, productos y automatizaciones" />
        <div className="bg-digi-card border border-digi-border rounded-lg py-12 text-center"><p className="text-sm text-digi-muted" style={mf}>Solo disponible para miembros.</p></div>
      </div>
    );
  }

  /* ── Card (idéntica a Marketplace) ── */
  const renderCard = (item: any) => {
    const img = firstImage(item); const count = imageCount(item);
    const active = selected?.id === item.id && !selected?.__team;
    const tags: string[] = Array.isArray(item.tags) ? item.tags : [];
    return (
      <div key={item.id} onClick={() => selectItem(item)}
        className={`group cursor-pointer flex flex-col bg-digi-card border rounded-xl overflow-hidden shadow-sm transition-all hover:shadow-md ${active ? 'border-accent ring-1 ring-accent/30' : 'border-digi-border hover:border-accent/40'}`}>
        <div className="relative aspect-[16/9] bg-digi-darker overflow-hidden">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt={item.title} className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03]" />
          ) : (
            <div className="w-full h-full flex items-center justify-center"><tabMeta.Icon className="w-9 h-9 text-digi-muted/30" /></div>
          )}
          <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-digi-card/85 text-digi-muted text-[10px] font-medium backdrop-blur-sm">{tabLabel}</span>
          {count > 0 && (
            <button onClick={(e) => { e.stopPropagation(); openGalleryFor(imagesOf(item), item.title); }} title={`Ver ${count} foto(s)`}
              className="absolute top-2 right-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/45 text-white text-[11px] backdrop-blur-sm hover:bg-black/65 transition-colors"><ImageIcon className="w-3 h-3" /> {count}</button>
          )}
        </div>
        <div className="p-3 flex flex-col flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[13.5px] font-semibold text-digi-text leading-snug line-clamp-2 flex-1" style={mf}>{item.title}</h3>
            <span className="text-[15px] font-bold text-accent tabular-nums shrink-0" style={mf}>${fmt2(Number(item.price || 0))}</span>
          </div>
          {item.description && <p className="text-[12px] text-digi-muted mt-1 line-clamp-2 leading-relaxed" style={mf}>{item.description}</p>}
          {tags.length > 0 && <div className="flex flex-wrap gap-1 mt-2">{tags.slice(0, 3).map((t) => <PixelBadge key={t}>{t}</PixelBadge>)}</div>}
          <button onClick={(e) => { e.stopPropagation(); openEdit(item); }} className={`${BTN_PRIMARY} w-full mt-3`}><Pencil className="w-3.5 h-3.5" /> Editar</button>
        </div>
      </div>
    );
  };

  const renderTeamCard = (p: any) => {
    const img = firstImage(p); const count = p.images?.length || 0;
    return (
      <div key={p.id} className="flex flex-col bg-digi-card border border-digi-border rounded-xl overflow-hidden shadow-sm">
        <div className="relative aspect-[16/9] bg-digi-darker overflow-hidden">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt={p.title} className="w-full h-full object-cover" />
          ) : <div className="w-full h-full flex items-center justify-center"><FolderKanban className="w-9 h-9 text-digi-muted/30" /></div>}
          <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-digi-card/85 text-digi-muted text-[10px] font-medium backdrop-blur-sm">Equipo</span>
          {count > 0 && (
            <button onClick={(e) => { e.stopPropagation(); openGalleryFor(p.images, p.title); }}
              className="absolute top-2 right-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/45 text-white text-[11px] backdrop-blur-sm hover:bg-black/65 transition-colors"><ImageIcon className="w-3 h-3" /> {count}</button>
          )}
        </div>
        <div className="p-3 flex flex-col flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[13.5px] font-semibold text-digi-text leading-snug line-clamp-2 flex-1" style={mf}>{p.title}</h3>
            <span className="text-[15px] font-bold text-accent tabular-nums shrink-0" style={mf}>${fmt2(Number(p.final_cost || 0))}</span>
          </div>
          <button onClick={() => openTeamEdit(p)} className={`${BTN_SECONDARY} w-full mt-3`}><Pencil className="w-3.5 h-3.5" /> Editar</button>
        </div>
      </div>
    );
  };

  /* ── Panel de detalle (idéntico a Marketplace) ── */
  const renderPanel = () => {
    if (!selected) {
      return (
        <div className="bg-digi-card border border-digi-border rounded-lg p-6 text-center lg:sticky lg:top-4">
          <div className="w-10 h-10 rounded-lg bg-black/[0.03] flex items-center justify-center mx-auto mb-2"><tabMeta.Icon className="w-5 h-5 text-digi-muted" /></div>
          <p className="text-[12px] text-digi-muted" style={mf}>Selecciona un elemento para ver sus detalles e imágenes.</p>
        </div>
      );
    }
    const t = selected;
    const rows: [string, React.ReactNode][] = [['Precio', <span key="p" className="text-accent font-semibold tabular-nums" style={mf}>${fmt2(Number(t.price || 0))}</span>]];
    if (Array.isArray(t.tags) && t.tags.length) rows.push(['Tags', t.tags.slice(0, 4).join(', ')]);
    if (t.project_url) rows.push(['URL', <a key="u" href={t.project_url} target="_blank" rel="noreferrer" className="text-accent hover:underline truncate max-w-[180px] inline-block align-bottom">{t.project_url}</a>]);
    return (
      <div className="bg-digi-card border border-digi-border rounded-lg shadow-sm overflow-hidden lg:sticky lg:top-4">
        <div className="flex items-start gap-3 p-4 border-b border-digi-border">
          <div className="min-w-0 flex-1">
            <h3 className="text-[14px] font-semibold text-digi-text leading-tight" style={mf}>{t.title}</h3>
            <p className="text-[11px] text-digi-muted mt-0.5" style={mf}>{tabLabel}</p>
          </div>
          <button onClick={() => setSelected(null)} className="text-digi-muted hover:text-digi-text shrink-0" aria-label="Cerrar"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <ImageGallery key={t.id} images={panelImages} alt={t.title} onOpen={() => openGalleryFor(panelImages, t.title)} />
          {t.description && <p className="text-[12px] text-digi-text leading-relaxed" style={mf}>{t.description}</p>}
          <dl className="space-y-2">
            {rows.map(([k, v], i) => (
              <div key={i} className="flex items-center justify-between gap-3 text-[12px]"><dt className="text-digi-muted" style={mf}>{k}</dt><dd className="text-digi-text text-right" style={mf}>{v}</dd></div>
            ))}
          </dl>
          <div className="flex items-center gap-2 pt-1">
            <button onClick={() => openEdit(t)} className={`${BTN_PRIMARY} flex-1`}><Pencil className="w-3.5 h-3.5" /> Editar</button>
            <button onClick={() => handleDelete(t.id)} title="Eliminar" className="w-9 h-9 flex items-center justify-center rounded-md border border-digi-border text-digi-muted hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition-colors shrink-0"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    );
  };

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

  return (
    <div>
      <Link href="/dashboard/settings" className="inline-flex items-center gap-1 text-[12px] text-digi-muted hover:text-accent transition-colors mb-2" style={mf}><ChevronLeft className="w-4 h-4" /> Configuración</Link>
      <PageHeader title="Portafolio" description="Tus proyectos, productos y automatizaciones" />

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* ── Left rail: categorías ── */}
        <aside className="w-full lg:w-[220px] shrink-0 bg-digi-card border border-digi-border rounded-lg p-2">
          <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide px-2 pt-1 pb-2" style={df}>Catálogo</p>
          <div className="space-y-0.5">
            {TABS.map((t) => {
              const active = tab === t.value;
              return (
                <button key={t.value} onClick={() => setTab(t.value)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors border-l-2 ${active ? 'bg-accent-light border-accent text-accent' : 'border-transparent text-digi-text hover:bg-black/[0.03]'}`}>
                  <t.Icon className={`w-4 h-4 shrink-0 ${active ? 'text-accent' : 'text-digi-muted'}`} />
                  <span className="flex-1 min-w-0 text-[12.5px] font-medium truncate" style={mf}>{t.label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ── Right region: command bar + grid + panel ── */}
        <div className="flex-1 min-w-0 w-full">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..."
                className="field-control w-full pl-3 pr-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none" style={mf} />
            </div>
            <button onClick={openCreate} className={BTN_PRIMARY}><Plus className="w-4 h-4" /> Nuevo {tabLabel.toLowerCase()}</button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
            <div className="min-w-0">
              {filtered.length === 0 ? (
                <div className="bg-digi-card border border-digi-border rounded-xl py-14 text-center">
                  <div className="w-12 h-12 rounded-xl bg-black/[0.03] flex items-center justify-center mx-auto mb-3"><tabMeta.Icon className="w-6 h-6 text-digi-muted" /></div>
                  <p className="text-sm font-medium text-digi-text" style={mf}>Sin {tabMeta.label.toLowerCase()}</p>
                  <p className="text-[13px] text-digi-muted mt-1" style={mf}>Agrega tu primer registro con “Nuevo”.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{filtered.map(renderCard)}</div>
              )}

              {tab === 'project' && teamProjects.length > 0 && (
                <div className="mt-8">
                  <h2 className="text-[13px] font-semibold text-digi-text mb-3" style={mf}>Proyectos del equipo (Marketplace)</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{teamProjects.map(renderTeamCard)}</div>
                </div>
              )}
            </div>

            <aside className="w-full xl:w-[360px]">{renderPanel()}</aside>
          </div>
        </div>
      </div>

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

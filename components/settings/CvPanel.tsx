'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import PixelInput from '@/components/ui/PixelInput';
import { BTN_PRIMARY } from '@/components/ui/Button';
import { TALENTOS } from '@/lib/centralized/talentos';
import { Plus, Trash2, GraduationCap, Briefcase, Save, Sparkles, Wrench } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

interface EduEntry { institution: string; degree: string; field: string; start_year: string; end_year: string; }
interface ExpEntry { company: string; position: string; description: string; start_year: string; end_year: string; }
interface TalentEntry { key: string; education: EduEntry[]; experience: ExpEntry[]; }
interface ServiceRow { id: number; name: string; description: string | null; base_price: string | number | null; is_active: boolean; talent: string | null; }

const emptyEdu = (): EduEntry => ({ institution: '', degree: '', field: '', start_year: '', end_year: '' });
const emptyExp = (): ExpEntry => ({ company: '', position: '', description: '', start_year: '', end_year: '' });

const addBtn = 'inline-flex items-center gap-1 text-[12px] font-medium text-digi-muted border border-dashed border-digi-border rounded-md px-2 py-1 hover:border-accent hover:text-accent transition-colors';

/** Editor de CV del miembro (corp). Autónomo: usa el member_id del usuario actual.
 *  Incluye una sección de TALENTOS: cada talento con su educación, experiencia y servicios
 *  propios; los servicios activos son los que se pueden elegir al crear un ticket. */
export default function CvPanel() {
  const { user } = useAuth();
  const memberId = user?.member_id;
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState('');
  const [languages, setLanguages] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [website, setWebsite] = useState('');
  const [education, setEducation] = useState<EduEntry[]>([]);
  const [experience, setExperience] = useState<ExpEntry[]>([]);
  const [talents, setTalents] = useState<TalentEntry[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [newTalent, setNewTalent] = useState('');

  useEffect(() => {
    if (!memberId) return;
    fetch(`/api/members/${memberId}/cv`).then((r) => r.json()).then((data) => {
      if (!data.cv) return;
      setBio(data.cv.bio || '');
      setSkills((data.cv.skills || []).join(', '));
      setLanguages((data.cv.languages || []).join(', '));
      setLinkedin(data.cv.linkedin_url || '');
      setWebsite(data.cv.website_url || '');
      setEducation(data.cv.education || []);
      setExperience(data.cv.experience || []);
      setTalents(Array.isArray(data.cv.talents) ? data.cv.talents : []);
    }).catch(() => {});
    fetch(`/api/members/${memberId}/services`).then((r) => r.json())
      .then((d) => setServices(d.data || [])).catch(() => {});
  }, [memberId]);

  const save = async () => {
    if (!memberId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/members/${memberId}/cv`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bio,
          skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
          languages: languages.split(',').map((s) => s.trim()).filter(Boolean),
          linkedin_url: linkedin, website_url: website, education, experience, talents,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success('CV actualizado');
    } catch { toast.error('Error al guardar'); }
    finally { setSaving(false); }
  };

  // ── Talentos ──────────────────────────────────────────────────────────────
  const addTalent = () => {
    const key = newTalent.trim();
    if (!key || talents.some((t) => t.key === key)) return;
    setTalents([...talents, { key, education: [], experience: [] }]);
    setNewTalent('');
  };
  const removeTalent = (i: number) => setTalents(talents.filter((_, k) => k !== i));
  const updateTalent = (i: number, patch: Partial<TalentEntry>) =>
    setTalents(talents.map((t, k) => (k === i ? { ...t, ...patch } : t)));

  // ── Servicios (filas en `services`, guardado inmediato vía API) ────────────
  const addService = async (talent: string) => {
    if (!memberId) return;
    try {
      const res = await fetch(`/api/members/${memberId}/services`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Nuevo servicio', talent }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setServices((s) => [...s, d.data]);
    } catch (e: any) { toast.error(e.message || 'No se pudo crear el servicio'); }
  };
  const patchService = async (id: number, patch: Partial<ServiceRow>) => {
    setServices((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x))); // optimista
    if (!memberId) return;
    try {
      const res = await fetch(`/api/members/${memberId}/services/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error((await res.json()).error);
    } catch (e: any) { toast.error(e.message || 'No se pudo guardar'); }
  };
  const removeService = async (id: number) => {
    setServices((s) => s.filter((x) => x.id !== id));
    if (!memberId) return;
    try { await fetch(`/api/members/${memberId}/services/${id}`, { method: 'DELETE' }); }
    catch { /* noop */ }
  };

  if (!memberId) return null;

  const availableTalents = TALENTOS.filter((t) => !talents.some((x) => x.key === t));

  return (
    <div className="space-y-5">
      {/* Datos base */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        <div className="md:col-span-2 xl:col-span-4 flex flex-col gap-1.5">
          <label className="text-[12px] font-medium text-digi-text" style={mf}>Biografía</label>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Describe tu experiencia…"
            className="field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border rounded-md text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none resize-none" style={mf} />
        </div>
        <PixelInput label="Skills (separados por coma)" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Next.js, PostgreSQL, …" />
        <PixelInput label="Idiomas (separados por coma)" value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="Español, Inglés" />
        <PixelInput label="LinkedIn" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/…" />
        <PixelInput label="Website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
      </div>

      {/* Educación (general) */}
      <SectionEdu title="Educación" items={education} onChange={setEducation} />
      {/* Experiencia (general) */}
      <SectionExp title="Experiencia" items={experience} onChange={setExperience} />

      {/* Talentos */}
      <div className="pt-4 border-t border-digi-border">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h4 className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-digi-text" style={mf}><Sparkles className="w-4 h-4 text-accent" /> Talentos</h4>
          <div className="flex items-center gap-2">
            <select value={newTalent} onChange={(e) => setNewTalent(e.target.value)}
              className="field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border rounded-md text-[12.5px] text-digi-text focus:border-accent focus:outline-none" style={mf}>
              <option value="">— Elegir talento —</option>
              {availableTalents.map((t) => <option key={t} value={t} className="bg-digi-darker">{t}</option>)}
            </select>
            <button onClick={addTalent} disabled={!newTalent} className={`${addBtn} disabled:opacity-40`} style={mf}><Plus className="w-3.5 h-3.5" /> Agregar talento</button>
          </div>
        </div>
        {talents.length === 0 && <p className="text-[12px] text-digi-muted/60" style={mf}>Aún no agregas talentos. Cada talento tiene su educación, experiencia y servicios.</p>}
        <div className="space-y-4">
          {talents.map((t, i) => (
            <div key={t.key} className="rounded-xl border border-digi-border bg-digi-card p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent" style={mf}><Sparkles className="w-3.5 h-3.5" /> {t.key}</span>
                <button onClick={() => removeTalent(i)} className="text-digi-muted hover:text-red-600 inline-flex items-center gap-1 text-[11.5px]" style={mf}><Trash2 className="w-3.5 h-3.5" /> Quitar talento</button>
              </div>
              <div className="space-y-4">
                <SectionEdu title="Educación" items={t.education} onChange={(v) => updateTalent(i, { education: v })} nested />
                <SectionExp title="Experiencia" items={t.experience} onChange={(v) => updateTalent(i, { experience: v })} nested />
                {/* Servicios del talento */}
                <div className="pt-3 border-t border-digi-border">
                  <div className="flex items-center justify-between mb-2.5">
                    <h5 className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-digi-text" style={mf}><Wrench className="w-3.5 h-3.5 text-accent" /> Servicios</h5>
                    <button onClick={() => addService(t.key)} className={addBtn} style={mf}><Plus className="w-3.5 h-3.5" /> Agregar servicio</button>
                  </div>
                  {services.filter((s) => s.talent === t.key).length === 0 && (
                    <p className="text-[12px] text-digi-muted/60" style={mf}>Sin servicios. Agrega los servicios que ofreces con este talento.</p>
                  )}
                  <div className="space-y-2">
                    {services.filter((s) => s.talent === t.key).map((s) => (
                      <div key={s.id} className={`rounded-lg border p-2.5 grid grid-cols-1 sm:grid-cols-[1fr_1.4fr_120px_auto_auto] gap-2 items-end ${s.is_active ? 'border-digi-border bg-digi-darker/40' : 'border-digi-border/60 bg-digi-darker/20 opacity-70'}`}>
                        <PixelInput label="Nombre" value={s.name} onChange={(e) => patchService(s.id, { name: e.target.value })} />
                        <PixelInput label="Descripción" value={s.description || ''} onChange={(e) => patchService(s.id, { description: e.target.value })} />
                        <PixelInput label="Precio (USD)" type="number" value={s.base_price ?? ''} onChange={(e) => patchService(s.id, { base_price: e.target.value })} />
                        <label className="flex items-center gap-1.5 text-[11.5px] text-digi-text cursor-pointer pb-2" style={mf} title="Activo (visible al crear tickets)">
                          <input type="checkbox" checked={s.is_active} onChange={(e) => patchService(s.id, { is_active: e.target.checked })} className="accent-accent" /> Activo
                        </label>
                        <button onClick={() => removeService(s.id)} title="Eliminar servicio" className="pb-1.5 text-digi-muted hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className={`${BTN_PRIMARY} w-full sm:w-auto`}>
          <Save className="w-4 h-4" /> {saving ? 'Guardando…' : 'Guardar CV'}
        </button>
      </div>
    </div>
  );
}

/* ── Editores reusables (globales y por talento) ────────────────────────────── */
function SectionEdu({ title, items, onChange, nested = false }: { title: string; items: EduEntry[]; onChange: (v: EduEntry[]) => void; nested?: boolean }) {
  return (
    <div className={nested ? '' : 'pt-4 border-t border-digi-border'}>
      <div className="flex items-center justify-between mb-2.5">
        <h4 className={`inline-flex items-center gap-1.5 ${nested ? 'text-[12.5px]' : 'text-[13px]'} font-semibold text-digi-text`} style={mf}><GraduationCap className="w-4 h-4 text-accent" /> {title}</h4>
        <button onClick={() => onChange([...items, emptyEdu()])} className={addBtn} style={mf}><Plus className="w-3.5 h-3.5" /> Agregar</button>
      </div>
      {items.length === 0 && <p className="text-[12px] text-digi-muted/60" style={mf}>Sin formación registrada.</p>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        {items.map((edu, i) => (
          <div key={i} className="relative rounded-lg border border-digi-border bg-digi-darker p-3 grid grid-cols-2 gap-2">
            <button onClick={() => onChange(items.filter((_, k) => k !== i))} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-digi-card border border-digi-border flex items-center justify-center text-digi-muted hover:text-red-600 hover:border-red-300 transition-colors" title="Quitar"><Trash2 className="w-3.5 h-3.5" /></button>
            <PixelInput label="Institución" value={edu.institution} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], institution: e.target.value }; onChange(n); }} />
            <PixelInput label="Título" value={edu.degree} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], degree: e.target.value }; onChange(n); }} />
            <PixelInput label="Campo" value={edu.field} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], field: e.target.value }; onChange(n); }} />
            <div className="flex gap-2">
              <PixelInput label="Inicio" value={edu.start_year} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], start_year: e.target.value }; onChange(n); }} placeholder="2020" />
              <PixelInput label="Fin" value={edu.end_year} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], end_year: e.target.value }; onChange(n); }} placeholder="2024" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionExp({ title, items, onChange, nested = false }: { title: string; items: ExpEntry[]; onChange: (v: ExpEntry[]) => void; nested?: boolean }) {
  return (
    <div className={nested ? '' : 'pt-4 border-t border-digi-border'}>
      <div className="flex items-center justify-between mb-2.5">
        <h4 className={`inline-flex items-center gap-1.5 ${nested ? 'text-[12.5px]' : 'text-[13px]'} font-semibold text-digi-text`} style={mf}><Briefcase className="w-4 h-4 text-accent" /> {title}</h4>
        <button onClick={() => onChange([...items, emptyExp()])} className={addBtn} style={mf}><Plus className="w-3.5 h-3.5" /> Agregar</button>
      </div>
      {items.length === 0 && <p className="text-[12px] text-digi-muted/60" style={mf}>Sin experiencia registrada.</p>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        {items.map((exp, i) => (
          <div key={i} className="relative rounded-lg border border-digi-border bg-digi-darker p-3 grid grid-cols-2 gap-2">
            <button onClick={() => onChange(items.filter((_, k) => k !== i))} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-digi-card border border-digi-border flex items-center justify-center text-digi-muted hover:text-red-600 hover:border-red-300 transition-colors" title="Quitar"><Trash2 className="w-3.5 h-3.5" /></button>
            <PixelInput label="Empresa" value={exp.company} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], company: e.target.value }; onChange(n); }} />
            <PixelInput label="Cargo" value={exp.position} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], position: e.target.value }; onChange(n); }} />
            <div className="col-span-2"><PixelInput label="Descripción" value={exp.description} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], description: e.target.value }; onChange(n); }} /></div>
            <PixelInput label="Inicio" value={exp.start_year} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], start_year: e.target.value }; onChange(n); }} placeholder="2020" />
            <PixelInput label="Fin" value={exp.end_year} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], end_year: e.target.value }; onChange(n); }} placeholder="Actual" />
          </div>
        ))}
      </div>
    </div>
  );
}

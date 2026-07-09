'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import PixelInput from '@/components/ui/PixelInput';
import PixelModal from '@/components/ui/PixelModal';
import PixelConfirm from '@/components/ui/PixelConfirm';
import MultiSelectSearch from '@/components/ui/MultiSelectSearch';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { money } from '@/lib/format';
import { TALENTOS } from '@/lib/centralized/talentos';
import { Plus, Trash2, Pencil, GraduationCap, Briefcase, Save, Sparkles, Wrench, Tag, X, Search, Loader2, Check } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

// Idiomas para el multiselector (evita escribirlos a mano).
const LANGUAGES = ['Español', 'Inglés', 'Portugués', 'Francés', 'Italiano', 'Alemán', 'Chino (Mandarín)', 'Japonés', 'Coreano', 'Ruso', 'Árabe', 'Kichwa', 'Catalán', 'Neerlandés', 'Hindi'];
const LANG_OPTIONS = LANGUAGES.map((l) => ({ value: l, label: l }));

interface EduEntry { institution: string; degree: string; field: string; start_year: string; end_year: string; }
interface ExpEntry { company: string; position: string; description: string; start_year: string; end_year: string; }
interface TalentEntry { key: string; education: EduEntry[]; experience: ExpEntry[]; }
interface ServiceRow { id: number; name: string; description: string | null; base_price: string | number | null; is_active: boolean; talent: string | null; }
interface ServiceDraft { name: string; description: string; base_price: string; is_active: boolean; }

const emptyEdu = (): EduEntry => ({ institution: '', degree: '', field: '', start_year: '', end_year: '' });
const emptyExp = (): ExpEntry => ({ company: '', position: '', description: '', start_year: '', end_year: '' });
const emptySvc = (): ServiceDraft => ({ name: '', description: '', base_price: '', is_active: true });

const addBtn = 'inline-flex items-center gap-1 text-[12px] font-medium text-digi-muted border border-dashed border-digi-border rounded-md px-2 py-1 hover:border-accent hover:text-accent transition-colors';

// Rango de años "2020 – 2024" (omite guion si falta un extremo, vacío si faltan ambos).
const yearRange = (a?: string, b?: string) => (a || b ? [a, b].filter(Boolean).join(' – ') : '');

/** Editor de CV del miembro (corp). Autónomo: usa el member_id del usuario actual.
 *  Incluye una sección de TALENTOS: cada talento con su educación, experiencia y servicios
 *  propios; los servicios activos son los que se pueden elegir al crear un ticket.
 *  Educación/experiencia/servicios se muestran como LISTA compacta; agregar/editar abre un
 *  formulario en modal (panel lateral) para no ocupar espacio con formularios inline. */
export default function CvPanel() {
  const { user } = useAuth();
  const memberId = user?.member_id;
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [linkedin, setLinkedin] = useState('');
  const [website, setWebsite] = useState('');
  // Educación/experiencia GLOBALES ya no se editan (cada talento tiene la suya); se
  // conservan en estado para no perder datos previos al guardar.
  const [education, setEducation] = useState<EduEntry[]>([]);
  const [experience, setExperience] = useState<ExpEntry[]>([]);
  const [talents, setTalents] = useState<TalentEntry[]>([]);
  const [activeTalent, setActiveTalent] = useState(0); // índice de la pestaña de talento activa
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [saving, setSaving] = useState(false);
  // Modal para gestionar skills una por una (sin comas).
  const [skillsModal, setSkillsModal] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const [confirmDelTalent, setConfirmDelTalent] = useState<number | null>(null);
  // Formularios en modal (educación/experiencia del talento activo + servicios).
  const [eduForm, setEduForm] = useState<{ idx: number | null; draft: EduEntry } | null>(null);
  const [expForm, setExpForm] = useState<{ idx: number | null; draft: ExpEntry } | null>(null);
  const [svcForm, setSvcForm] = useState<{ id: number | null; draft: ServiceDraft } | null>(null);
  // Bloquea el cierre del modal activo mientras un formulario está guardando.
  const [modalBusy, setModalBusy] = useState(false);

  useEffect(() => {
    if (!memberId) return;
    fetch(`/api/members/${memberId}/cv`).then((r) => r.json()).then((data) => {
      if (!data.cv) return;
      setBio(data.cv.bio || '');
      setSkills(Array.isArray(data.cv.skills) ? data.cv.skills : []);
      setLanguages(Array.isArray(data.cv.languages) ? data.cv.languages : []);
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
          skills,
          languages,
          linkedin_url: linkedin, website_url: website, education, experience, talents,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success('CV actualizado');
    } catch { toast.error('Error al guardar'); }
    finally { setSaving(false); }
  };

  // ── Skills ────────────────────────────────────────────────────────────────
  const addSkill = () => {
    const s = newSkill.trim();
    if (!s || skills.includes(s)) { setNewSkill(''); return; }
    setSkills([...skills, s]);
    setNewSkill('');
  };

  // ── Talentos ──────────────────────────────────────────────────────────────
  const addTalent = (key: string) => {
    if (!key || talents.some((t) => t.key === key)) return;
    setTalents([...talents, { key, education: [], experience: [] }]);
    setActiveTalent(talents.length); // abre la pestaña del talento recién agregado
  };
  const removeTalent = (i: number) => {
    const key = talents[i]?.key;
    setTalents(talents.filter((_, k) => k !== i));
    setActiveTalent((cur) => (i <= cur ? Math.max(0, cur - 1) : cur));
    // Elimina también los servicios asociados a ese talento (filas en DB).
    const toDelete = services.filter((s) => s.talent === key);
    setServices((s) => s.filter((x) => x.talent !== key));
    if (memberId) for (const s of toDelete) fetch(`/api/members/${memberId}/services/${s.id}`, { method: 'DELETE' }).catch(() => {});
  };
  const updateTalent = (i: number, patch: Partial<TalentEntry>) =>
    setTalents((prev) => prev.map((t, k) => (k === i ? { ...t, ...patch } : t)));

  // ── Educación / Experiencia del talento activo (guardadas desde el modal) ──
  const saveEdu = (activeIdx: number) => {
    if (!eduForm) return;
    const list = [...(talents[activeIdx]?.education || [])];
    if (eduForm.idx === null) list.push(eduForm.draft); else list[eduForm.idx] = eduForm.draft;
    updateTalent(activeIdx, { education: list });
    // El cierre del modal lo gestiona FormShell tras mostrar la confirmación.
  };
  const removeEdu = (activeIdx: number, i: number) =>
    updateTalent(activeIdx, { education: (talents[activeIdx]?.education || []).filter((_, k) => k !== i) });
  const saveExp = (activeIdx: number) => {
    if (!expForm) return;
    const list = [...(talents[activeIdx]?.experience || [])];
    if (expForm.idx === null) list.push(expForm.draft); else list[expForm.idx] = expForm.draft;
    updateTalent(activeIdx, { experience: list });
    // El cierre del modal lo gestiona FormShell tras mostrar la confirmación.
  };
  const removeExp = (activeIdx: number, i: number) =>
    updateTalent(activeIdx, { experience: (talents[activeIdx]?.experience || []).filter((_, k) => k !== i) });

  // ── Servicios (filas en `services`, guardado inmediato vía API) ────────────
  const saveService = async (talent: string) => {
    if (!memberId || !svcForm) return;
    const name = svcForm.draft.name.trim();
    if (!name) { toast.error('El nombre del servicio es requerido'); return; }
    const body = {
      name,
      description: svcForm.draft.description.trim() || null,
      base_price: svcForm.draft.base_price,
      is_active: svcForm.draft.is_active,
      talent,
    };
    try {
      if (svcForm.id === null) {
        const res = await fetch(`/api/members/${memberId}/services`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        setServices((s) => [...s, d.data]);
      } else {
        const id = svcForm.id;
        const res = await fetch(`/api/members/${memberId}/services/${id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        setServices((s) => s.map((x) => (x.id === id ? d.data : x)));
      }
      // El cierre del modal lo gestiona FormShell tras mostrar la confirmación.
    } catch (e: any) {
      toast.error(e.message || 'No se pudo guardar el servicio');
      throw e; // relanza para que FormShell mantenga el modal abierto y permita reintentar
    }
  };
  const removeService = async (id: number) => {
    setServices((s) => s.filter((x) => x.id !== id));
    if (!memberId) return;
    try { await fetch(`/api/members/${memberId}/services/${id}`, { method: 'DELETE' }); }
    catch { /* noop */ }
  };

  if (!memberId) return null;

  const availableTalents = TALENTOS
    .filter((t) => !talents.some((x) => x.key === t))
    .sort((a, b) => a.localeCompare(b, 'es'));
  const activeIdx = talents.length ? Math.min(activeTalent, talents.length - 1) : 0;

  return (
    <div className="space-y-5">
      {/* Datos base */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        <div className="md:col-span-2 xl:col-span-4 flex flex-col gap-1.5">
          <label className="text-[12px] font-medium text-digi-text" style={mf}>Biografía</label>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Describe tu experiencia…"
            className="field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border rounded-md text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none resize-none" style={mf} />
        </div>
        {/* Skills — chips gestionados en un modal (una por una, sin comas) */}
        <div>
          <label className="text-[12px] font-medium text-digi-text mb-1 inline-flex items-center gap-1.5" style={mf}><Tag className="w-3.5 h-3.5 text-accent" /> Skills</label>
          <button type="button" onClick={() => setSkillsModal(true)}
            className="field-control w-full min-h-[42px] px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border rounded-md text-left flex flex-wrap gap-1.5 items-center hover:border-accent transition-colors" style={mf}>
            {skills.length === 0
              ? <span className="text-[13px] text-digi-muted/50">Agregar skills…</span>
              : skills.map((s) => <span key={s} className="text-[11px] px-1.5 py-0.5 rounded bg-accent-light text-accent">{s}</span>)}
          </button>
        </div>
        {/* Idiomas — multiselección */}
        <div>
          <label className="text-[12px] font-medium text-digi-text mb-1 block" style={mf}>Idiomas</label>
          <MultiSelectSearch options={LANG_OPTIONS} selected={languages} onChange={setLanguages} placeholder="Elegir idiomas…" />
        </div>
        <PixelInput label="LinkedIn" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/…" />
        <PixelInput label="Website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
      </div>

      {/* Talentos */}
      <div className="pt-4 border-t border-digi-border">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h4 className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-digi-text" style={mf}><Sparkles className="w-4 h-4 text-accent" /> Talentos</h4>
          <div className="w-full sm:w-[280px]">
            <TalentPicker options={availableTalents} onPick={addTalent} />
          </div>
        </div>
        {talents.length === 0 ? (
          <p className="text-[12px] text-digi-muted/60" style={mf}>Aún no agregas talentos. Cada talento tiene su educación, experiencia y servicios.</p>
        ) : (() => {
          const t = talents[activeIdx];
          const talentServices = services.filter((s) => s.talent === t.key);
          return (
            <div className="rounded-xl border border-digi-border bg-digi-card overflow-hidden">
              {/* Pestañas horizontales: una por talento, con su icono de eliminar */}
              <div className="flex items-stretch border-b border-digi-border overflow-x-auto">
                {talents.map((tt, i) => {
                  const active = i === activeIdx;
                  return (
                    <div key={tt.key} onClick={() => setActiveTalent(i)}
                      className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-[12.5px] font-medium border-b-2 -mb-px whitespace-nowrap cursor-pointer transition-colors ${active ? 'border-accent text-accent bg-accent-light/40' : 'border-transparent text-digi-muted hover:text-digi-text'}`} style={mf}>
                      <Sparkles className="w-3.5 h-3.5" /> {tt.key}
                      <button type="button" title="Quitar talento" onClick={(e) => { e.stopPropagation(); setConfirmDelTalent(i); }}
                        className="ml-1 -mr-1 p-0.5 rounded text-digi-muted hover:text-red-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  );
                })}
              </div>

              {/* Contenido del talento seleccionado: listas compactas + agregar en modal */}
              <div className="p-4 space-y-4">
                <ListSection title="Educación" icon={<GraduationCap className="w-4 h-4 text-accent" />}
                  count={t.education.length} emptyText="Sin formación registrada."
                  onAdd={() => setEduForm({ idx: null, draft: emptyEdu() })}>
                  {t.education.map((edu, i) => (
                    <ItemRow key={i}
                      title={edu.degree || edu.institution || 'Formación'}
                      subtitle={[edu.institution, edu.field].filter(Boolean).join(' · ')}
                      meta={yearRange(edu.start_year, edu.end_year)}
                      onEdit={() => setEduForm({ idx: i, draft: { ...edu } })}
                      onRemove={() => removeEdu(activeIdx, i)} />
                  ))}
                </ListSection>

                <ListSection title="Experiencia" icon={<Briefcase className="w-4 h-4 text-accent" />}
                  count={t.experience.length} emptyText="Sin experiencia registrada." topBorder
                  onAdd={() => setExpForm({ idx: null, draft: emptyExp() })}>
                  {t.experience.map((exp, i) => (
                    <ItemRow key={i}
                      title={exp.position || exp.company || 'Experiencia'}
                      subtitle={[exp.company, exp.description].filter(Boolean).join(' · ')}
                      meta={yearRange(exp.start_year, exp.end_year)}
                      onEdit={() => setExpForm({ idx: i, draft: { ...exp } })}
                      onRemove={() => removeExp(activeIdx, i)} />
                  ))}
                </ListSection>

                <ListSection title="Servicios" icon={<Wrench className="w-3.5 h-3.5 text-accent" />}
                  count={talentServices.length} emptyText="Sin servicios. Agrega los servicios que ofreces con este talento." topBorder
                  onAdd={() => setSvcForm({ id: null, draft: emptySvc() })}>
                  {talentServices.map((s) => (
                    <ItemRow key={s.id}
                      title={s.name}
                      subtitle={s.description || ''}
                      meta={money(s.base_price)}
                      badge={s.is_active ? undefined : 'Inactivo'}
                      onEdit={() => setSvcForm({ id: s.id, draft: { name: s.name, description: s.description || '', base_price: s.base_price != null ? String(s.base_price) : '', is_active: s.is_active } })}
                      onRemove={() => removeService(s.id)} />
                  ))}
                </ListSection>
              </div>
            </div>
          );
        })()}
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className={`${BTN_PRIMARY} w-full sm:w-auto`}>
          <Save className="w-4 h-4" /> {saving ? 'Guardando…' : 'Guardar CV'}
        </button>
      </div>

      {/* Confirmación de eliminación de talento. */}
      <PixelConfirm
        open={confirmDelTalent !== null}
        title="Quitar talento"
        message={`¿Quitar el talento "${confirmDelTalent !== null ? talents[confirmDelTalent]?.key : ''}" de tu CV? Se eliminarán su educación, experiencia y servicios asociados.`}
        confirmLabel="Sí, quitar"
        danger
        onConfirm={() => { if (confirmDelTalent !== null) removeTalent(confirmDelTalent); setConfirmDelTalent(null); }}
        onCancel={() => setConfirmDelTalent(null)}
      />

      {/* Modal de skills: se agregan una por una (Enter o botón), como chips. */}
      <PixelModal open={skillsModal} onClose={() => setSkillsModal(false)} title="Skills">
        <div className="space-y-3">
          <p className="text-[12px] text-digi-muted" style={mf}>Agrega tus skills una por una. Pulsa Enter o “Agregar”.</p>
          <div className="flex gap-2">
            <input value={newSkill} onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
              placeholder="Ej. React" autoFocus
              className="field-control flex-1 px-3 py-2 bg-digi-darker border-2 border-digi-border rounded-md text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none" style={mf} />
            <button type="button" onClick={addSkill} disabled={!newSkill.trim()} className={`${BTN_PRIMARY} disabled:opacity-50`}><Plus className="w-4 h-4" /> Agregar</button>
          </div>
          {skills.length === 0 ? (
            <p className="text-[12px] text-digi-muted/60" style={mf}>Aún no agregas skills.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {skills.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 text-[12px] px-2 py-1 rounded-full bg-accent-light text-accent" style={mf}>
                  {s}
                  <button type="button" onClick={() => setSkills(skills.filter((x) => x !== s))} className="hover:text-accent-hover" aria-label={`Quitar ${s}`}><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}
        </div>
      </PixelModal>

      {/* Formulario de Educación (panel modal). */}
      <PixelModal open={!!eduForm} onClose={() => setEduForm(null)} busy={modalBusy} title={eduForm?.idx === null ? 'Agregar educación' : 'Editar educación'}>
        {eduForm && (
          <FormShell onSave={() => saveEdu(activeIdx)} onClose={() => setEduForm(null)} onBusy={setModalBusy}>
            <PixelInput label="Institución" value={eduForm.draft.institution} onChange={(e) => setEduForm({ ...eduForm, draft: { ...eduForm.draft, institution: e.target.value } })} autoFocus />
            <PixelInput label="Título" value={eduForm.draft.degree} onChange={(e) => setEduForm({ ...eduForm, draft: { ...eduForm.draft, degree: e.target.value } })} />
            <PixelInput label="Campo" value={eduForm.draft.field} onChange={(e) => setEduForm({ ...eduForm, draft: { ...eduForm.draft, field: e.target.value } })} />
            <div className="grid grid-cols-2 gap-3">
              <PixelInput label="Año inicio" value={eduForm.draft.start_year} onChange={(e) => setEduForm({ ...eduForm, draft: { ...eduForm.draft, start_year: e.target.value } })} placeholder="2020" />
              <PixelInput label="Año fin" value={eduForm.draft.end_year} onChange={(e) => setEduForm({ ...eduForm, draft: { ...eduForm.draft, end_year: e.target.value } })} placeholder="2024" />
            </div>
          </FormShell>
        )}
      </PixelModal>

      {/* Formulario de Experiencia (panel modal). */}
      <PixelModal open={!!expForm} onClose={() => setExpForm(null)} busy={modalBusy} title={expForm?.idx === null ? 'Agregar experiencia' : 'Editar experiencia'}>
        {expForm && (
          <FormShell onSave={() => saveExp(activeIdx)} onClose={() => setExpForm(null)} onBusy={setModalBusy}>
            <PixelInput label="Empresa" value={expForm.draft.company} onChange={(e) => setExpForm({ ...expForm, draft: { ...expForm.draft, company: e.target.value } })} autoFocus />
            <PixelInput label="Cargo" value={expForm.draft.position} onChange={(e) => setExpForm({ ...expForm, draft: { ...expForm.draft, position: e.target.value } })} />
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-digi-text" style={mf}>Descripción</label>
              <textarea value={expForm.draft.description} onChange={(e) => setExpForm({ ...expForm, draft: { ...expForm.draft, description: e.target.value } })} rows={3} placeholder="Responsabilidades y logros…"
                className="field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border rounded-md text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none resize-none" style={mf} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <PixelInput label="Año inicio" value={expForm.draft.start_year} onChange={(e) => setExpForm({ ...expForm, draft: { ...expForm.draft, start_year: e.target.value } })} placeholder="2020" />
              <PixelInput label="Año fin" value={expForm.draft.end_year} onChange={(e) => setExpForm({ ...expForm, draft: { ...expForm.draft, end_year: e.target.value } })} placeholder="Actual" />
            </div>
          </FormShell>
        )}
      </PixelModal>

      {/* Formulario de Servicio (panel modal). */}
      <PixelModal open={!!svcForm} onClose={() => setSvcForm(null)} busy={modalBusy} title={svcForm?.id === null ? 'Agregar servicio' : 'Editar servicio'}>
        {svcForm && (
          <FormShell onSave={() => saveService(talents[activeIdx]?.key || '')} onClose={() => setSvcForm(null)} onBusy={setModalBusy}>
            <PixelInput label="Nombre" value={svcForm.draft.name} onChange={(e) => setSvcForm({ ...svcForm, draft: { ...svcForm.draft, name: e.target.value } })} placeholder="Ej. Consultoría de marca" autoFocus />
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-digi-text" style={mf}>Descripción</label>
              <textarea value={svcForm.draft.description} onChange={(e) => setSvcForm({ ...svcForm, draft: { ...svcForm.draft, description: e.target.value } })} rows={3} placeholder="Qué incluye el servicio…"
                className="field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border rounded-md text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none resize-none" style={mf} />
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <PixelInput label="Precio (USD)" type="number" value={svcForm.draft.base_price} onChange={(e) => setSvcForm({ ...svcForm, draft: { ...svcForm.draft, base_price: e.target.value } })} placeholder="0,00" />
              <label className="flex items-center gap-2 text-[13px] text-digi-text cursor-pointer pb-2.5" style={mf} title="Activo: visible al crear tickets">
                <input type="checkbox" checked={svcForm.draft.is_active} onChange={(e) => setSvcForm({ ...svcForm, draft: { ...svcForm.draft, is_active: e.target.checked } })} className="accent-accent w-4 h-4" /> Activo (visible al crear tickets)
              </label>
            </div>
          </FormShell>
        )}
      </PixelModal>
    </div>
  );
}

/* ── Encabezado de sección con botón "Agregar" ─────────────────────────────── */
function ListSection({ title, icon, count, emptyText, topBorder = false, onAdd, children }: {
  title: string; icon: React.ReactNode; count: number; emptyText: string; topBorder?: boolean; onAdd: () => void; children: React.ReactNode;
}) {
  return (
    <div className={topBorder ? 'pt-3 border-t border-digi-border' : ''}>
      <div className="flex items-center justify-between mb-2.5">
        <h5 className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-digi-text" style={mf}>{icon} {title}</h5>
        <button type="button" onClick={onAdd} className={addBtn} style={mf}><Plus className="w-3.5 h-3.5" /> Agregar</button>
      </div>
      {count === 0 ? (
        <p className="text-[12px] text-digi-muted/60" style={mf}>{emptyText}</p>
      ) : (
        <div className="space-y-1.5">{children}</div>
      )}
    </div>
  );
}

/* ── Fila compacta de un ítem agregado (clic = editar; con acciones) ────────── */
function ItemRow({ title, subtitle, meta, badge, onEdit, onRemove }: {
  title: string; subtitle?: string; meta?: string; badge?: string; onEdit: () => void; onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-digi-border bg-digi-darker/40 pl-3 pr-1.5 py-1.5 hover:border-accent/60 transition-colors">
      <button type="button" onClick={onEdit} className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-1.5">
          <p className="text-[13px] font-medium text-digi-text truncate" style={mf}>{title}</p>
          {badge && <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-digi-border/60 text-digi-muted" style={mf}>{badge}</span>}
        </div>
        {subtitle && <p className="text-[11.5px] text-digi-muted truncate" style={mf}>{subtitle}</p>}
      </button>
      {meta && <span className="shrink-0 text-[11.5px] text-digi-muted whitespace-nowrap tabular-nums" style={mf}>{meta}</span>}
      <button type="button" onClick={onEdit} title="Editar" className="shrink-0 p-1.5 rounded text-digi-muted hover:text-accent transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
      <button type="button" onClick={onRemove} title="Eliminar" className="shrink-0 p-1.5 rounded text-digi-muted hover:text-red-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
    </div>
  );
}

/* ── Contenedor de formulario en modal: campos + pie con Cancelar/Guardar ─────
 * Gestiona el ciclo de guardado con feedback visible:
 *   idle → saving (spinner "Guardando…") → done (check "¡Guardado!") → cierra solo.
 * `onSave` puede ser async y debe LANZAR si falla (así el modal se mantiene abierto
 * para reintentar). El cierre lo dispara este componente, no `onSave`. */
function FormShell({ onSave, onClose, onBusy, children }: {
  onSave: () => void | Promise<unknown>;
  onClose: () => void;
  onBusy?: (busy: boolean) => void;
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'done'>('idle');
  const busy = status !== 'idle';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setStatus('saving');
    onBusy?.(true);
    try {
      await onSave();
      setStatus('done'); // muestra la confirmación un instante antes de cerrar
      setTimeout(() => { onBusy?.(false); onClose(); }, 750);
    } catch {
      setStatus('idle');  // el error ya se notificó (toast); permite reintentar
      onBusy?.(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {/* fieldset con display:contents deshabilita los campos sin alterar el layout */}
      <fieldset disabled={busy} className="contents">{children}</fieldset>
      <div className="flex justify-end gap-2 pt-2 mt-1 border-t border-digi-border">
        <button type="button" onClick={onClose} disabled={busy} className={BTN_SECONDARY}>Cancelar</button>
        <button
          type="submit"
          disabled={busy}
          aria-live="polite"
          className={`${BTN_PRIMARY} min-w-[7.5rem] ${status === 'done' ? '!bg-emerald-600 hover:!bg-emerald-600 !opacity-100' : ''}`}
        >
          {status === 'saving' ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>
          ) : status === 'done' ? (
            <><Check className="w-4 h-4" /> ¡Guardado!</>
          ) : (
            <><Save className="w-4 h-4" /> Guardar</>
          )}
        </button>
      </div>
    </form>
  );
}

/* ── Selector de talento con buscador ───────────────────────────────────────── */
function TalentPicker({ options, onPick }: { options: string[]; onPick: (t: string) => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const filtered = options.filter((t) => t.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="w-4 h-4 text-digi-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          placeholder="Buscar y elegir talento…"
          className="w-full pl-8 pr-3 py-2 bg-digi-darker border-2 border-digi-border rounded-md text-[13px] text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none" style={mf} />
      </div>
      {open && (
        <div className="absolute z-20 top-full mt-1 w-full max-h-56 overflow-y-auto rounded-md border-2 border-digi-border bg-digi-card shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-3 py-3 text-[12px] text-digi-muted" style={mf}>Sin talentos disponibles.</p>
          ) : filtered.map((t) => (
            <button key={t} type="button" onClick={() => { onPick(t); setQ(''); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-[12.5px] text-digi-text hover:bg-black/[0.03] transition-colors" style={mf}>{t}</button>
          ))}
        </div>
      )}
    </div>
  );
}

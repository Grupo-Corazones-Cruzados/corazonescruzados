'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import PixelInput from '@/components/ui/PixelInput';
import { BTN_PRIMARY } from '@/components/ui/Button';
import { FileText, Plus, Trash2, GraduationCap, Briefcase, Save } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

interface EduEntry { institution: string; degree: string; field: string; start_year: string; end_year: string; }
interface ExpEntry { company: string; position: string; description: string; start_year: string; end_year: string; }

/** Editor de CV del miembro (corp). Autónomo: usa el member_id del usuario actual.
 *  Se usa como panel dentro de Perfil (Configuración) y en la subpágina /settings/cv. */
export default function CvPanel({ className = '' }: { className?: string }) {
  const { user } = useAuth();
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState('');
  const [languages, setLanguages] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [website, setWebsite] = useState('');
  const [education, setEducation] = useState<EduEntry[]>([]);
  const [experience, setExperience] = useState<ExpEntry[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.member_id) return;
    fetch(`/api/members/${user.member_id}/cv`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.cv) return;
        setBio(data.cv.bio || '');
        setSkills((data.cv.skills || []).join(', '));
        setLanguages((data.cv.languages || []).join(', '));
        setLinkedin(data.cv.linkedin_url || '');
        setWebsite(data.cv.website_url || '');
        setEducation(data.cv.education || []);
        setExperience(data.cv.experience || []);
      })
      .catch(() => {});
  }, [user?.member_id]);

  const save = async () => {
    if (!user?.member_id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/members/${user.member_id}/cv`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bio,
          skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
          languages: languages.split(',').map((s) => s.trim()).filter(Boolean),
          linkedin_url: linkedin, website_url: website, education, experience,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success('CV actualizado');
    } catch { toast.error('Error al guardar'); }
    finally { setSaving(false); }
  };

  if (!user?.member_id) return null;

  const addBtn = 'inline-flex items-center gap-1 text-[12px] font-medium text-digi-muted border border-dashed border-digi-border rounded-md px-2 py-1 hover:border-accent hover:text-accent transition-colors';
  const labelCls = 'text-[12px] font-medium text-digi-text';

  return (
    <div className={`bg-digi-card border border-digi-border rounded-xl shadow-sm overflow-hidden ${className}`}>
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-digi-border">
        <div className="w-8 h-8 rounded-lg bg-accent-light flex items-center justify-center shrink-0"><FileText className="w-4 h-4 text-accent" /></div>
        <div>
          <h3 className="text-[14px] font-semibold text-digi-text leading-tight" style={mf}>Mi CV</h3>
          <p className="text-[11px] text-digi-muted" style={mf}>Tu currículum para proyectos y portafolio</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex flex-col gap-1.5">
          <label className={labelCls} style={mf}>Biografía</label>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Describe tu experiencia…"
            className="field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border rounded-md text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none resize-none" style={mf} />
        </div>
        <PixelInput label="Skills (separados por coma)" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Next.js, PostgreSQL, …" />
        <PixelInput label="Idiomas (separados por coma)" value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="Español, Inglés" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <PixelInput label="LinkedIn" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/…" />
          <PixelInput label="Website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
        </div>

        {/* Educación */}
        <div className="pt-3 border-t border-digi-border">
          <div className="flex items-center justify-between mb-2.5">
            <h4 className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-digi-text" style={mf}><GraduationCap className="w-4 h-4 text-accent" /> Educación</h4>
            <button onClick={() => setEducation([...education, { institution: '', degree: '', field: '', start_year: '', end_year: '' }])} className={addBtn} style={mf}><Plus className="w-3.5 h-3.5" /> Agregar</button>
          </div>
          {education.length === 0 && <p className="text-[12px] text-digi-muted/60" style={mf}>Sin formación registrada.</p>}
          <div className="space-y-3">
            {education.map((edu, i) => (
              <div key={i} className="relative rounded-lg border border-digi-border bg-digi-darker p-3 grid grid-cols-2 gap-2">
                <button onClick={() => setEducation(education.filter((_, k) => k !== i))} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-digi-card border border-digi-border flex items-center justify-center text-digi-muted hover:text-red-600 hover:border-red-300 transition-colors" title="Quitar"><Trash2 className="w-3.5 h-3.5" /></button>
                <PixelInput label="Institución" value={edu.institution} onChange={(e) => { const n = [...education]; n[i].institution = e.target.value; setEducation(n); }} />
                <PixelInput label="Título" value={edu.degree} onChange={(e) => { const n = [...education]; n[i].degree = e.target.value; setEducation(n); }} />
                <PixelInput label="Campo" value={edu.field} onChange={(e) => { const n = [...education]; n[i].field = e.target.value; setEducation(n); }} />
                <div className="flex gap-2">
                  <PixelInput label="Inicio" value={edu.start_year} onChange={(e) => { const n = [...education]; n[i].start_year = e.target.value; setEducation(n); }} placeholder="2020" />
                  <PixelInput label="Fin" value={edu.end_year} onChange={(e) => { const n = [...education]; n[i].end_year = e.target.value; setEducation(n); }} placeholder="2024" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Experiencia */}
        <div className="pt-3 border-t border-digi-border">
          <div className="flex items-center justify-between mb-2.5">
            <h4 className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-digi-text" style={mf}><Briefcase className="w-4 h-4 text-accent" /> Experiencia</h4>
            <button onClick={() => setExperience([...experience, { company: '', position: '', description: '', start_year: '', end_year: '' }])} className={addBtn} style={mf}><Plus className="w-3.5 h-3.5" /> Agregar</button>
          </div>
          {experience.length === 0 && <p className="text-[12px] text-digi-muted/60" style={mf}>Sin experiencia registrada.</p>}
          <div className="space-y-3">
            {experience.map((exp, i) => (
              <div key={i} className="relative rounded-lg border border-digi-border bg-digi-darker p-3 grid grid-cols-2 gap-2">
                <button onClick={() => setExperience(experience.filter((_, k) => k !== i))} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-digi-card border border-digi-border flex items-center justify-center text-digi-muted hover:text-red-600 hover:border-red-300 transition-colors" title="Quitar"><Trash2 className="w-3.5 h-3.5" /></button>
                <PixelInput label="Empresa" value={exp.company} onChange={(e) => { const n = [...experience]; n[i].company = e.target.value; setExperience(n); }} />
                <PixelInput label="Cargo" value={exp.position} onChange={(e) => { const n = [...experience]; n[i].position = e.target.value; setExperience(n); }} />
                <div className="col-span-2"><PixelInput label="Descripción" value={exp.description} onChange={(e) => { const n = [...experience]; n[i].description = e.target.value; setExperience(n); }} /></div>
                <PixelInput label="Inicio" value={exp.start_year} onChange={(e) => { const n = [...experience]; n[i].start_year = e.target.value; setExperience(n); }} placeholder="2020" />
                <PixelInput label="Fin" value={exp.end_year} onChange={(e) => { const n = [...experience]; n[i].end_year = e.target.value; setExperience(n); }} placeholder="Actual" />
              </div>
            ))}
          </div>
        </div>

        <button onClick={save} disabled={saving} className={`${BTN_PRIMARY} w-full`}>
          <Save className="w-4 h-4" /> {saving ? 'Guardando…' : 'Guardar CV'}
        </button>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import PageHeader from '@/components/ui/PageHeader';
import PixelInput from '@/components/ui/PixelInput';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;

interface EduEntry { institution: string; degree: string; field: string; start_year: string; end_year: string; }
interface ExpEntry { company: string; position: string; description: string; start_year: string; end_year: string; }

export default function CvPage() {
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
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bio,
          skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
          languages: languages.split(',').map((s) => s.trim()).filter(Boolean),
          linkedin_url: linkedin,
          website_url: website,
          education,
          experience,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success('CV actualizado');
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (!user?.member_id) {
    return (
      <div className="pixel-card text-center py-12">
        <p className="pixel-heading text-sm text-digi-muted">Solo disponible para miembros</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Mi CV" description="Edita tu curriculum vitae" />

      <div className="space-y-4">
        <div className="pixel-card space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-accent-glow opacity-70" style={pf}>Biografia</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none resize-none"
              style={mf}
              placeholder="Describe tu experiencia..."
            />
          </div>
          <PixelInput label="Skills (separados por coma)" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Next.js, PostgreSQL, ..." />
          <PixelInput label="Idiomas (separados por coma)" value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="Español, Inglés" />
          <PixelInput label="LinkedIn URL" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/..." />
          <PixelInput label="Website URL" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
        </div>

        {/* Education */}
        <div className="pixel-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] text-accent-glow" style={pf}>Educacion</h3>
            <button
              onClick={() => setEducation([...education, { institution: '', degree: '', field: '', start_year: '', end_year: '' }])}
              className="text-[9px] text-accent-glow border border-accent/30 px-2 py-1 hover:bg-accent/10 transition-colors"
              style={pf}
            >
              + Agregar
            </button>
          </div>
          {education.map((edu, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 mb-3 pb-3 border-b border-digi-border/50 last:border-0">
              <PixelInput label="Institucion" value={edu.institution} onChange={(e) => { const n = [...education]; n[i].institution = e.target.value; setEducation(n); }} />
              <PixelInput label="Titulo" value={edu.degree} onChange={(e) => { const n = [...education]; n[i].degree = e.target.value; setEducation(n); }} />
              <PixelInput label="Campo" value={edu.field} onChange={(e) => { const n = [...education]; n[i].field = e.target.value; setEducation(n); }} />
              <div className="flex gap-2">
                <PixelInput label="Inicio" value={edu.start_year} onChange={(e) => { const n = [...education]; n[i].start_year = e.target.value; setEducation(n); }} placeholder="2020" />
                <PixelInput label="Fin" value={edu.end_year} onChange={(e) => { const n = [...education]; n[i].end_year = e.target.value; setEducation(n); }} placeholder="2024" />
              </div>
            </div>
          ))}
        </div>

        {/* Experience */}
        <div className="pixel-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] text-accent-glow" style={pf}>Experiencia</h3>
            <button
              onClick={() => setExperience([...experience, { company: '', position: '', description: '', start_year: '', end_year: '' }])}
              className="text-[9px] text-accent-glow border border-accent/30 px-2 py-1 hover:bg-accent/10 transition-colors"
              style={pf}
            >
              + Agregar
            </button>
          </div>
          {experience.map((exp, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 mb-3 pb-3 border-b border-digi-border/50 last:border-0">
              <PixelInput label="Empresa" value={exp.company} onChange={(e) => { const n = [...experience]; n[i].company = e.target.value; setExperience(n); }} />
              <PixelInput label="Cargo" value={exp.position} onChange={(e) => { const n = [...experience]; n[i].position = e.target.value; setExperience(n); }} />
              <div className="col-span-2">
                <PixelInput label="Descripcion" value={exp.description} onChange={(e) => { const n = [...experience]; n[i].description = e.target.value; setExperience(n); }} />
              </div>
              <PixelInput label="Inicio" value={exp.start_year} onChange={(e) => { const n = [...experience]; n[i].start_year = e.target.value; setExperience(n); }} placeholder="2020" />
              <PixelInput label="Fin" value={exp.end_year} onChange={(e) => { const n = [...experience]; n[i].end_year = e.target.value; setExperience(n); }} placeholder="Actual" />
            </div>
          ))}
        </div>

        <button onClick={save} disabled={saving} className="pixel-btn pixel-btn-primary w-full disabled:opacity-50">
          {saving ? 'Guardando...' : 'Guardar CV'}
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import type { MemberCvProfile } from "@/lib/types";
import styles from "./page.module.css";

interface EducationEntry {
  institution: string;
  degree: string;
  field: string;
  start_year: string;
  end_year: string;
}

interface ExperienceEntry {
  company: string;
  position: string;
  description: string;
  start_year: string;
  end_year: string;
}

const emptyEducation: EducationEntry = {
  institution: "",
  degree: "",
  field: "",
  start_year: "",
  end_year: "",
};

const emptyExperience: ExperienceEntry = {
  company: "",
  position: "",
  description: "",
  start_year: "",
  end_year: "",
};

export default function CvEditorPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [bio, setBio] = useState("");
  const [skillsText, setSkillsText] = useState("");
  const [languagesText, setLanguagesText] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [education, setEducation] = useState<EducationEntry[]>([]);
  const [experience, setExperience] = useState<ExperienceEntry[]>([]);

  const memberId = user?.member_id;

  const loadProfile = useCallback(async () => {
    if (!memberId) return;
    try {
      const res = await fetch(`/api/members/${memberId}/cv`);
      const json = await res.json();
      const p: MemberCvProfile | null = json.data;
      if (p) {
        setBio(p.bio || "");
        setSkillsText((p.skills || []).join(", "));
        setLanguagesText((p.languages || []).join(", "));
        setLinkedinUrl(p.linkedin_url || "");
        setWebsiteUrl(p.website_url || "");
        setEducation(
          (p.education as EducationEntry[]) || []
        );
        setExperience(
          (p.experience as ExperienceEntry[]) || []
        );
      }
    } catch {
      toast("Error al cargar perfil CV", "error");
    } finally {
      setLoading(false);
    }
  }, [memberId, toast]);

  useEffect(() => {
    if (!authLoading && memberId) loadProfile();
    else if (!authLoading) setLoading(false);
  }, [authLoading, memberId, loadProfile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/members/${memberId}/cv`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bio: bio || null,
          skills: skillsText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          languages: languagesText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          linkedin_url: linkedinUrl || null,
          website_url: websiteUrl || null,
          education,
          experience,
        }),
      });
      if (!res.ok) throw new Error();
      toast("CV actualizado", "success");
    } catch {
      toast("Error al guardar", "error");
    } finally {
      setSaving(false);
    }
  };

  const updateEducation = (idx: number, field: keyof EducationEntry, value: string) => {
    setEducation((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  };

  const updateExperience = (idx: number, field: keyof ExperienceEntry, value: string) => {
    setExperience((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  };

  if (authLoading || loading) {
    return (
      <div className={styles.center}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (!memberId) {
    return (
      <div>
        <PageHeader title="Mi CV" description="Solo disponible para miembros." />
        <Card padding="lg">
          <p>Esta sección solo está disponible para miembros del equipo.</p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Mi CV"
        description="Edita tu perfil profesional y experiencia."
        breadcrumbs={[
          { label: "Configuración", href: "/dashboard/settings" },
          { label: "CV" },
        ]}
      />

      <form onSubmit={handleSave} className={styles.sections}>
        {/* Bio */}
        <Card padding="lg">
          <h3 className={styles.sectionTitle}>Biografía</h3>
          <textarea
            className={styles.textarea}
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Cuéntanos sobre ti..."
          />
        </Card>

        {/* Skills & Languages */}
        <Card padding="lg">
          <h3 className={styles.sectionTitle}>Habilidades e Idiomas</h3>
          <div className={styles.row}>
            <Input
              label="Habilidades"
              value={skillsText}
              onChange={(e) => setSkillsText(e.target.value)}
              placeholder="React, Node.js, Diseño UI..."
              hint="Separadas por coma"
            />
            <Input
              label="Idiomas"
              value={languagesText}
              onChange={(e) => setLanguagesText(e.target.value)}
              placeholder="Español, Inglés..."
              hint="Separados por coma"
            />
          </div>
        </Card>

        {/* Links */}
        <Card padding="lg">
          <h3 className={styles.sectionTitle}>Enlaces</h3>
          <div className={styles.row}>
            <Input
              label="LinkedIn"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/..."
            />
            <Input
              label="Sitio web"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </Card>

        {/* Education */}
        <Card padding="lg">
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Educación</h3>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setEducation((prev) => [...prev, { ...emptyEducation }])}
            >
              + Agregar
            </Button>
          </div>
          {education.length === 0 && (
            <p className={styles.emptyText}>No hay entradas de educación.</p>
          )}
          {education.map((edu, idx) => (
            <div key={idx} className={styles.entryCard}>
              <div className={styles.entryRow}>
                <Input
                  label="Institución"
                  value={edu.institution}
                  onChange={(e) => updateEducation(idx, "institution", e.target.value)}
                />
                <Input
                  label="Título"
                  value={edu.degree}
                  onChange={(e) => updateEducation(idx, "degree", e.target.value)}
                />
              </div>
              <div className={styles.entryRow}>
                <Input
                  label="Campo"
                  value={edu.field}
                  onChange={(e) => updateEducation(idx, "field", e.target.value)}
                />
                <Input
                  label="Año inicio"
                  value={edu.start_year}
                  onChange={(e) => updateEducation(idx, "start_year", e.target.value)}
                  placeholder="2020"
                />
                <Input
                  label="Año fin"
                  value={edu.end_year}
                  onChange={(e) => updateEducation(idx, "end_year", e.target.value)}
                  placeholder="2024"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEducation((prev) => prev.filter((_, i) => i !== idx))}
              >
                Eliminar
              </Button>
            </div>
          ))}
        </Card>

        {/* Experience */}
        <Card padding="lg">
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Experiencia</h3>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setExperience((prev) => [...prev, { ...emptyExperience }])}
            >
              + Agregar
            </Button>
          </div>
          {experience.length === 0 && (
            <p className={styles.emptyText}>No hay entradas de experiencia.</p>
          )}
          {experience.map((exp, idx) => (
            <div key={idx} className={styles.entryCard}>
              <div className={styles.entryRow}>
                <Input
                  label="Empresa"
                  value={exp.company}
                  onChange={(e) => updateExperience(idx, "company", e.target.value)}
                />
                <Input
                  label="Puesto"
                  value={exp.position}
                  onChange={(e) => updateExperience(idx, "position", e.target.value)}
                />
              </div>
              <textarea
                className={styles.textarea}
                rows={2}
                value={exp.description}
                onChange={(e) => updateExperience(idx, "description", e.target.value)}
                placeholder="Describe tus responsabilidades..."
              />
              <div className={styles.entryRow}>
                <Input
                  label="Año inicio"
                  value={exp.start_year}
                  onChange={(e) => updateExperience(idx, "start_year", e.target.value)}
                  placeholder="2020"
                />
                <Input
                  label="Año fin"
                  value={exp.end_year}
                  onChange={(e) => updateExperience(idx, "end_year", e.target.value)}
                  placeholder="Presente"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setExperience((prev) => prev.filter((_, i) => i !== idx))}
              >
                Eliminar
              </Button>
            </div>
          ))}
        </Card>

        <div className={styles.actions}>
          <Button type="submit" isLoading={saving}>
            Guardar CV
          </Button>
        </div>
      </form>
    </div>
  );
}

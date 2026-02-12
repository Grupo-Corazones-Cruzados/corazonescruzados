"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import { useAuth } from "@/lib/AuthProvider";
import styles from "@/app/styles/MiCurriculum.module.css";

interface Language {
  name: string;
  level: string;
}

interface Certification {
  name: string;
  issuer: string;
  year: string;
}

interface Experience {
  company: string;
  role: string;
  start_date: string;
  end_date: string;
  current: boolean;
  summary: string;
}

interface Education {
  institution: string;
  degree: string;
  start_year: string;
  end_year: string;
  notes: string;
}

interface CvFormData {
  full_name: string;
  headline: string;
  summary: string;
  location: string;
  phone: string;
  email: string;
  website: string;
  linkedin: string;
  github: string;
  skills: string[];
  languages: Language[];
  certifications: Certification[];
  experience: Experience[];
  education: Education[];
}

const emptyCv: CvFormData = {
  full_name: "",
  headline: "",
  summary: "",
  location: "",
  phone: "",
  email: "",
  website: "",
  linkedin: "",
  github: "",
  skills: [],
  languages: [],
  certifications: [],
  experience: [],
  education: [],
};

export default function MiCurriculumPage() {
  const { profile, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();

  const [formData, setFormData] = useState<CvFormData>(emptyCv);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Temp inputs for adding items
  const [newSkill, setNewSkill] = useState("");
  const [newLang, setNewLang] = useState<Language>({ name: "", level: "Básico" });
  const [newCert, setNewCert] = useState<Certification>({ name: "", issuer: "", year: "" });

  // Redirect non-members
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || (profile?.rol !== "miembro" && profile?.rol !== "admin"))) {
      router.push("/dashboard");
    }
  }, [authLoading, isAuthenticated, profile, router]);

  // Load CV
  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchCv = async () => {
      try {
        const res = await fetch("/api/member/cv");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al cargar CV");
        if (data.cv) {
          setFormData({
            full_name: data.cv.full_name || "",
            headline: data.cv.headline || "",
            summary: data.cv.summary || "",
            location: data.cv.location || "",
            phone: data.cv.phone || "",
            email: data.cv.email || "",
            website: data.cv.website || "",
            linkedin: data.cv.linkedin || "",
            github: data.cv.github || "",
            skills: data.cv.skills || [],
            languages: data.cv.languages || [],
            certifications: data.cv.certifications || [],
            experience: data.cv.experience || [],
            education: data.cv.education || [],
          });
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCv();
  }, [isAuthenticated]);

  // Save CV
  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch("/api/member/cv", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      setSuccessMsg("Curriculum guardado exitosamente");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Helper: update a simple field
  const updateField = (field: keyof CvFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Skills
  const addSkill = () => {
    const trimmed = newSkill.trim();
    if (!trimmed || formData.skills.includes(trimmed)) return;
    setFormData((prev) => ({ ...prev, skills: [...prev.skills, trimmed] }));
    setNewSkill("");
  };
  const removeSkill = (index: number) => {
    setFormData((prev) => ({ ...prev, skills: prev.skills.filter((_, i) => i !== index) }));
  };

  // Languages
  const addLanguage = () => {
    if (!newLang.name.trim()) return;
    setFormData((prev) => ({ ...prev, languages: [...prev.languages, { ...newLang, name: newLang.name.trim() }] }));
    setNewLang({ name: "", level: "Básico" });
  };
  const removeLanguage = (index: number) => {
    setFormData((prev) => ({ ...prev, languages: prev.languages.filter((_, i) => i !== index) }));
  };
  const updateLanguage = (index: number, field: keyof Language, value: string) => {
    setFormData((prev) => ({
      ...prev,
      languages: prev.languages.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }));
  };

  // Certifications
  const addCertification = () => {
    if (!newCert.name.trim()) return;
    setFormData((prev) => ({ ...prev, certifications: [...prev.certifications, { ...newCert, name: newCert.name.trim() }] }));
    setNewCert({ name: "", issuer: "", year: "" });
  };
  const removeCertification = (index: number) => {
    setFormData((prev) => ({ ...prev, certifications: prev.certifications.filter((_, i) => i !== index) }));
  };
  const updateCertification = (index: number, field: keyof Certification, value: string) => {
    setFormData((prev) => ({
      ...prev,
      certifications: prev.certifications.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }));
  };

  // Experience
  const addExperience = () => {
    setFormData((prev) => ({
      ...prev,
      experience: [...prev.experience, { company: "", role: "", start_date: "", end_date: "", current: false, summary: "" }],
    }));
  };
  const removeExperience = (index: number) => {
    setFormData((prev) => ({ ...prev, experience: prev.experience.filter((_, i) => i !== index) }));
  };
  const updateExperience = (index: number, field: keyof Experience, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      experience: prev.experience.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }));
  };

  // Education
  const addEducation = () => {
    setFormData((prev) => ({
      ...prev,
      education: [...prev.education, { institution: "", degree: "", start_year: "", end_year: "", notes: "" }],
    }));
  };
  const removeEducation = (index: number) => {
    setFormData((prev) => ({ ...prev, education: prev.education.filter((_, i) => i !== index) }));
  };
  const updateEducation = (index: number, field: keyof Education, value: string) => {
    setFormData((prev) => ({
      ...prev,
      education: prev.education.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }));
  };

  if (authLoading || (!isAuthenticated && !profile)) {
    return (
      <DashboardLayout>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p>Cargando...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={styles.page}>
        {/* Header */}
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Mi Curriculum</h1>
            <p className={styles.pageSubtitle}>Configura tu perfil profesional para el marketplace</p>
          </div>
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}
        {successMsg && <div className={styles.successBanner}>{successMsg}</div>}

        {loading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <p>Cargando curriculum...</p>
          </div>
        ) : (
          <>
            {/* 1. Información Personal */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Información Personal</h2>
              </div>
              <div className={styles.sectionBody}>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Nombre completo</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={formData.full_name}
                      onChange={(e) => updateField("full_name", e.target.value)}
                      placeholder="Tu nombre completo"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Título profesional</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={formData.headline}
                      onChange={(e) => updateField("headline", e.target.value)}
                      placeholder="Ej: Desarrollador Full Stack"
                    />
                  </div>
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Ubicación</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={formData.location}
                      onChange={(e) => updateField("location", e.target.value)}
                      placeholder="Ciudad, País"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Teléfono</label>
                    <input
                      type="tel"
                      className={styles.formInput}
                      value={formData.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                      placeholder="+1 234 567 890"
                    />
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Email de contacto</label>
                  <input
                    type="email"
                    className={styles.formInput}
                    value={formData.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    placeholder="tu@email.com"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Resumen profesional</label>
                  <textarea
                    className={styles.formTextarea}
                    value={formData.summary}
                    onChange={(e) => updateField("summary", e.target.value)}
                    placeholder="Describe brevemente tu perfil profesional..."
                    rows={4}
                  />
                </div>
              </div>
            </div>

            {/* 2. Enlaces */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Enlaces</h2>
              </div>
              <div className={styles.sectionBody}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Sitio web</label>
                  <input
                    type="url"
                    className={styles.formInput}
                    value={formData.website}
                    onChange={(e) => updateField("website", e.target.value)}
                    placeholder="https://tu-sitio.com"
                  />
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>LinkedIn</label>
                    <input
                      type="url"
                      className={styles.formInput}
                      value={formData.linkedin}
                      onChange={(e) => updateField("linkedin", e.target.value)}
                      placeholder="https://linkedin.com/in/tu-perfil"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>GitHub</label>
                    <input
                      type="url"
                      className={styles.formInput}
                      value={formData.github}
                      onChange={(e) => updateField("github", e.target.value)}
                      placeholder="https://github.com/tu-usuario"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Habilidades */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Habilidades</h2>
              </div>
              <div className={styles.sectionBody}>
                {formData.skills.length > 0 && (
                  <div className={styles.skillsContainer}>
                    {formData.skills.map((skill, i) => (
                      <span key={i} className={styles.skillTag}>
                        {skill}
                        <button
                          type="button"
                          className={styles.skillTagRemove}
                          onClick={() => removeSkill(i)}
                          title="Eliminar"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className={styles.addRow}>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
                    placeholder="Ej: React, Python, Diseño UI..."
                  />
                  <button type="button" className={styles.secondaryButton} onClick={addSkill}>
                    Agregar
                  </button>
                </div>
              </div>
            </div>

            {/* 4. Idiomas */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Idiomas</h2>
              </div>
              <div className={styles.sectionBody}>
                {formData.languages.map((lang, i) => (
                  <div key={i} className={styles.arrayItem}>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={lang.name}
                      onChange={(e) => updateLanguage(i, "name", e.target.value)}
                      placeholder="Idioma"
                    />
                    <select
                      className={styles.formSelect}
                      value={lang.level}
                      onChange={(e) => updateLanguage(i, "level", e.target.value)}
                    >
                      <option value="Básico">Básico</option>
                      <option value="Intermedio">Intermedio</option>
                      <option value="Avanzado">Avanzado</option>
                      <option value="Nativo">Nativo</option>
                    </select>
                    <button type="button" className={styles.dangerButton} onClick={() => removeLanguage(i)} title="Eliminar">
                      &times;
                    </button>
                  </div>
                ))}
                <div className={styles.addRow}>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={newLang.name}
                    onChange={(e) => setNewLang({ ...newLang, name: e.target.value })}
                    placeholder="Nombre del idioma"
                  />
                  <select
                    className={styles.formSelect}
                    value={newLang.level}
                    onChange={(e) => setNewLang({ ...newLang, level: e.target.value })}
                    style={{ maxWidth: 150 }}
                  >
                    <option value="Básico">Básico</option>
                    <option value="Intermedio">Intermedio</option>
                    <option value="Avanzado">Avanzado</option>
                    <option value="Nativo">Nativo</option>
                  </select>
                  <button type="button" className={styles.secondaryButton} onClick={addLanguage}>
                    Agregar
                  </button>
                </div>
              </div>
            </div>

            {/* 5. Certificaciones */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Certificaciones</h2>
              </div>
              <div className={styles.sectionBody}>
                {formData.certifications.map((cert, i) => (
                  <div key={i} className={styles.arrayItem}>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={cert.name}
                      onChange={(e) => updateCertification(i, "name", e.target.value)}
                      placeholder="Nombre"
                    />
                    <input
                      type="text"
                      className={styles.formInput}
                      value={cert.issuer}
                      onChange={(e) => updateCertification(i, "issuer", e.target.value)}
                      placeholder="Emisor"
                    />
                    <input
                      type="text"
                      className={styles.formInput}
                      value={cert.year}
                      onChange={(e) => updateCertification(i, "year", e.target.value)}
                      placeholder="Año"
                      style={{ maxWidth: 80 }}
                    />
                    <button type="button" className={styles.dangerButton} onClick={() => removeCertification(i)} title="Eliminar">
                      &times;
                    </button>
                  </div>
                ))}
                <div className={styles.addRow}>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={newCert.name}
                    onChange={(e) => setNewCert({ ...newCert, name: e.target.value })}
                    placeholder="Nombre de la certificación"
                  />
                  <input
                    type="text"
                    className={styles.formInput}
                    value={newCert.issuer}
                    onChange={(e) => setNewCert({ ...newCert, issuer: e.target.value })}
                    placeholder="Emisor"
                  />
                  <input
                    type="text"
                    className={styles.formInput}
                    value={newCert.year}
                    onChange={(e) => setNewCert({ ...newCert, year: e.target.value })}
                    placeholder="Año"
                    style={{ maxWidth: 80 }}
                  />
                  <button type="button" className={styles.secondaryButton} onClick={addCertification}>
                    Agregar
                  </button>
                </div>
              </div>
            </div>

            {/* 6. Experiencia Laboral */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Experiencia Laboral</h2>
                <button type="button" className={styles.secondaryButton} onClick={addExperience}>
                  + Agregar
                </button>
              </div>
              <div className={styles.sectionBody}>
                {formData.experience.length === 0 && (
                  <p style={{ color: "var(--text-muted)", textAlign: "center", margin: 0 }}>
                    No has agregado experiencia laboral aún.
                  </p>
                )}
                {formData.experience.map((exp, i) => (
                  <div key={i} className={styles.arrayCard}>
                    <div className={styles.arrayCardHeader}>
                      <h3 className={styles.arrayCardTitle}>Experiencia #{i + 1}</h3>
                      <button type="button" className={styles.dangerButton} onClick={() => removeExperience(i)} title="Eliminar">
                        &times;
                      </button>
                    </div>
                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Empresa</label>
                        <input
                          type="text"
                          className={styles.formInput}
                          value={exp.company}
                          onChange={(e) => updateExperience(i, "company", e.target.value)}
                          placeholder="Nombre de la empresa"
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Cargo</label>
                        <input
                          type="text"
                          className={styles.formInput}
                          value={exp.role}
                          onChange={(e) => updateExperience(i, "role", e.target.value)}
                          placeholder="Tu cargo o rol"
                        />
                      </div>
                    </div>
                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Fecha inicio</label>
                        <input
                          type="month"
                          className={styles.formInput}
                          value={exp.start_date}
                          onChange={(e) => updateExperience(i, "start_date", e.target.value)}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Fecha fin</label>
                        <input
                          type="month"
                          className={styles.formInput}
                          value={exp.end_date}
                          onChange={(e) => updateExperience(i, "end_date", e.target.value)}
                          disabled={exp.current}
                        />
                      </div>
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formCheckbox}>
                        <input
                          type="checkbox"
                          checked={exp.current}
                          onChange={(e) => {
                            updateExperience(i, "current", e.target.checked);
                            if (e.target.checked) updateExperience(i, "end_date", "");
                          }}
                        />
                        Trabajo actual
                      </label>
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Descripción</label>
                      <textarea
                        className={styles.formTextarea}
                        value={exp.summary}
                        onChange={(e) => updateExperience(i, "summary", e.target.value)}
                        placeholder="Describe tus responsabilidades y logros..."
                        rows={3}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 7. Educación */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Educación</h2>
                <button type="button" className={styles.secondaryButton} onClick={addEducation}>
                  + Agregar
                </button>
              </div>
              <div className={styles.sectionBody}>
                {formData.education.length === 0 && (
                  <p style={{ color: "var(--text-muted)", textAlign: "center", margin: 0 }}>
                    No has agregado educación aún.
                  </p>
                )}
                {formData.education.map((edu, i) => (
                  <div key={i} className={styles.arrayCard}>
                    <div className={styles.arrayCardHeader}>
                      <h3 className={styles.arrayCardTitle}>Educación #{i + 1}</h3>
                      <button type="button" className={styles.dangerButton} onClick={() => removeEducation(i)} title="Eliminar">
                        &times;
                      </button>
                    </div>
                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Institución</label>
                        <input
                          type="text"
                          className={styles.formInput}
                          value={edu.institution}
                          onChange={(e) => updateEducation(i, "institution", e.target.value)}
                          placeholder="Nombre de la institución"
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Título / Grado</label>
                        <input
                          type="text"
                          className={styles.formInput}
                          value={edu.degree}
                          onChange={(e) => updateEducation(i, "degree", e.target.value)}
                          placeholder="Ej: Ingeniería en Sistemas"
                        />
                      </div>
                    </div>
                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Año inicio</label>
                        <input
                          type="text"
                          className={styles.formInput}
                          value={edu.start_year}
                          onChange={(e) => updateEducation(i, "start_year", e.target.value)}
                          placeholder="2020"
                          maxLength={4}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Año fin</label>
                        <input
                          type="text"
                          className={styles.formInput}
                          value={edu.end_year}
                          onChange={(e) => updateEducation(i, "end_year", e.target.value)}
                          placeholder="2024"
                          maxLength={4}
                        />
                      </div>
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Notas adicionales</label>
                      <textarea
                        className={styles.formTextarea}
                        value={edu.notes}
                        onChange={(e) => updateEducation(i, "notes", e.target.value)}
                        placeholder="Honores, especializaciones, etc."
                        rows={2}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Save Footer */}
            <div className={styles.saveFooter}>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Guardando..." : "Guardar Curriculum"}
              </button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

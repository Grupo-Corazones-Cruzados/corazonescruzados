"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import styles from "./PublicProject.module.css";

interface ProjectRequirement {
  id: number;
  titulo: string;
  descripcion?: string;
  costo?: number;
  completado: boolean;
  fecha_completado?: string;
  es_adicional?: boolean;
  creador?: { nombre: string; tipo: string };
  completado_por?: { nombre: string };
}

interface TeamMember {
  id: number;
  nombre: string;
  puesto?: string;
  foto?: string;
  trabajo_finalizado?: boolean;
}

interface PublicProject {
  id: number;
  titulo: string;
  descripcion?: string;
  estado: string;
  fecha_limite?: string;
  created_at: string;
  tipo_proyecto: string;
  propietario?: {
    nombre: string;
    puesto?: string;
    foto?: string;
    tipo?: string;
  };
  progress: number;
  totalRequirements: number;
  completedRequirements: number;
  totalCost: number;
  requirements: ProjectRequirement[];
  team: TeamMember[];
}

// Mapeo de estados a labels
const estadoLabels: Record<string, string> = {
  borrador: "Borrador",
  publicado: "Publicado",
  planificado: "Planificado",
  iniciado: "Iniciado",
  en_progreso: "En Progreso",
  en_implementacion: "En Implementacion",
  en_pruebas: "En Pruebas",
  completado: "Completado",
  completado_parcial: "Completado Parcial",
  no_completado: "No Completado",
  cancelado: "Cancelado",
};

// Mapeo de estados a clases CSS
const estadoClasses: Record<string, string> = {
  borrador: styles.statusBorrador,
  publicado: styles.statusPublicado,
  planificado: styles.statusPlanificado,
  iniciado: styles.statusIniciado,
  en_progreso: styles.statusEnProgreso,
  en_implementacion: styles.statusEnImplementacion,
  en_pruebas: styles.statusEnPruebas,
  completado: styles.statusCompletado,
  completado_parcial: styles.statusCompletadoParcial,
  no_completado: styles.statusNoCompletado,
  cancelado: styles.statusCancelado,
};

export default function PublicProjectPage() {
  const params = useParams();
  const token = params?.token as string;

  const [project, setProject] = useState<PublicProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProject() {
      if (!token) return;

      try {
        const res = await fetch(`/api/public/projects/${token}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Error al cargar el proyecto");
          return;
        }

        setProject(data);
      } catch (err) {
        console.error("Error fetching project:", err);
        setError("Error al cargar el proyecto");
      } finally {
        setLoading(false);
      }
    }

    fetchProject();
  }, [token]);

  const handleDownloadPdf = () => {
    // Para descargar PDF desde la página pública, redirigimos a una versión que no requiere auth
    // Por ahora, mostramos un mensaje informativo
    alert("Para descargar el PDF, por favor inicia sesion en la plataforma.");
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Cargando proyecto...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <div className={styles.errorIcon}>!</div>
          <h2>No se pudo cargar el proyecto</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <div className={styles.errorIcon}>?</div>
          <h2>Proyecto no encontrado</h2>
          <p>El enlace puede ser invalido o haber expirado.</p>
        </div>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("es-EC", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <Image
            src="/LogoCC.png"
            alt="Corazones Cruzados"
            width={40}
            height={40}
          />
          <span>Corazones Cruzados</span>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.main}>
        {/* Project Header */}
        <div className={styles.projectHeader}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{project.titulo}</h1>
            <span className={`${styles.statusBadge} ${estadoClasses[project.estado] || ""}`}>
              {estadoLabels[project.estado] || project.estado}
            </span>
          </div>
          {project.descripcion && (
            <p className={styles.description}>{project.descripcion}</p>
          )}
        </div>

        {/* Info Cards */}
        <div className={styles.infoGrid}>
          <div className={styles.infoCard}>
            <span className={styles.infoLabel}>Proyecto</span>
            <span className={styles.infoValue}>#{project.id}</span>
          </div>
          <div className={styles.infoCard}>
            <span className={styles.infoLabel}>Creado</span>
            <span className={styles.infoValue}>{formatDate(project.created_at)}</span>
          </div>
          {project.fecha_limite && (
            <div className={styles.infoCard}>
              <span className={styles.infoLabel}>Fecha Limite</span>
              <span className={styles.infoValue}>{formatDate(project.fecha_limite)}</span>
            </div>
          )}
          {project.propietario && (
            <div className={styles.infoCard}>
              <span className={styles.infoLabel}>Propietario</span>
              <span className={styles.infoValue}>{project.propietario.nombre}</span>
            </div>
          )}
        </div>

        {/* Progress Section */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Progreso</h2>
          <div className={styles.progressCard}>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${project.progress}%` }}
              />
            </div>
            <div className={styles.progressStats}>
              <span>
                {project.completedRequirements} de {project.totalRequirements} completados
              </span>
              <span className={styles.progressPercent}>{project.progress}%</span>
            </div>
          </div>
        </div>

        {/* Requirements Section */}
        {project.requirements.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Requerimientos</h2>
            <div className={styles.requirementsList}>
              {project.requirements.map((req) => (
                <div
                  key={req.id}
                  className={`${styles.requirementItem} ${req.completado ? styles.completed : ""}`}
                >
                  <div className={styles.requirementCheck}>
                    {req.completado ? (
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <circle cx="10" cy="10" r="10" fill="#10b981" />
                        <path d="M6 10l3 3 5-6" stroke="white" strokeWidth="2" fill="none" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <circle cx="10" cy="10" r="9" stroke="#6b7280" strokeWidth="2" />
                      </svg>
                    )}
                  </div>
                  <div className={styles.requirementContent}>
                    <h3 className={styles.requirementTitle}>
                      {req.titulo}
                      {req.es_adicional && (
                        <span className={styles.additionalBadge}>Adicional</span>
                      )}
                    </h3>
                    {req.descripcion && (
                      <p className={styles.requirementDescription}>{req.descripcion}</p>
                    )}
                    <div className={styles.requirementMeta}>
                      {req.creador && (
                        <span className={styles.metaItem}>
                          Creado por: {req.creador.nombre}
                        </span>
                      )}
                      {req.completado && req.completado_por && (
                        <span className={styles.metaItem}>
                          Completado por: {req.completado_por.nombre}
                        </span>
                      )}
                      {req.costo && (
                        <span className={styles.metaCost}>
                          ${Number(req.costo).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {project.totalCost > 0 && (
              <div className={styles.totalCost}>
                <span>Costo Total</span>
                <span className={styles.totalAmount}>
                  ${project.totalCost.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Team Section */}
        {project.team.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Equipo</h2>
            <div className={styles.teamGrid}>
              {project.team.map((member) => (
                <div key={member.id} className={styles.teamCard}>
                  <div className={styles.memberAvatar}>
                    {member.foto ? (
                      <Image
                        src={member.foto}
                        alt={member.nombre}
                        width={48}
                        height={48}
                        className={styles.avatarImage}
                      />
                    ) : (
                      <div className={styles.avatarPlaceholder}>
                        {member.nombre.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {member.trabajo_finalizado && (
                      <div className={styles.finishedBadge} title="Trabajo finalizado">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-6" stroke="white" strokeWidth="2" fill="none" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className={styles.memberInfo}>
                    <span className={styles.memberName}>{member.nombre}</span>
                    {member.puesto && (
                      <span className={styles.memberRole}>{member.puesto}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Download PDF Button */}
        <div className={styles.actions}>
          <button onClick={handleDownloadPdf} className={styles.downloadButton}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M10 3v10m0 0l-4-4m4 4l4-4M3 17h14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Descargar PDF
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <p>
          Powered by <strong>Corazones Cruzados</strong>
        </p>
        <p className={styles.footerNote}>
          Este es un enlace compartible de solo lectura.
        </p>
      </footer>
    </div>
  );
}

import { notFound } from "next/navigation";
import { getCvProfile, getPortfolioItems } from "@/lib/services/cv-portfolio-service";
import { query } from "@/lib/db";
import type { Member } from "@/lib/types";
import styles from "./page.module.css";

export default async function PublicPortfolioPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  const id = Number(memberId);
  if (isNaN(id)) notFound();

  // Fetch member, CV, and portfolio in parallel
  const [memberResult, cv, portfolio] = await Promise.all([
    query("SELECT * FROM members WHERE id = $1 AND is_active = true", [id]),
    getCvProfile(id),
    getPortfolioItems(id),
  ]);

  const member: Member | undefined = memberResult.rows[0];
  if (!member) notFound();

  return (
    <div className={styles.container}>
      {/* Header */}
      <section className={styles.hero}>
        {member.photo_url && (
          <img
            src={member.photo_url}
            alt={member.name}
            className={styles.avatar}
          />
        )}
        <h1 className={styles.name}>{member.name}</h1>
        {member.position && <p className={styles.position}>{member.position}</p>}
        {cv?.bio && <p className={styles.bio}>{cv.bio}</p>}
        <div className={styles.links}>
          {cv?.linkedin_url && (
            <a
              href={cv.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
            >
              LinkedIn
            </a>
          )}
          {cv?.website_url && (
            <a
              href={cv.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
            >
              Sitio web
            </a>
          )}
        </div>
      </section>

      {/* Skills */}
      {cv?.skills && cv.skills.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Habilidades</h2>
          <div className={styles.chips}>
            {cv.skills.map((skill) => (
              <span key={skill} className={styles.chip}>
                {skill}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Languages */}
      {cv?.languages && cv.languages.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Idiomas</h2>
          <div className={styles.chips}>
            {cv.languages.map((lang) => (
              <span key={lang} className={styles.chip}>
                {lang}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Experience */}
      {cv?.experience && (cv.experience as Record<string, string>[]).length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Experiencia</h2>
          <div className={styles.timeline}>
            {(cv.experience as Record<string, string>[]).map((exp, idx) => (
              <div key={idx} className={styles.timelineItem}>
                <div className={styles.timelineHeader}>
                  <h3 className={styles.timelineTitle}>{exp.position}</h3>
                  <span className={styles.timelineDate}>
                    {exp.start_year} — {exp.end_year || "Presente"}
                  </span>
                </div>
                <p className={styles.timelineCompany}>{exp.company}</p>
                {exp.description && (
                  <p className={styles.timelineDesc}>{exp.description}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Education */}
      {cv?.education && (cv.education as Record<string, string>[]).length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Educación</h2>
          <div className={styles.timeline}>
            {(cv.education as Record<string, string>[]).map((edu, idx) => (
              <div key={idx} className={styles.timelineItem}>
                <div className={styles.timelineHeader}>
                  <h3 className={styles.timelineTitle}>
                    {edu.degree} {edu.field && `— ${edu.field}`}
                  </h3>
                  <span className={styles.timelineDate}>
                    {edu.start_year} — {edu.end_year || "Presente"}
                  </span>
                </div>
                <p className={styles.timelineCompany}>{edu.institution}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Portfolio */}
      {portfolio.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Portafolio</h2>
          <div className={styles.portfolioGrid}>
            {portfolio.map((item) => (
              <div key={item.id} className={styles.portfolioCard}>
                {item.image_url && (
                  <div className={styles.portfolioImage}>
                    <img src={item.image_url} alt={item.title} />
                  </div>
                )}
                <div className={styles.portfolioBody}>
                  <h3 className={styles.portfolioTitle}>
                    {item.project_url ? (
                      <a
                        href={item.project_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {item.title}
                      </a>
                    ) : (
                      item.title
                    )}
                  </h3>
                  {item.description && (
                    <p className={styles.portfolioDesc}>{item.description}</p>
                  )}
                  {item.tags && item.tags.length > 0 && (
                    <div className={styles.chips}>
                      {item.tags.map((tag) => (
                        <span key={tag} className={styles.chipSmall}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

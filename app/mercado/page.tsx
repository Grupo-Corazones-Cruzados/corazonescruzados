/* app/mercado/page.tsx (COPIA Y PEGA COMPLETO)
   FIX Vercel/Next 15:
   useSearchParams() debe estar dentro de un <Suspense>
*/

"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useSearchParams } from "next/navigation";
import styles from "app/styles/Mercado.module.css";

/** ====== PRODUCTS (Marketplace) ====== */
type ProductoRow = {
  id: number;
  created_at: string;
  nombre: string | null;
  herramientas: any | null;
  descripcion: string | null;
  imagen: string | null; // Data URL completa: data:image/...;base64,...
  link_detalles?: string | null; // URL para ver detalles del producto
  costo: number | null;
  id_miembro?: number | null;
};

/** ====== CV ====== */
type CvProfile = {
  id: string;
  created_at?: string | null;
  updated_at?: string | null;

  full_name: string | null;
  headline: string | null;
  summary: string | null;
  location: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  linkedin: string | null;
  github: string | null;

  languages: any | null;
  certifications: any | null;
  skills: any | null;
  experience: any | null;
  education: any | null;
};

type MiembroRow = {
  id: number;
  nombre: string | null;
  puesto: string | null;
  descripcion: string | null;
  foto: string | null;
  correo: string | null;
  celular?: string | null;
  cod_usuario?: string | null;

  cv_profile?: string | null; // uuid en tabla miembros
  cvProfile?: CvProfile | null; // relación traída como objeto (alias)
};

const PRODUCTS_TABLE = "productos";
const MEMBERS_TABLE = "miembros";
const CV_TABLE = "cv_profile";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

function safeText(v: any) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function asArray(v: any): any[] {
  return Array.isArray(v) ? v : [];
}
function safeLink(v: any): string | null {
  const s = safeText(v).trim();
  return s ? s : null;
}
function formatDateRange(start?: any, end?: any, current?: any) {
  const s = safeText(start);
  const e = current ? "Presente" : safeText(end);
  if (!s && !e) return "";
  if (s && e) return `${s} – ${e}`;
  return s || e;
}
function getCategoria(herramientas: any): string {
  if (!herramientas) return "General";
  if (typeof herramientas === "string") return herramientas;
  if (Array.isArray(herramientas)) {
    return safeText(herramientas[0] ?? "General") || "General";
  }
  if (typeof herramientas === "object") {
    return (
      safeText(herramientas.categoria) ||
      safeText(herramientas.category) ||
      safeText(herramientas.tipo) ||
      "General"
    );
  }
  return "General";
}
function getTags(herramientas: any): string[] {
  if (!herramientas) return [];
  if (Array.isArray(herramientas)) {
    return herramientas.map(safeText).filter(Boolean).slice(0, 8);
  }
  if (typeof herramientas === "object") {
    const t = herramientas.tags ?? herramientas.etiquetas ?? herramientas.tools;
    if (Array.isArray(t)) return t.map(safeText).filter(Boolean).slice(0, 10);
    if (typeof t === "string")
      return t
        .split(",")
        .map((x: string) => x.trim())
        .filter(Boolean)
        .slice(0, 10);
  }
  return [];
}

function MercadoInner() {
  const searchParams = useSearchParams();
  const handlePrintPdf = () => {
  if (typeof window !== "undefined") window.print();
};

  const miembroParam = searchParams.get("miembro");
  const miembroId = useMemo(() => {
    if (!miembroParam) return null;
    const n = Number(miembroParam);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [miembroParam]);

  const [items, setItems] = useState<ProductoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [cat, setCat] = useState("__all");

  const [miembro, setMiembro] = useState<MiembroRow | null>(null);
  const [cv, setCv] = useState<CvProfile | null>(null);
  const [cvLoading, setCvLoading] = useState(true);
  const [cvError, setCvError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setCvLoading(true);
        setError(null);
        setCvError(null);

        if (miembroId) {
          const [memberRes, productsRes] = await Promise.all([
            supabase
              .from(MEMBERS_TABLE)
              .select(
                `
                id,
                nombre,
                puesto,
                descripcion,
                foto,
                correo,
                celular,
                cod_usuario,
                cv_profile,
                cvProfile:cv_profile(*)
              `
              )
              .eq("id", miembroId)
              .single(),

            supabase
              .from(PRODUCTS_TABLE)
              .select("id, created_at, nombre, herramientas, descripcion, imagen, link_detalles, costo, id_miembro")
              .eq("id_miembro", miembroId)
              .order("created_at", { ascending: false }),
          ]);

          if (memberRes.error) throw memberRes.error;
          if (productsRes.error) throw productsRes.error;

          if (!cancelled) {
            const m = memberRes.data as unknown as MiembroRow;
            setMiembro(m);
            setCv((m?.cvProfile as CvProfile) ?? null);
            setItems((productsRes.data as ProductoRow[]) ?? []);
          }

          if (!cancelled && !(memberRes.data as any)?.cvProfile) {
            setCvError("Este miembro no tiene CV asociado aún.");
          }
        } else {
          const [productsRes, cvRes] = await Promise.all([
            supabase
              .from(PRODUCTS_TABLE)
              .select("id, created_at, nombre, herramientas, descripcion, imagen, link_detalles, costo, id_miembro")
              .order("created_at", { ascending: false }),

            supabase.from(CV_TABLE).select("*").order("updated_at", { ascending: false }).limit(1),
          ]);

          if (productsRes.error) throw productsRes.error;

          if (!cancelled) {
            setItems((productsRes.data as ProductoRow[]) ?? []);
            const row = (cvRes.data as CvProfile[] | null)?.[0] ?? null;
            setCv(row);
            setMiembro(null);
          }

          if (cvRes.error && !cancelled) {
            setCvError(cvRes.error.message);
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "No se pudo cargar Mercado.");
          console.error("Mercado error:", e);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setCvLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [miembroId]);

  const categorias = useMemo(() => {
    const s = new Set<string>();
    items.forEach((it) => s.add(getCategoria(it.herramientas)));
    return ["__all", ...Array.from(s).sort((a, b) => a.localeCompare(b))];
  }, [items]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return items.filter((it) => {
      const categoria = getCategoria(it.herramientas);
      if (cat !== "__all" && categoria !== cat) return false;

      if (!query) return true;

      const hay = [
        safeText(it.nombre),
        safeText(it.descripcion),
        categoria,
        getTags(it.herramientas).join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(query);
    });
  }, [items, q, cat]);

  const cvTitle = useMemo(() => {
    if (miembro?.nombre) return `CV · ${miembro.nombre}`;
    return "Currículum";
  }, [miembro?.nombre]);

  return (
    <div className={styles.page}>
      <div className={styles.bgGlow} aria-hidden="true" />

      <main className={styles.container}>
        {/* ===== CV ===== */}
        <section className={styles.cvSection} id="cv" aria-label="Currículum">
          <div className={styles.cvTop}>
            <div>
              <h1 className={styles.cvName}>{cvTitle}</h1>
              <div className={styles.cvHeadline}>
                {safeText(cv?.headline) || safeText(miembro?.puesto) || ""}
              </div>

              <div className={styles.cvContacts}>
                {safeText(cv?.phone) && <span>{safeText(cv?.phone)}</span>}
                {safeText(cv?.email) && <span>{safeText(cv?.email)}</span>}
                {safeText(cv?.location) && <span>{safeText(cv?.location)}</span>}
              </div>

              <div className={styles.cvLinks}>
                {safeLink(cv?.website) && (
                  <a className={styles.cvLink} href={safeLink(cv?.website)!} target="_blank" rel="noreferrer">
                    Website
                  </a>
                )}
                {safeLink(cv?.linkedin) && (
                  <a className={styles.cvLink} href={safeLink(cv?.linkedin)!} target="_blank" rel="noreferrer">
                    LinkedIn
                  </a>
                )}
                {safeLink(cv?.github) && (
                  <a className={styles.cvLink} href={safeLink(cv?.github)!} target="_blank" rel="noreferrer">
                    GitHub
                  </a>
                )}
              </div>
            </div>

            <div className={styles.cvRight}>
              {miembro?.foto ? (
                <div className={styles.cvPhotoWrap}>
                  <img className={styles.cvPhoto} src={miembro.foto} alt={miembro?.nombre || "Foto"} />
                </div>
              ) : null}

              <div className={styles.cvPill}>
                <span className={styles.cvDot} />
                CV
              </div>
            </div>
          </div>

          {cvLoading && (
            <div className={styles.cvState}>
              <div className={styles.spinner} aria-hidden="true" />
              <p>Cargando currículum…</p>
            </div>
          )}

          {!cvLoading && cvError && (
            <div className={styles.cvStateError} role="alert">
              <p className={styles.errorTitle}>No se pudo cargar el currículum</p>
              <p className={styles.errorText}>{cvError}</p>
            </div>
          )}

          {!cvLoading && !cvError && cv && (
            <div className={styles.cvLayout}>
              <div className={styles.cvMain}>
                <section className={styles.cvBlock}>
                  <h2 className={styles.cvH2}>Perfil</h2>
                  <p className={styles.cvText}>{safeText(cv.summary)}</p>
                </section>

                <section className={styles.cvBlock}>
                  <h2 className={styles.cvH2}>Experiencia</h2>
                  <div className={styles.cvItems}>
                    {asArray(cv.experience).length === 0 ? (
                      <div className={styles.cvMuted}>—</div>
                    ) : (
                      asArray(cv.experience).map((e: any, idx: number) => (
                        <article key={idx} className={styles.cvItem}>
                          <div className={styles.cvItemTop}>
                            <div className={styles.cvCompany}>
                              <strong>{safeText(e?.company)}</strong>
                              {safeText(e?.role) ? (
                                <span className={styles.cvRole}> · {safeText(e.role)}</span>
                              ) : null}
                            </div>
                            <div className={styles.cvDates}>
                              {formatDateRange(e?.start_date, e?.end_date, e?.current || e?.is_current)}
                            </div>
                          </div>

                          {safeText(e?.location) && <div className={styles.cvSub}>{safeText(e.location)}</div>}
                          {safeText(e?.summary) && <div className={styles.cvText}>{safeText(e.summary)}</div>}

                          {asArray(e?.bullets).length > 0 && (
                            <ul className={styles.cvBullets}>
                              {asArray(e.bullets).map((b: any, bidx: number) => (
                                <li key={bidx}>{safeText(b)}</li>
                              ))}
                            </ul>
                          )}
                        </article>
                      ))
                    )}
                  </div>
                </section>

                <section className={styles.cvBlock}>
                  <h2 className={styles.cvH2}>Educación</h2>
                  <div className={styles.cvItems}>
                    {asArray(cv.education).length === 0 ? (
                      <div className={styles.cvMuted}>—</div>
                    ) : (
                      asArray(cv.education).map((ed: any, idx: number) => (
                        <article key={idx} className={styles.cvItem}>
                          <div className={styles.cvItemTop}>
                            <div className={styles.cvCompany}>
                              <strong>{safeText(ed?.institution)}</strong>
                              {safeText(ed?.degree) ? (
                                <span className={styles.cvRole}> · {safeText(ed.degree)}</span>
                              ) : null}
                            </div>
                            <div className={styles.cvDates}>
                              {safeText(ed?.start_year) || safeText(ed?.end_year)
                                ? `${safeText(ed?.start_year)}${safeText(ed?.end_year) ? ` – ${safeText(ed.end_year)}` : ""}`
                                : ""}
                            </div>
                          </div>

                          {safeText(ed?.notes) && <div className={styles.cvText}>{safeText(ed.notes)}</div>}
                        </article>
                      ))
                    )}
                  </div>
                </section>
              </div>

              <aside className={styles.cvSide}>
                <section className={styles.cvSideBlock}>
                  <h2 className={styles.cvH2}>Habilidades</h2>
                  <div className={styles.cvTags}>
                    {asArray(cv.skills).length === 0 ? (
                      <span className={styles.cvMuted}>—</span>
                    ) : (
                      asArray(cv.skills).map((s: any, idx: number) => (
                        <span key={idx} className={styles.cvTag}>
                          {safeText(s)}
                        </span>
                      ))
                    )}
                  </div>
                </section>

                <section className={styles.cvSideBlock}>
                  <h2 className={styles.cvH2}>Idiomas</h2>
                  <ul className={styles.cvList}>
                    {asArray(cv.languages).length === 0 ? (
                      <li className={styles.cvMuted}>—</li>
                    ) : (
                      asArray(cv.languages).map((l: any, idx: number) => (
                        <li key={idx}>
                          {safeText(l?.name)}
                          {safeText(l?.level) ? `: ${safeText(l.level)}` : ""}
                        </li>
                      ))
                    )}
                  </ul>
                </section>

                <section className={styles.cvSideBlock}>
                  <h2 className={styles.cvH2}>Certificaciones</h2>
                  <ul className={styles.cvList}>
                    {asArray(cv.certifications).length === 0 ? (
                      <li className={styles.cvMuted}>—</li>
                    ) : (
                      asArray(cv.certifications).map((c: any, idx: number) => (
                        <li key={idx}>
                          {safeText(c?.name)}
                          {safeText(c?.level) ? ` (${safeText(c.level)})` : ""}
                          {safeText(c?.issuer) ? ` · ${safeText(c.issuer)}` : ""}
                        </li>
                      ))
                    )}
                  </ul>
                </section>
              </aside>

              <div className={styles.cvFooter}>
               
                <button type="button" className={styles.printBtn} onClick={handlePrintPdf}>
  Guardar en PDF
</button>
              </div>
            </div>
          )}

          {!cvLoading && !cvError && !cv && (
            <div className={styles.cvState}>
              <p>No hay CV disponible para mostrar.</p>
            </div>
          )}
        </section>

        <div style={{ height: 14 }} />
        {/* ===== Marketplace ===== */}
        <header className={styles.header} id="market">
          
          <div>
            <h1 className={styles.title}>Mercado</h1>
            <p className={styles.subtitle}>
              {miembroId
                ? "Mostrando productos del miembro seleccionado."
                : "Portafolio en formato marketplace: herramientas y soluciones listas para implementar."}
            </p>
          </div>

          <div className={styles.brandPill} title="Portfolio · Marketplace">
            <span className={styles.brandDot} />
            Marketplace
          </div>
        </header>

        <section className={styles.filters}>
          <input
            className={styles.search}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, categoría, tags o descripción…"
            type="search"
            aria-label="Buscar productos"
          />

          <select className={styles.select} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filtrar por categoría">
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c === "__all" ? "Todas las categorías" : c}
              </option>
            ))}
          </select>

          <div className={styles.count} aria-live="polite">
            {loading ? "Cargando…" : `${filtered.length} producto(s)`}
          </div>
        </section>

        {loading && (
          <div className={styles.state}>
            <div className={styles.spinner} aria-hidden="true" />
            <p>Cargando productos…</p>
          </div>
        )}

        {!loading && error && (
          <div className={styles.stateError} role="alert">
            <p className={styles.errorTitle}>Error</p>
            <p className={styles.errorText}>{error}</p>
            <p className={styles.errorHint}>
              Verifica tabla <b>{PRODUCTS_TABLE}</b> y columna <b>id_miembro</b>.
            </p>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className={styles.state}>
            <p>No hay productos para mostrar.</p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <section className={styles.grid}>
            {filtered.map((it) => {
              const nombre = safeText(it.nombre) || "Producto";
              const descripcion = safeText(it.descripcion);
              const categoria = getCategoria(it.herramientas);
              const tags = getTags(it.herramientas);
              const img = safeText(it.imagen) ? it.imagen : null;
              const link = safeLink((it as any).link_detalles);

              return (
                <article key={it.id} className={styles.card}>
                  <div className={styles.media}>
                    {img ? (
                      <img className={styles.image} src={img} alt={nombre} loading="lazy" />
                    ) : (
                      <div className={styles.placeholder} aria-hidden="true">
                        <div className={styles.placeholderIcon} />
                        <div className={styles.placeholderText}>{categoria}</div>
                      </div>
                    )}
                    <div className={styles.badge}>{categoria}</div>
                  </div>

                  <div className={styles.body}>
                    <h3 className={styles.cardTitle}>{nombre}</h3>

                    {descripcion ? (
                      <p className={styles.cardDesc}>{descripcion}</p>
                    ) : (
                      <p className={styles.cardDescEmpty}>Sin descripción</p>
                    )}

                    {tags.length > 0 && (
                      <div className={styles.tags}>
                        {tags.slice(0, 4).map((t) => (
                          <span key={t} className={styles.tag}>
                            {t}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className={styles.footer}>
                      {link ? (
                        <a
                          className={styles.cta}
                          href={link}
                          target="_blank"
                          rel="noreferrer"
                          style={{ textDecoration: "none", color: "inherit" }}
                        >
                          Ver detalles
                        </a>
                      ) : (
                        <span className={styles.cta} aria-disabled="true" title="Este producto no tiene enlace de detalles">
                          Ver detalles
                        </span>
                      )}

                      {typeof it.costo === "number" ? (
                        <span className={styles.price}>
                          {new Intl.NumberFormat("es-EC", {
                            style: "currency",
                            currency: "USD",
                            maximumFractionDigits: 0,
                          }).format(it.costo)}
                        </span>
                      ) : (
                        <span className={styles.priceMuted}>Precio: a consultar</span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}

export default function MercadoPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.page}>
          <div className={styles.bgGlow} aria-hidden="true" />
          <main className={styles.container}>
            <div className={styles.state}>
              <div className={styles.spinner} aria-hidden="true" />
              <p>Cargando…</p>
            </div>
          </main>
        </div>
      }
    >
      <MercadoInner />
    </Suspense>
  );
}
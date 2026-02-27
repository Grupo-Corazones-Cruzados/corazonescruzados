"use client";

import React, { useEffect, useMemo, useState, Suspense } from "react";
import style from "app/styles/Miembros.module.css";
import { useSearchParams, useRouter } from "next/navigation";
import { ObjetoResumenPaquete } from "app/components/CtPaquetes";

interface MiembrosPadre {
  selectedMember: number | null;
  setSelectedMember: React.Dispatch<React.SetStateAction<number | null>>;
  setObjetoMiembro: (m: ObjetoResumenPaquete | null) => void;
  objetoMiembro: ObjetoResumenPaquete | null;
}

interface Fuente {
  id: number;
  nombre: string;
}

interface Member {
  id: number;
  nombre: string;
  puesto: string;
  descripcion: string;
  foto: string | null;
  correo: string;
  id_fuente: number;
  costo: number;
  cod_usuario: string;
}

const Miembros: React.FC<MiembrosPadre> = ({
  selectedMember,
  setSelectedMember,
  setObjetoMiembro,
}) => {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [members, setMembers] = useState<Member[]>([]);
  const [fuentes, setFuentes] = useState<{ id: number; nombre: string }[]>([]);
  const [selectedFuente, setSelectedFuente] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingFuentes, setLoadingFuentes] = useState(true);

  const [page, setPage] = useState(0);
  const pageSize = 6;

  // Sync query param ?q=
  useEffect(() => {
    const param = searchParams.get("q");
    if (param) setSearchTerm(param);
  }, [searchParams]);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setPage(0);
    router.replace(value ? `?q=${encodeURIComponent(value)}` : `?`);
  };

  useEffect(() => {
    const fetchMembers = async () => {
      setLoadingMembers(true);
      try {
        const response = await fetch("/api/miembros-public");
        const data = await response.json();
        if (response.ok) {
          setMembers(data.members || []);
        } else {
          console.error("Error al cargar miembros:", data.error);
          setMembers([]);
        }
      } catch (error) {
        console.error("Error al cargar miembros:", error);
        setMembers([]);
      }
      setLoadingMembers(false);
    };

    fetchMembers();
  }, []);

  useEffect(() => {
    const fetchFuentes = async () => {
      setLoadingFuentes(true);
      try {
        const response = await fetch("/api/fuentes");
        const data = await response.json();
        if (response.ok) {
          setFuentes(data.fuentes || []);
        } else {
          console.error("Error al cargar fuentes:", data.error);
          setFuentes([]);
        }
      } catch (error) {
        console.error("Error al cargar fuentes:", error);
        setFuentes([]);
      }
      setLoadingFuentes(false);
    };

    fetchFuentes();
  }, []);

  const filteredMembers = useMemo(() => {
    const s = searchTerm.trim().toLowerCase();

    return members.filter((member) => {
      const matchesSearch =
        !s ||
        member.nombre.toLowerCase().includes(s) ||
        (member.cod_usuario || "").toLowerCase().includes(s);

      const matchesFuente = selectedFuente === null || member.id_fuente === selectedFuente;

      return matchesSearch && matchesFuente;
    });
  }, [members, searchTerm, selectedFuente]);

  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);

  const paginatedMembers = useMemo(() => {
    const start = safePage * pageSize;
    return filteredMembers.slice(start, start + pageSize);
  }, [filteredMembers, safePage]);

  // Reset page if filters reduce results
  useEffect(() => {
    if (page !== safePage) setPage(safePage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safePage]);

  const handlePrev = () => setPage((p) => Math.max(0, p - 1));
  const handleNext = () => setPage((p) => Math.min(totalPages - 1, p + 1));

  const clearFilters = () => {
    setSelectedFuente(null);
    handleSearchChange("");
    setPage(0);
  };

  const fuenteLabel = useMemo(() => {
    if (selectedFuente == null) return null;
    return fuentes.find((f) => f.id === selectedFuente)?.nombre ?? null;
  }, [fuentes, selectedFuente]);

  return (
    <section className={style.section} aria-label="Miembros">
      {/* Toolbar */}
      <div className={style.toolbar}>
        <div className={style.searchWrap}>
          <svg className={style.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por nombre o usuario..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className={style.searchInput}
          />
        </div>

        <select
          value={selectedFuente ?? ""}
          onChange={(e) => {
            setSelectedFuente(e.target.value ? Number(e.target.value) : null);
            setPage(0);
          }}
          className={style.select}
          disabled={loadingFuentes}
        >
          <option value="">Todas las fuentes</option>
          {fuentes.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nombre}
            </option>
          ))}
        </select>

        <div className={style.toolbarRight}>
          <span className={style.counter}>
            {loadingMembers ? "..." : filteredMembers.length}
          </span>

          {(fuenteLabel || searchTerm.trim()) && (
            <button type="button" className={style.clearBtn} onClick={clearFilters}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Active filter chips */}
      {(fuenteLabel || searchTerm.trim()) && (
        <div className={style.chips}>
          {searchTerm.trim() && (
            <span className={style.chip}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              {searchTerm.trim()}
            </span>
          )}
          {fuenteLabel && (
            <span className={style.chip}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              {fuenteLabel}
            </span>
          )}
        </div>
      )}

      {/* States */}
      {loadingMembers ? (
        <div className={style.state}>
          <div className={style.spinner} aria-hidden="true" />
          <p>Cargando miembros...</p>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className={style.state}>
          <p>No hay resultados con los filtros actuales.</p>
        </div>
      ) : (
        <>
          {/* Member list */}
          <div className={style.list}>
            {paginatedMembers.map((member) => {
              const selected = selectedMember === member.id;

              return (
                <button
                  key={member.id}
                  type="button"
                  className={`${style.row} ${selected ? style.rowSelected : ""}`}
                  onClick={() => {
                    setSelectedMember(member.id);
                    setObjetoMiembro(member as any);
                  }}
                >
                  <div className={style.rowAccent} />

                  <div className={style.rowAvatar}>
                    {member.foto ? (
                      <img src={member.foto} alt={member.nombre} className={style.avatar} />
                    ) : (
                      <div className={style.avatarPlaceholder} aria-hidden="true">
                        {member.nombre?.[0]?.toUpperCase() ?? "?"}
                      </div>
                    )}
                  </div>

                  <div className={style.rowInfo}>
                    <div className={style.rowNameLine}>
                      <h4 className={style.name}>{member.nombre}</h4>
                      <span className={style.rolePill}>{member.puesto}</span>
                      {selected && <span className={style.selectedBadge}>Activo</span>}
                    </div>
                    <p className={style.desc}>{member.descripcion}</p>
                  </div>

                  <div className={style.rowMeta}>
                    <span className={style.user}>{member.cod_usuario}</span>
                    <svg className={style.rowArrow} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Pagination */}
          <div className={style.pagination}>
            <button
              type="button"
              onClick={handlePrev}
              disabled={safePage === 0}
              className={style.pageBtn}
              aria-label="Página anterior"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <div className={style.pageInfo}>
              {safePage + 1} / {totalPages}
            </div>

            <button
              type="button"
              onClick={handleNext}
              disabled={safePage >= totalPages - 1}
              className={style.pageBtn}
              aria-label="Página siguiente"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </>
      )}
    </section>
  );
};

export default function MiembrosWrapper(props: MiembrosPadre) {
  return (
    <Suspense fallback={<p>Cargando miembros...</p>}>
      <Miembros {...props} />
    </Suspense>
  );
}

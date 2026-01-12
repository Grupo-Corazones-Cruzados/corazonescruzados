"use client";

import React, { useEffect, useMemo, useState, Suspense } from "react";
import { supabase } from "lib/supabaseClient";
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
  Fuente: string;
}

interface Member {
  id: number;
  Nombre: string;
  Puesto: string;
  Descripcion: string;
  Foto: string | null;
  Correo: string;
  idFuentes: number;
  Costo: number;
  codUsuario: string;
}

const Miembros: React.FC<MiembrosPadre> = ({
  selectedMember,
  setSelectedMember,
  setObjetoMiembro,
}) => {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [members, setMembers] = useState<Member[]>([]);
  const [fuentes, setFuentes] = useState<{ id: number; fuente: string }[]>([]);
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
      const { data, error } = await supabase
        .from("Miembros")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error al cargar miembros:", error);
        setMembers([]);
      } else {
        setMembers((data as Member[]) ?? []);
      }
      setLoadingMembers(false);
    };

    fetchMembers();
  }, []);

  useEffect(() => {
    const fetchFuentes = async () => {
      setLoadingFuentes(true);
      const { data, error } = await supabase
        .from("Fuentes")
        .select("id, Fuente")
        .order("Fuente", { ascending: true });

      if (error) {
        console.error("Error al cargar fuentes:", error.message, error.details, error.hint);
        setFuentes([]);
      } else if (data) {
        const mappedData = (data as Fuente[]).map((f) => ({
          id: f.id,
          fuente: f.Fuente,
        }));
        setFuentes(mappedData);
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
        member.Nombre.toLowerCase().includes(s) ||
        (member.codUsuario || "").toLowerCase().includes(s);

      const matchesFuente = selectedFuente === null || member.idFuentes === selectedFuente;

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
    return fuentes.find((f) => f.id === selectedFuente)?.fuente ?? null;
  }, [fuentes, selectedFuente]);

  return (
    <section className={style.section} aria-label="Miembros">
      {/* Header */}
      <div className={style.headerRow}>
        <div>
          <div className={style.kicker}>Directorio</div>
      
        </div>

        <div className={style.headerActions}>
          <div className={style.counter}>
            {loadingMembers ? "Cargando…" : `${filteredMembers.length} resultado(s)`}
          </div>

          <button type="button" className={style.clearBtn} onClick={clearFilters}>
            Limpiar
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className={style.filters}>
        <div className={style.searchWrap}>
          <span className={style.searchIcon} aria-hidden="true">⌕</span>
          <input
            type="text"
            placeholder="Buscar miembro por nombre o usuario…"
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
              {f.fuente}
            </option>
          ))}
        </select>
      </div>

      {/* Active filter chips */}
      {(fuenteLabel || searchTerm.trim()) && (
        <div className={style.chips}>
          {searchTerm.trim() && (
            <span className={style.chip}>
              Búsqueda: <b>{searchTerm.trim()}</b>
            </span>
          )}
          {fuenteLabel && (
            <span className={style.chip}>
              Fuente: <b>{fuenteLabel}</b>
            </span>
          )}
        </div>
      )}

      {/* States */}
      {loadingMembers ? (
        <div className={style.state}>
          <div className={style.spinner} aria-hidden="true" />
          <p>Cargando miembros…</p>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className={style.state}>
          <p>No hay resultados con los filtros actuales.</p>
        </div>
      ) : (
        <>
          {/* Grid */}
          <div className={style.grid}>
            {paginatedMembers.map((member) => {
              const selected = selectedMember === member.id;

              return (
                <button
                  key={member.id}
                  type="button"
                  className={`${style.card} ${selected ? style.cardSelected : ""}`}
                  onClick={() => {
                    setSelectedMember(member.id);
                    setObjetoMiembro(member as any);
                  }}
                >
                  <div className={style.cardTop}>
                    {member.Foto ? (
                      <img src={member.Foto} alt={member.Nombre} className={style.avatar} />
                    ) : (
                      <div className={style.avatarPlaceholder} aria-hidden="true">
                        {member.Nombre?.[0]?.toUpperCase() ?? "?"}
                      </div>
                    )}

                    <div className={style.cardInfo}>
                      <div className={style.nameRow}>
                        <h4 className={style.name}>{member.Nombre}</h4>
                        {selected && <span className={style.badge}>Seleccionado</span>}
                      </div>
                      <div className={style.role}>{member.Puesto}</div>
                      <div className={style.user}>{member.codUsuario}</div>
                    </div>
                  </div>

                  <p className={style.desc}>{member.Descripcion}</p>

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
            >
              Anterior
            </button>

            <div className={style.pageInfo}>
              Página <b>{safePage + 1}</b> de <b>{totalPages}</b>
            </div>

            <button
              type="button"
              onClick={handleNext}
              disabled={safePage >= totalPages - 1}
              className={style.pageBtn}
            >
              Siguiente
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
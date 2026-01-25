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
      const { data, error } = await supabase
        .from("miembros")
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
        .from("fuentes")
        .select("id, nombre")
        .order("nombre", { ascending: true });

      if (error) {
        console.error("Error al cargar fuentes:", error.message, error.details, error.hint);
        setFuentes([]);
      } else if (data) {
        const mappedData = (data as Fuente[]).map((f) => ({
          id: f.id,
          nombre: f.nombre,
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
              {f.nombre}
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
                    {member.foto ? (
                      <img src={member.foto} alt={member.nombre} className={style.avatar} />
                    ) : (
                      <div className={style.avatarPlaceholder} aria-hidden="true">
                        {member.nombre?.[0]?.toUpperCase() ?? "?"}
                      </div>
                    )}

                    <div className={style.cardInfo}>
                      <div className={style.nameRow}>
                        <h4 className={style.name}>{member.nombre}</h4>
                        {selected && <span className={style.badge}>Seleccionado</span>}
                      </div>
                      <div className={style.role}>{member.puesto}</div>
                      <div className={style.user}>{member.cod_usuario}</div>
                    </div>
                  </div>

                  <p className={style.desc}>{member.descripcion}</p>

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
"use client"

import React, { useState, useEffect } from "react";
import { Suspense } from "react";
import { supabase } from 'lib/supabaseClient'
import style from "app/styles/Miembros.module.css"
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";


import { ObjetoResumenPaquete } from "app/components/CtPaquetes";



interface MiembrosPadre {
  selectedMember: number | null;
  setSelectedMember: React.Dispatch<React.SetStateAction<number | null>>;
  
  // ✅ Corrige esta línea
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
    codUsuario: string
}

const Miembros: React.FC<MiembrosPadre> = ({ selectedMember, setSelectedMember, objetoMiembro, setObjetoMiembro }) => {
    const searchParams = useSearchParams();

    useEffect(() => {
        const param = searchParams.get('q'); // por ejemplo ?q=Juan
        if (param) setSearchTerm(param);
    }, [searchParams]);
    const router = useRouter();

    const handleSearchChange = (value: string) => {
        setSearchTerm(value);
        router.replace(`?q=${encodeURIComponent(value)}`);
    };
    const [members, setMembers] = useState<Member[]>([]);
    const [selectedFuente, setSelectedFuente] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [fuentes, setFuentes] = useState<{ id: number; fuente: string }[]>([]);
    const [page, setPage] = useState(0);
    const pageSize = 3;

    const filteredMembers = members.filter(member => {

        const matchesSearch =

            member.Nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            member.codUsuario.toLowerCase().includes(searchTerm.toLowerCase())
            
            
            ;
        const matchesFuente =
            selectedFuente === null || member.idFuentes === selectedFuente;
        return matchesSearch && matchesFuente;
    });

    const paginatedMembers = filteredMembers.slice(page * pageSize, (page + 1) * pageSize);

    const handlePrev = () => {
        if (page > 0) setPage(page - 1);
    };

    const handleNext = () => {
        if ((page + 1) * pageSize < filteredMembers.length) setPage(page + 1);
    };

    useEffect(() => {
        const fetchMembers = async () => {
            const { data, error } = await supabase
                .from('Miembros')
                .select('*')
                .order('created_at', { ascending: true });
            console.log('DATA:', data, 'ERROR:', error);

            if (error) {
                console.error('Error al cargar miembros:', error);
            } else if (data) {
                setMembers(data);
            }
        };

        fetchMembers();
    }, []);

    useEffect(() => {
        const fetchFuentes = async () => {
            const { data, error } = await supabase
                .from('Fuentes')
                .select('id, Fuente') // columna con F mayúscula
                .order('Fuente', { ascending: true });

            if (error) {
                console.error('Error al cargar fuentes:', error.message, error.details, error.hint);
            } else if (data) {
                // Mapear la columna 'Fuente' de Supabase a 'fuente' en React
                const mappedData = data.map((f: Fuente) => ({
                    id: f.id,
                    fuente: f.Fuente
                }));
                setFuentes(mappedData);
            }
        };

        fetchFuentes();
    }, []);

    return (



        <>
            <div className={style.ContenedorFiltroBusqueda}>

                <input
                    type="text"
                    placeholder="Buscar miembro por nombre..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={style.BusquedaEntrada}
                />


                <select
                    value={selectedFuente ?? ''}
                    onChange={(e) => setSelectedFuente(e.target.value ? Number(e.target.value) : null)}
                    className={style.FiltroSeleccionado}
                >
                    <option value="">Todas las fuentes</option>
                    {fuentes.map((f) => (
                        <option key={f.id} value={f.id}>
                            {f.fuente}
                        </option>
                    ))}
                </select>
            </div>


            <div className={style.GaleriaMiembros}>
                {members.length === 0 ? (
                    <p>Cargando miembros...</p>
                ) : (
                    paginatedMembers.map(member => (
                        <div
                            key={member.id}
                            className={`${style.TarjetaMiembro} ${selectedMember === member.id ? style.Seleccionado : ""}`}
                            onClick={() => {
                                setSelectedMember(member.id);
                                setObjetoMiembro(member)
                            }}
                        >
                            {member.Foto ? (
                                <img src={member.Foto} alt={member.Nombre} className={style.MiembroFoto} />
                            ) : (
                                <div className={style.MiembroFoto}></div>
                            )}
                            <h4 className={style.MiembroNombre}>{member.Nombre}</h4>
                            <p className={style.MiembroPosicion}>{member.Puesto}</p>
                            <p className={style.MiembroRecomendacion}>{member.Descripcion}</p>
                        </div>
                    ))
                )}
            </div>



            <div className={style.ControlesPaginacion}>
                <button onClick={handlePrev} disabled={page === 0} className={style.BotonPaginacion}>Anterior</button>
                <button onClick={handleNext} disabled={(page + 1) * pageSize >= filteredMembers.length} className={style.BotonPaginacion}>Siguiente</button>
            </div>

        </>
    );
};

export default function MiembrosWrapper(props: MiembrosPadre) {
  return (
    <Suspense fallback={<p>Cargando miembros...</p>}>
      <Miembros {...props} />
    </Suspense>
  );
}

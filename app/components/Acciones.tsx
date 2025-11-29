"use client";

import React, { useState, useEffect } from "react";
import { supabase } from 'lib/supabaseClient';
import style from "app/styles/Acciones.module.css"

interface AccionesPadre {
    selectedMember: number | null;
    showForm: boolean | null;
    setShowForm: React.Dispatch<React.SetStateAction<boolean>>;
    selectedAccion: Accion | null;
    setSelectedAccion: React.Dispatch<React.SetStateAction<Accion | null>>;
}

interface Accion {
    id: number;
    Accion: string;
    idMiembro: number;
    idFuente: number
}

const Acciones: React.FC<AccionesPadre> = ({ selectedMember,showForm,setShowForm,selectedAccion,setSelectedAccion}) => {
    const [acciones, setAcciones] = useState<Accion[]>([]);


    useEffect(() => {
        const fetchAcciones = async () => {
            if (!selectedMember) {
                setAcciones([]);
                return;
            }

            const { data, error } = await supabase
                .from('Acciones')
                .select('*')
                .eq('idMiembro', Number(selectedMember))
                .order('Accion', { ascending: true });

            if (error) {
                console.error('Error al cargar acciones:', error);
            } else {
                setAcciones(data || []);
            }
        };

        fetchAcciones();
    }, [selectedMember]);

    return (
        <div className={style.ContenedorAcciones}>
        
            <h2 className="AccionesTitulo">SELECCIONA LA ACCIÓN REQUERIDA</h2>
        
            
            
            <div className={style.AccionesLista}>
                {acciones.length === 0 ? (
                    <p className={style.NoAcciones}>No hay acciones registradas.</p>
                ) : (
                    acciones.map((accion) => (
                        <div
                            key={accion.id}
                            className={`${style.AccionesElemento} ${selectedAccion?.id === accion.id ? style.AccionSeleccionada : ''}`}
                            onClick={() => {
                                setSelectedAccion(accion);
                                setShowForm(true);
                                
                            }}
                        >
                            {accion.Accion}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default Acciones;
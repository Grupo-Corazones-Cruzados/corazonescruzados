'use client';

/**
 * LAS TARJETAS DE ROLES — tras elegir un mundo en la portada (Fernando, 2026-10-26: «después
 * de tomar el fondo aparezcan en tarjetas los roles que existen… según la lógica actual que
 * ya tenemos… usando los estilos del tema que corresponde»).
 *
 * Las opciones y sus estados (postularse / en revisión / aprobada, soy candidato, soy cliente
 * / verificación pendiente, miembro) salen de `useOpcionesAcceso`, la MISMA lista que pinta
 * `EntryChoiceModal`. Aquí solo cambia la presentación: tarjetas con el tema del mundo
 * (`.roles-aventura` / `.roles-progreso` en globals.css) y entrada escalonada.
 */

import { ArrowRight, Loader2 } from 'lucide-react';
import { useOpcionesAcceso, type AccionesAcceso } from '@/components/landing/opcionesAcceso';

export default function RolesMundo({
  tema,
  acciones,
  retrasoBase = 0,
}: {
  tema: 'aventura' | 'progreso';
  acciones: AccionesAcceso;
  /** ms antes de que empiece a entrar la primera tarjeta. */
  retrasoBase?: number;
}) {
  const opciones = useOpcionesAcceso(tema === 'aventura' ? 'game' : 'dashboard', acciones);

  return (
    <div className={`roles-mundo roles-${tema}`} style={{ ['--roles-n' as string]: opciones.length }}>
      {opciones.map((o, i) => {
        const estilo = { ['--retraso' as string]: `${retrasoBase + i * 90}ms` };
        if (o.cargando) {
          return (
            <div key={o.clave} className="rol-tarjeta rol-cargando aparecer" style={estilo} aria-busy="true">
              <Loader2 className="w-4 h-4 animate-spin" />
              {o.etiqueta}
            </div>
          );
        }
        const Icono = o.Icono;
        return (
          <button
            key={o.clave}
            type="button"
            onClick={o.onClick}
            className={`rol-tarjeta rol-${o.tono} aparecer`}
            style={estilo}
          >
            <span className="rol-icono"><Icono /></span>
            {o.insignia && <span className="rol-insignia">{o.insignia}</span>}
            <span className="rol-titulo">{o.titulo}</span>
            <span className="rol-desc">{o.descripcion}</span>
            <ArrowRight className="rol-flecha" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

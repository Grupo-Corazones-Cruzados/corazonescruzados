'use client';

import Link from 'next/link';
import { BookOpenText, Plus, CalendarCheck, Sparkles, Users } from 'lucide-react';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Tarjeta, Tabla, Insignia, EstadoVacio, BOTON_PRIMARIO } from '@/componentes/ui';
import { Cifra } from '@/componentes/campos';
import { ETIQUETA_NIVEL, ETIQUETA_ESTADO_SEMANA } from '@/lib/catalogo';
import { cn } from '@/lib/utils';
import type { Nivel, EstadoSemana } from '@/generated/prisma/enums';

export type DatosPanel = {
  slug: string;
  nombre: string;
  planificaciones: number;
  semanasListas: number;
  semanasEnCurso: number;
  cupo: { tope: number | null; usadas: number; quedan: number | null };
  cuentas: { tope: number | null; usadas: number };
  docentes: { id: number; nombre: string; planificaciones: number; semanas: number; materias: string[] }[];
  materias: { materia: string; nivel: Nivel; planificaciones: number; semanas: number }[];
  recientes: { id: number; cuando: string; docente: string; planificacionId: number; materia: string; orden: number; tema: string | null; estado: EstadoSemana }[];
};

/**
 * El tablero (Fernando, 2026-09-15): cuántas planificaciones se han creado, qué
 * usuarios de la institución han generado y de qué materia. Y el tope de la
 * semana, que se enseña siempre, no solo cuando estorba.
 */
export default function PanelCliente({ d }: { d: DatosPanel }) {
  return (
    <>
      <CabeceraPagina
        titulo="Inicio"
        descripcion={`Hola, ${d.nombre.split(' ')[0]}. Esto es lo que lleva la institución.`}
        acciones={
          <Link href={`/${d.slug}/planificaciones?nueva=1`} className={cn(BOTON_PRIMARIO, 'h-8 px-3 text-[13px]')}>
            <Plus className="h-4 w-4" /> Nueva planificación
          </Link>
        }
      />
      {/* Alto completo: la última tarjeta se alarga hasta el pie (regla del panel, 2026-11-08). */}
      <div className="flex flex-1 flex-col gap-3 px-4 py-5 sm:px-6">
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
          <Cifra icono={BookOpenText} etiqueta="Planificaciones" valor={d.planificaciones} />
          <Cifra icono={CalendarCheck} etiqueta="Semanas redactadas" valor={d.semanasListas} pista={d.semanasEnCurso ? `${d.semanasEnCurso} en curso` : undefined} />
          <Cifra
            icono={Sparkles}
            etiqueta="Esta semana"
            valor={d.cupo.tope === null ? d.cupo.usadas : `${d.cupo.usadas} de ${d.cupo.tope}`}
            pista={d.cupo.tope === null ? 'Generadas' : 'Generadas · vuelve a cero el lunes'}
            destacado={d.cupo.quedan !== null && d.cupo.quedan <= 5}
          />
          <Cifra icono={Users} etiqueta="Cuentas" valor={d.cuentas.tope === null ? d.cuentas.usadas : `${d.cuentas.usadas} de ${d.cuentas.tope}`} />
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          <Tarjeta className="overflow-hidden">
            <h2 className="border-b border-borde px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-tenue">Por docente</h2>
            <Tabla
              filas={d.docentes}
              claveFila={(u) => u.id}
              recuento={`${d.docentes.length} ${d.docentes.length === 1 ? 'docente' : 'docentes'}`}
              vacio={<EstadoVacio icono={BookOpenText} titulo="Nadie ha planificado todavía" />}
              columnas={[
                { clave: 'nombre', titulo: 'Docente', ancho: '34%', render: (u) => <span className="font-semibold">{u.nombre}</span> },
                { clave: 'pl', titulo: 'Planif.', ancho: '16%', alinear: 'der', render: (u) => u.planificaciones },
                { clave: 'sem', titulo: 'Semanas', ancho: '16%', alinear: 'der', render: (u) => u.semanas },
                { clave: 'mat', titulo: 'Materias', ancho: '34%', render: (u) => <span className="block truncate text-tenue" title={u.materias.join(' · ')}>{u.materias.join(' · ') || '—'}</span> },
              ]}
            />
          </Tarjeta>

          <Tarjeta className="overflow-hidden">
            <h2 className="border-b border-borde px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-tenue">Por materia</h2>
            <Tabla
              filas={d.materias}
              claveFila={(m) => `${m.materia}-${m.nivel}`}
              recuento={`${d.materias.length} ${d.materias.length === 1 ? 'materia' : 'materias'}`}
              vacio={<EstadoVacio titulo="Sin materias todavía" />}
              columnas={[
                { clave: 'materia', titulo: 'Materia', ancho: '40%', render: (m) => <span className="block truncate font-semibold">{m.materia}</span> },
                { clave: 'nivel', titulo: 'Nivel', ancho: '28%', render: (m) => <Insignia tono="info">{ETIQUETA_NIVEL[m.nivel]}</Insignia> },
                { clave: 'n', titulo: 'Planif.', ancho: '16%', alinear: 'der', render: (m) => m.planificaciones },
                { clave: 's', titulo: 'Semanas', ancho: '16%', alinear: 'der', render: (m) => m.semanas },
              ]}
            />
          </Tarjeta>
        </div>

        <Tarjeta className="flex flex-1 flex-col overflow-hidden">
          <h2 className="border-b border-borde px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-tenue">Últimas semanas</h2>
          <div className="flex flex-1 flex-col">
            <Tabla
              filas={d.recientes}
              claveFila={(s) => s.id}
              vacio={<div className="flex flex-1 flex-col justify-center"><EstadoVacio titulo="Todavía no hay semanas" /></div>}
              columnas={[
                { clave: 'cuando', titulo: 'Cuándo', ancho: '16%', render: (s) => <span className="text-tenue">{s.cuando}</span> },
                { clave: 'quien', titulo: 'Docente', ancho: '20%', render: (s) => <span className="block truncate">{s.docente}</span> },
                {
                  clave: 'que',
                  titulo: 'Planificación',
                  ancho: '24%',
                  render: (s) => (
                    <Link href={`/${d.slug}/planificaciones?p=${s.planificacionId}&s=${s.id}&quien=todas`} className="block truncate font-semibold text-acento hover:underline">
                      {s.materia} · Semana {s.orden}
                    </Link>
                  ),
                },
                { clave: 'tema', titulo: 'Tema', ancho: '28%', render: (s) => <span className="block truncate text-tenue">{s.tema?.split('\n')[0] ?? '—'}</span> },
                { clave: 'estado', titulo: 'Estado', ancho: '12%', render: (s) => <Insignia tono={s.estado === 'LISTA' ? 'exito' : s.estado === 'ERROR' ? 'error' : 'aviso'}>{ETIQUETA_ESTADO_SEMANA[s.estado]}</Insignia> },
              ]}
            />
          </div>
        </Tarjeta>
      </div>
    </>
  );
}

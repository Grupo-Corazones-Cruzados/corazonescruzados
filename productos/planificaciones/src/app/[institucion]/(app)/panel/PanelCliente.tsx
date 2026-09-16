'use client';

import Link from 'next/link';
import { BookOpenText, Plus } from 'lucide-react';
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
      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Cifra etiqueta="Planificaciones creadas" valor={d.planificaciones} destacado />
          <Cifra etiqueta="Semanas redactadas" valor={d.semanasListas} pista={d.semanasEnCurso ? `${d.semanasEnCurso} redactándose ahora` : undefined} />
          <Cifra
            etiqueta="Esta semana"
            valor={d.cupo.tope === null ? d.cupo.usadas : `${d.cupo.usadas} de ${d.cupo.tope}`}
            pista={d.cupo.tope === null ? 'planificaciones semanales generadas' : 'planificaciones semanales generadas · el contador vuelve a cero el lunes'}
            destacado={d.cupo.quedan !== null && d.cupo.quedan <= 5}
          />
          <Cifra etiqueta="Cuentas" valor={d.cuentas.tope === null ? d.cuentas.usadas : `${d.cuentas.usadas} de ${d.cuentas.tope}`} pista="docentes y administración" />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Tarjeta className="overflow-hidden">
            <div className="border-b border-borde px-4 py-3">
              <h2 className="text-[13px] font-semibold">Quién ha planificado</h2>
              <p className="text-[12px] text-tenue">Por docente: planificaciones, semanas redactadas y materias.</p>
            </div>
            <Tabla
              filas={d.docentes}
              claveFila={(u) => u.id}
              vacio={<EstadoVacio icono={BookOpenText} titulo="Nadie ha planificado todavía" detalle="La primera planificación aparecerá aquí con su docente y su materia." />}
              columnas={[
                { clave: 'nombre', titulo: 'Docente', render: (u) => <span className="font-semibold">{u.nombre}</span> },
                { clave: 'pl', titulo: 'Planificaciones', alinear: 'der', render: (u) => u.planificaciones },
                { clave: 'sem', titulo: 'Semanas', alinear: 'der', render: (u) => u.semanas },
                { clave: 'mat', titulo: 'Materias', render: (u) => <span className="text-tenue">{u.materias.join(' · ') || '—'}</span> },
              ]}
            />
          </Tarjeta>

          <Tarjeta className="overflow-hidden">
            <div className="border-b border-borde px-4 py-3">
              <h2 className="text-[13px] font-semibold">Por materia</h2>
              <p className="text-[12px] text-tenue">Cuántas planificaciones y semanas hay de cada área.</p>
            </div>
            <Tabla
              filas={d.materias}
              claveFila={(m) => `${m.materia}-${m.nivel}`}
              vacio={<EstadoVacio titulo="Sin materias todavía" />}
              columnas={[
                { clave: 'materia', titulo: 'Materia', render: (m) => <span className="font-semibold">{m.materia}</span> },
                { clave: 'nivel', titulo: 'Nivel', render: (m) => <Insignia tono="info">{ETIQUETA_NIVEL[m.nivel]}</Insignia> },
                { clave: 'n', titulo: 'Planificaciones', alinear: 'der', render: (m) => m.planificaciones },
                { clave: 's', titulo: 'Semanas', alinear: 'der', render: (m) => m.semanas },
              ]}
            />
          </Tarjeta>
        </div>

        <Tarjeta className="overflow-hidden">
          <div className="border-b border-borde px-4 py-3">
            <h2 className="text-[13px] font-semibold">Últimas solicitudes</h2>
            <p className="text-[12px] text-tenue">Las planificaciones semanales más recientes de toda la institución.</p>
          </div>
          <Tabla
            filas={d.recientes}
            claveFila={(s) => s.id}
            vacio={<EstadoVacio titulo="Todavía no hay solicitudes" />}
            columnas={[
              { clave: 'cuando', titulo: 'Cuándo', render: (s) => <span className="text-tenue">{s.cuando}</span> },
              { clave: 'quien', titulo: 'Docente', render: (s) => s.docente },
              {
                clave: 'que',
                titulo: 'Planificación',
                render: (s) => (
                  <Link href={`/${d.slug}/planificaciones?p=${s.planificacionId}&s=${s.id}&quien=todas`} className="font-semibold text-acento hover:underline">
                    {s.materia} · Semana {s.orden}
                  </Link>
                ),
              },
              { clave: 'tema', titulo: 'Tema', render: (s) => <span className="text-tenue">{s.tema?.split('\n')[0] ?? '—'}</span> },
              { clave: 'estado', titulo: 'Estado', render: (s) => <Insignia tono={s.estado === 'LISTA' ? 'exito' : s.estado === 'ERROR' ? 'error' : 'aviso'}>{ETIQUETA_ESTADO_SEMANA[s.estado]}</Insignia> },
            ]}
          />
        </Tarjeta>
      </div>
    </>
  );
}

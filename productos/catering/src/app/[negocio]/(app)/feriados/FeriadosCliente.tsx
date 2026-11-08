'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CalendarOff, Plus, Pencil, Trash2, Download, Save } from 'lucide-react';
import { CabeceraPagina, MenuFila } from '@/componentes/Navegacion';
import { Boton, BotonEliminar, Tarjeta, PanelLateral, PieAcciones, Confirmar, Campo, Entrada, Selector, EstadoVacio, Insignia, Tabla } from '@/componentes/ui';
import { Aviso, Casilla } from '@/componentes/campos';
import { fechaLarga } from '@/lib/fechas';
import { guardarFeriado, eliminarFeriado, cargarFeriadosEcuador } from '@/acciones/feriados';

type Feriado = { id: number; fecha: string; nombre: string; esLaborable: boolean };

export default function FeriadosCliente({ slug, anio, anioHoy, feriados }: { slug: string; anio: number; anioHoy: number; feriados: Feriado[] }) {
  const router = useRouter();
  const [panel, setPanel] = useState<Feriado | 'nuevo' | null>(null);
  const [laborable, setLaborable] = useState(false);
  const [borrar, setBorrar] = useState<Feriado | null>(null);
  const [cargar, setCargar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enCurso, arranca] = useTransition();
  const abrir = (f: Feriado | 'nuevo') => { setError(null); setLaborable(f === 'nuevo' ? false : f.esLaborable); setPanel(f); };

  return (
    <div className="flex flex-1 flex-col">
      <CabeceraPagina titulo="Feriados" descripcion="Un feriado no laborable no consume día del servicio ni hay entregas. Si se trabaja, se marca como laborable."
        menu={[{ etiqueta: 'Cargar los de Ecuador', icono: Download, alPulsar: () => setCargar(true) }]}
        acciones={<Boton icono={Plus} onClick={() => abrir('nuevo')}>Nuevo feriado</Boton>} />
      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-6">
        <Selector value={anio} onChange={(e) => router.push(`/${slug}/feriados?anio=${e.target.value}`)} aria-label="Año" className="w-full sm:w-40">
          {[anioHoy - 1, anioHoy, anioHoy + 1, anioHoy + 2].map((a) => <option key={a} value={a}>{a}</option>)}
        </Selector>
        {/* La tarjeta de la lista llega hasta el pie (regla 2026-11-08). */}
        <Tarjeta className="flex flex-1 flex-col overflow-hidden">
          <Tabla
            filas={feriados}
            claveFila={(f) => f.id}
            alPulsarFila={abrir}
            recuento={`${feriados.length} ${feriados.length === 1 ? 'feriado' : 'feriados'} en ${anio}`}
            vacio={<div className="flex flex-1 items-center justify-center"><EstadoVacio icono={CalendarOff} titulo={`Sin feriados en ${anio}`} accion={<Boton icono={Download} onClick={() => setCargar(true)}>Cargar los de Ecuador</Boton>} /></div>}
            columnas={[
              { clave: 'fecha', titulo: 'Día', render: (f) => <span className="first-letter:uppercase">{fechaLarga(f.fecha)}</span> },
              { clave: 'nombre', titulo: 'Feriado', render: (f) => <span className="font-semibold">{f.nombre}</span> },
              { clave: 'lab', titulo: 'Servicio', render: (f) => <Insignia tono={f.esLaborable ? 'exito' : 'error'}>{f.esLaborable ? 'Se trabaja' : 'Sin servicio'}</Insignia> },
              // Acciones de fila = «⋯» siempre (regla 2026-11-08).
              { clave: 'acc', titulo: '', ancho: '56px', alinear: 'der', render: (f) => (
                <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                  <MenuFila acciones={[
                    { etiqueta: 'Editar', icono: Pencil, alPulsar: () => abrir(f) },
                    { etiqueta: 'Eliminar', icono: Trash2, peligro: true, alPulsar: () => setBorrar(f) },
                  ]} />
                </div>
              ) },
            ]}
          />
        </Tarjeta>
      </div>

      <PanelLateral abierto={panel !== null} alCerrar={() => setPanel(null)} titulo={panel === 'nuevo' ? 'Nuevo feriado' : 'Editar feriado'} ancho="sm"
        pie={
          <PieAcciones eliminar={panel && panel !== 'nuevo' ? <BotonEliminar titulo="Eliminar el feriado" onClick={() => { const f = panel; setPanel(null); setBorrar(f); }} disabled={enCurso} /> : undefined}>
            <Boton variante="secundario" onClick={() => setPanel(null)} disabled={enCurso}>Cancelar</Boton>
            <Boton type="submit" form="form-feriado" icono={Save} disabled={enCurso}>{enCurso ? 'Guardando…' : 'Guardar'}</Boton>
          </PieAcciones>
        }>
        {panel && (
          <form id="form-feriado" action={(d) => arranca(async () => {
            setError(null); d.set('esLaborable', laborable ? 'true' : 'false');
            const r = await guardarFeriado(slug, panel === 'nuevo' ? null : panel.id, d);
            if (!r.ok) return setError(r.error);
            setPanel(null); toast.success('Guardado.'); router.refresh();
          })} className="space-y-4">
            <Campo etiqueta="Día" requerido><Entrada name="fecha" type="date" defaultValue={panel === 'nuevo' ? `${anio}-01-01` : panel.fecha} required /></Campo>
            <Campo etiqueta="Nombre" requerido><Entrada name="nombre" defaultValue={panel === 'nuevo' ? '' : panel.nombre} required autoFocus /></Campo>
            <Casilla etiqueta="Se trabaja" marcado={laborable} alCambiar={setLaborable} />
            {error && <Aviso texto={error} />}
          </form>
        )}
      </PanelLateral>

      <Confirmar abierto={cargar} titulo={`¿Cargar los de Ecuador ${anio}?`} mensaje="Se añaden los nacionales como no laborables; los que ya existan no se tocan." textoAceptar="Cargar" peligro={false} ocupado={enCurso}
        alCerrar={() => setCargar(false)}
        alAceptar={() => arranca(async () => { const r = await cargarFeriadosEcuador(slug, anio); setCargar(false); if (!r.ok) { toast.error(r.error); return; } toast.success(`${r.creados} feriado${r.creados === 1 ? '' : 's'} nuevo${r.creados === 1 ? '' : 's'}`); router.refresh(); })} />

      <Confirmar abierto={borrar !== null} titulo="¿Eliminar el feriado?" mensaje={`«${borrar?.nombre}» vuelve a ser un día de servicio.`} ocupado={enCurso}
        alCerrar={() => setBorrar(null)}
        alAceptar={() => arranca(async () => { if (!borrar) return; const r = await eliminarFeriado(slug, borrar.id); setBorrar(null); if (!r.ok) { toast.error(r.error); return; } toast.success('Eliminado.'); router.refresh(); })} />
    </div>
  );
}

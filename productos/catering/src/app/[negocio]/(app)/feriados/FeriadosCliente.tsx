'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CalendarOff, Plus, Pencil, Trash2, Download } from 'lucide-react';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Boton, BotonIcono, Tarjeta, PanelLateral, Confirmar, Campo, Entrada, Selector, EstadoVacio, Insignia, Tabla } from '@/componentes/ui';
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
    <>
      <CabeceraPagina titulo="Feriados" descripcion="Un feriado no laborable no consume día del servicio y no hay entregas. Si el negocio decide trabajarlo, se marca como laborable."
        acciones={<><Boton variante="secundario" icono={Download} onClick={() => setCargar(true)}>Cargar los de Ecuador</Boton><Boton icono={Plus} onClick={() => abrir('nuevo')}>Nuevo feriado</Boton></>} />
      <div className="space-y-4 p-4 sm:p-6">
        <Tarjeta className="flex items-center gap-3 p-3">
          <span className="text-[12px] font-semibold text-tenue">Año</span>
          <Selector value={anio} onChange={(e) => router.push(`/${slug}/feriados?anio=${e.target.value}`)} className="w-32">
            {[anioHoy - 1, anioHoy, anioHoy + 1, anioHoy + 2].map((a) => <option key={a} value={a}>{a}</option>)}
          </Selector>
          <span className="text-[12px] text-tenue">{feriados.length} feriado{feriados.length === 1 ? '' : 's'}</span>
        </Tarjeta>
        <Tarjeta className="overflow-hidden">
          <Tabla
            filas={feriados}
            claveFila={(f) => f.id}
            vacio={<EstadoVacio icono={CalendarOff} titulo={`Sin feriados en ${anio}`} detalle="Carga los nacionales de Ecuador con un clic y añade los locales a mano." accion={<Boton icono={Download} onClick={() => setCargar(true)}>Cargar los de Ecuador</Boton>} />}
            columnas={[
              { clave: 'fecha', titulo: 'Día', render: (f) => <span className="first-letter:uppercase">{fechaLarga(f.fecha)}</span> },
              { clave: 'nombre', titulo: 'Feriado', render: (f) => <span className="font-semibold">{f.nombre}</span> },
              { clave: 'lab', titulo: 'Servicio', render: (f) => <Insignia tono={f.esLaborable ? 'exito' : 'error'}>{f.esLaborable ? 'Se trabaja' : 'Sin servicio'}</Insignia> },
              { clave: 'acc', titulo: '', alinear: 'der', render: (f) => <span className="flex justify-end gap-1"><BotonIcono icono={Pencil} titulo="Editar" onClick={() => abrir(f)} /><BotonIcono icono={Trash2} titulo="Eliminar" className="hover:bg-error-suave hover:text-error" onClick={() => setBorrar(f)} /></span> },
            ]}
          />
        </Tarjeta>
      </div>

      <PanelLateral abierto={panel !== null} alCerrar={() => setPanel(null)} titulo={panel === 'nuevo' ? 'Nuevo feriado' : 'Editar feriado'} ancho="sm"
        pie={<><Boton variante="secundario" onClick={() => setPanel(null)} disabled={enCurso}>Cancelar</Boton><Boton type="submit" form="form-feriado" disabled={enCurso}>{enCurso ? 'Guardando…' : 'Guardar'}</Boton></>}>
        {panel && (
          <form id="form-feriado" action={(d) => arranca(async () => {
            setError(null); d.set('esLaborable', laborable ? 'true' : 'false');
            const r = await guardarFeriado(slug, panel === 'nuevo' ? null : panel.id, d);
            if (!r.ok) return setError(r.error);
            setPanel(null); toast.success('Feriado guardado'); router.refresh();
          })} className="space-y-4">
            <Campo etiqueta="Día" requerido><Entrada name="fecha" type="date" defaultValue={panel === 'nuevo' ? `${anio}-01-01` : panel.fecha} required /></Campo>
            <Campo etiqueta="Nombre" requerido><Entrada name="nombre" defaultValue={panel === 'nuevo' ? '' : panel.nombre} required autoFocus /></Campo>
            <Casilla etiqueta="Se trabaja ese día" descripcion="Marcado, el negocio reparte y el día consume del servicio." marcado={laborable} alCambiar={setLaborable} />
            {error && <Aviso texto={error} />}
          </form>
        )}
      </PanelLateral>

      <Confirmar abierto={cargar} titulo={`Cargar los feriados de Ecuador ${anio}`} mensaje="Se añaden los nacionales (fijos, Carnaval y Viernes Santo) como no laborables. Los que ya existan se dejan como están; después puedes ajustar los que se muevan por decreto." textoAceptar="Cargar" peligro={false} ocupado={enCurso}
        alCerrar={() => setCargar(false)}
        alAceptar={() => arranca(async () => { const r = await cargarFeriadosEcuador(slug, anio); setCargar(false); if (!r.ok) { toast.error(r.error); return; } toast.success(`${r.creados} feriado${r.creados === 1 ? '' : 's'} nuevo${r.creados === 1 ? '' : 's'}`); router.refresh(); })} />

      <Confirmar abierto={borrar !== null} titulo="Eliminar el feriado" mensaje={`«${borrar?.nombre}» vuelve a ser un día normal: contará como día de servicio.`} ocupado={enCurso}
        alCerrar={() => setBorrar(null)}
        alAceptar={() => arranca(async () => { if (!borrar) return; const r = await eliminarFeriado(slug, borrar.id); setBorrar(null); if (!r.ok) { toast.error(r.error); return; } toast.success('Feriado eliminado'); router.refresh(); })} />
    </>
  );
}

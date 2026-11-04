'use client';

import { useEffect, useState } from 'react';
import PixelModal from '@/components/ui/PixelModal';
import PixelInput from '@/components/ui/PixelInput';
import PieAcciones from '@/components/ui/PieAcciones';
import Interruptor from '@/components/ui/Interruptor';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { TONO } from '@/components/ui/tonos';
import { api, type Proyecto } from './api';

/** Alta y edición de un proyecto. Quitarlo de la lista no toca su carpeta ni sus sesiones. */
export default function PanelProyecto({ abierto, proyecto, alCerrar, alCambiar }: {
  abierto: boolean;
  proyecto: Proyecto | null;
  alCerrar: () => void;
  alCambiar: () => void;
}) {
  const [ruta, setRuta] = useState('');
  const [nombre, setNombre] = useState('');
  const [grupo, setGrupo] = useState('');
  const [aislado, setAislado] = useState(false);
  const [error, setError] = useState('');
  const [detectados, setDetectados] = useState<{ ruta: string; nombre: string; grupo: string }[]>([]);

  useEffect(() => {
    if (!abierto) return;
    setRuta(proyecto?.ruta || ''); setNombre(proyecto?.nombre || ''); setGrupo(proyecto?.grupo || ''); setAislado(proyecto?.aislado ?? false); setError('');
    if (!proyecto) api('/proyectos/detectados').then((j) => setDetectados(j.detectados)).catch(() => setDetectados([]));
  }, [abierto, proyecto]);

  function elegirRuta(valor: string) {
    setRuta(valor);
    const d = detectados.find((x) => x.ruta === valor);
    if (d) { setNombre(d.nombre); setGrupo(d.grupo); }
  }

  async function guardar() {
    setError('');
    try {
      if (proyecto) await api(`/proyectos/${proyecto.id}`, { metodo: 'PATCH', cuerpo: { nombre, grupo, aislado } });
      else await api('/proyectos', { cuerpo: { ruta: ruta.trim(), nombre: nombre.trim() || undefined, grupo: grupo.trim() || undefined, aislado } });
      alCambiar(); alCerrar();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar.'); }
  }

  async function quitar() {
    if (!proyecto) return;
    try { await api(`/proyectos/${proyecto.id}`, { metodo: 'DELETE' }); alCambiar(); alCerrar(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo quitar.'); }
  }

  return (
    <PixelModal open={abierto} onClose={alCerrar} title={proyecto ? 'Editar proyecto' : 'Agregar proyecto'} size="md"
      pie={<PieAcciones onEliminar={proyecto ? quitar : undefined} etiquetaEliminar="Quitar de la lista">
        <button type="button" className={BTN_SECONDARY} onClick={alCerrar}>Cancelar</button>
        <button type="button" className={BTN_PRIMARY} onClick={guardar} disabled={!proyecto && !ruta.trim()}>Guardar</button>
      </PieAcciones>}>
      <div className="space-y-4">
        {proyecto
          ? <div><p className="text-[12px] font-medium text-digi-muted mb-1">Carpeta</p><p className="text-[13px] font-mono break-all text-digi-text">{proyecto.ruta}</p></div>
          : <>
              <PixelInput label="Carpeta" list="espacio-detectados" value={ruta} onChange={(e) => elegirRuta(e.target.value)} placeholder="/Users/…" />
              <datalist id="espacio-detectados">{detectados.map((d) => <option key={d.ruta} value={d.ruta}>{d.nombre}</option>)}</datalist>
            </>}
        <PixelInput label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <PixelInput label="Cliente" value={grupo} onChange={(e) => setGrupo(e.target.value)} />
        <div className="flex items-center justify-between gap-3" title="Aislado, no sale de su carpeta ni se conecta directo a una base de datos. Se aplica al abrir o retomar una sesión.">
          <span className="text-[13px] text-digi-text">Aislar este proyecto</span>
          <Interruptor activo={aislado} onChange={setAislado} etiqueta="Aislar este proyecto" />
        </div>
        {error && <p className={`text-[13px] ${TONO.error.texto}`}>{error}</p>}
      </div>
    </PixelModal>
  );
}

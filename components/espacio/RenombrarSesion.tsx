'use client';

import { useEffect, useState, type FormEvent } from 'react';
import PixelModal from '@/components/ui/PixelModal';
import PixelInput from '@/components/ui/PixelInput';
import PieAcciones from '@/components/ui/PieAcciones';
import PixelConfirm from '@/components/ui/PixelConfirm';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { TONO } from '@/components/ui/tonos';
import { api, EVENTO_ELIMINADA, EVENTO_TITULO } from './api';

export interface SesionARenombrar { id: string; proyecto: string; titulo: string }

/** Cambiar el nombre de una sesión, o eliminarla. Quien la esté mostrando se entera por el evento. */
export default function RenombrarSesion({ sesion, alCerrar }: { sesion: SesionARenombrar | null; alCerrar: () => void }) {
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  // Solo al abrir: quien la muestra se redibuja a menudo mientras la sesión trabaja.
  const abierta = sesion?.id;
  useEffect(() => {
    if (abierta) { setNombre(sesion.titulo); setError(''); setConfirmando(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta]);

  async function guardar(e?: FormEvent) {
    e?.preventDefault();
    const titulo = nombre.trim();
    if (!sesion || !titulo || guardando) return;
    setGuardando(true);
    try {
      await api(`/sesiones/${sesion.id}/titulo`, { cuerpo: { proyecto: sesion.proyecto, titulo } });
      window.dispatchEvent(new CustomEvent(EVENTO_TITULO, { detail: { id: sesion.id, titulo } }));
      alCerrar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    setConfirmando(false);
    if (!sesion || guardando) return;
    setGuardando(true);
    try {
      await api(`/sesiones/${sesion.id}/eliminar`, { cuerpo: { proyecto: sesion.proyecto } });
      window.dispatchEvent(new CustomEvent(EVENTO_ELIMINADA, { detail: { id: sesion.id } }));
      alCerrar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
    <PixelModal open={!!sesion} onClose={alCerrar} title="Cambiar nombre" size="sm"
      pie={<PieAcciones onEliminar={() => setConfirmando(true)} etiquetaEliminar="Eliminar sesión" eliminarDeshabilitado={guardando}><button type="button" className={BTN_SECONDARY} onClick={alCerrar}>Cancelar</button><button type="button" className={BTN_PRIMARY} disabled={!nombre.trim() || guardando} onClick={() => guardar()}>Guardar</button></PieAcciones>}>
      <form onSubmit={guardar}>
        <PixelInput label="Nombre" value={nombre} maxLength={200} autoFocus onChange={(e) => setNombre(e.target.value)} />
        {error && <p className={`mt-2 text-[12px] ${TONO.error.texto}`}>{error}</p>}
      </form>
    </PixelModal>
    <PixelConfirm open={confirmando} title="Eliminar sesión" danger confirmLabel="Eliminar" onCancel={() => setConfirmando(false)} onConfirm={eliminar}
      message={`«${sesion?.titulo ?? ''}» sale de la lista aquí y en la terminal. Se guarda 30 días en la papelera del Espacio por si fue un error; después se borra.`} />
    </>
  );
}

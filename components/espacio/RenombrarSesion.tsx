'use client';

import { useEffect, useState, type FormEvent } from 'react';
import PixelModal from '@/components/ui/PixelModal';
import PixelInput from '@/components/ui/PixelInput';
import PieAcciones from '@/components/ui/PieAcciones';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { TONO } from '@/components/ui/tonos';
import { api, EVENTO_TITULO } from './api';

export interface SesionARenombrar { id: string; proyecto: string; titulo: string }

/** Cambiar el nombre de una sesión. Quien la esté mostrando se entera por el evento. */
export default function RenombrarSesion({ sesion, alCerrar }: { sesion: SesionARenombrar | null; alCerrar: () => void }) {
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  // Solo al abrir: quien la muestra se redibuja a menudo mientras la sesión trabaja.
  const abierta = sesion?.id;
  useEffect(() => {
    if (abierta) { setNombre(sesion.titulo); setError(''); }
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

  return (
    <PixelModal open={!!sesion} onClose={alCerrar} title="Cambiar nombre" size="sm"
      pie={<PieAcciones><button type="button" className={BTN_SECONDARY} onClick={alCerrar}>Cancelar</button><button type="button" className={BTN_PRIMARY} disabled={!nombre.trim() || guardando} onClick={() => guardar()}>Guardar</button></PieAcciones>}>
      <form onSubmit={guardar}>
        <PixelInput label="Nombre" value={nombre} maxLength={200} autoFocus onChange={(e) => setNombre(e.target.value)} />
        {error && <p className={`mt-2 text-[12px] ${TONO.error.texto}`}>{error}</p>}
      </form>
    </PixelModal>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { pedirNormal, type Pedir, type Reminder } from './comun';

/**
 * LA LÓGICA DE LOS RECORDATORIOS, UNA SOLA VEZ: lista, detalle, tareas, completar, editar y borrar.
 * La usan el módulo y el panel del Espacio de trabajo, para que no acaben siendo dos cosas distintas.
 */
export function useRecordatorios(pedir: Pedir = pedirNormal) {
  const [list, setList] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorLista, setErrorLista] = useState('');

  const [selected, setSelected] = useState<Reminder | null>(null);
  const [selDetail, setSelDetail] = useState<Reminder | null>(null);
  const [selLoading, setSelLoading] = useState(false);

  const [form, setForm] = useState<{ abierto: boolean; datos: Reminder | null }>({ abierto: false, datos: null });

  const fetchList = useCallback(async () => {
    try {
      const r = await pedir('/api/reminders');
      const d = await r.json();
      // Un fallo no se puede leer como «no tienes recordatorios».
      if (!r.ok) throw new Error(d.error);
      setList(d.data || []);
      setErrorLista('');
    } catch { setErrorLista('Error al cargar recordatorios'); toast.error('Error al cargar recordatorios'); }
    finally { setLoading(false); }
  }, [pedir]);
  useEffect(() => { fetchList(); }, [fetchList]);

  const selectReminder = useCallback(async (r: Reminder) => {
    setSelected(r); setSelDetail(null); setSelLoading(true);
    try {
      const res = await pedir(`/api/reminders/${r.id}`);
      const { data } = await res.json();
      setSelDetail(data || null);
    } catch { setSelDetail(null); }
    finally { setSelLoading(false); }
  }, [pedir]);

  const cerrarDetalle = useCallback(() => { setSelected(null); setSelDetail(null); }, []);

  const openCreate = useCallback(() => setForm({ abierto: true, datos: null }), []);
  const openEdit = useCallback(async (id: number) => {
    try {
      const r = await pedir(`/api/reminders/${id}`);
      const { data } = await r.json();
      setForm({ abierto: true, datos: data });
    } catch { toast.error('Error al abrir el recordatorio'); }
  }, [pedir]);
  const cerrarForm = useCallback(() => setForm((f) => ({ ...f, abierto: false })), []);

  const alGuardar = useCallback(async (id: number | null) => {
    cerrarForm();
    await fetchList();
    if (id && selected?.id === id) selectReminder({ id } as Reminder);
  }, [cerrarForm, fetchList, selected?.id, selectReminder]);

  const del = useCallback(async (id: number) => {
    try {
      await pedir(`/api/reminders/${id}`, { method: 'DELETE' });
      toast.success('Recordatorio eliminado');
      cerrarForm();
      if (selected?.id === id) cerrarDetalle();
      fetchList();
    } catch { toast.error('Error al eliminar'); }
  }, [pedir, cerrarForm, selected?.id, cerrarDetalle, fetchList]);

  // Cambia el estado (completado ↔ activo) y refresca lista + detalle.
  const setStatus = useCallback(async (id: number, status: 'done' | 'active') => {
    try {
      await pedir(`/api/reminders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      toast.success(status === 'done' ? 'Marcado como completado' : 'Reactivado');
      await fetchList();
      if (selected?.id === id) selectReminder({ id } as Reminder);
    } catch { toast.error('Error'); }
  }, [pedir, fetchList, selected?.id, selectReminder]);

  // Marca/desmarca una tarea desde el detalle (persiste).
  const toggleDetailTask = useCallback(async (taskId: string) => {
    if (!selDetail) return;
    const next = (selDetail.tasks || []).map((t) => (t.id === taskId ? { ...t, done: !t.done } : t));
    setSelDetail({ ...selDetail, tasks: next });
    try {
      await pedir(`/api/reminders/${selDetail.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tasks: next }) });
      setList((prev) => prev.map((r) => (r.id === selDetail.id ? { ...r, tasks: next } : r)));
    } catch { toast.error('Error al actualizar la tarea'); }
  }, [pedir, selDetail]);

  return {
    list, loading, errorLista, fetchList, selected, selLoading, detail: selDetail || selected, selectReminder, cerrarDetalle,
    form, openCreate, openEdit, cerrarForm, alGuardar, del, setStatus, toggleDetailTask,
  };
}

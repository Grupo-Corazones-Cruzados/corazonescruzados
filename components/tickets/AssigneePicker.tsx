'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Target } from 'lucide-react';
import SearchableSelect from '@/components/ui/SearchableSelect';
import IconoCuenta from '@/components/clients/IconoCuenta';

interface Assignee {
  member_id: string;
  name: string;
  email?: string | null;
  role: string;
  prospeccion: { net: number; pos: number; neg: number };
  top_talents: string[];
}

/**
 * Buscador de MIEMBROS (candidatos, miembros y admin, de `/api/tickets/assignees`). Es el
 * mismo `SearchableSelect` que el de clientes (Fernando, 2026-10-03): por fila, el nombre con
 * el icono de cuenta, debajo el correo, debajo el rol y, en esa línea al borde derecho, la
 * prospección (neto de valores completados − fallidos). Los talentos ya no se enseñan, pero
 * se sigue buscando por ellos y por el rol.
 *
 * Todos los que salen tienen cuenta en GCC World: la lista se arma desde `users`.
 * `sinAsignar` añade la opción de dejarlo vacío (editar un ticket).
 *
 * ⭐ SOLO QUIEN TIENE DEMOSTRADO EL TALENTO (Fernando, 2026-11-09): el contexto del trabajo
 * se pasa en `contexto` —los talentos del formulario, o el ticket/proyecto/requerimiento— y la
 * API devuelve solo a quien tiene alguno en su top 5 (más uno mismo y el elegido de antes).
 * Con `contexto.talentos` vacío no hay a quién elegir todavía: primero va el talento.
 */
export interface ContextoTalento {
  talentos?: string[];
  ticket?: string | number;
  proyecto?: string | number;
  requerimiento?: string | number;
}

export default function AssigneePicker({
  value, onChange, disabled = false, label, sinAsignar = false, contexto,
}: {
  value: string;
  onChange: (memberId: string) => void;
  disabled?: boolean;
  label?: string;
  sinAsignar?: boolean;
  contexto?: ContextoTalento;
}) {
  const [list, setList] = useState<Assignee[]>([]);
  const [loading, setLoading] = useState(true);
  // El elegido al abrir se pide siempre: editar no debe hacerlo desaparecer de la lista.
  const inicial = useRef(value);
  const faltaTalento = !!contexto && Array.isArray(contexto.talentos) && contexto.talentos.length === 0;

  const consulta = useMemo(() => {
    const q = new URLSearchParams();
    if (contexto?.talentos) q.set('talentos', contexto.talentos.join(','));
    else if (contexto?.requerimiento != null) q.set('requerimiento', String(contexto.requerimiento));
    else if (contexto?.proyecto != null) q.set('proyecto', String(contexto.proyecto));
    else if (contexto?.ticket != null) q.set('ticket', String(contexto.ticket));
    if (inicial.current) q.set('incluir', inicial.current);
    return q.toString();
  }, [contexto?.talentos, contexto?.requerimiento, contexto?.proyecto, contexto?.ticket]);

  useEffect(() => {
    if (faltaTalento) { setList([]); setLoading(false); return; }
    let alive = true;
    setLoading(true);
    fetch(`/api/tickets/assignees${consulta ? `?${consulta}` : ''}`).then((r) => r.json()).then((d) => { if (alive) setList(d.data || []); })
      .catch(() => { if (alive) setList([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [consulta, faltaTalento]);

  // Si cambia el talento y el elegido ya no lo tiene, se suelta: la API lo rechazaría.
  useEffect(() => {
    if (loading || !value) return;
    if (faltaTalento || !list.some((a) => a.member_id === value)) onChange('');
  }, [list, loading, faltaTalento]); // eslint-disable-line react-hooks/exhaustive-deps

  const options = useMemo(() => {
    const filas = list.map((a) => {
      const net = a.prospeccion.net;
      return {
        value: a.member_id,
        label: a.name,
        hint: a.email && a.email !== a.name ? a.email : undefined,
        icon: <IconoCuenta conCuenta />,
        meta: a.role,
        metaRight: (
          <span className="inline-flex items-center gap-1 tabular-nums" title={`Prospección · +${a.prospeccion.pos} / −${a.prospeccion.neg}`}>
            <Target className="w-3 h-3 text-accent" />
            <span className={`font-semibold ${net > 0 ? 'text-emerald-600' : net < 0 ? 'text-red-600' : ''}`}>{net > 0 ? `+${net}` : net}</span>
          </span>
        ),
        keywords: [a.role, ...a.top_talents].join(' '),
      };
    });
    return sinAsignar ? [{ value: '', label: 'Sin asignar' }, ...filas] : filas;
  }, [list, sinAsignar]);

  return (
    <SearchableSelect label={label} value={value} onChange={onChange} options={options}
      disabled={disabled || loading || faltaTalento}
      placeholder={faltaTalento ? 'Elige primero el talento' : loading ? 'Cargando miembros…' : sinAsignar ? 'Sin asignar' : 'Elige un miembro'}
      searchPlaceholder="Buscar por nombre, correo, rol o talento…" />
  );
}

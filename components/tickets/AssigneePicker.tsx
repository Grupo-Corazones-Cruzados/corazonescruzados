'use client';

import { useEffect, useMemo, useState } from 'react';
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
 */
export default function AssigneePicker({
  value, onChange, disabled = false, label, sinAsignar = false,
}: {
  value: string;
  onChange: (memberId: string) => void;
  disabled?: boolean;
  label?: string;
  sinAsignar?: boolean;
}) {
  const [list, setList] = useState<Assignee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch('/api/tickets/assignees').then((r) => r.json()).then((d) => { if (alive) setList(d.data || []); })
      .catch(() => { if (alive) setList([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

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
      disabled={disabled || loading}
      placeholder={loading ? 'Cargando miembros…' : sinAsignar ? 'Sin asignar' : 'Elige un miembro'}
      searchPlaceholder="Buscar por nombre, correo, rol o talento…" />
  );
}

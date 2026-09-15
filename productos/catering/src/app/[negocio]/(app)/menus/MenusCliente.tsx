'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChefHat, ChevronLeft, ChevronRight, Copy, Trash2, Tag, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Boton, Campo, Entrada, Tarjeta, Insignia, Ventanita, Confirmar, EstadoVacio } from '@/componentes/ui';
import { Aviso } from '@/componentes/campos';
import { ETIQUETA_COMIDA, COLOR_COMIDA, ETIQUETA_CATEGORIA } from '@/lib/catalogo';
import { fechaLarga, sumarDias } from '@/lib/fechas';
import { guardarMenu, eliminarMenu, copiarMenus } from '@/acciones/cocina';
import { cn } from '@/lib/utils';
import type { TipoComida, CategoriaAlimento } from '@/generated/prisma/enums';

type Alimento = { id: number; nombre: string; categoria: CategoriaAlimento };
type ClienteDia = { id: number; nombre: string; comidas: TipoComida[]; restricciones: { alimentoId: number; tiposComida: TipoComida[] }[] };

export default function MenusCliente({
  slug, dia, hoy, comidas, esFeriado, entregas, menus, menuIds, alimentos, clientesDelDia, diasConMenu,
}: {
  slug: string;
  dia: string;
  hoy: string;
  comidas: TipoComida[];
  esFeriado: { nombre: string; esLaborable: boolean } | null;
  entregas: number;
  menus: { tipoComida: TipoComida; descripcion: string | null; alimentoIds: number[] }[];
  menuIds: Record<string, number>;
  alimentos: Alimento[];
  clientesDelDia: ClienteDia[];
  diasConMenu: string[];
}) {
  const router = useRouter();
  const [copiar, setCopiar] = useState(false);
  const [desde, setDesde] = useState(sumarDias(dia, -7));
  const [enCurso, arranca] = useTransition();
  const ir = (d: string) => router.push(`/${slug}/menus?dia=${d}`);

  return (
    <>
      <CabeceraPagina
        titulo="Menús"
        descripcion="Lo que se cocina cada día, por comida. Con el menú cargado, las etiquetas dicen quién no come qué."
        acciones={
          <>
            <Boton variante="secundario" icono={Copy} onClick={() => setCopiar(true)}>Copiar de otro día</Boton>
            <Link href={`/${slug}/etiquetas?dia=${dia}`}><Boton variante="secundario" icono={Tag}>Etiquetas del día</Boton></Link>
          </>
        }
      />
      <div className="space-y-4 p-4 sm:p-6">
        <Tarjeta className="flex flex-wrap items-center gap-3 p-3">
          <Boton variante="secundario" tamano="sm" icono={ChevronLeft} onClick={() => ir(sumarDias(dia, -1))} aria-label="Día anterior" />
          <Entrada type="date" value={dia} onChange={(e) => e.target.value && ir(e.target.value)} className="w-44" />
          <Boton variante="secundario" tamano="sm" icono={ChevronRight} onClick={() => ir(sumarDias(dia, 1))} aria-label="Día siguiente" />
          {dia !== hoy && <Boton variante="fantasma" tamano="sm" onClick={() => ir(hoy)}>Hoy</Boton>}
          <p className="text-[13px] font-semibold first-letter:uppercase">{fechaLarga(dia)}</p>
          <span className="text-[12px] text-tenue">· {entregas} entrega{entregas === 1 ? '' : 's'} ese día</span>
          {esFeriado && <Insignia tono={esFeriado.esLaborable ? 'aviso' : 'error'}>{esFeriado.nombre}{esFeriado.esLaborable ? ' (se trabaja)' : ' · sin servicio'}</Insignia>}
        </Tarjeta>

        <div className="grid gap-4 xl:grid-cols-2">
          {comidas.map((tipo) => (
            <EditorMenu
              key={`${dia}-${tipo}`}
              slug={slug}
              dia={dia}
              tipo={tipo}
              menuId={menuIds[tipo] ?? null}
              inicial={menus.find((m) => m.tipoComida === tipo) ?? null}
              alimentos={alimentos}
              clientes={clientesDelDia.filter((c) => c.comidas.includes(tipo))}
            />
          ))}
        </div>

        <Tarjeta className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-tenue">Días con menú cargado (± 2 semanas)</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {diasConMenu.length === 0 && <span className="text-[12px] text-tenue">Ninguno todavía.</span>}
            {diasConMenu.sort().map((d) => (
              <button key={d} onClick={() => ir(d)} className={cn('rounded-full border px-2.5 py-1 text-[11px] font-semibold', d === dia ? 'border-acento bg-acento-suave text-acento' : 'border-borde hover:bg-realce')}>
                {d.slice(8)}/{d.slice(5, 7)}
              </button>
            ))}
          </div>
        </Tarjeta>
      </div>

      <Ventanita abierto={copiar} alCerrar={() => setCopiar(false)} titulo="Copiar menús de otro día"
        pie={<><Boton variante="secundario" onClick={() => setCopiar(false)} disabled={enCurso}>Cancelar</Boton>
          <Boton disabled={enCurso} onClick={() => arranca(async () => { const r = await copiarMenus(slug, desde, dia); if (!r.ok) { toast.error(r.error); return; } setCopiar(false); toast.success('Menús copiados'); router.refresh(); })}>{enCurso ? 'Copiando…' : 'Copiar'}</Boton></>}>
        <p className="text-[13px] text-tenue">Se copian todas las comidas de ese día al <strong>{fechaLarga(dia)}</strong>, reemplazando lo que hubiera.</p>
        <Campo etiqueta="Copiar desde" className="mt-3"><Entrada type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></Campo>
      </Ventanita>
    </>
  );
}

function EditorMenu({ slug, dia, tipo, menuId, inicial, alimentos, clientes }: {
  slug: string; dia: string; tipo: TipoComida; menuId: number | null;
  inicial: { descripcion: string | null; alimentoIds: number[] } | null;
  alimentos: Alimento[]; clientes: ClienteDia[];
}) {
  const router = useRouter();
  const [ids, setIds] = useState<number[]>(inicial?.alimentoIds ?? []);
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? '');
  const [busca, setBusca] = useState('');
  const [borrar, setBorrar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enCurso, arranca] = useTransition();
  const nombre = (id: number) => alimentos.find((a) => a.id === id)?.nombre ?? '';

  // Quién no come algo de lo elegido, en esta comida. Se calcula mientras se arma:
  // es la razón de que el menú se cargue aquí y no en un papel.
  const afectados = useMemo(() => {
    const salida: { cliente: string; sin: string[] }[] = [];
    for (const c of clientes) {
      const sin = c.restricciones.filter((r) => ids.includes(r.alimentoId) && (r.tiposComida.length === 0 || r.tiposComida.includes(tipo))).map((r) => nombre(r.alimentoId));
      if (sin.length) salida.push({ cliente: c.nombre, sin });
    }
    return salida.sort((a, b) => b.sin.length - a.sin.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, clientes, tipo]);

  const q = busca.trim().toLowerCase();
  const porCategoria = new Map<CategoriaAlimento, Alimento[]>();
  for (const a of alimentos) if (!q || a.nombre.toLowerCase().includes(q)) porCategoria.set(a.categoria, [...(porCategoria.get(a.categoria) ?? []), a]);
  const cambiado = JSON.stringify([...ids].sort()) !== JSON.stringify([...(inicial?.alimentoIds ?? [])].sort()) || descripcion !== (inicial?.descripcion ?? '');

  return (
    <Tarjeta className="overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 text-white" style={{ background: COLOR_COMIDA[tipo] }}>
        <h2 className="text-[14px] font-semibold">{ETIQUETA_COMIDA[tipo]}</h2>
        <span className="text-[12px] opacity-90">{clientes.length} cliente{clientes.length === 1 ? '' : 's'} · {ids.length} alimento{ids.length === 1 ? '' : 's'}</span>
      </div>
      <div className="space-y-3 p-4">
        <Campo etiqueta="Descripción del plato"><Entrada value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Pollo al horno con arroz integral y ensalada" /></Campo>
        {ids.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {ids.map((id) => (
              <button key={id} onClick={() => setIds(ids.filter((x) => x !== id))} className="inline-flex items-center gap-1 rounded-full bg-acento px-2.5 py-1 text-[12px] font-semibold text-acento-contraste hover:brightness-90" title="Quitar">
                {nombre(id)} ×
              </button>
            ))}
          </div>
        )}
        <Entrada value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar y añadir alimentos…" />
        <div className="desplaza max-h-56 space-y-2 overflow-y-auto rounded border border-borde p-2">
          {alimentos.length === 0 && <EstadoVacio icono={ChefHat} titulo="No hay alimentos" detalle="Cárgalos en «Alimentos»." />}
          {[...porCategoria.entries()].map(([cat, lista]) => (
            <div key={cat}>
              <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-tenue">{ETIQUETA_CATEGORIA[cat]}</p>
              <div className="flex flex-wrap gap-1 p-1">
                {lista.map((a) => {
                  const m = ids.includes(a.id);
                  return (
                    <button key={a.id} onClick={() => setIds(m ? ids.filter((x) => x !== a.id) : [...ids, a.id])} className={cn('rounded-full border px-2.5 py-1 text-[12px] transition-colors', m ? 'border-acento bg-acento-suave font-semibold text-acento' : 'border-borde hover:bg-realce')}>
                      {a.nombre}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className={cn('rounded border px-3 py-2', afectados.length ? 'border-error bg-error-suave/40' : 'border-borde bg-realce/50')}>
          <p className="flex items-center gap-1.5 text-[12px] font-semibold"><ShieldAlert className="h-3.5 w-3.5" /> {afectados.length ? `${afectados.length} cliente${afectados.length === 1 ? '' : 's'} con restricción en este menú` : 'Nadie tiene restricciones con este menú'}</p>
          {afectados.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-[12px]">
              {afectados.map((a) => <li key={a.cliente}><strong>{a.cliente}</strong> · sin {a.sin.map((s) => s.toLowerCase()).join(', ')}</li>)}
            </ul>
          )}
        </div>

        {error && <Aviso texto={error} />}
        <div className="flex items-center justify-between gap-2 border-t border-borde pt-3">
          {menuId ? <Boton variante="fantasma" tamano="sm" icono={Trash2} onClick={() => setBorrar(true)}>Quitar menú</Boton> : <span />}
          <Boton disabled={enCurso || !ids.length || (!cambiado && !!menuId)} onClick={() => arranca(async () => { setError(null); const r = await guardarMenu(slug, dia, tipo, descripcion, ids); if (!r.ok) return setError(r.error); toast.success(`${ETIQUETA_COMIDA[tipo]} guardado`); router.refresh(); })}>
            {enCurso ? 'Guardando…' : menuId ? 'Guardar cambios' : 'Guardar menú'}
          </Boton>
        </div>
      </div>
      <Confirmar abierto={borrar} titulo="Quitar el menú" mensaje={`Se borra el ${ETIQUETA_COMIDA[tipo].toLowerCase()} de este día. Las etiquetas dejarán de avisar restricciones de cocina para esa comida.`} textoAceptar="Quitar" ocupado={enCurso}
        alCerrar={() => setBorrar(false)}
        alAceptar={() => arranca(async () => { if (!menuId) return; const r = await eliminarMenu(slug, menuId); if (!r.ok) { toast.error(r.error); return; } setBorrar(false); setIds([]); setDescripcion(''); toast.success('Menú quitado'); router.refresh(); })} />
    </Tarjeta>
  );
}

'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { accessRoleOf } from '@/lib/dashboard/access';
import { toast } from 'sonner';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelModal from '@/components/ui/PixelModal';
import { Cifra, RejillaCifras } from '@/components/ui/Cifra';
import { fmt2 } from '@/lib/format';
import { Ticket, FolderKanban, Users, TrendingUp, TrendingDown, PiggyBank,
  Download, ChevronRight, FileDown, FileText } from 'lucide-react';
import MenuMas from '@/components/ui/MenuMas';
import { EnBarraAcciones } from '@/components/dashboard/BarraAcciones';
import BotonGastosSri from '@/components/dashboard/BotonGastosSri';
import { BTN_SECONDARY } from '@/components/ui/Button';
import Segmentado from '@/components/ui/Segmentado';
import Interruptor from '@/components/ui/Interruptor';
import { useConsultaMedia, PANTALLA_LG } from '@/lib/hooks/useConsultaMedia';
import { BalanceMovil, MesesMovil, DetalleMes } from '@/components/dashboard/EstadoFinancieroMovil';

const mf = { fontFamily: 'var(--font-body)' } as const;

const sinSuscripcion = () => () => {};

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

interface Stats { open_tickets: number; active_projects: number; users?: number; active_members?: number; clients?: number; }
interface FinanceMonth { id: number; year: number; month: number; total_income: string; total_expense: string; total_savings: string; facturado_income?: string; adicional_income?: string; adicional_expense?: string; }
interface FinanceItem { id?: number; type: 'income' | 'expense'; description: string; amount: string; facturado?: boolean; bloqueado?: boolean; adicional?: boolean; source_type?: string | null; }

export default function DashboardHome() {
  const { user } = useAuth();
  const router = useRouter();
  // Rol EFECTIVO (candidate/client/member/admin). El candidato tiene role='client' en el
  // JWT pero account_type='candidate' → aquí se distingue para no tratarlo como cliente.
  const role = accessRoleOf(user);
  const isAdmin = role === 'admin';
  const isStaff = role === 'member' || role === 'admin';
  // Por debajo de `lg` el estado financiero tiene su versión de teléfono (ver
  // `components/dashboard/EstadoFinancieroMovil.tsx`); el mismo corte que la tabla. Hasta
  // hidratar se pinta el escritorio, para no ver el teléfono un instante en el ordenador.
  const hidratado = useSyncExternalStore(sinSuscripcion, () => true, () => false);
  const pantallaGrande = useConsultaMedia(PANTALLA_LG);
  const enTelefono = hidratado && !pantallaGrande;
  const [stats, setStats] = useState<Stats | null>(null);
  const [months, setMonths] = useState<FinanceMonth[]>([]);

  // Solo el CLIENTE de negocio (no candidato ni staff) no tiene Inicio → va a Marketplace.
  useEffect(() => { if (role === 'client') router.replace('/dashboard/marketplace'); }, [role, router]);

  // Detail modal
  const [detailMonth, setDetailMonth] = useState<FinanceMonth | null>(null);
  const [incomeItems, setIncomeItems] = useState<FinanceItem[]>([]);
  const [expenseItems, setExpenseItems] = useState<FinanceItem[]>([]);
  // ⭐ ADICIONALES (Fernando, 2026-10-30): ingresos y egresos NO facturados, en su propia columna y
  // con nombre de una palabra. Es lo ÚNICO que se escribe en el mes: ingresos y egresos son lo del
  // SRI y quedan bloqueados (`SQL_RENGLON_BLOQUEADO`).
  const [adicionales, setAdicionales] = useState<FinanceItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => { fetch('/api/admin/stats').then(r => r.json()).then(setStats).catch(() => {}); }, []);

  const fetchMonths = useCallback(async () => {
    try {
      const res = await fetch('/api/finance');
      const data = await res.json();
      setMonths(data.data || []);
    } catch {}
  }, []);

  useEffect(() => { if (isStaff) fetchMonths(); }, [isStaff, fetchMonths]);

  /**
   * FILTROS DEL ESTADO FINANCIERO (Fernando, 2026-10-29: «en la tabla de estados financieros
   * necesito filtros»). Por AÑO —hay meses de varios— y por RESULTADO del mes (con ahorro o
   * con pérdida). Solo filtran la tabla: las cifras de arriba siguen siendo los totales.
   */
  const [anio, setAnio] = useState<string>('todos');
  const [resultado, setResultado] = useState<'todos' | 'ahorro' | 'perdida'>('todos');
  /**
   * «SOLO FACTURADO» (Fernando, 2026-10-29: «que de mis reportes cuente solo lo facturado en
   * ingresos»). Los ingresos pasan a ser los que tienen factura autorizada (lo calcula el
   * servidor: `facturado_income`, ver `SQL_INGRESO_FACTURADO` en `lib/finance.ts`); los egresos
   * no cambian. El ahorro, las cifras, el filtro de resultado y el reporte usan ese ingreso.
   */
  const [soloFacturado, setSoloFacturado] = useState(false);
  // Las columnas del mes. `total_income`/`total_expense` incluyen los adicionales; la tabla los
  // separa. Con «Solo facturado» se mira solo lo del SRI: los adicionales no cuentan.
  const ingresoDe = (m: FinanceMonth) => Number((soloFacturado ? m.facturado_income : Number(m.total_income || 0) - Number(m.adicional_income || 0)) || 0);
  const egresoDe = (m: FinanceMonth) => Number(m.total_expense || 0) - Number(m.adicional_expense || 0);
  const adicionalDe = (m: FinanceMonth) => (soloFacturado ? 0 : Number(m.adicional_income || 0) - Number(m.adicional_expense || 0));
  const ahorroDe = (m: FinanceMonth) => ingresoDe(m) - egresoDe(m) + adicionalDe(m);
  // Lo que entró y lo que salió EN TOTAL (SRI + adicionales): las cifras de arriba y el teléfono.
  const entradaDe = (m: FinanceMonth) => ingresoDe(m) + (soloFacturado ? 0 : Number(m.adicional_income || 0));
  const salidaDe = (m: FinanceMonth) => egresoDe(m) + (soloFacturado ? 0 : Number(m.adicional_expense || 0));
  const anios = [...new Set(months.map((m) => String(m.year)))].sort((a, b) => Number(b) - Number(a));
  // El reporte descarga lo MISMO que enseña la tabla (Fernando, 2026-10-29).
  // Tres versiones (Fernando, 2026-10-30): la completa, solo ingresos y solo egresos.
  const urlReporte = (tipo?: 'ingresos' | 'egresos') => `/api/finance/pdf?${new URLSearchParams({
    ...(anio !== 'todos' ? { anio } : {}),
    ...(resultado !== 'todos' ? { resultado } : {}),
    ...(soloFacturado ? { facturado: '1' } : {}),
    ...(tipo ? { tipo } : {}),
  }).toString()}`;
  const opcionesReporte = [
    { label: 'Ingresos y egresos', icon: FileText, onClick: () => window.open(urlReporte(), '_blank') },
    { label: 'Solo ingresos', icon: TrendingUp, onClick: () => window.open(urlReporte('ingresos'), '_blank') },
    { label: 'Solo egresos', icon: TrendingDown, onClick: () => window.open(urlReporte('egresos'), '_blank') },
  ];
  const textoReporte = anio === 'todos' && resultado === 'todos' && !soloFacturado ? 'Reporte global' : 'Reporte filtrado';
  const mesesFiltrados = months.filter((m) => {
    if (anio !== 'todos' && String(m.year) !== anio) return false;
    const ahorro = ahorroDe(m);
    if (resultado === 'ahorro') return ahorro >= 0;
    if (resultado === 'perdida') return ahorro < 0;
    return true;
  });

  // Las cifras de dinero siguen al AÑO elegido (Fernando, 2026-10-29: «según el filtro aplicado
  // de año también que se actualicen los indicadores»). El de resultado no: ingresos de «los
  // meses con pérdida» no es un total que nadie busque.
  const mesesDelAnio = anio === 'todos' ? months : months.filter((m) => String(m.year) === anio);
  const globalIncome = mesesDelAnio.reduce((s, m) => s + entradaDe(m), 0);
  const globalExpense = mesesDelAnio.reduce((s, m) => s + salidaDe(m), 0);
  const globalSavings = globalIncome - globalExpense;
  const delAnio = anio === 'todos' ? '' : ` ${anio}`;

  const openDetail = async (m: FinanceMonth) => {
    setDetailMonth(m);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/finance/${m.id}`);
      const data = await res.json();
      const items: FinanceItem[] = data.data?.items || [];
      setIncomeItems(items.filter(i => i.type === 'income' && !i.adicional));
      setExpenseItems(items.filter(i => i.type === 'expense' && !i.adicional));
      setAdicionales(items.filter(i => i.adicional));
    } catch { toast.error('Error al cargar detalle'); }
    finally { setLoadingDetail(false); }
  };

  const saveDetail = async () => {
    if (!detailMonth) return;
    setSaving(true);
    try {
      // Solo los adicionales: lo del SRI no se manda (el servidor tampoco lo tocaría).
      const lista = adicionales
        .filter(i => i.description.trim() || Number(i.amount))
        .map(({ type, description, amount }) => ({ type, description: description.trim(), amount }));
      const res = await fetch(`/api/finance/${detailMonth.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adicionales: lista }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Error al guardar');
      toast.success('Adicionales guardados');
      setDetailMonth(null); fetchMonths();
    } catch (e: any) { toast.error(e?.message || 'Error al guardar'); }
    finally { setSaving(false); }
  };

  // Con «Solo facturado», la ventana del mes esconde los ingresos que el servidor marcó SIN factura
  // (Fernando, 2026-10-29: «si le doy a solo facturado sí aparecen las filas»). Solo se ESCONDEN: el
  // guardado reescribe el mes entero, así que siguen en el estado y se guardan con los demás. Los
  // que se añaden a mano (aún sin marca) se ven.
  const ocultoPorFiltro = (it: FinanceItem) => soloFacturado && it.type === 'income' && it.facturado === false;
  const suma = (l: FinanceItem[]) => l.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const detailIncome = suma(incomeItems.filter((i) => !ocultoPorFiltro(i)));
  const detailExpense = suma(expenseItems);
  const detailAdicionalIngreso = soloFacturado ? 0 : suma(adicionales.filter((i) => i.type === 'income'));
  const detailAdicionalEgreso = soloFacturado ? 0 : suma(adicionales.filter((i) => i.type === 'expense'));
  const detailSavings = detailIncome - detailExpense + detailAdicionalIngreso - detailAdicionalEgreso;
  const priorSavings = detailMonth
    ? months.filter(m => m.year < detailMonth.year || (m.year === detailMonth.year && m.month < detailMonth.month)).reduce((s, m) => s + ahorroDe(m), 0)
    : 0;
  const cumulativeSavings = priorSavings + detailSavings;

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const name = user?.first_name || user?.email?.split('@')[0] || '';

  const money = (n: number) => `$${fmt2(n)}`;

  return (
    <div>
      {/* Saludo. En teléfono ocupa menos: el titular es la firma de la pantalla, no su
          contenido, y en 390 px cada línea que se ahorra es una cifra que entra. */}
      {/* Sin la línea «Este es el resumen de…» debajo (Fernando, 2026-10-23: bajo el título
          no se escriben frases descriptivas): repetía lo que ya dice la pantalla. */}
      {/* ⭐ LA CABECERA DE LA PORTADA (Fernando, 2026-10-29: el estilo de la sección Plataforma
          de la página de inicio): el saludo con el titular de Space Grotesk y el nombre con el
          degradado de «cruzar al mundo». Sin la insignia «Tu progreso» y SIN EL PENSAMIENTO
          (Fernando, el mismo día: ocupaba mucho del espacio de arriba; aquí lo que importa
          es la tabla). */}
      <h1 className="titulo-progreso text-[26px] sm:text-[34px] text-digi-text leading-[1.05] mb-4 sm:mb-5">
        {greet}{name ? <>, <span className="acento-progreso">{name}</span></> : ''}
      </h1>

      {/* Stat cards — para no-staff solo sus propios tickets/proyectos (acotados por el API);
          las finanzas globales y el conteo de clientes son solo para staff/admin. */}
      {/* En el teléfono las tres cifras de dinero no van aquí: las dice el balance de abajo,
          que sigue al filtro de año (un dato no se dice dos veces). */}
      <RejillaCifras className="mb-5">
        <Cifra Icon={Ticket} label="Tickets abiertos" value={stats?.open_tickets} />
        <Cifra Icon={FolderKanban} label="Proyectos activos" value={stats?.active_projects} />
        {isAdmin && <Cifra Icon={Users} label="Clientes" value={stats?.clients} />}
        {isStaff && !enTelefono && <Cifra Icon={TrendingUp} label={`${soloFacturado ? 'Facturado' : delAnio ? 'Ingresos' : 'Total ingresos'}${delAnio}`} value={money(globalIncome)} tone="green" />}
        {isStaff && !enTelefono && <Cifra Icon={TrendingDown} label={delAnio ? `Egresos${delAnio}` : 'Total egresos'} value={money(globalExpense)} tone="red" />}
        {isStaff && !enTelefono && <Cifra Icon={PiggyBank} label={`${delAnio || soloFacturado ? 'Ahorro' : 'Total ahorro'}${delAnio}`} value={money(globalSavings)} tone={globalSavings >= 0 ? 'accent' : 'red'} />}
      </RejillaCifras>

      {/* Estado financiero mensual — SOLO staff (datos de toda la organización). */}
      {isStaff && (
        <>
          <div className="mb-3">
            <h2 className="titulo-progreso text-[18px] text-digi-text">Estado financiero mensual</h2>
            {(mesesFiltrados.length > 0 || isAdmin) && (
              <EnBarraAcciones>
                {/* Un solo botón montado a la vez (teléfono O escritorio): cada uno pregunta y avisa. */}
                {isAdmin && enTelefono && <BotonGastosSri onActualizado={fetchMonths} />}
                {mesesFiltrados.length > 0 && (
                  <MenuMas items={opcionesReporte} label={textoReporte}
                    boton={{ texto: textoReporte, icon: Download, className: `${BTN_SECONDARY} inline-flex items-center justify-center gap-1.5` }} />
                )}
              </EnBarraAcciones>
            )}
          </div>

          {/* Los filtros: en el teléfono, cada uno a todo el ancho (en media columna el
              segmentado de tres no cabía y «Pérdida» se cortaba); desde `sm`, juntos a la
              izquierda con su ancho. Resultado es el `Segmentado` de siempre; el año, un `<select>`. */}
          {months.length > 0 && (
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 mb-3">
              <select value={anio} onChange={(e) => setAnio(e.target.value)} aria-label="Año"
                className="field-control field-select min-w-0 h-11 sm:h-[38px] sm:w-40 px-3 bg-digi-card border border-digi-border rounded-md text-[13px] text-digi-text appearance-none cursor-pointer" style={mf}>
                <option value="todos">Todos los años</option>
                {anios.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              <Segmentado
                etiqueta="Resultado del mes"
                className="min-w-0 sm:w-72 max-sm:col-span-2 max-sm:order-last"
                valor={resultado}
                onChange={setResultado}
                opciones={[
                  { valor: 'todos', texto: 'Todos' },
                  { valor: 'ahorro', texto: 'Ahorro' },
                  { valor: 'perdida', texto: 'Pérdida' },
                ]}
              />
              {/* El interruptor con su texto: es un sí/no, no una de varias opciones. */}
              <label className="inline-flex items-center gap-2.5 h-11 sm:h-[38px] px-1 cursor-pointer select-none text-[13px] text-digi-text" style={mf}>
                <Interruptor activo={soloFacturado} onChange={setSoloFacturado} />
                Solo facturado
              </label>
              {/* «Reporte global», a la altura de los filtros y a la derecha (Fernando,
                  2026-10-29): descarga lo que dicen los filtros, así que va con ellos. En el
                  teléfono es la acción principal y va a la barra de abajo. */}
              {/* El margen va en un envoltorio: en un `button` del panel, `ml-auto` lo pisa el
                  estilo base y el botón se quedaba pegado a los filtros. */}
              {/* ⭐ «Gastos del SRI» (Fernando, 2026-10-30), junto al reporte: trae los egresos
                  del SRI de los meses aún no revisados. Solo el admin (es su clave del SRI). */}
              {(mesesFiltrados.length > 0 || isAdmin) && (
                <div className="hidden lg:flex items-center gap-2 ml-auto shrink-0">
                  {isAdmin && !enTelefono && <BotonGastosSri onActualizado={fetchMonths} />}
                  {mesesFiltrados.length > 0 && (
                    <MenuMas items={opcionesReporte} label={textoReporte}
                      boton={{ texto: textoReporte, icon: Download, className: BTN_SECONDARY }} />
                  )}
                </div>
              )}
            </div>
          )}

          {enTelefono ? (
            <>
              <BalanceMovil
                etiquetaAhorro={`Ahorro${delAnio || ' total'}`}
                etiquetaIngresos={soloFacturado ? 'Facturado' : 'Ingresos'}
                ingresos={globalIncome} egresos={globalExpense}
              />
              <MesesMovil
                meses={mesesFiltrados} ingresoDe={entradaDe} egresoDe={salidaDe}
                onAbrir={openDetail}
                vacio={months.length ? 'Ningún mes cumple los filtros.' : 'No hay estados financieros aún.'}
              />
            </>
          ) : (
          <PixelDataTable
            unidad={['mes', 'meses']}
            data={mesesFiltrados}
            // Columnas de ANCHO FIJO (Fernando, 2026-10-29): con el reparto automático el ancho
            // salía del contenido y, al cambiar de año, las columnas se movían de sitio.
            singleLine
            onRowClick={(m: any) => openDetail(m)}
            emptyTitle="Sin registros"
            emptyDesc={months.length ? 'Ningún mes cumple los filtros.' : 'No hay estados financieros aún.'}
            columns={[
              { key: 'period', header: 'Periodo', width: soloFacturado ? '28%' : '24%', render: (m: any) => <span className="text-[13px] font-medium text-digi-text" style={mf}>{MONTH_NAMES[m.month - 1]} {m.year}</span> },
              { key: 'income', header: soloFacturado ? 'Facturado' : 'Ingresos', width: soloFacturado ? '22%' : '17%', render: (m: any) => <span className="text-[12px] font-medium text-green-400 tabular-nums" style={mf}>{money(ingresoDe(m))}</span> },
              { key: 'expense', header: 'Egresos', width: soloFacturado ? '22%' : '17%', render: (m: any) => <span className="text-[12px] font-medium text-red-400 tabular-nums" style={mf}>{money(egresoDe(m))}</span> },
              // Lo neto de los adicionales del mes (ingresos − egresos no facturados). Con «Solo
              // facturado» no cuentan, así que la columna no se enseña.
              ...(soloFacturado ? [] : [{ key: 'extra', header: 'Adicionales', width: '17%', render: (m: any) => { const a = adicionalDe(m); return <span className={`text-[12px] font-medium tabular-nums ${a > 0 ? 'text-green-400' : a < 0 ? 'text-red-400' : 'text-digi-muted'}`} style={mf}>{a ? `${a > 0 ? '+' : '−'}${money(Math.abs(a))}` : '—'}</span>; } }]),
              { key: 'savings', header: 'Ahorro', width: soloFacturado ? '22%' : '19%', render: (m: any) => { const s = ahorroDe(m); return <span className={`text-[12px] tabular-nums font-medium ${s >= 0 ? 'text-accent' : 'text-red-400'}`} style={mf}>{money(s)}</span>; } },
              { key: 'pdf', header: '', width: '60px', render: (m: any) => (
                // ⭐ UN ICONO, no una etiqueta «PDF» con borde y color (Fernando, 2026-10-29: «tiene
                // un estilo muy de IA»). Botón fantasma: sin borde ni relleno en reposo; el nombre
                // en `title`/`aria-label`.
                <button onClick={(e: React.MouseEvent) => { e.stopPropagation(); window.open(`/api/finance/${m.id}/pdf${soloFacturado ? '?facturado=1' : ''}`, '_blank'); }}
                  title="Descargar el PDF del mes" aria-label="Descargar el PDF del mes"
                  className="destino-tactil -my-1 w-7 h-7 inline-flex items-center justify-center rounded-md text-digi-muted hover:text-accent hover:bg-accent-light transition-colors">
                  <FileDown className="w-4 h-4" />
                </button>
              ) },
            ]}
            /* ── El mes, contado para un teléfono ──────────────────────────────────────
               La tabla tiene cinco columnas y en 390 px la quinta se cae fuera de la
               pantalla (el botón PDF, literalmente, no se veía). Aquí cada mes es una
               tarjeta con el periodo arriba y sus tres cifras debajo, cada una con su
               nombre — que en la tabla vive en un encabezado que se pierde al desplazar.

               ⚠️ **Y la tarjeta hace UNA sola cosa: abrir el mes.** El botón de PDF que
               tiene la tabla NO se copia aquí: sería un destino táctil dentro de otro, y
               con el pulgar eso es una moneda al aire. El PDF del mes sigue estando —
               dentro del propio mes, que es donde se va a buscarlo— y el global, arriba. */
            tarjetaMovil={(m: any) => {
              const ahorro = ahorroDe(m);
              return (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[14px] font-semibold text-digi-text" style={mf}>
                      {MONTH_NAMES[m.month - 1]} {m.year}
                    </span>
                    <ChevronRight className="w-4 h-4 text-digi-muted/60 shrink-0" />
                  </div>
                  <dl className="mt-2 grid grid-cols-3 gap-1.5 text-center">
                    {([
                      [soloFacturado ? 'Facturado' : 'Ingresos', ingresoDe(m), 'text-green-400'],
                      ['Egresos', egresoDe(m), 'text-red-400'],
                      ['Ahorro', ahorro, ahorro >= 0 ? 'text-accent' : 'text-red-400'],
                    ] as [string, number, string][]).map(([etiqueta, valor, color]) => (
                      <div key={etiqueta} className="rounded-md bg-black/[0.02] py-1">
                        <dt className="text-[10px] uppercase tracking-wide text-digi-muted" style={mf}>{etiqueta}</dt>
                        <dd className={`text-[13px] font-semibold tabular-nums ${color}`} style={mf}>{money(valor)}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              );
            }}
          />
          )}
        </>
      )}

      {/* Detail Modal */}
      <PixelModal open={!!detailMonth} onClose={() => !saving && setDetailMonth(null)}
        title={detailMonth ? `${MONTH_NAMES[detailMonth.month - 1]} ${detailMonth.year}` : ''} size="lg"
        busy={saving}
        // Las acciones van en el pie fijo, en los dos anchos: «Guardar» a la vista sin bajar 40 renglones.
        pie={!loadingDetail ? (
          <>
            <button onClick={() => detailMonth && window.open(`/api/finance/${detailMonth.id}/pdf${soloFacturado ? '?facturado=1' : ''}`, '_blank')}
              aria-label="Descargar el PDF del mes" title="Descargar el PDF del mes"
              className={`${BTN_SECONDARY} !flex-none mr-auto inline-flex items-center justify-center gap-1.5`}>
              <Download className="w-4 h-4" /> PDF
            </button>
            {isAdmin && !enTelefono && (
              <button onClick={() => setDetailMonth(null)} className="pixel-btn pixel-btn-secondary text-sm h-11">Cancelar</button>
            )}
            {isAdmin ? (
              <button onClick={saveDetail} disabled={saving} className="pixel-btn pixel-btn-primary text-sm h-11 disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            ) : (
              <button onClick={() => setDetailMonth(null)} className="pixel-btn pixel-btn-secondary text-sm h-11">Cerrar</button>
            )}
          </>
        ) : undefined}>
        {loadingDetail ? (
          <p className="text-center text-digi-muted py-8 text-[13px]" style={mf}>Cargando...</p>
        ) : (
          // ⭐ EL MES EN PESTAÑAS, EN LOS DOS ANCHOS (Fernando, 2026-10-30: con tres columnas «la cola de
          // esta pantalla se hace larguísima»; «el diseño de ingresos y egresos como pestañas estaba súper
          // bien»). Una lista a la vez: Ingresos, Egresos (lo del SRI, de solo lectura) o Adicionales.
          <DetalleMes
            ingresos={incomeItems} egresos={expenseItems}
            adicionales={soloFacturado ? null : adicionales} setAdicionales={setAdicionales}
            editable={isAdmin} oculto={ocultoPorFiltro}
            etiquetaIngresos={soloFacturado ? 'Facturado' : 'Ingresos'}
            totalIngresos={detailIncome + detailAdicionalIngreso} totalEgresos={detailExpense + detailAdicionalEgreso}
            ahorroAnterior={priorSavings} ahorroGlobal={cumulativeSavings}
          />
        )}
      </PixelModal>
    </div>
  );
}

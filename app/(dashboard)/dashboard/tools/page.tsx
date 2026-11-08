'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import PageHeader from '@/components/ui/PageHeader';
import FilterRail from '@/components/ui/FilterRail';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelSelect from '@/components/ui/PixelSelect';
import PixelModal from '@/components/ui/PixelModal';
import { useConsultaMedia, PANTALLA_XL } from '@/lib/hooks/useConsultaMedia';
import PanelCompartirEnlace from '@/components/ui/PanelCompartirEnlace';
import Interruptor from '@/components/ui/Interruptor';
import PanelHastaElPie from '@/components/ui/PanelHastaElPie';
import BarraLista from '@/components/ui/BarraLista';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { EditField, EDIT_INPUT } from '@/components/ui/EditDialog';
import AutoGrowTextarea from '@/components/ui/AutoGrowTextarea';
import { ListaSubidas, useSubidaArchivos } from '@/components/ui/SubidaArchivos';
import {
  LayoutGrid, Wand2, Wrench,
  Briefcase, Plus, Table2, Smartphone, Share2, ExternalLink,
} from 'lucide-react';
import GeneradorQR from '@/components/herramientas/GeneradorQR';
import ConvertirArchivos from '@/components/herramientas/ConvertirArchivos';
import TranscribirAudio from '@/components/herramientas/TranscribirAudio';
import FormatosExcel from '@/components/herramientas/FormatosExcel';
import HistorialHerramienta from '@/components/herramientas/HistorialHerramienta';
import { AccionNuevaCtx } from '@/components/herramientas/AccionNueva';
import HistorialEnlaces from '../tools/enlaces/page';
import HistorialEntregas from '../tools/entregas/page';
import AppMovil from '@/components/herramientas/AppMovil';
import { useAuth } from '@/components/providers/AuthProvider';
import { accessRoleOf } from '@/lib/dashboard/access';
import { herramientasPara, type Herramienta } from '@/lib/herramientas/catalogo';
import { useRutasEspacio } from '@/components/espacio/useRutasEspacio';
import { appDeTelefono, type AppDeTelefono } from '@/lib/sitio/appDeTelefono';

const mf = { fontFamily: 'var(--font-body)' } as const;


// Categorías (tipos de herramienta).
const CATEGORIES = [
  { value: 'all', label: 'Todas', Icon: LayoutGrid },
  { value: 'edicion', label: 'Edición', Icon: Wand2 },
  { value: 'gestion', label: 'Gestión', Icon: Briefcase },
  { value: 'app', label: 'Apps para el teléfono', Icon: Smartphone },
];

const CATEGORY_LABEL: Record<string, string> = { edicion: 'Herramienta de edición', gestion: 'Herramienta de gestión', app: 'App para el teléfono' };

// Vigencias del enlace de un solo uso: se cierra al responder o al vencer, lo que pase antes.
const VIGENCIAS = [
  { v: 24, l: '1 día' }, { v: 72, l: '3 días' }, { v: 168, l: '1 semana' }, { v: 720, l: '1 mes' },
];
// Un acceso a una herramienta no se gasta: sirve hasta que vence, así que admite plazos largos.
const VIGENCIAS_ACCESO = [...VIGENCIAS, { v: 2160, l: '3 meses' }, { v: 8760, l: '1 año' }];

type ClienteConCuenta = { id: number; nombre: string; email: string };


export default function ToolsPage() {
  // `useSearchParams` pide un Suspense por encima para poder compilar la página.
  return <Suspense fallback={null}><Herramientas /></Suspense>;
}

function Herramientas() {
  const { user } = useAuth();
  const rol = accessRoleOf(user);
  const esEquipo = rol === 'admin' || rol === 'member';
  // En GCC World (la app de la tienda) no se ofrecen las que solo van en GCC Miembros.
  const [app, setApp] = useState<AppDeTelefono | null>(null);
  useEffect(() => { setApp(appDeTelefono()); }, []);
  const rutasEspacio = useRutasEspacio();
  const router = useRouter();
  const tools = useMemo(
    () => herramientasPara({ esEquipo, esAdmin: rol === 'admin', app, conEspacio: !!rutasEspacio }),
    [esEquipo, rol, app, rutasEspacio],
  );
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('all');
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  // `?herramienta=<id>` la deja abierta (el QR de las apps para el teléfono apunta aquí). Se ESCUCHA, no
  // se lee una vez: en las apps se salta de una herramienta a otra desde el menú, la página no se
  // vuelve a montar y antes se quedaba mostrando la primera (Fernando, 2026-11-08).
  const herramientaUrl = useSearchParams().get('herramienta');
  useEffect(() => {
    if (herramientaUrl && tools.some((t) => t.id === herramientaUrl)) {
      setSelectedTool(herramientaUrl);
      setFormKey((k) => k + 1);
    }
  }, [tools, herramientaUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Enlace de un solo uso (lo que el panel compartido no trae: título, indicaciones, cliente)
  const [enlaceOpen, setEnlaceOpen] = useState(false);
  // El historial de cada herramienta (`HistorialHerramienta`): el formulario se abre en el panel
  // derecho y cada uso se anota; `versionUsos` hace que la lista se vuelva a pedir.
  const [formAbierto, setFormAbierto] = useState(false);
  // Convertir y Transcribir empiezan de cero al elegirlas o al abrir su formulario: se montan con otra `key`.
  const [formKey, setFormKey] = useState(0);
  const [versionUsos, setVersionUsos] = useState(0);
  const anotarUso = (herramienta: string, titulo: string, detalle: Record<string, string>) => {
    fetch('/api/herramientas/usos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ herramienta, titulo, detalle }) })
      .then(() => setVersionUsos((v) => v + 1)).catch(() => {});
  };
  const [enlaceTitulo, setEnlaceTitulo] = useState('');
  const [enlaceIndicaciones, setEnlaceIndicaciones] = useState('');
  const [enlaceExigeCuenta, setEnlaceExigeCuenta] = useState(false);
  const [enlaceCliente, setEnlaceCliente] = useState('');
  const [clientesConCuenta, setClientesConCuenta] = useState<ClienteConCuenta[] | null>(null);

  useEffect(() => {
    if (!enlaceOpen || clientesConCuenta) return;
    fetch('/api/enlaces/clientes').then((r) => r.json()).then((d) => setClientesConCuenta(d.data || [])).catch(() => setClientesConCuenta([]));
  }, [enlaceOpen, clientesConCuenta]);

  const abrirEnlace = () => {
    setEnlaceTitulo(''); setEnlaceIndicaciones(''); setEnlaceExigeCuenta(false); setEnlaceCliente('');
    setEnlaceOpen(true);
  };
  const clienteElegido = clientesConCuenta?.find((c) => String(c.id) === enlaceCliente);

  // Compartir el acceso a una herramienta (Fernando, 2026-10-27): el mismo formulario del enlace,
  // con «para quién» en vez de título y sin texto que pedir. Ver `lib/herramientas/accesos`.
  const [accesoOpen, setAccesoOpen] = useState(false);
  const [accesoTitulo, setAccesoTitulo] = useState('');
  // Validación del acceso: solo el enlace · cualquier cuenta de GCC World · la cuenta de un cliente.
  const [accesoValidacion, setAccesoValidacion] = useState<'ninguna' | 'cuenta' | 'cliente'>('ninguna');
  const [accesoCliente, setAccesoCliente] = useState('');
  useEffect(() => {
    if (!accesoOpen || clientesConCuenta) return;
    fetch('/api/enlaces/clientes').then((r) => r.json()).then((d) => setClientesConCuenta(d.data || [])).catch(() => setClientesConCuenta([]));
  }, [accesoOpen, clientesConCuenta]);
  const abrirAcceso = () => {
    setAccesoTitulo(''); setAccesoValidacion('ninguna'); setAccesoCliente('');
    setAccesoOpen(true);
  };
  const clienteAcceso = clientesConCuenta?.find((c) => String(c.id) === accesoCliente);

  // Entrega de un solo uso (Fernando, 2026-10-19): misma forma que el enlace, pero los archivos
  // los sube el miembro. Se suben al elegirlos, a un BORRADOR que nace con el primero; si el
  // panel se cierra sin generar, el borrador se descarta. Ver `lib/entregas`.
  const [entregaOpen, setEntregaOpen] = useState(false);
  const [entregaTitulo, setEntregaTitulo] = useState('');
  const [entregaMensaje, setEntregaMensaje] = useState('');
  const [entregaExigeCuenta, setEntregaExigeCuenta] = useState(false);
  const [entregaCliente, setEntregaCliente] = useState('');
  const entregaId = useRef<Promise<number> | null>(null);
  const entregaPublicada = useRef(false);
  const borradorEntrega = () => {
    if (!entregaId.current) {
      entregaId.current = fetch('/api/entregas', { method: 'POST' }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) { entregaId.current = null; throw new Error(d.error || 'No se pudo preparar la entrega'); }
        return d.data.id as number;
      });
    }
    return entregaId.current;
  };
  const subidaEntrega = useSubidaArchivos(async (archivo) => {
    const id = await borradorEntrega();
    const r = await fetch(`/api/entregas/${id}/subida`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: archivo.name, tipo: archivo.type, tamano: archivo.size }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'No se pudo subir');
    return d.data.url;
  });
  useEffect(() => {
    if (!entregaOpen || clientesConCuenta) return;
    fetch('/api/enlaces/clientes').then((r) => r.json()).then((d) => setClientesConCuenta(d.data || [])).catch(() => setClientesConCuenta([]));
  }, [entregaOpen, clientesConCuenta]);
  const abrirEntrega = () => {
    setEntregaTitulo(''); setEntregaMensaje(''); setEntregaExigeCuenta(false); setEntregaCliente('');
    subidaEntrega.setItems([]);
    entregaId.current = null; entregaPublicada.current = false;
    setEntregaOpen(true);
  };
  const cerrarEntrega = () => {
    if (subidaEntrega.subiendo) { toast.error('Espera a que terminen de subir los archivos'); return; }
    setEntregaOpen(false);
    setVersionUsos((v) => v + 1);
    // Sin generar: el borrador y sus archivos sobran (van a la papelera de Drive).
    const p = entregaId.current;
    if (p && !entregaPublicada.current) p.then((id) => fetch(`/api/entregas/${id}`, { method: 'DELETE' })).catch(() => {});
  };
  const clienteEntrega = clientesConCuenta?.find((c) => String(c.id) === entregaCliente);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: tools.length };
    for (const t of tools) c[t.category] = (c[t.category] || 0) + 1;
    return c;
  }, [tools]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tools.filter((t) => {
      if (cat !== 'all' && t.category !== cat) return false;
      if (q && !t.name.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [cat, search, tools]);


  const selectTool = (id: string) => {
    // El Espacio de trabajo y Gumdramon no tienen pantalla aquí: van a la suya.
    const abre = tools.find((t) => t.id === id)?.abre;
    if (abre && rutasEspacio) { window.location.href = rutasEspacio[abre]; return; }
    setSelectedTool(id);
    setFormKey((k) => k + 1);
  };

  const tool = tools.find((t) => t.id === selectedTool) || null;
  // Por debajo de `xl` la herramienta se abre ENCIMA, no bajo la lista (Fernando, 2026-10-23).
  // Se decide qué se MONTA: un <dialog> montado y escondido deja inerte toda la página.
  const enTelefono = !useConsultaMedia(PANTALLA_XL);
  // En una app, la herramienta elegida en Accesos se abre sola, como sección propia, sin la lista.
  const enSeccion = !!app && !!tool;
  const cuerpoHerramienta = () => !tool ? null
    : tool.id === 'convert' ? <ConvertirArchivos key={formKey} descripcion={tool.description} alUsar={(t, d) => anotarUso('convert', t, d)} />
    : tool.id === 'transcribe' ? <TranscribirAudio key={formKey} alUsar={(t, d) => anotarUso('transcribe', t, d)} /> : tool.id === 'entrega-unica' ? renderEntrega() : tool.id === 'qr' ? <GeneradorQR /> : tool.id === 'formatos-excel' ? renderFormatosExcel() : tool.id === 'descargador-video' ? renderDescargador() : renderEnlace();

  // Compartir con alguien de fuera por un enlace con token (`lib/herramientas/accesos`): en cada
  // herramienta `compartible`, solo para el equipo. En las apps va en la barra del historial.
  const bloqueCompartir = () => !tool || !esEquipo || !tool.compartible ? null : (
    <div className="space-y-2 pt-3 mt-3 border-t border-digi-border">
      <button onClick={abrirAcceso} className={`${BTN_SECONDARY} w-full`}><Share2 className="w-4 h-4" /> Compartir acceso</button>
      <Link href="/dashboard/tools/accesos" className={`${BTN_SECONDARY} w-full`}><Table2 className="w-4 h-4" /> Ver accesos compartidos</Link>
    </div>
  );

  // Panel derecho: usar la herramienta seleccionada.
  const renderToolPanel = () => {
    if (!tool) {
      return (
        <PanelHastaElPie desdeAncho={1280} className="bg-digi-card border border-digi-border rounded-lg p-6 text-center flex flex-col items-center justify-center">
          <div className="w-10 h-10 rounded-lg bg-black/[0.03] flex items-center justify-center mx-auto mb-2">
            <Wrench className="w-5 h-5 text-digi-muted" />
          </div>
          <p className="text-[12px] text-digi-muted" style={mf}>Selecciona una herramienta para usarla.</p>
        </PanelHastaElPie>
      );
    }
    // Fernando, 2026-10-29: la tarjeta del panel derecho llega hasta el pie aunque tenga poco;
    // lo que no quepa se desplaza dentro.
    return (
      <PanelHastaElPie desdeAncho={1280} className="bg-digi-card border border-digi-border rounded-lg shadow-sm">
        <div className="flex items-center gap-2.5 p-4 border-b border-digi-border">
          <div className="w-9 h-9 rounded-lg bg-accent-light border border-accent/15 flex items-center justify-center shrink-0">
            <tool.Icon className="w-5 h-5 text-accent" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold text-digi-text leading-tight" style={mf}>{tool.name}</h3>
            <p className="text-[11px] text-digi-muted" style={mf}>{CATEGORY_LABEL[tool.category]}</p>
          </div>
        </div>
        <div className="p-4">{cuerpoHerramienta()}{bloqueCompartir()}</div>
      </PanelHastaElPie>
    );
  };


  // Descargador GCC (`movil/descargador/`): el video se descarga en el propio teléfono, nunca en el servidor.
  const renderDescargador = () => (
    <AppMovil
      slug="descargador-video"
      descripcion="Pega o comparte un enlace de video y elige la calidad o solo el audio; queda guardado en la galería del teléfono. Úsala solo con videos propios, con permiso de su autor o con licencia libre."
      pasos={[
        'Descarga el archivo desde el teléfono.',
        'Ábrelo y, si Android lo pide, permite instalar apps de este origen.',
        'Abre «Descargador GCC» y comparte con ella el enlace del video.',
      ]}
    />
  );

  const renderEnlace = () => (
    <div className="space-y-3">
      <p className="text-[12px] text-digi-muted" style={mf}>{tool?.description}</p>
      <button onClick={abrirEnlace} className={`${BTN_PRIMARY} w-full`}><Plus className="w-4 h-4" /> Generar enlace</button>
      <Link href="/dashboard/tools/enlaces" className={`${BTN_SECONDARY} w-full`}><Table2 className="w-4 h-4" /> Ver enlaces generados</Link>
    </div>
  );

  // Corre a página completa: la vista previa de la hoja impresa no cabe en esta columna.
  const renderFormatosExcel = () => (
    <div className="space-y-3">
      <p className="text-[12px] text-digi-muted" style={mf}>{tool?.description}</p>
      <Link href="/dashboard/tools/formatos-excel" className={`${BTN_PRIMARY} w-full`}><ExternalLink className="w-4 h-4" /> Abrir herramienta</Link>
    </div>
  );

  const renderEntrega = () => (
    <div className="space-y-3">
      <p className="text-[12px] text-digi-muted" style={mf}>{tool?.description}</p>
      <button onClick={abrirEntrega} className={`${BTN_PRIMARY} w-full`}><Plus className="w-4 h-4" /> Generar entrega</button>
      <Link href="/dashboard/tools/entregas" className={`${BTN_SECONDARY} w-full`}><Table2 className="w-4 h-4" /> Ver entregas generadas</Link>
    </div>
  );

  return (
    <div>
      <PageHeader title="Herramientas" description="Utilidades de uso interno" />

      {/* Sin cabecera de sección: el nombre va arriba, como el título de Comunicados. */}
      {/* EN LAS APPS, CADA HERRAMIENTA ABRE EN SU HISTORIAL (Fernando, 2026-11-08): lo primero es el panel
          de usos y el formulario se abre en el panel derecho. Enlace y Entrega de un solo uso tienen
          su propio historial; el Descargador solo instala la app y no tiene usos que listar. */}
      {enSeccion && tool && (
        <div>
          <h1 className="text-[18px] font-semibold text-digi-text mb-3" style={mf}>{tool.name}</h1>
          {tool.id === 'enlace-unico' || tool.id === 'entrega-unica' ? (
            // El botón va en su barra, junto al buscador, como en las demás herramientas.
            <AccionNuevaCtx.Provider value={{ label: tool.id === 'enlace-unico' ? 'Generar enlace' : 'Generar entrega', icon: Plus,
              onClick: tool.id === 'enlace-unico' ? abrirEnlace : abrirEntrega, tipo: 'primaria' }}>
              {tool.id === 'enlace-unico' ? <HistorialEnlaces key={versionUsos} /> : <HistorialEntregas key={versionUsos} />}
            </AccionNuevaCtx.Provider>
          ) : ['convert', 'transcribe', 'qr', 'formatos-excel'].includes(tool.id) ? (
            <HistorialHerramienta
              herramienta={tool.id}
              Icono={tool.Icon}
              accion={({ convert: 'Nueva conversión', transcribe: 'Nueva transcripción', qr: 'Nuevo código QR', 'formatos-excel': 'Nuevo formato' } as Record<string, string>)[tool.id]}
              unidad={['uso', 'usos']}
              etiquetas={{ formato: 'Formato', tamano: 'Tamaño', salida: 'Salida', papel: 'Papel', hojas: 'Hojas' }}
              version={versionUsos}
              abierto={formAbierto}
              onAbrir={() => { setFormAbierto(true); setFormKey((k) => k + 1); }}
              onCerrar={() => setFormAbierto(false)}
              acciones={esEquipo && tool.compartible ? [
                { label: 'Accesos', icon: Table2, onClick: () => router.push('/dashboard/tools/accesos'), tipo: 'secundaria' },
                { label: 'Compartir', icon: Share2, onClick: abrirAcceso, tipo: 'secundaria' },
              ] : undefined}
              formulario={tool.id === 'qr' ? <GeneradorQR alUsar={(enlace, d) => anotarUso('qr', enlace, d)} />
                : tool.id === 'formatos-excel' ? <FormatosExcel alUsar={(nombre, d) => anotarUso('formatos-excel', nombre, d)} />
                : cuerpoHerramienta()}
            />
          ) : (
            <div className="max-w-2xl">{cuerpoHerramienta()}</div>
          )}
        </div>
      )}

      <div className={`flex flex-col lg:flex-row gap-4 items-start ${enSeccion ? 'hidden' : ''}`}>
        {/* ── Left rail: categorías ── */}
        <FilterRail
          title="Categoría"
          items={CATEGORIES.filter((c) => c.value === 'all' || counts[c.value]).map((c) => ({ value: c.value, label: c.label, Icon: c.Icon, count: counts[c.value] }))}
          value={cat}
          onChange={setCat}
        />

        {/* ── Right region: buscador + tabla + panel de uso ── */}
        <div className="flex-1 min-w-0 w-full">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
            {/* La barra va en la columna de la tabla: así el panel de uso empieza arriba. */}
            <div className="min-w-0">
              <BarraLista busqueda={search} onBusqueda={setSearch} placeholder="Buscar herramienta..." />
              <PixelDataTable
            unidad={['herramienta', 'herramientas']}
                singleLine
                columns={[
                  { key: 'name', header: 'Herramienta', render: (t: Herramienta) => (
                    <span className="flex items-center gap-2 min-w-0">
                      <t.Icon className={`w-4 h-4 shrink-0 ${selectedTool === t.id ? 'text-accent' : 'text-digi-muted'}`} />
                      <span className={`truncate text-[13px] font-medium ${selectedTool === t.id ? 'text-accent' : 'text-digi-text'}`} style={mf}>{t.name}</span>
                    </span>
                  ) },
                  { key: 'description', header: 'Descripción', hideOnMobile: true, render: (t: Herramienta) => (
                    <span className="text-[12px] text-digi-muted line-clamp-2 md:line-clamp-1" style={mf}>{t.description}</span>
                  ) },
                ]}
                data={filtered}
                onRowClick={(t: Herramienta) => selectTool(t.id)}
                emptyTitle="Sin herramientas"
                emptyDesc="No se encontraron herramientas en esta categoría."
              />
            </div>

            {/* ── Panel de uso ── */}
            {/* La columna solo en escritorio; por debajo, el panel que se abre encima (abajo). */}
            {!enTelefono && (
              <aside className="w-full xl:w-[360px]">
                {renderToolPanel()}
              </aside>
            )}
          </div>
        </div>
      </div>

      {/* La herramienta en teléfono y tableta. En escritorio NO se monta: ver `enTelefono`. */}
      {enTelefono && !enSeccion && (
        <PixelModal open={!!tool} onClose={() => setSelectedTool(null)} title={tool?.name || 'Herramienta'} size="md">
          {cuerpoHerramienta()}{bloqueCompartir()}
        </PixelModal>
      )}

      <PanelCompartirEnlace
        open={enlaceOpen} onClose={() => { setEnlaceOpen(false); setVersionUsos((v) => v + 1); }}
        title="Generar enlace de un solo uso"
        intro={<>Quien lo abra podrá enviar <strong>un texto y hasta 10 archivos</strong> (100 MB cada uno). Al enviar, el enlace se cierra.</>}
        duraciones={VIGENCIAS} duracionInicial={168}
        correoInicial={clienteElegido?.email || ''}
        etiquetaCorreo="Correo de quien responde (para enviarlo)"
        aviso={enlaceExigeCuenta
          ? <>Solo podrá responder quien inicie sesión con la cuenta de <strong>{clienteElegido?.nombre}</strong>.</>
          : 'Cualquiera con este enlace puede responder una vez.'}
        puedeGenerar={!!enlaceTitulo.trim() && (!enlaceExigeCuenta || !!enlaceCliente)}
        generar={async ({ horas, email, enviar }) => {
          const r = await fetch('/api/enlaces', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              titulo: enlaceTitulo, indicaciones: enlaceIndicaciones, horas, email: enviar ? email : undefined,
              exige_cuenta: enlaceExigeCuenta, client_id: enlaceExigeCuenta ? Number(enlaceCliente) : null,
            }),
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || 'Error');
          if (enviar && !d.data.enviado) return { url: d.data.url, mensaje: 'Enlace generado, pero el correo no salió: cópialo y envíalo tú', ok: false };
          return { url: d.data.url, mensaje: enviar ? 'Enlace enviado por correo' : 'Enlace generado' };
        }}
      >
        <EditField label="Título">
          <input value={enlaceTitulo} onChange={(e) => setEnlaceTitulo(e.target.value)} maxLength={200}
            placeholder="Ej.: Documentos para la declaración" className={EDIT_INPUT} style={mf} />
        </EditField>
        <EditField label="Indicaciones para quien responde">
          <AutoGrowTextarea value={enlaceIndicaciones} onChange={(e) => setEnlaceIndicaciones(e.target.value)} minRows={3} maxLength={4000}
            placeholder="Qué necesitas que te envíen" className={EDIT_INPUT} style={mf} />
        </EditField>
        <div className="flex items-center justify-between gap-3 py-1">
          <span className="text-[12px] font-semibold text-digi-text opacity-70" style={mf}>Pedir la cuenta del cliente</span>
          <Interruptor activo={enlaceExigeCuenta} onChange={setEnlaceExigeCuenta} etiqueta="Pedir la cuenta del cliente" />
        </div>
        {enlaceExigeCuenta && (
          <PixelSelect label="Cliente" value={enlaceCliente} onChange={(e) => setEnlaceCliente(e.target.value)}
            placeholder={clientesConCuenta === null ? 'Cargando…' : clientesConCuenta.length ? 'Elige el cliente' : 'Ningún cliente tiene cuenta'}
            options={(clientesConCuenta || []).map((c) => ({ value: String(c.id), label: `${c.nombre} · ${c.email}` }))} />
        )}
      </PanelCompartirEnlace>

      <PanelCompartirEnlace
        open={accesoOpen} onClose={() => setAccesoOpen(false)}
        title="Compartir acceso a la herramienta"
        intro={<>Quien abra el enlace podrá usar <strong>{tool?.name}</strong> las veces que necesite, hasta que venza o lo cierres.</>}
        duraciones={VIGENCIAS_ACCESO} duracionInicial={720}
        correoInicial={clienteAcceso?.email || ''}
        etiquetaCorreo="Correo de quien la usará (para enviarlo)"
        aviso={accesoValidacion === 'cliente'
          ? <>Solo podrá usarla quien inicie sesión con la cuenta de <strong>{clienteAcceso?.nombre}</strong>.</>
          : accesoValidacion === 'cuenta'
            ? 'Podrá usarla quien inicie sesión con una cuenta de GCC World; si no tiene, la crea al entrar.'
            : 'Cualquiera con este enlace puede usarla mientras esté vigente.'}
        puedeGenerar={!!tool?.compartible && (accesoValidacion !== 'cliente' || !!accesoCliente)}
        generar={async ({ horas, email, enviar }) => {
          const r = await fetch('/api/herramientas/accesos', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              herramienta: tool?.id, titulo: accesoTitulo, horas, email: enviar ? email : undefined,
              validacion: accesoValidacion, client_id: accesoValidacion === 'cliente' ? Number(accesoCliente) : null,
            }),
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || 'Error');
          if (enviar && !d.data.enviado) return { url: d.data.url, mensaje: 'Acceso generado, pero el correo no salió: cópialo y envíalo tú', ok: false };
          return { url: d.data.url, mensaje: enviar ? 'Acceso enviado por correo' : 'Acceso generado' };
        }}
      >
        <EditField label="Para quién">
          <input value={accesoTitulo} onChange={(e) => setAccesoTitulo(e.target.value)} maxLength={200}
            placeholder="Ej.: Contabilidad de la empresa" className={EDIT_INPUT} style={mf} />
        </EditField>
        <PixelSelect label="Validación" value={accesoValidacion} onChange={(e) => setAccesoValidacion(e.target.value as typeof accesoValidacion)}
          options={[
            { value: 'ninguna', label: 'Solo el enlace' },
            { value: 'cuenta', label: 'Cuenta de GCC World' },
            { value: 'cliente', label: 'Cuenta de un cliente' },
          ]} />
        {accesoValidacion === 'cliente' && (
          <PixelSelect label="Cliente" value={accesoCliente} onChange={(e) => setAccesoCliente(e.target.value)}
            placeholder={clientesConCuenta === null ? 'Cargando…' : clientesConCuenta.length ? 'Elige el cliente' : 'Ningún cliente tiene cuenta'}
            options={(clientesConCuenta || []).map((c) => ({ value: String(c.id), label: `${c.nombre} · ${c.email}` }))} />
        )}
      </PanelCompartirEnlace>

      <PanelCompartirEnlace
        open={entregaOpen} onClose={cerrarEntrega}
        title="Generar entrega de un solo uso"
        intro={<>Quien abra el enlace podrá ver el mensaje y <strong>descargar los archivos una sola vez</strong>: al pulsar «Ver y descargar» tiene una hora en ese navegador y después se cierra.</>}
        duraciones={VIGENCIAS} duracionInicial={168}
        correoInicial={clienteEntrega?.email || ''}
        etiquetaCorreo="Correo de quien recibe (para enviarlo)"
        aviso={entregaExigeCuenta
          ? <>Solo podrá abrirla quien inicie sesión con la cuenta de <strong>{clienteEntrega?.nombre}</strong>.</>
          : 'Cualquiera con este enlace puede abrirla una vez.'}
        puedeGenerar={!!entregaTitulo.trim() && !subidaEntrega.subiendo
          && (!!entregaMensaje.trim() || subidaEntrega.listos.length > 0)
          && (!entregaExigeCuenta || !!entregaCliente)}
        generar={async ({ horas, email, enviar }) => {
          const id = await borradorEntrega();
          const r = await fetch(`/api/entregas/${id}/publicar`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              titulo: entregaTitulo, mensaje: entregaMensaje, horas, email: enviar ? email : undefined,
              exige_cuenta: entregaExigeCuenta, client_id: entregaExigeCuenta ? Number(entregaCliente) : null,
              archivos: subidaEntrega.listos.map((x) => x.fileId),
            }),
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || 'Error');
          entregaPublicada.current = true;
          if (enviar && !d.data.enviado) return { url: d.data.url, mensaje: 'Entrega generada, pero el correo no salió: cópialo y envíalo tú', ok: false };
          return { url: d.data.url, mensaje: enviar ? 'Entrega enviada por correo' : 'Entrega generada' };
        }}
      >
        <EditField label="Título">
          <input value={entregaTitulo} onChange={(e) => setEntregaTitulo(e.target.value)} maxLength={200}
            placeholder="Ej.: Accesos del sistema" className={EDIT_INPUT} style={mf} />
        </EditField>
        <EditField label="Mensaje para quien recibe">
          <AutoGrowTextarea value={entregaMensaje} onChange={(e) => setEntregaMensaje(e.target.value)} minRows={3} maxLength={20000}
            placeholder="La información que le compartes" className={EDIT_INPUT} style={mf} />
        </EditField>
        <ListaSubidas items={subidaEntrega.items} agregar={subidaEntrega.agregar} quitar={subidaEntrega.quitar} />
        <div className="flex items-center justify-between gap-3 py-1">
          <span className="text-[12px] font-semibold text-digi-text opacity-70" style={mf}>Pedir la cuenta del cliente</span>
          <Interruptor activo={entregaExigeCuenta} onChange={setEntregaExigeCuenta} etiqueta="Pedir la cuenta del cliente" />
        </div>
        {entregaExigeCuenta && (
          <PixelSelect label="Cliente" value={entregaCliente} onChange={(e) => setEntregaCliente(e.target.value)}
            placeholder={clientesConCuenta === null ? 'Cargando…' : clientesConCuenta.length ? 'Elige el cliente' : 'Ningún cliente tiene cuenta'}
            options={(clientesConCuenta || []).map((c) => ({ value: String(c.id), label: `${c.nombre} · ${c.email}` }))} />
        )}
      </PanelCompartirEnlace>
    </div>
  );
}

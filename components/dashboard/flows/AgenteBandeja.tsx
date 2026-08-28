'use client';

/**
 * LA BANDEJA del agente: lista de conversaciones + hilo, con la toma humana.
 *
 * Dos columnas dentro del espacio de trabajo (el rail de secciones ya está fuera). La
 * lista NO trae los mensajes: los pide el hilo al seleccionar. Con cien chats, traer el
 * texto de todos para pintar cuatro líneas por fila deja la pantalla colgada — es la
 * lección que dejó el listado de campañas de correo.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useSondeo } from '@/lib/hooks/useSondeo';
import PixelInput from '@/components/ui/PixelInput';
import BrandLoader from '@/components/ui/BrandLoader';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { TONO } from '@/components/ui/tonos';
import { PanelEmpty, BTN_ROW } from '@/components/dashboard/flows/FlowPanelUI';
import { useAltoHastaElPie } from '@/lib/hooks/useAltoHastaElPie';
import { costoEnDolares, costoLegible } from '@/lib/ia/precios';
import {
  Inbox, Search, Bot, User, Send, HandHelping, RotateCcw, AlertTriangle, Sparkles, FileText,
  Smartphone, History, Mic, Image as ImageIcon,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

/**
 * Cómo se llama este contacto, por orden de quién lo eligió.
 *
 * Manda `nombre_agenda` —el nombre con el que la EMPRESA lo tiene guardado— sobre
 * `nombre_perfil`, que es el alias que el cliente final se puso a sí mismo en WhatsApp y
 * suele ser inútil para quien atiende: «~», «💕💕💕», «Tn». El equipo busca por el nombre
 * de su agenda, no por ese.
 */
function comoSeLlama(c: { nombre_agenda?: string | null; nombre_perfil?: string | null; wa_id: string }) {
  return c.nombre_agenda || c.nombre_perfil || c.wa_id;
}

interface Fila {
  id: number; wa_id: string; nombre_perfil: string | null; nombre_agenda: string | null;
  bot_activo: boolean; motivo_escalado: string | null;
  ultimo_texto: string | null; ultima_direccion: string | null;
  ultimo_mensaje_en: string | null; mensajes: number;
  tomada_por_nombre: string | null; tiene_resumen: boolean;
}
interface Mensaje {
  id: number; direccion: string; texto: string | null; herramienta: string | null;
  /** `text`, `audio`, `image`… Distingue lo que el cliente escribió de lo que se transcribió. */
  tipo: string;
  motivo: string | null; enviado_ok: boolean | null; error_envio: string | null; created_at: string;
}

const FILTROS = [
  { valor: 'todas', texto: 'Todas' },
  { valor: 'humanas', texto: 'Con una persona' },
  { valor: 'bot', texto: 'Con el agente' },
] as const;

export default function AgenteBandeja({ flowId, acciones }: { flowId: number; acciones?: React.ReactNode }) {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [filtro, setFiltro] = useState<string>('todas');
  const [busca, setBusca] = useState('');
  const [sel, setSel] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  /** Las dos columnas llegan hasta el pie de la app, sin meterse debajo. */
  const altoBandeja = useAltoHastaElPie({ minimo: 420 });

  /**
   * `silencioso` distingue las dos formas de cargar. La primera vez —y al cambiar de
   * filtro— un fallo es información y se avisa. En el sondeo no: se reintenta a los pocos
   * segundos, y un aviso por cada corte de red sería una lluvia de mensajes rojos.
   */
  const cargarLista = useCallback(async (silencioso = false) => {
    try {
      const q = new URLSearchParams({ filtro, q: busca });
      const d = await fetch(`/api/admin/flows/${flowId}/agente/conversaciones?${q}`).then((r) => r.json());
      setFilas(d.data ?? []);
    } catch { if (!silencioso) toast.error('No se pudo cargar la bandeja'); }
    finally { setCargando(false); }
  }, [flowId, filtro, busca]);

  useEffect(() => { cargarLista(); }, [cargarLista]);

  /**
   * La bandeja se refresca sola.
   *
   * Los mensajes no los provoca quien mira la pantalla: llegan por WhatsApp y el agente
   * contesta segundos después, sin que aquí pase nada. Sin esto había que recargar la
   * página para ver una conversación en marcha — lo vio Fernando el 2026-08-03 durante el
   * ensayo del número de prueba.
   *
   * Seis segundos: el debounce del agente es de ocho, así que una respuesta suya aparece
   * a la vuelta siguiente de haberse enviado. Más rápido no adelantaría nada.
   */
  useSondeo(() => cargarLista(true), 6000);

  if (cargando) return <div className="flex justify-center py-20"><BrandLoader label="Cargando la bandeja…" /></div>;

  return (
    <div>
      {/* ── UNA SOLA FILA DE CONTROLES ────────────────────────────────────────────
          Antes eran dos: un título «Conversaciones» con su recuento arriba, y los
          filtros debajo. El título sobraba —quien está en la Bandeja ya sabe que mira
          conversaciones— y el recuento repetía lo que dicen los propios filtros. Dos
          filas de adorno le comían alto a lo único que importa, que es la lista.

          Orden: filtros a la izquierda (lo que se toca a diario), buscador y pestañas a
          la derecha. El buscador va pegado a las pestañas a propósito: son los dos
          controles de NAVEGACIÓN, y separarlos obligaba a cruzar la pantalla. */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {FILTROS.map((f) => (
          <button key={f.valor} onClick={() => setFiltro(f.valor)}
            className={filtro === f.valor ? BTN_PRIMARY : BTN_SECONDARY}>
            {f.texto}
          </button>
        ))}
        <div className="ml-auto w-56 relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-digi-muted pointer-events-none" />
          <PixelInput placeholder="Buscar por número o nombre…" value={busca}
            onChange={(e: any) => setBusca(e.target.value)} style={{ paddingLeft: 28 }} />
        </div>
        {acciones && <div className="flex items-center gap-2 shrink-0">{acciones}</div>}
      </div>

      {filas.length === 0 ? (
        <PanelEmpty Icon={Inbox} title="Todavía no hay conversaciones"
          desc="Aparecerán aquí en cuanto alguien escriba al número conectado." />
      ) : (
        /* `items-stretch` + alto compartido: antes era `items-start` con `max-h-[70vh]`,
           que es un TECHO, no un relleno. Con pocas conversaciones las dos columnas medían
           lo que su contenido y dejaban media pantalla muerta debajo — se veía con una sola
           conversación de cuatro mensajes. */
        <div ref={altoBandeja.ref} className="flex gap-4 items-stretch" style={altoBandeja.style}>
          {/* La lista: cabecera fija ninguna, así que el desplazamiento es de todo el bloque. */}
          <div className="w-[320px] shrink-0 h-full overflow-y-auto rounded-lg border border-digi-border bg-digi-card">
            {filas.map((f) => (
              <button key={f.id} onClick={() => setSel(f.id)}
                className={`w-full text-left px-3 py-2.5 border-b border-digi-border last:border-b-0 transition-colors ${
                  sel === f.id ? 'bg-accent-light border-l-2 border-l-accent' : 'hover:bg-digi-bg'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-digi-text truncate" style={mf}>
                    {comoSeLlama(f)}
                  </span>
                  {f.bot_activo
                    ? <Bot className="w-3.5 h-3.5 text-digi-muted shrink-0" />
                    : <User className="w-3.5 h-3.5 text-accent shrink-0" />}
                </div>
                <p className="text-[12px] text-digi-muted truncate mt-0.5" style={mf}>
                  {f.ultima_direccion === 'saliente' && <span className="text-digi-muted">Tú: </span>}
                  {f.ultimo_texto || '(sin mensajes de texto)'}
                </p>
                <p className="text-[11px] text-digi-muted mt-1" style={mf}>
                  {f.ultimo_mensaje_en ? new Date(f.ultimo_mensaje_en).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                  {' · '}{f.mensajes} mensaje(s)
                  {f.tomada_por_nombre && ` · ${f.tomada_por_nombre}`}
                </p>
              </button>
            ))}
          </div>

          <div className="flex-1 min-w-0 h-full">
            {sel ? <Hilo flowId={flowId} convId={sel} alCambiar={cargarLista} />
                 : (
                   <div className="h-full flex items-center justify-center rounded-lg border border-dashed border-digi-border">
                     <PanelEmpty Icon={Inbox} title="Elige una conversación" desc="Aquí se ve el hilo completo y se puede tomar el chat." />
                   </div>
                 )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── El hilo ────────────────────────────────────────────────────────────────── */

function Hilo({ flowId, convId, alCambiar }: { flowId: number; convId: number; alCambiar: () => void }) {
  const [datos, setDatos] = useState<any>(null);
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const finRef = useRef<HTMLDivElement | null>(null);
  const cuerpoRef = useRef<HTMLDivElement | null>(null);
  /** ¿La vista está al final del hilo? Decide si el sondeo puede bajar solo. */
  const pegadoAbajo = useRef(true);

  const cargar = useCallback(async () => {
    const d = await fetch(`/api/admin/flows/${flowId}/agente/conversaciones/${convId}`).then((r) => r.json());
    setDatos(d.data ?? null);
  }, [flowId, convId]);

  useEffect(() => { cargar(); }, [cargar]);

  // El hilo abierto también se refresca solo; si no, la lista mostraría un mensaje nuevo
  // que al abrir el chat no está. Se pausa mientras se envía o se toma la conversación:
  // esas acciones ya recargan al terminar, y una vuelta a medias pintaría el estado viejo.
  useSondeo(cargar, 6000, !ocupado);

  /**
   * Bajar del todo SOLO si ya se estaba abajo.
   *
   * Antes bajaba en cada `datos`, y eso con el sondeo significa que a quien esté leyendo
   * lo de arriba se le va la vista al final cada seis segundos. El margen de 60 px es
   * para que «casi abajo» cuente como abajo.
   */
  useEffect(() => {
    if (pegadoAbajo.current) finRef.current?.scrollIntoView({ block: 'end' });
  }, [datos]);

  // Al cambiar de conversación se empieza abajo, que es donde está lo último.
  useEffect(() => { pegadoAbajo.current = true; }, [convId]);

  if (!datos) return <div className="flex justify-center py-16"><BrandLoader label="Cargando el hilo…" /></div>;

  const { conversacion: c, mensajes, gasto } = datos as { conversacion: any; mensajes: Mensaje[]; gasto: any };

  const alternarToma = async (tomar: boolean) => {
    setOcupado(true);
    try {
      const res = await fetch(`/api/admin/flows/${flowId}/agente/conversaciones/${convId}/tomar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tomar }),
      });
      if (!res.ok) { toast.error('No se pudo cambiar'); return; }
      toast.success(tomar ? 'Conversación tomada: el agente ya no responde aquí' : 'Devuelta al agente');
      await cargar(); alCambiar();
    } finally { setOcupado(false); }
  };

  const enviar = async () => {
    const limpio = texto.trim();
    if (!limpio) return;
    setOcupado(true);
    try {
      const res = await fetch(`/api/admin/flows/${flowId}/agente/conversaciones/${convId}/responder`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: limpio }),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error ?? 'No se pudo enviar'); return; }
      setTexto(''); await cargar(); alCambiar();
    } finally { setOcupado(false); }
  };

  return (
    // `h-full` en vez de `max-h-[70vh]`: llena la columna. Cabecera, resumen, redacción y
    // pie son `shrink-0`; los mensajes son lo único que crece y se desplaza.
    <div className="h-full rounded-lg border border-digi-border bg-digi-card flex flex-col overflow-hidden">
      <div className="shrink-0 px-4 py-3 border-b border-digi-border flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* Solo el nombre. Quién lleva la conversación ya se sabe por dos sitios mejores:
              el icono de cada fila en la lista, y el botón de tomar/devolver que hay en
              esta misma cabecera — que además es donde se cambia. Y el motivo del escalado
              («La atiende el equipo desde WhatsApp») era una frase técnica nuestra puesta
              sobre el nombre de un cliente de verdad. */}
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-digi-text truncate" style={mf}>
              {comoSeLlama(c)}
            </span>
          </div>
          <p className="text-[11.5px] text-digi-muted mt-0.5" style={mf}>{c.wa_id}</p>
        </div>
        {c.bot_activo ? (
          <button className={BTN_PRIMARY} disabled={ocupado} onClick={() => alternarToma(true)}>
            <HandHelping className="w-4 h-4" /> Tomar la conversación
          </button>
        ) : (
          <button className={BTN_SECONDARY} disabled={ocupado} onClick={() => alternarToma(false)}>
            <RotateCcw className="w-4 h-4" /> Devolver al agente
          </button>
        )}
      </div>

      {c.resumen && (
        <div className="shrink-0 px-4 py-2 border-b border-digi-border bg-digi-bg">
          <p className="text-[11px] uppercase tracking-wide text-digi-muted mb-1" style={mf}>Memoria de lo hablado antes</p>
          <p className="text-[12.5px] text-digi-text whitespace-pre-wrap" style={mf}>{c.resumen}</p>
        </div>
      )}

      {/* ⚠️ `min-h-0` NO es opcional: por defecto vale `auto` = «no me encojas por debajo de
          mi contenido», así que la zona crecería y el desplazamiento no aparecería nunca. */}
      <div
        ref={cuerpoRef}
        onScroll={() => {
          const el = cuerpoRef.current;
          if (el) pegadoAbajo.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2 [&>*]:shrink-0"
      >
        {mensajes.map((m) => <Burbuja key={m.id} m={m} />)}
        <div ref={finRef} />
      </div>

      <div className="shrink-0 px-4 py-3 border-t border-digi-border">
        {c.bot_activo ? (
          <p className="text-[12.5px] text-digi-muted flex items-center gap-1.5" style={mf}>
            <Bot className="w-3.5 h-3.5" />
            Toma la conversación para escribir. Si no, el agente podría responder a la vez y el
            contacto recibiría dos respuestas.
          </p>
        ) : (
          <div className="flex gap-2 items-end">
            <textarea
              className="flex-1 rounded-md border border-digi-border bg-digi-bg px-3 py-2 text-[13px] text-digi-text resize-y min-h-[64px]"
              style={mf} rows={2} value={texto} placeholder="Escribe tu respuesta…"
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) enviar(); }}
            />
            <button className={BTN_PRIMARY} disabled={ocupado || !texto.trim()} onClick={enviar}>
              <Send className="w-4 h-4" /> Enviar
            </button>
          </div>
        )}
      </div>

      <div className="shrink-0 px-4 py-2 border-t border-digi-border text-[11px] text-digi-muted flex flex-wrap items-center gap-x-4 gap-y-1" style={mf}>
        {/* ⇒ LO QUE HA COSTADO ESTA CONVERSACIÓN, EN DINERO.
            Los tokens de al lado son la materia prima, pero nadie decide nada con
            «23.651 tokens». Con «$0,0114» sí: se sabe si un agente sale a cuenta, y el
            cliente puede ver qué está pagando por atender a un cliente suyo.
            La tarifa vive en `lib/ia/precios.ts`, con la fecha en que se comprobó. */}
        <span className="px-1.5 py-0.5 rounded bg-accent-light text-accent font-medium">
          {costoLegible(costoEnDolares({
            tokensEntrada: gasto.entrada,
            tokensSalida: gasto.salida,
            tokensCacheLectura: gasto.cache_lectura,
          }))} en IA
        </span>
        <span>{gasto.corridas} corrida(s) del modelo</span>
        <span>{gasto.entrada.toLocaleString('es-ES')} tokens de entrada</span>
        <span>{gasto.salida.toLocaleString('es-ES')} de salida</span>
        {/* Cero lecturas de caché tras varias corridas = el prefijo no llega al mínimo
            del modelo, y se está pagando el prompt entero cada vez. */}
        <span className={gasto.corridas > 1 && gasto.cache_lectura === 0 ? 'text-amber-700 font-medium' : ''}>
          {gasto.cache_lectura.toLocaleString('es-ES')} leídos de caché
          {gasto.corridas > 1 && gasto.cache_lectura === 0 && ' — el caché no está entrando'}
        </span>
      </div>
    </div>
  );
}

function Burbuja({ m }: { m: Mensaje }) {
  const entrante = m.direccion === 'entrante';
  const hora = new Date(m.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  // El agente calló a propósito: no hay burbuja, pero sí constancia de la decisión.
  if (m.herramienta === 'no_responder') {
    return (
      <div className="flex justify-center">
        <span className="text-[11px] text-digi-muted italic px-2 py-1" style={mf}>
          El agente no respondió — {m.motivo}
        </span>
      </div>
    );
  }
  if (!m.texto && m.herramienta === 'escalar_a_humano') {
    return (
      <div className="flex justify-center">
        <span className={`text-[11px] ${TONO.aviso.texto} italic px-2 py-1`} style={mf}>
          Pasó a una persona — {m.motivo}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex ${entrante ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[75%] rounded-lg px-3 py-2 ${
        entrante ? 'bg-digi-bg border border-digi-border' : 'bg-accent-light border border-accent/30'}`}>
        {/* ── DE DÓNDE SALIÓ ESTE TEXTO ──────────────────────────────────────────
            Una nota de voz y una foto se guardan ya convertidas a texto (ver
            `lib/agente/medios.ts`), que es lo que hace que el agente pueda contestarlas.
            Pero al leerlo así, sin más, parece que el cliente lo escribió — y no es lo
            mismo: una transcripción puede equivocarse, y quien atiende necesita saber
            que ahí detrás hay un audio antes de fiarse de la palabra exacta. */}
        {entrante && (m.tipo === 'audio' || m.tipo === 'voice') && (
          <span className="flex items-center gap-1 text-[10.5px] text-digi-muted mb-1" style={mf}>
            <Mic className="w-3 h-3" /> nota de voz, transcrita
          </span>
        )}
        {entrante && (m.tipo === 'image' || m.tipo === 'sticker') && (
          <span className="flex items-center gap-1 text-[10.5px] text-digi-muted mb-1" style={mf}>
            <ImageIcon className="w-3 h-3" /> imagen, descrita
          </span>
        )}
        <p className="text-[13px] text-digi-text whitespace-pre-wrap break-words" style={mf}>{m.texto}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[10.5px] text-digi-muted" style={mf}>{hora}</span>
          {/* Quién escribió esto. Son cinco orígenes distintos y conviene distinguirlos:
              «a mano» lo tecleó una persona DESDE ESTA PANTALLA, «WhatsApp del cliente» lo
              escribió su equipo desde su propio móvil o WhatsApp Web —coexistencia—,
              «agente» lo compuso el modelo, «plantilla» salió de un envío masivo, y
              «anterior» venía del volcado de conversaciones previas al alta. Al leer un
              hilo, esa diferencia lo explica todo: sin ella, un mensaje del equipo del
              cliente parecería nuestro. */}
          {!entrante && (
            m.herramienta === 'equipo'
              ? <span className="text-[10.5px] text-accent flex items-center gap-0.5" style={mf}><Smartphone className="w-2.5 h-2.5" /> WhatsApp del cliente</span>
              : m.herramienta === 'historial'
                ? <span className="text-[10.5px] text-digi-muted flex items-center gap-0.5" style={mf}><History className="w-2.5 h-2.5" /> anterior</span>
                : m.herramienta === 'plantilla'
                  ? <span className="text-[10.5px] text-accent flex items-center gap-0.5" style={mf}><FileText className="w-2.5 h-2.5" /> plantilla</span>
                  : m.herramienta === null
                    ? <span className="text-[10.5px] text-digi-muted flex items-center gap-0.5" style={mf}><User className="w-2.5 h-2.5" /> a mano</span>
                    : <span className="text-[10.5px] text-digi-muted flex items-center gap-0.5" style={mf}><Sparkles className="w-2.5 h-2.5" /> agente</span>
          )}
          {m.enviado_ok === false && (
            <span className="text-[10.5px] text-red-600 flex items-center gap-0.5" style={mf}>
              <AlertTriangle className="w-2.5 h-2.5" /> no se envió
            </span>
          )}
        </div>
        {m.error_envio && (
          <p className="text-[11px] text-red-600 mt-1" style={mf}>{m.error_envio}</p>
        )}
      </div>
    </div>
  );
}

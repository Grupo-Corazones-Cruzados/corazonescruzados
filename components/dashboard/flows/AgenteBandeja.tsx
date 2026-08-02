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
import PixelBadge from '@/components/ui/PixelBadge';
import PixelInput from '@/components/ui/PixelInput';
import BrandLoader from '@/components/ui/BrandLoader';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { TONO } from '@/components/ui/tonos';
import { SectionBar, PanelEmpty, BTN_ROW } from '@/components/dashboard/flows/FlowPanelUI';
import {
  Inbox, Search, Bot, User, Send, HandHelping, RotateCcw, AlertTriangle, Sparkles,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

interface Fila {
  id: number; wa_id: string; nombre_perfil: string | null;
  bot_activo: boolean; motivo_escalado: string | null;
  ultimo_texto: string | null; ultima_direccion: string | null;
  ultimo_mensaje_en: string | null; mensajes: number;
  tomada_por_nombre: string | null; tiene_resumen: boolean;
}
interface Mensaje {
  id: number; direccion: string; texto: string | null; herramienta: string | null;
  motivo: string | null; enviado_ok: boolean | null; error_envio: string | null; created_at: string;
}

const FILTROS = [
  { valor: 'todas', texto: 'Todas' },
  { valor: 'humanas', texto: 'Con una persona' },
  { valor: 'bot', texto: 'Con el agente' },
] as const;

export default function AgenteBandeja({ flowId, acciones }: { flowId: number; acciones?: React.ReactNode }) {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [conteo, setConteo] = useState({ bot: 0, humanas: 0 });
  const [filtro, setFiltro] = useState<string>('todas');
  const [busca, setBusca] = useState('');
  const [sel, setSel] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargarLista = useCallback(async () => {
    try {
      const q = new URLSearchParams({ filtro, q: busca });
      const d = await fetch(`/api/admin/flows/${flowId}/agente/conversaciones?${q}`).then((r) => r.json());
      setFilas(d.data ?? []);
      if (d.conteo) setConteo(d.conteo);
    } catch { toast.error('No se pudo cargar la bandeja'); }
    finally { setCargando(false); }
  }, [flowId, filtro, busca]);

  useEffect(() => { cargarLista(); }, [cargarLista]);

  if (cargando) return <div className="flex justify-center py-20"><BrandLoader label="Cargando la bandeja…" /></div>;

  return (
    <div>
      <SectionBar
        title="Conversaciones"
        hint={`${conteo.bot} con el agente · ${conteo.humanas} con una persona`}
      >
        {acciones}
      </SectionBar>

      <div className="flex flex-wrap gap-2 items-center mb-3">
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
      </div>

      {filas.length === 0 ? (
        <PanelEmpty Icon={Inbox} title="Todavía no hay conversaciones"
          desc="Aparecerán aquí en cuanto alguien escriba al número conectado." />
      ) : (
        <div className="flex gap-4 items-start">
          <div className="w-[320px] shrink-0 rounded-lg border border-digi-border bg-digi-card overflow-hidden max-h-[70vh] overflow-y-auto">
            {filas.map((f) => (
              <button key={f.id} onClick={() => setSel(f.id)}
                className={`w-full text-left px-3 py-2.5 border-b border-digi-border last:border-b-0 transition-colors ${
                  sel === f.id ? 'bg-accent-light border-l-2 border-l-accent' : 'hover:bg-digi-bg'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-digi-text truncate" style={mf}>
                    {f.nombre_perfil || f.wa_id}
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

          <div className="flex-1 min-w-0">
            {sel ? <Hilo flowId={flowId} convId={sel} alCambiar={cargarLista} />
                 : <PanelEmpty Icon={Inbox} title="Elige una conversación" desc="Aquí se ve el hilo completo y se puede tomar el chat." />}
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

  const cargar = useCallback(async () => {
    const d = await fetch(`/api/admin/flows/${flowId}/agente/conversaciones/${convId}`).then((r) => r.json());
    setDatos(d.data ?? null);
  }, [flowId, convId]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { finRef.current?.scrollIntoView({ block: 'end' }); }, [datos]);

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
    <div className="rounded-lg border border-digi-border bg-digi-card flex flex-col max-h-[70vh]">
      <div className="px-4 py-3 border-b border-digi-border flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-digi-text truncate" style={mf}>
              {c.nombre_perfil || c.wa_id}
            </span>
            {c.bot_activo
              ? <PixelBadge variant="info">Lo lleva el agente</PixelBadge>
              : <PixelBadge variant="warning">Lo lleva una persona</PixelBadge>}
          </div>
          <p className="text-[11.5px] text-digi-muted mt-0.5" style={mf}>{c.wa_id}</p>
          {c.motivo_escalado && (
            <p className={`text-[12px] ${TONO.aviso.texto} mt-1`} style={mf}>Motivo del escalado: {c.motivo_escalado}</p>
          )}
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
        <div className="px-4 py-2 border-b border-digi-border bg-digi-bg">
          <p className="text-[11px] uppercase tracking-wide text-digi-muted mb-1" style={mf}>Memoria de lo hablado antes</p>
          <p className="text-[12.5px] text-digi-text whitespace-pre-wrap" style={mf}>{c.resumen}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {mensajes.map((m) => <Burbuja key={m.id} m={m} />)}
        <div ref={finRef} />
      </div>

      <div className="px-4 py-3 border-t border-digi-border">
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

      <div className="px-4 py-2 border-t border-digi-border text-[11px] text-digi-muted flex flex-wrap gap-x-4" style={mf}>
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
        <p className="text-[13px] text-digi-text whitespace-pre-wrap break-words" style={mf}>{m.texto}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[10.5px] text-digi-muted" style={mf}>{hora}</span>
          {!entrante && (
            m.herramienta === null
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

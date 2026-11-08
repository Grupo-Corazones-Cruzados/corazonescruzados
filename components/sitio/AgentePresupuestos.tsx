'use client';

/**
 * EL AGENTE DE GCC (Fernando, 2026-11-06). Responde consultas del negocio y hace presupuestos. Es una
 * burbuja abajo a la derecha, y se abre sola en el centro solo con `abrirAlEntrar`. Al conversar se
 * amplía y, si hay presupuesto, lo enseña a la derecha con el botón de aceptar y los pasos de datos. En
 * el teléfono, conversación y presupuesto son pestañas. Agotadas las 3 sesiones anónimas, pide entrar.
 *
 * Portal al `body`: un `fixed` dentro de un elemento animado se coloca respecto a él.
 */

import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { ArrowUp, Bot, Calculator, LogIn, MessageCircle, X } from 'lucide-react';
import { EnElPie, BotonPie } from '@/components/dashboard/PieAcciones';
import Captcha from '@/components/landing/Captcha';
import { fmt2 } from '@/lib/format';
import type { Mensaje, Presupuesto } from '@/lib/presupuestos/db';

type Sesion = {
  id: string;
  mensajes: Mensaje[];
  presupuesto: Presupuesto | null;
  tokens: number;
  maxTokens: number;
  deCuenta: boolean;
  enviada: { tipo: string; id: number } | null;
};

const SALIDA_MS = 360;

const negritas = (t: string): ReactNode[] => t.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
  p.startsWith('**') && p.endsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : <Fragment key={i}>{p}</Fragment>);

/** El texto del agente: párrafos, listas y negritas. Nunca HTML: lo escribe un modelo. */
function TextoAgente({ texto }: { texto: string }) {
  const bloques: ReactNode[] = [];
  let lista: { tipo: 'ol' | 'ul'; items: string[] } | null = null;
  const cerrar = () => {
    if (!lista) return;
    const L = lista.tipo;
    bloques.push(<L key={bloques.length}>{lista.items.map((x, i) => <li key={i}>{negritas(x)}</li>)}</L>);
    lista = null;
  };
  for (const crudo of texto.split('\n')) {
    const l = crudo.trim();
    const m = l.match(/^(\d+[.)]|[-*•])\s+(.*)$/);
    if (m) {
      const tipo = /\d/.test(m[1]) ? 'ol' : 'ul';
      if (lista && (lista as { tipo: string }).tipo !== tipo) cerrar();
      lista ??= { tipo, items: [] };
      (lista as { items: string[] }).items.push(m[2]);
    } else {
      cerrar();
      if (l) bloques.push(<p key={bloques.length}>{negritas(l.replace(/^#+\s*/, ''))}</p>);
    }
  }
  cerrar();
  return <>{bloques}</>;
}

/**
 * `enPie`: en el panel, el botón va en el pie junto a las notificaciones y los chats en vez de flotar
 * abajo a la derecha (Fernando, 2026-11-08). En el sitio público sigue siendo la burbuja.
 */
export default function AgentePresupuestos({ solucion = 'tecnologia', enPie = false }: { solucion?: string; enPie?: boolean }) {
  const ruta = usePathname();
  // Se abre sola en la página de Tecnología; en las demás espera a que la pulsen.
  const abrirAlEntrar = ruta === '/clientes/soluciones/tecnologia';
  const [montado, setMontado] = useState(false);
  const [fase, setFase] = useState<'cerrado' | 'abriendo' | 'abierto' | 'cerrando'>('cerrado');
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [activaId, setActivaId] = useState<string | null>(null);
  const [usadas, setUsadas] = useState(0);
  const [maximo, setMaximo] = useState(3);
  const [libre, setLibre] = useState(false);
  const [logueado, setLogueado] = useState(false);
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [estado, setEstado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vista, setVista] = useState<'charla' | 'panel'>('charla');
  const fin = useRef<HTMLDivElement>(null);
  // Una carga lenta no puede pisar una conversación que ya empezó.
  const empezada = useRef(false);

  const activa = sesiones.find((s) => s.id === activaId) ?? null;
  const conConversacion = !!activa?.mensajes.length;
  const puedeNueva = libre || usadas < maximo;
  const conPanel = !!activa?.presupuesto;

  const abrir = useCallback(() => {
    setFase('abriendo');
    requestAnimationFrame(() => requestAnimationFrame(() => setFase('abierto')));
  }, []);
  const cerrar = useCallback(() => {
    setFase('cerrando');
    setTimeout(() => setFase('cerrado'), SALIDA_MS);
  }, []);

  useEffect(() => {
    setMontado(true);
    let vigente = true;
    fetch(`/api/presupuestos?solucion=${solucion}`).then((r) => r.json()).then((j) => {
      if (!vigente || empezada.current) return;
      setSesiones(j.sesiones ?? []);
      // Con cuenta se empieza en una sesión de la cuenta: las anónimas no leen sus datos.
      const lista: Sesion[] = j.sesiones ?? [];
      setActivaId((j.conSesion ? lista.filter((s) => s.deCuenta) : lista).at(-1)?.id ?? null);
      setLogueado(!!j.conSesion);
      setUsadas(j.usadas ?? 0);
      setMaximo(j.maximo ?? 3);
      setLibre(!!j.libre);
    }).catch(() => {});
    return () => { vigente = false; };
  }, [solucion]);

  useEffect(() => {
    if (!abrirAlEntrar) return;
    const t = setTimeout(abrir, 450);
    return () => clearTimeout(t);
  }, [abrirAlEntrar, abrir]);

  useEffect(() => {
    if (fase !== 'abierto') return;
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', tecla);
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', tecla); document.body.style.overflow = previo; };
  }, [fase, cerrar]);

  useEffect(() => { fin.current?.scrollIntoView({ block: 'end' }); }, [activa?.mensajes, estado]);

  const cambiar = useCallback((id: string, f: (s: Sesion) => Sesion) => {
    setSesiones((l) => l.map((s) => (s.id === id ? f(s) : s)));
  }, []);

  const crear = async (): Promise<string | null> => {
    empezada.current = true;
    const r = await fetch('/api/presupuestos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ solucion }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(j.error ?? 'No se pudo abrir la sesión.'); return null; }
    setSesiones((l) => [...l, j.sesion]);
    setActivaId(j.sesion.id);
    setUsadas((n) => n + 1);
    return j.sesion.id;
  };

  const enviar = async (e?: FormEvent) => {
    e?.preventDefault();
    const limpio = texto.trim();
    if (!limpio || ocupado) return;
    setError(null);
    empezada.current = true;
    setOcupado(true);
    setEstado('Pensando…');
    try {
      const id = activaId && !activa?.enviada ? activaId : await crear();
      if (!id) return;
      setTexto('');
      cambiar(id, (s) => ({ ...s, mensajes: [...s.mensajes, { rol: 'usuario', texto: limpio }, { rol: 'agente', texto: '' }] }));
      const r = await fetch(`/api/presupuestos/${id}/mensaje`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto: limpio }),
      });
      if (!r.ok || !r.body) {
        const j = await r.json().catch(() => ({}));
        setError(j.error ?? 'El agente no pudo responder.');
        cambiar(id, (s) => ({ ...s, mensajes: s.mensajes.filter((m) => m.texto) }));
        return;
      }
      const lector = r.body.pipeThrough(new TextDecoderStream()).getReader();
      let resto = '';
      for (;;) {
        const { done, value } = await lector.read();
        if (done) break;
        resto += value;
        const lineas = resto.split('\n');
        resto = lineas.pop() ?? '';
        for (const l of lineas) {
          if (!l.trim()) continue;
          const ev = JSON.parse(l);
          if (ev.tipo === 'texto') {
            setEstado(null);
            cambiar(id, (s) => {
              const m = [...s.mensajes];
              const ultimo = m[m.length - 1];
              // Si la lista se recargó a mitad de la respuesta, el último puede no ser del agente.
              if (ultimo?.rol === 'agente') m[m.length - 1] = { rol: 'agente', texto: ultimo.texto + ev.delta };
              else m.push({ rol: 'agente', texto: ev.delta });
              return { ...s, mensajes: m };
            });
          } else if (ev.tipo === 'estado') setEstado(ev.texto);
          else if (ev.tipo === 'presupuesto') cambiar(id, (s) => ({ ...s, presupuesto: ev.presupuesto }));
          else if (ev.tipo === 'tokens') cambiar(id, (s) => ({ ...s, tokens: ev.tokens }));
          else if (ev.tipo === 'error') setError(ev.texto);
        }
      }
      cambiar(id, (s) => ({ ...s, mensajes: s.mensajes.filter((m) => m.texto) }));
    } catch {
      setError('Se perdió la conexión. Inténtalo otra vez.');
    } finally {
      setOcupado(false);
      setEstado(null);
    }
  };

  if (!montado) return null;
  const agotada = !!activa && activa.tokens >= activa.maxTokens;
  const visible = fase === 'abierto';

  return createPortal(
    <>
      {enPie && (
        <EnElPie orden={5}>
          <BotonPie Icon={Bot} label="Asistente" tono="acento" activo={fase === 'abierto' || fase === 'abriendo'} onClick={abrir} />
        </EnElPie>
      )}
      {!enPie && fase !== 'abierto' && fase !== 'abriendo' && (
        <button type="button" className={`presu-burbuja${fase === 'cerrado' ? ' es-visible' : ''}`} onClick={abrir}
          aria-label="Abrir el agente de GCC" title="Consultas y presupuestos">
          <MessageCircle aria-hidden />
        </button>
      )}
      {fase !== 'cerrado' && (
        <div className={`presu-velo${visible ? ' es-visible' : ''}`} onMouseDown={(e) => { if (e.target === e.currentTarget) cerrar(); }}>
          <div className={`presu-marco${conConversacion ? ' es-amplio' : ''}`} role="dialog" aria-modal="true" aria-label="Agente de GCC">
            <div className="presu-cabeza">
              <h2>Agente de GCC</h2>
              {sesiones.length > 1 && (
                <select className="presu-sesion" aria-label="Sesión" value={activaId ?? ''} disabled={ocupado} onChange={(e) => setActivaId(e.target.value)}>
                  {sesiones.map((s, i) => <option key={s.id} value={s.id}>Sesión {i + 1}</option>)}
                </select>
              )}
              {conConversacion && (puedeNueva ? (
                <button type="button" className="presu-boton-suave" disabled={ocupado} title="Abrir otra sesión"
                  onClick={() => { setError(null); void crear(); setVista('charla'); }}>
                  Nueva
                </button>
              ) : (
                <a className="presu-boton-suave presu-boton-enlace" href="/auth/cliente" title={`Ya usaste las ${maximo} sesiones: inicia sesión para seguir`}>Iniciar sesión</a>
              ))}
              <button type="button" className="presu-cerrar" onClick={cerrar} aria-label="Cerrar"><X aria-hidden /></button>
            </div>

            {!conConversacion ? (
              <>
                <div className="presu-bienvenida">
                  <span className="presu-bienvenida-icono"><Calculator aria-hidden /></span>
                  <h3>{abrirAlEntrar ? '¿Qué te gustaría presupuestar para tu negocio?' : '¿En qué te ayudo?'}</h3>
                  <p>{abrirAlEntrar
                    ? 'Cuéntame tu idea o el problema que quieres resolver. Te doy un rango de precio basado en proyectos y tickets que ya hemos terminado.'
                    : logueado
                      ? 'Pregúntame sobre el negocio o sobre tus tickets, proyectos, clientes y facturas, o cuéntame una idea para presupuestarla.'
                      : 'Pregúntame sobre el negocio, nuestros productos, pagos o miembros, o cuéntame tu idea para presupuestarla.'}</p>
                </div>
                {error && <p className="presu-error" style={{ padding: '10px 24px 0', textAlign: 'center' }}>{error}</p>}
                {!puedeNueva && (!activa || agotada) ? <PedirSesion maximo={maximo} /> : (
                  <Compositor texto={texto} setTexto={setTexto} enviar={enviar} ocupado={ocupado} enfocar />
                )}
              </>
            ) : (
              <>
                {conPanel && <div className="presu-pestanas" role="tablist">
                  <button type="button" role="tab" aria-selected={vista === 'charla'} onClick={() => setVista('charla')}>Conversación</button>
                  <button type="button" role="tab" aria-selected={vista === 'panel'} onClick={() => setVista('panel')}>Presupuesto</button>
                </div>}
                <div className={`presu-cuerpo${conPanel ? '' : ' sin-panel'}`}>
                  <section className="presu-charla" data-vista={vista} hidden={conPanel && esTelefono() && vista !== 'charla'}>
                    <div className="presu-mensajes">
                      {activa!.mensajes.map((m, i) => m.texto && (
                        <div key={i} className={`presu-msj es-${m.rol}`}>
                          {m.rol === 'agente' ? <TextoAgente texto={m.texto} /> : m.texto}
                        </div>
                      ))}
                      {estado && <div className="presu-estado"><span className="presu-puntos"><i /><i /><i /></span>{estado}</div>}
                      {error && <p className="presu-error">{error}</p>}
                      <div ref={fin} />
                    </div>
                    {activa!.enviada || agotada ? (
                      puedeNueva ? (
                        <p className="presu-texto" style={{ padding: 16, borderTop: '1px solid #ece9f3' }}>
                          {activa!.enviada ? 'Este presupuesto ya se envió. Puedes abrir otra sesión con «Nueva».' : 'Esta sesión llegó a su límite de uso. Puedes aceptar el presupuesto o abrir otra sesión con «Nueva».'}
                        </p>
                      ) : <PedirSesion maximo={maximo} />
                    ) : (
                      <>
                        <Compositor texto={texto} setTexto={setTexto} enviar={enviar} ocupado={ocupado} />
                        <p className="presu-consumo">Uso de esta sesión: {Math.min(100, Math.round((activa!.tokens / activa!.maxTokens) * 100))} %</p>
                      </>
                    )}
                  </section>
                  {conPanel && (
                    <aside className="presu-panel" hidden={esTelefono() && vista !== 'panel'}>
                      <PanelPresupuesto sesion={activa!} ocupado={ocupado} logueado={logueado}
                        alEnviar={(enviada) => cambiar(activa!.id, (s) => ({ ...s, enviada }))} />
                    </aside>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}

/** Sin sesiones anónimas: para seguir hay que entrar como cliente. */
function PedirSesion({ maximo }: { maximo: number }) {
  return (
    <div className="presu-pedir-sesion">
      <p className="presu-texto">Ya usaste las {maximo} sesiones disponibles. Inicia sesión como cliente para seguir usando el agente.</p>
      <a className="presu-principal" href="/auth/cliente"><LogIn aria-hidden /> Iniciar sesión</a>
    </div>
  );
}

const esTelefono = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 899.98px)').matches;

function Compositor({ texto, setTexto, enviar, ocupado, enfocar }: {
  texto: string; setTexto: (t: string) => void; enviar: (e?: FormEvent) => void; ocupado: boolean; enfocar?: boolean;
}) {
  return (
    <form className="presu-compositor" onSubmit={enviar}>
      <textarea value={texto} rows={1} maxLength={4000} autoFocus={enfocar && !esTelefono()} placeholder="Escribe aquí…" aria-label="Tu mensaje"
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !esTelefono()) { e.preventDefault(); enviar(); } }} />
      <button type="submit" className="presu-enviar" disabled={ocupado || !texto.trim()} aria-label="Enviar"><ArrowUp aria-hidden /></button>
    </form>
  );
}

function PanelPresupuesto({ sesion, ocupado, logueado, alEnviar }: {
  sesion: Sesion; ocupado: boolean; logueado: boolean; alEnviar: (e: { tipo: string; id: number }) => void;
}) {
  const [paso, setPaso] = useState<'resumen' | 'identificar' | 'alta' | 'codigo'>('resumen');
  const [identificacion, setIdentificacion] = useState('');
  const [correoMascara, setCorreoMascara] = useState<string | null>(null);
  const [existe, setExiste] = useState(false);
  const [conSesion, setConSesion] = useState<string | null>(null);
  const [codigo, setCodigo] = useState('');
  const [alta, setAlta] = useState({ nombre: '', correo: '', pais: '', telefono: '', direccion: '', clave: '' });
  const [terminos, setTerminos] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [reinicio, setReinicio] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const a = sesion.presupuesto;

  const pedir = async (cuerpo: object) => {
    setError(null);
    setBusy(true);
    try {
      const r = await fetch(`/api/presupuestos/${sesion.id}/solicitud`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(j.error ?? 'No se pudo completar.'); if (j.captcha) setReinicio((n) => n + 1); return null; }
      if (j.enviada) alEnviar(j.enviada);
      return j;
    } catch {
      setError('Se perdió la conexión. Inténtalo otra vez.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  if (sesion.enviada) {
    return (
      <div className="presu-hoja">
        <p className="presu-etiqueta">Enviado</p>
        <h3>¡Recibimos tu solicitud!</h3>
        <p className="presu-texto">
          Tu {sesion.enviada.tipo === 'ticket' ? 'ticket' : 'proyecto'} ya está abierto y lo verán los miembros con el talento adecuado.
          Te avisaremos por correo. Para seguirlo, entra con tu cuenta de cliente.
        </p>
      </div>
    );
  }
  if (!a) return <p className="presu-panel-vacio">Aquí verás tu presupuesto en cuanto el agente tenga lo necesario.</p>;

  if (paso === 'identificar') {
    return (
      <form className="presu-hoja" onSubmit={async (e) => {
        e.preventDefault();
        const j = await pedir({ paso: 'identificar', identificacion });
        if (!j) return;
        if (j.conSesion) { setConSesion(j.conSesion); return; }
        setExiste(!!j.existe);
        setCorreoMascara(j.correo ?? null);
        if (!j.existe) setPaso('alta');
      }}>
        <p className="presu-etiqueta">Paso 2 de 3 · Tus datos</p>
        {conSesion ? (
          <>
            <p className="presu-texto">Se enviará con tu cuenta <b>{conSesion}</b>.</p>
            <button type="button" className="presu-principal" disabled={busy} onClick={() => pedir({ paso: 'con-sesion' })}>{busy ? 'Enviando…' : 'Enviar solicitud'}</button>
          </>
        ) : existe ? (
          <>
            <p className="presu-texto">Ya eres cliente. Para proteger tu cuenta, te enviaremos un código a <b>{correoMascara}</b>.</p>
            <button type="button" className="presu-principal" disabled={busy} onClick={async () => {
              const j = await pedir({ paso: 'codigo-existente', identificacion });
              if (j) setPaso('codigo');
            }}>{busy ? 'Enviando…' : 'Enviar código'}</button>
          </>
        ) : logueado ? (
          <p className="presu-texto">Un momento…</p>
        ) : (
          <>
            <label className="presu-campo">RUC, cédula o pasaporte
              <input value={identificacion} onChange={(e) => setIdentificacion(e.target.value)} autoComplete="off" required />
            </label>
            <button type="submit" className="presu-principal" disabled={busy || identificacion.trim().length < 5}>{busy ? 'Buscando…' : 'Continuar'}</button>
          </>
        )}
        {error && <p className="presu-error">{error}</p>}
        <button type="button" className="presu-enlace" onClick={() => { setPaso('resumen'); setExiste(false); setConSesion(null); }}>Volver al presupuesto</button>
      </form>
    );
  }

  if (paso === 'alta') {
    const listo = alta.nombre.trim().length > 2 && /@/.test(alta.correo) && alta.pais.trim().length > 1 && alta.telefono.trim().length >= 7
      && alta.direccion.trim() && alta.clave.length >= 8 && terminos && captcha;
    const campo = (k: keyof typeof alta, rotulo: string, tipo = 'text', auto = 'off') => (
      <label className="presu-campo">{rotulo}
        <input type={tipo} value={alta[k]} autoComplete={auto} onChange={(e) => setAlta({ ...alta, [k]: e.target.value })} required />
      </label>
    );
    return (
      <form className="presu-hoja" onSubmit={async (e) => {
        e.preventDefault();
        const j = await pedir({ paso: 'codigo-alta', identificacion, ...alta, terminos, altcha: captcha });
        if (j) { setCorreoMascara(j.correo); setPaso('codigo'); }
      }}>
        <p className="presu-etiqueta">Paso 2 de 3 · Crea tu cuenta de cliente</p>
        {campo('nombre', 'Nombre completo', 'text', 'name')}
        {campo('correo', 'Correo electrónico', 'email', 'email')}
        {campo('pais', 'País', 'text', 'country-name')}
        {campo('telefono', 'Teléfono', 'tel', 'tel')}
        {campo('direccion', 'Dirección', 'text', 'street-address')}
        {campo('clave', 'Contraseña (mínimo 8 caracteres)', 'password', 'new-password')}
        <label className="presu-casilla">
          <input type="checkbox" checked={terminos} onChange={(e) => setTerminos(e.target.checked)} />
          <span>Acepto los <a href="/legal" target="_blank" rel="noreferrer">términos y la política de privacidad</a>.</span>
        </label>
        <Captcha onCambio={setCaptcha} reinicio={reinicio} tema="claro" />
        {error && <p className="presu-error">{error}</p>}
        <button type="submit" className="presu-principal" disabled={busy || !listo}>{busy ? 'Enviando…' : 'Continuar'}</button>
        <button type="button" className="presu-enlace" onClick={() => setPaso('identificar')}>Volver</button>
      </form>
    );
  }

  if (paso === 'codigo') {
    return (
      <form className="presu-hoja" onSubmit={(e) => { e.preventDefault(); void pedir({ paso: 'confirmar', codigo }); }}>
        <p className="presu-etiqueta">Paso 3 de 3 · Confirmar</p>
        <p className="presu-texto">Escribe el código que enviamos a <b>{correoMascara}</b>.</p>
        <label className="presu-campo">Código
          <input value={codigo} inputMode="numeric" autoComplete="one-time-code" maxLength={6} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} />
        </label>
        {error && <p className="presu-error">{error}</p>}
        <button type="submit" className="presu-principal" disabled={busy || codigo.length !== 6}>{busy ? 'Enviando…' : 'Enviar solicitud'}</button>
        <button type="button" className="presu-enlace" onClick={() => setPaso('identificar')}>Volver</button>
      </form>
    );
  }

  return (
    <div key={JSON.stringify(a)} className="presu-hoja">
      <p className="presu-etiqueta">{a.tipo === 'ticket' ? 'Ticket' : 'Proyecto'} · Presupuesto actual</p>
      <h3>{a.titulo}</h3>
      <p className="presu-desc">{a.descripcion}</p>
      {a.tipo === 'ticket' ? (
        <>
          <p className="presu-dias">Días de trabajo: {a.dias}</p>
          <div>
            <p className="presu-etiqueta" style={{ marginBottom: 10 }}>Acciones</p>
            <ol className="presu-lista">{a.acciones.map((x, i) => <li key={i}><b>{x}</b></li>)}</ol>
          </div>
        </>
      ) : (
        <div>
          <p className="presu-etiqueta" style={{ marginBottom: 10 }}>Requerimientos</p>
          <ol className="presu-lista">{a.requerimientos.map((r, i) => <li key={i}><b>{r.titulo}</b><span>{r.descripcion}</span></li>)}</ol>
        </div>
      )}
      <div className="presu-precio">
        <p className="presu-etiqueta">Precio estimado</p>
        <strong>{fmt2(a.precio_min)} a {fmt2(a.precio_max)} USD</strong>
        <small>Rango según trabajos parecidos. GCC lo confirma al revisar tu solicitud.</small>
      </div>
      <button type="button" className="presu-principal" disabled={ocupado} onClick={async () => {
        setError(null);
        setPaso('identificar');
        // Con sesión iniciada no se piden datos: ya se sabe quién es.
        if (logueado) {
          const j = await pedir({ paso: 'identificar' });
          if (j?.conSesion) setConSesion(j.conSesion);
        }
      }}>Aceptar y enviar la solicitud</button>
    </div>
  );
}

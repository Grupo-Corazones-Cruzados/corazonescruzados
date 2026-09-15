'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  UserRound, Package, ShieldAlert, MessageSquare, Check, X, HelpCircle, KeyRound, FileDown, Copy,
  Plus, Pencil, RefreshCw, Pause, Play, Ban, CalendarX2, Send, ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { CabeceraPagina } from '@/componentes/Navegacion';
import {
  Boton, Tarjeta, RailFiltro, PanelLateral, Ventanita, Confirmar, Insignia, Campo, Entrada, AreaTexto, EstadoVacio, Tabla,
} from '@/componentes/ui';
import { Aviso, Punto } from '@/componentes/campos';
import { CamposCliente, type DatosCliente } from '@/componentes/FormularioCliente';
import { CamposServicio, type DatosServicio } from '@/componentes/FormularioServicio';
import { EditorRestricciones } from '@/componentes/EditorRestricciones';
import { CalendarioServicio, LeyendaCalendario } from '@/componentes/CalendarioServicio';
import { ETIQUETA_ESTADO_CLIENTE, TONO_ESTADO_CLIENTE, ETIQUETA_COMIDA, ETIQUETA_MENSAJE, TONO_MENSAJE, DIA_CORTO, RESTRICCIONES_DESPACHO } from '@/lib/catalogo';
import { ETIQUETA_SITUACION, TONO_SITUACION, type ResumenServicio, type DiaCalendario } from '@/lib/servicios';
import { fechaCorta, fechaLarga, instante } from '@/lib/fechas';
import { editarCliente, cambiarEstadoCliente, enviarMensaje, guardarRestricciones, restablecerClaveCliente, type CambioEstado } from '@/acciones/clientes';
import { crearServicio, editarServicio, renovarServicio, cambiarEstadoServicio, cerrarServicio, cancelarDia, reactivarDia } from '@/acciones/servicios';
import type { EstadoCliente, EstadoServicio, TipoComida, DiaSemana, TipoMensaje, CategoriaAlimento, Autor } from '@/generated/prisma/enums';

export type ServicioVista = {
  id: number;
  estado: EstadoServicio;
  diasTotales: number;
  fechaInicio: string;
  tiposComida: TipoComida[];
  diasSemana: DiaSemana[];
  porcentajeCancelacion: number;
  renovaciones: number;
  notas: string | null;
  terminoEn: string | null;
  resumen: ResumenServicio;
  calendario: DiaCalendario[];
  cancelaciones: { id: number; dia: string; motivo: string | null; autor: Autor; activa: boolean; reactivadaPor: Autor | null }[];
};

type Cliente = {
  id: number;
  email: string;
  estado: EstadoCliente;
  creado: string;
  ultimoAcceso: string | null;
  datos: DatosCliente;
  restricciones: { alimentoId: number; nombre: string; tiposComida: TipoComida[] }[];
  mensajes: { id: number; texto: string; tipo: TipoMensaje; leido: boolean; creado: string }[];
};

type Seccion = 'datos' | 'servicio' | 'restricciones' | 'mensajes';

export default function FichaCliente({
  slug, hoy, zonaHoraria, comidas, diasNegocio, porcentajeDefecto, cliente, servicios, alimentos, motorizados,
}: {
  slug: string;
  hoy: string;
  zonaHoraria: string;
  comidas: TipoComida[];
  diasNegocio: DiaSemana[];
  porcentajeDefecto: number;
  cliente: Cliente;
  servicios: ServicioVista[];
  alimentos: { id: number; nombre: string; categoria: CategoriaAlimento }[];
  motorizados: { id: number; nombre: string }[];
}) {
  const router = useRouter();
  const [seccion, setSeccion] = useState<Seccion>(cliente.estado === 'PENDIENTE' ? 'datos' : 'servicio');
  const [cambio, setCambio] = useState<CambioEstado | null>(null);
  const [texto, setTexto] = useState('');
  const [clave, setClave] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enCurso, arranca] = useTransition();

  const vigente = servicios.find((s) => s.estado !== 'VENCIDO') ?? null;
  const noLeidos = cliente.mensajes.filter((m) => !m.leido).length;

  const ejecutarCambio = () =>
    arranca(async () => {
      if (!cambio) return;
      setError(null);
      const r = await cambiarEstadoCliente(slug, cliente.id, cambio, texto);
      if (!r.ok) return setError(r.error);
      toast.success({ APROBAR: 'Cliente aprobado', RECHAZAR: 'Registro rechazado', SOLICITAR_INFO: 'Solicitud enviada', ACTIVAR: 'Cliente activado', INACTIVAR: 'Cliente inactivado' }[cambio]);
      setCambio(null);
      setTexto('');
      router.refresh();
    });

  const acciones = (
    <>
      {cliente.estado === 'PENDIENTE' && (
        <>
          <Boton icono={Check} onClick={() => { setError(null); setCambio('APROBAR'); }}>Aprobar</Boton>
          <Boton variante="secundario" icono={HelpCircle} onClick={() => { setError(null); setCambio('SOLICITAR_INFO'); }}>Pedir información</Boton>
          <Boton variante="peligro" icono={X} onClick={() => { setError(null); setCambio('RECHAZAR'); }}>Rechazar</Boton>
        </>
      )}
      {cliente.estado === 'ACTIVO' && <Boton variante="secundario" icono={Ban} onClick={() => setCambio('INACTIVAR')}>Inactivar</Boton>}
      {(cliente.estado === 'INACTIVO' || cliente.estado === 'RECHAZADO') && <Boton icono={Check} onClick={() => setCambio('ACTIVAR')}>Activar</Boton>}
      <Boton variante="secundario" icono={KeyRound} title="Genera una contraseña nueva para el portal"
        onClick={() => arranca(async () => { const r = await restablecerClaveCliente(slug, cliente.id); if (!r.ok) { toast.error(r.error); return; } setClave(r.clave!); })}>
        Nueva contraseña
      </Boton>
      <a href={`/${slug}/api/pdf/cliente/${cliente.id}`} download>
        <Boton variante="secundario" icono={FileDown}>Ficha en PDF</Boton>
      </a>
    </>
  );

  return (
    <>
      <CabeceraPagina
        titulo={cliente.datos.nombre}
        descripcion={`${cliente.email} · ${cliente.datos.celular} · registrado el ${fechaCorta(new Date(cliente.creado))}`}
        acciones={acciones}
      />
      <div className="flex flex-col gap-4 p-4 sm:p-6 lg:flex-row">
        <div className="space-y-3 lg:w-[220px] lg:shrink-0">
          <Link href={`/${slug}/clientes`} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-tenue hover:text-texto">
            <ArrowLeft className="h-3.5 w-3.5" /> Todos los clientes
          </Link>
          <Tarjeta className="p-3">
            <div className="flex items-center gap-2">
              <Punto color={cliente.datos.colorIdentificador} tamano={14} />
              <Insignia tono={TONO_ESTADO_CLIENTE[cliente.estado]}>{ETIQUETA_ESTADO_CLIENTE[cliente.estado]}</Insignia>
            </div>
            {vigente ? (
              <p className="mt-2 text-[12px] text-tenue">
                <Insignia tono={TONO_SITUACION[vigente.resumen.situacion]}>{ETIQUETA_SITUACION[vigente.resumen.situacion]}</Insignia>
                <span className="mt-1 block">{vigente.resumen.diasRestantes} de {vigente.diasTotales} días · hasta {fechaCorta(vigente.resumen.fechaFin)}</span>
              </p>
            ) : (
              <p className="mt-2 text-[12px] text-tenue">Sin servicio vigente</p>
            )}
            {cliente.ultimoAcceso && <p className="mt-2 text-[11px] text-tenue">Último acceso {instante(cliente.ultimoAcceso, zonaHoraria)}</p>}
          </Tarjeta>
          <RailFiltro
            className="lg:w-full"
            activo={seccion}
            alElegir={(v) => setSeccion(v as Seccion)}
            opciones={[
              { valor: 'datos', etiqueta: 'Datos', icono: UserRound },
              { valor: 'servicio', etiqueta: 'Servicio', icono: Package, conteo: servicios.length },
              { valor: 'restricciones', etiqueta: 'Restricciones', icono: ShieldAlert, conteo: cliente.restricciones.length },
              { valor: 'mensajes', etiqueta: 'Mensajes', icono: MessageSquare, conteo: noLeidos || undefined },
            ]}
          />
        </div>
        <div className="min-w-0 flex-1">
          {seccion === 'datos' && <SeccionDatos slug={slug} cliente={cliente} comidas={comidas} motorizados={motorizados} />}
          {seccion === 'servicio' && (
            <SeccionServicio slug={slug} hoy={hoy} cliente={cliente} servicios={servicios} comidas={comidas} diasNegocio={diasNegocio} porcentajeDefecto={porcentajeDefecto} />
          )}
          {seccion === 'restricciones' && <SeccionRestricciones slug={slug} cliente={cliente} alimentos={alimentos} comidas={comidas} />}
          {seccion === 'mensajes' && <SeccionMensajes slug={slug} cliente={cliente} zonaHoraria={zonaHoraria} />}
        </div>
      </div>

      <Ventanita
        abierto={cambio !== null}
        alCerrar={() => setCambio(null)}
        titulo={{ APROBAR: 'Aprobar el registro', RECHAZAR: 'Rechazar el registro', SOLICITAR_INFO: 'Pedir más información', ACTIVAR: 'Activar al cliente', INACTIVAR: 'Inactivar al cliente' }[cambio ?? 'APROBAR']}
        pie={
          <>
            <Boton variante="secundario" onClick={() => setCambio(null)} disabled={enCurso}>Cancelar</Boton>
            <Boton variante={cambio === 'RECHAZAR' || cambio === 'INACTIVAR' ? 'peligro' : 'primario'} onClick={ejecutarCambio} disabled={enCurso}>
              {enCurso ? 'Un momento…' : 'Confirmar'}
            </Boton>
          </>
        }
      >
        <p className="text-[13px] text-tenue">
          {cambio === 'APROBAR' && 'El cliente podrá entrar al portal y recibirá un correo de bienvenida si hay correo configurado.'}
          {cambio === 'RECHAZAR' && 'El cliente no podrá entrar. Puedes decirle por qué.'}
          {cambio === 'SOLICITAR_INFO' && 'Sigue pendiente. Escribe qué te falta; lo verá en el portal y por correo.'}
          {cambio === 'ACTIVAR' && 'Vuelve a poder entrar y a recibir comida si tiene servicio.'}
          {cambio === 'INACTIVAR' && 'Deja de entrar al portal y de aparecer en etiquetas y rutas. Su servicio se conserva.'}
        </p>
        <Campo etiqueta={cambio === 'SOLICITAR_INFO' ? 'Qué necesitas' : 'Mensaje para el cliente (opcional)'} className="mt-3" requerido={cambio === 'SOLICITAR_INFO'}>
          <AreaTexto value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} autoFocus />
        </Campo>
        {error && <div className="mt-3"><Aviso texto={error} /></div>}
      </Ventanita>

      <Ventanita abierto={clave !== null} alCerrar={() => setClave(null)} titulo="Contraseña nueva" pie={<Boton onClick={() => setClave(null)}>Entendido</Boton>}>
        <p className="text-[13px] text-tenue">Se enseña <strong>una sola vez</strong>. Pásasela al cliente; entra con su correo <span className="font-mono">{cliente.email}</span>.</p>
        <div className="mt-3 flex items-center gap-2 rounded border border-borde bg-realce px-3 py-2 font-mono text-[14px]">
          <span className="flex-1">{clave}</span>
          <button type="button" className="text-tenue hover:text-texto" title="Copiar" onClick={() => { navigator.clipboard.writeText(clave ?? ''); toast.success('Copiada'); }}><Copy className="h-4 w-4" /></button>
        </div>
      </Ventanita>
    </>
  );
}

// ── Datos ───────────────────────────────────────────────────────────────────
function SeccionDatos({ slug, cliente, comidas, motorizados }: { slug: string; cliente: Cliente; comidas: TipoComida[]; motorizados: { id: number; nombre: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [enCurso, arranca] = useTransition();
  return (
    <Tarjeta className="p-5">
      <form
        action={(d) => arranca(async () => {
          setError(null);
          const r = await editarCliente(slug, cliente.id, d);
          if (!r.ok) return setError(r.error);
          toast.success('Ficha guardada');
          router.refresh();
        })}
        className="space-y-6"
      >
        <section className="space-y-3">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-tenue">Acceso al portal</h3>
          <Campo etiqueta="Correo" requerido className="max-w-sm"><Entrada name="email" type="email" defaultValue={cliente.email} required /></Campo>
        </section>
        <CamposCliente datos={cliente.datos} comidas={comidas} motorizados={motorizados} />
        {error && <Aviso texto={error} />}
        <div className="flex justify-end border-t border-borde pt-4">
          <Boton type="submit" disabled={enCurso}>{enCurso ? 'Guardando…' : 'Guardar ficha'}</Boton>
        </div>
      </form>
    </Tarjeta>
  );
}

// ── Servicio ────────────────────────────────────────────────────────────────
function SeccionServicio({
  slug, hoy, cliente, servicios, comidas, diasNegocio, porcentajeDefecto,
}: { slug: string; hoy: string; cliente: Cliente; servicios: ServicioVista[]; comidas: TipoComida[]; diasNegocio: DiaSemana[]; porcentajeDefecto: number }) {
  const router = useRouter();
  const vigente = servicios.find((s) => s.estado !== 'VENCIDO') ?? null;
  const [panel, setPanel] = useState<{ modo: 'nuevo' | 'editar' | 'renovar'; base: DatosServicio; id?: number } | null>(null);
  const [dia, setDia] = useState<DiaCalendario | null>(null);
  const [motivo, setMotivo] = useState('');
  const [confirmar, setConfirmar] = useState<'cerrar' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enCurso, arranca] = useTransition();

  const plantilla = (s?: ServicioVista): DatosServicio => ({
    diasTotales: s?.diasTotales ?? 20,
    fechaInicio: s ? (s.estado === 'VENCIDO' ? hoy : s.fechaInicio) : hoy,
    tiposComida: s?.tiposComida ?? cliente.datos.tiposComida.filter((t) => comidas.includes(t)),
    diasSemana: s?.diasSemana ?? diasNegocio,
    porcentajeCancelacion: s?.porcentajeCancelacion ?? porcentajeDefecto,
    notas: s?.notas ?? null,
  });

  const hecho = (msg: string) => { toast.success(msg); setPanel(null); setDia(null); setConfirmar(null); setMotivo(''); router.refresh(); };

  const guardar = (d: FormData) =>
    arranca(async () => {
      if (!panel) return;
      setError(null);
      const r = panel.modo === 'nuevo' ? await crearServicio(slug, (d.set('clienteId', String(cliente.id)), d))
        : panel.modo === 'editar' ? await editarServicio(slug, panel.id!, d)
        : await renovarServicio(slug, panel.id!, d);
      if (!r.ok) return setError(r.error);
      hecho(panel.modo === 'nuevo' ? 'Servicio creado' : panel.modo === 'editar' ? 'Servicio guardado' : 'Servicio renovado');
    });

  const accionDia = () =>
    arranca(async () => {
      if (!dia || !vigente) return;
      setError(null);
      const r = dia.estado === 'CANCELADO' ? await reactivarDia(slug, dia.cancelacionId!) : await cancelarDia(slug, vigente.id, dia.dia, motivo);
      if (!r.ok) return setError(r.error);
      hecho(dia.estado === 'CANCELADO' ? 'Día reactivado' : 'Día cancelado');
    });

  return (
    <div className="space-y-4">
      {vigente ? (
        <Tarjeta className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-semibold">Servicio vigente</h2>
                <Insignia tono={TONO_SITUACION[vigente.resumen.situacion]}>{ETIQUETA_SITUACION[vigente.resumen.situacion]}</Insignia>
                {vigente.renovaciones > 0 && <Insignia tono="info">Renovado ×{vigente.renovaciones}</Insignia>}
              </div>
              <p className="mt-1 text-[12px] text-tenue">
                {vigente.tiposComida.map((t) => ETIQUETA_COMIDA[t]).join(' + ')} · {vigente.diasSemana.map((d) => DIA_CORTO[d]).join(' ')} · desde {fechaCorta(vigente.fechaInicio)} hasta {fechaCorta(vigente.resumen.fechaFin)}
              </p>
              {vigente.notas && <p className="mt-1 text-[12px] italic text-tenue">{vigente.notas}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Boton variante="secundario" tamano="sm" icono={Pencil} onClick={() => { setError(null); setPanel({ modo: 'editar', base: plantilla(vigente), id: vigente.id }); }}>Editar</Boton>
              {vigente.estado === 'ACTIVO'
                ? <Boton variante="secundario" tamano="sm" icono={Pause} onClick={() => arranca(async () => { const r = await cambiarEstadoServicio(slug, vigente.id, 'SUSPENDIDO'); r.ok ? hecho('Servicio suspendido') : toast.error(r.error); })}>Suspender</Boton>
                : <Boton variante="secundario" tamano="sm" icono={Play} onClick={() => arranca(async () => { const r = await cambiarEstadoServicio(slug, vigente.id, 'ACTIVO'); r.ok ? hecho('Servicio reanudado') : toast.error(r.error); })}>Reanudar</Boton>}
              <Boton variante="secundario" tamano="sm" icono={RefreshCw} onClick={() => { setError(null); setPanel({ modo: 'renovar', base: { ...plantilla(vigente), fechaInicio: vigente.resumen.fechaFin > hoy ? vigente.resumen.fechaFin : hoy }, id: vigente.id }); }}>Renovar</Boton>
              <Boton variante="fantasma" tamano="sm" icono={Ban} onClick={() => setConfirmar('cerrar')}>Cerrar</Boton>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {[
              ['Consumidos', `${vigente.resumen.diasConsumidos} de ${vigente.diasTotales}`],
              ['Restantes', String(vigente.resumen.diasRestantes)],
              ['Cancelaciones', `${vigente.resumen.cancelacionesUsadas} de ${vigente.resumen.maxCancelaciones}`],
              ['Termina', fechaCorta(vigente.resumen.fechaFin)],
            ].map(([e, v]) => (
              <div key={e} className="rounded border border-borde bg-realce/50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-tenue">{e}</p>
                <p className="text-[15px] font-semibold">{v}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] text-tenue">Pulsa un día pendiente para cancelarlo, o uno cancelado para reactivarlo. El personal no tiene hora límite.</p>
            <LeyendaCalendario />
          </div>
          <div className="mt-3">
            <CalendarioServicio dias={vigente.calendario} hoy={hoy} alPulsar={(d) => { if (d.estado === 'SERVIDO' && d.dia < hoy) return; setError(null); setMotivo(''); setDia(d); }} />
          </div>
        </Tarjeta>
      ) : (
        <Tarjeta>
          <EstadoVacio
            icono={Package}
            titulo="Sin servicio vigente"
            detalle={cliente.estado === 'ACTIVO' ? 'Véndele uno: días, comidas y días de la semana.' : 'Solo se vende un servicio a un cliente activo.'}
            accion={cliente.estado === 'ACTIVO' && (
              <Boton icono={Plus} onClick={() => { setError(null); setPanel({ modo: 'nuevo', base: plantilla(servicios[0]) }); }}>Nuevo servicio</Boton>
            )}
          />
        </Tarjeta>
      )}

      {servicios.some((s) => s.estado === 'VENCIDO') && (
        <Tarjeta className="overflow-hidden">
          <div className="border-b border-borde px-4 py-3"><h3 className="text-[13px] font-semibold">Servicios anteriores</h3></div>
          <Tabla
            filas={servicios.filter((s) => s.estado === 'VENCIDO')}
            claveFila={(s) => s.id}
            columnas={[
              { clave: 'inicio', titulo: 'Inicio', render: (s) => fechaCorta(s.fechaInicio) },
              { clave: 'fin', titulo: 'Terminó', render: (s) => fechaCorta(s.terminoEn ?? s.resumen.fechaFin) },
              { clave: 'dias', titulo: 'Días', render: (s) => `${s.resumen.diasConsumidos} de ${s.diasTotales}` },
              { clave: 'comidas', titulo: 'Comidas', render: (s) => s.tiposComida.map((t) => ETIQUETA_COMIDA[t]).join(', ') },
              { clave: 'canc', titulo: 'Cancelaciones', alinear: 'der', render: (s) => s.cancelaciones.filter((c) => c.activa).length },
              { clave: 'acc', titulo: '', alinear: 'der', render: (s) => !vigente && cliente.estado === 'ACTIVO' ? (
                <Boton tamano="sm" variante="secundario" icono={RefreshCw} onClick={(e) => { e.stopPropagation(); setError(null); setPanel({ modo: 'renovar', base: { ...plantilla(s), fechaInicio: hoy }, id: s.id }); }}>Renovar</Boton>
              ) : null },
            ]}
          />
        </Tarjeta>
      )}

      {vigente && vigente.cancelaciones.length > 0 && (
        <Tarjeta className="overflow-hidden">
          <div className="border-b border-borde px-4 py-3"><h3 className="flex items-center gap-2 text-[13px] font-semibold"><CalendarX2 className="h-4 w-4 text-tenue" /> Cancelaciones de este servicio</h3></div>
          <Tabla
            filas={vigente.cancelaciones}
            claveFila={(c) => c.id}
            columnas={[
              { clave: 'dia', titulo: 'Día', render: (c) => fechaLarga(c.dia) },
              { clave: 'motivo', titulo: 'Motivo', render: (c) => c.motivo ?? <span className="text-tenue">—</span> },
              { clave: 'autor', titulo: 'Quién', render: (c) => (c.autor === 'CLIENTE' ? 'El cliente' : 'El negocio') },
              { clave: 'estado', titulo: 'Estado', render: (c) => (c.activa ? <Insignia tono="error">Cancelado</Insignia> : <Insignia tono="neutro">Reactivado{c.reactivadaPor ? ` por ${c.reactivadaPor === 'CLIENTE' ? 'el cliente' : 'el negocio'}` : ''}</Insignia>) },
            ]}
          />
        </Tarjeta>
      )}

      <PanelLateral
        abierto={panel !== null}
        alCerrar={() => setPanel(null)}
        titulo={panel?.modo === 'nuevo' ? 'Nuevo servicio' : panel?.modo === 'editar' ? 'Editar servicio' : 'Renovar servicio'}
        descripcion={panel?.modo === 'renovar' ? 'Se crea un servicio nuevo; el anterior queda vencido con su histórico.' : undefined}
        pie={
          <>
            <Boton variante="secundario" onClick={() => setPanel(null)} disabled={enCurso}>Cancelar</Boton>
            <Boton type="submit" form="form-servicio" disabled={enCurso}>{enCurso ? 'Guardando…' : 'Guardar'}</Boton>
          </>
        }
      >
        {panel && (
          <form id="form-servicio" action={guardar} className="space-y-4">
            <CamposServicio datos={panel.base} comidas={comidas} diasNegocio={diasNegocio} />
            {error && <Aviso texto={error} />}
          </form>
        )}
      </PanelLateral>

      <Ventanita
        abierto={dia !== null}
        alCerrar={() => setDia(null)}
        titulo={dia?.estado === 'CANCELADO' ? 'Reactivar el día' : 'Cancelar el día'}
        pie={
          <>
            <Boton variante="secundario" onClick={() => setDia(null)} disabled={enCurso}>Volver</Boton>
            <Boton variante={dia?.estado === 'CANCELADO' ? 'primario' : 'peligro'} onClick={accionDia} disabled={enCurso}>
              {enCurso ? 'Un momento…' : dia?.estado === 'CANCELADO' ? 'Reactivar' : 'Cancelar el día'}
            </Boton>
          </>
        }
      >
        {dia && (
          <>
            <p className="text-[13px] font-semibold first-letter:uppercase">{fechaLarga(dia.dia)}</p>
            {dia.estado === 'CANCELADO' ? (
              <p className="mt-1 text-[13px] text-tenue">Está cancelado{dia.motivo ? ` («${dia.motivo}»)` : ''}. Al reactivarlo vuelve a contar y a salir en etiquetas y rutas.</p>
            ) : (
              <>
                <p className="mt-1 text-[13px] text-tenue">No se le llevará comida ese día y no consumirá del servicio. La fecha de fin se corre.</p>
                <Campo etiqueta="Motivo (opcional)" className="mt-3"><Entrada value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus /></Campo>
              </>
            )}
            {error && <div className="mt-3"><Aviso texto={error} /></div>}
          </>
        )}
      </Ventanita>

      <Confirmar
        abierto={confirmar === 'cerrar'}
        titulo="Cerrar el servicio"
        mensaje="Queda vencido desde hoy, con su histórico. Para volver a servirle habrá que renovarlo."
        textoAceptar="Cerrar servicio"
        ocupado={enCurso}
        alCerrar={() => setConfirmar(null)}
        alAceptar={() => arranca(async () => { if (!vigente) return; const r = await cerrarServicio(slug, vigente.id); r.ok ? hecho('Servicio cerrado') : toast.error(r.error); })}
      />
    </div>
  );
}

function SeccionRestricciones({ slug, cliente, alimentos, comidas }: { slug: string; cliente: Cliente; alimentos: { id: number; nombre: string; categoria: CategoriaAlimento }[]; comidas: TipoComida[] }) {
  return (
    <div className="space-y-4">
      <Tarjeta className="p-5">
        <h2 className="text-[14px] font-semibold">Restricciones de cocina</h2>
        <div className="mt-3">
          <EditorRestricciones alimentos={alimentos} comidas={comidas} inicial={cliente.restricciones.map((r) => ({ alimentoId: r.alimentoId, tiposComida: r.tiposComida }))} guardar={(r) => guardarRestricciones(slug, cliente.id, r)} />
        </div>
      </Tarjeta>
      <Tarjeta className="p-5">
        <h2 className="text-[14px] font-semibold">Restricciones de despacho</h2>
        <p className="mt-1 text-[12px] text-tenue">Se editan en «Datos». Hoy: {RESTRICCIONES_DESPACHO.filter(([k]) => cliente.datos[k]).map(([, e]) => e).join(', ') || 'ninguna'}.</p>
      </Tarjeta>
    </div>
  );
}

// ── Mensajes ────────────────────────────────────────────────────────────────
function SeccionMensajes({ slug, cliente, zonaHoraria }: { slug: string; cliente: Cliente; zonaHoraria: string }) {
  const router = useRouter();
  const [texto, setTexto] = useState('');
  const [enCurso, arranca] = useTransition();
  return (
    <div className="space-y-4">
      <Tarjeta className="p-5">
        <h2 className="text-[14px] font-semibold">Enviar un mensaje</h2>
        <p className="mt-0.5 text-[12px] text-tenue">Lo verá en su portal la próxima vez que entre.</p>
        <div className="mt-3 flex gap-2">
          <AreaTexto value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} placeholder="Mañana no hay servicio por el feriado…" />
          <Boton icono={Send} disabled={enCurso || !texto.trim()} onClick={() => arranca(async () => { const r = await enviarMensaje(slug, cliente.id, texto); if (!r.ok) { toast.error(r.error); return; } setTexto(''); toast.success('Mensaje enviado'); router.refresh(); })}>Enviar</Boton>
        </div>
      </Tarjeta>
      <Tarjeta className="overflow-hidden">
        {cliente.mensajes.length === 0 ? (
          <EstadoVacio icono={MessageSquare} titulo="Sin mensajes" />
        ) : (
          <ul className="divide-y divide-borde">
            {cliente.mensajes.map((m) => (
              <li key={m.id} className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Insignia tono={TONO_MENSAJE[m.tipo]}>{ETIQUETA_MENSAJE[m.tipo]}</Insignia>
                  <span className="text-[11px] text-tenue">{instante(m.creado, zonaHoraria)}</span>
                  {!m.leido && <span className="text-[11px] text-aviso">· sin leer</span>}
                </div>
                <p className="mt-1 text-[13px]">{m.texto}</p>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </div>
  );
}

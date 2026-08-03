'use client';

/**
 * LISTAS DE CONTACTOS DE UN FLUJO — la columna de listas y la tabla de contactos.
 *
 * ── QUÉ ES ─────────────────────────────────────────────────────────────────────
 * Un bloque autónomo: pide sus datos, los edita y no necesita que nadie le pase estado.
 * Se le dice de qué flujo es y, opcionalmente, qué lista viene seleccionada.
 *
 * Habla con las rutas que ya existen —`/api/admin/flows/{id}/contact-lists` y sus
 * contactos—, que están montadas **por flujo**. Así las listas del agente son suyas y no
 * se mezclan con las de otro cliente.
 *
 * ── DE DÓNDE SALE ──────────────────────────────────────────────────────────────
 * Del flujo de correo masivo, que lo tenía escrito dentro de sus 1.500 líneas. Al pedir
 * Fernando la misma disposición para las plantillas de WhatsApp (2026-08-03), copiarlo
 * habría dejado dos tablas de contactos que se irían separando con el tiempo.
 *
 * ⚠️ PENDIENTE: `EmailFlowWorkspace` todavía tiene su propia copia. Migrarlo aquí es el
 * siguiente paso, y se dejó fuera de este cambio a propósito para poder comprobarlo por
 * separado sin arriesgar una pantalla que funciona.
 */

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelInput from '@/components/ui/PixelInput';
import PixelConfirm from '@/components/ui/PixelConfirm';
import BrandLoader from '@/components/ui/BrandLoader';
import { EditPanel, EditField, EDIT_INPUT } from '@/components/ui/EditDialog';
import { BTN_PRIMARY } from '@/components/ui/Button';
import { SectionBar, BTN_ROW, BTN_ROW_DANGER } from '@/components/dashboard/flows/FlowPanelUI';
import {
  Users, Plus, Pencil, Trash2, Upload, Download, FileSpreadsheet, User, Share2, Check,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

export interface Lista { id: number; name: string; contact_count?: number; share_token?: string | null }
export interface Contacto {
  id: number; name: string; email: string | null; phone: string | null; position: string | null;
}

/* ═══════════════════════ LA COLUMNA DE LISTAS ═══════════════════════ */

/**
 * La columna de listas.
 *
 * ⚠️ EL MARCADO ES EL MISMO QUE EL DE `ListGroup` EN `EmailFlowWorkspace`, A PROPÓSITO.
 * En un primer intento se escribió «parecido» —casilla nativa, botones con borde, siempre
 * visibles— y quedó una columna que hacía lo mismo pero se veía distinta. Lo vio Fernando
 * en el acto (2026-08-03). Cuando dos pantallas hacen lo mismo, no se escribe algo
 * equivalente: se copia el control, o mejor, se comparte.
 *
 * Las tres cosas que lo definen y que se habían perdido:
 *   · la casilla es un BOTÓN con `Check` dentro, no un `<input type=checkbox>`;
 *   · las acciones van pegadas al BORDE DERECHO, como iconos sin borde;
 *   · y solo aparecen al pasar el puntero, o si la lista está abierta.
 *
 * ── LA CASILLA Y EL CLIC SON DOS COSAS DISTINTAS ──────────────────────────────
 *   · la **casilla** asocia o desasocia la lista con lo que esté seleccionado —una campaña
 *     allí, una plantilla aquí—. Una lista sirve para varias.
 *   · el **clic en el nombre** solo la abre para ver y editar sus contactos.
 * Mezclarlos obligaría a asociar una lista para poder mirarla.
 */
export function ColumnaListas({
  listas, seleccionada, marcadas, alSeleccionar, alMarcar, alCrear, alRenombrar, alCompartir, alBorrar,
}: {
  listas: Lista[];
  seleccionada: number | null;
  /** Las asociadas a lo que esté seleccionado. `null` = no hay nada que asociar todavía. */
  marcadas: number[] | null;
  alSeleccionar: (id: number) => void;
  alMarcar: (l: Lista, marcar: boolean) => void;
  alCrear: () => void;
  alRenombrar: (l: Lista) => void;
  alCompartir: (l: Lista) => void;
  alBorrar: (l: Lista) => void;
}) {
  return (
    <div className="w-full lg:w-[240px] shrink-0 bg-digi-card border border-digi-border rounded-lg p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide" style={mf}>
          Listas de contactos
        </p>
        <button
          onClick={alCrear} title="Nueva lista"
          className="w-6 h-6 flex items-center justify-center rounded text-digi-muted hover:text-accent hover:bg-accent-light transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {listas.length === 0 ? (
        <p className="text-[11.5px] text-digi-muted/80 px-1 pb-1.5 leading-relaxed" style={mf}>
          Sin listas. Crea una con el + y añade los contactos a los que quieras escribir.
        </p>
      ) : (
        <div className="space-y-0.5">
          {listas.map((l) => {
            const abierta = seleccionada === l.id;
            const marcada = marcadas?.includes(l.id) ?? false;
            return (
              <div
                key={l.id}
                className={`group/list flex items-center gap-1.5 rounded-md border-l-2 transition-colors ${
                  abierta ? 'bg-accent-light border-accent' : 'border-transparent hover:bg-black/[0.03]'
                }`}
              >
                {marcadas !== null && (
                  <button
                    type="button"
                    onClick={() => alMarcar(l, !marcada)}
                    title={marcada ? 'Quitar de la plantilla' : 'Agregar a la plantilla'}
                    className={`ml-2 w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0 transition-colors ${
                      marcada ? 'bg-accent border-accent text-white' : 'border-digi-border bg-digi-darker hover:border-accent'
                    }`}
                  >
                    {marcada && <Check className="w-3 h-3" strokeWidth={3} />}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => alSeleccionar(l.id)}
                  className={`flex-1 min-w-0 text-left py-2 ${marcadas !== null ? 'pl-1' : 'pl-3'} pr-1`}
                >
                  <span className={`block text-[12.5px] font-medium truncate ${abierta ? 'text-accent' : 'text-digi-text'}`} style={mf}>
                    {l.name}
                  </span>
                  <span className="block text-[10.5px] text-digi-muted" style={mf}>
                    {l.contact_count ?? 0} contacto(s){l.share_token ? ' · enlace activo' : ''}
                  </span>
                </button>

                <span className={`flex items-center gap-0.5 pr-1.5 shrink-0 transition-opacity ${
                  abierta ? 'opacity-100' : 'opacity-0 group-hover/list:opacity-100 focus-within:opacity-100'}`}>
                  <button onClick={() => alRenombrar(l)} title="Renombrar la lista"
                    className="w-6 h-6 flex items-center justify-center rounded text-digi-muted hover:text-accent hover:bg-black/[0.05] transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => alCompartir(l)} title="Compartir enlace"
                    className="w-6 h-6 flex items-center justify-center rounded text-digi-muted hover:text-accent hover:bg-black/[0.05] transition-colors">
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => alBorrar(l)} title="Eliminar la lista"
                    className="w-6 h-6 flex items-center justify-center rounded text-digi-muted hover:text-red-500 hover:bg-red-500/10 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ LA TABLA DE CONTACTOS ═══════════════════════ */

export function TablaContactos({ flowId, lista, alCambiar }: {
  flowId: number; lista: Lista | null; alCambiar?: () => void;
}) {
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [cargando, setCargando] = useState(false);
  const [editando, setEditando] = useState<Contacto | 'nuevo' | null>(null);
  const [borrando, setBorrando] = useState<Contacto | null>(null);

  const base = `/api/admin/flows/${flowId}/contact-lists`;

  const cargar = useCallback(async () => {
    if (!lista) { setContactos([]); return; }
    setCargando(true);
    try {
      const d = await fetch(`${base}/${lista.id}/contacts`).then((r) => r.json());
      setContactos(d.data ?? []);
    } catch { toast.error('No se pudieron cargar los contactos'); }
    finally { setCargando(false); }
  }, [base, lista]);

  useEffect(() => { cargar(); }, [cargar]);

  const borrar = async () => {
    if (!borrando || !lista) return;
    const r = await fetch(`${base}/${lista.id}/contacts/${borrando.id}`, { method: 'DELETE' });
    if (!r.ok) { toast.error('No se pudo quitar'); return; }
    setBorrando(null); await cargar(); alCambiar?.();
  };

  /** La plantilla de Excel, con las cabeceras que la importación entiende. */
  const descargarPlantilla = () => {
    const hoja = XLSX.utils.json_to_sheet([{ nombre: '', correo: '', puesto: '', telefono: '' }]);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Contactos');
    XLSX.writeFile(libro, 'plantilla-contactos.xlsx');
  };

  const exportar = () => {
    if (!lista) return;
    const hoja = XLSX.utils.json_to_sheet(contactos.map((c) => ({
      nombre: c.name, correo: c.email ?? '', puesto: c.position ?? '', telefono: c.phone ?? '',
    })));
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Contactos');
    XLSX.writeFile(libro, `${lista.name}.xlsx`);
  };

  /**
   * Importa un Excel. Acepta las cabeceras en varias formas —`nombre`/`Nombre`/`name`—
   * porque el archivo lo prepara una persona, no un sistema, y rechazar por una mayúscula
   * sería devolverle el trabajo sin motivo.
   */
  const importar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo || !lista) return;
    e.target.value = '';
    try {
      const libro = XLSX.read(await archivo.arrayBuffer(), { type: 'array' });
      const filas: any[] = XLSX.utils.sheet_to_json(libro.Sheets[libro.SheetNames[0]]);
      const limpios = filas.map((r) => ({
        name: String(r['nombre'] ?? r['Nombre'] ?? r['name'] ?? '').trim(),
        email: String(r['correo'] ?? r['Correo'] ?? r['email'] ?? '').trim(),
        position: String(r['puesto'] ?? r['Puesto'] ?? r['position'] ?? r['cargo'] ?? '').trim(),
        phone: String(r['telefono'] ?? r['teléfono'] ?? r['Teléfono'] ?? r['phone'] ?? '').trim(),
      })).filter((c) => c.name || c.email || c.phone);

      if (!limpios.length) { toast.error('No se encontró ninguna fila con datos.'); return; }

      let ok = 0;
      for (const c of limpios) {
        const r = await fetch(`${base}/${lista.id}/contacts`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c),
        });
        if (r.ok) ok++;
      }
      toast.success(`${ok} de ${limpios.length} contacto(s) importado(s)`);
      await cargar(); alCambiar?.();
    } catch {
      toast.error('No se pudo leer el archivo. ¿Es un Excel válido?');
    }
  };

  if (!lista) {
    return (
      <div className="bg-digi-card border border-digi-border rounded-lg p-8 text-center">
        <div className="w-10 h-10 rounded-lg bg-black/[0.04] flex items-center justify-center mx-auto mb-2">
          <User className="w-5 h-5 text-digi-muted" />
        </div>
        <p className="text-[13px] font-medium text-digi-text" style={mf}>Elige una lista</p>
        <p className="text-[12px] text-digi-muted mt-0.5" style={mf}>
          Haz clic en el nombre de una lista para ver y editar sus contactos.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-digi-card border border-digi-border rounded-lg p-4">
      <SectionBar title={lista.name} hint={`${contactos.length} contacto(s)`}>
        <button onClick={() => setEditando('nuevo')} className={BTN_PRIMARY}>
          <Plus className="w-4 h-4" /> Agregar contacto
        </button>
      </SectionBar>

      <div className="flex flex-wrap gap-2 mb-3">
        <label className={`${BTN_ROW} cursor-pointer`}>
          <Upload className="w-3.5 h-3.5" /> Importar Excel
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={importar} />
        </label>
        <button onClick={descargarPlantilla} className={BTN_ROW}>
          <Download className="w-3.5 h-3.5" /> Descargar plantilla
        </button>
        <button onClick={exportar} className={BTN_ROW}>
          <FileSpreadsheet className="w-3.5 h-3.5" /> Exportar Excel
        </button>
      </div>

      {cargando ? (
        <div className="flex justify-center py-10"><BrandLoader size="sm" /></div>
      ) : (
        <PixelDataTable
          singleLine
          columns={[
            { key: 'name', header: 'Nombre', render: (c: Contacto) => (
              <span className="block text-[13px] font-medium text-digi-text truncate" style={mf}>{c.name}</span>
            ) },
            { key: 'email', header: 'Correo', render: (c: Contacto) => (
              <span className="block text-[12px] text-digi-muted truncate" style={mf}>{c.email || '—'}</span>
            ) },
            { key: 'position', header: 'Puesto', width: '150px', hideOnMobile: true, render: (c: Contacto) => (
              <span className="block text-[12px] text-digi-text truncate" style={mf}>{c.position || '—'}</span>
            ) },
            // ⚠️ El teléfono NO es un dato más aquí: sin él, WhatsApp no puede escribirle.
            // Se marca en rojo para que se vea antes de lanzar un envío y no después.
            { key: 'phone', header: 'Teléfono', width: '150px', render: (c: Contacto) => (
              c.phone
                ? <span className="text-[12px] text-digi-muted tabular-nums" style={mf}>{c.phone}</span>
                : <span className="text-[11.5px] text-red-400" style={mf}>sin teléfono</span>
            ) },
            { key: 'actions', header: '', width: '90px', render: (c: Contacto) => (
              <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => setEditando(c)} className={BTN_ROW} title="Editar">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setBorrando(c)} className={BTN_ROW_DANGER} title="Quitar">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) },
          ]}
          data={contactos}
          emptyTitle="Sin contactos"
          emptyDesc="Agrega uno a uno, o importa un Excel con las columnas nombre, correo, puesto y teléfono."
        />
      )}

      {editando && (
        <PanelContacto
          base={`${base}/${lista.id}/contacts`}
          contacto={editando === 'nuevo' ? null : editando}
          alCerrar={() => setEditando(null)}
          alGuardar={() => { setEditando(null); cargar(); alCambiar?.(); }}
        />
      )}

      <PixelConfirm
        open={!!borrando}
        title="Quitar contacto"
        message={`¿Quitar a "${borrando?.name}" de la lista?`}
        confirmLabel="Sí, quitar"
        onConfirm={borrar}
        onCancel={() => setBorrando(null)}
      />
    </div>
  );
}

/* ── Alta y edición de un contacto ──────────────────────────────────────────── */

function PanelContacto({ base, contacto, alCerrar, alGuardar }: {
  base: string; contacto: Contacto | null; alCerrar: () => void; alGuardar: () => void;
}) {
  const [name, setName] = useState(contacto?.name ?? '');
  const [email, setEmail] = useState(contacto?.email ?? '');
  const [position, setPosition] = useState(contacto?.position ?? '');
  const [phone, setPhone] = useState(contacto?.phone ?? '');
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    try {
      const r = await fetch(contacto ? `${base}/${contacto.id}` : base, {
        method: contacto ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), position: position.trim(), phone: phone.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(d.error ?? 'No se pudo guardar'); return; }
      alGuardar();
    } finally { setGuardando(false); }
  };

  return (
    <EditPanel
      open title={contacto ? 'Editar contacto' : 'Agregar contacto'}
      onClose={alCerrar} onSave={guardar} saving={guardando} canSave={!!name.trim()}
    >
      <div className="space-y-3">
        <EditField label="Nombre">
          <input className={EDIT_INPUT} value={name} onChange={(e) => setName(e.target.value)} />
        </EditField>
        <EditField label="Correo">
          <input className={EDIT_INPUT} value={email} onChange={(e) => setEmail(e.target.value)} />
        </EditField>
        <EditField label="Puesto">
          <input className={EDIT_INPUT} value={position} onChange={(e) => setPosition(e.target.value)} />
        </EditField>
        <EditField
          label="Teléfono"
          hint="Con el código de país, por ejemplo +593 99 123 4567. Sin teléfono, WhatsApp no puede escribirle."
        >
          <input className={EDIT_INPUT} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </EditField>
      </div>
    </EditPanel>
  );
}

/* ── Crear una lista ────────────────────────────────────────────────────────── */

export function DialogoNuevaLista({ flowId, abierto, alCerrar, alCreada }: {
  flowId: number; abierto: boolean; alCerrar: () => void; alCreada: () => void;
}) {
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { if (abierto) setNombre(''); }, [abierto]);

  const crear = async () => {
    setGuardando(true);
    try {
      const r = await fetch(`/api/admin/flows/${flowId}/contact-lists`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nombre.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(d.error ?? 'No se pudo crear'); return; }
      toast.success('Lista creada');
      alCreada();
    } finally { setGuardando(false); }
  };

  if (!abierto) return null;

  return (
    <EditPanel
      open title="Nueva lista de contactos"
      onClose={alCerrar} onSave={crear} saving={guardando} canSave={!!nombre.trim()}
      saveLabel="Crear lista"
    >
      <EditField label="Nombre de la lista" hint="Por ejemplo: Clientes de agosto, o Postulantes.">
        <PixelInput value={nombre} onChange={(e: any) => setNombre(e.target.value)} autoFocus />
      </EditField>
    </EditPanel>
  );
}

/* ── Renombrar una lista ────────────────────────────────────────────────────── */

export function DialogoRenombrarLista({ flowId, lista, alCerrar, alGuardado }: {
  flowId: number; lista: Lista | null; alCerrar: () => void; alGuardado: () => void;
}) {
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { if (lista) setNombre(lista.name); }, [lista]);
  if (!lista) return null;

  const guardar = async () => {
    setGuardando(true);
    try {
      const r = await fetch(`/api/admin/flows/${flowId}/contact-lists/${lista.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nombre.trim() }),
      });
      if (!r.ok) { toast.error('No se pudo renombrar'); return; }
      alGuardado();
    } finally { setGuardando(false); }
  };

  return (
    <EditPanel open title="Renombrar lista" onClose={alCerrar} onSave={guardar}
      saving={guardando} canSave={!!nombre.trim()}>
      <EditField label="Nombre de la lista">
        <PixelInput value={nombre} onChange={(e: any) => setNombre(e.target.value)} autoFocus />
      </EditField>
    </EditPanel>
  );
}

/* ── Compartir una lista por enlace ─────────────────────────────────────────── */

/**
 * El enlace deja que alguien de fuera **añada contactos** a la lista sin tener cuenta.
 * Es lo que ya hace el correo masivo, y sirve igual aquí: el cliente pasa el enlace a su
 * equipo y los contactos entran solos.
 *
 * ⚠️ Quien tenga el enlace puede escribir en la lista. Se desactiva con el mismo botón.
 */
export function DialogoCompartirLista({ flowId, lista, alCerrar, alCambiado }: {
  flowId: number; lista: Lista | null; alCerrar: () => void; alCambiado: () => void;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => { setToken(lista?.share_token ?? null); }, [lista]);
  if (!lista) return null;

  const enlace = token ? `${window.location.origin}/listas/${token}` : null;

  const activar = async () => {
    setOcupado(true);
    try {
      const r = await fetch(`/api/admin/flows/${flowId}/contact-lists/${lista.id}/share`, { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(d.error ?? 'No se pudo generar el enlace'); return; }
      setToken(d.share_token ?? d.token ?? null);
      alCambiado();
    } finally { setOcupado(false); }
  };

  const desactivar = async () => {
    setOcupado(true);
    try {
      const r = await fetch(`/api/admin/flows/${flowId}/contact-lists/${lista.id}/share`, { method: 'DELETE' });
      if (!r.ok) { toast.error('No se pudo desactivar'); return; }
      setToken(null); alCambiado();
    } finally { setOcupado(false); }
  };

  return (
    <EditPanel open title={`Compartir «${lista.name}»`} onClose={alCerrar}
      onSave={alCerrar} saving={ocupado} saveLabel="Cerrar">
      <div className="space-y-3">
        <p className="text-[12.5px] text-digi-muted leading-relaxed" style={mf}>
          Con este enlace, cualquiera puede <strong>añadir contactos</strong> a la lista sin tener
          cuenta en la plataforma. No podrá ver ni borrar los que ya están.
        </p>
        {enlace ? (
          <>
            <EditField label="Enlace activo">
              <input className={EDIT_INPUT} value={enlace} readOnly onFocus={(e) => e.currentTarget.select()} />
            </EditField>
            <div className="flex gap-2">
              <button className={BTN_ROW} onClick={() => { navigator.clipboard.writeText(enlace); toast.success('Enlace copiado'); }}>
                Copiar enlace
              </button>
              <button className={BTN_ROW_DANGER} onClick={desactivar} disabled={ocupado}>
                Desactivar el enlace
              </button>
            </div>
          </>
        ) : (
          <button className={BTN_PRIMARY} onClick={activar} disabled={ocupado}>
            <Share2 className="w-4 h-4" /> Generar enlace
          </button>
        )}
      </div>
    </EditPanel>
  );
}

/** Icono del bloque, para quien lo monte con un encabezado propio. */
export const IconoListas = Users;

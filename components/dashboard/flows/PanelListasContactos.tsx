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
  Users, Plus, Pencil, Trash2, Upload, Download, FileSpreadsheet, User,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

export interface Lista { id: number; name: string; contact_count?: number }
export interface Contacto {
  id: number; name: string; email: string | null; phone: string | null; position: string | null;
}

/* ═══════════════════════ LA COLUMNA DE LISTAS ═══════════════════════ */

export function ColumnaListas({ listas, seleccionada, alSeleccionar, alCrear, alBorrar }: {
  listas: Lista[];
  seleccionada: number | null;
  alSeleccionar: (id: number) => void;
  alCrear: () => void;
  alBorrar: (l: Lista) => void;
}) {
  return (
    <div className="w-full lg:w-[260px] shrink-0 rounded-lg border border-digi-border bg-digi-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-digi-border">
        <span className="text-[10.5px] font-semibold uppercase tracking-wide text-digi-muted" style={mf}>
          Listas de contactos
        </span>
        <button
          onClick={alCrear} title="Nueva lista" aria-label="Nueva lista"
          className="w-6 h-6 rounded flex items-center justify-center text-digi-muted hover:text-accent hover:bg-accent-light transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {listas.length === 0 ? (
        <p className="px-3 py-4 text-[12px] text-digi-muted leading-relaxed" style={mf}>
          Todavía no hay listas. Crea una con el <strong>+</strong> y añade los contactos a los que
          quieras escribir.
        </p>
      ) : listas.map((l) => (
        <div
          key={l.id}
          className={`group flex items-center gap-1 border-b border-digi-border last:border-b-0 transition-colors ${
            seleccionada === l.id ? 'bg-accent-light border-l-2 border-l-accent' : 'hover:bg-digi-bg'}`}
        >
          <button onClick={() => alSeleccionar(l.id)} className="min-w-0 flex-1 text-left px-3 py-2.5">
            <span className={`block text-[13px] font-medium truncate ${
              seleccionada === l.id ? 'text-accent' : 'text-digi-text'}`} style={mf}>{l.name}</span>
            <span className="block text-[11.5px] text-digi-muted" style={mf}>
              {l.contact_count ?? 0} contacto(s)
            </span>
          </button>
          <button
            onClick={() => alBorrar(l)} title="Borrar lista" aria-label="Borrar lista"
            className="shrink-0 mr-2 w-6 h-6 rounded flex items-center justify-center text-digi-muted
                       hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
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

/** Icono del bloque, para quien lo monte con un encabezado propio. */
export const IconoListas = Users;

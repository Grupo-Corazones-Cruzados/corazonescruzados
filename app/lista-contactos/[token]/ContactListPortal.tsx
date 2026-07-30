'use client';

/**
 * Página PÚBLICA (sin cuenta) para llenar una lista de contactos de Email masivo.
 * Se llega por el enlace con token que se comparte desde Automatizaciones.
 *
 * A propósito NO trae importar Excel ni descargar plantilla: aquí solo se agregan
 * contactos a mano, y se pueden editar o quitar. Estilo `.corp page-dark` + PublicHeader,
 * igual que el resto de páginas públicas con token (incidentes, calendario compartido).
 */

import { useCallback, useEffect, useState } from 'react';
import { toast, Toaster } from 'sonner';
import PublicHeader from '@/components/public/PublicHeader';
import PixelConfirm from '@/components/ui/PixelConfirm';
import BrandLoader from '@/components/ui/BrandLoader';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { Users, Plus, Pencil, Trash2, Check, X, Mail, AlertTriangle } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

const FIELD =
  'field-control w-full px-3 py-2 bg-digi-darker border border-digi-border rounded text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none';

type Contact = { id: number; name: string; email: string; addedViaShare: boolean; createdAt: string | null };

export default function ContactListPortal({ token }: { token: string }) {
  const [listName, setListName] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [maxContacts, setMaxContacts] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Alta
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);

  // Edición en línea
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Confirmación de borrado
  const [toDelete, setToDelete] = useState<Contact | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/lista-contactos/${token}`);
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'Enlace inválido'); return; }
      setListName(d.data.listName);
      setContacts(d.data.contacts || []);
      setMaxContacts(d.data.maxContacts ?? null);
      setError(null);
    } catch { setError('No se pudo cargar la lista'); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!name.trim() || !email.trim()) { toast.error('Escribe el nombre y el correo'); return; }
    setAdding(true);
    try {
      const res = await fetch(`/api/lista-contactos/${token}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Error al agregar');
      setContacts(prev => [d.data, ...prev]);
      setName(''); setEmail('');
      toast.success('Contacto agregado');
    } catch (e: any) { toast.error(e.message || 'Error al agregar'); }
    finally { setAdding(false); }
  };

  const startEdit = (c: Contact) => { setEditId(c.id); setEditName(c.name); setEditEmail(c.email); };
  const cancelEdit = () => { setEditId(null); setEditName(''); setEditEmail(''); };

  const saveEdit = async () => {
    if (editId == null) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/lista-contactos/${token}/${editId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, email: editEmail }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Error al guardar');
      setContacts(prev => prev.map(c => c.id === editId ? d.data : c));
      cancelEdit();
      toast.success('Contacto actualizado');
    } catch (e: any) { toast.error(e.message || 'Error al guardar'); }
    finally { setSavingEdit(false); }
  };

  const remove = async (c: Contact) => {
    setToDelete(null);
    try {
      const res = await fetch(`/api/lista-contactos/${token}/${c.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Error al quitar');
      }
      setContacts(prev => prev.filter(x => x.id !== c.id));
      toast.success('Contacto quitado');
    } catch (e: any) { toast.error(e.message || 'Error al quitar'); }
  };

  if (loading) {
    return (
      <div className="corp page-dark min-h-screen flex items-center justify-center">
        <BrandLoader size="lg" label="Cargando la lista…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="corp page-dark min-h-screen">
        <PublicHeader />
        <div className="flex items-center justify-center px-4 py-20">
          <div className="bg-digi-card border border-digi-border rounded-xl p-8 text-center max-w-md">
            <div className="w-11 h-11 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <h1 className="text-[16px] font-semibold text-digi-text" style={mf}>No se puede abrir la lista</h1>
            <p className="text-[13px] text-digi-muted mt-1.5" style={mf}>{error}</p>
            <p className="text-[12px] text-digi-muted mt-3" style={mf}>
              Pide un enlace nuevo a la persona que te compartió este.
            </p>
          </div>
        </div>
        <Toaster position="top-center" />
      </div>
    );
  }

  const full = maxContacts != null && contacts.length >= maxContacts;

  return (
    <div className="corp page-dark min-h-screen">
      <PublicHeader />

      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-4">
        {/* Encabezado de la lista */}
        <div className="bg-digi-card border border-digi-border rounded-xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent-light border border-accent/20 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-accent" />
            </div>
            <div className="min-w-0">
              <h1 className="text-[18px] font-semibold text-digi-text leading-tight" style={mf}>{listName}</h1>
              <p className="text-[13px] text-digi-muted mt-0.5" style={mf}>
                Lista de contactos · {contacts.length}{maxContacts ? ` de ${maxContacts}` : ''}
              </p>
            </div>
          </div>
          <p className="text-[12.5px] text-digi-muted leading-relaxed mt-3" style={mf}>
            Agrega aquí los contactos que deben recibir el correo. Puedes editarlos o quitarlos
            mientras el enlace siga activo; lo que guardes se ve al instante en GCC World.
          </p>
        </div>

        {/* Alta de contacto */}
        <div className="bg-digi-card border border-digi-border rounded-xl p-5">
          <h2 className="text-[15px] font-semibold text-digi-text mb-3" style={mf}>Agregar contacto</h2>
          {full ? (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-md border border-amber-500/40 bg-amber-500/10">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-px" />
              <p className="text-[12.5px] text-digi-text" style={mf}>
                Esta lista llegó a su máximo de {maxContacts} contactos. Todavía puedes editar o quitar los que ya están.
              </p>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre y apellido"
                className={`${FIELD} sm:flex-1`}
                style={mf}
                onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
              />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                type="email"
                inputMode="email"
                className={`${FIELD} sm:flex-1`}
                style={mf}
                onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
              />
              <button onClick={add} disabled={adding} className={`${BTN_PRIMARY} shrink-0`}>
                <Plus className="w-4 h-4" /> {adding ? 'Agregando…' : 'Agregar'}
              </button>
            </div>
          )}
        </div>

        {/* Contactos */}
        <div className="bg-digi-card border border-digi-border rounded-xl p-5">
          <h2 className="text-[15px] font-semibold text-digi-text mb-3" style={mf}>
            Contactos de la lista
          </h2>

          {contacts.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-10 h-10 rounded-lg bg-white/[0.04] flex items-center justify-center mx-auto mb-2">
                <Mail className="w-5 h-5 text-digi-muted" />
              </div>
              <p className="text-[13px] font-medium text-digi-text" style={mf}>Todavía no hay contactos</p>
              <p className="text-[12px] text-digi-muted mt-0.5" style={mf}>Agrega el primero con el formulario de arriba.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {contacts.map((c) => (
                <div key={c.id} className="rounded-lg border border-digi-border bg-digi-darker/40 px-3 py-2.5">
                  {editId === c.id ? (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input value={editName} onChange={(e) => setEditName(e.target.value)}
                        placeholder="Nombre y apellido" className={`${FIELD} sm:flex-1`} style={mf} />
                      <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                        placeholder="correo@ejemplo.com" type="email" inputMode="email"
                        className={`${FIELD} sm:flex-1`} style={mf}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); }} />
                      <div className="flex gap-2 shrink-0">
                        <button onClick={saveEdit} disabled={savingEdit} className={BTN_PRIMARY}>
                          <Check className="w-4 h-4" /> {savingEdit ? 'Guardando…' : 'Guardar'}
                        </button>
                        <button onClick={cancelEdit} className={BTN_SECONDARY} aria-label="Cancelar">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-digi-text truncate" style={mf}>{c.name}</p>
                        <p className="text-[12px] text-digi-muted truncate" style={mf}>{c.email}</p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={() => startEdit(c)}
                          className="w-8 h-8 flex items-center justify-center rounded-md border border-digi-border text-digi-muted hover:border-accent hover:text-accent transition-colors"
                          aria-label="Editar contacto" title="Editar">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setToDelete(c)}
                          className="w-8 h-8 flex items-center justify-center rounded-md border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors"
                          aria-label="Quitar contacto" title="Quitar">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <PixelConfirm
        open={toDelete !== null}
        title="Quitar contacto"
        message={`¿Quitar a "${toDelete?.name ?? ''}" de la lista?`}
        confirmLabel="Sí, quitar"
        danger
        onConfirm={() => { if (toDelete) remove(toDelete); }}
        onCancel={() => setToDelete(null)}
      />

      <Toaster position="top-center" />
    </div>
  );
}

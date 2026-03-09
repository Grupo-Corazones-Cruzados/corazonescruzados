"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Badge, DataTable, Input, Spinner, Modal, Select, Tabs } from "@/components/ui";
import RichTextEditor from "@/components/ui/RichTextEditor";
import type { Column } from "@/components/ui/DataTable";
import { CAMPAIGN_STATUS_LABELS, CAMPAIGN_STATUS_BADGE } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { EmailList, EmailContact, EmailCampaign, EmailSend } from "@/lib/types";
import styles from "../page.module.css";

// =====================================================
// Types
// =====================================================

type AutoTab = "contacts" | "campaigns";

interface ToastFn {
  (message: string, type: "success" | "error"): void;
}

interface CampaignDetail extends EmailCampaign {
  sends: EmailSend[];
}

// =====================================================
// SVG Icons
// =====================================================

function IconUsers({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M7 10a3 3 0 100-6 3 3 0 000 6zM1 17v-1a4 4 0 014-4h4a4 4 0 014 4v1M13 4.5a3 3 0 010 5.5M17 17v-1a4 4 0 00-3-3.87" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconMail({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <rect x="2" y="4" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 6l8 5 8-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSend({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M18 2L9 11M18 2l-5 16-4-7-7-4 16-5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPlus({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconUpload({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M3 14v2a2 2 0 002 2h10a2 2 0 002-2v-2M10 3v10M6 7l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconDownload({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M3 14v2a2 2 0 002 2h10a2 2 0 002-2v-2M10 3v10M6 10l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTrash({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M2 4h12M5.33 4V2.67a1.33 1.33 0 011.34-1.34h2.66a1.33 1.33 0 011.34 1.34V4M12.67 4v9.33a1.33 1.33 0 01-1.34 1.34H4.67a1.33 1.33 0 01-1.34-1.34V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconEdit({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M11.33 2a1.89 1.89 0 012.67 2.67L5.67 13 2 14l1-3.67L11.33 2z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSearch({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconChevronLeft({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M13 16l-6-6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconEye({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M1 10s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconFile({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M12 2H5a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7l-5-5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 2v5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// =====================================================
// AutomationsContent — main component
// =====================================================

export default function AutomationsContent({ toast }: { toast: ToastFn }) {
  const [tab, setTab] = useState<AutoTab>("contacts");

  return (
    <div>
      <Tabs
        tabs={[
          { value: "contacts", label: "Contactos" },
          { value: "campaigns", label: "Campañas" },
        ]}
        active={tab}
        onChange={(v) => setTab(v as AutoTab)}
      />

      <div className={styles.section}>
        {tab === "contacts" && <ContactsTab toast={toast} />}
        {tab === "campaigns" && <CampaignsTab toast={toast} />}
      </div>
    </div>
  );
}

// =====================================================
// Contacts Tab
// =====================================================

function ContactsTab({ toast }: { toast: ToastFn }) {
  const [selectedList, setSelectedList] = useState<EmailList | null>(null);

  if (selectedList) {
    return (
      <ContactDetailView
        list={selectedList}
        onBack={() => setSelectedList(null)}
        toast={toast}
      />
    );
  }

  return <EmailListsView onSelect={setSelectedList} toast={toast} />;
}

// ----- Email Lists View -----

function EmailListsView({
  onSelect,
  toast,
}: {
  onSelect: (list: EmailList) => void;
  toast: ToastFn;
}) {
  const [lists, setLists] = useState<EmailList[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchLists = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/email-lists");
      const json = await res.json();
      setLists(json.data || []);
    } catch {
      toast("Error al cargar listas", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("¿Eliminar esta lista y todos sus contactos?")) return;
    try {
      const res = await fetch(`/api/email-lists/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast("Lista eliminada", "success");
      fetchLists();
    } catch {
      toast("Error al eliminar lista", "error");
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner />
      </div>
    );
  }

  const listColumns: Column<EmailList>[] = [
    {
      key: "name",
      header: "Lista",
      render: (l) => (
        <div>
          <span style={{ fontWeight: 600 }}>{l.name}</span>
          {l.description && (
            <>
              <br />
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>{l.description}</span>
            </>
          )}
        </div>
      ),
    },
    {
      key: "contacts",
      header: "Contactos",
      width: "120px",
      render: (l) => (
        <Badge variant="info">
          {l.contact_count ?? 0} contacto{(l.contact_count ?? 0) !== 1 ? "s" : ""}
        </Badge>
      ),
    },
    {
      key: "categories",
      header: "Categorías",
      render: (l) =>
        l.categories && l.categories.length > 0 ? (
          <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {l.categories.map((cat) => (
              <Badge key={cat} variant="default">{cat}</Badge>
            ))}
          </span>
        ) : "—",
    },
    {
      key: "actions",
      header: "",
      width: "60px",
      render: (l) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => handleDelete(l.id, e)}
          title="Eliminar lista"
        >
          <IconTrash size={16} />
        </Button>
      ),
    },
  ];

  return (
    <>
      <div className={styles.toolbar}>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <IconPlus size={16} />
          Nueva Lista
        </Button>
      </div>

      <DataTable
        columns={listColumns}
        data={lists}
        keyExtractor={(l) => l.id}
        onRowClick={(l) => onSelect(l)}
        emptyTitle="Sin listas de contactos"
        emptyDescription="Crea tu primera lista para organizar contactos y enviar campañas de email."
        emptyAction={
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <IconPlus size={16} />
            Crear primera lista
          </Button>
        }
      />

      <CreateListModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false);
          fetchLists();
        }}
        toast={toast}
      />
    </>
  );
}

// ----- Create List Modal -----

function CreateListModal({
  open,
  onClose,
  onCreated,
  toast,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  toast: ToastFn;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/email-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: description || undefined }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Error");
      }
      toast("Lista creada", "success");
      setName("");
      setDescription("");
      onCreated();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al crear lista", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nueva Lista de Contactos" size="sm">
      <form onSubmit={handleSubmit} className={styles.form}>
        <Input
          label="Nombre *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Ej: Clientes VIP"
        />
        <Input
          label="Descripción"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descripción opcional"
        />
        <Button type="submit" isLoading={saving} style={{ width: "100%" }}>
          Crear lista
        </Button>
      </form>
    </Modal>
  );
}

// ----- Contact Detail View -----

function ContactDetailView({
  list,
  onBack,
  toast,
}: {
  list: EmailList;
  onBack: () => void;
  toast: ToastFn;
}) {
  const [contacts, setContacts] = useState<EmailContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showAddContact, setShowAddContact] = useState(false);
  const [showImportExcel, setShowImportExcel] = useState(false);
  const [editingContact, setEditingContact] = useState<EmailContact | null>(null);
  const [exporting, setExporting] = useState(false);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), per_page: "15" });
    if (search) params.set("search", search);
    if (categoryFilter !== "all") params.set("category", categoryFilter);

    try {
      const res = await fetch(`/api/email-lists/${list.id}/contacts?${params}`);
      const json = await res.json();
      setContacts(json.data || []);
      setTotalPages(json.total_pages || 1);
    } catch {
      toast("Error al cargar contactos", "error");
    } finally {
      setLoading(false);
    }
  }, [list.id, page, search, categoryFilter, toast]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/email-lists/${list.id}/export`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");

      const xlsxModule = await import("xlsx");
      const XLSX = xlsxModule.default ?? xlsxModule;
      const ws = XLSX.utils.json_to_sheet(
        (json.data as { name: string; email: string; phone: string | null; category: string | null }[]).map((c) => ({
          Nombre: c.name,
          Email: c.email,
          Teléfono: c.phone || "",
          Categoría: c.category || "",
        }))
      );
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Contactos");
      XLSX.writeFile(wb, `${json.list_name || "contactos"}.xlsx`);
      toast("Archivo exportado", "success");
    } catch {
      toast("Error al exportar", "error");
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteContact = async (contactId: number) => {
    if (!confirm("¿Eliminar este contacto?")) return;
    try {
      const res = await fetch(`/api/email-lists/${list.id}/contacts/${contactId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast("Contacto eliminado", "success");
      fetchContacts();
    } catch {
      toast("Error al eliminar contacto", "error");
    }
  };

  const categoryOptions = [
    { value: "all", label: "Todas las categorías" },
    ...(list.categories || []).map((c) => ({ value: c, label: c })),
  ];

  const columns: Column<EmailContact>[] = [
    { key: "name", header: "Nombre", render: (r) => r.name },
    { key: "email", header: "Email", render: (r) => r.email },
    { key: "phone", header: "Teléfono", render: (r) => r.phone || "—" },
    {
      key: "category",
      header: "Categoría",
      render: (r) =>
        r.category ? <Badge variant="default">{r.category}</Badge> : "—",
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <Button size="sm" variant="ghost" onClick={() => setEditingContact(r)} title="Editar">
            <IconEdit />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleDeleteContact(r.id)} title="Eliminar">
            <IconTrash />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <button className={styles.backButton} onClick={onBack}>
        <IconChevronLeft size={16} />
        Volver a listas
      </button>

      <div className={styles.detailHeader}>
        <h2 className={styles.detailTitle}>{list.name}</h2>
        {list.description && (
          <p className={styles.detailDesc}>{list.description}</p>
        )}
      </div>

      <div className={styles.contactToolbar}>
        <div className={styles.searchBar}>
          <div className={styles.searchInputWrap}>
            <IconSearch size={16} />
            <input
              className={styles.searchInput}
              placeholder="Buscar por nombre, email o teléfono..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className={styles.searchClear} onClick={() => setSearch("")} title="Limpiar">
                &times;
              </button>
            )}
          </div>
          <Select
            options={categoryOptions}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          />
        </div>
        <div className={styles.actionButtons}>
          <Button size="sm" onClick={() => setShowAddContact(true)}>
            <IconPlus size={16} />
            Agregar
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setShowImportExcel(true)}>
            <IconUpload size={16} />
            Importar
          </Button>
          <Button size="sm" variant="secondary" onClick={handleExport} isLoading={exporting}>
            <IconDownload size={16} />
            Exportar
          </Button>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>
          <Spinner />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={contacts}
          keyExtractor={(r) => r.id}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          emptyTitle="Sin contactos"
          emptyDescription="Esta lista no tiene contactos aún."
        />
      )}

      <AddContactModal
        open={showAddContact}
        onClose={() => setShowAddContact(false)}
        onCreated={() => {
          setShowAddContact(false);
          fetchContacts();
        }}
        listId={list.id}
        toast={toast}
      />

      <ImportExcelModal
        open={showImportExcel}
        onClose={() => setShowImportExcel(false)}
        onImported={() => {
          setShowImportExcel(false);
          fetchContacts();
        }}
        listId={list.id}
        toast={toast}
      />

      <EditContactModal
        open={!!editingContact}
        onClose={() => setEditingContact(null)}
        onUpdated={() => {
          setEditingContact(null);
          fetchContacts();
        }}
        contact={editingContact}
        listId={list.id}
        toast={toast}
      />
    </>
  );
}

// ----- Add Contact Modal -----

function AddContactModal({
  open,
  onClose,
  onCreated,
  listId,
  toast,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  listId: number;
  toast: ToastFn;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/email-lists/${listId}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone: phone || undefined,
          category: category || undefined,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Error");
      }
      toast("Contacto agregado", "success");
      setName("");
      setEmail("");
      setPhone("");
      setCategory("");
      onCreated();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al agregar contacto", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Agregar Contacto" size="sm">
      <form onSubmit={handleSubmit} className={styles.form}>
        <Input
          label="Nombre *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label="Email *"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label="Teléfono"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Input
          label="Categoría"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Ej: Premium, Básico"
        />
        <Button type="submit" isLoading={saving} style={{ width: "100%" }}>
          Agregar contacto
        </Button>
      </form>
    </Modal>
  );
}

// ----- Edit Contact Modal -----

function EditContactModal({
  open,
  onClose,
  onUpdated,
  contact,
  listId,
  toast,
}: {
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
  contact: EmailContact | null;
  listId: number;
  toast: ToastFn;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (contact) {
      setName(contact.name);
      setEmail(contact.email);
      setPhone(contact.phone || "");
      setCategory(contact.category || "");
    }
  }, [contact]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/email-lists/${listId}/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone: phone || null,
          category: category || null,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Error");
      }
      toast("Contacto actualizado", "success");
      onUpdated();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al actualizar", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Editar Contacto" size="sm">
      <form onSubmit={handleSubmit} className={styles.form}>
        <Input
          label="Nombre *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label="Email *"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label="Teléfono"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Input
          label="Categoría"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Ej: Premium, Básico"
        />
        <Button type="submit" isLoading={saving} style={{ width: "100%" }}>
          Guardar cambios
        </Button>
      </form>
    </Modal>
  );
}

// ----- Import Excel Modal -----

function ImportExcelModal({
  open,
  onClose,
  onImported,
  listId,
  toast,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  listId: number;
  toast: ToastFn;
}) {
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{ name: string; email: string; phone?: string; category?: string }[]>([]);
  const [fileName, setFileName] = useState("");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    try {
      const xlsxModule = await import("xlsx");
      const XLSX = xlsxModule.default ?? xlsxModule;
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });

      const parsed = rows.map((row) => {
        const keys = Object.keys(row);
        const get = (hints: string[]) =>
          keys.find((k) => hints.some((h) => k.toLowerCase().includes(h))) || "";
        return {
          name: (row[get(["nombre", "name"])] || "").trim(),
          email: (row[get(["email", "correo", "mail"])] || "").trim(),
          phone: (row[get(["tel", "phone", "celular", "móvil", "movil"])] || "").trim() || undefined,
          category: (row[get(["categ", "category", "tipo", "type"])] || "").trim() || undefined,
        };
      }).filter((c) => c.name && c.email);

      setPreview(parsed);
      if (parsed.length === 0) {
        toast("No se encontraron contactos válidos. Verifica que el archivo tenga columnas de nombre y email.", "error");
      }
    } catch {
      toast("Error al leer el archivo Excel", "error");
    }
  };

  const handleImport = async () => {
    if (preview.length === 0) return;
    setSaving(true);
    try {
      const batchSize = 500;
      let imported = 0;
      for (let i = 0; i < preview.length; i += batchSize) {
        const batch = preview.slice(i, i + batchSize);
        const res = await fetch(`/api/email-lists/${listId}/contacts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contacts: batch }),
        });
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error || "Error");
        }
        imported += batch.length;
      }
      toast(`${imported} contacto(s) importados`, "success");
      setPreview([]);
      setFileName("");
      onImported();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al importar", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setPreview([]);
    setFileName("");
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Importar desde Excel" size="md">
      <div className={styles.form}>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", margin: 0 }}>
          Sube un archivo <strong>.xlsx</strong> o <strong>.xls</strong> con columnas:{" "}
          <code style={{ background: "var(--gray-100)", padding: "2px 6px", borderRadius: 4, fontSize: "var(--text-xs)" }}>
            Nombre, Email, Teléfono, Categoría
          </code>
        </p>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          style={{
            padding: "var(--space-3)",
            border: "1px dashed var(--border-light)",
            borderRadius: "var(--radius-md)",
            cursor: "pointer",
            fontSize: "var(--text-sm)",
          }}
        />
        {fileName && preview.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
            <IconFile size={16} />
            <span><strong>{fileName}</strong> — {preview.length} contacto(s) detectados</span>
          </div>
        )}
        {preview.length > 0 && (
          <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", padding: "var(--space-2)" }}>
            <table style={{ width: "100%", fontSize: "var(--text-xs)", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 600, color: "var(--text-secondary)" }}>Nombre</th>
                  <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 600, color: "var(--text-secondary)" }}>Email</th>
                  <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 600, color: "var(--text-secondary)" }}>Teléfono</th>
                  <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 600, color: "var(--text-secondary)" }}>Categoría</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 10).map((c, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border-light)" }}>
                    <td style={{ padding: "4px 8px" }}>{c.name}</td>
                    <td style={{ padding: "4px 8px" }}>{c.email}</td>
                    <td style={{ padding: "4px 8px" }}>{c.phone || "—"}</td>
                    <td style={{ padding: "4px 8px" }}>{c.category || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 10 && (
              <p style={{ textAlign: "center", fontSize: "var(--text-xs)", color: "var(--text-secondary)", margin: "var(--space-2) 0 0" }}>
                ...y {preview.length - 10} más
              </p>
            )}
          </div>
        )}
        <Button
          onClick={handleImport}
          isLoading={saving}
          disabled={preview.length === 0}
          style={{ width: "100%" }}
        >
          <IconUpload size={16} />
          Importar {preview.length > 0 ? `${preview.length} contacto(s)` : "contactos"}
        </Button>
      </div>
    </Modal>
  );
}

// =====================================================
// Campaigns Tab
// =====================================================

function CampaignsTab({ toast }: { toast: ToastFn }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  if (creating) {
    return (
      <CampaignFormView
        campaignId={null}
        onBack={() => setCreating(false)}
        toast={toast}
      />
    );
  }

  if (selectedId !== null) {
    return (
      <CampaignFormView
        campaignId={selectedId}
        onBack={() => setSelectedId(null)}
        toast={toast}
      />
    );
  }

  return (
    <CampaignListView
      onSelect={(id) => setSelectedId(id)}
      onCreate={() => setCreating(true)}
      toast={toast}
    />
  );
}

// ----- Campaign List View -----

function CampaignListView({
  onSelect,
  onCreate,
  toast,
}: {
  onSelect: (id: number) => void;
  onCreate: () => void;
  toast: ToastFn;
}) {
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/email-campaigns");
      const json = await res.json();
      setCampaigns(json.data || []);
    } catch {
      toast("Error al cargar campañas", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("¿Eliminar esta campaña?")) return;
    try {
      const res = await fetch(`/api/email-campaigns/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast("Campaña eliminada", "success");
      fetchCampaigns();
    } catch {
      toast("Error al eliminar campaña", "error");
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner />
      </div>
    );
  }

  const campaignColumns: Column<EmailCampaign>[] = [
    {
      key: "name",
      header: "Campaña",
      render: (c) => (
        <div>
          <span style={{ fontWeight: 600 }}>{c.name}</span>
          <br />
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>{c.subject}</span>
        </div>
      ),
    },
    {
      key: "list",
      header: "Lista",
      render: (c) => c.list_name || "—",
    },
    {
      key: "status",
      header: "Estado",
      render: (c) => (
        <Badge variant={CAMPAIGN_STATUS_BADGE[c.status] || "default"}>
          {CAMPAIGN_STATUS_LABELS[c.status] || c.status}
        </Badge>
      ),
    },
    {
      key: "stats",
      header: "Envíos",
      render: (c) =>
        c.status !== "draft" ? `${c.total_sent}/${c.total_recipients}` : "—",
    },
    {
      key: "sent_at",
      header: "Fecha de envío",
      render: (c) => (c.sent_at ? formatDateTime(c.sent_at) : "—"),
    },
    {
      key: "actions",
      header: "",
      width: "60px",
      render: (c) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => handleDelete(c.id, e)}
          title="Eliminar"
        >
          <IconTrash size={16} />
        </Button>
      ),
    },
  ];

  return (
    <>
      <div className={styles.toolbar}>
        <Button size="sm" onClick={onCreate}>
          <IconPlus size={16} />
          Nueva Campaña
        </Button>
      </div>

      <DataTable
        columns={campaignColumns}
        data={campaigns}
        keyExtractor={(c) => c.id}
        onRowClick={(c) => onSelect(c.id)}
        emptyTitle="Sin campañas"
        emptyDescription="Crea tu primera campaña de email para enviar mensajes masivos a tus listas de contactos."
        emptyAction={
          <Button size="sm" onClick={onCreate}>
            <IconPlus size={16} />
            Crear primera campaña
          </Button>
        }
      />
    </>
  );
}

// ----- Campaign Form / Detail View -----

function CampaignFormView({
  campaignId,
  onBack,
  toast,
}: {
  campaignId: number | null;
  onBack: () => void;
  toast: ToastFn;
}) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [signatureHtml, setSignatureHtml] = useState(
    "<img src='https://res.cloudinary.com/denkwhhxx/image/upload/v1772017542/WhatsApp_Image_Feb_12_2026_uznruh.jpg' width='160' style='display:block; border:none;'>" +
    "<p style='margin:5px 0;'>📲 <strong>Teléfonos:</strong> <a href='tel:+593999914200' style='color:#0a66c2; text-decoration:none;'>0999914200</a> / <a href='tel:+593939284778' style='color:#0a66c2; text-decoration:none;'>0939284778</a></p>" +
    "<p style='margin:5px 0;'>✉️ <strong>Email:</strong> <a href='mailto:sistemas@acpe.com.ec' style='color:#0a66c2; text-decoration:none;'>sistemas@acpe.com.ec</a></p>" +
    "<p style='margin:5px 0;'>🌐 <strong>Web:</strong> <a href='https://www.acpe.com.ec' target='_blank' style='color:#0a66c2; text-decoration:none;'>www.acpe.com.ec</a></p>" +
    "<hr style='border:none; border-top:1px solid #ddd; margin:25px 0;'>" +
    "<table style='font-family: Arial, sans-serif; font-size:14px; color:#333;'><tr><td style='padding-bottom:10px;'></td></tr></table>"
  );
  const [listId, setListId] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [status, setStatus] = useState<string>("draft");

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [lists, setLists] = useState<EmailList[]>([]);
  const [selectedListCategories, setSelectedListCategories] = useState<string[]>([]);

  const [loading, setLoading] = useState(!!campaignId);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [showConfirmSend, setShowConfirmSend] = useState(false);
  const [exportingReport, setExportingReport] = useState(false);

  const fetchLists = useCallback(async () => {
    try {
      const res = await fetch("/api/email-lists");
      const json = await res.json();
      setLists(json.data || []);
    } catch {
      toast("Error al cargar listas de contactos", "error");
    }
  }, [toast]);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  useEffect(() => {
    if (!campaignId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/email-campaigns/${campaignId}`);
        const json = await res.json();
        const c = json.data as CampaignDetail;
        setCampaign(c);
        setName(c.name);
        setSubject(c.subject);
        setHtmlBody(c.html_body);
        setSignatureHtml(c.signature_html || "");
        setListId(c.list_id ? String(c.list_id) : "");
        setCategoryFilter(c.category_filter || "");
        setStatus(c.status);
      } catch {
        toast("Error al cargar campaña", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [campaignId, toast]);

  useEffect(() => {
    if (!listId) {
      setSelectedListCategories([]);
      return;
    }
    const found = lists.find((l) => l.id === Number(listId));
    setSelectedListCategories(found?.categories || []);
  }, [listId, lists]);

  const isSent = status !== "draft";

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        name,
        subject,
        html_body: htmlBody,
        signature_html: signatureHtml || null,
        list_id: listId ? Number(listId) : null,
        category_filter: categoryFilter || null,
      };

      let res: Response;
      if (campaignId) {
        res = await fetch(`/api/email-campaigns/${campaignId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/email-campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Error");
      }

      toast(campaignId ? "Campaña guardada" : "Campaña creada", "success");

      if (!campaignId) {
        onBack();
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al guardar", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    if (!campaignId) return;
    setSending(true);
    setShowConfirmSend(false);
    try {
      const res = await fetch(`/api/email-campaigns/${campaignId}/send`, {
        method: "POST",
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Error");
      }
      const json = await res.json();
      toast(
        `Campaña enviada: ${json.total_sent} de ${json.total_recipients} emails`,
        "success"
      );
      setStatus("sent");
      const detailRes = await fetch(`/api/email-campaigns/${campaignId}`);
      const detailJson = await detailRes.json();
      setCampaign(detailJson.data);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al enviar", "error");
    } finally {
      setSending(false);
    }
  };

  const handleExportReport = async () => {
    if (!campaignId) return;
    setExportingReport(true);
    try {
      const res = await fetch(`/api/email-campaigns/${campaignId}/report`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error");

      const xlsxModule = await import("xlsx");
      const XLSX = xlsxModule.default ?? xlsxModule;
      const camp = json.campaign;
      const sends = json.sends as {
        contact_name: string;
        contact_email: string;
        contact_phone: string | null;
        contact_category: string | null;
        status: string;
        provider_id: string | null;
        error_message: string | null;
        sent_at: string | null;
        delivered_at: string | null;
        opened_at: string | null;
        clicked_at: string | null;
        bounced_at: string | null;
        bounce_type: string | null;
        bounce_reason: string | null;
      }[];

      const statusLabel = (s: typeof sends[0]) => {
        switch (s.status) {
          case "delivered": return "Entregado";
          case "bounced": return s.bounce_type === "hard" ? "Rebote duro" : "Rebote suave";
          case "sent": return "Enviado";
          case "failed": return "Fallido";
          default: return "Pendiente";
        }
      };

      const delivered = sends.filter((s) => s.status === "delivered").length;
      const bounced = sends.filter((s) => s.status === "bounced").length;
      const failed = sends.filter((s) => s.status === "failed").length;
      const opened = sends.filter((s) => s.opened_at).length;
      const clicked = sends.filter((s) => s.clicked_at).length;

      // Summary sheet
      const summaryData = [
        { Campo: "Campaña", Valor: camp.name },
        { Campo: "Asunto", Valor: camp.subject },
        { Campo: "Lista", Valor: camp.list_name || "—" },
        { Campo: "Categoría filtrada", Valor: camp.category_filter || "Todas" },
        { Campo: "Fecha de envío", Valor: camp.sent_at ? formatDateTime(camp.sent_at) : "—" },
        { Campo: "Total destinatarios", Valor: String(camp.total_recipients) },
        { Campo: "Entregados", Valor: String(delivered) },
        { Campo: "Rebotados", Valor: String(bounced) },
        { Campo: "Fallidos (envío)", Valor: String(failed) },
        { Campo: "Abiertos", Valor: String(opened) },
        { Campo: "Clics", Valor: String(clicked) },
        { Campo: "Tasa de entrega", Valor: camp.total_recipients > 0 ? `${Math.round((delivered / camp.total_recipients) * 100)}%` : "—" },
        { Campo: "Tasa de apertura", Valor: delivered > 0 ? `${Math.round((opened / delivered) * 100)}%` : "—" },
      ];
      const summaryWs = XLSX.utils.json_to_sheet(summaryData);

      // Detail sheet
      const detailData = sends.map((s) => ({
        Nombre: s.contact_name,
        Email: s.contact_email,
        Teléfono: s.contact_phone || "",
        Categoría: s.contact_category || "",
        Estado: statusLabel(s),
        "Tipo de rebote": s.bounce_type === "hard" ? "Duro (permanente)" : s.bounce_type === "soft" ? "Suave (temporal)" : "",
        "Entregado": s.delivered_at ? formatDateTime(s.delivered_at) : "",
        "Abierto": s.opened_at ? formatDateTime(s.opened_at) : "",
        "Clic": s.clicked_at ? formatDateTime(s.clicked_at) : "",
        "Razón de rebote": s.bounce_reason || "",
        Error: s.error_message || "",
      }));
      const detailWs = XLSX.utils.json_to_sheet(detailData);

      // Bounced + Failed sheet
      const problemData = sends
        .filter((s) => s.status === "bounced" || s.status === "failed")
        .map((s) => ({
          Nombre: s.contact_name,
          Email: s.contact_email,
          Estado: statusLabel(s),
          "Tipo de rebote": s.bounce_type === "hard" ? "Duro (permanente)" : s.bounce_type === "soft" ? "Suave (temporal)" : "",
          Razón: s.bounce_reason || s.error_message || "Error desconocido",
        }));
      const problemWs = XLSX.utils.json_to_sheet(
        problemData.length > 0 ? problemData : [{ Nombre: "Sin problemas", Email: "", Estado: "", "Tipo de rebote": "", Razón: "" }]
      );

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, summaryWs, "Resumen");
      XLSX.utils.book_append_sheet(wb, detailWs, "Detalle Completo");
      XLSX.utils.book_append_sheet(wb, problemWs, "Rebotados y Fallidos");
      XLSX.writeFile(wb, `Reporte - ${camp.name}.xlsx`);
      toast("Reporte exportado", "success");
    } catch (err) {
      console.error("Report export error:", err);
      toast(err instanceof Error ? err.message : "Error al exportar reporte", "error");
    } finally {
      setExportingReport(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner />
      </div>
    );
  }

  if (isSent && campaign) {
    return (
      <>
        <button className={styles.backButton} onClick={onBack}>
          <IconChevronLeft size={16} />
          Volver a campañas
        </button>

        <div className={styles.detailHeader}>
          <h2 className={styles.detailTitle}>{campaign.name}</h2>
          <p className={styles.detailDesc}>Asunto: {campaign.subject}</p>
        </div>

        <div className={styles.metaRow}>
          <Badge variant={CAMPAIGN_STATUS_BADGE[campaign.status] || "default"}>
            {CAMPAIGN_STATUS_LABELS[campaign.status] || campaign.status}
          </Badge>
          {campaign.sent_at && (
            <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
              Enviado el {formatDateTime(campaign.sent_at)}
            </span>
          )}
          <Button size="sm" variant="secondary" onClick={handleExportReport} isLoading={exportingReport}>
            <IconDownload size={16} />
            Exportar reporte
          </Button>
        </div>

        <div className={styles.summaryGrid}>
          <div className={`${styles.summaryCard} ${styles.summaryCardInfo}`}>
            <h4>{campaign.total_recipients}</h4>
            <p>Destinatarios</p>
          </div>
          <div className={`${styles.summaryCard} ${styles.summaryCardSuccess}`}>
            <h4>{campaign.sends?.filter((s) => s.status === "delivered").length ?? campaign.total_sent}</h4>
            <p>Entregados</p>
          </div>
          <div className={`${styles.summaryCard} ${styles.summaryCardError}`}>
            <h4>{campaign.sends?.filter((s) => s.status === "bounced" || s.status === "failed").length ?? campaign.total_failed}</h4>
            <p>Fallidos / Rebotados</p>
          </div>
          <div className={`${styles.summaryCard} ${styles.summaryCardWarning}`}>
            <h4>{campaign.sends?.filter((s) => s.opened_at).length ?? 0}</h4>
            <p>Abiertos</p>
          </div>
          <div className={`${styles.summaryCard}`}>
            <h4>{campaign.sends?.filter((s) => s.clicked_at).length ?? 0}</h4>
            <p>Clics</p>
          </div>
        </div>

        {campaign.sends && campaign.sends.length > 0 && (
          <DataTable
            columns={[
              { key: "contact", header: "Contacto", render: (r: EmailSend) => r.contact_name || "—" },
              { key: "email", header: "Email", render: (r: EmailSend) => r.contact_email || "—" },
              {
                key: "status",
                header: "Estado",
                render: (r: EmailSend) => {
                  const variant =
                    r.status === "delivered" ? "success"
                    : r.status === "bounced" ? "error"
                    : r.status === "sent" ? "info"
                    : r.status === "failed" ? "error"
                    : "default";
                  const label =
                    r.status === "delivered" ? "Entregado"
                    : r.status === "bounced" ? (r.bounce_type === "hard" ? "Rebote duro" : "Rebote suave")
                    : r.status === "sent" ? "Enviado"
                    : r.status === "failed" ? "Fallido"
                    : "Pendiente";
                  return <Badge variant={variant}>{label}</Badge>;
                },
              },
              {
                key: "tracking",
                header: "Seguimiento",
                render: (r: EmailSend) => (
                  <span style={{ display: "flex", gap: 8, fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                    {r.opened_at && <span title={`Abierto: ${formatDateTime(r.opened_at)}`}>📬 Abierto</span>}
                    {r.clicked_at && <span title={`Clic: ${formatDateTime(r.clicked_at)}`}>🔗 Clic</span>}
                    {!r.opened_at && !r.clicked_at && "—"}
                  </span>
                ),
              },
              {
                key: "error",
                header: "Detalle",
                render: (r: EmailSend) => {
                  if (r.bounce_reason) return <span style={{ color: "var(--error)", fontSize: "var(--text-xs)" }}>{r.bounce_reason}</span>;
                  if (r.error_message) return <span style={{ color: "var(--error)", fontSize: "var(--text-xs)" }}>{r.error_message}</span>;
                  return "—";
                },
              },
            ]}
            data={campaign.sends}
            keyExtractor={(r: EmailSend) => r.id}
            emptyTitle="Sin envíos"
            emptyDescription="No se registraron envíos para esta campaña."
          />
        )}
      </>
    );
  }

  // Editable form (draft)
  const listOptions = [
    { value: "", label: "Seleccionar lista..." },
    ...lists.map((l) => ({ value: String(l.id), label: `${l.name} (${l.contact_count ?? 0})` })),
  ];

  const categoryOptions = [
    { value: "", label: "Todas las categorías" },
    ...selectedListCategories.map((c) => ({ value: c, label: c })),
  ];

  return (
    <>
      <button className={styles.backButton} onClick={onBack}>
        <IconChevronLeft size={16} />
        Volver a campañas
      </button>

      <div className={styles.detailHeader}>
        <h2 className={styles.detailTitle}>
          {campaignId ? "Editar Campaña" : "Nueva Campaña"}
        </h2>
      </div>

      <div className={styles.campaignLayout}>
        <div className={styles.campaignForm}>
          <Input
            label="Nombre de campaña *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Newsletter marzo 2026"
            required
          />
          <Input
            label="Asunto del email *"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Ej: Novedades de esta semana"
            required
          />

          <div className={styles.row}>
            <Select
              label="Lista de contactos"
              options={listOptions}
              value={listId}
              onChange={(e) => {
                setListId(e.target.value);
                setCategoryFilter("");
              }}
            />
            <Select
              label="Filtrar por categoría"
              options={categoryOptions}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            />
          </div>

          <RichTextEditor
            label="Cuerpo del email *"
            value={htmlBody}
            onChange={setHtmlBody}
            placeholder="Escribe el contenido del email..."
          />

          <RichTextEditor
            label="Firma (opcional)"
            value={signatureHtml}
            onChange={setSignatureHtml}
            placeholder="Saludos, Equipo Corazones Cruzados"
          />

          <div className={styles.formActions}>
            <Button
              onClick={handleSave}
              isLoading={saving}
              variant="secondary"
            >
              Guardar borrador
            </Button>
            {campaignId && (
              <Button
                onClick={() => setShowConfirmSend(true)}
                isLoading={sending}
                variant="primary"
                disabled={!listId || !subject || !htmlBody}
              >
                <IconSend size={16} />
                Enviar campaña
              </Button>
            )}
          </div>
        </div>

        {/* Email Preview — right side */}
        <div className={styles.previewSidebar}>
          <div className={styles.previewSticky}>
            <h4 className={styles.previewTitle}>
              <IconEye size={16} />
              Vista previa
            </h4>
            {(htmlBody || signatureHtml) ? (
              <div className={styles.previewEnvelope}>
                <div className={styles.previewHeader}>
                  <div className={styles.previewHeaderRow}>
                    <span className={styles.previewLabel}>De:</span>
                    <span>sistemas@acpe.com.ec</span>
                  </div>
                  <div className={styles.previewHeaderRow}>
                    <span className={styles.previewLabel}>Para:</span>
                    <span style={{ color: "var(--text-tertiary)" }}>destinatario@email.com</span>
                  </div>
                  <div className={styles.previewHeaderRow}>
                    <span className={styles.previewLabel}>Asunto:</span>
                    <span style={{ fontWeight: 500 }}>{subject || "(sin asunto)"}</span>
                  </div>
                </div>
                <div
                  className={styles.previewBody}
                  dangerouslySetInnerHTML={{ __html: htmlBody }}
                />
                {signatureHtml && (
                  <div
                    className={styles.previewSignature}
                    dangerouslySetInnerHTML={{ __html: signatureHtml }}
                  />
                )}
              </div>
            ) : (
              <div className={styles.previewEmpty}>
                <IconMail size={32} />
                <p>Escribe el contenido del email para ver la vista previa aquí.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={showConfirmSend}
        onClose={() => setShowConfirmSend(false)}
        title="Confirmar envío"
        size="sm"
      >
        <div className={styles.form}>
          <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
            ¿Estás seguro de que deseas enviar esta campaña? Esta acción no se puede deshacer.
            Los emails se enviarán a todos los contactos de la lista seleccionada
            {categoryFilter ? ` con categoría "${categoryFilter}"` : ""}.
          </p>
          <div className={styles.formActions}>
            <Button variant="secondary" onClick={() => setShowConfirmSend(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSend} isLoading={sending}>
              <IconSend size={16} />
              Confirmar envío
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

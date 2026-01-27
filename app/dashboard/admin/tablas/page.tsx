"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import styles from "@/app/styles/Admin.module.css";

interface Column {
  name: string;
  type: string;
  editable: boolean;
  required?: boolean;
  label: string;
  foreignKey?: string;
}

interface TableConfig {
  name: string;
  primaryKey: string;
  columns: Column[];
  orderBy: string;
}

interface TableInfo {
  id: string;
  name: string;
  columns: Column[];
}

interface LookupItem {
  id: number;
  nombre: string;
}

type Lookups = Record<string, LookupItem[]>;

// Icons
const DatabaseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
  </svg>
);

const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" x2="12" y1="5" y2="19" />
    <line x1="5" x2="19" y1="12" y2="12" />
  </svg>
);

const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 21h5v-5" />
  </svg>
);

type ModalMode = "create" | "edit" | "delete" | null;

export default function TablasPage() {
  const router = useRouter();
  const { profile, isAuthenticated, loading: authLoading } = useAuth();

  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [tableConfig, setTableConfig] = useState<TableConfig | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [lookups, setLookups] = useState<Lookups>({});
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [search, setSearch] = useState("");

  // Modal states
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedRow, setSelectedRow] = useState<Record<string, unknown> | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Check if user is admin
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || profile?.rol !== "admin")) {
      router.push("/dashboard");
    }
  }, [authLoading, isAuthenticated, profile, router]);

  // Fetch available tables
  useEffect(() => {
    const fetchTables = async () => {
      try {
        const response = await fetch("/api/admin/tables");
        if (response.ok) {
          const data = await response.json();
          setTables(data.tables || []);
        }
      } catch (error) {
        console.error("Error fetching tables:", error);
      }
      setLoading(false);
    };

    if (isAuthenticated && profile?.rol === "admin") {
      fetchTables();
    }
  }, [isAuthenticated, profile]);

  // Fetch table data when selected
  const fetchTableData = async (tableName: string, searchTerm: string = "") => {
    if (!tableName) return;

    setLoadingData(true);
    try {
      const params = new URLSearchParams({ table: tableName });
      if (searchTerm) params.append("search", searchTerm);

      const response = await fetch(`/api/admin/tables?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTableConfig(data.config);
        setRows(data.rows || []);
        setLookups(data.lookups || {});
      }
    } catch (error) {
      console.error("Error fetching table data:", error);
    }
    setLoadingData(false);
  };

  useEffect(() => {
    if (selectedTable) {
      fetchTableData(selectedTable, search);
    }
  }, [selectedTable]);

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectedTable) {
        fetchTableData(selectedTable, search);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const openModal = (mode: ModalMode, row?: Record<string, unknown>) => {
    setModalMode(mode);
    setMessage(null);

    if (mode === "edit" && row) {
      setSelectedRow(row);
      setFormData({ ...row });
    } else if (mode === "create") {
      setSelectedRow(null);
      // Initialize with default values
      const defaultData: Record<string, unknown> = {};
      tableConfig?.columns.forEach((col) => {
        if (col.type === "boolean") defaultData[col.name] = false;
        else if (col.type === "number") defaultData[col.name] = 0;
        else if (col.type === "array") defaultData[col.name] = [];
        else defaultData[col.name] = "";
      });
      setFormData(defaultData);
    } else if (mode === "delete" && row) {
      setSelectedRow(row);
    }
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedRow(null);
    setFormData({});
    setMessage(null);
  };

  const handleSave = async () => {
    if (!tableConfig) return;

    setSaving(true);
    setMessage(null);

    try {
      const url = "/api/admin/tables";
      const method = modalMode === "create" ? "POST" : "PATCH";

      const body: Record<string, unknown> = {
        table: selectedTable,
        data: formData,
      };

      if (modalMode === "edit" && selectedRow) {
        body.id = selectedRow[tableConfig.primaryKey];
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({
          type: "success",
          text: modalMode === "create" ? "Registro creado" : "Registro actualizado",
        });
        await fetchTableData(selectedTable, search);
        setTimeout(() => closeModal(), 1000);
      } else {
        setMessage({ type: "error", text: data.error || "Error al guardar" });
      }
    } catch (error) {
      console.error("Error saving:", error);
      setMessage({ type: "error", text: "Error al guardar" });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!tableConfig || !selectedRow) return;

    setSaving(true);
    setMessage(null);

    try {
      const id = selectedRow[tableConfig.primaryKey];
      const response = await fetch(
        `/api/admin/tables?table=${selectedTable}&id=${id}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: "success", text: "Registro eliminado" });
        await fetchTableData(selectedTable, search);
        setTimeout(() => closeModal(), 1000);
      } else {
        setMessage({ type: "error", text: data.error || "Error al eliminar" });
      }
    } catch (error) {
      console.error("Error deleting:", error);
      setMessage({ type: "error", text: "Error al eliminar" });
    }
    setSaving(false);
  };

  const renderCellValue = (value: unknown, column: Column) => {
    if (value === null || value === undefined) return "—";

    if (column.type === "boolean") {
      return value ? "✓" : "✗";
    }

    if (column.type === "array") {
      const arr = value as string[];
      return arr.length > 0 ? arr.join(", ") : "—";
    }

    // Handle foreign keys - show name instead of ID
    if (column.foreignKey && lookups[column.foreignKey]) {
      const lookupItems = lookups[column.foreignKey];
      const item = lookupItems.find((i) => i.id === value);
      return item ? item.nombre : `ID: ${value}`;
    }

    return String(value);
  };

  const renderFormField = (column: Column) => {
    if (!column.editable) return null;

    const value = formData[column.name];

    if (column.type === "boolean") {
      return (
        <label className={styles.formCheckbox}>
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => setFormData({ ...formData, [column.name]: e.target.checked })}
          />
          {column.label}
        </label>
      );
    }

    if (column.type === "array") {
      const arrValue = Array.isArray(value) ? value.join(", ") : "";
      return (
        <input
          type="text"
          className={styles.formInput}
          value={arrValue}
          onChange={(e) =>
            setFormData({
              ...formData,
              [column.name]: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
            })
          }
          placeholder="Separar con comas"
        />
      );
    }

    // Handle foreign keys - show dropdown
    if (column.foreignKey && lookups[column.foreignKey]) {
      const lookupItems = lookups[column.foreignKey];
      return (
        <select
          className={styles.formSelect}
          value={(value as number) || ""}
          onChange={(e) =>
            setFormData({ ...formData, [column.name]: e.target.value ? Number(e.target.value) : null })
          }
        >
          <option value="">— Seleccionar —</option>
          {lookupItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.nombre}
            </option>
          ))}
        </select>
      );
    }

    if (column.type === "number") {
      return (
        <input
          type="number"
          className={styles.formInput}
          value={value as number || ""}
          onChange={(e) =>
            setFormData({ ...formData, [column.name]: e.target.value ? Number(e.target.value) : null })
          }
        />
      );
    }

    // Text input
    return (
      <input
        type="text"
        className={styles.formInput}
        value={(value as string) || ""}
        onChange={(e) => setFormData({ ...formData, [column.name]: e.target.value })}
        required={column.required}
      />
    );
  };

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className={styles.page}>
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <p>Cargando...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!isAuthenticated || profile?.rol !== "admin") {
    return null;
  }

  return (
    <DashboardLayout>
      <div className={styles.page}>
        {/* Header */}
        <header className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Gestión de Tablas</h1>
            <p className={styles.pageSubtitle}>Administra las tablas del sistema</p>
          </div>
        </header>

        {/* Table Selector */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              <DatabaseIcon /> Seleccionar Tabla
            </h2>
          </div>
          <div className={styles.sectionBody}>
            <div className={styles.tableSelector}>
              {tables.map((table) => (
                <button
                  key={table.id}
                  className={`${styles.tableSelectorBtn} ${selectedTable === table.id ? styles.tableSelectorBtnActive : ""}`}
                  onClick={() => {
                    setSelectedTable(table.id);
                    setSearch("");
                  }}
                >
                  {table.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Data Section */}
        {selectedTable && tableConfig && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>{tableConfig.name}</h2>
              <div className={styles.sectionActions}>
                <button
                  className={styles.iconButton}
                  onClick={() => fetchTableData(selectedTable, search)}
                  title="Refrescar"
                >
                  <RefreshIcon />
                </button>
                <button
                  className={styles.primaryButton}
                  onClick={() => openModal("create")}
                >
                  <PlusIcon /> Nuevo
                </button>
              </div>
            </div>
            <div className={styles.sectionBody}>
              {/* Search */}
              <div className={styles.filtersBar}>
                <div className={styles.searchWrapper}>
                  <SearchIcon />
                  <input
                    type="text"
                    placeholder="Buscar..."
                    className={styles.searchInput}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              {/* Data Table */}
              {loadingData ? (
                <div className={styles.loadingState}>
                  <div className={styles.spinner} />
                  <p>Cargando datos...</p>
                </div>
              ) : rows.length > 0 ? (
                <div className={styles.tableWrapper}>
                  <table className={styles.usersTable}>
                    <thead>
                      <tr>
                        {tableConfig.columns.map((col) => (
                          <th key={col.name}>{col.label}</th>
                        ))}
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, idx) => (
                        <tr key={row[tableConfig.primaryKey] as string || idx}>
                          {tableConfig.columns.map((col) => (
                            <td key={col.name}>
                              <span className={col.type === "boolean" ? styles.booleanCell : ""}>
                                {renderCellValue(row[col.name], col)}
                              </span>
                            </td>
                          ))}
                          <td>
                            <div className={styles.actionButtons}>
                              <button
                                className={styles.iconButton}
                                onClick={() => openModal("edit", row)}
                                title="Editar"
                              >
                                <EditIcon />
                              </button>
                              <button
                                className={`${styles.iconButton} ${styles.iconButtonDanger}`}
                                onClick={() => openModal("delete", row)}
                                title="Eliminar"
                              >
                                <TrashIcon />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <DatabaseIcon />
                  <p>No hay registros</p>
                  <button className={styles.primaryButton} onClick={() => openModal("create")}>
                    <PlusIcon /> Crear primer registro
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal */}
        {modalMode && (
          <div className={styles.modalOverlay} onClick={closeModal}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                  {modalMode === "create" && "Nuevo Registro"}
                  {modalMode === "edit" && "Editar Registro"}
                  {modalMode === "delete" && "Eliminar Registro"}
                </h3>
                <button className={styles.iconButton} onClick={closeModal}>
                  <CloseIcon />
                </button>
              </div>

              {message && (
                <div className={`${styles.modalMessage} ${styles[message.type]}`}>
                  {message.text}
                </div>
              )}

              <div className={styles.modalBody}>
                {/* Create/Edit Form */}
                {(modalMode === "create" || modalMode === "edit") && tableConfig && (
                  <div className={styles.modalForm}>
                    {tableConfig.columns
                      .filter((col) => col.editable)
                      .map((col) => (
                        <div key={col.name} className={styles.formGroup}>
                          {col.type !== "boolean" && (
                            <label className={styles.formLabel}>
                              {col.label}
                              {col.required && <span style={{ color: "#ef4444" }}> *</span>}
                            </label>
                          )}
                          {renderFormField(col)}
                        </div>
                      ))}
                  </div>
                )}

                {/* Delete Confirmation */}
                {modalMode === "delete" && selectedRow && tableConfig && (
                  <div className={styles.modalForm}>
                    <div
                      className={styles.convertNotice}
                      style={{ background: "rgba(239, 68, 68, 0.1)", borderColor: "rgba(239, 68, 68, 0.3)" }}
                    >
                      <p style={{ color: "#ef4444" }}>¿Eliminar este registro?</p>
                      <ul>
                        <li>Esta acción no se puede deshacer</li>
                        <li>
                          ID: <strong>{String(selectedRow[tableConfig.primaryKey])}</strong>
                        </li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.modalFooter}>
                <button className={styles.secondaryButton} onClick={closeModal} disabled={saving}>
                  Cancelar
                </button>
                {(modalMode === "create" || modalMode === "edit") && (
                  <button className={styles.primaryButton} onClick={handleSave} disabled={saving}>
                    {saving ? "Guardando..." : "Guardar"}
                  </button>
                )}
                {modalMode === "delete" && (
                  <button className={styles.dangerButton} onClick={handleDelete} disabled={saving}>
                    {saving ? "Eliminando..." : "Eliminar"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import Badge from "@/components/ui/Badge";
import Tabs from "@/components/ui/Tabs";
import type { PortfolioItem } from "@/lib/types";
import styles from "./page.module.css";

type ItemType = "project" | "product";

export default function PortfolioEditorPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<PortfolioItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<ItemType>("project");

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [projectUrl, setProjectUrl] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [cost, setCost] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const memberId = user?.member_id;

  const loadItems = useCallback(async () => {
    if (!memberId) return;
    try {
      const res = await fetch(`/api/members/${memberId}/portfolio`);
      const json = await res.json();
      setItems(json.data || []);
    } catch {
      toast("Error al cargar portafolio", "error");
    } finally {
      setLoading(false);
    }
  }, [memberId, toast]);

  useEffect(() => {
    if (!authLoading && memberId) loadItems();
    else if (!authLoading) setLoading(false);
  }, [authLoading, memberId, loadItems]);

  const filteredItems = items.filter((i) => (i.item_type || "project") === tab);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setImageUrl("");
    setProjectUrl("");
    setTagsText("");
    setCost("");
    setEditItem(null);
  };

  const openCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (item: PortfolioItem) => {
    setEditItem(item);
    setTitle(item.title);
    setDescription(item.description || "");
    setImageUrl(item.image_url || "");
    setProjectUrl(item.project_url || "");
    setTagsText((item.tags || []).join(", "));
    setCost(item.cost != null ? String(item.cost) : "");
    setShowModal(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Solo se permiten archivos de imagen", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast("La imagen debe ser menor a 5 MB", "error");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "portfolio");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error();
      const { url } = await res.json();
      setImageUrl(url);
      toast("Imagen subida", "success");
    } catch {
      toast("Error al subir la imagen", "error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId || !title.trim()) return;
    setSaving(true);

    const tags = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      title,
      description: description || null,
      image_url: imageUrl || null,
      project_url: projectUrl || null,
      tags,
      cost: cost ? parseFloat(cost) : null,
      item_type: tab,
    };

    try {
      if (editItem) {
        const res = await fetch(`/api/members/${memberId}/portfolio`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item_id: editItem.id, ...payload }),
        });
        if (!res.ok) throw new Error();
        toast(tab === "project" ? "Proyecto actualizado" : "Producto actualizado", "success");
      } else {
        const res = await fetch(`/api/members/${memberId}/portfolio`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        toast(tab === "project" ? "Proyecto agregado" : "Producto agregado", "success");
      }
      setShowModal(false);
      resetForm();
      loadItems();
    } catch {
      toast("Error al guardar", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    const label = tab === "project" ? "proyecto" : "producto";
    if (!confirm(`¿Eliminar este ${label}?`)) return;
    try {
      const res = await fetch(`/api/members/${memberId}/portfolio`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: id }),
      });
      if (!res.ok) throw new Error();
      toast("Eliminado", "success");
      loadItems();
    } catch {
      toast("Error al eliminar", "error");
    }
  };

  if (authLoading || loading) {
    return (
      <div className={styles.center}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (!memberId) {
    return (
      <div>
        <PageHeader title="Mi Portafolio" description="Solo disponible para miembros." />
        <Card padding="lg">
          <p>Esta sección solo está disponible para miembros del equipo.</p>
        </Card>
      </div>
    );
  }

  const isProject = tab === "project";
  const typeLabel = isProject ? "proyecto" : "producto";
  const typeLabelPlural = isProject ? "proyectos" : "productos";

  return (
    <div>
      <PageHeader
        title="Mi Portafolio"
        description="Administra tus proyectos y productos."
        breadcrumbs={[
          { label: "Configuración", href: "/dashboard/settings" },
          { label: "Portafolio" },
        ]}
        action={
          <Button onClick={openCreate} size="sm">
            + Nuevo {typeLabel}
          </Button>
        }
      />

      <Tabs
        tabs={[
          { value: "project", label: "Proyectos" },
          { value: "product", label: "Productos" },
        ]}
        active={tab}
        onChange={(v) => setTab(v as ItemType)}
      />

      <div style={{ marginTop: "var(--space-5)" }}>
        {filteredItems.length === 0 ? (
          <EmptyState
            title={`Sin ${typeLabelPlural}`}
            description={isProject
              ? "Agrega proyectos a tu portafolio para mostrar tu trabajo."
              : "Agrega productos para venderlos en el marketplace."
            }
            actionLabel={`Agregar ${typeLabel}`}
            onAction={openCreate}
          />
        ) : (
          <div className={styles.grid}>
            {filteredItems.map((item) => (
              <Card key={item.id} padding="none" hover>
                {item.image_url && (
                  <div className={styles.imageWrap}>
                    <img src={item.image_url} alt={item.title} className={styles.image} />
                  </div>
                )}
                <div className={styles.cardBody}>
                  <h3 className={styles.cardTitle}>{item.title}</h3>
                  {item.description && (
                    <p className={styles.cardDesc}>{item.description}</p>
                  )}
                  {item.cost != null && (
                    <span className={styles.cardPrice}>
                      ${Number(item.cost).toFixed(2)}
                      {!isProject && " c/u"}
                    </span>
                  )}
                  {item.tags && item.tags.length > 0 && (
                    <div className={styles.tags}>
                      {item.tags.map((tag) => (
                        <Badge key={tag} variant="default">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className={styles.cardActions}>
                    <Button variant="secondary" size="sm" onClick={() => openEdit(item)}>
                      Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                      Eliminar
                    </Button>
                    {item.project_url && (
                      <a
                        href={item.project_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.linkBtn}
                      >
                        Ver proyecto
                      </a>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editItem ? `Editar ${typeLabel}` : `Nuevo ${typeLabel}`}
      >
        <form onSubmit={handleSave} className={styles.form}>
          <Input
            label="Título"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <textarea
            className={styles.textarea}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={`Descripción del ${typeLabel}...`}
          />
          <div>
            <label className={styles.fieldLabel}>Imagen</label>
            <button
              type="button"
              className={styles.imageUploader}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {imageUrl ? (
                <img src={imageUrl} alt="Preview" className={styles.imagePreview} />
              ) : (
                <span className={styles.imageUploaderPlaceholder}>
                  {uploading ? (
                    <Spinner size="sm" />
                  ) : (
                    <>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      <span>Click para subir imagen</span>
                    </>
                  )}
                </span>
              )}
              {uploading && imageUrl && (
                <span className={styles.imageUploadingOverlay}>
                  <Spinner size="sm" />
                </span>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={{ display: "none" }}
            />
            {imageUrl && (
              <button
                type="button"
                className={styles.removeImage}
                onClick={() => setImageUrl("")}
              >
                Quitar imagen
              </button>
            )}
          </div>
          {isProject && (
            <Input
              label="URL del proyecto"
              value={projectUrl}
              onChange={(e) => setProjectUrl(e.target.value)}
              placeholder="https://..."
            />
          )}
          <Input
            label="Precio (USD)"
            type="number"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="0.00"
            hint={isProject
              ? "Precio único del proyecto — se compra una sola vez"
              : "Precio por unidad — el cliente puede comprar varias unidades"
            }
          />
          <Input
            label="Etiquetas"
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="React, Diseño, Mobile..."
            hint="Separadas por coma"
          />
          <div className={styles.modalActions}>
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={saving}>
              {editItem ? "Guardar" : "Crear"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

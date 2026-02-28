"use client";

import { useState, useEffect, useCallback } from "react";
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
import type { PortfolioItem } from "@/lib/types";
import styles from "./page.module.css";

export default function PortfolioEditorPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<PortfolioItem | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [projectUrl, setProjectUrl] = useState("");
  const [tagsText, setTagsText] = useState("");

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

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setImageUrl("");
    setProjectUrl("");
    setTagsText("");
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
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId || !title.trim()) return;
    setSaving(true);

    const tags = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      if (editItem) {
        const res = await fetch(`/api/members/${memberId}/portfolio`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            item_id: editItem.id,
            title,
            description: description || null,
            image_url: imageUrl || null,
            project_url: projectUrl || null,
            tags,
          }),
        });
        if (!res.ok) throw new Error();
        toast("Proyecto actualizado", "success");
      } else {
        const res = await fetch(`/api/members/${memberId}/portfolio`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description: description || null,
            image_url: imageUrl || null,
            project_url: projectUrl || null,
            tags,
          }),
        });
        if (!res.ok) throw new Error();
        toast("Proyecto agregado", "success");
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
    if (!confirm("¿Eliminar este proyecto?")) return;
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

  return (
    <div>
      <PageHeader
        title="Mi Portafolio"
        description="Administra tus proyectos destacados."
        breadcrumbs={[
          { label: "Configuración", href: "/dashboard/settings" },
          { label: "Portafolio" },
        ]}
        action={
          <Button onClick={openCreate} size="sm">
            + Nuevo proyecto
          </Button>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          title="Sin proyectos"
          description="Agrega proyectos a tu portafolio para mostrar tu trabajo."
          actionLabel="Agregar proyecto"
          onAction={openCreate}
        />
      ) : (
        <div className={styles.grid}>
          {items.map((item) => (
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

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editItem ? "Editar proyecto" : "Nuevo proyecto"}
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
            placeholder="Descripción del proyecto..."
          />
          <Input
            label="URL de imagen"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://..."
          />
          <Input
            label="URL del proyecto"
            value={projectUrl}
            onChange={(e) => setProjectUrl(e.target.value)}
            placeholder="https://..."
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

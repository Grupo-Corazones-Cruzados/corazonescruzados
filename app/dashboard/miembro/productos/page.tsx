"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import { useAuth } from "@/lib/AuthProvider";
import { useMemberProducts, Product } from "@/lib/hooks/useMarketplace";
import ticketStyles from "@/app/styles/Tickets.module.css";
import styles from "@/app/styles/Mercado.module.css";

// Icons
const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const ImageIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  </svg>
);

const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const PackageIcon = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16.5 9.4 7.55 4.24" />
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.29 7 12 12 20.71 7" />
    <line x1="12" x2="12" y1="22" y2="12" />
  </svg>
);

const formatCurrency = (amount: number | null): string => {
  if (amount === null || amount === undefined) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
};

interface ProductFormData {
  nombre: string;
  descripcion: string;
  costo: string;
  categoria: string;
  herramientas: string;
  link_detalles: string;
  imagenes: string[];
  unico: boolean;
}

const emptyFormData: ProductFormData = {
  nombre: "",
  descripcion: "",
  costo: "",
  categoria: "",
  herramientas: "",
  link_detalles: "",
  imagenes: [],
  unico: false,
};

function ProductForm({
  initialData,
  onSubmit,
  onCancel,
  uploading,
  onUploadImage,
  onRemoveImage,
}: {
  initialData?: Product;
  onSubmit: (data: ProductFormData) => Promise<void>;
  onCancel: () => void;
  uploading: boolean;
  onUploadImage: (file: File) => Promise<string | null>;
  onRemoveImage: (url: string) => void;
}) {
  const [formData, setFormData] = useState<ProductFormData>(
    initialData
      ? {
          nombre: initialData.nombre || "",
          descripcion: initialData.descripcion || "",
          costo: initialData.costo?.toString() || "",
          categoria: initialData.categoria || "",
          herramientas: Array.isArray(initialData.herramientas)
            ? initialData.herramientas.join(", ")
            : "",
          link_detalles: initialData.link_detalles || "",
          imagenes: initialData.imagenes || [],
          unico: initialData.unico || false,
        }
      : emptyFormData
  );
  const [submitting, setSubmitting] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      if (formData.imagenes.length >= 8) {
        alert("Máximo 8 imágenes por producto");
        break;
      }
      const url = await onUploadImage(file);
      if (url) {
        setFormData((prev) => ({
          ...prev,
          imagenes: [...prev.imagenes, url],
        }));
      }
    }
    e.target.value = "";
  };

  const handleRemoveImage = (url: string) => {
    setFormData((prev) => ({
      ...prev,
      imagenes: prev.imagenes.filter((u) => u !== url),
    }));
    onRemoveImage(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit(formData);
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className={styles.productForm}>
      <div className={styles.formGrid}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Nombre *</label>
          <input
            type="text"
            className={styles.formInput}
            value={formData.nombre}
            onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
            placeholder="Nombre del producto"
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Precio (USD)</label>
          <input
            type="number"
            className={styles.formInput}
            value={formData.costo}
            onChange={(e) => setFormData({ ...formData, costo: e.target.value })}
            placeholder="0.00"
            min="0"
            step="0.01"
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Categoría</label>
          <input
            type="text"
            className={styles.formInput}
            value={formData.categoria}
            onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
            placeholder="Ej: Apps, Chatbots, Diseño..."
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Herramientas (separadas por coma)</label>
          <input
            type="text"
            className={styles.formInput}
            value={formData.herramientas}
            onChange={(e) => setFormData({ ...formData, herramientas: e.target.value })}
            placeholder="React, Node.js, Python..."
          />
        </div>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>Descripción</label>
        <textarea
          className={styles.formTextarea}
          value={formData.descripcion}
          onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
          placeholder="Describe tu producto o servicio..."
          rows={4}
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>Link de detalles (opcional)</label>
        <input
          type="url"
          className={styles.formInput}
          value={formData.link_detalles}
          onChange={(e) => setFormData({ ...formData, link_detalles: e.target.value })}
          placeholder="https://..."
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formCheckboxLabel}>
          <input
            type="checkbox"
            className={styles.formCheckbox}
            checked={formData.unico}
            onChange={(e) => setFormData({ ...formData, unico: e.target.checked })}
          />
          Producto unico (solo se puede comprar 1 unidad)
        </label>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>Imágenes ({formData.imagenes.length}/8)</label>
        <div className={styles.imageUploadArea}>
          {formData.imagenes.map((url, idx) => (
            <div key={idx} className={styles.imagePreview}>
              <img src={url} alt={`Imagen ${idx + 1}`} />
              <button
                type="button"
                className={styles.removeImageBtn}
                onClick={() => handleRemoveImage(url)}
              >
                <XIcon />
              </button>
            </div>
          ))}
          {formData.imagenes.length < 8 && (
            <label className={styles.uploadBtn}>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileChange}
                multiple
                disabled={uploading}
                style={{ display: "none" }}
              />
              {uploading ? (
                <div className={styles.uploadingSpinner} />
              ) : (
                <>
                  <ImageIcon />
                  <span>Subir</span>
                </>
              )}
            </label>
          )}
        </div>
      </div>

      <div className={styles.formActions}>
        <button type="button" className={styles.cancelBtn} onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className={styles.submitBtn} disabled={submitting || !formData.nombre}>
          {submitting ? "Guardando..." : initialData ? "Actualizar" : "Crear Producto"}
        </button>
      </div>
    </form>
  );
}

function ProductCard({
  product,
  onEdit,
  onDelete,
}: {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("¿Estás seguro de eliminar este producto?")) return;
    setDeleting(true);
    await onDelete();
    setDeleting(false);
  };

  const mainImage = product.imagenes?.[0] || product.imagen;
  const tags = Array.isArray(product.herramientas) ? product.herramientas : [];

  return (
    <article className={styles.card}>
      <div className={styles.media}>
        {mainImage ? (
          <img src={mainImage} alt={product.nombre} className={styles.image} />
        ) : (
          <div className={styles.placeholder}>
            <div className={styles.placeholderIcon} />
            <span className={styles.placeholderText}>Sin imagen</span>
          </div>
        )}
        {!product.activo && <span className={styles.badge} style={{ background: "#666" }}>Inactivo</span>}
      </div>
      <div className={styles.body}>
        <h3 className={styles.cardTitle}>{product.nombre}</h3>
        {product.descripcion ? (
          <p className={styles.cardDesc}>{product.descripcion}</p>
        ) : (
          <p className={styles.cardDescEmpty}>Sin descripción</p>
        )}
        {tags.length > 0 && (
          <div className={styles.tags}>
            {tags.slice(0, 3).map((tag, i) => (
              <span key={i} className={styles.tag}>{tag}</span>
            ))}
            {tags.length > 3 && <span className={styles.tag}>+{tags.length - 3}</span>}
          </div>
        )}
        <div className={styles.footer}>
          <span className={product.costo ? styles.price : styles.priceMuted}>
            {product.costo ? formatCurrency(product.costo) : "Sin precio"}
          </span>
          <div className={styles.cardActions}>
            <button className={styles.iconBtn} onClick={onEdit} title="Editar">
              <EditIcon />
            </button>
            <button
              className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
              onClick={handleDelete}
              disabled={deleting}
              title="Eliminar"
            >
              {deleting ? <div className={styles.miniSpinner} /> : <TrashIcon />}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function MisProductosPage() {
  const { profile, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const {
    products,
    loading,
    error,
    refetch,
    createProduct,
    updateProduct,
    deleteProduct,
    uploadImage,
  } = useMemberProducts();

  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<string[]>([]);

  // Redirect non-members
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || (profile?.rol !== "miembro" && profile?.rol !== "admin"))) {
      router.push("/dashboard");
    }
  }, [authLoading, isAuthenticated, profile, router]);

  const handleUploadImage = async (file: File): Promise<string | null> => {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload/product-image", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setPendingUploads((prev) => [...prev, data.url]);
      return data.url;
    } catch (err: any) {
      alert(err.message || "Error al subir imagen");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = (url: string) => {
    setPendingUploads((prev) => prev.filter((u) => u !== url));
  };

  const handleCreateProduct = async (formData: ProductFormData) => {
    const herramientas = formData.herramientas
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t);

    const { error } = await createProduct({
      nombre: formData.nombre,
      descripcion: formData.descripcion || undefined,
      costo: formData.costo ? parseFloat(formData.costo) : undefined,
      categoria: formData.categoria || undefined,
      herramientas: herramientas.length > 0 ? herramientas : undefined,
      imagenes: formData.imagenes,
      link_detalles: formData.link_detalles || undefined,
      unico: formData.unico,
    });

    if (error) {
      alert(error);
    } else {
      setShowForm(false);
      setPendingUploads([]);
    }
  };

  const handleUpdateProduct = async (formData: ProductFormData) => {
    if (!editingProduct) return;

    const herramientas = formData.herramientas
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t);

    const { error } = await updateProduct(editingProduct.id, {
      nombre: formData.nombre,
      descripcion: formData.descripcion || null,
      costo: formData.costo ? parseFloat(formData.costo) : null,
      categoria: formData.categoria || null,
      herramientas: herramientas.length > 0 ? herramientas : null,
      imagenes: formData.imagenes,
      link_detalles: formData.link_detalles || null,
      unico: formData.unico,
    });

    if (error) {
      alert(error);
    } else {
      setEditingProduct(null);
      setPendingUploads([]);
    }
  };

  const handleDeleteProduct = async (productId: number) => {
    const { error } = await deleteProduct(productId);
    if (error) alert(error);
  };

  if (authLoading || (!isAuthenticated && !profile)) {
    return (
      <DashboardLayout>
        <div className={ticketStyles.loadingState}>
          <div className={ticketStyles.spinner} />
          <p style={{ color: "var(--text-muted)" }}>Cargando...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={styles.page}>
        <div className={styles.bgGlow} />
        <div className={styles.container}>
          {/* Header */}
          <div className={styles.header}>
            <div>
              <h1 className={styles.title}>Mis Productos</h1>
              <p className={styles.subtitle}>
                Gestiona los productos y servicios que ofreces en el marketplace
              </p>
            </div>
            {!showForm && !editingProduct && (
              <button className={styles.primaryBtn} onClick={() => setShowForm(true)}>
                <PlusIcon />
                Nuevo Producto
              </button>
            )}
          </div>

          {/* Form */}
          {(showForm || editingProduct) && (
            <div className={styles.formCard}>
              <h2 className={styles.formTitle}>
                {editingProduct ? "Editar Producto" : "Nuevo Producto"}
              </h2>
              <ProductForm
                initialData={editingProduct || undefined}
                onSubmit={editingProduct ? handleUpdateProduct : handleCreateProduct}
                onCancel={() => {
                  setShowForm(false);
                  setEditingProduct(null);
                  setPendingUploads([]);
                }}
                uploading={uploading}
                onUploadImage={handleUploadImage}
                onRemoveImage={handleRemoveImage}
              />
            </div>
          )}

          {/* Products Grid */}
          {loading ? (
            <div className={styles.state}>
              <div className={styles.spinner} />
              <p>Cargando productos...</p>
            </div>
          ) : error ? (
            <div className={styles.stateError}>
              <h4 className={styles.errorTitle}>Error</h4>
              <p className={styles.errorText}>{error}</p>
              <button className={styles.retryBtn} onClick={() => refetch()}>
                Reintentar
              </button>
            </div>
          ) : products.length === 0 ? (
            <div className={styles.state}>
              <PackageIcon />
              <h3 style={{ margin: "12px 0 0", color: "#fff" }}>No tienes productos</h3>
              <p style={{ margin: "8px 0 0" }}>
                Crea tu primer producto para empezar a vender en el marketplace
              </p>
            </div>
          ) : (
            <div className={styles.grid}>
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onEdit={() => setEditingProduct(product)}
                  onDelete={() => handleDeleteProduct(product.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

"use client";

import React, { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import { useProduct, useCart } from "@/lib/hooks/useMarketplace";
import styles from "@/app/styles/Mercado.module.css";

// Icons
const ArrowLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const CartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="21" r="1" />
    <circle cx="19" cy="21" r="1" />
    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
  </svg>
);

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const UserIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const formatCurrency = (amount: number | null): string => {
  if (amount === null || amount === undefined) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
};

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id ? parseInt(params.id as string) : null;

  const { product, relatedProducts, loading, error } = useProduct(productId);
  const { addToCart, itemCount } = useCart();

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [addingToCart, setAddingToCart] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);

  const handleAddToCart = async () => {
    if (!product) return;
    setAddingToCart(true);
    const { error } = await addToCart(product.id);
    setAddingToCart(false);
    if (!error) {
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 2000);
    }
  };

  // Get all images
  const images = product?.imagenes?.length
    ? product.imagenes
    : product?.imagen
    ? [product.imagen]
    : [];

  const tags = Array.isArray(product?.herramientas) ? product.herramientas : [];

  if (loading) {
    return (
      <DashboardLayout>
        <div className={styles.page}>
          <div className={styles.bgGlow} />
          <div className={styles.container}>
            <div className={styles.state}>
              <div className={styles.spinner} />
              <p>Cargando producto...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !product) {
    return (
      <DashboardLayout>
        <div className={styles.page}>
          <div className={styles.bgGlow} />
          <div className={styles.container}>
            <div className={styles.stateError}>
              <h4 className={styles.errorTitle}>Error</h4>
              <p className={styles.errorText}>{error || "Producto no encontrado"}</p>
              <button className={styles.retryBtn} onClick={() => router.back()}>
                Volver
              </button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={styles.page}>
        <div className={styles.bgGlow} />
        <div className={styles.container}>
          {/* Back button */}
          <button className={styles.backBtn} onClick={() => router.back()}>
            <ArrowLeftIcon />
            Volver al catálogo
          </button>

          {/* Product Detail */}
          <div className={styles.detailLayout}>
            {/* Gallery */}
            <div className={styles.gallery}>
              <div className={styles.galleryMain}>
                {images.length > 0 ? (
                  <img
                    src={images[selectedImageIndex]}
                    alt={product.nombre}
                    className={styles.galleryImage}
                  />
                ) : (
                  <div className={styles.galleryPlaceholder}>
                    <div className={styles.placeholderIcon} />
                    <span>Sin imagen</span>
                  </div>
                )}
              </div>
              {images.length > 1 && (
                <div className={styles.galleryThumbs}>
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      className={`${styles.thumb} ${selectedImageIndex === idx ? styles.thumbActive : ""}`}
                      onClick={() => setSelectedImageIndex(idx)}
                    >
                      <img src={img} alt={`Imagen ${idx + 1}`} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Info */}
            <div className={styles.detailInfo}>
              {product.categoria && (
                <span className={styles.detailCategory}>{product.categoria}</span>
              )}
              <h1 className={styles.detailTitle}>{product.nombre}</h1>

              <div className={styles.detailPrice}>
                {product.costo ? formatCurrency(product.costo) : "Precio a consultar"}
              </div>

              {product.unico && (
                <span className={styles.unicoDetailBadge}>Producto unico</span>
              )}

              {product.descripcion && (
                <div className={styles.detailDescription}>
                  <h3>Descripción</h3>
                  <p>{product.descripcion}</p>
                </div>
              )}

              {tags.length > 0 && (
                <div className={styles.detailTags}>
                  <h3>Tecnologías</h3>
                  <div className={styles.tags}>
                    {tags.map((tag, i) => (
                      <span key={i} className={styles.tag}>{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              {product.link_detalles && (
                <a
                  href={product.link_detalles}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.detailLink}
                >
                  Ver más detalles <ExternalLinkIcon />
                </a>
              )}

              {/* Actions */}
              <div className={styles.detailActions}>
                <button
                  className={`${styles.addToCartBtn} ${addedToCart ? styles.addedToCart : ""}`}
                  onClick={handleAddToCart}
                  disabled={addingToCart || addedToCart}
                >
                  {addedToCart ? (
                    <>
                      <CheckIcon />
                      Agregado al carrito
                    </>
                  ) : addingToCart ? (
                    <>
                      <div className={styles.btnSpinner} />
                      Agregando...
                    </>
                  ) : (
                    <>
                      <CartIcon />
                      Agregar al carrito
                    </>
                  )}
                </button>

                <button
                  className={styles.viewCartBtn}
                  onClick={() => router.push("/dashboard/mercado/carrito")}
                >
                  Ver carrito {itemCount > 0 && `(${itemCount})`}
                </button>
              </div>

              {/* Seller Card */}
              {product.vendedor_nombre && (
                <div className={styles.sellerCard}>
                  <div className={styles.sellerAvatar}>
                    {product.vendedor_foto ? (
                      <img src={product.vendedor_foto} alt={product.vendedor_nombre} />
                    ) : (
                      <UserIcon />
                    )}
                  </div>
                  <div className={styles.sellerInfo}>
                    <span className={styles.sellerLabel}>Vendido por</span>
                    <h4 className={styles.sellerName}>{product.vendedor_nombre}</h4>
                    {product.vendedor_puesto && (
                      <span className={styles.sellerRole}>{product.vendedor_puesto}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Related Products */}
          {relatedProducts.length > 0 && (
            <div className={styles.relatedSection}>
              <h2 className={styles.relatedTitle}>Productos relacionados</h2>
              <div className={styles.relatedGrid}>
                {relatedProducts.map((rp) => {
                  const rpImage = rp.imagenes?.[0] || rp.imagen;
                  return (
                    <article
                      key={rp.id}
                      className={styles.card}
                      onClick={() => router.push(`/dashboard/mercado/${rp.id}`)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          router.push(`/dashboard/mercado/${rp.id}`);
                        }
                      }}
                    >
                      <div className={styles.media}>
                        {rpImage ? (
                          <img src={rpImage} alt={rp.nombre} className={styles.image} />
                        ) : (
                          <div className={styles.placeholder}>
                            <div className={styles.placeholderIcon} />
                          </div>
                        )}
                        {rp.categoria && <span className={styles.badge}>{rp.categoria}</span>}
                      </div>
                      <div className={styles.body}>
                        <h3 className={styles.cardTitle}>{rp.nombre}</h3>
                        <div className={styles.footer}>
                          <span className={rp.costo ? styles.price : styles.priceMuted}>
                            {rp.costo ? formatCurrency(rp.costo) : "Consultar"}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

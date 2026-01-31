"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import { useMarketplace, MarketplaceFilters, useCart } from "@/lib/hooks/useMarketplace";
import styles from "@/app/styles/Mercado.module.css";

// Icons
const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const FilterIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const CartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="21" r="1" />
    <circle cx="19" cy="21" r="1" />
    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
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

export default function MercadoPage() {
  const router = useRouter();
  const { products, categories, loading, error, refetch } = useMarketplace();
  const { itemCount } = useCart();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [priceRange, setPriceRange] = useState({ min: "", max: "" });
  const [showFilters, setShowFilters] = useState(false);

  // Apply filters
  const handleApplyFilters = () => {
    const filters: MarketplaceFilters = {};
    if (searchTerm) filters.search = searchTerm;
    if (selectedCategory) filters.categoria = selectedCategory;
    if (priceRange.min) filters.minPrice = parseFloat(priceRange.min);
    if (priceRange.max) filters.maxPrice = parseFloat(priceRange.max);
    refetch(filters);
  };

  // Debounced search
  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

  // Filter locally for instant feedback
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchName = p.nombre?.toLowerCase().includes(search);
        const matchDesc = p.descripcion?.toLowerCase().includes(search);
        if (!matchName && !matchDesc) return false;
      }
      if (selectedCategory && p.categoria !== selectedCategory) return false;
      if (priceRange.min && p.costo && p.costo < parseFloat(priceRange.min)) return false;
      if (priceRange.max && p.costo && p.costo > parseFloat(priceRange.max)) return false;
      return true;
    });
  }, [products, searchTerm, selectedCategory, priceRange]);

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedCategory("");
    setPriceRange({ min: "", max: "" });
    refetch();
  };

  const hasActiveFilters = searchTerm || selectedCategory || priceRange.min || priceRange.max;

  const navRightContent = (
    <button
      className={styles.navCartBtn}
      onClick={() => router.push("/dashboard/mercado/carrito")}
      aria-label="Ver carrito"
    >
      <CartIcon />
      {itemCount > 0 && <span className={styles.navCartBadge}>{itemCount}</span>}
    </button>
  );

  return (
    <DashboardLayout rightContent={navRightContent}>
      <div className={styles.page}>
        <div className={styles.bgGlow} />
        <div className={styles.container}>

          {/* Browse Layout */}
          <div className={styles.browseLayout}>
            {/* Main Content */}
            <div className={styles.browseMain}>
              {/* Filters Bar */}
              <div className={styles.filters}>
                <div className={styles.searchWrapper}>
                  <SearchIcon />
                  <input
                    type="text"
                    className={styles.search}
                    placeholder="Buscar productos..."
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                  />
                </div>

                <select
                  className={styles.select}
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="">Todas las categorías</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                <button
                  className={`${styles.filterToggle} ${showFilters ? styles.filterToggleActive : ""}`}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <FilterIcon />
                  Filtros
                </button>

                {hasActiveFilters && (
                  <button className={styles.clearFilters} onClick={clearFilters}>
                    Limpiar filtros
                  </button>
                )}

                <span className={styles.count}>
                  {filteredProducts.length} producto{filteredProducts.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Expanded Filters */}
              {showFilters && (
                <div className={styles.expandedFilters}>
                  <div className={styles.filterGroup}>
                    <label className={styles.filterLabel}>Rango de precio</label>
                    <div className={styles.priceInputs}>
                      <input
                        type="number"
                        placeholder="Min"
                        className={styles.priceInput}
                        value={priceRange.min}
                        onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
                      />
                      <span>-</span>
                      <input
                        type="number"
                        placeholder="Max"
                        className={styles.priceInput}
                        value={priceRange.max}
                        onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
                      />
                    </div>
                  </div>
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
              ) : filteredProducts.length === 0 ? (
                <div className={styles.state}>
                  <PackageIcon />
                  <h3 style={{ margin: "12px 0 0", color: "#fff" }}>
                    {hasActiveFilters ? "No se encontraron productos" : "No hay productos disponibles"}
                  </h3>
                  <p style={{ margin: "8px 0 0" }}>
                    {hasActiveFilters
                      ? "Intenta con otros filtros de búsqueda"
                      : "Los productos aparecerán aquí cuando estén disponibles"}
                  </p>
                </div>
              ) : (
                <div className={styles.grid}>
                  {filteredProducts.map((product) => {
                    const mainImage = product.imagenes?.[0] || product.imagen;
                    const tags = Array.isArray(product.herramientas) ? product.herramientas : [];

                    return (
                      <article
                        key={product.id}
                        className={styles.card}
                        onClick={() => router.push(`/dashboard/mercado/${product.id}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            router.push(`/dashboard/mercado/${product.id}`);
                          }
                        }}
                      >
                        <div className={styles.media}>
                          {mainImage ? (
                            <img src={mainImage} alt={product.nombre} className={styles.image} />
                          ) : (
                            <div className={styles.placeholder}>
                              <div className={styles.placeholderIcon} />
                              <span className={styles.placeholderText}>Sin imagen</span>
                            </div>
                          )}
                          {product.categoria && (
                            <span className={styles.badge}>{product.categoria}</span>
                          )}
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
                              {tags.length > 3 && (
                                <span className={styles.tag}>+{tags.length - 3}</span>
                              )}
                            </div>
                          )}
                          <div className={styles.footer}>
                            <span className={product.costo ? styles.price : styles.priceMuted}>
                              {product.costo ? formatCurrency(product.costo) : "Consultar"}
                            </span>
                            {product.vendedor_nombre && (
                              <div className={styles.vendorInfo}>
                                {product.vendedor_foto && (
                                  <img
                                    src={product.vendedor_foto}
                                    alt={product.vendedor_nombre}
                                    className={styles.vendorAvatar}
                                  />
                                )}
                                <span className={styles.vendorName}>{product.vendedor_nombre}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sidebar */}
            <aside className={styles.sidebar}>
              <div className={styles.sidebarSection}>
                <h3 className={styles.sidebarTitle}>Categorías</h3>
                <div className={styles.categoryList}>
                  <button
                    className={`${styles.categoryBtn} ${!selectedCategory ? styles.categoryBtnActive : ""}`}
                    onClick={() => setSelectedCategory("")}
                  >
                    Todas
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      className={`${styles.categoryBtn} ${selectedCategory === cat ? styles.categoryBtnActive : ""}`}
                      onClick={() => setSelectedCategory(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.sidebarSection}>
                <h3 className={styles.sidebarTitle}>Precio</h3>
                <div className={styles.priceFilter}>
                  <input
                    type="number"
                    placeholder="Mínimo"
                    className={styles.sidebarInput}
                    value={priceRange.min}
                    onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
                  />
                  <span className={styles.priceSeparator}>-</span>
                  <input
                    type="number"
                    placeholder="Máximo"
                    className={styles.sidebarInput}
                    value={priceRange.max}
                    onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
                  />
                </div>
              </div>

              {hasActiveFilters && (
                <button className={styles.sidebarClearBtn} onClick={clearFilters}>
                  Limpiar filtros
                </button>
              )}
            </aside>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

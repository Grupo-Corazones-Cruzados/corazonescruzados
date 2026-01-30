"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthProvider";

// ========================
// Types
// ========================

export interface Product {
  id: number;
  created_at: string;
  updated_at?: string;
  nombre: string;
  herramientas: any | null;
  descripcion: string | null;
  imagen: string | null;
  imagenes: string[];
  link_detalles: string | null;
  costo: number | null;
  categoria: string | null;
  activo: boolean;
  id_miembro: number | null;
  vendedor_nombre?: string;
  vendedor_foto?: string;
  vendedor_puesto?: string;
}

export interface CartItem {
  id: number;
  id_usuario: string;
  id_producto: number;
  cantidad: number;
  created_at: string;
  producto?: Product;
}

export interface Order {
  id: number;
  id_comprador: string;
  estado: string;
  total: number;
  notas: string | null;
  paypal_order_id: string | null;
  paypal_capture_id: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
}

export interface OrderItem {
  id: number;
  id_order: number;
  id_producto: number;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  producto?: Product;
}

export interface MarketplaceFilters {
  search?: string;
  categoria?: string;
  minPrice?: number;
  maxPrice?: number;
  vendedorId?: number;
}

// ========================
// useMarketplace - Browse products
// ========================

export function useMarketplace() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async (filters?: MarketplaceFilters) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters?.search) params.append("search", filters.search);
      if (filters?.categoria) params.append("categoria", filters.categoria);
      if (filters?.minPrice) params.append("minPrice", filters.minPrice.toString());
      if (filters?.maxPrice) params.append("maxPrice", filters.maxPrice.toString());
      if (filters?.vendedorId) params.append("vendedorId", filters.vendedorId.toString());

      const response = await fetch(`/api/mercado?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al cargar productos");
      }

      setProducts(data.products || []);
      setCategories(data.categories || []);
    } catch (err) {
      console.error("Error fetching marketplace:", err);
      setError("Error al cargar el catálogo");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return {
    products,
    categories,
    loading,
    error,
    refetch: fetchProducts,
  };
}

// ========================
// useMemberProducts - CRUD for member's own products
// ========================

export function useMemberProducts() {
  const { isAuthenticated } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/member/products");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al cargar productos");
      }

      setProducts(data.products || []);
    } catch (err) {
      console.error("Error fetching member products:", err);
      setError("Error al cargar tus productos");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const createProduct = async (productData: {
    nombre: string;
    descripcion?: string;
    costo?: number;
    categoria?: string;
    herramientas?: string[];
    imagenes?: string[];
    link_detalles?: string;
  }) => {
    try {
      const response = await fetch("/api/member/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al crear el producto");
      }

      await fetchProducts();
      return { data: data.product, error: null };
    } catch (err: any) {
      console.error("Error creating product:", err);
      return { data: null, error: err.message || "Error al crear el producto" };
    }
  };

  const updateProduct = async (productId: number, updates: Partial<Product>) => {
    try {
      const response = await fetch("/api/member/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: productId, ...updates }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al actualizar el producto");
      }

      await fetchProducts();
      return { data: data.product, error: null };
    } catch (err: any) {
      console.error("Error updating product:", err);
      return { data: null, error: err.message || "Error al actualizar el producto" };
    }
  };

  const deleteProduct = async (productId: number) => {
    try {
      const response = await fetch(`/api/member/products?id=${productId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al eliminar el producto");
      }

      await fetchProducts();
      return { error: null };
    } catch (err: any) {
      console.error("Error deleting product:", err);
      return { error: err.message || "Error al eliminar el producto" };
    }
  };

  const uploadImage = async (file: File, productId?: number) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (productId) formData.append("productId", productId.toString());

      const response = await fetch("/api/upload/product-image", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al subir la imagen");
      }

      if (productId) {
        await fetchProducts();
      }

      return { url: data.url, imagenes: data.imagenes, error: null };
    } catch (err: any) {
      console.error("Error uploading image:", err);
      return { url: null, imagenes: null, error: err.message || "Error al subir la imagen" };
    }
  };

  const removeImage = async (productId: number, imageUrl: string) => {
    try {
      const response = await fetch(
        `/api/upload/product-image?productId=${productId}&imageUrl=${encodeURIComponent(imageUrl)}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al eliminar la imagen");
      }

      await fetchProducts();
      return { imagenes: data.imagenes, error: null };
    } catch (err: any) {
      console.error("Error removing image:", err);
      return { imagenes: null, error: err.message || "Error al eliminar la imagen" };
    }
  };

  return {
    products,
    loading,
    error,
    refetch: fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    uploadImage,
    removeImage,
  };
}

// ========================
// useCart - Shopping cart
// ========================

export function useCart() {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const total = items.reduce((sum, item) => {
    return sum + (item.producto?.costo || 0) * item.cantidad;
  }, 0);

  const itemCount = items.reduce((sum, item) => sum + item.cantidad, 0);

  const fetchCart = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/mercado/cart");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al cargar el carrito");
      }

      setItems(data.items || []);
    } catch (err) {
      console.error("Error fetching cart:", err);
      setError("Error al cargar el carrito");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const addToCart = async (productId: number, cantidad: number = 1) => {
    try {
      const response = await fetch("/api/mercado/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_producto: productId, cantidad }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al agregar al carrito");
      }

      await fetchCart();
      return { error: null };
    } catch (err: any) {
      console.error("Error adding to cart:", err);
      return { error: err.message || "Error al agregar al carrito" };
    }
  };

  const updateQuantity = async (itemId: number, cantidad: number) => {
    try {
      const response = await fetch("/api/mercado/cart", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: itemId, cantidad }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al actualizar cantidad");
      }

      await fetchCart();
      return { error: null };
    } catch (err: any) {
      console.error("Error updating cart quantity:", err);
      return { error: err.message || "Error al actualizar cantidad" };
    }
  };

  const removeFromCart = async (itemId: number) => {
    try {
      const response = await fetch(`/api/mercado/cart?id=${itemId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al eliminar del carrito");
      }

      await fetchCart();
      return { error: null };
    } catch (err: any) {
      console.error("Error removing from cart:", err);
      return { error: err.message || "Error al eliminar del carrito" };
    }
  };

  const clearCart = async () => {
    try {
      const response = await fetch("/api/mercado/cart?all=true", {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al vaciar el carrito");
      }

      setItems([]);
      return { error: null };
    } catch (err: any) {
      console.error("Error clearing cart:", err);
      return { error: err.message || "Error al vaciar el carrito" };
    }
  };

  return {
    items,
    total,
    itemCount,
    loading,
    error,
    refetch: fetchCart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
  };
}

// ========================
// useOrders - Order history
// ========================

export function useOrders() {
  const { isAuthenticated } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/mercado/orders");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al cargar pedidos");
      }

      setOrders(data.orders || []);
    } catch (err) {
      console.error("Error fetching orders:", err);
      setError("Error al cargar los pedidos");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const createOrder = async (notas?: string) => {
    try {
      const response = await fetch("/api/mercado/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notas }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al crear el pedido");
      }

      await fetchOrders();
      return { order: data.order, error: null };
    } catch (err: any) {
      console.error("Error creating order:", err);
      return { order: null, error: err.message || "Error al crear el pedido" };
    }
  };

  return {
    orders,
    loading,
    error,
    refetch: fetchOrders,
    createOrder,
  };
}

// ========================
// useProduct - Single product detail
// ========================

export function useProduct(id: number | null) {
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProduct = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/mercado/${id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al cargar el producto");
      }

      setProduct(data.product);
      setRelatedProducts(data.relatedProducts || []);
    } catch (err) {
      console.error("Error fetching product:", err);
      setError("Error al cargar el producto");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  return {
    product,
    relatedProducts,
    loading,
    error,
    refetch: fetchProduct,
  };
}

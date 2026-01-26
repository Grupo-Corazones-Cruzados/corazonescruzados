"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthProvider";

export interface Invoice {
  id: number;
  created_at: string;
  updated_at: string;
  numero_factura: string;
  id_cliente: number;
  id_miembro: number | null;
  id_ticket: number | null;
  id_project: number | null;
  subtotal: number;
  impuestos: number;
  total: number;
  estado: string;
  pdf_url: string | null;
  notas: string | null;
  fecha_envio: string | null;
  fecha_pago: string | null;
  cliente?: {
    id: number;
    nombre: string;
    correo_electronico: string;
  };
  miembro?: {
    id: number;
    nombre: string;
  };
  ticket?: {
    id: number;
    titulo: string | null;
  };
  project?: {
    id: number;
    titulo: string;
  };
}

export interface InvoiceItem {
  id: number;
  created_at: string;
  id_invoice: number;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export function useInvoices() {
  const { isAuthenticated } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async (filters?: { estado?: string; search?: string }) => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters?.estado && filters.estado !== "todos") params.append("estado", filters.estado);
      if (filters?.search) params.append("search", filters.search);

      const response = await fetch(`/api/invoices?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al cargar las facturas");
      }

      setInvoices(data.invoices || []);
    } catch (err) {
      console.error("Error fetching invoices:", err);
      setError("Error al cargar las facturas");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  return {
    invoices,
    loading,
    error,
    refetch: fetchInvoices,
  };
}

export function useInvoice(id: number | null) {
  const { isAuthenticated } = useAuth();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoice = useCallback(async () => {
    if (!isAuthenticated || !id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/invoices/${id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al cargar la factura");
      }

      setInvoice(data.invoice);
      setItems(data.items || []);
    } catch (err) {
      console.error("Error fetching invoice:", err);
      setError("Error al cargar la factura");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, id]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  const updateInvoice = async (updates: Partial<Invoice>) => {
    if (!id) return { error: "No invoice ID" };

    try {
      const response = await fetch(`/api/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al actualizar la factura");
      }

      await fetchInvoice();
      return { error: null };
    } catch (err) {
      console.error("Error updating invoice:", err);
      return { error: "Error al actualizar la factura" };
    }
  };

  return {
    invoice,
    items,
    loading,
    error,
    refetch: fetchInvoice,
    updateInvoice,
  };
}

export function useCreateInvoice() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createInvoice = async (data: {
    id_cliente: number;
    id_miembro?: number;
    id_ticket?: number;
    id_project?: number;
    subtotal: number;
    notas?: string;
    items: { descripcion: string; cantidad: number; precio_unitario: number }[];
  }) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al crear la factura");
      }

      return { data: result.invoice, error: null };
    } catch (err) {
      console.error("Error creating invoice:", err);
      const errorMessage = "Error al crear la factura";
      setError(errorMessage);
      return { data: null, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  return {
    createInvoice,
    loading,
    error,
  };
}

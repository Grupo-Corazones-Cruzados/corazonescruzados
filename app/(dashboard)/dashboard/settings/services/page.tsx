"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { formatCurrency } from "@/lib/utils";
import type { Service } from "@/lib/types";
import styles from "./page.module.css";

export default function ServicesSettingsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [allServices, setAllServices] = useState<Service[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [positionName, setPositionName] = useState<string | null>(null);

  const memberId = user?.member_id;

  const loadData = useCallback(async () => {
    if (!memberId) return;
    try {
      // Fetch member to get position_id, then services for that position
      const [memberRes, memberServicesRes] = await Promise.all([
        fetch(`/api/members/${memberId}/services`),
        fetch(`/api/members/${memberId}/services`),
      ]);

      // Get member info to find position
      const memberInfoRes = await fetch(`/api/members?per_page=200&active_only=false`);
      const memberInfoJson = await memberInfoRes.json();
      const memberData = (memberInfoJson.data || []).find(
        (m: { id: number }) => m.id === memberId
      );

      const posId = memberData?.position_id;
      setPositionName(memberData?.position_name || null);

      // Fetch services filtered by position
      const servicesUrl = posId
        ? `/api/services?active_only=true&position_id=${posId}`
        : "/api/services?active_only=true";
      const servicesRes = await fetch(servicesUrl);

      if (!servicesRes.ok) throw new Error("Error al cargar servicios");

      const servicesJson = await servicesRes.json();
      const memberServicesJson = memberServicesRes.ok
        ? await memberServicesRes.json()
        : { data: [] };

      setAllServices(servicesJson.data || []);
      const currentIds = new Set<number>(
        (memberServicesJson.data || []).map((s: Service) => s.id)
      );
      setSelectedIds(currentIds);
    } catch {
      toast("Error al cargar servicios", "error");
    } finally {
      setLoading(false);
    }
  }, [memberId, toast]);

  useEffect(() => {
    if (!authLoading && memberId) loadData();
    else if (!authLoading) setLoading(false);
  }, [authLoading, memberId, loadData]);

  const toggleService = (serviceId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(serviceId)) {
        next.delete(serviceId);
      } else {
        next.add(serviceId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!memberId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/members/${memberId}/services`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service_ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error();
      toast("Servicios actualizados", "success");
    } catch {
      toast("Error al guardar servicios", "error");
    } finally {
      setSaving(false);
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
        <PageHeader
          title="Servicios"
          description="Solo miembros pueden configurar servicios."
        />
        <Card padding="lg">
          <p>Esta sección solo está disponible para miembros del equipo.</p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Servicios"
        description={
          positionName
            ? `Selecciona los servicios que ofreces como ${positionName}.`
            : "Selecciona los servicios que ofreces."
        }
        action={
          <Button onClick={handleSave} isLoading={saving}>
            Guardar
          </Button>
        }
      />

      {allServices.length === 0 ? (
        <Card padding="lg">
          <p className={styles.emptyMessage}>
            {positionName
              ? `No hay servicios disponibles para el puesto de ${positionName}. Contacta al administrador.`
              : "No hay servicios disponibles en este momento. Contacta al administrador."}
          </p>
        </Card>
      ) : (
        <div className={styles.serviceGrid}>
          {allServices.map((service) => {
            const isSelected = selectedIds.has(service.id);
            return (
              <button
                key={service.id}
                type="button"
                className={`${styles.serviceCard} ${
                  isSelected ? styles.selected : ""
                }`}
                onClick={() => toggleService(service.id)}
                aria-pressed={isSelected}
              >
                <div className={styles.cardHeader}>
                  <span className={styles.serviceName}>{service.name}</span>
                  <span className={styles.checkbox}>
                    <svg
                      className={styles.checkIcon}
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                </div>
                {service.description && (
                  <p className={styles.serviceDescription}>
                    {service.description}
                  </p>
                )}
                {service.base_price > 0 && (
                  <p className={styles.servicePrice}>
                    Desde {formatCurrency(service.base_price)}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

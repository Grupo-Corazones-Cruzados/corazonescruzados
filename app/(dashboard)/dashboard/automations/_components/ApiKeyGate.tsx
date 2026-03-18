"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Input, Spinner } from "@/components/ui";
import styles from "../page.module.css";

interface FieldDef {
  key: string;
  label: string;
  placeholder: string;
  type?: "config" | "api_key";
}

interface ApiKeyGateProps {
  service: "zeptomail" | "meta_whatsapp";
  title: string;
  description: string;
  fields: FieldDef[];
  optionalFields?: FieldDef[];
  children: React.ReactNode;
}

export default function ApiKeyGate({
  service,
  title,
  description,
  fields,
  optionalFields,
  children,
}: ApiKeyGateProps) {
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [showOptional, setShowOptional] = useState(false);

  const checkConfig = useCallback(async () => {
    try {
      const res = await fetch(`/api/user-api-keys/${service}`);
      const json = await res.json();
      if (json.data) {
        setConfigured(true);
      }
    } catch {
      // Not configured
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    checkConfig();
  }, [checkConfig]);

  const handleSave = async () => {
    setError("");

    // Validate required fields
    for (const field of fields) {
      const value = formData[field.key]?.trim();
      if (!value) {
        setError(`${field.label} es obligatorio`);
        return;
      }
    }

    setSaving(true);
    try {
      // Separate api_key from config
      const apiKeyField = fields.find((f) => f.type !== "config");
      const configFields = [
        ...fields.filter((f) => f.type === "config"),
        ...(optionalFields || []),
      ];

      const config: Record<string, string> = {};
      for (const f of configFields) {
        const val = formData[f.key]?.trim();
        if (val) {
          config[f.key] = val;
        }
      }

      const res = await fetch(`/api/user-api-keys/${service}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKeyField ? formData[apiKeyField.key].trim() : formData[fields[0].key].trim(),
          config,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Error al guardar");
      }

      setConfigured(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar configuración");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner />
      </div>
    );
  }

  if (configured) {
    return <>{children}</>;
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="12" cy="16" r="1.5" fill="currentColor" />
          </svg>
        </div>
        <h3 className={styles.emptyTitle}>{title}</h3>
        <p className={styles.emptyDesc}>{description}</p>
      </div>

      <div className={styles.form} style={{ marginTop: "var(--space-6)" }}>
        {/* Required fields */}
        {fields.map((field) => (
          <Input
            key={field.key}
            label={field.label}
            placeholder={field.placeholder}
            value={formData[field.key] || ""}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))
            }
          />
        ))}

        {/* Optional fields toggle */}
        {optionalFields && optionalFields.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setShowOptional(!showOptional)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "var(--text-sm)",
                fontWeight: 500,
                color: "var(--accent)",
                padding: 0,
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                style={{
                  transform: showOptional ? "rotate(90deg)" : "rotate(0deg)",
                  transition: "transform 0.15s ease",
                }}
              >
                <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Campos opcionales (configuración avanzada)
            </button>

            {showOptional && (
              <div className={styles.form} style={{ paddingLeft: "var(--space-2)" }}>
                {optionalFields.map((field) => (
                  <Input
                    key={field.key}
                    label={field.label}
                    placeholder={field.placeholder}
                    value={formData[field.key] || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                  />
                ))}
              </div>
            )}
          </>
        )}

        {error && (
          <p style={{ color: "var(--error)", fontSize: "var(--text-sm)", margin: 0 }}>
            {error}
          </p>
        )}

        <Button onClick={handleSave} disabled={saving} style={{ width: "100%" }}>
          {saving ? "Guardando..." : "Guardar configuración"}
        </Button>

        {/* Prerequisites info for WhatsApp */}
        {service === "meta_whatsapp" && (
          <div style={{
            padding: "var(--space-4)",
            background: "var(--gray-50)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-light)",
            marginTop: "var(--space-2)",
          }}>
            <p style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)", margin: "0 0 var(--space-2)" }}>
              Requisitos previos en Meta
            </p>
            <ol style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", margin: 0, paddingLeft: "var(--space-4)", lineHeight: 1.8 }}>
              <li>Cuenta en Meta for Developers (developers.facebook.com)</li>
              <li>App creada con caso de uso &quot;Business&quot; y WhatsApp</li>
              <li>Verificación de negocio completada</li>
              <li>Número de teléfono registrado y verificado (no puede estar en uso con WhatsApp personal)</li>
              <li>System User con permisos: whatsapp_business_management y whatsapp_business_messaging</li>
              <li>Token con expiración &quot;Never&quot;</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

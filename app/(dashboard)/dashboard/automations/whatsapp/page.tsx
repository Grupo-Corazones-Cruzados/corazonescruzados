"use client";

import { useToast } from "@/components/ui/Toast";
import ApiKeyGate from "../_components/ApiKeyGate";
import WhatsAppContent from "../_components/WhatsAppContent";

export default function WhatsAppPage() {
  const { toast } = useToast();

  return (
    <ApiKeyGate
      service="meta_whatsapp"
      title="Configurar API de Meta WhatsApp"
      description="Para enviar mensajes por WhatsApp necesitas configurar tu cuenta de Meta Business. Obtén estos datos desde tu panel de desarrollador en developers.facebook.com."
      fields={[
        {
          key: "api_key",
          label: "Token de acceso permanente (Access Token)",
          placeholder: "EAABsb...",
          type: "api_key",
        },
        {
          key: "phone_number_id",
          label: "ID del número de teléfono (Phone Number ID)",
          placeholder: "1234567890",
          type: "config",
        },
        {
          key: "business_account_id",
          label: "ID de cuenta WhatsApp Business (WABA ID)",
          placeholder: "9876543210",
          type: "config",
        },
      ]}
      optionalFields={[
        {
          key: "app_id",
          label: "App ID (opcional)",
          placeholder: "ID de la app en Meta",
          type: "config",
        },
        {
          key: "app_secret",
          label: "App Secret (opcional)",
          placeholder: "Secreto de la aplicación",
          type: "config",
        },
        {
          key: "business_manager_id",
          label: "Business Manager ID (opcional)",
          placeholder: "ID del Business Manager",
          type: "config",
        },
        {
          key: "webhook_verify_token",
          label: "Webhook Verify Token (opcional)",
          placeholder: "Token personalizado para webhooks",
          type: "config",
        },
        {
          key: "api_version",
          label: "Versión de API (opcional)",
          placeholder: "v21.0",
          type: "config",
        },
      ]}
    >
      <WhatsAppContent toast={toast} />
    </ApiKeyGate>
  );
}

"use client";

import { useToast } from "@/components/ui/Toast";
import ApiKeyGate from "../_components/ApiKeyGate";
import AutomationsContent from "../_components/AutomationsContent";

export default function EmailMasivoPage() {
  const { toast } = useToast();

  return (
    <ApiKeyGate
      service="zeptomail"
      title="Configurar ZeptoMail"
      description="Para enviar correos masivos necesitas registrar tu clave API de ZeptoMail. Puedes obtenerla desde tu panel de ZeptoMail."
      fields={[
        {
          key: "api_key",
          label: "Clave API de ZeptoMail",
          placeholder: "wSsVR60kqR7...",
          type: "api_key",
        },
      ]}
    >
      <AutomationsContent toast={toast} />
    </ApiKeyGate>
  );
}

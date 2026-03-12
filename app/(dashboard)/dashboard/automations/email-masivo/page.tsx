"use client";

import { useToast } from "@/components/ui/Toast";
import AutomationsContent from "../_components/AutomationsContent";

export default function EmailMasivoPage() {
  const { toast } = useToast();
  return <AutomationsContent toast={toast} />;
}

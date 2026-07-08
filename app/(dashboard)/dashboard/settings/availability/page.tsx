import { redirect } from 'next/navigation';

// La disponibilidad se consolidó en la página de Configuración (carril de paneles).
export default function AvailabilitySettingsRedirect() {
  redirect('/dashboard/settings');
}

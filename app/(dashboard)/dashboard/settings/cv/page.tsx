import { redirect } from 'next/navigation';

// El CV se consolidó en la página de Configuración (carril de paneles).
export default function CvSettingsRedirect() {
  redirect('/dashboard/settings');
}

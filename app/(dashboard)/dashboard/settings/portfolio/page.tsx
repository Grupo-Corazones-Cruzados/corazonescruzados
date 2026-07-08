import { redirect } from 'next/navigation';

// El portafolio se consolidó en la página de Configuración (carril de paneles).
export default function PortfolioSettingsRedirect() {
  redirect('/dashboard/settings');
}

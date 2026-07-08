import { redirect } from 'next/navigation';

// El calendario se movió al módulo "Mi día". Se mantiene la ruta como redirección.
export default function CalendarSettingsRedirect() {
  redirect('/dashboard/mi-dia');
}

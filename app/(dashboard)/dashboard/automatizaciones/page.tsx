'use client';

import PageHeader from '@/components/ui/PageHeader';
import FlowsTable from '@/components/dashboard/flows/FlowsTable';

export default function AutomatizacionesPage() {
  return (
    <div>
      <PageHeader title="Automatizaciones" description="Gestiona tus flujos de automatización" />
      <FlowsTable />
    </div>
  );
}

import IncidentsPortal from './IncidentsPortal';

export const dynamic = 'force-dynamic';

export default async function IncidentesPublicPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <IncidentsPortal token={token} />;
}

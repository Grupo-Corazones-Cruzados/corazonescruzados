import FlowDetail from './FlowDetail';

export const dynamic = 'force-dynamic';

export default async function FlowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FlowDetail flowId={id} />;
}

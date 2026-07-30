import ContactListPortal from './ContactListPortal';

export const dynamic = 'force-dynamic';

export default async function ListaContactosPublicPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ContactListPortal token={token} />;
}

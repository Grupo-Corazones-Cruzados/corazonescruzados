import type { Metadata } from 'next';
import { pool } from '@/lib/db';
import MarketplacePublico from '@/components/marketplace/MarketplacePublico';
import { slugDeTitulo } from '@/lib/marketplace/slug';

export const dynamic = 'force-dynamic';

/**
 * `/marketplace-publico/gestion-de-reservas`: el catálogo con la pestaña y el
 * registro ya elegidos (Fernando, 2026-09-21). El slug es el del título, así que
 * aquí solo se busca el título que lo produce para el <title> y la vista previa
 * del enlace; quién se selecciona lo decide el catálogo con los mismos datos.
 */
async function registroDe(slug: string) {
  try {
    const [{ rows: portafolio }, { rows: proyectos }] = await Promise.all([
      pool.query(
        `SELECT title, description, item_type, COALESCE(images, '{}') AS images, image_url
           FROM gcc_world.member_portfolio_items WHERE item_type IN ('product', 'automation')`,
      ),
      pool.query(
        `SELECT title, description FROM gcc_world.projects
          WHERE is_marketplace_published = true AND status = 'completed'`,
      ),
    ]);
    const casa = (r: { title: string }) => slugDeTitulo(r.title) === slug;
    return portafolio.find(casa) ?? proyectos.find(casa) ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const r = await registroDe(slug);
  if (!r) return { title: 'Marketplace · GCC World' };
  const imagen = r.images?.[0] || r.image_url || undefined;
  const descripcion = (r.description || '').slice(0, 200) || undefined;
  return {
    title: `${r.title} · Marketplace GCC World`,
    description: descripcion,
    openGraph: { title: r.title, description: descripcion, images: imagen ? [imagen] : undefined },
  };
}

export default async function PaginaRegistroMarketplace({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <MarketplacePublico slugInicial={slug} />;
}

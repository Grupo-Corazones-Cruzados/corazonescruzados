import { pool } from '@/lib/db';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PublicDocsView from './PublicDocsView';

interface Section {
  imageIndex: number;
  title: { es: string; en: string };
  narrative: { es: string; en: string };
}

interface PublicDocs {
  hero: {
    title: { es: string; en: string };
    subtitle: { es: string; en: string };
  };
  sections: Section[];
}

interface DocsRow {
  public_docs: PublicDocs;
  images: string[];
  published_at: string | null;
}

async function loadDocs(token: string): Promise<DocsRow | null> {
  if (!token || token.length < 16) return null;
  try {
    await pool.query(`
      ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS public_docs JSONB;
      ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS public_docs_token VARCHAR(64);
      ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS public_docs_published_at TIMESTAMPTZ;
    `);
    const { rows: [row] } = await pool.query(
      `SELECT public_docs, public_docs_published_at,
              COALESCE(images, '{}') as images
       FROM gcc_world.projects
       WHERE public_docs_token = $1 AND public_docs IS NOT NULL
       LIMIT 1`,
      [token]
    );
    if (!row) return null;
    return {
      public_docs: row.public_docs,
      images: row.images || [],
      published_at: row.public_docs_published_at,
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const row = await loadDocs(token);
  if (!row) return { title: 'Documentacion no encontrada - GCC WORLD' };
  const hero = row.public_docs.hero;
  const title = `${hero.title.es} — GCC WORLD`;
  const description = hero.subtitle.es;
  return {
    title,
    description,
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      type: 'article',
      images: row.images.slice(0, 1).map((url) => ({ url })),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: row.images.slice(0, 1),
    },
    alternates: {
      languages: { es: `?lang=es`, en: `?lang=en` },
    },
  };
}

export default async function PublicDocsPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { token } = await params;
  const { lang: langParam } = await searchParams;
  const row = await loadDocs(token);

  if (!row) {
    notFound();
  }

  const initialLang: 'es' | 'en' = langParam === 'en' ? 'en' : 'es';

  return (
    <PublicDocsView
      docs={row.public_docs}
      images={row.images}
      publishedAt={row.published_at}
      initialLang={initialLang}
      token={token}
    />
  );
}

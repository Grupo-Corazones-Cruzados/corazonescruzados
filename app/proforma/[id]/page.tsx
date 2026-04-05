'use client';

import { useEffect, useState, use } from 'react';
import { useSearchParams } from 'next/navigation';

export default function PublicProformaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError('Token de acceso requerido');
      setLoading(false);
      return;
    }

    fetch(`/api/projects/${id}/proforma/public?token=${encodeURIComponent(token)}`)
      .then(async res => {
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Error al cargar el documento');
        } else {
          setHtml(data.html);
        }
      })
      .catch(() => setError('Error de conexion'))
      .finally(() => setLoading(false));
  }, [id, token]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', background: '#f5f5f7' }}>
        <p style={{ color: '#86868b' }}>Cargando...</p>
      </div>
    );
  }

  if (error || !html) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', background: '#f5f5f7', padding: '20px' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <h1 style={{ color: '#1d1d1f', fontSize: '24px', marginBottom: '12px' }}>Acceso denegado</h1>
          <p style={{ color: '#86868b', fontSize: '14px' }}>{error || 'No se pudo cargar el documento'}</p>
        </div>
      </div>
    );
  }

  return <iframe srcDoc={html} style={{ width: '100%', height: '100vh', border: 'none' }} title="Proforma" />;
}

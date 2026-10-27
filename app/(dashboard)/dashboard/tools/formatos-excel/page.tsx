'use client';

import PageHeader from '@/components/ui/PageHeader';
import FormatosExcel from '@/components/herramientas/FormatosExcel';

/** Herramientas → Edición → «Formatos de impresión para Excel», a página completa. */
export default function FormatosExcelPage() {
  return (
    <div>
      <PageHeader title="Formatos de impresión para Excel" description="Corrige la impresión de un libro y descárgalo en Excel o PDF" />
      <FormatosExcel />
    </div>
  );
}

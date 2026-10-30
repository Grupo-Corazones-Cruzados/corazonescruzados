/**
 * Las facturas de un ticket, por cualquiera de sus tres enlaces: directo (`ticket_id`), por el
 * origen del cobro (`source_type='ticket'`) o por la etapa que cubren. Lo comparten la página
 * pública del ticket y la descarga de su RIDE, para que las dos vean las mismas. `$1` = id.
 */
export const TICKET_SQL_FACTURAS = `
  SELECT i.id, i.invoice_number, i.total, i.created_at AS issue_date, i.sri_status,
         (i.pdf_data IS NOT NULL OR i.authorization_number IS NOT NULL) AS has_pdf,
         (SELECT e.name FROM gcc_world.project_stages e WHERE e.invoice_id = i.id LIMIT 1) AS stage_name
    FROM gcc_world.invoices i
   WHERE i.status <> 'cancelled'
     AND (i.ticket_id = ($1)::bigint
          OR (i.source_type = 'ticket' AND i.source_id = ($1)::text)
          OR i.id IN (SELECT e.invoice_id FROM gcc_world.project_stages e WHERE e.ticket_id = ($1)::bigint))`;

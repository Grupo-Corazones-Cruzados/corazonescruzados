// components/email-template.tsx
import * as React from 'react';

interface EmailTemplateProps {
  nombreCliente: string;
  detalleTicket: string;
}

export function EmailTemplate({ nombreCliente, detalleTicket }: EmailTemplateProps) {
  return (
    <div>
      <h1>Hola {nombreCliente}</h1>
      <p>Tu ticket ha sido registrado correctamente:</p>
      <p>{detalleTicket}</p>
    </div>
  );
}
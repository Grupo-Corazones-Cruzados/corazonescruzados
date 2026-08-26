/**
 * LAS CUENTAS BANCARIAS A LAS QUE SE TRANSFIERE — módulo PURO, sin base de datos.
 *
 * Son las cuentas del titular del negocio (Luis Fernando González Muyulema) y **no dependen
 * de quién cobre**: da igual el proyecto, el ticket, la suscripción o el miembro
 * responsable. Fernando lo dijo así el 2026-08-26: *«las cuentas bancarias para pagar deben
 * ser siempre las mismas, no dependen de un usuario»*.
 *
 * ⚠️ ESTÁN EN CÓDIGO Y NO EN LA BASE, A PROPÓSITO.
 *
 * Un número de cuenta editable desde el panel es la vía más corta para que quien entre a una
 * sesión de administrador **redirija todos los cobros a su propia cuenta**: sin tocar código,
 * sin desplegar y sin dejar rastro en git. Aquí, cambiarlo exige un despliegue y queda
 * firmado en el historial con nombre y fecha. La comodidad de editarlo desde una pantalla no
 * compensa lo que abre.
 *
 * Si algún día hacen falta cuentas por inquilino o por miembro, eso **sí** es un dato de
 * negocio y entonces irá a la base — pero con su propio control de quién puede tocarlo.
 */

export type CuentaBancaria = {
  /** Identificador estable; se guarda en `payment_intents.proof_bank`. */
  id: string;
  banco: string;
  tipo: string;
  numero: string;
  titular: string;
  identificacion: string;
  correo: string;
  /** Solo para transferencias desde el exterior. */
  swift?: string;
};

export const CUENTAS_BANCARIAS: CuentaBancaria[] = [
  {
    id: 'pichincha',
    banco: 'Banco Pichincha',
    tipo: 'Cuenta de ahorro',
    numero: '2211587576',
    titular: 'Luis Fernando González Muyulema',
    identificacion: '0930095922',
    correo: 'lfgonzalezm0@outlook.com',
  },
  {
    id: 'guayaquil',
    banco: 'Banco Guayaquil',
    tipo: 'Cuenta de ahorro',
    numero: '0039785956',
    titular: 'Luis Fernando González Muyulema',
    identificacion: '0930095922',
    correo: 'lfgonzalezm0@outlook.com',
    // El SWIFT solo hace falta si la transferencia viene de fuera de Ecuador — y GCC tiene
    // clientes así, que son los mismos a los que la Cajita no les valía el documento.
    swift: 'GUAYECEG',
  },
];

export function cuentaPorId(id: string): CuentaBancaria | null {
  return CUENTAS_BANCARIAS.find(c => c.id === id) || null;
}

/**
 * La transferencia NO lleva recargo, y no es un olvido.
 *
 * El recargo existe para trasladarle al cliente lo que cobra la pasarela; en una
 * transferencia no hay pasarela y no cobra nadie, así que no hay nada que trasladar. Cobrar
 * un recargo aquí sería inventarse un cargo.
 *
 * Efecto secundario que conviene conocer: al cliente le sale **más barato transferir**
 * (5,00 $ frente a 5,31 $), y a GCC le llega lo mismo. La pantalla enseña los dos importes
 * juntos, así que el método más barato para los dos se elige solo.
 */
export const TARIFA_TRANSFERENCIA = { porcentaje: 0, fijo: 0 } as const;

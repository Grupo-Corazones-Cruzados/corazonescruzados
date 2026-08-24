/**
 * LA PURGA DE FIN DE MES.
 *
 * El plan de $5 conserva el histórico **un mes**. La limpieza corre en la última
 * hora del último día del mes, en la hora del negocio, y borra lo que TERMINÓ antes
 * del mes que acaba.
 *
 * ⚠️ POR QUÉ SE MIRA CUÁNDO TERMINÓ Y NO CUÁNDO SE CREÓ. Fue la decisión de
 * Fernando tras ver el caso: una reserva anotada el 20 de agosto para el 10 de
 * octubre se borraría el 30 de septiembre, y el negocio perdería una reserva viva
 * sin enterarse. Se purga por la fecha en la que el registro **dejó de estar
 * vivo** —la salida de una estancia, el cierre de un pedido—; lo que aún no ha
 * terminado no se toca.
 */

type Partes = { anio: number; mes: number; dia: number; hora: number };

/** La fecha y la hora AHORA en la zona del negocio, en piezas. */
export function ahoraEnZona(zonaHoraria: string, ahora = new Date()): Partes {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: zonaHoraria,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(ahora);
  const v = (t: string) => Number(f.find((p) => p.type === t)!.value);
  // Ojo: a medianoche, `hour` en formato 24h puede venir como 24 en algunas
  // implementaciones. Se normaliza.
  return { anio: v('year'), mes: v('month'), dia: v('day'), hora: v('hour') % 24 };
}

export const diasDelMes = (anio: number, mes: number) => new Date(Date.UTC(anio, mes, 0)).getUTCDate();

/** ¿Estamos en la última hora del último día del mes, para este negocio? */
export function esLaUltimaHoraDelMes(zonaHoraria: string, ahora = new Date()) {
  const p = ahoraEnZona(zonaHoraria, ahora);
  return p.dia === diasDelMes(p.anio, p.mes) && p.hora === 23;
}

/**
 * La fecha de corte: se borra todo lo que terminó ANTES de este día.
 * Con `meses = 1` es el día 1 del mes en curso, así que el negocio conserva el mes
 * que acaba de terminar y nada más.
 */
export function calcularCorte(zonaHoraria: string, meses: number, ahora = new Date()) {
  const p = ahoraEnZona(zonaHoraria, ahora);
  // Mes en curso, retrocediendo (meses - 1) meses. Date normaliza el año solo.
  return new Date(Date.UTC(p.anio, p.mes - 1 - (meses - 1), 1));
}

/**
 * LAS PIEZAS DEL DIAGRAMA DE FLUJO. Una sola lista para quien valida (el servicio) y quien pinta (la web):
 * si un tipo existe aquí y no tiene dibujo, TypeScript lo señala en `components/espacio/flujo/Lienzo.tsx`.
 */
export const TIPOS_NODO = {
  inicio: { nombre: 'Inicio', uso: 'Donde un rol entra a este flujo.' },
  accion: { nombre: 'Acción', uso: 'Lo que hace una persona.' },
  proceso: { nombre: 'Proceso', uso: 'Lo que hace el sistema solo.' },
  decision: { nombre: 'Decisión', uso: 'Una condición con varias salidas.' },
  bucle: { nombre: 'Bucle', uso: 'Lo que se repite por cada elemento o hasta cumplir algo.' },
  dato: { nombre: 'Dato', uso: 'Una variable o estado que cambia.' },
  integracion: { nombre: 'Integración', uso: 'Un servicio externo.' },
  fin: { nombre: 'Fin', uso: 'Donde termina el recorrido.' },
};

export const CLASES_CONEXION = {
  normal: { nombre: 'Sigue' },
  si: { nombre: 'Sí' },
  no: { nombre: 'No' },
  repite: { nombre: 'Repite' },
  error: { nombre: 'Error' },
};

export const LARGO = { titulo: 70, tituloDecision: 50, descripcion: 280, resumen: 400, etiqueta: 40, rol: 40, nodos: 400 };

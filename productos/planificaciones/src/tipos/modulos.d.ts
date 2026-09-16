// pdf-parse 1.x no trae tipos para su módulo interno (que es el que se importa
// para esquivar la lectura de un PDF de prueba al cargar el índice).
declare module 'pdf-parse/lib/pdf-parse.js' {
  const pdf: (datos: Buffer, opciones?: Record<string, unknown>) => Promise<{ text: string; numpages: number }>;
  export default pdf;
}

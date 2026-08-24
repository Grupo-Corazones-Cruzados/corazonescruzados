import { v2 as cloudinary } from 'cloudinary';

/**
 * Las imágenes (logo de marca, fotos de ubicaciones y suites) NO viven en la base
 * de datos: se guardan en Cloudinary y de la fila solo cuelga su dirección.
 *
 * El motivo está medido en el proyecto de referencia: Railway factura el Postgres
 * por RAM retenida, y una base que engorda con binarios se paga todos los meses.
 * Con las fotos fuera, sumar reservas no mueve el coste.
 */
export const hayCloudinary = Boolean(process.env.CLOUDINARY_URL);

if (hayCloudinary) cloudinary.config({ secure: true });

export type ResultadoSubida = { ok: true; url: string } | { ok: false; error: string };

const MAXIMO = 5 * 1024 * 1024; // 5 MB
const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

export async function subirImagen(archivo: File, carpeta: string): Promise<ResultadoSubida> {
  if (!hayCloudinary)
    return {
      ok: false,
      error: 'Todavía no hay almacenamiento de imágenes configurado. Pega la dirección de una imagen.',
    };
  if (!TIPOS.includes(archivo.type))
    return { ok: false, error: 'El archivo tiene que ser JPG, PNG, WEBP o SVG.' };
  if (archivo.size > MAXIMO) return { ok: false, error: 'La imagen no puede pasar de 5 MB.' };

  const datos = Buffer.from(await archivo.arrayBuffer());
  const uri = `data:${archivo.type};base64,${datos.toString('base64')}`;

  try {
    const r = await cloudinary.uploader.upload(uri, {
      folder: `gcc-reservas/${carpeta}`,
      resource_type: 'image',
      overwrite: false,
    });
    return { ok: true, url: r.secure_url };
  } catch {
    return { ok: false, error: 'No se pudo subir la imagen. Inténtalo de nuevo.' };
  }
}

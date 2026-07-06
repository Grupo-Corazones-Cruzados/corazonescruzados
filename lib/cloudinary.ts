import { v2 as cloudinary } from 'cloudinary';

/**
 * Integración con Cloudinary. Las imágenes ANTES se guardaban como base64 en la BD
 * (`projects.images`, `member_portfolio_items.images`, avatares…); ahora se suben a
 * Cloudinary y se guarda la URL. El servido redimensionado usa transformaciones de
 * Cloudinary (`w_<n>,f_auto,q_auto`).
 *
 * Config por env: una sola `CLOUDINARY_URL=cloudinary://key:secret@cloud`, o bien
 * CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET. Si no está
 * configurado, las rutas de subida hacen fallback a guardar el base64 (para no
 * romper en entornos sin credenciales).
 */
if (process.env.CLOUDINARY_URL) {
  // El SDK lee CLOUDINARY_URL automáticamente; solo forzamos https.
  cloudinary.config({ secure: true });
} else {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export function cloudinaryConfigured(): boolean {
  if (process.env.CLOUDINARY_URL) return true;
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

/** ¿El valor es un data URL base64 (imagen embebida)? */
export function isBase64Image(v: string): boolean {
  return typeof v === 'string' && v.startsWith('data:');
}

/** ¿El valor es una URL de Cloudinary? */
export function isCloudinaryUrl(v: string): boolean {
  return typeof v === 'string' && /res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(v);
}

/**
 * Devuelve la URL de Cloudinary con una transformación de ancho (WebP/AVIF auto,
 * calidad auto). Si no es una URL de Cloudinary, la devuelve intacta.
 */
export function cloudinaryResized(url: string, width: number): string {
  if (!isCloudinaryUrl(url)) return url;
  // Evita duplicar transformaciones si ya se insertó una antes.
  return url.replace(/\/image\/upload\/(?:[^/]*\/)?/, `/image/upload/w_${width},f_auto,q_auto,c_limit/`);
}

/**
 * Sube una imagen (data URL base64 o URL remota) a Cloudinary y devuelve la
 * `secure_url`. Si ya es una URL de Cloudinary, la devuelve sin re-subir.
 */
export async function uploadImage(source: string, folder: string): Promise<string> {
  if (isCloudinaryUrl(source)) return source;
  const res = await cloudinary.uploader.upload(source, {
    folder,
    resource_type: 'image',
    overwrite: false,
  });
  return res.secure_url;
}

/**
 * Sube en paralelo un array de imágenes (base64 → Cloudinary); las que ya sean URL
 * se dejan igual. Si Cloudinary no está configurado, devuelve el array tal cual
 * (fallback base64). Las subidas que fallen conservan el valor original.
 */
export async function uploadImages(images: string[], folder: string): Promise<string[]> {
  if (!cloudinaryConfigured()) return images;
  return Promise.all(
    images.map(async (img) => {
      if (!isBase64Image(img)) return img;
      try {
        return await uploadImage(img, folder);
      } catch {
        return img; // si falla, no perdemos la imagen
      }
    }),
  );
}

export { cloudinary };

// Loads a tileset PNG and strips near-white pixels (the typical
// background of LPC-style sheets) so painted tiles don't bleed white
// over the layers below them.
//
// `threshold` defaults to 250 → any pixel with R, G and B all ≥ 250
// becomes fully transparent. Pure white is the worst offender; this
// cutoff keeps deliberate near-white pixels (interior walls, paper,
// etc.) intact.
//
// If the source image fails to load, the function still resolves
// with the original (so callers can `await` without a try/catch).
export function loadChromaKeyedSheet(
  url: string,
  threshold = 250,
): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const src = new Image();
    src.crossOrigin = 'anonymous';
    src.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = src.naturalWidth;
        canvas.height = src.naturalHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(src);
          return;
        }
        ctx.drawImage(src, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const px = data.data;
        for (let i = 0; i < px.length; i += 4) {
          if (
            px[i] >= threshold &&
            px[i + 1] >= threshold &&
            px[i + 2] >= threshold
          ) {
            px[i + 3] = 0;
          }
        }
        ctx.putImageData(data, 0, 0);
        const out = new Image();
        out.onload = () => resolve(out);
        out.onerror = () => resolve(src);
        out.src = canvas.toDataURL('image/png');
      } catch {
        resolve(src);
      }
    };
    src.onerror = () => resolve(src);
    src.src = url;
  });
}

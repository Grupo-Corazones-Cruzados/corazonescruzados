const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname, 'certificates', 'localhost+1-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'certificates', 'localhost+1.pem')),
};

app.prepare().then(() => {
  createServer(httpsOptions, (req, res) => {
    const parsedUrl = parse(req.url, true);

    // Los archivos del juego (Godot) deben REVALIDARSE en cada carga. Sin esto,
    // Safari en el móvil cachea el .wasm/.pck y sigue mostrando el mundo viejo
    // aunque se haya reexportado. `no-cache` no significa "no guardar": el
    // navegador guarda pero pregunta al servidor si cambió (vía ETag) antes de
    // usarlo. El .wasm de 38 MB casi nunca cambia → responde 304 y va rápido;
    // el .pck pequeño se rebaja solo cuando se edita un mundo.
    if (parsedUrl.pathname && parsedUrl.pathname.startsWith('/game/')) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    }

    handle(req, res, parsedUrl);
  }).listen(3002, '0.0.0.0', () => {
    console.log('> HTTPS server ready on https://localhost:3002');
    // La IP se calcula en vez de estar fija: cambia al reconectar a la red, y
    // una IP obsoleta aquí manda a probar a una dirección que ya no existe.
    const nets = require('os').networkInterfaces();
    for (const iface of Object.values(nets).flat()) {
      if (iface && iface.family === 'IPv4' && !iface.internal) {
        console.log(`> Acceso desde el móvil: https://${iface.address}:3002`);
      }
    }
    console.log('> Godot necesita HTTPS (contexto seguro); por HTTP plano no arranca.');
  });
});

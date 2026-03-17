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
    handle(req, res, parsedUrl);
  }).listen(3002, '0.0.0.0', () => {
    console.log('> HTTPS server ready on https://localhost:3002');
    console.log('> iPhone access: https://192.168.100.13:3002');
  });
});

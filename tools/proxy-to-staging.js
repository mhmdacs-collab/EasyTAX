const http = require('http');
const https = require('https');
const TARGET = 'https://easytax-api-staging.onrender.com';
const PORT = 3000;

const server = http.createServer((req, res) => {
  const url = TARGET + req.url;
  const options = new URL(url);
  options.method = req.method;
  options.headers = Object.assign({}, req.headers);
  // Remove hop-by-hop headers per RFC
  delete options.headers['host'];

  const proxyReq = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Bad Gateway: ' + err.message);
  });

  req.pipe(proxyReq, { end: true });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Proxy listening on http://0.0.0.0:${PORT} -> ${TARGET}`);
});

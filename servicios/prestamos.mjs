import { createServer } from 'node:http';

const prestamos = [
  { id: 501, libroId: 1, lector: 'ana.perez@duocuc.cl',   vence: '2026-09-02', devuelto: false },
  { id: 502, libroId: 3, lector: 'luis.rojas@duocuc.cl',  vence: '2026-08-28', devuelto: false },
  { id: 503, libroId: 1, lector: 'sofia.mella@duocuc.cl', vence: '2026-08-15', devuelto: true  },
];

createServer((peticion, respuesta) => {
  console.log(`[prestamos] ${peticion.method} ${peticion.url}`);
  respuesta.writeHead(200, { 'Content-Type': 'application/json' });
  respuesta.end(JSON.stringify(prestamos));
}).listen(3002, () => console.log('microservicio de prestamos escuchando en http://localhost:3002'));

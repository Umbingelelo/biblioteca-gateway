import { createServer } from 'node:http';

const libros = [
  { id: 1, titulo: 'Cien años de soledad',     autor: 'Gabriel García Márquez', anio: 1967, copias: 4 },
  { id: 2, titulo: 'La casa de los espíritus', autor: 'Isabel Allende',         anio: 1982, copias: 2 },
  { id: 3, titulo: 'Ficciones',                autor: 'Jorge Luis Borges',      anio: 1944, copias: 3 },
];

createServer((peticion, respuesta) => {
  console.log(`[libros] ${peticion.method} ${peticion.url}`);
  respuesta.writeHead(200, { 'Content-Type': 'application/json' });
  respuesta.end(JSON.stringify(libros));
}).listen(3001, () => console.log('microservicio de libros escuchando en http://localhost:3001'));

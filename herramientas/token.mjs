import { createHmac } from 'node:crypto';

// Un JWT son tres partes separadas por puntos. Las dos primeras son
// JSON en base64url: NO están cifradas, cualquiera las puede leer.
const aBase64url = (objeto) => Buffer.from(JSON.stringify(objeto)).toString('base64url');

const header = aBase64url({ alg: 'HS256', typ: 'JWT', kid: 'demo' });

const payload = aBase64url({
  sub: 'ana.perez@duocuc.cl',
  name: 'Ana Pérez',
  roles: ['lector'],
  iss: 'https://login.microsoftonline.com/duoc/v2.0',
  aud: 'api://biblioteca',
  exp: Math.floor(Date.now() / 1000) + 3600,
});

// La tercera parte es la firma. En L3 la va a verificar el gateway.
const firma = createHmac('sha256', 'clave-de-prueba')
  .update(`${header}.${payload}`)
  .digest('base64url');

console.log(`${header}.${payload}.${firma}`);

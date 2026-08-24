/**
 * El recorrido completo, con los tres procesos de verdad.
 *
 *   node probar.mjs
 *
 * Levanta `libros.mjs`, `prestamos.mjs` y el gateway, les habla por HTTP como lo
 * haría `curl`, y los baja al terminar. No necesita nada instalado aparte de las
 * dependencias del gateway (`npm install` dentro de `gateway/`).
 *
 * ── Para qué sirve, si ya hay pruebas unitarias ──
 *
 * Las de `gateway/src/*.spec.ts` prueban cada controller con el `fetch` simulado:
 * son rápidas y no levantan nada. Lo que **no** pueden ver es justamente lo que
 * más se rompe al empezar:
 *
 *   - que el controller esté declarado en `app.module.ts`. Sin eso la ruta
 *     responde 404 y el archivo del controller está perfecto.
 *   - que los microservicios estén corriendo y en el puerto que se cree.
 *   - que el gateway esté en el 8080, que es lo que piden los laboratorios que
 *     vienen.
 *
 * Las tres fallan igual con las unitarias en verde.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = dirname(fileURLToPath(import.meta.url));
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

if (!existsSync(join(RAIZ, 'gateway', 'node_modules'))) {
  console.error('Falta instalar las dependencias del gateway:\n');
  console.error('  cd gateway');
  console.error('  npm install\n');
  process.exit(2);
}

let fallos = 0;
const rev = (etiqueta, real, esperado) => {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (!ok) fallos++;
  console.log(`  ${ok ? '✓' : '✗'} ${etiqueta}: ${JSON.stringify(real)}` +
    (ok ? '' : ` ← esperaba ${JSON.stringify(esperado)}`));
};

// ============================== Levantar los tres ==============================

const procesos = [];
const arrancar = (etiqueta, comando, args, cwd) => {
  const p = spawn(comando, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  p.salida = '';
  p.stdout.on('data', (d) => { p.salida += d; });
  p.stderr.on('data', (d) => { p.salida += d; });
  p.on('error', (e) => { console.error(`no pude arrancar ${etiqueta}: ${e.message}`); });
  procesos.push({ etiqueta, p });
  return p;
};

const bajarTodo = () => {
  for (const { p } of procesos) { try { p.kill('SIGTERM'); } catch { /* ya estaba muerto */ } }
};
process.on('exit', bajarTodo);
process.on('SIGINT', () => { bajarTodo(); process.exit(130); });

/**
 * Espera a que una dirección conteste.
 *
 * Con reintentos y no con un `sleep` fijo: el gateway compila TypeScript antes de
 * escuchar y eso tarda distinto en cada computador. Un `sleep` calibrado en el
 * mío fallaría en el de la sala.
 */
const esperar = async (url, segundos = 90) => {
  const limite = Date.now() + segundos * 1000;
  while (Date.now() < limite) {
    try {
      const r = await fetch(url);
      if (r.status) return true;
    } catch { /* todavía no escucha */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
};

console.log('Levantando los tres procesos');
const libros = arrancar('libros', process.execPath, ['servicios/libros.mjs'], RAIZ);
const prestamos = arrancar('prestamos', process.execPath, ['servicios/prestamos.mjs'], RAIZ);
const gateway = arrancar('gateway', NPM, ['run', 'start'], join(RAIZ, 'gateway'));

for (const [etiqueta, url, proc] of [
  ['libros en el 3001', 'http://localhost:3001/libros', libros],
  ['prestamos en el 3002', 'http://localhost:3002/prestamos', prestamos],
  ['gateway en el 8080', 'http://localhost:8080/v1/libros', gateway],
]) {
  const vivo = await esperar(url);
  rev(etiqueta, vivo, true);
  if (!vivo) {
    console.error(`\nLo que alcanzó a decir ${proc === gateway ? 'el gateway' : 'el servicio'}:\n`);
    console.error(proc.salida.split('\n').slice(-25).join('\n'));
    process.exit(1);
  }
}

// ============================== Los microservicios, directo ==============================

console.log('\nLos microservicios de atrás');
{
  const r = await fetch('http://localhost:3001/libros');
  const cuerpo = await r.json();
  rev('libros responde 200', r.status, 200);
  rev('con los tres libros', cuerpo.length, 3);
  rev('y el primero es el que corresponde', cuerpo[0].titulo, 'Cien años de soledad');
}
{
  const r = await fetch('http://localhost:3002/prestamos');
  const cuerpo = await r.json();
  rev('prestamos responde 200', r.status, 200);
  rev('con los tres préstamos', cuerpo.length, 3);
  rev('y traen los campos del dominio', Object.keys(cuerpo[0]).sort(),
    ['devuelto', 'id', 'lector', 'libroId', 'vence']);
}

// Y de paso, la última pregunta de L1: la puerta se puede rodear. Que esto
// responda 200 sin token **no es un fallo de la prueba**, es el hallazgo del
// laboratorio, y se arregla con la red interna de Docker más adelante.
console.log('  · ojo: los dos contestaron sin token, porque están abiertos. Es el 2.6 de L1.');

// ============================== La puerta ==============================

console.log('\nEl gateway como puerta');
for (const ruta of ['libros', 'prestamos']) {
  const r = await fetch(`http://localhost:8080/v1/${ruta}`);
  const cuerpo = await r.json();
  rev(`/v1/${ruta} sin header devuelve 401`, r.status, 401);
  rev(`   y dice qué falta`, cuerpo.message, 'falta el header Authorization');
}

// ============================== El enrutamiento ==============================
// Lo que se caza acá es el error traicionero de L1 1.5: dejar el 3001 en el
// `fetch` de préstamos responde 200 con datos válidos, pero del otro dominio.

console.log('\nEl enrutamiento, con token');
const CABECERA = { Authorization: 'Bearer holaquetal' };
{
  const r = await fetch('http://localhost:8080/v1/libros', { headers: CABECERA });
  const cuerpo = await r.json();
  rev('/v1/libros devuelve 200', r.status, 200);
  rev('   y son libros, no préstamos', cuerpo.map((x) => x.titulo).length, 3);
  rev('   con autor y año', [Boolean(cuerpo[0].autor), Boolean(cuerpo[0].anio)], [true, true]);
}
{
  const r = await fetch('http://localhost:8080/v1/prestamos', { headers: CABECERA });
  const cuerpo = await r.json();
  rev('/v1/prestamos devuelve 200', r.status, 200);
  rev('   y son préstamos, no libros', Boolean(cuerpo[0].lector && cuerpo[0].vence), true);
  rev('   el fetch NO quedó apuntando al 3001', cuerpo[0].titulo, undefined);
}
{
  const r = await fetch('http://localhost:8080/v1/inventado', { headers: CABECERA });
  rev('una ruta que no existe da 404', r.status, 404);
}

// ============================== CORS ==============================
// La lección del 2.4: el gateway responde **lo mismo** a cualquier origen. Quien
// bloquea es el navegador. Por eso las dos respuestas de abajo son idénticas.

console.log('\nCORS');
const preflight = async (origen) => {
  const r = await fetch('http://localhost:8080/v1/libros', {
    method: 'OPTIONS',
    headers: { Origin: origen, 'Access-Control-Request-Method': 'GET' },
  });
  return r.headers.get('access-control-allow-origin');
};
rev('el preflight del 4200 queda permitido',
  await preflight('http://localhost:4200'), 'http://localhost:4200');
rev('y a otro origen le responde exactamente lo mismo',
  await preflight('http://sitio-cualquiera.cl'), 'http://localhost:4200');
console.log('  · el servidor no bloqueó nada en ninguno de los dos casos: eso es CORS.');

// ============================== El token de mentira ==============================

console.log('\nherramientas/token.mjs');
const generado = await new Promise((resolver) => {
  let texto = '';
  const p = spawn(process.execPath, ['herramientas/token.mjs'], { cwd: RAIZ });
  p.stdout.on('data', (d) => { texto += d; });
  p.on('close', () => resolver(texto.trim()));
});
const partes = generado.split('.');
rev('imprime un JWT de tres partes', partes.length, 3);
const carga = JSON.parse(Buffer.from(partes[1], 'base64url').toString());
rev('   y la carga se lee sin ninguna clave', Object.keys(carga).sort(),
  ['aud', 'exp', 'iss', 'name', 'roles', 'sub']);
rev('   con el vencimiento en el futuro', carga.exp > Math.floor(Date.now() / 1000), true);
rev('   y el gateway lo acepta igual que a «holaquetal»',
  (await fetch('http://localhost:8080/v1/libros',
    { headers: { Authorization: `Bearer ${generado}` } })).status, 200);
console.log('  · que acepte los dos es el problema que resuelven L2 y L3.');

// ============================== Fin ==============================

bajarTodo();
console.log(fallos === 0 ? '\nTodo bien.' : `\n${fallos} fallos.`);
process.exit(fallos === 0 ? 0 : 1);

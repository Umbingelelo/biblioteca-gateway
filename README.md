# biblioteca-gateway

El API Gateway de la biblioteca, en el estado en que queda al terminar **L1**.

Esto es el punto de partida de los laboratorios que siguen. Si el PC de la sala se
restauró, si dejaste tu carpeta en otro equipo o si nunca te quedó andando: haz un
**fork** de este repositorio y sigue desde acá. No pierdes nada de L1 — L1 ya lo
entregaste y esto no lo reemplaza; es la base sobre la que se construye L3.

```
biblioteca-gateway/
├── servicios/              los dos microservicios de atrás
│   ├── libros.mjs              → escucha en el 3001
│   └── prestamos.mjs           → escucha en el 3002
├── gateway/                el proyecto NestJS
│   └── src/
│       ├── main.ts             → escucha en el 8080, con CORS
│       ├── app.module.ts       → declara los dos controllers
│       ├── libros.controller.ts     → /v1/libros  → 3001
│       └── prestamos.controller.ts  → /v1/prestamos → 3002
├── herramientas/
│   └── token.mjs           genera un JWT con la forma real, firmado por ti
├── capturas/               acá van tus .pcapng de Wireshark
├── docs/
│   └── https-y-wireshark.md el paso 2.5 de L1: TLS en el 8443 y las capturas
└── probar.mjs              levanta los tres y comprueba que todo responde
```

`servicios/` y `gateway/` están separados a propósito: son programas
independientes, y `gateway/` tiene su propio `package.json`. Mezclarlos en una
carpeta es la causa nº1 de errores raros de Node, porque busca su configuración
hacia arriba en el árbol y puede tomar la del vecino.

## Su mitad gemela

El frontend Angular vive en **[biblioteca-web](https://github.com/Umbingelelo/biblioteca-web)**, y
es otro repositorio a propósito: frontend y backend se despliegan por separado, se
versionan por separado y muchas veces los escriben equipos distintos.

**Para L3 necesitas los dos forkeados.** Este responde en el 8080; ese consume el 8080
desde el 4200, que es el origen que el `enableCors` de `main.ts` permite.

## Partir

Necesitas **Node 22 o superior** (`node -v`). Lo de L0.

```bash
git clone https://github.com/<tu-usuario>/biblioteca-gateway.git
cd biblioteca-gateway/gateway
npm install
```

`npm install` solo hace falta dentro de `gateway/`. Los microservicios y las
herramientas no tienen dependencias: son Node puro.

## Levantarlo

Son **tres procesos que se quedan corriendo**, así que necesitas tres terminales
—más una cuarta para los `curl`—. No es desorden: es cómo se trabaja con
microservicios. En VS Code, el botón **+** del panel de terminal abre otra.

| Terminal | Comando | En qué carpeta |
|---|---|---|
| 1 | `node servicios/libros.mjs` | la raíz |
| 2 | `node servicios/prestamos.mjs` | la raíz |
| 3 | `npm run start:dev` | `gateway/` |
| 4 | los `curl` | cualquiera |

**Qué tienes que ver:** las dos líneas `microservicio de … escuchando en
http://localhost:300…` y, en la tercera, `gateway escuchando en
http://localhost:8080`. El cursor no vuelve en ninguna: los programas están
vivos, esperando.

Es `start:dev` y no `start` a propósito: el `:dev` deja Nest vigilando los
archivos y recompilando en cada guardado. Con `start` editarías el código y el
servidor seguiría respondiendo lo de antes, que es el tipo de detalle que hace
perder veinte minutos buscando un error que no existe.

## Probarlo

Desde la terminal 4. **En Windows usa `curl.exe`, con el `.exe`** — `curl` a
secas es un alias de `Invoke-WebRequest`, que acepta otros parámetros y da
errores confusos con `-H` y `-i`.

```bash
curl -i http://localhost:8080/v1/libros
# → 401, «falta el header Authorization»

curl -i -H "Authorization: Bearer holaquetal" http://localhost:8080/v1/libros
# → 200 y los tres libros

curl -i -H "Authorization: Bearer holaquetal" http://localhost:8080/v1/prestamos
# → 200 y los tres préstamos
```

Y mira las terminales 1 y 2: apareció una línea en cada una. Eso es el gateway
yendo a buscar la respuesta al microservicio. **El cliente nunca supo que existe
el puerto 3001.**

### Las dos pruebas automáticas

```bash
node probar.mjs            # desde la raíz: levanta los tres y comprueba todo
cd gateway && npm test     # las unitarias de los controllers
```

`probar.mjs` no necesita nada instalado aparte de las dependencias del gateway.
Levanta los tres procesos, les habla por HTTP y los baja al terminar. Comprueba lo
que las unitarias no pueden ver: que los controllers estén declarados en
`app.module.ts` —sin eso la ruta da 404 y el archivo está perfecto—, que cada
`fetch` apunte al puerto correcto, y que el gateway esté en el 8080.

Ese del puerto es el error que vale la pena tener cazado: dejar el 3001 en el
`fetch` de préstamos **no da ningún error**. Responde 200, con datos válidos, del
dominio equivocado.

## Lo que este gateway hace, y lo que todavía no

Hace tres cosas, que son las tres responsabilidades de un gateway:

- **Enruta.** El cliente pide al 8080 y el gateway va a buscar la respuesta al
  3001 o al 3002. El `v1` de la ruta es versionado: el día que cambies el formato
  de la respuesta, eso es `v2` y quien usaba `v1` sigue funcionando.
- **Es la puerta.** Sin header `Authorization` responde **401**. Ojo con la
  diferencia: 401 es «no sé quién eres», que es este caso; 403 sería «sé quién
  eres y no te alcanza».
- **Aplica CORS.** Permite el origen `http://localhost:4200`, que es donde va a
  vivir el frontend Angular.

Y hay tres cosas que **no** hace, cada una con su laboratorio:

| Lo que falta | Dónde se arregla |
|---|---|
| El token no se verifica: `Bearer holaquetal` pasa igual que un JWT | **L3**, donde el token lo emite Amazon Cognito de verdad, y el gateway empieza a comprobar `iss`, `token_use`, `client_id`, `exp` y los scopes |
| La firma —la tercera parte del token— no se mira nunca | **L3 también**, contra el JWKS del emisor. Ojo con lo que no vas a encontrar en un access token de Cognito: no hay `aud`. Está explicado en el tramo 6.6 de L3 |
| No hay autorización, solo autenticación | **L3**, con `scope` y `cognito:groups`: 401 es «no sé quién eres», 403 es «sé quién eres y no te alcanza» |
| Los microservicios responden a quien los llame directo al 3001 | Con Docker y una red interna, donde el único que los alcanza es el gateway |

Ese último pruébalo ahora, que es de un comando:

```bash
curl http://localhost:3001/libros
```

Sin token, sin pasar por el gateway, y responde. **Un gateway no protege lo que
se puede rodear.**

## Si algo te falló

| Lo que te devuelve | Qué pasó |
|---|---|
| `{"message":"Cannot GET /v1/prestamos",…,"statusCode":404}` | El controller no está declarado en `app.module.ts`. En Nest, existir no basta |
| Te devuelve **libros** en `/v1/prestamos`, con **200** | El `fetch` quedó apuntando al 3001. El más traicionero: no da error, responde lo equivocado |
| `{"statusCode":500,"message":"Internal server error"}` | El microservicio de atrás no está corriendo. En la terminal 3 vas a ver `ECONNREFUSED` |
| `EADDRINUSE: address already in use` | Quedó una copia anterior corriendo. Búscala en tus otras terminales y `Ctrl+C`. Si no la encuentras: `netstat -ano \| findstr :8080` y `taskkill /PID <n> /F` en Windows; `lsof -ti:8080 \| xargs kill -9` en macOS y Linux |
| `curl` da errores raros con `-H` o `-i` | Estás en PowerShell sin el `.exe`. Usa `curl.exe` |

Y antes de irte de la sala, **corta los procesos** con `Ctrl+C` en cada terminal.
Si dejas los puertos ocupados, el próximo que se siente ahí va a pelear con
`EADDRINUSE` sin entender por qué.

## Sobre las versiones

`gateway/package.json` fija las dependencias **exactas**, sin `^`, y el
`package-lock.json` está versionado. No es pedantería: con treinta forks del mismo
repositorio, un `^11.0.1` que un mes después resuelve a otra versión menor
convierte «en mi computador funciona» en un problema que no se puede ayudar a
distancia. El `package.json` fija lo que pedimos; el lock fija además todo lo que
esas dependencias arrastran, que es la mitad del árbol.

Por eso, si quieres el mismo árbol exacto que se probó:

```bash
cd gateway
npm ci        # instala **desde el lock**, sin recalcular nada
```

`npm install` también funciona y es lo que dice el resto de esta guía; la
diferencia es que `npm ci` borra `node_modules` y no toca el lock, así que es el
que conviene cuando algo «funcionaba ayer». Si quieres actualizar una dependencia,
hazlo a propósito y en un commit que lo diga.

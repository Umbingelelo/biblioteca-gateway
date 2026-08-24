# HTTPS y la captura de Wireshark

Este es el paso **2.5 de L1**, guardado aparte. Lo que hace es dejar el gateway
escuchando en `https://localhost:8443` con un certificado que te haces tú, para
poder mirar en Wireshark la diferencia entre un token que viaja legible y uno que
no.

**Está aparte y no en `main.ts` por una razón práctica:** los laboratorios que
siguen llaman a `http://localhost:8080`. L2 lo hace en el tramo 2 y en las cuatro
pruebas del tramo 9. Con el 8443 puesto, el primer `curl` de L2 falla y el
mensaje no dice que el problema es el puerto.

Así que: haz esto cuando quieras rehacer la captura, y **devuelve `main.ts` a
como estaba** antes de seguir con el laboratorio siguiente. `git checkout
gateway/src/main.ts` lo deja como estaba.

---

## 1. El certificado

**Windows: este es el único comando que va en Git Bash, no en PowerShell.**
`openssl` no viene con Windows pero sí viene dentro de Git. Clic derecho sobre la
carpeta `gateway` → **Git Bash Here**. Confírmalo con `openssl version` antes de
seguir.

**Parado en `gateway/`:**

```bash
mkdir cert
openssl req -x509 -newkey rsa:2048 -nodes -keyout cert/llave.pem -out cert/certificado.pem -days 365 -subj "/CN=localhost"
```

| Parte | Qué hace |
|---|---|
| `req -x509` | Genera un certificado **autofirmado**, en vez de una solicitud para que otro te lo firme |
| `-newkey rsa:2048` | Crea también una **clave nueva** RSA de 2048 bits |
| `-nodes` | *No DES*: **no le pone contraseña** a la clave. Con contraseña, el servidor te la pediría en cada arranque |
| `-keyout cert/llave.pem` | Dónde escribir la clave **privada** |
| `-out cert/certificado.pem` | Dónde escribir el **certificado** |
| `-days 365` | Cuánto vale. Después de un año, vencido |
| `-subj "/CN=localhost"` | Para qué nombre sirve. `CN` es *Common Name*: este certificado dice «soy localhost» |

Son dos archivos, y la diferencia entre ellos es la lección:

| Archivo | Qué es | ¿Se comparte? |
|---|---|---|
| `certificado.pem` | La clave **pública** más los datos de quién dice ser | **Sí.** Se lo mandas a todo el que se conecte |
| `llave.pem` | La clave **privada**. Es lo que demuestra que eres tú | **Nunca.** Si se filtra, se acabó |

> `cert/` ya está en el `.gitignore` de este repositorio, así que no tienes que
> acordarte. Pero acuérdate de por qué está: en un repositorio público, una clave
> privada subida no se arregla borrándola después — queda en el historial.

## 2. El `main.ts` con TLS

Reemplaza `gateway/src/main.ts` completo:

```ts
import { NestFactory } from '@nestjs/core';
import { readFileSync } from 'node:fs';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    httpsOptions: {
      key: readFileSync('./cert/llave.pem'),
      cert: readFileSync('./cert/certificado.pem'),
    },
  });
  app.enableCors({ origin: 'http://localhost:4200' });
  await app.listen(8443);
  console.log('gateway escuchando en https://localhost:8443');
}
void bootstrap();
```

**Por qué 8443 y no 8080:** por convención, 80 y 8080 son HTTP; 443 y 8443 son
HTTPS. Nada te obliga, pero cualquiera que lea tu configuración lo va a entender
de inmediato.

> `ENOENT: no such file or directory, open './cert/llave.pem'` significa que Nest
> no encuentra el certificado. La ruta `./cert/` es relativa a **la carpeta desde
> donde corriste `npm run start:dev`**, que tiene que ser `gateway/`.

## 3. Probarlo

Primero sin ninguna opción especial:

```bash
curl https://localhost:8443/v1/libros
```

Te va a fallar con `curl: (60) SSL certificate problem: self signed certificate`,
y **eso está bien: es la lección.** Tu certificado dice «soy localhost», pero
nadie en quien `curl` confíe lo respalda. Es la misma pantalla roja del navegador
cuando un sitio tiene el certificado mal emitido: el cifrado funciona, lo que
falla es la **identidad**.

Como el certificado es tuyo y sabes que lo es, `-k` le dice que lo acepte igual:

```bash
node ../herramientas/token.mjs          # copia el token que imprime
curl -k -H "Authorization: Bearer TU_TOKEN" https://localhost:8443/v1/libros
```

> `-k` significa «no verifiques el certificado», y solo se usa en desarrollo. Si
> algún día te encuentras poniéndolo para que algo funcione en producción, lo que
> estás apagando es justamente la parte que protege contra suplantación: el
> cifrado sigue, pero ya no sabes con quién hablas.

## 4. Las dos capturas

En Wireshark, doble clic en la interfaz de loopback —**Adapter for loopback
traffic capture** en Windows, **lo0** en macOS, **Loopback: lo** en Linux—.

| Filtro | Con qué | Qué se ve |
|---|---|---|
| `tcp.port == 8080` | El `main.ts` normal del repositorio | La petición completa en texto, y el token entero |
| `tcp.port == 8443` | El `main.ts` de este documento, con `-k` | Un montón de bytes sin sentido |

En los dos casos: clic derecho sobre un paquete → **Follow → TCP Stream**.

> Se filtra **por puerto** y no por `ip.addr == 127.0.0.1` por algo concreto: en
> la mayoría de los computadores `localhost` no resuelve a `127.0.0.1` sino a
> `::1`, que es el loopback de IPv6. Filtrando por dirección no verías nada y
> creerías que la captura falló.

Y en la captura del 8443, busca el primer paquete —`Client Hello`— y despliega
hasta **Server Name Indication**. Ahí sigue tu `localhost`, en claro. **TLS cifra
el contenido; no esconde la conversación:** quien capture tu tráfico sigue viendo
con qué servidor hablas, cuándo y cuánto transferiste. Lo que no puede es leer la
ruta, los headers ni el body.

---

**No corras Wireshark en la red de la sala capturando lo que no es tuyo.** En una
red con switch no vas a ver el tráfico de tus compañeros, y forzarlo requiere
técnicas que están prohibidas en el ramo y son delito en la mayoría de los casos.
Por eso todo esto captura **loopback**: tráfico que sale y entra a tu propio
computador.

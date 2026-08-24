import {
  Controller,
  Get,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * La ruta pública del catálogo.
 *
 * El `v1` de la ruta es versionado, no decoración: el día que `copias` pase a
 * ser un objeto con `total` y `disponibles`, eso es `v2` y quien usaba `v1`
 * sigue funcionando.
 *
 * Y fíjate en lo que el cliente nunca supo: que existe un puerto 3001.
 */
@Controller('v1/libros')
export class LibrosController {
  // El `Promise<unknown>` de abajo es lo único que no está tal cual en la guía de
  // L1: sin él, el lint que trae Nest reclama que se devuelve un `any`. Y dice
  // algo cierto —el cuerpo de una respuesta HTTP no tiene tipo hasta que alguien
  // lo revise—, así que vale dejarlo escrito.
  @Get()
  async listar(
    @Headers('authorization') authorization?: string,
  ): Promise<unknown> {
    // El gateway es la puerta. Hoy solo comprueba que el header exista —no que
    // el token sea válido ni que lo haya emitido alguien de confianza—, y eso
    // es exactamente lo que se arregla en L2 y L3.
    //
    // 401 y no 403: 401 es «no sé quién eres», que es el caso. 403 sería «sé
    // quién eres y no te alcanza».
    if (!authorization) {
      throw new UnauthorizedException('falta el header Authorization');
    }

    const respuesta = await fetch('http://localhost:3001/libros');
    return respuesta.json();
  }
}

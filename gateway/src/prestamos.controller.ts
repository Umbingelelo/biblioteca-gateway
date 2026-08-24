import {
  Controller,
  Get,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * La pieza gemela de `libros.controller.ts`.
 *
 * Es el mismo patrón con cuatro cosas cambiadas: el nombre del archivo, la ruta
 * del `@Controller`, el nombre de la clase y **el puerto del `fetch`**. Ese
 * último es el que muerde: dejar el 3001 no da ningún error, responde 200 con
 * los libros, y cuesta un rato darse cuenta.
 */
@Controller('v1/prestamos')
export class PrestamosController {
  // El `Promise<unknown>` de abajo es lo único que no está tal cual en la guía de
  // L1: sin él, el lint que trae Nest reclama que se devuelve un `any`. Y dice
  // algo cierto —el cuerpo de una respuesta HTTP no tiene tipo hasta que alguien
  // lo revise—, así que vale dejarlo escrito.
  @Get()
  async listar(
    @Headers('authorization') authorization?: string,
  ): Promise<unknown> {
    if (!authorization) {
      throw new UnauthorizedException('falta el header Authorization');
    }

    const respuesta = await fetch('http://localhost:3002/prestamos');
    return respuesta.json();
  }
}

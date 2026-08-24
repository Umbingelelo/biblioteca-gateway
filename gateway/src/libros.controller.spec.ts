import { UnauthorizedException } from '@nestjs/common';
import { LibrosController } from './libros.controller';

/**
 * Lo que se vigila acá no es que el controller «funcione»: es que la puerta esté
 * cerrada y que el enrutamiento apunte al microservicio correcto.
 *
 * Ese segundo caso es el que justifica la prueba. Confundir el 3001 con el 3002
 * **no da ningún error**: responde 200 con datos perfectamente válidos, pero los
 * del otro dominio. Es el único error de este laboratorio que no se nota mirando
 * la pantalla.
 *
 * Ojo con lo que estas pruebas **no** pueden ver, porque no levantan nada: que el
 * controller esté declarado en `app.module.ts`. Sin eso la ruta responde 404 y
 * estas cuatro pruebas siguen pasando. Eso lo caza `probar.mjs`.
 */
describe('LibrosController', () => {
  const controller = new LibrosController();
  const original = global.fetch;

  afterEach(() => {
    global.fetch = original;
  });

  it('sin header Authorization responde 401 y no llama a nadie', async () => {
    const espia = jest.fn();
    global.fetch = espia;

    await expect(controller.listar()).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(espia).not.toHaveBeenCalled();
  });

  it('con header, va a buscar los libros al 3001', async () => {
    const espia = jest
      .fn()
      .mockResolvedValue({ json: () => Promise.resolve([{ id: 1 }]) });
    global.fetch = espia;

    await expect(controller.listar('Bearer holaquetal')).resolves.toEqual([
      { id: 1 },
    ]);
    expect(espia).toHaveBeenCalledWith('http://localhost:3001/libros');
  });
});

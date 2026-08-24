import { UnauthorizedException } from '@nestjs/common';
import { PrestamosController } from './prestamos.controller';

describe('PrestamosController', () => {
  const controller = new PrestamosController();
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

  // El puerto, que es el error traicionero del paso 1.5 de L1.
  it('con header, va a buscar los préstamos al 3002 y no al 3001', async () => {
    const espia = jest
      .fn()
      .mockResolvedValue({ json: () => Promise.resolve([{ id: 501 }]) });
    global.fetch = espia;

    await expect(controller.listar('Bearer holaquetal')).resolves.toEqual([
      { id: 501 },
    ]);
    expect(espia).toHaveBeenCalledWith('http://localhost:3002/prestamos');
  });
});

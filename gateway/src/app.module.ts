import { Module } from '@nestjs/common';
import { LibrosController } from './libros.controller';
import { PrestamosController } from './prestamos.controller';

/**
 * En Nest, existir no basta: hay que registrarse.
 *
 * Un controller que no está en esta lista responde **404**, igual que si el
 * archivo no existiera. Es el error nº1 del framework y le pasa a todo el
 * mundo la primera vez: se pierden diez minutos mirando un controller que está
 * perfecto.
 */
@Module({ controllers: [LibrosController, PrestamosController] })
export class AppModule {}

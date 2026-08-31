import { Router } from 'express';
import { autenticar } from '../../middleware/autenticar';
import * as controlador from './bitacora.controlador';

/**
 * Modulo 2 - Bitacora Animal.
 * Se monta bajo /api/v1/animales porque la bitacora siempre se consulta desde
 * la ficha del animal (RF_05).
 *
 * No hay PUT ni DELETE: las entradas son append-only (RF_06).
 */
export const enrutadorBitacora = Router();

enrutadorBitacora.use(autenticar);

// RF_05 - Productor y Trabajador
enrutadorBitacora.get('/:idAnimal/bitacora', controlador.listar);

// Nota manual (Nota_bitacora del MER) - Productor y Trabajador
enrutadorBitacora.post('/:idAnimal/bitacora', controlador.crearNota);

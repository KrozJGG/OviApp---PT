import { Router } from 'express';
import { autenticar } from '../../middleware/autenticar';
import { soloProductor } from '../../middleware/autorizar';
import * as controlador from './animales.controlador';

/**
 * Modulo 1 - Ficha Animal (RF_01 a RF_04). Se monta en /api/v1/animales.
 *
 * Matriz rol x endpoint (Tabla 3.1 de la tesis): el Trabajador registra,
 * consulta y edita animales; solo el Productor puede darlos de baja (RF_04) o
 * eliminarlos definitivamente del rebano.
 *
 * Las rutas de bitacora (/:idAnimal/bitacora) las sirve el Modulo 2, montado
 * aparte sobre este mismo prefijo.
 */
export const enrutadorAnimales = Router();

enrutadorAnimales.use(autenticar);

// RF_01 - Productor y Trabajador
enrutadorAnimales.post('/', controlador.crear);

// Listado del rebano - Productor y Trabajador
enrutadorAnimales.get('/', controlador.listar);

// RF_02 - Productor y Trabajador
enrutadorAnimales.get('/:id', controlador.obtener);

// RF_03 - Productor y Trabajador
enrutadorAnimales.patch('/:id', controlador.editar);

// RF_04 - solo Productor
enrutadorAnimales.post('/:id/baja', soloProductor, controlador.darDeBaja);

// Eliminacion definitiva - solo Productor, y solo sobre un animal ya inactivo.
enrutadorAnimales.delete('/:id', soloProductor, controlador.eliminar);

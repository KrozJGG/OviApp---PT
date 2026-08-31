import { Router } from 'express';
import { autenticar } from '../../middleware/autenticar';
import * as controlador from './tareas.controlador';

/**
 * Modulo 4 - Planificacion de actividades (RF_11 a RF_14).
 * Se monta en /api/v1/tareas.
 *
 * No hay restricciones de rol: RF_11 a RF_14 dicen "El Productor o el Pastor",
 * asi que las cuatro operaciones estan abiertas a ambos roles. Lo unico que
 * acota lo que ve cada usuario es el predio de su sesion (RNF_08).
 */
export const enrutadorTareas = Router();

enrutadorTareas.use(autenticar);

// RF_11 - Crear tarea
enrutadorTareas.post('/', controlador.crear);

// Listado y detalle
enrutadorTareas.get('/', controlador.listar);
enrutadorTareas.get('/:id', controlador.obtener);

// RF_12 - Editar tarea
enrutadorTareas.patch('/:id', controlador.editar);

// RF_13 - Completar tarea
enrutadorTareas.post('/:id/completar', controlador.completar);

// RF_14 - Eliminar tarea (borrado permanente)
enrutadorTareas.delete('/:id', controlador.eliminar);

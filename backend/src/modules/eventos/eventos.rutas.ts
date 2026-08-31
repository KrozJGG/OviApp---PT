import { Router } from 'express';
import { autenticar } from '../../middleware/autenticar';
import { soloProductor } from '../../middleware/autorizar';
import * as controlador from './eventos.controlador';

/**
 * Modulo 3 - Organizador de eventos (RF_07 a RF_10). Se monta en /api/v1/eventos.
 *
 * Matriz rol x endpoint (Tabla 3.1): consultar el calendario es de los dos
 * roles, pero crear, editar y eliminar eventos es exclusivo del Productor.
 */
export const enrutadorEventos = Router();

enrutadorEventos.use(autenticar);

// RF_07 - Registrar evento
enrutadorEventos.post('/', soloProductor, controlador.crear);

// Listado del calendario - Productor y Trabajador
enrutadorEventos.get('/', controlador.listar);

// RF_08 - Consultar detalle - Productor y Trabajador
enrutadorEventos.get('/:id', controlador.detalle);

// RF_09 - Editar evento
enrutadorEventos.patch('/:id', soloProductor, controlador.editar);

// RF_10 - Eliminar evento (borrado logico)
enrutadorEventos.delete('/:id', soloProductor, controlador.eliminar);

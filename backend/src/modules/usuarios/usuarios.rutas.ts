import { Router } from 'express';
import { autenticar } from '../../middleware/autenticar';
import { soloProductor } from '../../middleware/autorizar';
import * as controlador from './usuarios.controlador';

/**
 * Modulo 7 - Administracion (RF_20, RF_21, RF_22).
 *
 * Toda la gestion de usuarios es exclusiva del Productor: es quien administra
 * el personal del predio (Tabla 3.1 de la tesis). El Trabajador recibe 403 en
 * cualquiera de estas rutas.
 *
 * No hay DELETE: RF_22 inhabilita, no borra, para conservar el historico de
 * quien registro cada animal, nota y tarea.
 */
export const enrutadorUsuarios = Router();

enrutadorUsuarios.use(autenticar);

// RF_20 - Registrar nuevo usuario
enrutadorUsuarios.post('/', soloProductor, controlador.crear);

enrutadorUsuarios.get('/', soloProductor, controlador.listar);
enrutadorUsuarios.get('/:id', soloProductor, controlador.obtener);

// RF_21 - Editar informacion de usuario
enrutadorUsuarios.patch('/:id', soloProductor, controlador.editar);

// RF_22 - Inhabilitar usuario
enrutadorUsuarios.post('/:id/inhabilitar', soloProductor, controlador.inhabilitar);

import { Router } from 'express';
import { autenticar } from '../../middleware/autenticar';
import { soloProductor } from '../../middleware/autorizar';
import * as controlador from './reportes.controlador';

/**
 * Modulo 8 - Reportes y Paneles de Informacion (RF23, RF24 / IF4-SAL).
 *
 * Exclusivo para el rol PRODUCTOR: consolida datos productivos, sanitarios,
 * operativos y de vigilancia IA para la toma de decisiones estrategicas.
 */
export const enrutadorReportes = Router();

enrutadorReportes.use(autenticar, soloProductor);

enrutadorReportes.get('/resumen', controlador.resumen);
enrutadorReportes.get('/exportar', controlador.exportar);

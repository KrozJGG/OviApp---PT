"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.esquemaListadoTareas = exports.esquemaEditarTarea = exports.esquemaCrearTarea = void 0;
const zod_1 = require("zod");
const paginacion_1 = require("../../shared/paginacion");
/**
 * Esquemas de Modulo 4 - Planificacion de actividades (RF_11 a RF_14).
 *
 * Aqui solo se valida el FORMATO (400). Las reglas de negocio -responsables
 * obligatorios, pertenencia al predio, fecha no pasada, tarea ya completada-
 * viven en `tareas.servicio.ts` y responden 422 / 404 / 409.
 *
 * En particular `idResponsables` NO lleva `.min(1)`: RF_11 exige "uno o mas
 * responsables" como regla de negocio, y el contrato le asigna el codigo
 * RESPONSABLES_REQUERIDOS con status 422, no un 400 de validacion.
 */
const titulo = zod_1.z
    .string()
    .trim()
    .min(1, 'Escribe un título para la tarea.')
    .max(200, 'El título no puede superar los 200 caracteres.');
const descripcion = zod_1.z
    .string()
    .trim()
    .max(1000, 'La descripción no puede superar los 1000 caracteres.')
    .nullable();
const fechaLimite = zod_1.z.iso.date('La fecha de término debe tener el formato AAAA-MM-DD.');
const idResponsables = zod_1.z.array(zod_1.z.uuid('Alguno de los responsables no es válido.'));
const idAnimales = zod_1.z.array(zod_1.z.uuid('Alguno de los animales no es válido.'));
exports.esquemaCrearTarea = zod_1.z.object({
    titulo,
    descripcion: descripcion.optional(),
    fechaLimite,
    idResponsables,
    idAnimales: idAnimales.optional(),
});
/**
 * RF_12 - edicion parcial. Cada campo ausente se deja como estaba; enviar
 * `idAnimales: []` si desvincula todos los animales.
 */
exports.esquemaEditarTarea = zod_1.z.object({
    titulo: titulo.optional(),
    descripcion: descripcion.optional(),
    fechaLimite: fechaLimite.optional(),
    idResponsables: idResponsables.optional(),
    idAnimales: idAnimales.optional(),
});
exports.esquemaListadoTareas = paginacion_1.esquemaPaginacion.extend({
    estado: zod_1.z.enum(['ACTIVA', 'COMPLETADA']).optional(),
    desde: zod_1.z.iso.date('El filtro «desde» debe tener el formato AAAA-MM-DD.').optional(),
    hasta: zod_1.z.iso.date('El filtro «hasta» debe tener el formato AAAA-MM-DD.').optional(),
    idResponsable: zod_1.z.uuid('El responsable indicado no es válido.').optional(),
});
//# sourceMappingURL=tareas.esquemas.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.esquemaListadoEventos = exports.esquemaEditarEvento = exports.esquemaCrearEvento = exports.ESTADOS_EVENTO = exports.TIPOS_EVENTO = void 0;
const zod_1 = require("zod");
const paginacion_1 = require("../../shared/paginacion");
/**
 * Modulo 3 - Organizador de eventos (RF_07 a RF_10).
 *
 * `idAnimales` se valida aqui solo en su forma (uuid); que la lista no venga
 * vacia y que todos los animales esten activos son reglas de negocio y viven en
 * el servicio, porque RF_07 exige responder 422 con un codigo propio y no un
 * 400 generico de formato.
 */
exports.TIPOS_EVENTO = ['ENCASTE', 'ESQUILA', 'ATENCION_SANITARIA', 'OTRO'];
exports.ESTADOS_EVENTO = ['PROGRAMADO', 'REALIZADO', 'ELIMINADO'];
const descripcion = zod_1.z
    .string()
    .trim()
    .max(1000, 'La descripción no puede superar los 1000 caracteres.');
const idAnimales = zod_1.z.array(zod_1.z.uuid('Alguno de los animales seleccionados no es válido.'));
const fechaInicio = zod_1.z.iso.datetime({
    offset: true,
    error: 'La fecha del evento no es válida.',
});
exports.esquemaCrearEvento = zod_1.z.object({
    tipo: zod_1.z.enum(exports.TIPOS_EVENTO, 'Selecciona un tipo de evento válido.'),
    descripcion: descripcion.optional(),
    fechaInicio,
    idAnimales,
});
/**
 * RF_09 - el tipo no aparece aqui a proposito: es inmutable. Si el cliente lo
 * envia, el controlador lo detecta sobre el cuerpo crudo y responde 409.
 */
exports.esquemaEditarEvento = zod_1.z.object({
    descripcion: descripcion.nullable().optional(),
    fechaInicio: fechaInicio.optional(),
    idAnimales: idAnimales.optional(),
});
/** Booleano que llega como texto en la query string. */
const banderaQuery = zod_1.z
    .union([zod_1.z.literal('true'), zod_1.z.literal('false')])
    .optional()
    .transform((v) => v === 'true');
exports.esquemaListadoEventos = paginacion_1.esquemaPaginacion.extend({
    desde: zod_1.z.iso.date('La fecha inicial del rango no es válida.').optional(),
    hasta: zod_1.z.iso.date('La fecha final del rango no es válida.').optional(),
    tipo: zod_1.z.enum(exports.TIPOS_EVENTO, 'El tipo de evento no es válido.').optional(),
    estado: zod_1.z.enum(exports.ESTADOS_EVENTO, 'El estado del evento no es válido.').optional(),
    incluirEliminados: banderaQuery,
});
//# sourceMappingURL=eventos.esquemas.js.map
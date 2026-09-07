"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.esquemaListadoAlertas = exports.esquemaHeartbeat = exports.esquemaIngestaAlerta = void 0;
const zod_1 = require("zod");
const paginacion_1 = require("../../shared/paginacion");
/**
 * Esquemas del Modulo 6 - Vigilancia y deteccion (RF_17 a RF_19).
 *
 * El modelo de vision por computadora vive en el dispositivo edge: aqui solo se
 * valida la senal que emite (IF5-ENT). Ni el predio ni el dispositivo llegan por
 * el cuerpo, salen siempre del contexto autenticado (RNF_08).
 */
const conteo = zod_1.z
    .number('Debe ser un numero entero.')
    .int('Debe ser un numero entero.')
    .min(0, 'No puede ser negativo.');
/** Marca de tiempo emitida por el dispositivo. Se acepta con 'Z' o con desfase. */
const marcaDeTiempo = zod_1.z.iso.datetime({
    offset: true,
    message: 'La marca de tiempo debe venir en formato ISO 8601.',
});
/** POST /edge/alertas - IF5-ENT */
exports.esquemaIngestaAlerta = zod_1.z.object({
    tipoAlerta: zod_1.z.enum(['CONTEO', 'DISPERSION', 'AMENAZA'], 'El tipo de alerta no es valido.'),
    conteoAnimales: conteo.optional(),
    conteoEsperado: conteo.optional(),
    nivel: zod_1.z.enum(['INFO', 'ADVERTENCIA', 'CRITICA'], 'El nivel de la alerta no es valido.').optional(),
    descripcion: zod_1.z.string().trim().max(500, 'La descripcion no puede superar los 500 caracteres.').optional(),
    timestamp: marcaDeTiempo,
});
/** POST /edge/heartbeat - latido de presencia del dispositivo. */
exports.esquemaHeartbeat = zod_1.z.object({
    conteoActual: conteo.optional(),
    timestamp: marcaDeTiempo,
});
/** GET /alertas - RF_19 (historial filtrable por fecha, tipo y estado). */
exports.esquemaListadoAlertas = paginacion_1.esquemaPaginacion.extend({
    desde: zod_1.z.iso.date('La fecha "desde" debe tener el formato AAAA-MM-DD.').optional(),
    hasta: zod_1.z.iso.date('La fecha "hasta" debe tener el formato AAAA-MM-DD.').optional(),
    tipo: zod_1.z.enum(['CONTEO', 'DISPERSION', 'AMENAZA'], 'El tipo de alerta no es valido.').optional(),
    estado: zod_1.z.enum(['NUEVA', 'REVISADA'], 'El estado de la alerta no es valido.').optional(),
});
//# sourceMappingURL=alertas.esquemas.js.map
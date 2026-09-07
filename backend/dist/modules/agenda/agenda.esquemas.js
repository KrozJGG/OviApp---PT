"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.esquemaRangoAgenda = void 0;
const zod_1 = require("zod");
/**
 * Modulo 5 - Pantalla de inicio y calendario (RF_15, RF_16).
 *
 * RF_16 permite navegar el calendario al pasado y al futuro sin restriccion, asi
 * que aqui no hay tope de fecha minima ni maxima: lo unico acotado es el ANCHO
 * del rango, y esa validacion es una regla de negocio (422), no de formato.
 */
exports.esquemaRangoAgenda = zod_1.z.object({
    desde: zod_1.z.iso.date('La fecha "desde" debe tener el formato AAAA-MM-DD.').optional(),
    hasta: zod_1.z.iso.date('La fecha "hasta" debe tener el formato AAAA-MM-DD.').optional(),
});
//# sourceMappingURL=agenda.esquemas.js.map
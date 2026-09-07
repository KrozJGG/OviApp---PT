"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.esquemaPaginacion = exports.TAMANO_PAGINA_MAXIMO = exports.TAMANO_PAGINA_POR_DEFECTO = void 0;
exports.aSkipTake = aSkipTake;
exports.paginar = paginar;
const zod_1 = require("zod");
exports.TAMANO_PAGINA_POR_DEFECTO = 20;
exports.TAMANO_PAGINA_MAXIMO = 100;
/**
 * Query de paginacion compartida por todos los listados.
 * Se compone con `.extend()` en cada modulo para agregar sus propios filtros.
 */
exports.esquemaPaginacion = zod_1.z.object({
    pagina: zod_1.z.coerce.number().int().min(1).default(1),
    tamano: zod_1.z.coerce.number().int().min(1).max(exports.TAMANO_PAGINA_MAXIMO).default(exports.TAMANO_PAGINA_POR_DEFECTO),
});
/** Traduce { pagina, tamano } a los argumentos skip/take de Prisma. */
function aSkipTake(p) {
    return { skip: (p.pagina - 1) * p.tamano, take: p.tamano };
}
function paginar(datos, total, p) {
    return {
        datos,
        meta: {
            pagina: p.pagina,
            tamano: p.tamano,
            total,
            totalPaginas: total === 0 ? 0 : Math.ceil(total / p.tamano),
        },
    };
}
//# sourceMappingURL=paginacion.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.esquemaParamId = void 0;
exports.validarCuerpo = validarCuerpo;
exports.validarQuery = validarQuery;
exports.validarParams = validarParams;
const zod_1 = require("zod");
const errores_1 = require("./errores");
function aDetalles(error) {
    return error.issues.map((i) => ({
        campo: i.path.length > 0 ? i.path.join('.') : '(raiz)',
        mensaje: i.message,
    }));
}
function validar(esquema, valor, donde) {
    const r = esquema.safeParse(valor);
    if (!r.success) {
        throw new errores_1.ErrorValidacion(`Hay campos invalidos en ${donde}.`, aDetalles(r.error));
    }
    return r.data;
}
function validarCuerpo(esquema, req) {
    return validar(esquema, req.body, 'el formulario');
}
function validarQuery(esquema, req) {
    return validar(esquema, req.query, 'los filtros');
}
function validarParams(esquema, req) {
    return validar(esquema, req.params, 'la direccion solicitada');
}
/** Parametro de ruta `:id` como UUID. Reutilizado por todos los modulos. */
exports.esquemaParamId = zod_1.z.object({
    id: zod_1.z.uuid('El identificador no es valido.'),
});
//# sourceMappingURL=validacion.js.map
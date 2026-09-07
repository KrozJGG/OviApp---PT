"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.soloProductor = void 0;
exports.autorizar = autorizar;
const contexto_1 = require("../shared/contexto");
const errores_1 = require("../shared/errores");
/**
 * Control de acceso por rol (RNF_03).
 *
 * Se aplica a nivel de ruta y no dentro del servicio, para que la matriz
 * rol x endpoint sea legible de un vistazo en el archivo de rutas y se pueda
 * contrastar con la Tabla 3.1 de la tesis.
 *
 *   router.post('/', autorizar('PRODUCTOR'), controlador.crear)
 */
function autorizar(...roles) {
    return (req, _res, next) => {
        try {
            const ctx = (0, contexto_1.ctxDe)(req);
            if (!roles.includes(ctx.rol)) {
                next(new errores_1.ErrorProhibido(roles.length === 1 && roles[0] === 'PRODUCTOR'
                    ? 'Solo el Productor puede realizar esta accion.'
                    : 'Tu rol no permite realizar esta accion.'));
                return;
            }
            next();
        }
        catch (e) {
            next(e);
        }
    };
}
/** Atajo legible para las rutas exclusivas del Productor. */
exports.soloProductor = autorizar('PRODUCTOR');
//# sourceMappingURL=autorizar.js.map
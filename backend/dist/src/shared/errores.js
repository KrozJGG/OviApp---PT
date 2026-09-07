"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorReglaNegocio = exports.ErrorConflicto = exports.ErrorNoEncontrado = exports.ErrorProhibido = exports.ErrorNoAutenticado = exports.ErrorValidacion = exports.ErrorApp = void 0;
exports.esErrorApp = esErrorApp;
class ErrorApp extends Error {
    status;
    codigo;
    detalles;
    constructor(status, codigo, mensaje, detalles) {
        super(mensaje);
        this.name = new.target.name;
        this.status = status;
        this.codigo = codigo;
        this.detalles = detalles;
        Error.captureStackTrace?.(this, new.target);
    }
}
exports.ErrorApp = ErrorApp;
/** 400 - el cuerpo, la query o los parametros no cumplen el contrato. */
class ErrorValidacion extends ErrorApp {
    constructor(mensaje = 'Los datos enviados no son validos.', detalles) {
        super(400, 'VALIDACION', mensaje, detalles);
    }
}
exports.ErrorValidacion = ErrorValidacion;
/** 401 - falta el token, esta expirado o las credenciales no coinciden. */
class ErrorNoAutenticado extends ErrorApp {
    constructor(codigo = 'NO_AUTENTICADO', mensaje = 'Debes iniciar sesion.') {
        super(401, codigo, mensaje);
    }
}
exports.ErrorNoAutenticado = ErrorNoAutenticado;
/** 403 - autenticado, pero el rol no alcanza para esta accion. */
class ErrorProhibido extends ErrorApp {
    constructor(mensaje = 'Tu rol no permite realizar esta accion.', codigo = 'ROL_INSUFICIENTE') {
        super(403, codigo, mensaje);
    }
}
exports.ErrorProhibido = ErrorProhibido;
/**
 * 404 - no existe, o existe pero pertenece a otro predio.
 * Se responde igual en ambos casos: revelar la diferencia filtraria informacion
 * entre predios (RNF_08).
 */
class ErrorNoEncontrado extends ErrorApp {
    constructor(mensaje = 'No se encontro el recurso solicitado.', codigo = 'NO_ENCONTRADO') {
        super(404, codigo, mensaje);
    }
}
exports.ErrorNoEncontrado = ErrorNoEncontrado;
/** 409 - el recurso ya existe o esta en un estado que impide la operacion. */
class ErrorConflicto extends ErrorApp {
    constructor(codigo, mensaje, detalles) {
        super(409, codigo, mensaje, detalles);
    }
}
exports.ErrorConflicto = ErrorConflicto;
/** 422 - el formato es correcto pero viola una regla de negocio. */
class ErrorReglaNegocio extends ErrorApp {
    constructor(codigo, mensaje, detalles) {
        super(422, codigo, mensaje, detalles);
    }
}
exports.ErrorReglaNegocio = ErrorReglaNegocio;
function esErrorApp(e) {
    return e instanceof ErrorApp;
}
//# sourceMappingURL=errores.js.map
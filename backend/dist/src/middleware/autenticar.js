"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.firmarAcceso = firmarAcceso;
exports.verificarAcceso = verificarAcceso;
exports.autenticar = autenticar;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const env_1 = require("../config/env");
const errores_1 = require("../shared/errores");
/** Contenido del access token. `predio` viaja aqui y nunca en el cuerpo. */
const esquemaPayload = zod_1.z.object({
    sub: zod_1.z.uuid(),
    predio: zod_1.z.uuid(),
    rol: zod_1.z.enum(['PRODUCTOR', 'TRABAJADOR']),
    email: zod_1.z.string(),
});
function firmarAcceso(ctx) {
    const payload = {
        sub: ctx.idUsuario,
        predio: ctx.idPredio,
        rol: ctx.rol,
        email: ctx.email,
    };
    return jsonwebtoken_1.default.sign(payload, env_1.env.JWT_SECRET, {
        expiresIn: env_1.env.JWT_ACCESS_TTL,
    });
}
function verificarAcceso(token) {
    let bruto;
    try {
        bruto = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
    }
    catch (e) {
        if (e instanceof jsonwebtoken_1.default.TokenExpiredError) {
            throw new errores_1.ErrorNoAutenticado('TOKEN_EXPIRADO', 'Tu sesion expiro. Vuelve a iniciar sesion.');
        }
        throw new errores_1.ErrorNoAutenticado('TOKEN_INVALIDO', 'La sesion no es valida.');
    }
    const r = esquemaPayload.safeParse(bruto);
    if (!r.success) {
        throw new errores_1.ErrorNoAutenticado('TOKEN_INVALIDO', 'La sesion no es valida.');
    }
    return {
        idUsuario: r.data.sub,
        idPredio: r.data.predio,
        rol: r.data.rol,
        email: r.data.email,
    };
}
/**
 * Exige un access token valido y deja la identidad en `req.ctx`.
 * A partir de aqui, todo repositorio filtra por `ctx.idPredio` (RNF_08).
 */
function autenticar(req, _res, next) {
    const cabecera = req.header('authorization');
    if (!cabecera?.startsWith('Bearer ')) {
        next(new errores_1.ErrorNoAutenticado('NO_AUTENTICADO', 'Debes iniciar sesion.'));
        return;
    }
    try {
        req.ctx = verificarAcceso(cabecera.slice('Bearer '.length).trim());
        next();
    }
    catch (e) {
        next(e);
    }
}
//# sourceMappingURL=autenticar.js.map
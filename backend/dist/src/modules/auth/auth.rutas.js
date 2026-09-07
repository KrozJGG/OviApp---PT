"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrutadorAuth = void 0;
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const env_1 = require("../../config/env");
const autenticar_1 = require("../../middleware/autenticar");
const contexto_1 = require("../../shared/contexto");
const db_1 = require("../../shared/db");
const errores_1 = require("../../shared/errores");
const validacion_1 = require("../../shared/validacion");
const auth_esquemas_1 = require("./auth.esquemas");
const auth_servicio_1 = require("./auth.servicio");
/** Sesión — IF6-ENT y RF_00 (H13 del plan). */
exports.enrutadorAuth = (0, express_1.Router)();
/**
 * RNF_03 — el login es el único endpoint público que recibe credenciales, así
 * que es el único que conviene limitar por IP. Se desactiva en tests para que
 * la suite pueda hacer decenas de logins seguidos.
 */
const limiteLogin = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => env_1.esTest,
    message: {
        error: {
            codigo: 'DEMASIADOS_INTENTOS',
            mensaje: 'Demasiados intentos de inicio de sesión. Espera unos minutos.',
        },
    },
});
exports.enrutadorAuth.post('/login', limiteLogin, async (req, res) => {
    const datos = (0, validacion_1.validarCuerpo)(auth_esquemas_1.esquemaLogin, req);
    res.json(await (0, auth_servicio_1.login)(datos.email, datos.password));
});
exports.enrutadorAuth.post('/refresh', async (req, res) => {
    const { refreshToken } = (0, validacion_1.validarCuerpo)(auth_esquemas_1.esquemaRefresh, req);
    res.json(await (0, auth_servicio_1.refrescar)(refreshToken));
});
exports.enrutadorAuth.post('/logout', autenticar_1.autenticar, async (req, res) => {
    const ctx = (0, contexto_1.ctxDe)(req);
    const { refreshToken } = (0, validacion_1.validarCuerpo)(auth_esquemas_1.esquemaLogout, req);
    await (0, auth_servicio_1.logout)(ctx.idUsuario, refreshToken);
    res.status(204).end();
});
/** Perfil del usuario en sesión: alimenta los guards por rol de la app. */
exports.enrutadorAuth.get('/me', autenticar_1.autenticar, async (req, res) => {
    const ctx = (0, contexto_1.ctxDe)(req);
    const usuario = await db_1.prisma.usuario.findUnique({
        where: { id: ctx.idUsuario },
        include: { predio: { select: { id: true, nombre: true, ubicacion: true } } },
    });
    if (!usuario || usuario.estado === 'INHABILITADO') {
        throw new errores_1.ErrorNoEncontrado('No se encontró el usuario de la sesión.');
    }
    res.json({
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rut: usuario.rut,
        telefono: usuario.telefono,
        fotoUrl: usuario.fotoUrl,
        rol: usuario.rol,
        estado: usuario.estado,
        predio: usuario.predio,
    });
});
//# sourceMappingURL=auth.rutas.js.map
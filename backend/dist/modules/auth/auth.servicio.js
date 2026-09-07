"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.refrescar = refrescar;
exports.logout = logout;
exports.revocarSesionesDe = revocarSesionesDe;
const node_crypto_1 = require("node:crypto");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const env_1 = require("../../config/env");
const autenticar_1 = require("../../middleware/autenticar");
const db_1 = require("../../shared/db");
const errores_1 = require("../../shared/errores");
/** Mismo mensaje para correo inexistente y contraseña incorrecta: si no, el
 *  endpoint se convierte en un verificador de qué correos existen. */
const CREDENCIALES = 'El correo o la contraseña no son correctos.';
async function login(email, password) {
    const usuario = await db_1.prisma.usuario.findUnique({
        where: { email: email.toLowerCase() },
        include: { predio: { select: { nombre: true } } },
    });
    if (!usuario) {
        // Se compara igual contra un hash ficticio para que el tiempo de respuesta
        // no delate si el correo existe.
        await bcryptjs_1.default.compare(password, '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin');
        throw new errores_1.ErrorNoAutenticado('CREDENCIALES_INVALIDAS', CREDENCIALES);
    }
    if (!(await bcryptjs_1.default.compare(password, usuario.passwordHash))) {
        throw new errores_1.ErrorNoAutenticado('CREDENCIALES_INVALIDAS', CREDENCIALES);
    }
    // RF_22 — inhabilitar revoca el acceso sin borrar el historial.
    if (usuario.estado === 'INHABILITADO') {
        throw new errores_1.ErrorNoAutenticado('USUARIO_INHABILITADO', 'Tu cuenta fue inhabilitada. Contacta al productor del predio.');
    }
    const ctx = {
        idUsuario: usuario.id,
        idPredio: usuario.idPredio,
        rol: usuario.rol,
        email: usuario.email,
    };
    return {
        accessToken: (0, autenticar_1.firmarAcceso)(ctx),
        refreshToken: await emitirRefresh(usuario.id),
        expiraEn: env_1.env.JWT_ACCESS_TTL,
        usuario: {
            id: usuario.id,
            nombre: usuario.nombre,
            email: usuario.email,
            rol: usuario.rol,
            idPredio: usuario.idPredio,
            predio: usuario.predio.nombre,
            fotoUrl: usuario.fotoUrl,
        },
    };
}
/**
 * Rotación: cada uso consume el token de refresco y entrega uno nuevo. Si
 * alguien reutiliza uno ya consumido, no obtiene sesión.
 */
async function refrescar(refreshToken) {
    const hash = hashear(refreshToken);
    const guardado = await db_1.prisma.refreshToken.findUnique({
        where: { tokenHash: hash },
        include: { usuario: { include: { predio: { select: { nombre: true } } } } },
    });
    const invalido = new errores_1.ErrorNoAutenticado('TOKEN_INVALIDO', 'Tu sesión expiró. Vuelve a iniciar sesión.');
    if (!guardado || guardado.revocadoEn !== null || guardado.expiraEn < new Date()) {
        throw invalido;
    }
    if (guardado.usuario.estado === 'INHABILITADO') {
        throw new errores_1.ErrorNoAutenticado('USUARIO_INHABILITADO', 'Tu cuenta fue inhabilitada. Contacta al productor del predio.');
    }
    const usuario = guardado.usuario;
    const [, nuevoRefresh] = await Promise.all([
        db_1.prisma.refreshToken.update({
            where: { id: guardado.id },
            data: { revocadoEn: new Date() },
        }),
        emitirRefresh(usuario.id),
    ]);
    return {
        accessToken: (0, autenticar_1.firmarAcceso)({
            idUsuario: usuario.id,
            idPredio: usuario.idPredio,
            rol: usuario.rol,
            email: usuario.email,
        }),
        refreshToken: nuevoRefresh,
        expiraEn: env_1.env.JWT_ACCESS_TTL,
        usuario: {
            id: usuario.id,
            nombre: usuario.nombre,
            email: usuario.email,
            rol: usuario.rol,
            idPredio: usuario.idPredio,
            predio: usuario.predio.nombre,
            fotoUrl: usuario.fotoUrl,
        },
    };
}
/** Cierra la sesión: revoca el refresco y descarta el token push del equipo. */
async function logout(idUsuario, refreshToken) {
    if (refreshToken) {
        await db_1.prisma.refreshToken.updateMany({
            where: { tokenHash: hashear(refreshToken), idUsuario, revocadoEn: null },
            data: { revocadoEn: new Date() },
        });
    }
    else {
        // Sin token explícito se cierran todas las sesiones del usuario.
        await db_1.prisma.refreshToken.updateMany({
            where: { idUsuario, revocadoEn: null },
            data: { revocadoEn: new Date() },
        });
    }
}
/** RF_22 — al inhabilitar a alguien hay que echarlo de sus sesiones abiertas. */
async function revocarSesionesDe(idUsuario) {
    await db_1.prisma.refreshToken.updateMany({
        where: { idUsuario, revocadoEn: null },
        data: { revocadoEn: new Date() },
    });
}
async function emitirRefresh(idUsuario) {
    const token = (0, node_crypto_1.randomBytes)(48).toString('base64url');
    const expiraEn = new Date(Date.now() + env_1.env.JWT_REFRESH_TTL_DIAS * 86_400_000);
    await db_1.prisma.refreshToken.create({
        data: { idUsuario, tokenHash: hashear(token), expiraEn },
    });
    return token;
}
/**
 * SHA-256 y no bcrypt: el token ya es aleatorio de 48 bytes, no hay nada que
 * derivar por fuerza bruta, y el refresco se valida en cada renovación — un
 * hash lento ahí sería un costo sin beneficio.
 */
function hashear(token) {
    return (0, node_crypto_1.createHash)('sha256').update(token).digest('hex');
}
//# sourceMappingURL=auth.servicio.js.map
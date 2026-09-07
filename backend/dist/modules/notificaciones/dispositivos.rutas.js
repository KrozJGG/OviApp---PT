"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrutadorDispositivosPush = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const autenticar_1 = require("../../middleware/autenticar");
const contexto_1 = require("../../shared/contexto");
const db_1 = require("../../shared/db");
const validacion_1 = require("../../shared/validacion");
/**
 * Registro del token de notificaciones del dispositivo (IF3-SAL, IF4-SAL).
 * La app llama a este endpoint tras iniciar sesion y cada vez que FCM rota el
 * token.
 */
exports.enrutadorDispositivosPush = (0, express_1.Router)();
exports.enrutadorDispositivosPush.use(autenticar_1.autenticar);
const esquemaRegistro = zod_1.z.object({
    tokenPush: zod_1.z.string().trim().min(10, 'El token de notificaciones no es valido.'),
    plataforma: zod_1.z.enum(['ANDROID', 'IOS']),
});
exports.enrutadorDispositivosPush.post('/', async (req, res) => {
    const ctx = (0, contexto_1.ctxDe)(req);
    const datos = (0, validacion_1.validarCuerpo)(esquemaRegistro, req);
    // El mismo token puede migrar de usuario si dos personas usan el equipo:
    // se reasigna en vez de duplicar.
    const dispositivo = await db_1.prisma.dispositivoUsuario.upsert({
        where: { tokenPush: datos.tokenPush },
        create: {
            idUsuario: ctx.idUsuario,
            tokenPush: datos.tokenPush,
            plataforma: datos.plataforma,
        },
        update: {
            idUsuario: ctx.idUsuario,
            plataforma: datos.plataforma,
            ultimoUso: new Date(),
        },
        select: { id: true, plataforma: true, ultimoUso: true },
    });
    res.status(201).json(dispositivo);
});
const esquemaToken = zod_1.z.object({ token: zod_1.z.string().min(10) });
exports.enrutadorDispositivosPush.delete('/:token', async (req, res) => {
    const ctx = (0, contexto_1.ctxDe)(req);
    const { token } = (0, validacion_1.validarParams)(esquemaToken, req);
    await db_1.prisma.dispositivoUsuario.deleteMany({
        where: { tokenPush: token, idUsuario: ctx.idUsuario },
    });
    res.status(204).end();
});
//# sourceMappingURL=dispositivos.rutas.js.map
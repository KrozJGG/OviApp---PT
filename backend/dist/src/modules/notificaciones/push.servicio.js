"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.enviarAUsuarios = enviarAUsuarios;
exports.usuariosDelPredio = usuariosDelPredio;
const env_1 = require("../../config/env");
const logger_1 = require("../../config/logger");
const db_1 = require("../../shared/db");
let mensajeria;
async function obtenerMensajeria() {
    if (mensajeria !== undefined)
        return mensajeria;
    if (!env_1.env.PUSH_HABILITADO || !env_1.env.FIREBASE_CREDENCIALES_JSON) {
        mensajeria = null;
        return null;
    }
    try {
        // Import dinamico: firebase-admin solo se carga si realmente se va a usar.
        const { cert, getApp, getApps, initializeApp } = await Promise.resolve().then(() => __importStar(require('firebase-admin/app')));
        const { getMessaging } = await Promise.resolve().then(() => __importStar(require('firebase-admin/messaging')));
        const credencial = JSON.parse(env_1.env.FIREBASE_CREDENCIALES_JSON);
        const app = getApps().length > 0
            ? getApp()
            : initializeApp({ credential: cert(credencial) });
        mensajeria = getMessaging(app);
        logger_1.logger.info('Notificaciones push habilitadas (FCM).');
    }
    catch (e) {
        logger_1.logger.error({ err: e }, 'No se pudo inicializar Firebase; las push quedan deshabilitadas.');
        mensajeria = null;
    }
    return mensajeria;
}
/** Envia a todos los dispositivos registrados de los usuarios indicados. */
async function enviarAUsuarios(idUsuarios, mensaje) {
    if (idUsuarios.length === 0)
        return { enviados: 0, fallidos: 0, omitido: true };
    const dispositivos = await db_1.prisma.dispositivoUsuario.findMany({
        where: { idUsuario: { in: idUsuarios } },
        select: { tokenPush: true },
    });
    const tokens = dispositivos.map((d) => d.tokenPush);
    if (tokens.length === 0)
        return { enviados: 0, fallidos: 0, omitido: true };
    const fcm = await obtenerMensajeria();
    if (!fcm) {
        logger_1.logger.info({ tokens: tokens.length, titulo: mensaje.titulo }, 'Push omitida (FCM deshabilitado)');
        return { enviados: 0, fallidos: 0, omitido: true };
    }
    const respuesta = await fcm.sendEachForMulticast({
        tokens,
        notification: { title: mensaje.titulo, body: mensaje.cuerpo },
        data: mensaje.datos,
        android: { priority: 'high' },
    });
    // Un token invalido significa que la app se desinstalo o se reinstalo:
    // se limpia para que la tabla no acumule destinos muertos.
    const muertos = respuesta.responses
        .map((r, i) => ({ r, token: tokens[i] }))
        .filter(({ r }) => !r.success && esTokenMuerto(r.error?.code))
        .map(({ token }) => token);
    if (muertos.length > 0) {
        await db_1.prisma.dispositivoUsuario.deleteMany({ where: { tokenPush: { in: muertos } } });
    }
    return {
        enviados: respuesta.successCount,
        fallidos: respuesta.failureCount,
        omitido: false,
    };
}
/** Todos los usuarios habilitados de un predio: destinatarios de RF_18. */
async function usuariosDelPredio(idPredio) {
    const usuarios = await db_1.prisma.usuario.findMany({
        where: { idPredio, estado: 'HABILITADO' },
        select: { id: true },
    });
    return usuarios.map((u) => u.id);
}
function esTokenMuerto(codigo) {
    return (codigo === 'messaging/registration-token-not-registered' ||
        codigo === 'messaging/invalid-registration-token' ||
        codigo === 'messaging/invalid-argument');
}
//# sourceMappingURL=push.servicio.js.map
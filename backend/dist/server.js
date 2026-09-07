"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const env_1 = require("./config/env");
const logger_1 = require("./config/logger");
const prisma_1 = require("./config/prisma");
const recordatorios_1 = require("./modules/notificaciones/recordatorios");
const app = (0, app_1.crearApp)();
const servidor = app.listen(env_1.env.PORT, () => {
    logger_1.logger.info(`OviApp API escuchando en http://localhost:${env_1.env.PORT} (${env_1.env.NODE_ENV})`);
});
// IF4-SAL - recordatorios de eventos y tareas proximas.
const detenerRecordatorios = (0, recordatorios_1.iniciarRecordatorios)();
async function apagar(senal) {
    logger_1.logger.info(`Recibido ${senal}, cerrando...`);
    detenerRecordatorios();
    servidor.close(async () => {
        await (0, prisma_1.cerrarPrisma)();
        process.exit(0);
    });
    // Si alguna conexion queda colgada, no se espera indefinidamente.
    setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => void apagar('SIGTERM'));
process.on('SIGINT', () => void apagar('SIGINT'));
//# sourceMappingURL=server.js.map
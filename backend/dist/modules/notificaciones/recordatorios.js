"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.iniciarRecordatorios = iniciarRecordatorios;
exports.ejecutarRecordatorios = ejecutarRecordatorios;
const node_cron_1 = __importDefault(require("node-cron"));
const env_1 = require("../../config/env");
const logger_1 = require("../../config/logger");
const db_1 = require("../../shared/db");
const fechas_1 = require("../../shared/fechas");
const push_servicio_1 = require("./push.servicio");
/**
 * IF4-SAL - Recordatorio de evento calendarizado.
 *
 * Anticipacion segun la interfaz de salida de la tesis:
 *   24 h para eventos del Modulo Organizador
 *   48 h para hitos del Modulo de Planificacion
 *
 * Se ejecuta una vez al dia (CRON_RECORDATORIOS) en la zona del predio, no cada
 * hora: en terreno un aviso a las 08:00 del dia anterior es util, uno a las
 * 03:00 no lo es.
 */
function iniciarRecordatorios() {
    if (!env_1.env.CRON_HABILITADO) {
        logger_1.logger.info('Recordatorios programados deshabilitados (CRON_HABILITADO=false).');
        return () => undefined;
    }
    const tarea = node_cron_1.default.schedule(env_1.env.CRON_RECORDATORIOS, () => {
        void ejecutarRecordatorios().catch((err) => {
            logger_1.logger.error({ err }, 'Fallo la ejecucion de recordatorios');
        });
    }, { timezone: fechas_1.ZONA_HORARIA });
    logger_1.logger.info(`Recordatorios programados con "${env_1.env.CRON_RECORDATORIOS}" (${fechas_1.ZONA_HORARIA}).`);
    return () => {
        void tarea.stop();
    };
}
async function ejecutarRecordatorios(hoy = (0, fechas_1.fechaLocalISO)()) {
    const [eventos, tareas] = await Promise.all([
        recordarEventos((0, fechas_1.sumarDias)(hoy, 1)),
        recordarTareas((0, fechas_1.sumarDias)(hoy, 2)),
    ]);
    logger_1.logger.info({ eventos, tareas }, 'Recordatorios enviados');
    return { eventos, tareas };
}
/** Eventos programados para dentro de 24 h: avisa a todo el predio. */
async function recordarEventos(fechaObjetivo) {
    const eventos = await db_1.prisma.evento.findMany({
        where: {
            estado: 'PROGRAMADO',
            eliminadoEn: null,
            fechaInicio: { gte: (0, fechas_1.inicioDelDia)(fechaObjetivo), lt: (0, fechas_1.finDelDia)(fechaObjetivo) },
        },
        select: {
            id: true,
            idPredio: true,
            tipo: true,
            descripcion: true,
            fechaInicio: true,
            _count: { select: { animales: true } },
        },
    });
    for (const evento of eventos) {
        const destinatarios = await (0, push_servicio_1.usuariosDelPredio)(evento.idPredio);
        await (0, push_servicio_1.enviarAUsuarios)(destinatarios, {
            titulo: `Manana: ${etiqueta(evento.tipo)}`,
            cuerpo: evento._count.animales > 0
                ? `${evento._count.animales} animales involucrados. ${evento.descripcion ?? ''}`.trim()
                : (evento.descripcion ?? 'Evento programado para manana.'),
            datos: { tipo: 'RECORDATORIO_EVENTO', idEvento: evento.id },
        });
    }
    return eventos.length;
}
/** Tareas que vencen en 48 h: avisa solo a sus responsables. */
async function recordarTareas(fechaObjetivo) {
    const tareas = await db_1.prisma.tarea.findMany({
        where: { estado: 'ACTIVA', fechaLimite: (0, fechas_1.aFechaSolo)(fechaObjetivo) },
        select: {
            id: true,
            titulo: true,
            descripcion: true,
            responsables: { select: { idUsuario: true } },
        },
    });
    for (const tarea of tareas) {
        const destinatarios = tarea.responsables.map((r) => r.idUsuario);
        if (destinatarios.length === 0)
            continue;
        await (0, push_servicio_1.enviarAUsuarios)(destinatarios, {
            titulo: `Vence en 2 dias: ${tarea.titulo}`,
            cuerpo: tarea.descripcion ?? 'Tarea del predio pendiente.',
            datos: { tipo: 'RECORDATORIO_TAREA', idTarea: tarea.id },
        });
    }
    return tareas.length;
}
const ETIQUETAS = {
    ENCASTE: 'Encaste',
    ESQUILA: 'Esquila',
    ATENCION_SANITARIA: 'Atencion sanitaria',
    OTRO: 'Evento del predio',
};
function etiqueta(tipo) {
    return ETIQUETAS[tipo] ?? tipo;
}
//# sourceMappingURL=recordatorios.js.map
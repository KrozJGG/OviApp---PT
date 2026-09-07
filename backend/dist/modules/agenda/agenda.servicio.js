"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DIAS_MAXIMOS_RANGO = void 0;
exports.obtenerResumenInicio = obtenerResumenInicio;
exports.obtenerAgendaDelDia = obtenerAgendaDelDia;
exports.resolverRango = resolverRango;
exports.obtenerAgendaDelRango = obtenerAgendaDelRango;
const db_1 = require("../../shared/db");
const errores_1 = require("../../shared/errores");
const fechas_1 = require("../../shared/fechas");
const bitacora_servicio_1 = require("../bitacora/bitacora.servicio");
/** Ancho maximo del rango del calendario, en dias calendario inclusive. */
exports.DIAS_MAXIMOS_RANGO = 366;
// ─── RF_15 - tarjetas de la pantalla de inicio ───────────────────────────────
/**
 * Resumen del mockup 02: rebano activo, tareas de hoy, alertas sin leer y la
 * ultima alerta recibida. Los cuatro conteos son independientes entre si, asi
 * que se resuelven en paralelo: la pantalla de inicio es la primera que ve el
 * usuario al abrir la app y encadenar cuatro round-trips a la base se nota.
 */
async function obtenerResumenInicio(idPredio) {
    const hoy = (0, fechas_1.fechaLocalISO)();
    const [animalesActivos, tareasHoy, alertasSinLeer, ultimaAlerta] = await Promise.all([
        db_1.prisma.animal.count({ where: { idPredio, estado: 'ACTIVO' } }),
        db_1.prisma.tarea.count({ where: { idPredio, estado: 'ACTIVA', fechaLimite: (0, fechas_1.aFechaSolo)(hoy) } }),
        db_1.prisma.alerta.count({ where: { idPredio, estado: 'NUEVA' } }),
        db_1.prisma.alerta.findFirst({
            where: { idPredio },
            orderBy: { fechaHora: 'desc' },
            select: { id: true, tipoAlerta: true, descripcion: true, fechaHora: true },
        }),
    ]);
    return { animalesActivos, tareasHoy, alertasSinLeer, ultimaAlerta };
}
// ─── RF_15 - actividades del dia ─────────────────────────────────────────────
/**
 * Eventos y tareas de hoy en la zona horaria del predio.
 *
 * El dia se acota con `inicioDelDia`/`finDelDia` y no comparando en UTC: entre
 * las 21:00 y medianoche de Chile continental el dia UTC ya es el siguiente, y
 * el productor veria la agenda de manana en pantalla.
 *
 * Un dia sin actividades es una respuesta valida (200 con `items: []`).
 */
async function obtenerAgendaDelDia(idPredio, hoy = (0, fechas_1.fechaLocalISO)()) {
    const items = await recolectarItems(idPredio, hoy, hoy);
    return { fecha: hoy, items };
}
// ─── RF_16 - calendario general ──────────────────────────────────────────────
/**
 * Rango efectivo del calendario. Sin parametros, el mes calendario en curso, que
 * es lo que la app pide al abrir la pantalla del calendario.
 */
function resolverRango(filtros, hoy = (0, fechas_1.fechaLocalISO)()) {
    const mes = mesDe(hoy);
    const desde = filtros.desde ?? mes.desde;
    const hasta = filtros.hasta ?? mes.hasta;
    if (hasta < desde) {
        throw new errores_1.ErrorReglaNegocio('RANGO_INVALIDO', 'La fecha final del rango no puede ser anterior a la inicial.');
    }
    if ((0, fechas_1.diferenciaDias)(desde, hasta) + 1 > exports.DIAS_MAXIMOS_RANGO) {
        throw new errores_1.ErrorReglaNegocio('RANGO_INVALIDO', 'El rango no puede superar un año.');
    }
    return { desde, hasta };
}
/**
 * Calendario general. No se pagina a proposito: un mes de un predio artesanal
 * son decenas de items, y paginar obligaria a la app a pedir varias paginas
 * antes de poder pintar los puntos de un mes completo.
 */
async function obtenerAgendaDelRango(idPredio, filtros) {
    const { desde, hasta } = resolverRango(filtros);
    const items = await recolectarItems(idPredio, desde, hasta);
    return { desde, hasta, items, porDia: contarPorDia(items) };
}
async function recolectarItems(idPredio, desde, hasta) {
    const [eventos, tareas] = await Promise.all([
        db_1.prisma.evento.findMany({
            where: {
                idPredio,
                // RF_10 - los eventos eliminados son un soft delete: nunca se muestran.
                estado: { not: 'ELIMINADO' },
                fechaInicio: { gte: (0, fechas_1.inicioDelDia)(desde), lt: (0, fechas_1.finDelDia)(hasta) },
            },
            select: {
                id: true,
                tipo: true,
                descripcion: true,
                fechaInicio: true,
                estado: true,
                _count: { select: { animales: true } },
            },
        }),
        db_1.prisma.tarea.findMany({
            where: {
                idPredio,
                fechaLimite: { gte: (0, fechas_1.aFechaSolo)(desde), lte: (0, fechas_1.aFechaSolo)(hasta) },
            },
            select: {
                id: true,
                titulo: true,
                descripcion: true,
                fechaLimite: true,
                estado: true,
                completadaEn: true,
                responsables: { select: { usuario: { select: { id: true, nombre: true } } } },
            },
        }),
    ]);
    const fechados = [
        ...eventos.map((e) => ({
            // El dia de un evento es el dia LOCAL del predio, no el dia UTC.
            dia: (0, fechas_1.fechaLocalISO)(e.fechaInicio),
            item: {
                id: e.id,
                clase: 'EVENTO',
                tipo: e.tipo,
                titulo: (0, bitacora_servicio_1.etiquetaTipoEvento)(e.tipo),
                descripcion: e.descripcion,
                fecha: e.fechaInicio,
                estado: e.estado,
                meta: { animales: e._count.animales },
            },
        })),
        ...tareas.map((t) => ({
            // `fechaLimite` es @db.Date: ya es una fecha sin hora, se lee tal cual.
            dia: t.fechaLimite.toISOString().slice(0, 10),
            item: {
                id: t.id,
                clase: 'TAREA',
                tipo: 'TAREA',
                titulo: t.titulo,
                descripcion: t.descripcion,
                fecha: t.fechaLimite,
                estado: t.estado,
                meta: {
                    responsables: t.responsables.map((r) => ({ id: r.usuario.id, nombre: r.usuario.nombre })),
                    completadaEn: t.completadaEn,
                },
            },
        })),
    ];
    // Primero por dia calendario y despues por instante: una tarea se guarda a
    // medianoche UTC, que en Chile cae la tarde anterior, asi que ordenar solo por
    // `fecha` la colaria antes de los eventos del dia previo.
    fechados.sort((a, b) => a.dia === b.dia ? a.item.fecha.getTime() - b.item.fecha.getTime() : a.dia < b.dia ? -1 : 1);
    return fechados.map((f) => f.item);
}
/**
 * Conteos por dia para los puntos azules (eventos) y verdes (tareas) del
 * calendario. Solo aparecen los dias con actividad: los vacios no se envian.
 */
function contarPorDia(items) {
    const porDia = {};
    for (const item of items) {
        const dia = diaDelItem(item);
        const casilla = (porDia[dia] ??= { eventos: 0, tareas: 0 });
        if (item.clase === 'EVENTO')
            casilla.eventos += 1;
        else
            casilla.tareas += 1;
    }
    return porDia;
}
function diaDelItem(item) {
    return item.clase === 'EVENTO' ? (0, fechas_1.fechaLocalISO)(item.fecha) : item.fecha.toISOString().slice(0, 10);
}
/** Primer y ultimo dia del mes calendario al que pertenece la fecha dada. */
function mesDe(iso) {
    const anio = Number(iso.slice(0, 4));
    const mes = Number(iso.slice(5, 7));
    // Dia 0 del mes siguiente = ultimo dia de este mes, bisiestos incluidos.
    const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
    const mm = String(mes).padStart(2, '0');
    return { desde: `${anio}-${mm}-01`, hasta: `${anio}-${mm}-${String(ultimo).padStart(2, '0')}` };
}
//# sourceMappingURL=agenda.servicio.js.map
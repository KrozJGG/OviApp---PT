"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MINUTOS_EN_LINEA = void 0;
exports.aDto = aDto;
exports.ingestarAlerta = ingestarAlerta;
exports.registrarHeartbeat = registrarHeartbeat;
exports.cuerpoNotificacion = cuerpoNotificacion;
exports.listarAlertas = listarAlertas;
exports.obtenerAlerta = obtenerAlerta;
exports.revisarAlerta = revisarAlerta;
exports.estaEnLinea = estaEnLinea;
exports.estadoVigilancia = estadoVigilancia;
const logger_1 = require("../../config/logger");
const db_1 = require("../../shared/db");
const errores_1 = require("../../shared/errores");
const fechas_1 = require("../../shared/fechas");
const paginacion_1 = require("../../shared/paginacion");
const push_servicio_1 = require("../notificaciones/push.servicio");
/**
 * Reglas de negocio del Modulo 6 - Vigilancia y deteccion (RF_17 a RF_19).
 *
 * La deteccion en si corre en el dispositivo edge; el servidor recibe la senal,
 * la almacena, avisa a los usuarios del predio (RF_18) y la expone como
 * historial (RF_19).
 */
/** Minutos sin latido tras los cuales un dispositivo se considera fuera de linea. */
exports.MINUTOS_EN_LINEA = 15;
const MS_EN_LINEA = exports.MINUTOS_EN_LINEA * 60 * 1000;
/** Relaciones que necesita `aDto`. */
const relacionesAlerta = {
    revisadoPor: { select: { id: true, nombre: true } },
    dispositivoEdge: { select: { id: true, nombre: true } },
};
function aDto(fila) {
    return {
        id: fila.id,
        tipoAlerta: fila.tipoAlerta,
        descripcion: fila.descripcion,
        nivel: fila.nivel,
        conteoAnimales: fila.conteoAnimales,
        conteoEsperado: fila.conteoEsperado,
        fechaHora: fila.fechaHora,
        estado: fila.estado,
        fechaRevision: fila.fechaRevision,
        revisadoPor: fila.revisadoPor,
        dispositivo: fila.dispositivoEdge,
    };
}
/**
 * RF_17 - almacena la alerta emitida por el dispositivo edge.
 *
 * Es idempotente a proposito: la conectividad rural es intermitente y el
 * dispositivo reintenta. La clave (dispositivo, fechaHora, tipoAlerta) identifica
 * el mismo hecho detectado, asi que un reintento devuelve la alerta ya guardada
 * en vez de duplicarla o de fallar, y no vuelve a notificar.
 */
async function ingestarAlerta(edge, datos) {
    const fechaHora = new Date(datos.timestamp);
    // El latido se actualiza siempre, tambien en un reintento: si el dispositivo
    // habla, esta vivo.
    const dispositivo = await tocarDispositivo(edge.idDispositivo, datos.conteoAnimales);
    const yaGuardada = await buscarGemela(edge.idDispositivo, fechaHora, datos.tipoAlerta);
    if (yaGuardada) {
        return { idAlerta: yaGuardada, duplicada: true };
    }
    const datosAlerta = {
        idPredio: edge.idPredio,
        idDispositivoEdge: edge.idDispositivo,
        tipoAlerta: datos.tipoAlerta,
        descripcion: datos.descripcion ?? null,
        conteoAnimales: datos.conteoAnimales ?? null,
        conteoEsperado: datos.conteoEsperado ?? dispositivo.conteoEsperado,
        fechaHora,
        ...(datos.nivel ? { nivel: datos.nivel } : {}),
    };
    let idAlerta;
    try {
        const creada = await db_1.prisma.alerta.create({ data: datosAlerta, select: { id: true } });
        idAlerta = creada.id;
    }
    catch (e) {
        // Carrera entre dos reintentos simultaneos: la unicidad uq_alerta_edge la
        // resuelve la base, y el segundo se comporta como el duplicado que es.
        if (!esUnicidadVulnerada(e))
            throw e;
        const gemela = await buscarGemela(edge.idDispositivo, fechaHora, datos.tipoAlerta);
        if (!gemela)
            throw e;
        return { idAlerta: gemela, duplicada: true };
    }
    await notificarAlerta({
        idAlerta,
        idPredio: edge.idPredio,
        nombreDispositivo: dispositivo.nombre,
        tipoAlerta: datos.tipoAlerta,
        conteoAnimales: datos.conteoAnimales ?? null,
        conteoEsperado: datosAlerta.conteoEsperado,
        descripcion: datos.descripcion ?? null,
        fechaHora,
    });
    return { idAlerta, duplicada: false };
}
/** Latido del dispositivo: alimenta el indicador "en linea" de IF2-SAL. */
async function registrarHeartbeat(idDispositivo, datos) {
    await tocarDispositivo(idDispositivo, datos.conteoActual);
}
async function tocarDispositivo(idDispositivo, conteo) {
    return db_1.prisma.dispositivoEdge.update({
        where: { id: idDispositivo },
        data: {
            ultimoHeartbeat: new Date(),
            ...(conteo === undefined ? {} : { ultimoConteo: conteo }),
        },
        select: { nombre: true, conteoEsperado: true },
    });
}
async function buscarGemela(idDispositivo, fechaHora, tipoAlerta) {
    const fila = await db_1.prisma.alerta.findFirst({
        where: { idDispositivoEdge: idDispositivo, fechaHora, tipoAlerta },
        select: { id: true },
    });
    return fila?.id ?? null;
}
function esUnicidadVulnerada(e) {
    return typeof e === 'object' && e !== null && e.code === 'P2002';
}
const TITULO_POR_TIPO = {
    CONTEO: 'Alerta de conteo',
    DISPERSION: 'Alerta de dispersión',
    AMENAZA: 'Alerta de amenaza',
};
/**
 * RF_18 - avisa a todos los usuarios habilitados del predio.
 *
 * Nunca hace fallar la ingesta: la alerta ya quedo almacenada y consultable
 * (RF_17, RF_19), asi que una caida del canal push se registra y se sigue.
 */
async function notificarAlerta(aviso) {
    try {
        const destinatarios = await (0, push_servicio_1.usuariosDelPredio)(aviso.idPredio);
        await (0, push_servicio_1.enviarAUsuarios)(destinatarios, {
            titulo: TITULO_POR_TIPO[aviso.tipoAlerta],
            cuerpo: cuerpoNotificacion(aviso),
            // Deep-link: la app abre el detalle de la alerta al tocar la notificacion.
            datos: { tipo: 'ALERTA', idAlerta: aviso.idAlerta },
        });
    }
    catch (e) {
        logger_1.logger.error({ err: e, idAlerta: aviso.idAlerta, idPredio: aviso.idPredio }, 'No se pudo enviar la notificacion push de la alerta; la alerta si quedo almacenada.');
    }
}
/** Tipo de evento, hora y cantidad de ovejas detectadas, como pide RF_18. */
function cuerpoNotificacion(aviso) {
    const partes = [`${aviso.nombreDispositivo}, ${horaLocal(aviso.fechaHora)} h.`];
    if (aviso.conteoAnimales !== null) {
        const ovejas = aviso.conteoAnimales === 1 ? '1 oveja detectada' : `${aviso.conteoAnimales} ovejas detectadas`;
        partes.push(aviso.conteoEsperado !== null ? `${ovejas} de ${aviso.conteoEsperado} esperadas.` : `${ovejas}.`);
    }
    if (aviso.descripcion) {
        partes.push(aviso.descripcion);
    }
    return partes.join(' ');
}
function horaLocal(instante) {
    return new Intl.DateTimeFormat('es-CL', {
        timeZone: fechas_1.ZONA_HORARIA,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(instante);
}
// ─────────────────────────────────────────────────────────────────────────────
// Historial de alertas (RF_19)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * RF_19 - historial del predio del usuario en sesion.
 * El filtro por `idPredio` no es opcional: es el aislamiento de RNF_08.
 */
async function listarAlertas(idPredio, filtros) {
    if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
        throw new errores_1.ErrorReglaNegocio('RANGO_INVALIDO', 'La fecha inicial del rango no puede ser posterior a la final.');
    }
    const rango = {
        ...(filtros.desde ? { gte: (0, fechas_1.inicioDelDia)(filtros.desde) } : {}),
        ...(filtros.hasta ? { lt: (0, fechas_1.finDelDia)(filtros.hasta) } : {}),
    };
    const where = {
        idPredio,
        ...(filtros.tipo ? { tipoAlerta: filtros.tipo } : {}),
        ...(filtros.estado ? { estado: filtros.estado } : {}),
        ...(filtros.desde || filtros.hasta ? { fechaHora: rango } : {}),
    };
    const [filas, total] = await Promise.all([
        db_1.prisma.alerta.findMany({
            where,
            include: relacionesAlerta,
            orderBy: { fechaHora: 'desc' },
            ...(0, paginacion_1.aSkipTake)(filtros),
        }),
        db_1.prisma.alerta.count({ where }),
    ]);
    return (0, paginacion_1.paginar)(filas.map(aDto), total, filtros);
}
/** Detalle de una alerta. Destino del deep-link de la notificacion (RF_18). */
async function obtenerAlerta(idPredio, id) {
    const fila = await db_1.prisma.alerta.findFirst({
        where: { id, idPredio },
        include: relacionesAlerta,
    });
    if (!fila) {
        throw new errores_1.ErrorNoEncontrado('No se encontró la alerta solicitada.');
    }
    return aDto(fila);
}
/**
 * Marca la alerta como revisada. Deja constancia de quien la reviso y cuando,
 * que es lo que convierte el listado en un historial util y no en una bandeja
 * que se llena sola.
 */
async function revisarAlerta(idPredio, idUsuario, id) {
    const actual = await db_1.prisma.alerta.findFirst({
        where: { id, idPredio },
        select: { id: true, estado: true },
    });
    if (!actual) {
        throw new errores_1.ErrorNoEncontrado('No se encontró la alerta solicitada.');
    }
    if (actual.estado === 'REVISADA') {
        throw new errores_1.ErrorConflicto('ALERTA_YA_REVISADA', 'Esta alerta ya fue marcada como revisada.');
    }
    const fila = await db_1.prisma.alerta.update({
        where: { id: actual.id },
        data: { estado: 'REVISADA', idRevisadoPor: idUsuario, fechaRevision: new Date() },
        include: relacionesAlerta,
    });
    return aDto(fila);
}
/** Un dispositivo esta en linea si latio dentro de los ultimos 15 minutos. */
function estaEnLinea(ultimoHeartbeat, ahora = new Date()) {
    if (!ultimoHeartbeat)
        return false;
    return ahora.getTime() - ultimoHeartbeat.getTime() <= MS_EN_LINEA;
}
/** IF2-SAL - encabezado de la pantalla de vigilancia. */
async function estadoVigilancia(idPredio) {
    const [dispositivos, alertasSinRevisar, ultima] = await Promise.all([
        db_1.prisma.dispositivoEdge.findMany({
            where: { idPredio },
            select: {
                id: true,
                nombre: true,
                ultimoHeartbeat: true,
                ultimoConteo: true,
                conteoEsperado: true,
            },
            orderBy: { nombre: 'asc' },
        }),
        db_1.prisma.alerta.count({ where: { idPredio, estado: 'NUEVA' } }),
        db_1.prisma.alerta.findFirst({
            where: { idPredio },
            orderBy: { fechaHora: 'desc' },
            select: {
                id: true,
                tipoAlerta: true,
                descripcion: true,
                nivel: true,
                conteoAnimales: true,
                fechaHora: true,
            },
        }),
    ]);
    const ahora = new Date();
    return {
        dispositivos: dispositivos.map((d) => ({ ...d, enLinea: estaEnLinea(d.ultimoHeartbeat, ahora) })),
        alertasSinRevisar,
        ultimaAlerta: ultima,
    };
}
//# sourceMappingURL=alertas.servicio.js.map
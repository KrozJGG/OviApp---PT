"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZONA_HORARIA = void 0;
exports.fechaLocalISO = fechaLocalISO;
exports.aFechaSolo = aFechaSolo;
exports.inicioDelDia = inicioDelDia;
exports.finDelDia = finDelDia;
exports.sumarDias = sumarDias;
exports.diferenciaDias = diferenciaDias;
exports.esPasada = esPasada;
/**
 * Utilidades de fecha.
 *
 * El predio opera en una sola zona horaria (sur de Chile), asi que "hoy" se
 * calcula siempre contra la zona configurada y no contra UTC: si no, entre las
 * 21:00 y medianoche el resumen del dia (RF_15) mostraria el dia siguiente.
 */
exports.ZONA_HORARIA = 'America/Santiago';
/** Fecha local (YYYY-MM-DD) del instante dado en la zona del predio. */
function fechaLocalISO(instante = new Date(), zona = exports.ZONA_HORARIA) {
    const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: zona,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    return fmt.format(instante);
}
/** Convierte 'YYYY-MM-DD' al Date de medianoche UTC que Prisma guarda en @db.Date. */
function aFechaSolo(iso) {
    return new Date(`${iso}T00:00:00.000Z`);
}
/** Inicio del dia local, expresado como instante absoluto. */
function inicioDelDia(iso, zona = exports.ZONA_HORARIA) {
    return new Date(`${iso}T00:00:00${desplazamiento(iso, zona)}`);
}
/** Fin del dia local (exclusivo): el instante en que empieza el dia siguiente. */
function finDelDia(iso, zona = exports.ZONA_HORARIA) {
    const siguiente = sumarDias(iso, 1);
    return inicioDelDia(siguiente, zona);
}
function sumarDias(iso, dias) {
    const base = new Date(`${iso}T12:00:00.000Z`);
    base.setUTCDate(base.getUTCDate() + dias);
    return base.toISOString().slice(0, 10);
}
/** Diferencia en dias calendario entre dos fechas ISO (b - a). */
function diferenciaDias(a, b) {
    const ms = Date.parse(`${b}T12:00:00.000Z`) - Date.parse(`${a}T12:00:00.000Z`);
    return Math.round(ms / 86_400_000);
}
/** true si la fecha ISO es anterior a hoy en la zona del predio. */
function esPasada(iso, hoy = fechaLocalISO()) {
    return iso < hoy;
}
/**
 * Desplazamiento UTC ('-04:00' / '-03:00') de la zona en esa fecha.
 * Chile cambia de horario dos veces al ano, asi que no se puede fijar.
 */
function desplazamiento(iso, zona) {
    const referencia = new Date(`${iso}T12:00:00.000Z`);
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: zona,
        timeZoneName: 'longOffset',
    });
    const parte = fmt.formatToParts(referencia).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+00:00';
    const signo = parte.replace('GMT', '').trim();
    return signo === '' ? '+00:00' : signo;
}
//# sourceMappingURL=fechas.js.map
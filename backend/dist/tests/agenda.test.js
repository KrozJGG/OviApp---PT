"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const prisma_1 = require("../src/config/prisma");
const fechas_1 = require("../src/shared/fechas");
const fixtures_1 = require("./apoyo/fixtures");
/**
 * Modulo 5 - Pantalla de inicio y calendario (RF_15, RF_16).
 *
 * Los modulos 3 (eventos) y 4 (tareas) se implementan en paralelo, asi que aqui
 * los datos se siembran directamente con Prisma: el modulo de agenda solo lee y
 * no depende de los endpoints de esos modulos.
 */
const HOY = (0, fechas_1.fechaLocalISO)();
/** Instante de hoy a la hora local indicada, en la zona del predio. */
function hoyALas(horas, minutos = 0) {
    return new Date((0, fechas_1.inicioDelDia)(HOY).getTime() + (horas * 60 + minutos) * 60_000);
}
async function crearEvento(args) {
    return prisma_1.prisma.evento.create({
        data: {
            idPredio: args.idPredio,
            idCreador: args.idCreador,
            tipo: args.tipo ?? 'ESQUILA',
            estado: args.estado ?? 'PROGRAMADO',
            descripcion: args.descripcion ?? null,
            fechaInicio: args.fechaInicio,
            ...(args.estado === 'ELIMINADO' ? { eliminadoEn: new Date() } : {}),
            ...(args.idAnimales?.length
                ? { animales: { create: args.idAnimales.map((idAnimal) => ({ idAnimal })) } }
                : {}),
        },
    });
}
async function crearTarea(args) {
    return prisma_1.prisma.tarea.create({
        data: {
            idPredio: args.idPredio,
            idCreador: args.idCreador,
            titulo: args.titulo ?? 'Revisar cerco',
            descripcion: args.descripcion ?? null,
            fechaLimite: (0, fechas_1.aFechaSolo)(args.fechaLimite),
            estado: args.estado ?? 'ACTIVA',
            ...(args.estado === 'COMPLETADA'
                ? { completadaEn: new Date(), idCompletadaPor: args.idCompletadaPor ?? args.idCreador }
                : {}),
            ...(args.idResponsables?.length
                ? { responsables: { create: args.idResponsables.map((idUsuario) => ({ idUsuario })) } }
                : {}),
        },
    });
}
async function crearAlerta(args) {
    return prisma_1.prisma.alerta.create({
        data: {
            idPredio: args.idPredio,
            tipoAlerta: args.tipoAlerta ?? 'CONTEO',
            estado: args.estado ?? 'NUEVA',
            descripcion: args.descripcion ?? null,
            fechaHora: args.fechaHora,
        },
    });
}
(0, vitest_1.describe)('Modulo 5 - Pantalla de inicio y calendario (RF_15, RF_16)', () => {
    let e;
    (0, vitest_1.beforeEach)(async () => {
        e = await (0, fixtures_1.crearEscenario)();
    });
    // ─── RF_15 - resumen de la pantalla de inicio ──────────────────────────────
    (0, vitest_1.describe)('GET /inicio/resumen (RF_15)', () => {
        (0, vitest_1.it)('devuelve las cuatro tarjetas del mockup', async () => {
            await prisma_1.prisma.animal.createMany({
                data: [
                    { idPredio: e.predioA.id, idRegistrador: e.productor.id, numeroOreja: '0002', sexo: 'MACHO' },
                    { idPredio: e.predioA.id, idRegistrador: e.productor.id, numeroOreja: '0003', sexo: 'HEMBRA' },
                ],
            });
            // Un animal dado de baja no cuenta como rebano activo (RF_04).
            await prisma_1.prisma.animal.create({
                data: {
                    idPredio: e.predioA.id,
                    idRegistrador: e.productor.id,
                    numeroOreja: '0004',
                    sexo: 'HEMBRA',
                    estado: 'INACTIVO',
                    motivoBaja: 'VENTA',
                    fechaBaja: (0, fechas_1.aFechaSolo)(HOY),
                },
            });
            await crearTarea({ idPredio: e.predioA.id, idCreador: e.productor.id, fechaLimite: HOY });
            await crearTarea({ idPredio: e.predioA.id, idCreador: e.productor.id, fechaLimite: HOY });
            await crearTarea({ idPredio: e.predioA.id, idCreador: e.productor.id, fechaLimite: HOY });
            // Ni las completadas ni las de otro dia entran en "tareas de hoy".
            await crearTarea({
                idPredio: e.predioA.id,
                idCreador: e.productor.id,
                fechaLimite: HOY,
                estado: 'COMPLETADA',
            });
            await crearTarea({
                idPredio: e.predioA.id,
                idCreador: e.productor.id,
                fechaLimite: (0, fechas_1.sumarDias)(HOY, 1),
            });
            await crearAlerta({ idPredio: e.predioA.id, fechaHora: hoyALas(8) });
            const ultima = await crearAlerta({
                idPredio: e.predioA.id,
                fechaHora: hoyALas(11),
                tipoAlerta: 'DISPERSION',
                descripcion: 'Animales fuera del sector norte.',
            });
            await crearAlerta({ idPredio: e.predioA.id, fechaHora: hoyALas(9), estado: 'REVISADA' });
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get('/inicio/resumen');
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.animalesActivos).toBe(3);
            (0, vitest_1.expect)(r.body.tareasHoy).toBe(3);
            (0, vitest_1.expect)(r.body.alertasSinLeer).toBe(2);
            (0, vitest_1.expect)(r.body.ultimaAlerta).toMatchObject({
                id: ultima.id,
                tipoAlerta: 'DISPERSION',
                descripcion: 'Animales fuera del sector norte.',
            });
        });
        (0, vitest_1.it)('devuelve ultimaAlerta null cuando el predio nunca recibio alertas', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get('/inicio/resumen');
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.ultimaAlerta).toBeNull();
            (0, vitest_1.expect)(r.body.alertasSinLeer).toBe(0);
        });
        (0, vitest_1.it)('el Trabajador tambien puede consultarlo', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.trabajador.token).get('/inicio/resumen');
            (0, vitest_1.expect)(r.status).toBe(200);
        });
        (0, vitest_1.it)('aisla los conteos por predio (RNF_08)', async () => {
            await crearTarea({ idPredio: e.predioA.id, idCreador: e.productor.id, fechaLimite: HOY });
            await crearAlerta({ idPredio: e.predioA.id, fechaHora: hoyALas(10) });
            const r = await (0, fixtures_1.api)(e.app, e.ajeno.token).get('/inicio/resumen');
            (0, vitest_1.expect)(r.status).toBe(200);
            // El predio B solo tiene su propio animal y ningun dato del predio A.
            (0, vitest_1.expect)(r.body.animalesActivos).toBe(1);
            (0, vitest_1.expect)(r.body.tareasHoy).toBe(0);
            (0, vitest_1.expect)(r.body.alertasSinLeer).toBe(0);
            (0, vitest_1.expect)(r.body.ultimaAlerta).toBeNull();
        });
        (0, vitest_1.it)('responde 401 sin token', async () => {
            const r = await (0, fixtures_1.api)(e.app).get('/inicio/resumen');
            (0, vitest_1.expect)(r.status).toBe(401);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('NO_AUTENTICADO');
        });
    });
    // ─── RF_15 - actividades del dia ───────────────────────────────────────────
    (0, vitest_1.describe)('GET /agenda/hoy (RF_15)', () => {
        (0, vitest_1.it)('unifica eventos y tareas del dia en una sola lista ordenada', async () => {
            const evento = await crearEvento({
                idPredio: e.predioA.id,
                idCreador: e.productor.id,
                tipo: 'ESQUILA',
                descripcion: 'Esquila del lote 1',
                fechaInicio: hoyALas(9),
                idAnimales: [e.animal.id],
            });
            const tarea = await crearTarea({
                idPredio: e.predioA.id,
                idCreador: e.productor.id,
                fechaLimite: HOY,
                titulo: 'Revisar bebederos',
                idResponsables: [e.trabajador.id],
            });
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get('/agenda/hoy');
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.fecha).toBe(HOY);
            (0, vitest_1.expect)(r.body.items).toHaveLength(2);
            const item = (id) => r.body.items.find((i) => i.id === id);
            (0, vitest_1.expect)(item(evento.id)).toMatchObject({
                clase: 'EVENTO',
                tipo: 'ESQUILA',
                titulo: 'Esquila',
                descripcion: 'Esquila del lote 1',
                estado: 'PROGRAMADO',
                meta: { animales: 1 },
            });
            (0, vitest_1.expect)(item(tarea.id)).toMatchObject({
                clase: 'TAREA',
                tipo: 'TAREA',
                titulo: 'Revisar bebederos',
                estado: 'ACTIVA',
                meta: {
                    responsables: [{ id: e.trabajador.id, nombre: 'Trabajador A' }],
                    completadaEn: null,
                },
            });
        });
        (0, vitest_1.it)('devuelve 200 con lista vacia cuando no hay actividades', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get('/agenda/hoy');
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.items).toEqual([]);
        });
        (0, vitest_1.it)('excluye los eventos eliminados (RF_10)', async () => {
            await crearEvento({
                idPredio: e.predioA.id,
                idCreador: e.productor.id,
                fechaInicio: hoyALas(10),
                estado: 'ELIMINADO',
            });
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get('/agenda/hoy');
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.items).toEqual([]);
        });
        (0, vitest_1.it)('incluye tareas de cualquier estado, tambien las completadas', async () => {
            await crearTarea({
                idPredio: e.predioA.id,
                idCreador: e.productor.id,
                fechaLimite: HOY,
                estado: 'COMPLETADA',
            });
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get('/agenda/hoy');
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.items).toHaveLength(1);
            (0, vitest_1.expect)(r.body.items[0].estado).toBe('COMPLETADA');
            (0, vitest_1.expect)(r.body.items[0].meta.completadaEn).not.toBeNull();
        });
        (0, vitest_1.it)('acota el dia en la zona horaria del predio, no en UTC', async () => {
            // 23:30 de hoy en Chile ya es manana en UTC: debe salir igual.
            const tarde = await crearEvento({
                idPredio: e.predioA.id,
                idCreador: e.productor.id,
                fechaInicio: hoyALas(23, 30),
            });
            // El primer instante de manana queda fuera.
            await crearEvento({
                idPredio: e.predioA.id,
                idCreador: e.productor.id,
                fechaInicio: (0, fechas_1.finDelDia)(HOY),
            });
            // Y el ultimo instante de ayer tambien.
            await crearEvento({
                idPredio: e.predioA.id,
                idCreador: e.productor.id,
                fechaInicio: new Date((0, fechas_1.inicioDelDia)(HOY).getTime() - 1),
            });
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get('/agenda/hoy');
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.items).toHaveLength(1);
            (0, vitest_1.expect)(r.body.items[0].id).toBe(tarde.id);
        });
        (0, vitest_1.it)('no muestra actividades de otro predio (RNF_08)', async () => {
            await crearEvento({
                idPredio: e.predioA.id,
                idCreador: e.productor.id,
                fechaInicio: hoyALas(9),
            });
            await crearTarea({ idPredio: e.predioA.id, idCreador: e.productor.id, fechaLimite: HOY });
            const r = await (0, fixtures_1.api)(e.app, e.ajeno.token).get('/agenda/hoy');
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.items).toEqual([]);
        });
        (0, vitest_1.it)('el Trabajador tambien puede consultarlo', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.trabajador.token).get('/agenda/hoy');
            (0, vitest_1.expect)(r.status).toBe(200);
        });
        (0, vitest_1.it)('responde 401 sin token', async () => {
            const r = await (0, fixtures_1.api)(e.app).get('/agenda/hoy');
            (0, vitest_1.expect)(r.status).toBe(401);
        });
    });
    // ─── RF_16 - calendario general ────────────────────────────────────────────
    (0, vitest_1.describe)('GET /agenda (RF_16)', () => {
        (0, vitest_1.it)('devuelve el rango pedido con sus items y los conteos por dia', async () => {
            const manana = (0, fechas_1.sumarDias)(HOY, 1);
            await crearEvento({
                idPredio: e.predioA.id,
                idCreador: e.productor.id,
                fechaInicio: hoyALas(9),
            });
            await crearEvento({
                idPredio: e.predioA.id,
                idCreador: e.productor.id,
                tipo: 'ENCASTE',
                fechaInicio: new Date((0, fechas_1.inicioDelDia)(manana).getTime() + 8 * 3_600_000),
            });
            await crearTarea({ idPredio: e.predioA.id, idCreador: e.productor.id, fechaLimite: manana });
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get(`/agenda?desde=${HOY}&hasta=${manana}`);
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.desde).toBe(HOY);
            (0, vitest_1.expect)(r.body.hasta).toBe(manana);
            (0, vitest_1.expect)(r.body.items).toHaveLength(3);
            (0, vitest_1.expect)(r.body.porDia).toEqual({
                [HOY]: { eventos: 1, tareas: 0 },
                [manana]: { eventos: 1, tareas: 1 },
            });
        });
        (0, vitest_1.it)('ordena los items por fecha ascendente', async () => {
            const pasado = (0, fechas_1.sumarDias)(HOY, -3);
            const tarde = await crearEvento({
                idPredio: e.predioA.id,
                idCreador: e.productor.id,
                fechaInicio: hoyALas(18),
            });
            const temprano = await crearEvento({
                idPredio: e.predioA.id,
                idCreador: e.productor.id,
                fechaInicio: hoyALas(7),
            });
            const anterior = await crearTarea({
                idPredio: e.predioA.id,
                idCreador: e.productor.id,
                fechaLimite: pasado,
            });
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get(`/agenda?desde=${pasado}&hasta=${HOY}`);
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.items.map((i) => i.id)).toEqual([
                anterior.id,
                temprano.id,
                tarde.id,
            ]);
        });
        (0, vitest_1.it)('usa el mes calendario en curso cuando no se indica rango', async () => {
            const primeroDelMes = `${HOY.slice(0, 7)}-01`;
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get('/agenda');
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.desde).toBe(primeroDelMes);
            (0, vitest_1.expect)(r.body.hasta.slice(0, 7)).toBe(HOY.slice(0, 7));
            (0, vitest_1.expect)(r.body.hasta >= HOY).toBe(true);
        });
        (0, vitest_1.it)('navega al pasado y al futuro sin restriccion (RF_16)', async () => {
            const antiguo = await crearEvento({
                idPredio: e.predioA.id,
                idCreador: e.productor.id,
                fechaInicio: new Date((0, fechas_1.inicioDelDia)('2024-03-10').getTime() + 10 * 3_600_000),
            });
            const futuro = await crearTarea({
                idPredio: e.predioA.id,
                idCreador: e.productor.id,
                fechaLimite: '2030-11-20',
            });
            const pasado = await (0, fixtures_1.api)(e.app, e.productor.token).get('/agenda?desde=2024-03-01&hasta=2024-03-31');
            (0, vitest_1.expect)(pasado.status).toBe(200);
            (0, vitest_1.expect)(pasado.body.items).toHaveLength(1);
            (0, vitest_1.expect)(pasado.body.items[0].id).toBe(antiguo.id);
            const porVenir = await (0, fixtures_1.api)(e.app, e.productor.token).get('/agenda?desde=2030-11-01&hasta=2030-11-30');
            (0, vitest_1.expect)(porVenir.status).toBe(200);
            (0, vitest_1.expect)(porVenir.body.items[0].id).toBe(futuro.id);
        });
        (0, vitest_1.it)('acepta un rango de exactamente un ano bisiesto', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get('/agenda?desde=2024-01-01&hasta=2024-12-31');
            (0, vitest_1.expect)(r.status).toBe(200);
        });
        (0, vitest_1.it)('rechaza con 422 RANGO_INVALIDO si "hasta" es anterior a "desde"', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get('/agenda?desde=2026-05-10&hasta=2026-05-01');
            (0, vitest_1.expect)(r.status).toBe(422);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('RANGO_INVALIDO');
        });
        (0, vitest_1.it)('rechaza con 422 RANGO_INVALIDO un rango de mas de 366 dias', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get('/agenda?desde=2024-01-01&hasta=2025-01-02');
            (0, vitest_1.expect)(r.status).toBe(422);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('RANGO_INVALIDO');
            (0, vitest_1.expect)(r.body.error.mensaje).toBe('El rango no puede superar un año.');
        });
        (0, vitest_1.it)('rechaza con 400 una fecha mal formada', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get('/agenda?desde=10-05-2026');
            (0, vitest_1.expect)(r.status).toBe(400);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('VALIDACION');
            (0, vitest_1.expect)(r.body.error.detalles).toEqual([vitest_1.expect.objectContaining({ campo: 'desde' })]);
        });
        (0, vitest_1.it)('no filtra el calendario de otro predio (RNF_08)', async () => {
            await crearEvento({
                idPredio: e.predioA.id,
                idCreador: e.productor.id,
                fechaInicio: hoyALas(9),
            });
            const r = await (0, fixtures_1.api)(e.app, e.ajeno.token).get(`/agenda?desde=${HOY}&hasta=${HOY}`);
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.items).toEqual([]);
            (0, vitest_1.expect)(r.body.porDia).toEqual({});
        });
        (0, vitest_1.it)('el Trabajador tambien puede consultar el calendario', async () => {
            const extra = await (0, fixtures_1.crearUsuario)({
                idPredio: e.predioA.id,
                email: 'peon@test.cl',
                nombre: 'Peon A',
            });
            await crearTarea({
                idPredio: e.predioA.id,
                idCreador: e.productor.id,
                fechaLimite: HOY,
                idResponsables: [extra.id],
            });
            const r = await (0, fixtures_1.api)(e.app, e.trabajador.token).get(`/agenda?desde=${HOY}&hasta=${HOY}`);
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.items).toHaveLength(1);
            (0, vitest_1.expect)(r.body.items[0].meta.responsables).toEqual([{ id: extra.id, nombre: 'Peon A' }]);
        });
        (0, vitest_1.it)('responde 401 sin token', async () => {
            const r = await (0, fixtures_1.api)(e.app).get('/agenda');
            (0, vitest_1.expect)(r.status).toBe(401);
        });
    });
});
//# sourceMappingURL=agenda.test.js.map
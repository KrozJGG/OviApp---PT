"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const prisma_1 = require("../src/config/prisma");
const fechas_1 = require("../src/shared/fechas");
const fixtures_1 = require("./apoyo/fixtures");
/**
 * Modulo 6 - Vigilancia y deteccion (RF_17, RF_18, RF_19).
 *
 * El modelo de vision por computadora esta fuera de alcance: lo que se prueba
 * aqui es el lado servidor del contrato con el modulo edge (IF5-ENT), el
 * historial de alertas (RF_19) y el estado de vigilancia (IF2-SAL).
 */
const HORA_ALERTA = '2026-03-10T15:04:05.000Z';
/** Cliente del modulo edge: se autentica por API key, no por JWT. */
function edge(e, apiKey = e.dispositivoEdge.apiKey) {
    return {
        post: (ruta) => (0, fixtures_1.api)(e.app).post(ruta).set('X-Edge-Key', apiKey),
    };
}
/** Mediodia local del dia indicado, para probar los limites del rango. */
function mediodiaDe(fechaIso) {
    return new Date((0, fechas_1.inicioDelDia)(fechaIso).getTime() + 12 * 60 * 60 * 1000);
}
async function sembrarAlerta(e, args) {
    return prisma_1.prisma.alerta.create({
        data: {
            idPredio: args.idPredio ?? e.predioA.id,
            idDispositivoEdge: args.idDispositivoEdge === undefined ? e.dispositivoEdge.id : args.idDispositivoEdge,
            tipoAlerta: args.tipoAlerta ?? 'CONTEO',
            estado: args.estado ?? 'NUEVA',
            fechaHora: args.fechaHora,
            conteoAnimales: args.conteoAnimales ?? 8,
            conteoEsperado: 10,
        },
    });
}
(0, vitest_1.describe)('Vigilancia y deteccion (RF_17 a RF_19)', () => {
    let e;
    (0, vitest_1.beforeEach)(async () => {
        e = await (0, fixtures_1.crearEscenario)();
    });
    // ───────────────────────────────────────────────────────────────────────────
    // Ingesta desde el modulo edge
    // ───────────────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)('POST /edge/alertas (RF_17, IF5-ENT)', () => {
        (0, vitest_1.it)('almacena la alerta emitida por el dispositivo', async () => {
            const r = await edge(e).post('/edge/alertas').send({
                tipoAlerta: 'CONTEO',
                conteoAnimales: 7,
                nivel: 'CRITICA',
                descripcion: 'Faltan animales en el potrero norte',
                timestamp: HORA_ALERTA,
            });
            (0, vitest_1.expect)(r.status).toBe(201);
            (0, vitest_1.expect)(r.body).toEqual({ idAlerta: vitest_1.expect.any(String), duplicada: false });
            const guardada = await prisma_1.prisma.alerta.findUniqueOrThrow({ where: { id: r.body.idAlerta } });
            (0, vitest_1.expect)(guardada.idPredio).toBe(e.predioA.id);
            (0, vitest_1.expect)(guardada.idDispositivoEdge).toBe(e.dispositivoEdge.id);
            (0, vitest_1.expect)(guardada.tipoAlerta).toBe('CONTEO');
            (0, vitest_1.expect)(guardada.nivel).toBe('CRITICA');
            (0, vitest_1.expect)(guardada.conteoAnimales).toBe(7);
            (0, vitest_1.expect)(guardada.estado).toBe('NUEVA');
            // La marca de tiempo la emite el dispositivo, no el servidor.
            (0, vitest_1.expect)(guardada.fechaHora.toISOString()).toBe(HORA_ALERTA);
        });
        (0, vitest_1.it)('toma el conteo esperado del dispositivo cuando el cuerpo no lo trae', async () => {
            const r = await edge(e)
                .post('/edge/alertas')
                .send({ tipoAlerta: 'CONTEO', conteoAnimales: 7, timestamp: HORA_ALERTA });
            const guardada = await prisma_1.prisma.alerta.findUniqueOrThrow({ where: { id: r.body.idAlerta } });
            (0, vitest_1.expect)(guardada.conteoEsperado).toBe(10);
            // Nivel por defecto del MER.
            (0, vitest_1.expect)(guardada.nivel).toBe('ADVERTENCIA');
        });
        (0, vitest_1.it)('actualiza el ultimo latido y el ultimo conteo del dispositivo', async () => {
            await edge(e)
                .post('/edge/alertas')
                .send({ tipoAlerta: 'CONTEO', conteoAnimales: 7, timestamp: HORA_ALERTA });
            const dispositivo = await prisma_1.prisma.dispositivoEdge.findUniqueOrThrow({
                where: { id: e.dispositivoEdge.id },
            });
            (0, vitest_1.expect)(dispositivo.ultimoConteo).toBe(7);
            (0, vitest_1.expect)(dispositivo.ultimoHeartbeat).not.toBeNull();
        });
        (0, vitest_1.it)('es idempotente: un reintento devuelve 200 y no duplica la alerta', async () => {
            const cuerpo = { tipoAlerta: 'CONTEO', conteoAnimales: 7, timestamp: HORA_ALERTA };
            const primera = await edge(e).post('/edge/alertas').send(cuerpo);
            const reintento = await edge(e).post('/edge/alertas').send(cuerpo);
            (0, vitest_1.expect)(primera.status).toBe(201);
            (0, vitest_1.expect)(primera.body.duplicada).toBe(false);
            (0, vitest_1.expect)(reintento.status).toBe(200);
            (0, vitest_1.expect)(reintento.body).toEqual({ idAlerta: primera.body.idAlerta, duplicada: true });
            (0, vitest_1.expect)(await prisma_1.prisma.alerta.count({ where: { idPredio: e.predioA.id } })).toBe(1);
        });
        (0, vitest_1.it)('el reintento igual actualiza el latido del dispositivo', async () => {
            const cuerpo = { tipoAlerta: 'CONTEO', conteoAnimales: 7, timestamp: HORA_ALERTA };
            await edge(e).post('/edge/alertas').send(cuerpo);
            await prisma_1.prisma.dispositivoEdge.update({
                where: { id: e.dispositivoEdge.id },
                data: { ultimoHeartbeat: new Date('2020-01-01T00:00:00.000Z') },
            });
            const reintento = await edge(e).post('/edge/alertas').send(cuerpo);
            (0, vitest_1.expect)(reintento.body.duplicada).toBe(true);
            const dispositivo = await prisma_1.prisma.dispositivoEdge.findUniqueOrThrow({
                where: { id: e.dispositivoEdge.id },
            });
            (0, vitest_1.expect)(dispositivo.ultimoHeartbeat.getUTCFullYear()).toBeGreaterThan(2020);
        });
        (0, vitest_1.it)('distingue dos tipos de alerta con la misma marca de tiempo', async () => {
            const conteo = await edge(e)
                .post('/edge/alertas')
                .send({ tipoAlerta: 'CONTEO', timestamp: HORA_ALERTA });
            const amenaza = await edge(e)
                .post('/edge/alertas')
                .send({ tipoAlerta: 'AMENAZA', timestamp: HORA_ALERTA });
            (0, vitest_1.expect)(conteo.status).toBe(201);
            (0, vitest_1.expect)(amenaza.status).toBe(201);
            (0, vitest_1.expect)(await prisma_1.prisma.alerta.count({ where: { idPredio: e.predioA.id } })).toBe(2);
        });
        (0, vitest_1.it)('ignora un idPredio enviado en el cuerpo: usa el de la API key (RNF_08)', async () => {
            const r = await edge(e).post('/edge/alertas').send({
                tipoAlerta: 'CONTEO',
                timestamp: HORA_ALERTA,
                idPredio: e.predioB.id,
            });
            const guardada = await prisma_1.prisma.alerta.findUniqueOrThrow({ where: { id: r.body.idAlerta } });
            (0, vitest_1.expect)(guardada.idPredio).toBe(e.predioA.id);
        });
        (0, vitest_1.it)('rechaza un cuerpo invalido', async () => {
            const r = await edge(e)
                .post('/edge/alertas')
                .send({ tipoAlerta: 'INVENTADO', timestamp: HORA_ALERTA });
            (0, vitest_1.expect)(r.status).toBe(400);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('VALIDACION');
        });
        (0, vitest_1.it)('exige la marca de tiempo del dispositivo', async () => {
            const r = await edge(e).post('/edge/alertas').send({ tipoAlerta: 'CONTEO' });
            (0, vitest_1.expect)(r.status).toBe(400);
            (0, vitest_1.expect)(r.body.error.detalles).toEqual([vitest_1.expect.objectContaining({ campo: 'timestamp' })]);
        });
        (0, vitest_1.it)('rechaza una API key invalida', async () => {
            const r = await edge(e, 'edge_test.clave-equivocada')
                .post('/edge/alertas')
                .send({ tipoAlerta: 'CONTEO', timestamp: HORA_ALERTA });
            (0, vitest_1.expect)(r.status).toBe(401);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('API_KEY_INVALIDA');
            (0, vitest_1.expect)(await prisma_1.prisma.alerta.count()).toBe(0);
        });
        (0, vitest_1.it)('rechaza el token de un usuario: la ingesta es solo para dispositivos', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .post('/edge/alertas')
                .send({ tipoAlerta: 'CONTEO', timestamp: HORA_ALERTA });
            (0, vitest_1.expect)(r.status).toBe(401);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('API_KEY_INVALIDA');
        });
    });
    (0, vitest_1.describe)('POST /edge/heartbeat', () => {
        (0, vitest_1.it)('registra el latido y el conteo actual', async () => {
            const r = await edge(e)
                .post('/edge/heartbeat')
                .send({ conteoActual: 9, timestamp: HORA_ALERTA });
            (0, vitest_1.expect)(r.status).toBe(204);
            (0, vitest_1.expect)(r.body).toEqual({});
            const dispositivo = await prisma_1.prisma.dispositivoEdge.findUniqueOrThrow({
                where: { id: e.dispositivoEdge.id },
            });
            (0, vitest_1.expect)(dispositivo.ultimoConteo).toBe(9);
            (0, vitest_1.expect)(dispositivo.ultimoHeartbeat).not.toBeNull();
        });
        (0, vitest_1.it)('conserva el ultimo conteo si el latido no lo trae', async () => {
            await edge(e).post('/edge/heartbeat').send({ conteoActual: 9, timestamp: HORA_ALERTA });
            await edge(e).post('/edge/heartbeat').send({ timestamp: HORA_ALERTA });
            const dispositivo = await prisma_1.prisma.dispositivoEdge.findUniqueOrThrow({
                where: { id: e.dispositivoEdge.id },
            });
            (0, vitest_1.expect)(dispositivo.ultimoConteo).toBe(9);
        });
        (0, vitest_1.it)('exige API key', async () => {
            const r = await (0, fixtures_1.api)(e.app).post('/edge/heartbeat').send({ timestamp: HORA_ALERTA });
            (0, vitest_1.expect)(r.status).toBe(401);
        });
    });
    // ───────────────────────────────────────────────────────────────────────────
    // Historial (RF_19)
    // ───────────────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)('GET /alertas (RF_19)', () => {
        (0, vitest_1.beforeEach)(async () => {
            await sembrarAlerta(e, { fechaHora: mediodiaDe('2026-03-10'), tipoAlerta: 'CONTEO' });
            await sembrarAlerta(e, {
                fechaHora: mediodiaDe('2026-03-12'),
                tipoAlerta: 'AMENAZA',
                estado: 'REVISADA',
            });
            await sembrarAlerta(e, {
                idPredio: e.predioB.id,
                idDispositivoEdge: null,
                fechaHora: mediodiaDe('2026-03-11'),
            });
        });
        (0, vitest_1.it)('devuelve el historial del predio, mas reciente primero', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get('/alertas');
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.meta).toMatchObject({ pagina: 1, total: 2, totalPaginas: 1 });
            (0, vitest_1.expect)(r.body.datos).toHaveLength(2);
            (0, vitest_1.expect)(r.body.datos[0].tipoAlerta).toBe('AMENAZA');
            (0, vitest_1.expect)(r.body.datos[1].tipoAlerta).toBe('CONTEO');
        });
        (0, vitest_1.it)('el Trabajador tambien consulta el historial', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.trabajador.token).get('/alertas');
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.meta.total).toBe(2);
        });
        (0, vitest_1.it)('no expone las alertas de otro predio (RNF_08)', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.ajeno.token).get('/alertas');
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.meta.total).toBe(1);
            (0, vitest_1.expect)(r.body.datos[0].dispositivo).toBeNull();
        });
        (0, vitest_1.it)('filtra por rango de fechas sobre fechaHora', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get('/alertas?desde=2026-03-12&hasta=2026-03-12');
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.meta.total).toBe(1);
            (0, vitest_1.expect)(r.body.datos[0].tipoAlerta).toBe('AMENAZA');
        });
        (0, vitest_1.it)('filtra por tipo y por estado', async () => {
            const porTipo = await (0, fixtures_1.api)(e.app, e.productor.token).get('/alertas?tipo=CONTEO');
            (0, vitest_1.expect)(porTipo.body.meta.total).toBe(1);
            const porEstado = await (0, fixtures_1.api)(e.app, e.productor.token).get('/alertas?estado=REVISADA');
            (0, vitest_1.expect)(porEstado.body.meta.total).toBe(1);
            (0, vitest_1.expect)(porEstado.body.datos[0].estado).toBe('REVISADA');
        });
        (0, vitest_1.it)('pagina el resultado', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get('/alertas?pagina=2&tamano=1');
            (0, vitest_1.expect)(r.body.datos).toHaveLength(1);
            (0, vitest_1.expect)(r.body.meta).toMatchObject({ pagina: 2, tamano: 1, total: 2, totalPaginas: 2 });
            (0, vitest_1.expect)(r.body.datos[0].tipoAlerta).toBe('CONTEO');
        });
        (0, vitest_1.it)('rechaza un rango de fechas invertido', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get('/alertas?desde=2026-03-12&hasta=2026-03-10');
            (0, vitest_1.expect)(r.status).toBe(422);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('RANGO_INVALIDO');
        });
        (0, vitest_1.it)('rechaza una fecha con formato invalido', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get('/alertas?desde=10-03-2026');
            (0, vitest_1.expect)(r.status).toBe(400);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('VALIDACION');
        });
        (0, vitest_1.it)('responde 401 sin token', async () => {
            const r = await (0, fixtures_1.api)(e.app).get('/alertas');
            (0, vitest_1.expect)(r.status).toBe(401);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('NO_AUTENTICADO');
        });
    });
    (0, vitest_1.describe)('GET /alertas/:id', () => {
        (0, vitest_1.it)('devuelve el detalle con el dispositivo que la emitio', async () => {
            const alerta = await sembrarAlerta(e, { fechaHora: mediodiaDe('2026-03-10') });
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get(`/alertas/${alerta.id}`);
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body).toMatchObject({
                id: alerta.id,
                tipoAlerta: 'CONTEO',
                nivel: 'ADVERTENCIA',
                conteoAnimales: 8,
                conteoEsperado: 10,
                estado: 'NUEVA',
                fechaRevision: null,
                revisadoPor: null,
                dispositivo: { id: e.dispositivoEdge.id, nombre: 'Camara de prueba' },
            });
        });
        (0, vitest_1.it)('responde 404 si la alerta es de otro predio (RNF_08)', async () => {
            const alerta = await sembrarAlerta(e, { fechaHora: mediodiaDe('2026-03-10') });
            const r = await (0, fixtures_1.api)(e.app, e.ajeno.token).get(`/alertas/${alerta.id}`);
            (0, vitest_1.expect)(r.status).toBe(404);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('NO_ENCONTRADO');
        });
        (0, vitest_1.it)('responde 404 si no existe', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get('/alertas/00000000-0000-4000-8000-000000000000');
            (0, vitest_1.expect)(r.status).toBe(404);
        });
        (0, vitest_1.it)('responde 400 si el identificador no es un UUID', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get('/alertas/no-es-uuid');
            (0, vitest_1.expect)(r.status).toBe(400);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('VALIDACION');
        });
        (0, vitest_1.it)('responde 401 sin token', async () => {
            const alerta = await sembrarAlerta(e, { fechaHora: mediodiaDe('2026-03-10') });
            const r = await (0, fixtures_1.api)(e.app).get(`/alertas/${alerta.id}`);
            (0, vitest_1.expect)(r.status).toBe(401);
        });
    });
    (0, vitest_1.describe)('POST /alertas/:id/revisar', () => {
        (0, vitest_1.it)('marca la alerta como revisada y deja constancia de quien la reviso', async () => {
            const alerta = await sembrarAlerta(e, { fechaHora: mediodiaDe('2026-03-10') });
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).post(`/alertas/${alerta.id}/revisar`);
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body).toMatchObject({
                id: alerta.id,
                estado: 'REVISADA',
                revisadoPor: { id: e.productor.id, nombre: 'Productora A' },
            });
            (0, vitest_1.expect)(r.body.fechaRevision).not.toBeNull();
            const guardada = await prisma_1.prisma.alerta.findUniqueOrThrow({ where: { id: alerta.id } });
            (0, vitest_1.expect)(guardada.estado).toBe('REVISADA');
            (0, vitest_1.expect)(guardada.idRevisadoPor).toBe(e.productor.id);
            (0, vitest_1.expect)(guardada.fechaRevision).not.toBeNull();
        });
        (0, vitest_1.it)('el Trabajador tambien puede revisar', async () => {
            const alerta = await sembrarAlerta(e, { fechaHora: mediodiaDe('2026-03-10') });
            const r = await (0, fixtures_1.api)(e.app, e.trabajador.token).post(`/alertas/${alerta.id}/revisar`);
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.revisadoPor.id).toBe(e.trabajador.id);
        });
        (0, vitest_1.it)('rechaza revisar dos veces la misma alerta', async () => {
            const alerta = await sembrarAlerta(e, {
                fechaHora: mediodiaDe('2026-03-10'),
                estado: 'REVISADA',
            });
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).post(`/alertas/${alerta.id}/revisar`);
            (0, vitest_1.expect)(r.status).toBe(409);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('ALERTA_YA_REVISADA');
        });
        (0, vitest_1.it)('responde 404 si la alerta es de otro predio (RNF_08)', async () => {
            const alerta = await sembrarAlerta(e, { fechaHora: mediodiaDe('2026-03-10') });
            const r = await (0, fixtures_1.api)(e.app, e.ajeno.token).post(`/alertas/${alerta.id}/revisar`);
            (0, vitest_1.expect)(r.status).toBe(404);
            const guardada = await prisma_1.prisma.alerta.findUniqueOrThrow({ where: { id: alerta.id } });
            (0, vitest_1.expect)(guardada.estado).toBe('NUEVA');
        });
        (0, vitest_1.it)('responde 401 sin token', async () => {
            const alerta = await sembrarAlerta(e, { fechaHora: mediodiaDe('2026-03-10') });
            const r = await (0, fixtures_1.api)(e.app).post(`/alertas/${alerta.id}/revisar`);
            (0, vitest_1.expect)(r.status).toBe(401);
        });
    });
    // ───────────────────────────────────────────────────────────────────────────
    // Estado de vigilancia (IF2-SAL)
    // ───────────────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)('GET /vigilancia/estado (IF2-SAL)', () => {
        (0, vitest_1.it)('lista los dispositivos del predio, fuera de linea si nunca latieron', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get('/vigilancia/estado');
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.dispositivos).toHaveLength(1);
            (0, vitest_1.expect)(r.body.dispositivos[0]).toMatchObject({
                id: e.dispositivoEdge.id,
                nombre: 'Camara de prueba',
                ultimoHeartbeat: null,
                ultimoConteo: null,
                conteoEsperado: 10,
                enLinea: false,
            });
            (0, vitest_1.expect)(r.body.alertasSinRevisar).toBe(0);
            (0, vitest_1.expect)(r.body.ultimaAlerta).toBeNull();
        });
        (0, vitest_1.it)('marca el dispositivo en linea tras un latido reciente', async () => {
            await edge(e).post('/edge/heartbeat').send({ conteoActual: 9, timestamp: HORA_ALERTA });
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get('/vigilancia/estado');
            (0, vitest_1.expect)(r.body.dispositivos[0].enLinea).toBe(true);
            (0, vitest_1.expect)(r.body.dispositivos[0].ultimoConteo).toBe(9);
        });
        (0, vitest_1.it)('marca el dispositivo fuera de linea si el latido tiene mas de 15 minutos', async () => {
            await prisma_1.prisma.dispositivoEdge.update({
                where: { id: e.dispositivoEdge.id },
                data: { ultimoHeartbeat: new Date(Date.now() - 16 * 60 * 1000) },
            });
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get('/vigilancia/estado');
            (0, vitest_1.expect)(r.body.dispositivos[0].enLinea).toBe(false);
        });
        (0, vitest_1.it)('cuenta las alertas sin revisar y muestra la mas reciente', async () => {
            await sembrarAlerta(e, { fechaHora: mediodiaDe('2026-03-10'), tipoAlerta: 'CONTEO' });
            await sembrarAlerta(e, { fechaHora: mediodiaDe('2026-03-12'), tipoAlerta: 'AMENAZA' });
            await sembrarAlerta(e, {
                fechaHora: mediodiaDe('2026-03-11'),
                tipoAlerta: 'DISPERSION',
                estado: 'REVISADA',
            });
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get('/vigilancia/estado');
            (0, vitest_1.expect)(r.body.alertasSinRevisar).toBe(2);
            (0, vitest_1.expect)(r.body.ultimaAlerta).toMatchObject({ tipoAlerta: 'AMENAZA', conteoAnimales: 8 });
        });
        (0, vitest_1.it)('el Trabajador tambien ve el estado', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.trabajador.token).get('/vigilancia/estado');
            (0, vitest_1.expect)(r.status).toBe(200);
        });
        (0, vitest_1.it)('no mezcla el estado de otro predio (RNF_08)', async () => {
            await sembrarAlerta(e, { fechaHora: mediodiaDe('2026-03-10') });
            const r = await (0, fixtures_1.api)(e.app, e.ajeno.token).get('/vigilancia/estado');
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.dispositivos).toEqual([]);
            (0, vitest_1.expect)(r.body.alertasSinRevisar).toBe(0);
            (0, vitest_1.expect)(r.body.ultimaAlerta).toBeNull();
        });
        (0, vitest_1.it)('responde 401 sin token', async () => {
            const r = await (0, fixtures_1.api)(e.app).get('/vigilancia/estado');
            (0, vitest_1.expect)(r.status).toBe(401);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('NO_AUTENTICADO');
        });
    });
});
//# sourceMappingURL=alertas.test.js.map
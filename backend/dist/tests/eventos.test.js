"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const prisma_1 = require("../src/config/prisma");
const fechas_1 = require("../src/shared/fechas");
const fixtures_1 = require("./apoyo/fixtures");
/**
 * Modulo 3 - Organizador de eventos (RF_07 a RF_10).
 *
 * Las fechas se construyen como medianoche LOCAL del predio y no con
 * `new Date().toISOString()`: la regla de RF_07 compara dias calendario en
 * America/Santiago, y una fecha UTC haria fallar la suite de noche.
 */
const enDias = (dias) => (0, fechas_1.inicioDelDia)((0, fechas_1.sumarDias)((0, fechas_1.fechaLocalISO)(), dias)).toISOString();
(0, vitest_1.describe)('Organizador de eventos (RF_07 a RF_10)', () => {
    let e;
    let segundoAnimal;
    let tercerAnimal;
    (0, vitest_1.beforeEach)(async () => {
        e = await (0, fixtures_1.crearEscenario)();
        segundoAnimal = await (0, fixtures_1.crearAnimal)({
            idPredio: e.predioA.id,
            idRegistrador: e.productor.id,
            numeroOreja: '0002',
        });
        tercerAnimal = await (0, fixtures_1.crearAnimal)({
            idPredio: e.predioA.id,
            idRegistrador: e.productor.id,
            numeroOreja: '0003',
        });
    });
    /** Crea un evento por el endpoint real y devuelve su DTO. */
    async function crearEvento(cuerpo = {}) {
        const r = await (0, fixtures_1.api)(e.app, e.productor.token)
            .post('/eventos')
            .send({
            tipo: 'ENCASTE',
            descripcion: 'Encaste del lote norte',
            fechaInicio: enDias(2),
            idAnimales: [e.animal.id],
            ...cuerpo,
        });
        if (r.status !== 201) {
            throw new Error(`No se pudo crear el evento: ${r.status} ${JSON.stringify(r.body)}`);
        }
        return r.body;
    }
    // ─── RF_07 Registrar evento ────────────────────────────────────────────────
    (0, vitest_1.describe)('POST /eventos (RF_07)', () => {
        (0, vitest_1.it)('registra el evento con sus animales y lo anota en la bitacora (RF_06.d)', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .post('/eventos')
                .send({
                tipo: 'ESQUILA',
                descripcion: 'Esquila de primavera',
                fechaInicio: enDias(3),
                idAnimales: [e.animal.id, segundoAnimal.id],
            });
            (0, vitest_1.expect)(r.status).toBe(201);
            (0, vitest_1.expect)(r.body).toMatchObject({
                tipo: 'ESQUILA',
                descripcion: 'Esquila de primavera',
                estado: 'PROGRAMADO',
                eliminadoEn: null,
                creador: { id: e.productor.id, nombre: 'Productora A' },
            });
            (0, vitest_1.expect)(r.body.animales.map((a) => a.numeroOreja)).toEqual([
                '0001',
                '0002',
            ]);
            (0, vitest_1.expect)(r.body.animales[0]).toMatchObject({ sexo: 'HEMBRA', estado: 'ACTIVO' });
            const asociados = await prisma_1.prisma.eventoAnimal.count({ where: { idEvento: r.body.id } });
            (0, vitest_1.expect)(asociados).toBe(2);
            const bitacora = await prisma_1.prisma.bitacoraEntrada.findMany({ where: { idEvento: r.body.id } });
            (0, vitest_1.expect)(bitacora).toHaveLength(2);
            (0, vitest_1.expect)(bitacora[0]).toMatchObject({ tipo: 'EVENTO', titulo: 'Esquila', eventoEliminado: false });
        });
        (0, vitest_1.it)('acepta un evento para hoy', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .post('/eventos')
                .send({ tipo: 'OTRO', fechaInicio: enDias(0), idAnimales: [e.animal.id] });
            (0, vitest_1.expect)(r.status).toBe(201);
        });
        (0, vitest_1.it)('rechaza una fecha anterior a hoy', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .post('/eventos')
                .send({ tipo: 'ENCASTE', fechaInicio: enDias(-1), idAnimales: [e.animal.id] });
            (0, vitest_1.expect)(r.status).toBe(422);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('FECHA_PASADA');
        });
        (0, vitest_1.it)('exige al menos un animal', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .post('/eventos')
                .send({ tipo: 'ENCASTE', fechaInicio: enDias(1), idAnimales: [] });
            (0, vitest_1.expect)(r.status).toBe(422);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('ANIMALES_REQUERIDOS');
        });
        (0, vitest_1.it)('rechaza el registro si algun animal esta inactivo y nombra su numero de oreja', async () => {
            const inactivo = await (0, fixtures_1.crearAnimal)({
                idPredio: e.predioA.id,
                idRegistrador: e.productor.id,
                numeroOreja: '0099',
                estado: 'INACTIVO',
            });
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .post('/eventos')
                .send({ tipo: 'ENCASTE', fechaInicio: enDias(1), idAnimales: [e.animal.id, inactivo.id] });
            (0, vitest_1.expect)(r.status).toBe(422);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('ANIMALES_INACTIVOS');
            (0, vitest_1.expect)(r.body.error.mensaje).toBe('Hay animales seleccionados que no estan activos.');
            (0, vitest_1.expect)(r.body.error.detalles).toEqual(['0099']);
            (0, vitest_1.expect)(await prisma_1.prisma.evento.count()).toBe(0);
        });
        (0, vitest_1.it)('rechaza animales de otro predio (RNF_08)', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .post('/eventos')
                .send({ tipo: 'ENCASTE', fechaInicio: enDias(1), idAnimales: [e.animalAjeno.id] });
            (0, vitest_1.expect)(r.status).toBe(422);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('ANIMALES_INACTIVOS');
            (0, vitest_1.expect)(r.body.error.detalles).toEqual([e.animalAjeno.id]);
        });
        (0, vitest_1.it)('valida el tipo de evento', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .post('/eventos')
                .send({ tipo: 'PARICION', fechaInicio: enDias(1), idAnimales: [e.animal.id] });
            (0, vitest_1.expect)(r.status).toBe(400);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('VALIDACION');
        });
        (0, vitest_1.it)('prohibe registrar eventos al Trabajador', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.trabajador.token)
                .post('/eventos')
                .send({ tipo: 'ENCASTE', fechaInicio: enDias(1), idAnimales: [e.animal.id] });
            (0, vitest_1.expect)(r.status).toBe(403);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('ROL_INSUFICIENTE');
        });
        (0, vitest_1.it)('exige sesion iniciada', async () => {
            const r = await (0, fixtures_1.api)(e.app)
                .post('/eventos')
                .send({ tipo: 'ENCASTE', fechaInicio: enDias(1), idAnimales: [e.animal.id] });
            (0, vitest_1.expect)(r.status).toBe(401);
        });
    });
    // ─── Listado ───────────────────────────────────────────────────────────────
    (0, vitest_1.describe)('GET /eventos', () => {
        (0, vitest_1.it)('lista los eventos del predio de mas reciente a mas antiguo', async () => {
            await crearEvento({ fechaInicio: enDias(1) });
            const lejano = await crearEvento({ fechaInicio: enDias(9), tipo: 'ESQUILA' });
            const r = await (0, fixtures_1.api)(e.app, e.trabajador.token).get('/eventos');
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.meta).toMatchObject({ pagina: 1, total: 2, totalPaginas: 1 });
            (0, vitest_1.expect)(r.body.datos[0].id).toBe(lejano.id);
        });
        (0, vitest_1.it)('excluye los eventos eliminados salvo que se pidan', async () => {
            const evento = await crearEvento();
            await (0, fixtures_1.api)(e.app, e.productor.token).delete(`/eventos/${evento.id}`);
            const porDefecto = await (0, fixtures_1.api)(e.app, e.productor.token).get('/eventos');
            (0, vitest_1.expect)(porDefecto.body.meta.total).toBe(0);
            const conEliminados = await (0, fixtures_1.api)(e.app, e.productor.token).get('/eventos?incluirEliminados=true');
            (0, vitest_1.expect)(conEliminados.body.meta.total).toBe(1);
            (0, vitest_1.expect)(conEliminados.body.datos[0].estado).toBe('ELIMINADO');
        });
        (0, vitest_1.it)('filtra por tipo y por rango de fechas', async () => {
            await crearEvento({ tipo: 'ENCASTE', fechaInicio: enDias(1) });
            await crearEvento({ tipo: 'ESQUILA', fechaInicio: enDias(5) });
            const porTipo = await (0, fixtures_1.api)(e.app, e.productor.token).get('/eventos?tipo=ESQUILA');
            (0, vitest_1.expect)(porTipo.body.meta.total).toBe(1);
            (0, vitest_1.expect)(porTipo.body.datos[0].tipo).toBe('ESQUILA');
            const hoyISO = (0, fechas_1.fechaLocalISO)();
            const porRango = await (0, fixtures_1.api)(e.app, e.productor.token).get(`/eventos?desde=${(0, fechas_1.sumarDias)(hoyISO, 4)}&hasta=${(0, fechas_1.sumarDias)(hoyISO, 6)}`);
            (0, vitest_1.expect)(porRango.body.meta.total).toBe(1);
            (0, vitest_1.expect)(porRango.body.datos[0].tipo).toBe('ESQUILA');
        });
        (0, vitest_1.it)('rechaza un rango de fechas invertido', async () => {
            const hoyISO = (0, fechas_1.fechaLocalISO)();
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get(`/eventos?desde=${(0, fechas_1.sumarDias)(hoyISO, 6)}&hasta=${hoyISO}`);
            (0, vitest_1.expect)(r.status).toBe(422);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('RANGO_INVALIDO');
        });
        (0, vitest_1.it)('no muestra eventos de otro predio (RNF_08)', async () => {
            await crearEvento();
            const r = await (0, fixtures_1.api)(e.app, e.ajeno.token).get('/eventos');
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.meta.total).toBe(0);
        });
        (0, vitest_1.it)('exige sesion iniciada', async () => {
            const r = await (0, fixtures_1.api)(e.app).get('/eventos');
            (0, vitest_1.expect)(r.status).toBe(401);
        });
    });
    // ─── RF_08 Consultar detalle ───────────────────────────────────────────────
    (0, vitest_1.describe)('GET /eventos/:id (RF_08)', () => {
        (0, vitest_1.it)('devuelve el detalle con su creador y sus animales', async () => {
            const evento = await crearEvento({ idAnimales: [e.animal.id, segundoAnimal.id] });
            const r = await (0, fixtures_1.api)(e.app, e.trabajador.token).get(`/eventos/${evento.id}`);
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body).toMatchObject({
                id: evento.id,
                tipo: 'ENCASTE',
                descripcion: 'Encaste del lote norte',
                estado: 'PROGRAMADO',
                creador: { id: e.productor.id, nombre: 'Productora A' },
            });
            (0, vitest_1.expect)(r.body.animales).toHaveLength(2);
            (0, vitest_1.expect)(r.body.animales[0]).toMatchObject({
                id: e.animal.id,
                numeroOreja: '0001',
                raza: 'Suffolk',
                estado: 'ACTIVO',
            });
        });
        (0, vitest_1.it)('permite consultar un evento eliminado, al que se llega desde la bitacora (RF_10)', async () => {
            const evento = await crearEvento();
            await (0, fixtures_1.api)(e.app, e.productor.token).delete(`/eventos/${evento.id}`);
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get(`/eventos/${evento.id}`);
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.estado).toBe('ELIMINADO');
            (0, vitest_1.expect)(r.body.eliminadoEn).not.toBeNull();
        });
        (0, vitest_1.it)('responde 404 con el token de otro predio (RNF_08)', async () => {
            const evento = await crearEvento();
            const r = await (0, fixtures_1.api)(e.app, e.ajeno.token).get(`/eventos/${evento.id}`);
            (0, vitest_1.expect)(r.status).toBe(404);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('NO_ENCONTRADO');
        });
        (0, vitest_1.it)('responde 404 si el evento no existe', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get('/eventos/00000000-0000-4000-8000-000000000000');
            (0, vitest_1.expect)(r.status).toBe(404);
        });
        (0, vitest_1.it)('exige sesion iniciada', async () => {
            const evento = await crearEvento();
            const r = await (0, fixtures_1.api)(e.app).get(`/eventos/${evento.id}`);
            (0, vitest_1.expect)(r.status).toBe(401);
        });
    });
    // ─── RF_09 Editar evento ───────────────────────────────────────────────────
    (0, vitest_1.describe)('PATCH /eventos/:id (RF_09)', () => {
        (0, vitest_1.it)('actualiza la descripcion y la fecha', async () => {
            const evento = await crearEvento();
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .patch(`/eventos/${evento.id}`)
                .send({ descripcion: 'Se corre al potrero sur', fechaInicio: enDias(6) });
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.descripcion).toBe('Se corre al potrero sur');
            (0, vitest_1.expect)(new Date(r.body.fechaInicio).toISOString()).toBe(enDias(6));
            const bitacora = await prisma_1.prisma.bitacoraEntrada.findMany({ where: { idEvento: evento.id } });
            (0, vitest_1.expect)(bitacora[0].descripcion).toBe('Se corre al potrero sur');
        });
        (0, vitest_1.it)('reemplaza la lista de animales y sincroniza la bitacora (RF_06)', async () => {
            const evento = await crearEvento({ idAnimales: [e.animal.id, segundoAnimal.id] });
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .patch(`/eventos/${evento.id}`)
                .send({ idAnimales: [e.animal.id, tercerAnimal.id] });
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.animales.map((a) => a.numeroOreja)).toEqual([
                '0001',
                '0003',
            ]);
            const asociados = await prisma_1.prisma.eventoAnimal.findMany({ where: { idEvento: evento.id } });
            (0, vitest_1.expect)(asociados).toHaveLength(2);
            // La entrada del animal que salio se conserva, marcada (RF_06 append-only).
            const salido = await prisma_1.prisma.bitacoraEntrada.findFirst({
                where: { idEvento: evento.id, idAnimal: segundoAnimal.id },
            });
            (0, vitest_1.expect)(salido?.eventoEliminado).toBe(true);
            const entrante = await prisma_1.prisma.bitacoraEntrada.findFirst({
                where: { idEvento: evento.id, idAnimal: tercerAnimal.id },
            });
            (0, vitest_1.expect)(entrante?.eventoEliminado).toBe(false);
        });
        (0, vitest_1.it)('conserva un animal que se dio de baja despues de crearse el evento', async () => {
            const evento = await crearEvento({ idAnimales: [e.animal.id, segundoAnimal.id] });
            await prisma_1.prisma.animal.update({
                where: { id: segundoAnimal.id },
                data: {
                    estado: 'INACTIVO',
                    motivoBaja: 'MUERTE',
                    fechaBaja: new Date('2026-02-01T00:00:00.000Z'),
                },
            });
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .patch(`/eventos/${evento.id}`)
                .send({ idAnimales: [e.animal.id, segundoAnimal.id, tercerAnimal.id] });
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.animales).toHaveLength(3);
        });
        (0, vitest_1.it)('rechaza agregar un animal inactivo', async () => {
            const evento = await crearEvento();
            const inactivo = await (0, fixtures_1.crearAnimal)({
                idPredio: e.predioA.id,
                idRegistrador: e.productor.id,
                numeroOreja: '0098',
                estado: 'INACTIVO',
            });
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .patch(`/eventos/${evento.id}`)
                .send({ idAnimales: [e.animal.id, inactivo.id] });
            (0, vitest_1.expect)(r.status).toBe(422);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('ANIMALES_INACTIVOS');
            (0, vitest_1.expect)(r.body.error.detalles).toEqual(['0098']);
            const asociados = await prisma_1.prisma.eventoAnimal.count({ where: { idEvento: evento.id } });
            (0, vitest_1.expect)(asociados).toBe(1);
        });
        (0, vitest_1.it)('exige al menos un animal', async () => {
            const evento = await crearEvento();
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .patch(`/eventos/${evento.id}`)
                .send({ idAnimales: [] });
            (0, vitest_1.expect)(r.status).toBe(422);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('ANIMALES_REQUERIDOS');
        });
        (0, vitest_1.it)('no deja cambiar el tipo de evento', async () => {
            const evento = await crearEvento();
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .patch(`/eventos/${evento.id}`)
                .send({ tipo: 'ESQUILA' });
            (0, vitest_1.expect)(r.status).toBe(409);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('TIPO_EVENTO_INMUTABLE');
            (0, vitest_1.expect)(r.body.error.mensaje).toBe('El tipo de evento no se puede modificar una vez registrado.');
        });
        (0, vitest_1.it)('no deja editar un evento eliminado', async () => {
            const evento = await crearEvento();
            await (0, fixtures_1.api)(e.app, e.productor.token).delete(`/eventos/${evento.id}`);
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .patch(`/eventos/${evento.id}`)
                .send({ descripcion: 'Reactivado a mano' });
            (0, vitest_1.expect)(r.status).toBe(409);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('EVENTO_ELIMINADO');
        });
        (0, vitest_1.it)('prohibe editar al Trabajador', async () => {
            const evento = await crearEvento();
            const r = await (0, fixtures_1.api)(e.app, e.trabajador.token)
                .patch(`/eventos/${evento.id}`)
                .send({ descripcion: 'Cambio no autorizado' });
            (0, vitest_1.expect)(r.status).toBe(403);
        });
        (0, vitest_1.it)('responde 404 con el token de otro predio (RNF_08)', async () => {
            const evento = await crearEvento();
            const r = await (0, fixtures_1.api)(e.app, e.ajeno.token)
                .patch(`/eventos/${evento.id}`)
                .send({ descripcion: 'Cambio desde otro predio' });
            (0, vitest_1.expect)(r.status).toBe(404);
        });
    });
    // ─── RF_10 Eliminar evento ─────────────────────────────────────────────────
    (0, vitest_1.describe)('DELETE /eventos/:id (RF_10)', () => {
        (0, vitest_1.it)('elimina de forma logica y conserva la bitacora marcada', async () => {
            const evento = await crearEvento({ idAnimales: [e.animal.id, segundoAnimal.id] });
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).delete(`/eventos/${evento.id}`);
            (0, vitest_1.expect)(r.status).toBe(204);
            (0, vitest_1.expect)(r.body).toEqual({});
            const fila = await prisma_1.prisma.evento.findUnique({ where: { id: evento.id } });
            (0, vitest_1.expect)(fila?.estado).toBe('ELIMINADO');
            (0, vitest_1.expect)(fila?.eliminadoEn).not.toBeNull();
            const asociados = await prisma_1.prisma.eventoAnimal.count({ where: { idEvento: evento.id } });
            (0, vitest_1.expect)(asociados).toBe(2);
            const bitacora = await prisma_1.prisma.bitacoraEntrada.findMany({ where: { idEvento: evento.id } });
            (0, vitest_1.expect)(bitacora).toHaveLength(2);
            (0, vitest_1.expect)(bitacora.every((b) => b.eventoEliminado)).toBe(true);
        });
        (0, vitest_1.it)('no permite eliminar dos veces el mismo evento', async () => {
            const evento = await crearEvento();
            await (0, fixtures_1.api)(e.app, e.productor.token).delete(`/eventos/${evento.id}`);
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).delete(`/eventos/${evento.id}`);
            (0, vitest_1.expect)(r.status).toBe(409);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('EVENTO_ELIMINADO');
        });
        (0, vitest_1.it)('prohibe eliminar al Trabajador', async () => {
            const evento = await crearEvento();
            const r = await (0, fixtures_1.api)(e.app, e.trabajador.token).delete(`/eventos/${evento.id}`);
            (0, vitest_1.expect)(r.status).toBe(403);
        });
        (0, vitest_1.it)('responde 404 con el token de otro predio (RNF_08)', async () => {
            const evento = await crearEvento();
            const r = await (0, fixtures_1.api)(e.app, e.ajeno.token).delete(`/eventos/${evento.id}`);
            (0, vitest_1.expect)(r.status).toBe(404);
            (0, vitest_1.expect)(await prisma_1.prisma.evento.count({ where: { estado: 'PROGRAMADO' } })).toBe(1);
        });
        (0, vitest_1.it)('exige sesion iniciada', async () => {
            const evento = await crearEvento();
            const r = await (0, fixtures_1.api)(e.app).delete(`/eventos/${evento.id}`);
            (0, vitest_1.expect)(r.status).toBe(401);
        });
    });
});
//# sourceMappingURL=eventos.test.js.map
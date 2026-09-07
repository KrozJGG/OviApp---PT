"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const prisma_1 = require("../src/config/prisma");
const fechas_1 = require("../src/shared/fechas");
const fixtures_1 = require("./apoyo/fixtures");
/**
 * Modulo 4 - Planificacion de actividades (RF_11 a RF_14).
 *
 * Las cuatro operaciones estan permitidas para ambos roles ("El Productor o el
 * Pastor"), asi que en vez de casos de 403 la suite comprueba explicitamente
 * que el Trabajador puede ejecutar cada una. Lo que si se prueba en cada
 * endpoint es el aislamiento por predio (RNF_08) y la falta de sesion.
 */
(0, vitest_1.describe)('Planificacion de actividades (RF_11 a RF_14)', () => {
    let e;
    (0, vitest_1.beforeEach)(async () => {
        e = await (0, fixtures_1.crearEscenario)();
    });
    /** Crea una tarea por el endpoint real y devuelve su cuerpo. */
    async function nuevaTarea(campos = {}) {
        const r = await (0, fixtures_1.api)(e.app, e.productor.token)
            .post('/tareas')
            .send({
            titulo: 'Esquilar el lote norte',
            fechaLimite: (0, fixtures_1.fechaRelativa)(7),
            idResponsables: [e.trabajador.id],
            ...campos,
        });
        (0, vitest_1.expect)(r.status).toBe(201);
        return r.body;
    }
    // ───────────────────────────────────────────────────────────────────────────
    // RF_11 - Crear tarea
    // ───────────────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)('POST /tareas (RF_11)', () => {
        (0, vitest_1.it)('crea la tarea con responsables y animales asociados', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .post('/tareas')
                .send({
                titulo: 'Vacunar corderos',
                descripcion: 'Aplicar la dosis anual',
                fechaLimite: (0, fixtures_1.fechaRelativa)(3),
                idResponsables: [e.trabajador.id, e.productor.id],
                idAnimales: [e.animal.id],
            });
            (0, vitest_1.expect)(r.status).toBe(201);
            (0, vitest_1.expect)(r.body).toMatchObject({
                titulo: 'Vacunar corderos',
                descripcion: 'Aplicar la dosis anual',
                estado: 'ACTIVA',
                completadaEn: null,
                completadaPor: null,
                creador: { id: e.productor.id },
            });
            (0, vitest_1.expect)(r.body.fechaLimite.slice(0, 10)).toBe((0, fixtures_1.fechaRelativa)(3));
            (0, vitest_1.expect)(r.body.responsables.map((u) => u.id).sort()).toEqual([e.trabajador.id, e.productor.id].sort());
            (0, vitest_1.expect)(r.body.animales).toEqual([{ id: e.animal.id, numeroOreja: e.animal.numeroOreja }]);
            (0, vitest_1.expect)(await prisma_1.prisma.tareaUsuario.count({ where: { idTarea: r.body.id } })).toBe(2);
            (0, vitest_1.expect)(await prisma_1.prisma.tareaAnimal.count({ where: { idTarea: r.body.id } })).toBe(1);
        });
        (0, vitest_1.it)('acepta una tarea sin animales: la asociacion es opcional (H10)', async () => {
            const tarea = await nuevaTarea();
            (0, vitest_1.expect)(tarea.animales).toEqual([]);
            (0, vitest_1.expect)(tarea.descripcion).toBeNull();
        });
        (0, vitest_1.it)('rechaza una tarea sin responsables (RESPONSABLES_REQUERIDOS)', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .post('/tareas')
                .send({ titulo: 'Sin nadie a cargo', fechaLimite: (0, fixtures_1.fechaRelativa)(2), idResponsables: [] });
            (0, vitest_1.expect)(r.status).toBe(422);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('RESPONSABLES_REQUERIDOS');
        });
        (0, vitest_1.it)('rechaza un responsable de otro predio (RNF_08)', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .post('/tareas')
                .send({
                titulo: 'Tarea cruzada',
                fechaLimite: (0, fixtures_1.fechaRelativa)(2),
                idResponsables: [e.ajeno.id],
            });
            (0, vitest_1.expect)(r.status).toBe(404);
            (0, vitest_1.expect)(r.body.error.mensaje).toBe('Alguno de los responsables no pertenece a este predio.');
        });
        (0, vitest_1.it)('rechaza un responsable inhabilitado (RF_22)', async () => {
            const inhabilitado = await (0, fixtures_1.crearUsuario)({
                idPredio: e.predioA.id,
                email: 'fuera@test.cl',
                estado: 'INHABILITADO',
            });
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .post('/tareas')
                .send({
                titulo: 'Tarea huerfana',
                fechaLimite: (0, fixtures_1.fechaRelativa)(2),
                idResponsables: [inhabilitado.id],
            });
            (0, vitest_1.expect)(r.status).toBe(404);
            (0, vitest_1.expect)(r.body.error.mensaje).toBe('Alguno de los responsables no pertenece a este predio.');
        });
        (0, vitest_1.it)('rechaza un animal de otro predio (RNF_08)', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .post('/tareas')
                .send({
                titulo: 'Revisar animal ajeno',
                fechaLimite: (0, fixtures_1.fechaRelativa)(2),
                idResponsables: [e.trabajador.id],
                idAnimales: [e.animalAjeno.id],
            });
            (0, vitest_1.expect)(r.status).toBe(404);
            (0, vitest_1.expect)(r.body.error.mensaje).toBe('Alguno de los animales no pertenece a este predio.');
        });
        (0, vitest_1.it)('rechaza una fecha de termino anterior a hoy (FECHA_PASADA)', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .post('/tareas')
                .send({
                titulo: 'Tarea atrasada',
                fechaLimite: (0, fixtures_1.fechaRelativa)(-5),
                idResponsables: [e.trabajador.id],
            });
            (0, vitest_1.expect)(r.status).toBe(422);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('FECHA_PASADA');
            (0, vitest_1.expect)(r.body.error.mensaje).toBe('La fecha de término debe ser hoy o posterior.');
        });
        (0, vitest_1.it)('acepta la fecha de hoy: el limite es inclusivo', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .post('/tareas')
                .send({
                titulo: 'Tarea para hoy',
                fechaLimite: (0, fechas_1.fechaLocalISO)(),
                idResponsables: [e.trabajador.id],
            });
            (0, vitest_1.expect)(r.status).toBe(201);
        });
        (0, vitest_1.it)('permite crear tambien al Trabajador (RF_11 es de ambos roles)', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.trabajador.token)
                .post('/tareas')
                .send({
                titulo: 'Reparar el cerco',
                fechaLimite: (0, fixtures_1.fechaRelativa)(1),
                idResponsables: [e.trabajador.id],
            });
            (0, vitest_1.expect)(r.status).toBe(201);
            (0, vitest_1.expect)(r.body.creador.id).toBe(e.trabajador.id);
        });
        (0, vitest_1.it)('valida el formato del cuerpo', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .post('/tareas')
                .send({ titulo: '', fechaLimite: '31-08-2026', idResponsables: ['no-es-uuid'] });
            (0, vitest_1.expect)(r.status).toBe(400);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('VALIDACION');
        });
        (0, vitest_1.it)('responde 401 sin token', async () => {
            const r = await (0, fixtures_1.api)(e.app)
                .post('/tareas')
                .send({ titulo: 'x', fechaLimite: (0, fixtures_1.fechaRelativa)(1), idResponsables: [e.trabajador.id] });
            (0, vitest_1.expect)(r.status).toBe(401);
        });
    });
    // ───────────────────────────────────────────────────────────────────────────
    // Listado
    // ───────────────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)('GET /tareas', () => {
        (0, vitest_1.it)('ordena por fecha de termino ascendente', async () => {
            await nuevaTarea({ titulo: 'Tercera', fechaLimite: (0, fixtures_1.fechaRelativa)(10) });
            await nuevaTarea({ titulo: 'Primera', fechaLimite: (0, fixtures_1.fechaRelativa)(1) });
            await nuevaTarea({ titulo: 'Segunda', fechaLimite: (0, fixtures_1.fechaRelativa)(5) });
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get('/tareas');
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.meta).toMatchObject({ pagina: 1, total: 3, totalPaginas: 1 });
            (0, vitest_1.expect)(r.body.datos.map((t) => t.titulo)).toEqual([
                'Primera',
                'Segunda',
                'Tercera',
            ]);
        });
        (0, vitest_1.it)('filtra por estado', async () => {
            const pendiente = await nuevaTarea({ titulo: 'Pendiente' });
            const hecha = await nuevaTarea({ titulo: 'Hecha' });
            await (0, fixtures_1.api)(e.app, e.productor.token).post(`/tareas/${hecha.id}/completar`).send({});
            const activas = await (0, fixtures_1.api)(e.app, e.productor.token).get('/tareas?estado=ACTIVA');
            (0, vitest_1.expect)(activas.body.datos.map((t) => t.id)).toEqual([pendiente.id]);
            const completadas = await (0, fixtures_1.api)(e.app, e.productor.token).get('/tareas?estado=COMPLETADA');
            (0, vitest_1.expect)(completadas.body.datos.map((t) => t.id)).toEqual([hecha.id]);
        });
        (0, vitest_1.it)('filtra por rango de fecha de termino', async () => {
            await nuevaTarea({ titulo: 'Cerca', fechaLimite: (0, fixtures_1.fechaRelativa)(2) });
            await nuevaTarea({ titulo: 'Lejos', fechaLimite: (0, fixtures_1.fechaRelativa)(30) });
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get(`/tareas?desde=${(0, fixtures_1.fechaRelativa)(1)}&hasta=${(0, fixtures_1.fechaRelativa)(5)}`);
            (0, vitest_1.expect)(r.body.meta.total).toBe(1);
            (0, vitest_1.expect)(r.body.datos[0].titulo).toBe('Cerca');
        });
        (0, vitest_1.it)('filtra por responsable asignado', async () => {
            const otro = await (0, fixtures_1.crearUsuario)({ idPredio: e.predioA.id, email: 'pastor2@test.cl' });
            const suya = await nuevaTarea({ titulo: 'Del otro', idResponsables: [otro.id] });
            await nuevaTarea({ titulo: 'Del trabajador' });
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get(`/tareas?idResponsable=${otro.id}`);
            (0, vitest_1.expect)(r.body.meta.total).toBe(1);
            (0, vitest_1.expect)(r.body.datos[0].id).toBe(suya.id);
        });
        (0, vitest_1.it)('pagina el resultado', async () => {
            await nuevaTarea({ titulo: 'A', fechaLimite: (0, fixtures_1.fechaRelativa)(1) });
            await nuevaTarea({ titulo: 'B', fechaLimite: (0, fixtures_1.fechaRelativa)(2) });
            await nuevaTarea({ titulo: 'C', fechaLimite: (0, fixtures_1.fechaRelativa)(3) });
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get('/tareas?pagina=2&tamano=2');
            (0, vitest_1.expect)(r.body.datos).toHaveLength(1);
            (0, vitest_1.expect)(r.body.datos[0].titulo).toBe('C');
            (0, vitest_1.expect)(r.body.meta).toMatchObject({ pagina: 2, tamano: 2, total: 3, totalPaginas: 2 });
        });
        (0, vitest_1.it)('no muestra tareas de otro predio (RNF_08)', async () => {
            await nuevaTarea({ titulo: 'Del predio A' });
            const r = await (0, fixtures_1.api)(e.app, e.ajeno.token).get('/tareas');
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.meta.total).toBe(0);
        });
        (0, vitest_1.it)('responde 401 sin token', async () => {
            const r = await (0, fixtures_1.api)(e.app).get('/tareas');
            (0, vitest_1.expect)(r.status).toBe(401);
        });
    });
    // ───────────────────────────────────────────────────────────────────────────
    // Detalle
    // ───────────────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)('GET /tareas/:id', () => {
        (0, vitest_1.it)('devuelve el detalle con creador, responsables y animales', async () => {
            const creada = await nuevaTarea({ idAnimales: [e.animal.id] });
            const r = await (0, fixtures_1.api)(e.app, e.trabajador.token).get(`/tareas/${creada.id}`);
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body).toMatchObject({
                id: creada.id,
                estado: 'ACTIVA',
                creador: { id: e.productor.id, nombre: 'Productora A' },
                completadaPor: null,
            });
            (0, vitest_1.expect)(r.body.responsables).toEqual([{ id: e.trabajador.id, nombre: 'Trabajador A' }]);
            (0, vitest_1.expect)(r.body.animales).toEqual([{ id: e.animal.id, numeroOreja: e.animal.numeroOreja }]);
        });
        (0, vitest_1.it)('responde 404 con el token de otro predio (RNF_08)', async () => {
            const creada = await nuevaTarea();
            const r = await (0, fixtures_1.api)(e.app, e.ajeno.token).get(`/tareas/${creada.id}`);
            (0, vitest_1.expect)(r.status).toBe(404);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('NO_ENCONTRADO');
        });
        (0, vitest_1.it)('responde 401 sin token', async () => {
            const creada = await nuevaTarea();
            const r = await (0, fixtures_1.api)(e.app).get(`/tareas/${creada.id}`);
            (0, vitest_1.expect)(r.status).toBe(401);
        });
    });
    // ───────────────────────────────────────────────────────────────────────────
    // RF_12 - Editar tarea
    // ───────────────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)('PATCH /tareas/:id (RF_12)', () => {
        (0, vitest_1.it)('actualiza titulo, descripcion y fecha de termino', async () => {
            const creada = await nuevaTarea();
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .patch(`/tareas/${creada.id}`)
                .send({ titulo: 'Esquilar el lote sur', descripcion: 'Se corre una semana', fechaLimite: (0, fixtures_1.fechaRelativa)(14) });
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.titulo).toBe('Esquilar el lote sur');
            (0, vitest_1.expect)(r.body.descripcion).toBe('Se corre una semana');
            (0, vitest_1.expect)(r.body.fechaLimite.slice(0, 10)).toBe((0, fixtures_1.fechaRelativa)(14));
        });
        (0, vitest_1.it)('reemplaza por completo la lista de responsables', async () => {
            const creada = await nuevaTarea();
            const otro = await (0, fixtures_1.crearUsuario)({ idPredio: e.predioA.id, email: 'pastor3@test.cl' });
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .patch(`/tareas/${creada.id}`)
                .send({ idResponsables: [otro.id] });
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.responsables).toEqual([{ id: otro.id, nombre: 'Usuario de prueba' }]);
            (0, vitest_1.expect)(await prisma_1.prisma.tareaUsuario.count({ where: { idTarea: creada.id } })).toBe(1);
        });
        (0, vitest_1.it)('permite desvincular todos los animales con una lista vacia', async () => {
            const otroAnimal = await (0, fixtures_1.crearAnimal)({
                idPredio: e.predioA.id,
                idRegistrador: e.productor.id,
                numeroOreja: '0002',
            });
            const creada = await nuevaTarea({ idAnimales: [e.animal.id, otroAnimal.id] });
            (0, vitest_1.expect)(creada.animales).toHaveLength(2);
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .patch(`/tareas/${creada.id}`)
                .send({ idAnimales: [] });
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.animales).toEqual([]);
            (0, vitest_1.expect)(await prisma_1.prisma.tareaAnimal.count({ where: { idTarea: creada.id } })).toBe(0);
        });
        (0, vitest_1.it)('no permite editar una tarea ya completada (TAREA_COMPLETADA)', async () => {
            const creada = await nuevaTarea();
            await (0, fixtures_1.api)(e.app, e.productor.token).post(`/tareas/${creada.id}/completar`).send({});
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .patch(`/tareas/${creada.id}`)
                .send({ titulo: 'Otro titulo' });
            (0, vitest_1.expect)(r.status).toBe(409);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('TAREA_COMPLETADA');
            (0, vitest_1.expect)(r.body.error.mensaje).toBe('No se puede editar una tarea ya completada.');
        });
        (0, vitest_1.it)('rechaza dejar la tarea sin responsables', async () => {
            const creada = await nuevaTarea();
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .patch(`/tareas/${creada.id}`)
                .send({ idResponsables: [] });
            (0, vitest_1.expect)(r.status).toBe(422);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('RESPONSABLES_REQUERIDOS');
        });
        (0, vitest_1.it)('rechaza un responsable de otro predio', async () => {
            const creada = await nuevaTarea();
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .patch(`/tareas/${creada.id}`)
                .send({ idResponsables: [e.ajeno.id] });
            (0, vitest_1.expect)(r.status).toBe(404);
            (0, vitest_1.expect)(r.body.error.mensaje).toBe('Alguno de los responsables no pertenece a este predio.');
        });
        (0, vitest_1.it)('rechaza mover la fecha de termino al pasado', async () => {
            const creada = await nuevaTarea();
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .patch(`/tareas/${creada.id}`)
                .send({ fechaLimite: (0, fixtures_1.fechaRelativa)(-5) });
            (0, vitest_1.expect)(r.status).toBe(422);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('FECHA_PASADA');
        });
        (0, vitest_1.it)('permite editar tambien al Trabajador (RF_12 es de ambos roles)', async () => {
            const creada = await nuevaTarea();
            const r = await (0, fixtures_1.api)(e.app, e.trabajador.token)
                .patch(`/tareas/${creada.id}`)
                .send({ titulo: 'Corregido en terreno' });
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.titulo).toBe('Corregido en terreno');
        });
        (0, vitest_1.it)('responde 404 con el token de otro predio (RNF_08)', async () => {
            const creada = await nuevaTarea();
            const r = await (0, fixtures_1.api)(e.app, e.ajeno.token)
                .patch(`/tareas/${creada.id}`)
                .send({ titulo: 'Intruso' });
            (0, vitest_1.expect)(r.status).toBe(404);
        });
        (0, vitest_1.it)('responde 401 sin token', async () => {
            const creada = await nuevaTarea();
            const r = await (0, fixtures_1.api)(e.app).patch(`/tareas/${creada.id}`).send({ titulo: 'x' });
            (0, vitest_1.expect)(r.status).toBe(401);
        });
    });
    // ───────────────────────────────────────────────────────────────────────────
    // RF_13 - Completar tarea
    // ───────────────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)('POST /tareas/:id/completar (RF_13)', () => {
        (0, vitest_1.it)('registra la fecha y quien la marco', async () => {
            const creada = await nuevaTarea();
            const r = await (0, fixtures_1.api)(e.app, e.trabajador.token)
                .post(`/tareas/${creada.id}/completar`)
                .send({});
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.estado).toBe('COMPLETADA');
            (0, vitest_1.expect)(r.body.completadaEn).toBeTypeOf('string');
            (0, vitest_1.expect)(r.body.completadaPor).toEqual({ id: e.trabajador.id, nombre: 'Trabajador A' });
            const enBd = await prisma_1.prisma.tarea.findUniqueOrThrow({ where: { id: creada.id } });
            (0, vitest_1.expect)(enBd.idCompletadaPor).toBe(e.trabajador.id);
            (0, vitest_1.expect)(enBd.completadaEn).toBeInstanceOf(Date);
        });
        (0, vitest_1.it)('mantiene la tarea visible en el listado despues de completarla', async () => {
            const creada = await nuevaTarea();
            await (0, fixtures_1.api)(e.app, e.productor.token).post(`/tareas/${creada.id}/completar`).send({});
            const listado = await (0, fixtures_1.api)(e.app, e.productor.token).get('/tareas');
            (0, vitest_1.expect)(listado.body.meta.total).toBe(1);
            (0, vitest_1.expect)(listado.body.datos[0]).toMatchObject({ id: creada.id, estado: 'COMPLETADA' });
        });
        (0, vitest_1.it)('no permite completarla dos veces (TAREA_COMPLETADA)', async () => {
            const creada = await nuevaTarea();
            await (0, fixtures_1.api)(e.app, e.productor.token).post(`/tareas/${creada.id}/completar`).send({});
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .post(`/tareas/${creada.id}/completar`)
                .send({});
            (0, vitest_1.expect)(r.status).toBe(409);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('TAREA_COMPLETADA');
            (0, vitest_1.expect)(r.body.error.mensaje).toBe('No se puede completar una tarea ya completada.');
        });
        (0, vitest_1.it)('responde 404 con el token de otro predio (RNF_08)', async () => {
            const creada = await nuevaTarea();
            const r = await (0, fixtures_1.api)(e.app, e.ajeno.token).post(`/tareas/${creada.id}/completar`).send({});
            (0, vitest_1.expect)(r.status).toBe(404);
            const enBd = await prisma_1.prisma.tarea.findUniqueOrThrow({ where: { id: creada.id } });
            (0, vitest_1.expect)(enBd.estado).toBe('ACTIVA');
        });
        (0, vitest_1.it)('responde 401 sin token', async () => {
            const creada = await nuevaTarea();
            const r = await (0, fixtures_1.api)(e.app).post(`/tareas/${creada.id}/completar`).send({});
            (0, vitest_1.expect)(r.status).toBe(401);
        });
    });
    // ───────────────────────────────────────────────────────────────────────────
    // RF_14 - Eliminar tarea
    // ───────────────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)('DELETE /tareas/:id (RF_14)', () => {
        (0, vitest_1.it)('elimina la tarea de forma permanente y arrastra sus asociaciones', async () => {
            const creada = await nuevaTarea({ idAnimales: [e.animal.id] });
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).delete(`/tareas/${creada.id}`);
            (0, vitest_1.expect)(r.status).toBe(204);
            (0, vitest_1.expect)(r.body).toEqual({});
            (0, vitest_1.expect)(await prisma_1.prisma.tarea.count({ where: { id: creada.id } })).toBe(0);
            (0, vitest_1.expect)(await prisma_1.prisma.tareaUsuario.count({ where: { idTarea: creada.id } })).toBe(0);
            (0, vitest_1.expect)(await prisma_1.prisma.tareaAnimal.count({ where: { idTarea: creada.id } })).toBe(0);
        });
        (0, vitest_1.it)('permite eliminar tambien al Trabajador (RF_14 es de ambos roles)', async () => {
            const creada = await nuevaTarea();
            const r = await (0, fixtures_1.api)(e.app, e.trabajador.token).delete(`/tareas/${creada.id}`);
            (0, vitest_1.expect)(r.status).toBe(204);
        });
        (0, vitest_1.it)('elimina tambien una tarea ya completada', async () => {
            const creada = await nuevaTarea();
            await (0, fixtures_1.api)(e.app, e.productor.token).post(`/tareas/${creada.id}/completar`).send({});
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).delete(`/tareas/${creada.id}`);
            (0, vitest_1.expect)(r.status).toBe(204);
        });
        (0, vitest_1.it)('responde 404 con el token de otro predio y no borra nada (RNF_08)', async () => {
            const creada = await nuevaTarea();
            const r = await (0, fixtures_1.api)(e.app, e.ajeno.token).delete(`/tareas/${creada.id}`);
            (0, vitest_1.expect)(r.status).toBe(404);
            (0, vitest_1.expect)(await prisma_1.prisma.tarea.count({ where: { id: creada.id } })).toBe(1);
        });
        (0, vitest_1.it)('responde 401 sin token', async () => {
            const creada = await nuevaTarea();
            const r = await (0, fixtures_1.api)(e.app).delete(`/tareas/${creada.id}`);
            (0, vitest_1.expect)(r.status).toBe(401);
        });
    });
});
//# sourceMappingURL=tareas.test.js.map
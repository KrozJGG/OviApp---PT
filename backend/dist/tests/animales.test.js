"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const prisma_1 = require("../src/config/prisma");
const fixtures_1 = require("./apoyo/fixtures");
/**
 * Modulo 1 - Ficha Animal (RF_01 a RF_04).
 *
 * Es el corazon de la trazabilidad SAG: cada mutacion tiene que dejar su
 * entrada de bitacora (RF_06), y nada se borra nunca.
 */
(0, vitest_1.describe)('Ficha Animal (RF_01 a RF_04)', () => {
    let e;
    (0, vitest_1.beforeEach)(async () => {
        e = await (0, fixtures_1.crearEscenario)();
    });
    const entradas = (idAnimal, tipo) => prisma_1.prisma.bitacoraEntrada.findMany({
        where: { idAnimal, ...(tipo ? { tipo } : {}) },
        orderBy: { createdAt: 'asc' },
    });
    // ─── RF_01 ─────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)('POST /animales (RF_01)', () => {
        (0, vitest_1.it)('registra el animal y devuelve su ficha', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).post('/animales').send({
                numeroOreja: '0123',
                sexo: 'MACHO',
                raza: 'Merino',
                color: 'Negro',
                pesoKg: 52.5,
                fechaNacimiento: '2024-03-15',
                descripcion: 'Carnero de reposicion',
            });
            (0, vitest_1.expect)(r.status).toBe(201);
            (0, vitest_1.expect)(r.body).toMatchObject({
                numeroOreja: '0123',
                sexo: 'MACHO',
                raza: 'Merino',
                color: 'Negro',
                pesoKg: 52.5,
                descripcion: 'Carnero de reposicion',
                estado: 'ACTIVO',
                motivoBaja: null,
                fechaBaja: null,
            });
            (0, vitest_1.expect)(r.body.fechaNacimiento).toBe('2024-03-15T00:00:00.000Z');
            (0, vitest_1.expect)(typeof r.body.pesoKg).toBe('number');
            (0, vitest_1.expect)(r.body.id).toBeTypeOf('string');
        });
        (0, vitest_1.it)('deja la entrada de ALTA en la misma operacion (RF_06.a)', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .post('/animales')
                .send({ numeroOreja: '0200', sexo: 'HEMBRA', raza: 'Suffolk' });
            const bitacora = await entradas(r.body.id);
            (0, vitest_1.expect)(bitacora).toHaveLength(1);
            (0, vitest_1.expect)(bitacora[0].tipo).toBe('ALTA');
            (0, vitest_1.expect)(bitacora[0].titulo).toContain('0200');
            (0, vitest_1.expect)(bitacora[0].idUsuario).toBe(e.productor.id);
            (0, vitest_1.expect)(bitacora[0].datos).toMatchObject({ numeroOreja: '0200', raza: 'Suffolk' });
        });
        (0, vitest_1.it)('lo permite tambien al Trabajador y guarda quien lo registro', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.trabajador.token)
                .post('/animales')
                .send({ numeroOreja: '0300', sexo: 'HEMBRA' });
            (0, vitest_1.expect)(r.status).toBe(201);
            const guardado = await prisma_1.prisma.animal.findUniqueOrThrow({ where: { id: r.body.id } });
            (0, vitest_1.expect)(guardado.idRegistrador).toBe(e.trabajador.id);
            (0, vitest_1.expect)(guardado.idPredio).toBe(e.predioA.id);
        });
        (0, vitest_1.it)('guarda el numero de oreja sin espacios sobrantes', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .post('/animales')
                .send({ numeroOreja: '  0400  ', sexo: 'MACHO' });
            (0, vitest_1.expect)(r.status).toBe(201);
            (0, vitest_1.expect)(r.body.numeroOreja).toBe('0400');
        });
        (0, vitest_1.it)('rechaza un numero de oreja repetido en el predio', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .post('/animales')
                .send({ numeroOreja: e.animal.numeroOreja, sexo: 'HEMBRA' });
            (0, vitest_1.expect)(r.status).toBe(409);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('OREJA_DUPLICADA');
            (0, vitest_1.expect)(r.body.error.mensaje).toContain(e.animal.numeroOreja);
        });
        (0, vitest_1.it)('acepta el mismo numero de oreja en otro predio (RNF_08)', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.ajeno.token)
                .post('/animales')
                .send({ numeroOreja: e.animal.numeroOreja, sexo: 'HEMBRA' });
            (0, vitest_1.expect)(r.status).toBe(201);
            (0, vitest_1.expect)(r.body.numeroOreja).toBe(e.animal.numeroOreja);
        });
        (0, vitest_1.it)('rechaza una fecha de nacimiento futura', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .post('/animales')
                .send({ numeroOreja: '0500', sexo: 'MACHO', fechaNacimiento: (0, fixtures_1.fechaRelativa)(5) });
            (0, vitest_1.expect)(r.status).toBe(422);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('FECHA_FUTURA');
        });
        (0, vitest_1.it)('exige numero de oreja y sexo validos', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .post('/animales')
                .send({ numeroOreja: '   ', sexo: 'OTRO' });
            (0, vitest_1.expect)(r.status).toBe(400);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('VALIDACION');
            (0, vitest_1.expect)(r.body.error.detalles).toEqual(vitest_1.expect.arrayContaining([
                vitest_1.expect.objectContaining({ campo: 'numeroOreja' }),
                vitest_1.expect.objectContaining({ campo: 'sexo' }),
            ]));
        });
        (0, vitest_1.it)('responde 401 sin token', async () => {
            const r = await (0, fixtures_1.api)(e.app).post('/animales').send({ numeroOreja: '0600', sexo: 'MACHO' });
            (0, vitest_1.expect)(r.status).toBe(401);
        });
    });
    // ─── Listado del rebano ────────────────────────────────────────────────────
    (0, vitest_1.describe)('GET /animales', () => {
        (0, vitest_1.beforeEach)(async () => {
            await (0, fixtures_1.crearAnimal)({ idPredio: e.predioA.id, idRegistrador: e.productor.id, numeroOreja: '0010' });
            await (0, fixtures_1.crearAnimal)({ idPredio: e.predioA.id, idRegistrador: e.productor.id, numeroOreja: '0002' });
            await (0, fixtures_1.crearAnimal)({
                idPredio: e.predioA.id,
                idRegistrador: e.productor.id,
                numeroOreja: 'A123',
                estado: 'INACTIVO',
            });
        });
        (0, vitest_1.it)('lista el rebano ordenado por numero de oreja con su resumen', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.trabajador.token).get('/animales');
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.datos.map((a) => a.numeroOreja)).toEqual([
                '0001',
                '0002',
                '0010',
                'A123',
            ]);
            (0, vitest_1.expect)(r.body.meta).toMatchObject({ pagina: 1, tamano: 20, total: 4, totalPaginas: 1 });
            (0, vitest_1.expect)(r.body.resumen).toEqual({ activos: 3, inactivos: 1 });
        });
        (0, vitest_1.it)('filtra por estado sin alterar el resumen del predio', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get('/animales?estado=INACTIVO');
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.datos).toHaveLength(1);
            (0, vitest_1.expect)(r.body.datos[0].numeroOreja).toBe('A123');
            (0, vitest_1.expect)(r.body.resumen).toEqual({ activos: 3, inactivos: 1 });
        });
        (0, vitest_1.it)('busca por prefijo del numero de oreja sin distinguir mayusculas', async () => {
            const encontrado = await (0, fixtures_1.api)(e.app, e.productor.token).get('/animales?q=a1');
            (0, vitest_1.expect)(encontrado.body.datos).toHaveLength(1);
            (0, vitest_1.expect)(encontrado.body.datos[0].numeroOreja).toBe('A123');
            // Es busqueda por prefijo, no por contenido.
            const vacio = await (0, fixtures_1.api)(e.app, e.productor.token).get('/animales?q=123');
            (0, vitest_1.expect)(vacio.body.datos).toHaveLength(0);
            (0, vitest_1.expect)(vacio.body.meta.total).toBe(0);
        });
        (0, vitest_1.it)('pagina los resultados', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get('/animales?pagina=2&tamano=2');
            (0, vitest_1.expect)(r.body.datos.map((a) => a.numeroOreja)).toEqual([
                '0010',
                'A123',
            ]);
            (0, vitest_1.expect)(r.body.meta).toMatchObject({ pagina: 2, tamano: 2, total: 4, totalPaginas: 2 });
        });
        (0, vitest_1.it)('no muestra animales de otro predio (RNF_08)', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.ajeno.token).get('/animales');
            (0, vitest_1.expect)(r.body.datos).toHaveLength(1);
            (0, vitest_1.expect)(r.body.datos[0].numeroOreja).toBe(e.animalAjeno.numeroOreja);
            (0, vitest_1.expect)(r.body.resumen).toEqual({ activos: 1, inactivos: 0 });
        });
        (0, vitest_1.it)('responde 401 sin token', async () => {
            const r = await (0, fixtures_1.api)(e.app).get('/animales');
            (0, vitest_1.expect)(r.status).toBe(401);
        });
    });
    // ─── RF_02 ─────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)('GET /animales/:id (RF_02)', () => {
        (0, vitest_1.it)('devuelve la ficha con quien la registro y sus ultimas entradas', async () => {
            const creado = await (0, fixtures_1.api)(e.app, e.productor.token)
                .post('/animales')
                .send({ numeroOreja: '0700', sexo: 'HEMBRA', pesoKg: 40 });
            const r = await (0, fixtures_1.api)(e.app, e.trabajador.token).get(`/animales/${creado.body.id}`);
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body).toMatchObject({ numeroOreja: '0700', pesoKg: 40, estado: 'ACTIVO' });
            (0, vitest_1.expect)(r.body.registrador).toEqual({ id: e.productor.id, nombre: 'Productora A' });
            (0, vitest_1.expect)(r.body.ultimasEntradas).toHaveLength(1);
            (0, vitest_1.expect)(r.body.ultimasEntradas[0]).toMatchObject({ tipo: 'ALTA' });
            (0, vitest_1.expect)(r.body.ultimasEntradas[0].fecha).toBeTypeOf('string');
        });
        (0, vitest_1.it)('adjunta como maximo las 5 entradas mas recientes', async () => {
            for (let i = 0; i < 7; i += 1) {
                await prisma_1.prisma.bitacoraEntrada.create({
                    data: {
                        idAnimal: e.animal.id,
                        idUsuario: e.productor.id,
                        tipo: 'NOTA',
                        titulo: 'Nota',
                        descripcion: `Observacion ${i}`,
                        fechaEvento: new Date(Date.now() + i * 1000),
                    },
                });
            }
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get(`/animales/${e.animal.id}`);
            (0, vitest_1.expect)(r.body.ultimasEntradas).toHaveLength(5);
            (0, vitest_1.expect)(r.body.ultimasEntradas[0].descripcion).toBe('Observacion 6');
        });
        (0, vitest_1.it)('muestra tambien la ficha de un animal dado de baja', async () => {
            const inactivo = await (0, fixtures_1.crearAnimal)({
                idPredio: e.predioA.id,
                idRegistrador: e.productor.id,
                numeroOreja: '0800',
                estado: 'INACTIVO',
            });
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get(`/animales/${inactivo.id}`);
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.estado).toBe('INACTIVO');
            (0, vitest_1.expect)(r.body.motivoBaja).toBe('VENTA');
        });
        (0, vitest_1.it)('responde 404 si el animal es de otro predio (RNF_08)', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.ajeno.token).get(`/animales/${e.animal.id}`);
            (0, vitest_1.expect)(r.status).toBe(404);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('NO_ENCONTRADO');
        });
        (0, vitest_1.it)('responde 404 si el animal no existe', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get('/animales/11111111-1111-4111-8111-111111111111');
            (0, vitest_1.expect)(r.status).toBe(404);
        });
        (0, vitest_1.it)('responde 400 si el identificador no es un UUID', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get('/animales/no-es-uuid');
            (0, vitest_1.expect)(r.status).toBe(400);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('VALIDACION');
        });
        (0, vitest_1.it)('responde 401 sin token', async () => {
            const r = await (0, fixtures_1.api)(e.app).get(`/animales/${e.animal.id}`);
            (0, vitest_1.expect)(r.status).toBe(401);
        });
    });
    // ─── RF_03 ─────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)('PATCH /animales/:id (RF_03)', () => {
        (0, vitest_1.it)('edita los datos generales y registra el cambio en bitacora (RF_06.b)', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .patch(`/animales/${e.animal.id}`)
                .send({ raza: 'Merino', pesoKg: 48.5 });
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body).toMatchObject({ raza: 'Merino', pesoKg: 48.5, color: 'Blanco' });
            const bitacora = await entradas(e.animal.id, 'MODIFICACION');
            (0, vitest_1.expect)(bitacora).toHaveLength(1);
            (0, vitest_1.expect)(bitacora[0].idUsuario).toBe(e.productor.id);
            (0, vitest_1.expect)(bitacora[0].datos).toEqual({
                cambios: [
                    { campo: 'raza', valorAnterior: 'Suffolk', valorNuevo: 'Merino' },
                    { campo: 'pesoKg', valorAnterior: 45, valorNuevo: 48.5 },
                ],
            });
        });
        (0, vitest_1.it)('lo permite tambien al Trabajador', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.trabajador.token)
                .patch(`/animales/${e.animal.id}`)
                .send({ descripcion: 'Coja de la pata trasera' });
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.descripcion).toBe('Coja de la pata trasera');
        });
        (0, vitest_1.it)('permite borrar un dato opcional enviando null', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .patch(`/animales/${e.animal.id}`)
                .send({ color: null });
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.color).toBeNull();
            const bitacora = await entradas(e.animal.id, 'MODIFICACION');
            (0, vitest_1.expect)(bitacora[0].datos).toEqual({
                cambios: [{ campo: 'color', valorAnterior: 'Blanco', valorNuevo: null }],
            });
        });
        (0, vitest_1.it)('rechaza cambiar el numero de oreja', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .patch(`/animales/${e.animal.id}`)
                .send({ numeroOreja: '9999', raza: 'Merino' });
            (0, vitest_1.expect)(r.status).toBe(409);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('IDENTIFICADOR_INMUTABLE');
            const sinTocar = await prisma_1.prisma.animal.findUniqueOrThrow({ where: { id: e.animal.id } });
            (0, vitest_1.expect)(sinTocar.numeroOreja).toBe(e.animal.numeroOreja);
            (0, vitest_1.expect)(sinTocar.raza).toBe('Suffolk');
        });
        (0, vitest_1.it)('no deja editar un animal dado de baja', async () => {
            const inactivo = await (0, fixtures_1.crearAnimal)({
                idPredio: e.predioA.id,
                idRegistrador: e.productor.id,
                numeroOreja: '0900',
                estado: 'INACTIVO',
            });
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .patch(`/animales/${inactivo.id}`)
                .send({ raza: 'Merino' });
            (0, vitest_1.expect)(r.status).toBe(409);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('ANIMAL_INACTIVO');
        });
        (0, vitest_1.it)('no escribe bitacora cuando los valores enviados son los mismos', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .patch(`/animales/${e.animal.id}`)
                .send({ raza: 'Suffolk', pesoKg: 45, sexo: 'HEMBRA' });
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.raza).toBe('Suffolk');
            (0, vitest_1.expect)(await entradas(e.animal.id, 'MODIFICACION')).toHaveLength(0);
        });
        (0, vitest_1.it)('no escribe bitacora con un cuerpo vacio', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).patch(`/animales/${e.animal.id}`).send({});
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(await entradas(e.animal.id, 'MODIFICACION')).toHaveLength(0);
        });
        (0, vitest_1.it)('rechaza una fecha de nacimiento futura', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .patch(`/animales/${e.animal.id}`)
                .send({ fechaNacimiento: (0, fixtures_1.fechaRelativa)(10) });
            (0, vitest_1.expect)(r.status).toBe(422);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('FECHA_FUTURA');
        });
        (0, vitest_1.it)('responde 404 si el animal es de otro predio (RNF_08)', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.ajeno.token)
                .patch(`/animales/${e.animal.id}`)
                .send({ raza: 'Merino' });
            (0, vitest_1.expect)(r.status).toBe(404);
        });
        (0, vitest_1.it)('responde 401 sin token', async () => {
            const r = await (0, fixtures_1.api)(e.app).patch(`/animales/${e.animal.id}`).send({ raza: 'Merino' });
            (0, vitest_1.expect)(r.status).toBe(401);
        });
    });
    // ─── RF_04 ─────────────────────────────────────────────────────────────────
    (0, vitest_1.describe)('POST /animales/:id/baja (RF_04)', () => {
        const baja = { motivo: 'VENTA', fecha: (0, fixtures_1.fechaRelativa)(-1) };
        (0, vitest_1.it)('da de baja al animal y lo registra en bitacora (RF_06.c)', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .post(`/animales/${e.animal.id}/baja`)
                .send(baja);
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body).toMatchObject({ estado: 'INACTIVO', motivoBaja: 'VENTA' });
            (0, vitest_1.expect)(r.body.fechaBaja).toBe(`${baja.fecha}T00:00:00.000Z`);
            const bitacora = await entradas(e.animal.id, 'BAJA');
            (0, vitest_1.expect)(bitacora).toHaveLength(1);
            (0, vitest_1.expect)(bitacora[0].titulo).toBe('Baja por venta');
            (0, vitest_1.expect)(bitacora[0].idUsuario).toBe(e.productor.id);
            (0, vitest_1.expect)(bitacora[0].datos).toMatchObject({ motivo: 'VENTA', fecha: baja.fecha });
        });
        (0, vitest_1.it)('conserva el animal y su historial completo', async () => {
            await (0, fixtures_1.api)(e.app, e.productor.token)
                .patch(`/animales/${e.animal.id}`)
                .send({ raza: 'Merino' });
            await (0, fixtures_1.api)(e.app, e.productor.token).post(`/animales/${e.animal.id}/baja`).send(baja);
            (0, vitest_1.expect)(await prisma_1.prisma.animal.count({ where: { id: e.animal.id } })).toBe(1);
            (0, vitest_1.expect)(await entradas(e.animal.id)).toHaveLength(2);
            const ficha = await (0, fixtures_1.api)(e.app, e.productor.token).get(`/animales/${e.animal.id}`);
            (0, vitest_1.expect)(ficha.status).toBe(200);
            (0, vitest_1.expect)(ficha.body.ultimasEntradas).toHaveLength(2);
        });
        (0, vitest_1.it)('solo lo permite al Productor', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.trabajador.token)
                .post(`/animales/${e.animal.id}/baja`)
                .send(baja);
            (0, vitest_1.expect)(r.status).toBe(403);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('ROL_INSUFICIENTE');
            const sinTocar = await prisma_1.prisma.animal.findUniqueOrThrow({ where: { id: e.animal.id } });
            (0, vitest_1.expect)(sinTocar.estado).toBe('ACTIVO');
        });
        (0, vitest_1.it)('rechaza dar de baja dos veces al mismo animal', async () => {
            await (0, fixtures_1.api)(e.app, e.productor.token).post(`/animales/${e.animal.id}/baja`).send(baja);
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .post(`/animales/${e.animal.id}/baja`)
                .send({ motivo: 'MUERTE', fecha: baja.fecha });
            (0, vitest_1.expect)(r.status).toBe(409);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('ANIMAL_YA_INACTIVO');
            (0, vitest_1.expect)(await entradas(e.animal.id, 'BAJA')).toHaveLength(1);
        });
        (0, vitest_1.it)('rechaza una fecha de baja futura', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .post(`/animales/${e.animal.id}/baja`)
                .send({ motivo: 'MUERTE', fecha: (0, fixtures_1.fechaRelativa)(3) });
            (0, vitest_1.expect)(r.status).toBe(422);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('FECHA_FUTURA');
        });
        (0, vitest_1.it)('valida el motivo', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .post(`/animales/${e.animal.id}/baja`)
                .send({ motivo: 'REGALO', fecha: baja.fecha });
            (0, vitest_1.expect)(r.status).toBe(400);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('VALIDACION');
        });
        (0, vitest_1.it)('responde 404 si el animal es de otro predio (RNF_08)', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.ajeno.token).post(`/animales/${e.animal.id}/baja`).send(baja);
            (0, vitest_1.expect)(r.status).toBe(404);
            const sinTocar = await prisma_1.prisma.animal.findUniqueOrThrow({ where: { id: e.animal.id } });
            (0, vitest_1.expect)(sinTocar.estado).toBe('ACTIVO');
        });
        (0, vitest_1.it)('responde 401 sin token', async () => {
            const r = await (0, fixtures_1.api)(e.app).post(`/animales/${e.animal.id}/baja`).send(baja);
            (0, vitest_1.expect)(r.status).toBe(401);
        });
    });
});
//# sourceMappingURL=animales.test.js.map
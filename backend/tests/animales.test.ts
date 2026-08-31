import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { api, crearAnimal, crearEscenario, fechaRelativa, type Escenario } from './apoyo/fixtures';

/**
 * Modulo 1 - Ficha Animal (RF_01 a RF_04).
 *
 * Es el corazon de la trazabilidad SAG: cada mutacion tiene que dejar su
 * entrada de bitacora (RF_06), y nada se borra nunca.
 */
describe('Ficha Animal (RF_01 a RF_04)', () => {
  let e: Escenario;

  beforeEach(async () => {
    e = await crearEscenario();
  });

  const entradas = (idAnimal: string, tipo?: 'ALTA' | 'MODIFICACION' | 'BAJA') =>
    prisma.bitacoraEntrada.findMany({
      where: { idAnimal, ...(tipo ? { tipo } : {}) },
      orderBy: { createdAt: 'asc' },
    });

  // ─── RF_01 ─────────────────────────────────────────────────────────────────

  describe('POST /animales (RF_01)', () => {
    it('registra el animal y devuelve su ficha', async () => {
      const r = await api(e.app, e.productor.token).post('/animales').send({
        numeroOreja: '0123',
        sexo: 'MACHO',
        raza: 'Merino',
        color: 'Negro',
        pesoKg: 52.5,
        fechaNacimiento: '2024-03-15',
        descripcion: 'Carnero de reposicion',
      });

      expect(r.status).toBe(201);
      expect(r.body).toMatchObject({
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
      expect(r.body.fechaNacimiento).toBe('2024-03-15T00:00:00.000Z');
      expect(typeof r.body.pesoKg).toBe('number');
      expect(r.body.id).toBeTypeOf('string');
    });

    it('deja la entrada de ALTA en la misma operacion (RF_06.a)', async () => {
      const r = await api(e.app, e.productor.token)
        .post('/animales')
        .send({ numeroOreja: '0200', sexo: 'HEMBRA', raza: 'Suffolk' });

      const bitacora = await entradas(r.body.id);
      expect(bitacora).toHaveLength(1);
      expect(bitacora[0]!.tipo).toBe('ALTA');
      expect(bitacora[0]!.titulo).toContain('0200');
      expect(bitacora[0]!.idUsuario).toBe(e.productor.id);
      expect(bitacora[0]!.datos).toMatchObject({ numeroOreja: '0200', raza: 'Suffolk' });
    });

    it('lo permite tambien al Trabajador y guarda quien lo registro', async () => {
      const r = await api(e.app, e.trabajador.token)
        .post('/animales')
        .send({ numeroOreja: '0300', sexo: 'HEMBRA' });

      expect(r.status).toBe(201);
      const guardado = await prisma.animal.findUniqueOrThrow({ where: { id: r.body.id } });
      expect(guardado.idRegistrador).toBe(e.trabajador.id);
      expect(guardado.idPredio).toBe(e.predioA.id);
    });

    it('guarda el numero de oreja sin espacios sobrantes', async () => {
      const r = await api(e.app, e.productor.token)
        .post('/animales')
        .send({ numeroOreja: '  0400  ', sexo: 'MACHO' });

      expect(r.status).toBe(201);
      expect(r.body.numeroOreja).toBe('0400');
    });

    it('rechaza un numero de oreja repetido en el predio', async () => {
      const r = await api(e.app, e.productor.token)
        .post('/animales')
        .send({ numeroOreja: e.animal.numeroOreja, sexo: 'HEMBRA' });

      expect(r.status).toBe(409);
      expect(r.body.error.codigo).toBe('OREJA_DUPLICADA');
      expect(r.body.error.mensaje).toContain(e.animal.numeroOreja);
    });

    it('acepta el mismo numero de oreja en otro predio (RNF_08)', async () => {
      const r = await api(e.app, e.ajeno.token)
        .post('/animales')
        .send({ numeroOreja: e.animal.numeroOreja, sexo: 'HEMBRA' });

      expect(r.status).toBe(201);
      expect(r.body.numeroOreja).toBe(e.animal.numeroOreja);
    });

    it('rechaza una fecha de nacimiento futura', async () => {
      const r = await api(e.app, e.productor.token)
        .post('/animales')
        .send({ numeroOreja: '0500', sexo: 'MACHO', fechaNacimiento: fechaRelativa(5) });

      expect(r.status).toBe(422);
      expect(r.body.error.codigo).toBe('FECHA_FUTURA');
    });

    it('exige numero de oreja y sexo validos', async () => {
      const r = await api(e.app, e.productor.token)
        .post('/animales')
        .send({ numeroOreja: '   ', sexo: 'OTRO' });

      expect(r.status).toBe(400);
      expect(r.body.error.codigo).toBe('VALIDACION');
      expect(r.body.error.detalles).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ campo: 'numeroOreja' }),
          expect.objectContaining({ campo: 'sexo' }),
        ]),
      );
    });

    it('responde 401 sin token', async () => {
      const r = await api(e.app).post('/animales').send({ numeroOreja: '0600', sexo: 'MACHO' });
      expect(r.status).toBe(401);
    });
  });

  // ─── Listado del rebano ────────────────────────────────────────────────────

  describe('GET /animales', () => {
    beforeEach(async () => {
      await crearAnimal({ idPredio: e.predioA.id, idRegistrador: e.productor.id, numeroOreja: '0010' });
      await crearAnimal({ idPredio: e.predioA.id, idRegistrador: e.productor.id, numeroOreja: '0002' });
      await crearAnimal({
        idPredio: e.predioA.id,
        idRegistrador: e.productor.id,
        numeroOreja: 'A123',
        estado: 'INACTIVO',
      });
    });

    it('lista el rebano ordenado por numero de oreja con su resumen', async () => {
      const r = await api(e.app, e.trabajador.token).get('/animales');

      expect(r.status).toBe(200);
      expect(r.body.datos.map((a: { numeroOreja: string }) => a.numeroOreja)).toEqual([
        '0001',
        '0002',
        '0010',
        'A123',
      ]);
      expect(r.body.meta).toMatchObject({ pagina: 1, tamano: 20, total: 4, totalPaginas: 1 });
      expect(r.body.resumen).toEqual({ activos: 3, inactivos: 1 });
    });

    it('filtra por estado sin alterar el resumen del predio', async () => {
      const r = await api(e.app, e.productor.token).get('/animales?estado=INACTIVO');

      expect(r.status).toBe(200);
      expect(r.body.datos).toHaveLength(1);
      expect(r.body.datos[0].numeroOreja).toBe('A123');
      expect(r.body.resumen).toEqual({ activos: 3, inactivos: 1 });
    });

    it('busca por prefijo del numero de oreja sin distinguir mayusculas', async () => {
      const encontrado = await api(e.app, e.productor.token).get('/animales?q=a1');
      expect(encontrado.body.datos).toHaveLength(1);
      expect(encontrado.body.datos[0].numeroOreja).toBe('A123');

      // Es busqueda por prefijo, no por contenido.
      const vacio = await api(e.app, e.productor.token).get('/animales?q=123');
      expect(vacio.body.datos).toHaveLength(0);
      expect(vacio.body.meta.total).toBe(0);
    });

    it('pagina los resultados', async () => {
      const r = await api(e.app, e.productor.token).get('/animales?pagina=2&tamano=2');

      expect(r.body.datos.map((a: { numeroOreja: string }) => a.numeroOreja)).toEqual([
        '0010',
        'A123',
      ]);
      expect(r.body.meta).toMatchObject({ pagina: 2, tamano: 2, total: 4, totalPaginas: 2 });
    });

    it('no muestra animales de otro predio (RNF_08)', async () => {
      const r = await api(e.app, e.ajeno.token).get('/animales');

      expect(r.body.datos).toHaveLength(1);
      expect(r.body.datos[0].numeroOreja).toBe(e.animalAjeno.numeroOreja);
      expect(r.body.resumen).toEqual({ activos: 1, inactivos: 0 });
    });

    it('responde 401 sin token', async () => {
      const r = await api(e.app).get('/animales');
      expect(r.status).toBe(401);
    });
  });

  // ─── RF_02 ─────────────────────────────────────────────────────────────────

  describe('GET /animales/:id (RF_02)', () => {
    it('devuelve la ficha con quien la registro y sus ultimas entradas', async () => {
      const creado = await api(e.app, e.productor.token)
        .post('/animales')
        .send({ numeroOreja: '0700', sexo: 'HEMBRA', pesoKg: 40 });

      const r = await api(e.app, e.trabajador.token).get(`/animales/${creado.body.id}`);

      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ numeroOreja: '0700', pesoKg: 40, estado: 'ACTIVO' });
      expect(r.body.registrador).toEqual({ id: e.productor.id, nombre: 'Productora A' });
      expect(r.body.ultimasEntradas).toHaveLength(1);
      expect(r.body.ultimasEntradas[0]).toMatchObject({ tipo: 'ALTA' });
      expect(r.body.ultimasEntradas[0].fecha).toBeTypeOf('string');
    });

    it('adjunta como maximo las 5 entradas mas recientes', async () => {
      for (let i = 0; i < 7; i += 1) {
        await prisma.bitacoraEntrada.create({
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

      const r = await api(e.app, e.productor.token).get(`/animales/${e.animal.id}`);

      expect(r.body.ultimasEntradas).toHaveLength(5);
      expect(r.body.ultimasEntradas[0].descripcion).toBe('Observacion 6');
    });

    it('muestra tambien la ficha de un animal dado de baja', async () => {
      const inactivo = await crearAnimal({
        idPredio: e.predioA.id,
        idRegistrador: e.productor.id,
        numeroOreja: '0800',
        estado: 'INACTIVO',
      });

      const r = await api(e.app, e.productor.token).get(`/animales/${inactivo.id}`);

      expect(r.status).toBe(200);
      expect(r.body.estado).toBe('INACTIVO');
      expect(r.body.motivoBaja).toBe('VENTA');
    });

    it('responde 404 si el animal es de otro predio (RNF_08)', async () => {
      const r = await api(e.app, e.ajeno.token).get(`/animales/${e.animal.id}`);

      expect(r.status).toBe(404);
      expect(r.body.error.codigo).toBe('NO_ENCONTRADO');
    });

    it('responde 404 si el animal no existe', async () => {
      const r = await api(e.app, e.productor.token).get(
        '/animales/11111111-1111-4111-8111-111111111111',
      );
      expect(r.status).toBe(404);
    });

    it('responde 400 si el identificador no es un UUID', async () => {
      const r = await api(e.app, e.productor.token).get('/animales/no-es-uuid');
      expect(r.status).toBe(400);
      expect(r.body.error.codigo).toBe('VALIDACION');
    });

    it('responde 401 sin token', async () => {
      const r = await api(e.app).get(`/animales/${e.animal.id}`);
      expect(r.status).toBe(401);
    });
  });

  // ─── RF_03 ─────────────────────────────────────────────────────────────────

  describe('PATCH /animales/:id (RF_03)', () => {
    it('edita los datos generales y registra el cambio en bitacora (RF_06.b)', async () => {
      const r = await api(e.app, e.productor.token)
        .patch(`/animales/${e.animal.id}`)
        .send({ raza: 'Merino', pesoKg: 48.5 });

      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ raza: 'Merino', pesoKg: 48.5, color: 'Blanco' });

      const bitacora = await entradas(e.animal.id, 'MODIFICACION');
      expect(bitacora).toHaveLength(1);
      expect(bitacora[0]!.idUsuario).toBe(e.productor.id);
      expect(bitacora[0]!.datos).toEqual({
        cambios: [
          { campo: 'raza', valorAnterior: 'Suffolk', valorNuevo: 'Merino' },
          { campo: 'pesoKg', valorAnterior: 45, valorNuevo: 48.5 },
        ],
      });
    });

    it('lo permite tambien al Trabajador', async () => {
      const r = await api(e.app, e.trabajador.token)
        .patch(`/animales/${e.animal.id}`)
        .send({ descripcion: 'Coja de la pata trasera' });

      expect(r.status).toBe(200);
      expect(r.body.descripcion).toBe('Coja de la pata trasera');
    });

    it('permite borrar un dato opcional enviando null', async () => {
      const r = await api(e.app, e.productor.token)
        .patch(`/animales/${e.animal.id}`)
        .send({ color: null });

      expect(r.status).toBe(200);
      expect(r.body.color).toBeNull();

      const bitacora = await entradas(e.animal.id, 'MODIFICACION');
      expect(bitacora[0]!.datos).toEqual({
        cambios: [{ campo: 'color', valorAnterior: 'Blanco', valorNuevo: null }],
      });
    });

    it('rechaza cambiar el numero de oreja', async () => {
      const r = await api(e.app, e.productor.token)
        .patch(`/animales/${e.animal.id}`)
        .send({ numeroOreja: '9999', raza: 'Merino' });

      expect(r.status).toBe(409);
      expect(r.body.error.codigo).toBe('IDENTIFICADOR_INMUTABLE');

      const sinTocar = await prisma.animal.findUniqueOrThrow({ where: { id: e.animal.id } });
      expect(sinTocar.numeroOreja).toBe(e.animal.numeroOreja);
      expect(sinTocar.raza).toBe('Suffolk');
    });

    it('no deja editar un animal dado de baja', async () => {
      const inactivo = await crearAnimal({
        idPredio: e.predioA.id,
        idRegistrador: e.productor.id,
        numeroOreja: '0900',
        estado: 'INACTIVO',
      });

      const r = await api(e.app, e.productor.token)
        .patch(`/animales/${inactivo.id}`)
        .send({ raza: 'Merino' });

      expect(r.status).toBe(409);
      expect(r.body.error.codigo).toBe('ANIMAL_INACTIVO');
    });

    it('no escribe bitacora cuando los valores enviados son los mismos', async () => {
      const r = await api(e.app, e.productor.token)
        .patch(`/animales/${e.animal.id}`)
        .send({ raza: 'Suffolk', pesoKg: 45, sexo: 'HEMBRA' });

      expect(r.status).toBe(200);
      expect(r.body.raza).toBe('Suffolk');
      expect(await entradas(e.animal.id, 'MODIFICACION')).toHaveLength(0);
    });

    it('no escribe bitacora con un cuerpo vacio', async () => {
      const r = await api(e.app, e.productor.token).patch(`/animales/${e.animal.id}`).send({});

      expect(r.status).toBe(200);
      expect(await entradas(e.animal.id, 'MODIFICACION')).toHaveLength(0);
    });

    it('rechaza una fecha de nacimiento futura', async () => {
      const r = await api(e.app, e.productor.token)
        .patch(`/animales/${e.animal.id}`)
        .send({ fechaNacimiento: fechaRelativa(10) });

      expect(r.status).toBe(422);
      expect(r.body.error.codigo).toBe('FECHA_FUTURA');
    });

    it('responde 404 si el animal es de otro predio (RNF_08)', async () => {
      const r = await api(e.app, e.ajeno.token)
        .patch(`/animales/${e.animal.id}`)
        .send({ raza: 'Merino' });

      expect(r.status).toBe(404);
    });

    it('responde 401 sin token', async () => {
      const r = await api(e.app).patch(`/animales/${e.animal.id}`).send({ raza: 'Merino' });
      expect(r.status).toBe(401);
    });
  });

  // ─── RF_04 ─────────────────────────────────────────────────────────────────

  describe('POST /animales/:id/baja (RF_04)', () => {
    const baja = { motivo: 'VENTA', fecha: fechaRelativa(-1) };

    it('da de baja al animal y lo registra en bitacora (RF_06.c)', async () => {
      const r = await api(e.app, e.productor.token)
        .post(`/animales/${e.animal.id}/baja`)
        .send(baja);

      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ estado: 'INACTIVO', motivoBaja: 'VENTA' });
      expect(r.body.fechaBaja).toBe(`${baja.fecha}T00:00:00.000Z`);

      const bitacora = await entradas(e.animal.id, 'BAJA');
      expect(bitacora).toHaveLength(1);
      expect(bitacora[0]!.titulo).toBe('Baja por venta');
      expect(bitacora[0]!.idUsuario).toBe(e.productor.id);
      expect(bitacora[0]!.datos).toMatchObject({ motivo: 'VENTA', fecha: baja.fecha });
    });

    it('conserva el animal y su historial completo', async () => {
      await api(e.app, e.productor.token)
        .patch(`/animales/${e.animal.id}`)
        .send({ raza: 'Merino' });
      await api(e.app, e.productor.token).post(`/animales/${e.animal.id}/baja`).send(baja);

      expect(await prisma.animal.count({ where: { id: e.animal.id } })).toBe(1);
      expect(await entradas(e.animal.id)).toHaveLength(2);

      const ficha = await api(e.app, e.productor.token).get(`/animales/${e.animal.id}`);
      expect(ficha.status).toBe(200);
      expect(ficha.body.ultimasEntradas).toHaveLength(2);
    });

    it('solo lo permite al Productor', async () => {
      const r = await api(e.app, e.trabajador.token)
        .post(`/animales/${e.animal.id}/baja`)
        .send(baja);

      expect(r.status).toBe(403);
      expect(r.body.error.codigo).toBe('ROL_INSUFICIENTE');

      const sinTocar = await prisma.animal.findUniqueOrThrow({ where: { id: e.animal.id } });
      expect(sinTocar.estado).toBe('ACTIVO');
    });

    it('rechaza dar de baja dos veces al mismo animal', async () => {
      await api(e.app, e.productor.token).post(`/animales/${e.animal.id}/baja`).send(baja);

      const r = await api(e.app, e.productor.token)
        .post(`/animales/${e.animal.id}/baja`)
        .send({ motivo: 'MUERTE', fecha: baja.fecha });

      expect(r.status).toBe(409);
      expect(r.body.error.codigo).toBe('ANIMAL_YA_INACTIVO');
      expect(await entradas(e.animal.id, 'BAJA')).toHaveLength(1);
    });

    it('rechaza una fecha de baja futura', async () => {
      const r = await api(e.app, e.productor.token)
        .post(`/animales/${e.animal.id}/baja`)
        .send({ motivo: 'MUERTE', fecha: fechaRelativa(3) });

      expect(r.status).toBe(422);
      expect(r.body.error.codigo).toBe('FECHA_FUTURA');
    });

    it('valida el motivo', async () => {
      const r = await api(e.app, e.productor.token)
        .post(`/animales/${e.animal.id}/baja`)
        .send({ motivo: 'REGALO', fecha: baja.fecha });

      expect(r.status).toBe(400);
      expect(r.body.error.codigo).toBe('VALIDACION');
    });

    it('responde 404 si el animal es de otro predio (RNF_08)', async () => {
      const r = await api(e.app, e.ajeno.token).post(`/animales/${e.animal.id}/baja`).send(baja);

      expect(r.status).toBe(404);
      const sinTocar = await prisma.animal.findUniqueOrThrow({ where: { id: e.animal.id } });
      expect(sinTocar.estado).toBe('ACTIVO');
    });

    it('responde 401 sin token', async () => {
      const r = await api(e.app).post(`/animales/${e.animal.id}/baja`).send(baja);
      expect(r.status).toBe(401);
    });
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { fechaLocalISO } from '../src/shared/fechas';
import {
  api,
  crearAnimal,
  crearEscenario,
  crearUsuario,
  fechaRelativa,
  type Escenario,
} from './apoyo/fixtures';

/**
 * Modulo 4 - Planificacion de actividades (RF_11 a RF_14).
 *
 * Las cuatro operaciones estan permitidas para ambos roles ("El Productor o el
 * Pastor"), asi que en vez de casos de 403 la suite comprueba explicitamente
 * que el Trabajador puede ejecutar cada una. Lo que si se prueba en cada
 * endpoint es el aislamiento por predio (RNF_08) y la falta de sesion.
 */
describe('Planificacion de actividades (RF_11 a RF_14)', () => {
  let e: Escenario;

  beforeEach(async () => {
    e = await crearEscenario();
  });

  /** Crea una tarea por el endpoint real y devuelve su cuerpo. */
  async function nuevaTarea(campos: Record<string, unknown> = {}) {
    const r = await api(e.app, e.productor.token)
      .post('/tareas')
      .send({
        titulo: 'Esquilar el lote norte',
        fechaLimite: fechaRelativa(7),
        idResponsables: [e.trabajador.id],
        ...campos,
      });
    expect(r.status).toBe(201);
    return r.body;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // RF_11 - Crear tarea
  // ───────────────────────────────────────────────────────────────────────────
  describe('POST /tareas (RF_11)', () => {
    it('crea la tarea con responsables y animales asociados', async () => {
      const r = await api(e.app, e.productor.token)
        .post('/tareas')
        .send({
          titulo: 'Vacunar corderos',
          descripcion: 'Aplicar la dosis anual',
          fechaLimite: fechaRelativa(3),
          idResponsables: [e.trabajador.id, e.productor.id],
          idAnimales: [e.animal.id],
        });

      expect(r.status).toBe(201);
      expect(r.body).toMatchObject({
        titulo: 'Vacunar corderos',
        descripcion: 'Aplicar la dosis anual',
        estado: 'ACTIVA',
        completadaEn: null,
        completadaPor: null,
        creador: { id: e.productor.id },
      });
      expect(r.body.fechaLimite.slice(0, 10)).toBe(fechaRelativa(3));
      expect(r.body.responsables.map((u: { id: string }) => u.id).sort()).toEqual(
        [e.trabajador.id, e.productor.id].sort(),
      );
      expect(r.body.animales).toEqual([{ id: e.animal.id, numeroOreja: e.animal.numeroOreja }]);

      expect(await prisma.tareaUsuario.count({ where: { idTarea: r.body.id } })).toBe(2);
      expect(await prisma.tareaAnimal.count({ where: { idTarea: r.body.id } })).toBe(1);
    });

    it('acepta una tarea sin animales: la asociacion es opcional (H10)', async () => {
      const tarea = await nuevaTarea();
      expect(tarea.animales).toEqual([]);
      expect(tarea.descripcion).toBeNull();
    });

    it('rechaza una tarea sin responsables (RESPONSABLES_REQUERIDOS)', async () => {
      const r = await api(e.app, e.productor.token)
        .post('/tareas')
        .send({ titulo: 'Sin nadie a cargo', fechaLimite: fechaRelativa(2), idResponsables: [] });

      expect(r.status).toBe(422);
      expect(r.body.error.codigo).toBe('RESPONSABLES_REQUERIDOS');
    });

    it('rechaza un responsable de otro predio (RNF_08)', async () => {
      const r = await api(e.app, e.productor.token)
        .post('/tareas')
        .send({
          titulo: 'Tarea cruzada',
          fechaLimite: fechaRelativa(2),
          idResponsables: [e.ajeno.id],
        });

      expect(r.status).toBe(404);
      expect(r.body.error.mensaje).toBe('Alguno de los responsables no pertenece a este predio.');
    });

    it('rechaza un responsable inhabilitado (RF_22)', async () => {
      const inhabilitado = await crearUsuario({
        idPredio: e.predioA.id,
        email: 'fuera@test.cl',
        estado: 'INHABILITADO',
      });

      const r = await api(e.app, e.productor.token)
        .post('/tareas')
        .send({
          titulo: 'Tarea huerfana',
          fechaLimite: fechaRelativa(2),
          idResponsables: [inhabilitado.id],
        });

      expect(r.status).toBe(404);
      expect(r.body.error.mensaje).toBe('Alguno de los responsables no pertenece a este predio.');
    });

    it('rechaza un animal de otro predio (RNF_08)', async () => {
      const r = await api(e.app, e.productor.token)
        .post('/tareas')
        .send({
          titulo: 'Revisar animal ajeno',
          fechaLimite: fechaRelativa(2),
          idResponsables: [e.trabajador.id],
          idAnimales: [e.animalAjeno.id],
        });

      expect(r.status).toBe(404);
      expect(r.body.error.mensaje).toBe('Alguno de los animales no pertenece a este predio.');
    });

    it('rechaza una fecha de termino anterior a hoy (FECHA_PASADA)', async () => {
      const r = await api(e.app, e.productor.token)
        .post('/tareas')
        .send({
          titulo: 'Tarea atrasada',
          fechaLimite: fechaRelativa(-5),
          idResponsables: [e.trabajador.id],
        });

      expect(r.status).toBe(422);
      expect(r.body.error.codigo).toBe('FECHA_PASADA');
      expect(r.body.error.mensaje).toBe('La fecha de término debe ser hoy o posterior.');
    });

    it('acepta la fecha de hoy: el limite es inclusivo', async () => {
      const r = await api(e.app, e.productor.token)
        .post('/tareas')
        .send({
          titulo: 'Tarea para hoy',
          fechaLimite: fechaLocalISO(),
          idResponsables: [e.trabajador.id],
        });

      expect(r.status).toBe(201);
    });

    it('permite crear tambien al Trabajador (RF_11 es de ambos roles)', async () => {
      const r = await api(e.app, e.trabajador.token)
        .post('/tareas')
        .send({
          titulo: 'Reparar el cerco',
          fechaLimite: fechaRelativa(1),
          idResponsables: [e.trabajador.id],
        });

      expect(r.status).toBe(201);
      expect(r.body.creador.id).toBe(e.trabajador.id);
    });

    it('valida el formato del cuerpo', async () => {
      const r = await api(e.app, e.productor.token)
        .post('/tareas')
        .send({ titulo: '', fechaLimite: '31-08-2026', idResponsables: ['no-es-uuid'] });

      expect(r.status).toBe(400);
      expect(r.body.error.codigo).toBe('VALIDACION');
    });

    it('responde 401 sin token', async () => {
      const r = await api(e.app)
        .post('/tareas')
        .send({ titulo: 'x', fechaLimite: fechaRelativa(1), idResponsables: [e.trabajador.id] });
      expect(r.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Listado
  // ───────────────────────────────────────────────────────────────────────────
  describe('GET /tareas', () => {
    it('ordena por fecha de termino ascendente', async () => {
      await nuevaTarea({ titulo: 'Tercera', fechaLimite: fechaRelativa(10) });
      await nuevaTarea({ titulo: 'Primera', fechaLimite: fechaRelativa(1) });
      await nuevaTarea({ titulo: 'Segunda', fechaLimite: fechaRelativa(5) });

      const r = await api(e.app, e.productor.token).get('/tareas');

      expect(r.status).toBe(200);
      expect(r.body.meta).toMatchObject({ pagina: 1, total: 3, totalPaginas: 1 });
      expect(r.body.datos.map((t: { titulo: string }) => t.titulo)).toEqual([
        'Primera',
        'Segunda',
        'Tercera',
      ]);
    });

    it('filtra por estado', async () => {
      const pendiente = await nuevaTarea({ titulo: 'Pendiente' });
      const hecha = await nuevaTarea({ titulo: 'Hecha' });
      await api(e.app, e.productor.token).post(`/tareas/${hecha.id}/completar`).send({});

      const activas = await api(e.app, e.productor.token).get('/tareas?estado=ACTIVA');
      expect(activas.body.datos.map((t: { id: string }) => t.id)).toEqual([pendiente.id]);

      const completadas = await api(e.app, e.productor.token).get('/tareas?estado=COMPLETADA');
      expect(completadas.body.datos.map((t: { id: string }) => t.id)).toEqual([hecha.id]);
    });

    it('filtra por rango de fecha de termino', async () => {
      await nuevaTarea({ titulo: 'Cerca', fechaLimite: fechaRelativa(2) });
      await nuevaTarea({ titulo: 'Lejos', fechaLimite: fechaRelativa(30) });

      const r = await api(e.app, e.productor.token).get(
        `/tareas?desde=${fechaRelativa(1)}&hasta=${fechaRelativa(5)}`,
      );

      expect(r.body.meta.total).toBe(1);
      expect(r.body.datos[0].titulo).toBe('Cerca');
    });

    it('filtra por responsable asignado', async () => {
      const otro = await crearUsuario({ idPredio: e.predioA.id, email: 'pastor2@test.cl' });
      const suya = await nuevaTarea({ titulo: 'Del otro', idResponsables: [otro.id] });
      await nuevaTarea({ titulo: 'Del trabajador' });

      const r = await api(e.app, e.productor.token).get(`/tareas?idResponsable=${otro.id}`);

      expect(r.body.meta.total).toBe(1);
      expect(r.body.datos[0].id).toBe(suya.id);
    });

    it('pagina el resultado', async () => {
      await nuevaTarea({ titulo: 'A', fechaLimite: fechaRelativa(1) });
      await nuevaTarea({ titulo: 'B', fechaLimite: fechaRelativa(2) });
      await nuevaTarea({ titulo: 'C', fechaLimite: fechaRelativa(3) });

      const r = await api(e.app, e.productor.token).get('/tareas?pagina=2&tamano=2');

      expect(r.body.datos).toHaveLength(1);
      expect(r.body.datos[0].titulo).toBe('C');
      expect(r.body.meta).toMatchObject({ pagina: 2, tamano: 2, total: 3, totalPaginas: 2 });
    });

    it('no muestra tareas de otro predio (RNF_08)', async () => {
      await nuevaTarea({ titulo: 'Del predio A' });

      const r = await api(e.app, e.ajeno.token).get('/tareas');

      expect(r.status).toBe(200);
      expect(r.body.meta.total).toBe(0);
    });

    it('responde 401 sin token', async () => {
      const r = await api(e.app).get('/tareas');
      expect(r.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Detalle
  // ───────────────────────────────────────────────────────────────────────────
  describe('GET /tareas/:id', () => {
    it('devuelve el detalle con creador, responsables y animales', async () => {
      const creada = await nuevaTarea({ idAnimales: [e.animal.id] });

      const r = await api(e.app, e.trabajador.token).get(`/tareas/${creada.id}`);

      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({
        id: creada.id,
        estado: 'ACTIVA',
        creador: { id: e.productor.id, nombre: 'Productora A' },
        completadaPor: null,
      });
      expect(r.body.responsables).toEqual([{ id: e.trabajador.id, nombre: 'Trabajador A' }]);
      expect(r.body.animales).toEqual([{ id: e.animal.id, numeroOreja: e.animal.numeroOreja }]);
    });

    it('responde 404 con el token de otro predio (RNF_08)', async () => {
      const creada = await nuevaTarea();
      const r = await api(e.app, e.ajeno.token).get(`/tareas/${creada.id}`);
      expect(r.status).toBe(404);
      expect(r.body.error.codigo).toBe('NO_ENCONTRADO');
    });

    it('responde 401 sin token', async () => {
      const creada = await nuevaTarea();
      const r = await api(e.app).get(`/tareas/${creada.id}`);
      expect(r.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // RF_12 - Editar tarea
  // ───────────────────────────────────────────────────────────────────────────
  describe('PATCH /tareas/:id (RF_12)', () => {
    it('actualiza titulo, descripcion y fecha de termino', async () => {
      const creada = await nuevaTarea();

      const r = await api(e.app, e.productor.token)
        .patch(`/tareas/${creada.id}`)
        .send({ titulo: 'Esquilar el lote sur', descripcion: 'Se corre una semana', fechaLimite: fechaRelativa(14) });

      expect(r.status).toBe(200);
      expect(r.body.titulo).toBe('Esquilar el lote sur');
      expect(r.body.descripcion).toBe('Se corre una semana');
      expect(r.body.fechaLimite.slice(0, 10)).toBe(fechaRelativa(14));
    });

    it('reemplaza por completo la lista de responsables', async () => {
      const creada = await nuevaTarea();
      const otro = await crearUsuario({ idPredio: e.predioA.id, email: 'pastor3@test.cl' });

      const r = await api(e.app, e.productor.token)
        .patch(`/tareas/${creada.id}`)
        .send({ idResponsables: [otro.id] });

      expect(r.status).toBe(200);
      expect(r.body.responsables).toEqual([{ id: otro.id, nombre: 'Usuario de prueba' }]);
      expect(await prisma.tareaUsuario.count({ where: { idTarea: creada.id } })).toBe(1);
    });

    it('permite desvincular todos los animales con una lista vacia', async () => {
      const otroAnimal = await crearAnimal({
        idPredio: e.predioA.id,
        idRegistrador: e.productor.id,
        numeroOreja: '0002',
      });
      const creada = await nuevaTarea({ idAnimales: [e.animal.id, otroAnimal.id] });
      expect(creada.animales).toHaveLength(2);

      const r = await api(e.app, e.productor.token)
        .patch(`/tareas/${creada.id}`)
        .send({ idAnimales: [] });

      expect(r.status).toBe(200);
      expect(r.body.animales).toEqual([]);
      expect(await prisma.tareaAnimal.count({ where: { idTarea: creada.id } })).toBe(0);
    });

    it('no permite editar una tarea ya completada (TAREA_COMPLETADA)', async () => {
      const creada = await nuevaTarea();
      await api(e.app, e.productor.token).post(`/tareas/${creada.id}/completar`).send({});

      const r = await api(e.app, e.productor.token)
        .patch(`/tareas/${creada.id}`)
        .send({ titulo: 'Otro titulo' });

      expect(r.status).toBe(409);
      expect(r.body.error.codigo).toBe('TAREA_COMPLETADA');
      expect(r.body.error.mensaje).toBe('No se puede editar una tarea ya completada.');
    });

    it('rechaza dejar la tarea sin responsables', async () => {
      const creada = await nuevaTarea();
      const r = await api(e.app, e.productor.token)
        .patch(`/tareas/${creada.id}`)
        .send({ idResponsables: [] });

      expect(r.status).toBe(422);
      expect(r.body.error.codigo).toBe('RESPONSABLES_REQUERIDOS');
    });

    it('rechaza un responsable de otro predio', async () => {
      const creada = await nuevaTarea();
      const r = await api(e.app, e.productor.token)
        .patch(`/tareas/${creada.id}`)
        .send({ idResponsables: [e.ajeno.id] });

      expect(r.status).toBe(404);
      expect(r.body.error.mensaje).toBe('Alguno de los responsables no pertenece a este predio.');
    });

    it('rechaza mover la fecha de termino al pasado', async () => {
      const creada = await nuevaTarea();
      const r = await api(e.app, e.productor.token)
        .patch(`/tareas/${creada.id}`)
        .send({ fechaLimite: fechaRelativa(-5) });

      expect(r.status).toBe(422);
      expect(r.body.error.codigo).toBe('FECHA_PASADA');
    });

    it('permite editar tambien al Trabajador (RF_12 es de ambos roles)', async () => {
      const creada = await nuevaTarea();
      const r = await api(e.app, e.trabajador.token)
        .patch(`/tareas/${creada.id}`)
        .send({ titulo: 'Corregido en terreno' });

      expect(r.status).toBe(200);
      expect(r.body.titulo).toBe('Corregido en terreno');
    });

    it('responde 404 con el token de otro predio (RNF_08)', async () => {
      const creada = await nuevaTarea();
      const r = await api(e.app, e.ajeno.token)
        .patch(`/tareas/${creada.id}`)
        .send({ titulo: 'Intruso' });

      expect(r.status).toBe(404);
    });

    it('responde 401 sin token', async () => {
      const creada = await nuevaTarea();
      const r = await api(e.app).patch(`/tareas/${creada.id}`).send({ titulo: 'x' });
      expect(r.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // RF_13 - Completar tarea
  // ───────────────────────────────────────────────────────────────────────────
  describe('POST /tareas/:id/completar (RF_13)', () => {
    it('registra la fecha y quien la marco', async () => {
      const creada = await nuevaTarea();

      const r = await api(e.app, e.trabajador.token)
        .post(`/tareas/${creada.id}/completar`)
        .send({});

      expect(r.status).toBe(200);
      expect(r.body.estado).toBe('COMPLETADA');
      expect(r.body.completadaEn).toBeTypeOf('string');
      expect(r.body.completadaPor).toEqual({ id: e.trabajador.id, nombre: 'Trabajador A' });

      const enBd = await prisma.tarea.findUniqueOrThrow({ where: { id: creada.id } });
      expect(enBd.idCompletadaPor).toBe(e.trabajador.id);
      expect(enBd.completadaEn).toBeInstanceOf(Date);
    });

    it('mantiene la tarea visible en el listado despues de completarla', async () => {
      const creada = await nuevaTarea();
      await api(e.app, e.productor.token).post(`/tareas/${creada.id}/completar`).send({});

      const listado = await api(e.app, e.productor.token).get('/tareas');
      expect(listado.body.meta.total).toBe(1);
      expect(listado.body.datos[0]).toMatchObject({ id: creada.id, estado: 'COMPLETADA' });
    });

    it('no permite completarla dos veces (TAREA_COMPLETADA)', async () => {
      const creada = await nuevaTarea();
      await api(e.app, e.productor.token).post(`/tareas/${creada.id}/completar`).send({});

      const r = await api(e.app, e.productor.token)
        .post(`/tareas/${creada.id}/completar`)
        .send({});

      expect(r.status).toBe(409);
      expect(r.body.error.codigo).toBe('TAREA_COMPLETADA');
      expect(r.body.error.mensaje).toBe('No se puede completar una tarea ya completada.');
    });

    it('responde 404 con el token de otro predio (RNF_08)', async () => {
      const creada = await nuevaTarea();
      const r = await api(e.app, e.ajeno.token).post(`/tareas/${creada.id}/completar`).send({});

      expect(r.status).toBe(404);
      const enBd = await prisma.tarea.findUniqueOrThrow({ where: { id: creada.id } });
      expect(enBd.estado).toBe('ACTIVA');
    });

    it('responde 401 sin token', async () => {
      const creada = await nuevaTarea();
      const r = await api(e.app).post(`/tareas/${creada.id}/completar`).send({});
      expect(r.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // RF_14 - Eliminar tarea
  // ───────────────────────────────────────────────────────────────────────────
  describe('DELETE /tareas/:id (RF_14)', () => {
    it('elimina la tarea de forma permanente y arrastra sus asociaciones', async () => {
      const creada = await nuevaTarea({ idAnimales: [e.animal.id] });

      const r = await api(e.app, e.productor.token).delete(`/tareas/${creada.id}`);

      expect(r.status).toBe(204);
      expect(r.body).toEqual({});
      expect(await prisma.tarea.count({ where: { id: creada.id } })).toBe(0);
      expect(await prisma.tareaUsuario.count({ where: { idTarea: creada.id } })).toBe(0);
      expect(await prisma.tareaAnimal.count({ where: { idTarea: creada.id } })).toBe(0);
    });

    it('permite eliminar tambien al Trabajador (RF_14 es de ambos roles)', async () => {
      const creada = await nuevaTarea();
      const r = await api(e.app, e.trabajador.token).delete(`/tareas/${creada.id}`);
      expect(r.status).toBe(204);
    });

    it('elimina tambien una tarea ya completada', async () => {
      const creada = await nuevaTarea();
      await api(e.app, e.productor.token).post(`/tareas/${creada.id}/completar`).send({});

      const r = await api(e.app, e.productor.token).delete(`/tareas/${creada.id}`);
      expect(r.status).toBe(204);
    });

    it('responde 404 con el token de otro predio y no borra nada (RNF_08)', async () => {
      const creada = await nuevaTarea();

      const r = await api(e.app, e.ajeno.token).delete(`/tareas/${creada.id}`);

      expect(r.status).toBe(404);
      expect(await prisma.tarea.count({ where: { id: creada.id } })).toBe(1);
    });

    it('responde 401 sin token', async () => {
      const creada = await nuevaTarea();
      const r = await api(e.app).delete(`/tareas/${creada.id}`);
      expect(r.status).toBe(401);
    });
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { fechaLocalISO, inicioDelDia, sumarDias } from '../src/shared/fechas';
import { api, crearAnimal, crearEscenario, type Escenario } from './apoyo/fixtures';

/**
 * Modulo 3 - Organizador de eventos (RF_07 a RF_10).
 *
 * Las fechas se construyen como medianoche LOCAL del predio y no con
 * `new Date().toISOString()`: la regla de RF_07 compara dias calendario en
 * America/Santiago, y una fecha UTC haria fallar la suite de noche.
 */
const enDias = (dias: number): string =>
  inicioDelDia(sumarDias(fechaLocalISO(), dias)).toISOString();

describe('Organizador de eventos (RF_07 a RF_10)', () => {
  let e: Escenario;
  let segundoAnimal: { id: string; numeroOreja: string };
  let tercerAnimal: { id: string; numeroOreja: string };

  beforeEach(async () => {
    e = await crearEscenario();
    segundoAnimal = await crearAnimal({
      idPredio: e.predioA.id,
      idRegistrador: e.productor.id,
      numeroOreja: '0002',
    });
    tercerAnimal = await crearAnimal({
      idPredio: e.predioA.id,
      idRegistrador: e.productor.id,
      numeroOreja: '0003',
    });
  });

  /** Crea un evento por el endpoint real y devuelve su DTO. */
  async function crearEvento(
    cuerpo: Partial<{ tipo: string; descripcion: string; fechaInicio: string; idAnimales: string[] }> = {},
  ) {
    const r = await api(e.app, e.productor.token)
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

  describe('POST /eventos (RF_07)', () => {
    it('registra el evento con sus animales y lo anota en la bitacora (RF_06.d)', async () => {
      const r = await api(e.app, e.productor.token)
        .post('/eventos')
        .send({
          tipo: 'ESQUILA',
          descripcion: 'Esquila de primavera',
          fechaInicio: enDias(3),
          idAnimales: [e.animal.id, segundoAnimal.id],
        });

      expect(r.status).toBe(201);
      expect(r.body).toMatchObject({
        tipo: 'ESQUILA',
        descripcion: 'Esquila de primavera',
        estado: 'PROGRAMADO',
        eliminadoEn: null,
        creador: { id: e.productor.id, nombre: 'Productora A' },
      });
      expect(r.body.animales.map((a: { numeroOreja: string }) => a.numeroOreja)).toEqual([
        '0001',
        '0002',
      ]);
      expect(r.body.animales[0]).toMatchObject({ sexo: 'HEMBRA', estado: 'ACTIVO' });

      const asociados = await prisma.eventoAnimal.count({ where: { idEvento: r.body.id } });
      expect(asociados).toBe(2);

      const bitacora = await prisma.bitacoraEntrada.findMany({ where: { idEvento: r.body.id } });
      expect(bitacora).toHaveLength(2);
      expect(bitacora[0]).toMatchObject({ tipo: 'EVENTO', titulo: 'Esquila', eventoEliminado: false });
    });

    it('acepta un evento para hoy', async () => {
      const r = await api(e.app, e.productor.token)
        .post('/eventos')
        .send({ tipo: 'OTRO', fechaInicio: enDias(0), idAnimales: [e.animal.id] });

      expect(r.status).toBe(201);
    });

    it('rechaza una fecha anterior a hoy', async () => {
      const r = await api(e.app, e.productor.token)
        .post('/eventos')
        .send({ tipo: 'ENCASTE', fechaInicio: enDias(-1), idAnimales: [e.animal.id] });

      expect(r.status).toBe(422);
      expect(r.body.error.codigo).toBe('FECHA_PASADA');
    });

    it('exige al menos un animal', async () => {
      const r = await api(e.app, e.productor.token)
        .post('/eventos')
        .send({ tipo: 'ENCASTE', fechaInicio: enDias(1), idAnimales: [] });

      expect(r.status).toBe(422);
      expect(r.body.error.codigo).toBe('ANIMALES_REQUERIDOS');
    });

    it('rechaza el registro si algun animal esta inactivo y nombra su numero de oreja', async () => {
      const inactivo = await crearAnimal({
        idPredio: e.predioA.id,
        idRegistrador: e.productor.id,
        numeroOreja: '0099',
        estado: 'INACTIVO',
      });

      const r = await api(e.app, e.productor.token)
        .post('/eventos')
        .send({ tipo: 'ENCASTE', fechaInicio: enDias(1), idAnimales: [e.animal.id, inactivo.id] });

      expect(r.status).toBe(422);
      expect(r.body.error.codigo).toBe('ANIMALES_INACTIVOS');
      expect(r.body.error.mensaje).toBe('Hay animales seleccionados que no estan activos.');
      expect(r.body.error.detalles).toEqual(['0099']);
      expect(await prisma.evento.count()).toBe(0);
    });

    it('rechaza animales de otro predio (RNF_08)', async () => {
      const r = await api(e.app, e.productor.token)
        .post('/eventos')
        .send({ tipo: 'ENCASTE', fechaInicio: enDias(1), idAnimales: [e.animalAjeno.id] });

      expect(r.status).toBe(422);
      expect(r.body.error.codigo).toBe('ANIMALES_INACTIVOS');
      expect(r.body.error.detalles).toEqual([e.animalAjeno.id]);
    });

    it('valida el tipo de evento', async () => {
      const r = await api(e.app, e.productor.token)
        .post('/eventos')
        .send({ tipo: 'PARICION', fechaInicio: enDias(1), idAnimales: [e.animal.id] });

      expect(r.status).toBe(400);
      expect(r.body.error.codigo).toBe('VALIDACION');
    });

    it('prohibe registrar eventos al Trabajador', async () => {
      const r = await api(e.app, e.trabajador.token)
        .post('/eventos')
        .send({ tipo: 'ENCASTE', fechaInicio: enDias(1), idAnimales: [e.animal.id] });

      expect(r.status).toBe(403);
      expect(r.body.error.codigo).toBe('ROL_INSUFICIENTE');
    });

    it('exige sesion iniciada', async () => {
      const r = await api(e.app)
        .post('/eventos')
        .send({ tipo: 'ENCASTE', fechaInicio: enDias(1), idAnimales: [e.animal.id] });

      expect(r.status).toBe(401);
    });
  });

  // ─── Listado ───────────────────────────────────────────────────────────────

  describe('GET /eventos', () => {
    it('lista los eventos del predio de mas reciente a mas antiguo', async () => {
      await crearEvento({ fechaInicio: enDias(1) });
      const lejano = await crearEvento({ fechaInicio: enDias(9), tipo: 'ESQUILA' });

      const r = await api(e.app, e.trabajador.token).get('/eventos');

      expect(r.status).toBe(200);
      expect(r.body.meta).toMatchObject({ pagina: 1, total: 2, totalPaginas: 1 });
      expect(r.body.datos[0].id).toBe(lejano.id);
    });

    it('excluye los eventos eliminados salvo que se pidan', async () => {
      const evento = await crearEvento();
      await api(e.app, e.productor.token).delete(`/eventos/${evento.id}`);

      const porDefecto = await api(e.app, e.productor.token).get('/eventos');
      expect(porDefecto.body.meta.total).toBe(0);

      const conEliminados = await api(e.app, e.productor.token).get(
        '/eventos?incluirEliminados=true',
      );
      expect(conEliminados.body.meta.total).toBe(1);
      expect(conEliminados.body.datos[0].estado).toBe('ELIMINADO');
    });

    it('filtra por tipo y por rango de fechas', async () => {
      await crearEvento({ tipo: 'ENCASTE', fechaInicio: enDias(1) });
      await crearEvento({ tipo: 'ESQUILA', fechaInicio: enDias(5) });

      const porTipo = await api(e.app, e.productor.token).get('/eventos?tipo=ESQUILA');
      expect(porTipo.body.meta.total).toBe(1);
      expect(porTipo.body.datos[0].tipo).toBe('ESQUILA');

      const hoyISO = fechaLocalISO();
      const porRango = await api(e.app, e.productor.token).get(
        `/eventos?desde=${sumarDias(hoyISO, 4)}&hasta=${sumarDias(hoyISO, 6)}`,
      );
      expect(porRango.body.meta.total).toBe(1);
      expect(porRango.body.datos[0].tipo).toBe('ESQUILA');
    });

    it('rechaza un rango de fechas invertido', async () => {
      const hoyISO = fechaLocalISO();
      const r = await api(e.app, e.productor.token).get(
        `/eventos?desde=${sumarDias(hoyISO, 6)}&hasta=${hoyISO}`,
      );

      expect(r.status).toBe(422);
      expect(r.body.error.codigo).toBe('RANGO_INVALIDO');
    });

    it('no muestra eventos de otro predio (RNF_08)', async () => {
      await crearEvento();

      const r = await api(e.app, e.ajeno.token).get('/eventos');

      expect(r.status).toBe(200);
      expect(r.body.meta.total).toBe(0);
    });

    it('exige sesion iniciada', async () => {
      const r = await api(e.app).get('/eventos');
      expect(r.status).toBe(401);
    });
  });

  // ─── RF_08 Consultar detalle ───────────────────────────────────────────────

  describe('GET /eventos/:id (RF_08)', () => {
    it('devuelve el detalle con su creador y sus animales', async () => {
      const evento = await crearEvento({ idAnimales: [e.animal.id, segundoAnimal.id] });

      const r = await api(e.app, e.trabajador.token).get(`/eventos/${evento.id}`);

      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({
        id: evento.id,
        tipo: 'ENCASTE',
        descripcion: 'Encaste del lote norte',
        estado: 'PROGRAMADO',
        creador: { id: e.productor.id, nombre: 'Productora A' },
      });
      expect(r.body.animales).toHaveLength(2);
      expect(r.body.animales[0]).toMatchObject({
        id: e.animal.id,
        numeroOreja: '0001',
        raza: 'Suffolk',
        estado: 'ACTIVO',
      });
    });

    it('permite consultar un evento eliminado, al que se llega desde la bitacora (RF_10)', async () => {
      const evento = await crearEvento();
      await api(e.app, e.productor.token).delete(`/eventos/${evento.id}`);

      const r = await api(e.app, e.productor.token).get(`/eventos/${evento.id}`);

      expect(r.status).toBe(200);
      expect(r.body.estado).toBe('ELIMINADO');
      expect(r.body.eliminadoEn).not.toBeNull();
    });

    it('responde 404 con el token de otro predio (RNF_08)', async () => {
      const evento = await crearEvento();

      const r = await api(e.app, e.ajeno.token).get(`/eventos/${evento.id}`);

      expect(r.status).toBe(404);
      expect(r.body.error.codigo).toBe('NO_ENCONTRADO');
    });

    it('responde 404 si el evento no existe', async () => {
      const r = await api(e.app, e.productor.token).get(
        '/eventos/00000000-0000-4000-8000-000000000000',
      );
      expect(r.status).toBe(404);
    });

    it('exige sesion iniciada', async () => {
      const evento = await crearEvento();
      const r = await api(e.app).get(`/eventos/${evento.id}`);
      expect(r.status).toBe(401);
    });
  });

  // ─── RF_09 Editar evento ───────────────────────────────────────────────────

  describe('PATCH /eventos/:id (RF_09)', () => {
    it('actualiza la descripcion y la fecha', async () => {
      const evento = await crearEvento();

      const r = await api(e.app, e.productor.token)
        .patch(`/eventos/${evento.id}`)
        .send({ descripcion: 'Se corre al potrero sur', fechaInicio: enDias(6) });

      expect(r.status).toBe(200);
      expect(r.body.descripcion).toBe('Se corre al potrero sur');
      expect(new Date(r.body.fechaInicio).toISOString()).toBe(enDias(6));

      const bitacora = await prisma.bitacoraEntrada.findMany({ where: { idEvento: evento.id } });
      expect(bitacora[0]!.descripcion).toBe('Se corre al potrero sur');
    });

    it('reemplaza la lista de animales y sincroniza la bitacora (RF_06)', async () => {
      const evento = await crearEvento({ idAnimales: [e.animal.id, segundoAnimal.id] });

      const r = await api(e.app, e.productor.token)
        .patch(`/eventos/${evento.id}`)
        .send({ idAnimales: [e.animal.id, tercerAnimal.id] });

      expect(r.status).toBe(200);
      expect(r.body.animales.map((a: { numeroOreja: string }) => a.numeroOreja)).toEqual([
        '0001',
        '0003',
      ]);

      const asociados = await prisma.eventoAnimal.findMany({ where: { idEvento: evento.id } });
      expect(asociados).toHaveLength(2);

      // La entrada del animal que salio se conserva, marcada (RF_06 append-only).
      const salido = await prisma.bitacoraEntrada.findFirst({
        where: { idEvento: evento.id, idAnimal: segundoAnimal.id },
      });
      expect(salido?.eventoEliminado).toBe(true);

      const entrante = await prisma.bitacoraEntrada.findFirst({
        where: { idEvento: evento.id, idAnimal: tercerAnimal.id },
      });
      expect(entrante?.eventoEliminado).toBe(false);
    });

    it('conserva un animal que se dio de baja despues de crearse el evento', async () => {
      const evento = await crearEvento({ idAnimales: [e.animal.id, segundoAnimal.id] });

      await prisma.animal.update({
        where: { id: segundoAnimal.id },
        data: {
          estado: 'INACTIVO',
          motivoBaja: 'MUERTE',
          fechaBaja: new Date('2026-02-01T00:00:00.000Z'),
        },
      });

      const r = await api(e.app, e.productor.token)
        .patch(`/eventos/${evento.id}`)
        .send({ idAnimales: [e.animal.id, segundoAnimal.id, tercerAnimal.id] });

      expect(r.status).toBe(200);
      expect(r.body.animales).toHaveLength(3);
    });

    it('rechaza agregar un animal inactivo', async () => {
      const evento = await crearEvento();
      const inactivo = await crearAnimal({
        idPredio: e.predioA.id,
        idRegistrador: e.productor.id,
        numeroOreja: '0098',
        estado: 'INACTIVO',
      });

      const r = await api(e.app, e.productor.token)
        .patch(`/eventos/${evento.id}`)
        .send({ idAnimales: [e.animal.id, inactivo.id] });

      expect(r.status).toBe(422);
      expect(r.body.error.codigo).toBe('ANIMALES_INACTIVOS');
      expect(r.body.error.detalles).toEqual(['0098']);

      const asociados = await prisma.eventoAnimal.count({ where: { idEvento: evento.id } });
      expect(asociados).toBe(1);
    });

    it('exige al menos un animal', async () => {
      const evento = await crearEvento();

      const r = await api(e.app, e.productor.token)
        .patch(`/eventos/${evento.id}`)
        .send({ idAnimales: [] });

      expect(r.status).toBe(422);
      expect(r.body.error.codigo).toBe('ANIMALES_REQUERIDOS');
    });

    it('no deja cambiar el tipo de evento', async () => {
      const evento = await crearEvento();

      const r = await api(e.app, e.productor.token)
        .patch(`/eventos/${evento.id}`)
        .send({ tipo: 'ESQUILA' });

      expect(r.status).toBe(409);
      expect(r.body.error.codigo).toBe('TIPO_EVENTO_INMUTABLE');
      expect(r.body.error.mensaje).toBe(
        'El tipo de evento no se puede modificar una vez registrado.',
      );
    });

    it('no deja editar un evento eliminado', async () => {
      const evento = await crearEvento();
      await api(e.app, e.productor.token).delete(`/eventos/${evento.id}`);

      const r = await api(e.app, e.productor.token)
        .patch(`/eventos/${evento.id}`)
        .send({ descripcion: 'Reactivado a mano' });

      expect(r.status).toBe(409);
      expect(r.body.error.codigo).toBe('EVENTO_ELIMINADO');
    });

    it('prohibe editar al Trabajador', async () => {
      const evento = await crearEvento();

      const r = await api(e.app, e.trabajador.token)
        .patch(`/eventos/${evento.id}`)
        .send({ descripcion: 'Cambio no autorizado' });

      expect(r.status).toBe(403);
    });

    it('responde 404 con el token de otro predio (RNF_08)', async () => {
      const evento = await crearEvento();

      const r = await api(e.app, e.ajeno.token)
        .patch(`/eventos/${evento.id}`)
        .send({ descripcion: 'Cambio desde otro predio' });

      expect(r.status).toBe(404);
    });
  });

  // ─── RF_10 Eliminar evento ─────────────────────────────────────────────────

  describe('DELETE /eventos/:id (RF_10)', () => {
    it('elimina de forma logica y conserva la bitacora marcada', async () => {
      const evento = await crearEvento({ idAnimales: [e.animal.id, segundoAnimal.id] });

      const r = await api(e.app, e.productor.token).delete(`/eventos/${evento.id}`);

      expect(r.status).toBe(204);
      expect(r.body).toEqual({});

      const fila = await prisma.evento.findUnique({ where: { id: evento.id } });
      expect(fila?.estado).toBe('ELIMINADO');
      expect(fila?.eliminadoEn).not.toBeNull();

      const asociados = await prisma.eventoAnimal.count({ where: { idEvento: evento.id } });
      expect(asociados).toBe(2);

      const bitacora = await prisma.bitacoraEntrada.findMany({ where: { idEvento: evento.id } });
      expect(bitacora).toHaveLength(2);
      expect(bitacora.every((b) => b.eventoEliminado)).toBe(true);
    });

    it('no permite eliminar dos veces el mismo evento', async () => {
      const evento = await crearEvento();
      await api(e.app, e.productor.token).delete(`/eventos/${evento.id}`);

      const r = await api(e.app, e.productor.token).delete(`/eventos/${evento.id}`);

      expect(r.status).toBe(409);
      expect(r.body.error.codigo).toBe('EVENTO_ELIMINADO');
    });

    it('prohibe eliminar al Trabajador', async () => {
      const evento = await crearEvento();

      const r = await api(e.app, e.trabajador.token).delete(`/eventos/${evento.id}`);

      expect(r.status).toBe(403);
    });

    it('responde 404 con el token de otro predio (RNF_08)', async () => {
      const evento = await crearEvento();

      const r = await api(e.app, e.ajeno.token).delete(`/eventos/${evento.id}`);

      expect(r.status).toBe(404);
      expect(await prisma.evento.count({ where: { estado: 'PROGRAMADO' } })).toBe(1);
    });

    it('exige sesion iniciada', async () => {
      const evento = await crearEvento();

      const r = await api(e.app).delete(`/eventos/${evento.id}`);

      expect(r.status).toBe(401);
    });
  });
});

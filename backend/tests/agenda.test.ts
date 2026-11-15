import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { aFechaSolo, fechaLocalISO, finDelDia, inicioDelDia, sumarDias } from '../src/shared/fechas';
import { api, crearEscenario, crearUsuario, type Escenario } from './apoyo/fixtures';

/**
 * Modulo 5 - Pantalla de inicio y calendario (RF_15, RF_16).
 *
 * Los modulos 3 (eventos) y 4 (tareas) se implementan en paralelo, asi que aqui
 * los datos se siembran directamente con Prisma: el modulo de agenda solo lee y
 * no depende de los endpoints de esos modulos.
 */

const HOY = fechaLocalISO();

/** Instante de hoy a la hora local indicada, en la zona del predio. */
function hoyALas(horas: number, minutos = 0): Date {
  return new Date(inicioDelDia(HOY).getTime() + (horas * 60 + minutos) * 60_000);
}

async function crearEvento(args: {
  idPredio: string;
  idCreador: string;
  fechaInicio: Date;
  tipo?: 'ENCASTE' | 'ESQUILA' | 'ATENCION_SANITARIA' | 'OTRO';
  estado?: 'PROGRAMADO' | 'REALIZADO' | 'ELIMINADO';
  descripcion?: string;
  idAnimales?: string[];
}) {
  return prisma.evento.create({
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

async function crearTarea(args: {
  idPredio: string;
  idCreador: string;
  fechaLimite: string;
  titulo?: string;
  descripcion?: string;
  estado?: 'ACTIVA' | 'COMPLETADA';
  idResponsables?: string[];
  idCompletadaPor?: string;
}) {
  return prisma.tarea.create({
    data: {
      idPredio: args.idPredio,
      idCreador: args.idCreador,
      titulo: args.titulo ?? 'Revisar cerco',
      descripcion: args.descripcion ?? null,
      fechaLimite: aFechaSolo(args.fechaLimite),
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

describe('Modulo 5 - Pantalla de inicio y calendario (RF_15, RF_16)', () => {
  let e: Escenario;

  beforeEach(async () => {
    e = await crearEscenario();
  });

  // ─── RF_15 - resumen de la pantalla de inicio ──────────────────────────────

  describe('GET /inicio/resumen (RF_15)', () => {
    it('devuelve las tarjetas de resumen del predio', async () => {
      await prisma.animal.createMany({
        data: [
          { idPredio: e.predioA.id, idRegistrador: e.productor.id, numeroOreja: '0002', sexo: 'MACHO' },
          { idPredio: e.predioA.id, idRegistrador: e.productor.id, numeroOreja: '0003', sexo: 'HEMBRA' },
        ],
      });
      // Un animal dado de baja no cuenta como rebano activo (RF_04).
      await prisma.animal.create({
        data: {
          idPredio: e.predioA.id,
          idRegistrador: e.productor.id,
          numeroOreja: '0004',
          sexo: 'HEMBRA',
          estado: 'INACTIVO',
          motivoBaja: 'VENTA',
          fechaBaja: aFechaSolo(HOY),
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
        fechaLimite: sumarDias(HOY, 1),
      });

      const r = await api(e.app, e.productor.token).get('/inicio/resumen');

      expect(r.status).toBe(200);
      expect(r.body.animalesActivos).toBe(3);
      expect(r.body.tareasHoy).toBe(3);
    });

    it('el Trabajador tambien puede consultarlo', async () => {
      const r = await api(e.app, e.trabajador.token).get('/inicio/resumen');
      expect(r.status).toBe(200);
    });

    it('aisla los conteos por predio (RNF_08)', async () => {
      await crearTarea({ idPredio: e.predioA.id, idCreador: e.productor.id, fechaLimite: HOY });

      const r = await api(e.app, e.ajeno.token).get('/inicio/resumen');

      expect(r.status).toBe(200);
      // El predio B solo tiene su propio animal y ningun dato del predio A.
      expect(r.body.animalesActivos).toBe(1);
      expect(r.body.tareasHoy).toBe(0);
    });

    it('responde 401 sin token', async () => {
      const r = await api(e.app).get('/inicio/resumen');
      expect(r.status).toBe(401);
      expect(r.body.error.codigo).toBe('NO_AUTENTICADO');
    });
  });

  // ─── RF_15 - actividades del dia ───────────────────────────────────────────

  describe('GET /agenda/hoy (RF_15)', () => {
    it('unifica eventos y tareas del dia en una sola lista ordenada', async () => {
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

      const r = await api(e.app, e.productor.token).get('/agenda/hoy');

      expect(r.status).toBe(200);
      expect(r.body.fecha).toBe(HOY);
      expect(r.body.items).toHaveLength(2);

      const item = (id: string) =>
        (r.body.items as Array<{ id: string }>).find((i) => i.id === id);

      expect(item(evento.id)).toMatchObject({
        clase: 'EVENTO',
        tipo: 'ESQUILA',
        titulo: 'Esquila',
        descripcion: 'Esquila del lote 1',
        estado: 'PROGRAMADO',
        meta: { animales: 1 },
      });
      expect(item(tarea.id)).toMatchObject({
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

    it('devuelve 200 con lista vacia cuando no hay actividades', async () => {
      const r = await api(e.app, e.productor.token).get('/agenda/hoy');

      expect(r.status).toBe(200);
      expect(r.body.items).toEqual([]);
    });

    it('excluye los eventos eliminados (RF_10)', async () => {
      await crearEvento({
        idPredio: e.predioA.id,
        idCreador: e.productor.id,
        fechaInicio: hoyALas(10),
        estado: 'ELIMINADO',
      });

      const r = await api(e.app, e.productor.token).get('/agenda/hoy');

      expect(r.status).toBe(200);
      expect(r.body.items).toEqual([]);
    });

    it('incluye tareas de cualquier estado, tambien las completadas', async () => {
      await crearTarea({
        idPredio: e.predioA.id,
        idCreador: e.productor.id,
        fechaLimite: HOY,
        estado: 'COMPLETADA',
      });

      const r = await api(e.app, e.productor.token).get('/agenda/hoy');

      expect(r.status).toBe(200);
      expect(r.body.items).toHaveLength(1);
      expect(r.body.items[0].estado).toBe('COMPLETADA');
      expect(r.body.items[0].meta.completadaEn).not.toBeNull();
    });

    it('acota el dia en la zona horaria del predio, no en UTC', async () => {
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
        fechaInicio: finDelDia(HOY),
      });
      // Y el ultimo instante de ayer tambien.
      await crearEvento({
        idPredio: e.predioA.id,
        idCreador: e.productor.id,
        fechaInicio: new Date(inicioDelDia(HOY).getTime() - 1),
      });

      const r = await api(e.app, e.productor.token).get('/agenda/hoy');

      expect(r.status).toBe(200);
      expect(r.body.items).toHaveLength(1);
      expect(r.body.items[0].id).toBe(tarde.id);
    });

    it('no muestra actividades de otro predio (RNF_08)', async () => {
      await crearEvento({
        idPredio: e.predioA.id,
        idCreador: e.productor.id,
        fechaInicio: hoyALas(9),
      });
      await crearTarea({ idPredio: e.predioA.id, idCreador: e.productor.id, fechaLimite: HOY });

      const r = await api(e.app, e.ajeno.token).get('/agenda/hoy');

      expect(r.status).toBe(200);
      expect(r.body.items).toEqual([]);
    });

    it('el Trabajador tambien puede consultarlo', async () => {
      const r = await api(e.app, e.trabajador.token).get('/agenda/hoy');
      expect(r.status).toBe(200);
    });

    it('responde 401 sin token', async () => {
      const r = await api(e.app).get('/agenda/hoy');
      expect(r.status).toBe(401);
    });
  });

  // ─── RF_16 - calendario general ────────────────────────────────────────────

  describe('GET /agenda (RF_16)', () => {
    it('devuelve el rango pedido con sus items y los conteos por dia', async () => {
      const manana = sumarDias(HOY, 1);

      await crearEvento({
        idPredio: e.predioA.id,
        idCreador: e.productor.id,
        fechaInicio: hoyALas(9),
      });
      await crearEvento({
        idPredio: e.predioA.id,
        idCreador: e.productor.id,
        tipo: 'ENCASTE',
        fechaInicio: new Date(inicioDelDia(manana).getTime() + 8 * 3_600_000),
      });
      await crearTarea({ idPredio: e.predioA.id, idCreador: e.productor.id, fechaLimite: manana });

      const r = await api(e.app, e.productor.token).get(`/agenda?desde=${HOY}&hasta=${manana}`);

      expect(r.status).toBe(200);
      expect(r.body.desde).toBe(HOY);
      expect(r.body.hasta).toBe(manana);
      expect(r.body.items).toHaveLength(3);
      expect(r.body.porDia).toEqual({
        [HOY]: { eventos: 1, tareas: 0 },
        [manana]: { eventos: 1, tareas: 1 },
      });
    });

    it('ordena los items por fecha ascendente', async () => {
      const pasado = sumarDias(HOY, -3);

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

      const r = await api(e.app, e.productor.token).get(`/agenda?desde=${pasado}&hasta=${HOY}`);

      expect(r.status).toBe(200);
      expect((r.body.items as Array<{ id: string }>).map((i) => i.id)).toEqual([
        anterior.id,
        temprano.id,
        tarde.id,
      ]);
    });

    it('usa el mes calendario en curso cuando no se indica rango', async () => {
      const primeroDelMes = `${HOY.slice(0, 7)}-01`;

      const r = await api(e.app, e.productor.token).get('/agenda');

      expect(r.status).toBe(200);
      expect(r.body.desde).toBe(primeroDelMes);
      expect(r.body.hasta.slice(0, 7)).toBe(HOY.slice(0, 7));
      expect(r.body.hasta >= HOY).toBe(true);
    });

    it('navega al pasado y al futuro sin restriccion (RF_16)', async () => {
      const antiguo = await crearEvento({
        idPredio: e.predioA.id,
        idCreador: e.productor.id,
        fechaInicio: new Date(inicioDelDia('2024-03-10').getTime() + 10 * 3_600_000),
      });
      const futuro = await crearTarea({
        idPredio: e.predioA.id,
        idCreador: e.productor.id,
        fechaLimite: '2030-11-20',
      });

      const pasado = await api(e.app, e.productor.token).get('/agenda?desde=2024-03-01&hasta=2024-03-31');
      expect(pasado.status).toBe(200);
      expect(pasado.body.items).toHaveLength(1);
      expect(pasado.body.items[0].id).toBe(antiguo.id);

      const porVenir = await api(e.app, e.productor.token).get('/agenda?desde=2030-11-01&hasta=2030-11-30');
      expect(porVenir.status).toBe(200);
      expect(porVenir.body.items[0].id).toBe(futuro.id);
    });

    it('acepta un rango de exactamente un ano bisiesto', async () => {
      const r = await api(e.app, e.productor.token).get('/agenda?desde=2024-01-01&hasta=2024-12-31');
      expect(r.status).toBe(200);
    });

    it('rechaza con 422 RANGO_INVALIDO si "hasta" es anterior a "desde"', async () => {
      const r = await api(e.app, e.productor.token).get('/agenda?desde=2026-05-10&hasta=2026-05-01');

      expect(r.status).toBe(422);
      expect(r.body.error.codigo).toBe('RANGO_INVALIDO');
    });

    it('rechaza con 422 RANGO_INVALIDO un rango de mas de 366 dias', async () => {
      const r = await api(e.app, e.productor.token).get('/agenda?desde=2024-01-01&hasta=2025-01-02');

      expect(r.status).toBe(422);
      expect(r.body.error.codigo).toBe('RANGO_INVALIDO');
      expect(r.body.error.mensaje).toBe('El rango no puede superar un año.');
    });

    it('rechaza con 400 una fecha mal formada', async () => {
      const r = await api(e.app, e.productor.token).get('/agenda?desde=10-05-2026');

      expect(r.status).toBe(400);
      expect(r.body.error.codigo).toBe('VALIDACION');
      expect(r.body.error.detalles).toEqual([expect.objectContaining({ campo: 'desde' })]);
    });

    it('no filtra el calendario de otro predio (RNF_08)', async () => {
      await crearEvento({
        idPredio: e.predioA.id,
        idCreador: e.productor.id,
        fechaInicio: hoyALas(9),
      });

      const r = await api(e.app, e.ajeno.token).get(`/agenda?desde=${HOY}&hasta=${HOY}`);

      expect(r.status).toBe(200);
      expect(r.body.items).toEqual([]);
      expect(r.body.porDia).toEqual({});
    });

    it('el Trabajador tambien puede consultar el calendario', async () => {
      const extra = await crearUsuario({
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

      const r = await api(e.app, e.trabajador.token).get(`/agenda?desde=${HOY}&hasta=${HOY}`);

      expect(r.status).toBe(200);
      expect(r.body.items).toHaveLength(1);
      expect(r.body.items[0].meta.responsables).toEqual([{ id: extra.id, nombre: 'Peon A' }]);
    });

    it('responde 401 sin token', async () => {
      const r = await api(e.app).get('/agenda');
      expect(r.status).toBe(401);
    });
  });
});

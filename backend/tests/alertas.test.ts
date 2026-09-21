import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { inicioDelDia } from '../src/shared/fechas';
import { MINUTOS_EN_LINEA } from '../src/modules/alertas/alertas.servicio';
import { api, crearEscenario, type Escenario } from './apoyo/fixtures';

/**
 * Modulo 6 - Vigilancia y deteccion (RF_17, RF_18, RF_19).
 *
 * El modelo de vision por computadora esta fuera de alcance: lo que se prueba
 * aqui es el lado servidor del contrato con el modulo edge (IF5-ENT), el
 * historial de alertas (RF_19) y el estado de vigilancia (IF2-SAL).
 */

const HORA_ALERTA = '2026-03-10T15:04:05.000Z';

/** Cliente del modulo edge: se autentica por API key, no por JWT. */
function edge(e: Escenario, apiKey = e.dispositivoEdge.apiKey) {
  return {
    post: (ruta: string) => api(e.app).post(ruta).set('X-Edge-Key', apiKey),
    get: (ruta: string) => api(e.app).get(ruta).set('X-Edge-Key', apiKey),
  };
}

/** Mediodia local del dia indicado, para probar los limites del rango. */
function mediodiaDe(fechaIso: string): Date {
  return new Date(inicioDelDia(fechaIso).getTime() + 12 * 60 * 60 * 1000);
}

async function sembrarAlerta(
  e: Escenario,
  args: {
    idPredio?: string;
    idDispositivoEdge?: string | null;
    tipoAlerta?: 'CONTEO' | 'DISPERSION' | 'AMENAZA';
    estado?: 'NUEVA' | 'REVISADA';
    fechaHora: Date;
    conteoAnimales?: number;
  },
) {
  return prisma.alerta.create({
    data: {
      idPredio: args.idPredio ?? e.predioA.id,
      idDispositivoEdge:
        args.idDispositivoEdge === undefined ? e.dispositivoEdge.id : args.idDispositivoEdge,
      tipoAlerta: args.tipoAlerta ?? 'CONTEO',
      estado: args.estado ?? 'NUEVA',
      fechaHora: args.fechaHora,
      conteoAnimales: args.conteoAnimales ?? 8,
      conteoEsperado: 10,
    },
  });
}

describe('Vigilancia y deteccion (RF_17 a RF_19)', () => {
  let e: Escenario;

  beforeEach(async () => {
    e = await crearEscenario();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Ingesta desde el modulo edge
  // ───────────────────────────────────────────────────────────────────────────
  describe('POST /edge/alertas (RF_17, IF5-ENT)', () => {
    it('almacena la alerta emitida por el dispositivo', async () => {
      const r = await edge(e).post('/edge/alertas').send({
        tipoAlerta: 'CONTEO',
        conteoAnimales: 7,
        nivel: 'CRITICA',
        descripcion: 'Faltan animales en el potrero norte',
        timestamp: HORA_ALERTA,
      });

      expect(r.status).toBe(201);
      expect(r.body).toEqual({ idAlerta: expect.any(String), duplicada: false });

      const guardada = await prisma.alerta.findUniqueOrThrow({ where: { id: r.body.idAlerta } });
      expect(guardada.idPredio).toBe(e.predioA.id);
      expect(guardada.idDispositivoEdge).toBe(e.dispositivoEdge.id);
      expect(guardada.tipoAlerta).toBe('CONTEO');
      expect(guardada.nivel).toBe('CRITICA');
      expect(guardada.conteoAnimales).toBe(7);
      expect(guardada.estado).toBe('NUEVA');
      // La marca de tiempo la emite el dispositivo, no el servidor.
      expect(guardada.fechaHora.toISOString()).toBe(HORA_ALERTA);
    });

    it('toma el conteo esperado del dispositivo cuando el cuerpo no lo trae', async () => {
      const r = await edge(e)
        .post('/edge/alertas')
        .send({ tipoAlerta: 'CONTEO', conteoAnimales: 7, timestamp: HORA_ALERTA });

      const guardada = await prisma.alerta.findUniqueOrThrow({ where: { id: r.body.idAlerta } });
      expect(guardada.conteoEsperado).toBe(10);
      // Nivel por defecto del MER.
      expect(guardada.nivel).toBe('ADVERTENCIA');
    });

    it('actualiza el ultimo latido y el ultimo conteo del dispositivo', async () => {
      await edge(e)
        .post('/edge/alertas')
        .send({ tipoAlerta: 'CONTEO', conteoAnimales: 7, timestamp: HORA_ALERTA });

      const dispositivo = await prisma.dispositivoEdge.findUniqueOrThrow({
        where: { id: e.dispositivoEdge.id },
      });
      expect(dispositivo.ultimoConteo).toBe(7);
      expect(dispositivo.ultimoHeartbeat).not.toBeNull();
    });

    it('es idempotente: un reintento devuelve 200 y no duplica la alerta', async () => {
      const cuerpo = { tipoAlerta: 'CONTEO', conteoAnimales: 7, timestamp: HORA_ALERTA };

      const primera = await edge(e).post('/edge/alertas').send(cuerpo);
      const reintento = await edge(e).post('/edge/alertas').send(cuerpo);

      expect(primera.status).toBe(201);
      expect(primera.body.duplicada).toBe(false);
      expect(reintento.status).toBe(200);
      expect(reintento.body).toEqual({ idAlerta: primera.body.idAlerta, duplicada: true });

      expect(await prisma.alerta.count({ where: { idPredio: e.predioA.id } })).toBe(1);
    });

    it('el reintento igual actualiza el latido del dispositivo', async () => {
      const cuerpo = { tipoAlerta: 'CONTEO', conteoAnimales: 7, timestamp: HORA_ALERTA };
      await edge(e).post('/edge/alertas').send(cuerpo);

      await prisma.dispositivoEdge.update({
        where: { id: e.dispositivoEdge.id },
        data: { ultimoHeartbeat: new Date('2020-01-01T00:00:00.000Z') },
      });

      const reintento = await edge(e).post('/edge/alertas').send(cuerpo);
      expect(reintento.body.duplicada).toBe(true);

      const dispositivo = await prisma.dispositivoEdge.findUniqueOrThrow({
        where: { id: e.dispositivoEdge.id },
      });
      expect(dispositivo.ultimoHeartbeat!.getUTCFullYear()).toBeGreaterThan(2020);
    });

    it('distingue dos tipos de alerta con la misma marca de tiempo', async () => {
      const conteo = await edge(e)
        .post('/edge/alertas')
        .send({ tipoAlerta: 'CONTEO', timestamp: HORA_ALERTA });
      const amenaza = await edge(e)
        .post('/edge/alertas')
        .send({ tipoAlerta: 'AMENAZA', timestamp: HORA_ALERTA });

      expect(conteo.status).toBe(201);
      expect(amenaza.status).toBe(201);
      expect(await prisma.alerta.count({ where: { idPredio: e.predioA.id } })).toBe(2);
    });

    it('ignora un idPredio enviado en el cuerpo: usa el de la API key (RNF_08)', async () => {
      const r = await edge(e).post('/edge/alertas').send({
        tipoAlerta: 'CONTEO',
        timestamp: HORA_ALERTA,
        idPredio: e.predioB.id,
      });

      const guardada = await prisma.alerta.findUniqueOrThrow({ where: { id: r.body.idAlerta } });
      expect(guardada.idPredio).toBe(e.predioA.id);
    });

    it('rechaza un cuerpo invalido', async () => {
      const r = await edge(e)
        .post('/edge/alertas')
        .send({ tipoAlerta: 'INVENTADO', timestamp: HORA_ALERTA });

      expect(r.status).toBe(400);
      expect(r.body.error.codigo).toBe('VALIDACION');
    });

    it('exige la marca de tiempo del dispositivo', async () => {
      const r = await edge(e).post('/edge/alertas').send({ tipoAlerta: 'CONTEO' });

      expect(r.status).toBe(400);
      expect(r.body.error.detalles).toEqual([expect.objectContaining({ campo: 'timestamp' })]);
    });

    it('rechaza una API key invalida', async () => {
      const r = await edge(e, 'edge_test.clave-equivocada')
        .post('/edge/alertas')
        .send({ tipoAlerta: 'CONTEO', timestamp: HORA_ALERTA });

      expect(r.status).toBe(401);
      expect(r.body.error.codigo).toBe('API_KEY_INVALIDA');
      expect(await prisma.alerta.count()).toBe(0);
    });

    it('rechaza el token de un usuario: la ingesta es solo para dispositivos', async () => {
      const r = await api(e.app, e.productor.token)
        .post('/edge/alertas')
        .send({ tipoAlerta: 'CONTEO', timestamp: HORA_ALERTA });

      expect(r.status).toBe(401);
      expect(r.body.error.codigo).toBe('API_KEY_INVALIDA');
    });
  });

  describe('POST /edge/heartbeat', () => {
    it('registra el latido y el conteo actual', async () => {
      const r = await edge(e)
        .post('/edge/heartbeat')
        .send({ conteoActual: 9, timestamp: HORA_ALERTA });

      expect(r.status).toBe(204);
      expect(r.body).toEqual({});

      const dispositivo = await prisma.dispositivoEdge.findUniqueOrThrow({
        where: { id: e.dispositivoEdge.id },
      });
      expect(dispositivo.ultimoConteo).toBe(9);
      expect(dispositivo.ultimoHeartbeat).not.toBeNull();
    });

    it('conserva el ultimo conteo si el latido no lo trae', async () => {
      await edge(e).post('/edge/heartbeat').send({ conteoActual: 9, timestamp: HORA_ALERTA });
      await edge(e).post('/edge/heartbeat').send({ timestamp: HORA_ALERTA });

      const dispositivo = await prisma.dispositivoEdge.findUniqueOrThrow({
        where: { id: e.dispositivoEdge.id },
      });
      expect(dispositivo.ultimoConteo).toBe(9);
    });

    it('exige API key', async () => {
      const r = await api(e.app).post('/edge/heartbeat').send({ timestamp: HORA_ALERTA });
      expect(r.status).toBe(401);
    });
  });

  describe('POST /edge/desconexion', () => {
    it('borra el ultimo latido para que el dispositivo pase a fuera de linea de inmediato', async () => {
      await edge(e).post('/edge/heartbeat').send({ conteoActual: 9, timestamp: HORA_ALERTA });

      const r = await edge(e).post('/edge/desconexion').send({});
      expect(r.status).toBe(204);

      const dispositivo = await prisma.dispositivoEdge.findUniqueOrThrow({
        where: { id: e.dispositivoEdge.id },
      });
      expect(dispositivo.ultimoHeartbeat).toBeNull();
      // El ultimo conteo conocido no se borra: solo cambia la senal "en linea".
      expect(dispositivo.ultimoConteo).toBe(9);
    });

    it('exige API key', async () => {
      const r = await api(e.app).post('/edge/desconexion').send({});
      expect(r.status).toBe(401);
    });
  });

  describe('GET /edge/configuracion', () => {
    it('entrega la linea base que el dispositivo usa para las alertas de conteo', async () => {
      const r = await edge(e).get('/edge/configuracion');

      expect(r.status).toBe(200);
      expect(r.body).toEqual({
        idDispositivo: e.dispositivoEdge.id,
        nombre: 'Camara de prueba',
        conteoEsperado: 10,
      });
    });

    it('entrega conteoEsperado nulo si el predio no fijo una linea base', async () => {
      await prisma.dispositivoEdge.update({
        where: { id: e.dispositivoEdge.id },
        data: { conteoEsperado: null },
      });

      const r = await edge(e).get('/edge/configuracion');

      expect(r.status).toBe(200);
      expect(r.body.conteoEsperado).toBeNull();
    });

    it('exige API key', async () => {
      const r = await api(e.app).get('/edge/configuracion');
      expect(r.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Historial (RF_19)
  // ───────────────────────────────────────────────────────────────────────────
  describe('GET /alertas (RF_19)', () => {
    beforeEach(async () => {
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

    it('devuelve el historial del predio, mas reciente primero', async () => {
      const r = await api(e.app, e.productor.token).get('/alertas');

      expect(r.status).toBe(200);
      expect(r.body.meta).toMatchObject({ pagina: 1, total: 2, totalPaginas: 1 });
      expect(r.body.datos).toHaveLength(2);
      expect(r.body.datos[0].tipoAlerta).toBe('AMENAZA');
      expect(r.body.datos[1].tipoAlerta).toBe('CONTEO');
    });

    it('el Trabajador tambien consulta el historial', async () => {
      const r = await api(e.app, e.trabajador.token).get('/alertas');
      expect(r.status).toBe(200);
      expect(r.body.meta.total).toBe(2);
    });

    it('no expone las alertas de otro predio (RNF_08)', async () => {
      const r = await api(e.app, e.ajeno.token).get('/alertas');

      expect(r.status).toBe(200);
      expect(r.body.meta.total).toBe(1);
      expect(r.body.datos[0].dispositivo).toBeNull();
    });

    it('filtra por rango de fechas sobre fechaHora', async () => {
      const r = await api(e.app, e.productor.token).get(
        '/alertas?desde=2026-03-12&hasta=2026-03-12',
      );

      expect(r.status).toBe(200);
      expect(r.body.meta.total).toBe(1);
      expect(r.body.datos[0].tipoAlerta).toBe('AMENAZA');
    });

    it('filtra por tipo y por estado', async () => {
      const porTipo = await api(e.app, e.productor.token).get('/alertas?tipo=CONTEO');
      expect(porTipo.body.meta.total).toBe(1);

      const porEstado = await api(e.app, e.productor.token).get('/alertas?estado=REVISADA');
      expect(porEstado.body.meta.total).toBe(1);
      expect(porEstado.body.datos[0].estado).toBe('REVISADA');
    });

    it('pagina el resultado', async () => {
      const r = await api(e.app, e.productor.token).get('/alertas?pagina=2&tamano=1');

      expect(r.body.datos).toHaveLength(1);
      expect(r.body.meta).toMatchObject({ pagina: 2, tamano: 1, total: 2, totalPaginas: 2 });
      expect(r.body.datos[0].tipoAlerta).toBe('CONTEO');
    });

    it('rechaza un rango de fechas invertido', async () => {
      const r = await api(e.app, e.productor.token).get(
        '/alertas?desde=2026-03-12&hasta=2026-03-10',
      );

      expect(r.status).toBe(422);
      expect(r.body.error.codigo).toBe('RANGO_INVALIDO');
    });

    it('rechaza una fecha con formato invalido', async () => {
      const r = await api(e.app, e.productor.token).get('/alertas?desde=10-03-2026');

      expect(r.status).toBe(400);
      expect(r.body.error.codigo).toBe('VALIDACION');
    });

    it('responde 401 sin token', async () => {
      const r = await api(e.app).get('/alertas');
      expect(r.status).toBe(401);
      expect(r.body.error.codigo).toBe('NO_AUTENTICADO');
    });
  });

  describe('GET /alertas/:id', () => {
    it('devuelve el detalle con el dispositivo que la emitio', async () => {
      const alerta = await sembrarAlerta(e, { fechaHora: mediodiaDe('2026-03-10') });

      const r = await api(e.app, e.productor.token).get(`/alertas/${alerta.id}`);

      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({
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

    it('responde 404 si la alerta es de otro predio (RNF_08)', async () => {
      const alerta = await sembrarAlerta(e, { fechaHora: mediodiaDe('2026-03-10') });

      const r = await api(e.app, e.ajeno.token).get(`/alertas/${alerta.id}`);

      expect(r.status).toBe(404);
      expect(r.body.error.codigo).toBe('NO_ENCONTRADO');
    });

    it('responde 404 si no existe', async () => {
      const r = await api(e.app, e.productor.token).get(
        '/alertas/00000000-0000-4000-8000-000000000000',
      );
      expect(r.status).toBe(404);
    });

    it('responde 400 si el identificador no es un UUID', async () => {
      const r = await api(e.app, e.productor.token).get('/alertas/no-es-uuid');
      expect(r.status).toBe(400);
      expect(r.body.error.codigo).toBe('VALIDACION');
    });

    it('responde 401 sin token', async () => {
      const alerta = await sembrarAlerta(e, { fechaHora: mediodiaDe('2026-03-10') });
      const r = await api(e.app).get(`/alertas/${alerta.id}`);
      expect(r.status).toBe(401);
    });
  });

  describe('POST /alertas/:id/revisar', () => {
    it('marca la alerta como revisada y deja constancia de quien la reviso', async () => {
      const alerta = await sembrarAlerta(e, { fechaHora: mediodiaDe('2026-03-10') });

      const r = await api(e.app, e.productor.token).post(`/alertas/${alerta.id}/revisar`);

      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({
        id: alerta.id,
        estado: 'REVISADA',
        revisadoPor: { id: e.productor.id, nombre: 'Productora A' },
      });
      expect(r.body.fechaRevision).not.toBeNull();

      const guardada = await prisma.alerta.findUniqueOrThrow({ where: { id: alerta.id } });
      expect(guardada.estado).toBe('REVISADA');
      expect(guardada.idRevisadoPor).toBe(e.productor.id);
      expect(guardada.fechaRevision).not.toBeNull();
    });

    it('el Trabajador tambien puede revisar', async () => {
      const alerta = await sembrarAlerta(e, { fechaHora: mediodiaDe('2026-03-10') });

      const r = await api(e.app, e.trabajador.token).post(`/alertas/${alerta.id}/revisar`);

      expect(r.status).toBe(200);
      expect(r.body.revisadoPor.id).toBe(e.trabajador.id);
    });

    it('rechaza revisar dos veces la misma alerta', async () => {
      const alerta = await sembrarAlerta(e, {
        fechaHora: mediodiaDe('2026-03-10'),
        estado: 'REVISADA',
      });

      const r = await api(e.app, e.productor.token).post(`/alertas/${alerta.id}/revisar`);

      expect(r.status).toBe(409);
      expect(r.body.error.codigo).toBe('ALERTA_YA_REVISADA');
    });

    it('responde 404 si la alerta es de otro predio (RNF_08)', async () => {
      const alerta = await sembrarAlerta(e, { fechaHora: mediodiaDe('2026-03-10') });

      const r = await api(e.app, e.ajeno.token).post(`/alertas/${alerta.id}/revisar`);

      expect(r.status).toBe(404);
      const guardada = await prisma.alerta.findUniqueOrThrow({ where: { id: alerta.id } });
      expect(guardada.estado).toBe('NUEVA');
    });

    it('responde 401 sin token', async () => {
      const alerta = await sembrarAlerta(e, { fechaHora: mediodiaDe('2026-03-10') });
      const r = await api(e.app).post(`/alertas/${alerta.id}/revisar`);
      expect(r.status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Estado de vigilancia (IF2-SAL)
  // ───────────────────────────────────────────────────────────────────────────
  describe('GET /vigilancia/estado (IF2-SAL)', () => {
    it('lista los dispositivos del predio, fuera de linea si nunca latieron', async () => {
      const r = await api(e.app, e.productor.token).get('/vigilancia/estado');

      expect(r.status).toBe(200);
      expect(r.body.dispositivos).toHaveLength(1);
      expect(r.body.dispositivos[0]).toMatchObject({
        id: e.dispositivoEdge.id,
        nombre: 'Camara de prueba',
        ultimoHeartbeat: null,
        ultimoConteo: null,
        conteoEsperado: 10,
        enLinea: false,
      });
      expect(r.body.alertasSinRevisar).toBe(0);
      expect(r.body.ultimaAlerta).toBeNull();
    });

    it('marca el dispositivo en linea tras un latido reciente', async () => {
      await edge(e).post('/edge/heartbeat').send({ conteoActual: 9, timestamp: HORA_ALERTA });

      const r = await api(e.app, e.productor.token).get('/vigilancia/estado');

      expect(r.body.dispositivos[0].enLinea).toBe(true);
      expect(r.body.dispositivos[0].ultimoConteo).toBe(9);
    });

    it('marca el dispositivo fuera de linea si el latido supera MINUTOS_EN_LINEA', async () => {
      await prisma.dispositivoEdge.update({
        where: { id: e.dispositivoEdge.id },
        data: { ultimoHeartbeat: new Date(Date.now() - (MINUTOS_EN_LINEA + 1) * 60 * 1000) },
      });

      const r = await api(e.app, e.productor.token).get('/vigilancia/estado');
      expect(r.body.dispositivos[0].enLinea).toBe(false);
    });

    it('cuenta las alertas sin revisar y muestra la mas reciente', async () => {
      await sembrarAlerta(e, { fechaHora: mediodiaDe('2026-03-10'), tipoAlerta: 'CONTEO' });
      await sembrarAlerta(e, { fechaHora: mediodiaDe('2026-03-12'), tipoAlerta: 'AMENAZA' });
      await sembrarAlerta(e, {
        fechaHora: mediodiaDe('2026-03-11'),
        tipoAlerta: 'DISPERSION',
        estado: 'REVISADA',
      });

      const r = await api(e.app, e.productor.token).get('/vigilancia/estado');

      expect(r.body.alertasSinRevisar).toBe(2);
      expect(r.body.ultimaAlerta).toMatchObject({ tipoAlerta: 'AMENAZA', conteoAnimales: 8 });
    });

    it('el Trabajador tambien ve el estado', async () => {
      const r = await api(e.app, e.trabajador.token).get('/vigilancia/estado');
      expect(r.status).toBe(200);
    });

    it('no mezcla el estado de otro predio (RNF_08)', async () => {
      await sembrarAlerta(e, { fechaHora: mediodiaDe('2026-03-10') });

      const r = await api(e.app, e.ajeno.token).get('/vigilancia/estado');

      expect(r.status).toBe(200);
      expect(r.body.dispositivos).toEqual([]);
      expect(r.body.alertasSinRevisar).toBe(0);
      expect(r.body.ultimaAlerta).toBeNull();
    });

    it('responde 401 sin token', async () => {
      const r = await api(e.app).get('/vigilancia/estado');
      expect(r.status).toBe(401);
      expect(r.body.error.codigo).toBe('NO_AUTENTICADO');
    });
  });
});

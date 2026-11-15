import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { MINUTOS_EN_LINEA } from '../src/modules/alertas/alertas.servicio';
import { api, crearAnimal, crearEscenario, type Escenario } from './apoyo/fixtures';

/**
 * Modulo 6 - Vigilancia y conteo de ovejas (IF2-SAL / IF5-ENT).
 *
 * El modelo de vision por computadora esta fuera de alcance: lo que se prueba
 * aqui es el lado servidor del contrato con el modulo edge (IF5-ENT) y el
 * estado de vigilancia (IF2-SAL).
 */

const HORA_LATIDO = '2026-03-10T15:04:05.000Z';

/** Cliente del modulo edge: se autentica por API key, no por JWT. */
function edge(e: Escenario, apiKey = e.dispositivoEdge.apiKey) {
  return {
    post: (ruta: string) => api(e.app).post(ruta).set('X-Edge-Key', apiKey),
    get: (ruta: string) => api(e.app).get(ruta).set('X-Edge-Key', apiKey),
  };
}

describe('Vigilancia y conteo de ovejas (IF2-SAL / IF5-ENT)', () => {
  let e: Escenario;

  beforeEach(async () => {
    e = await crearEscenario();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Latido y desconexion desde el modulo edge
  // ───────────────────────────────────────────────────────────────────────────
  describe('POST /edge/heartbeat', () => {
    it('registra el latido y el conteo actual', async () => {
      const r = await edge(e)
        .post('/edge/heartbeat')
        .send({ conteoActual: 9, timestamp: HORA_LATIDO });

      expect(r.status).toBe(204);
      expect(r.body).toEqual({});

      const dispositivo = await prisma.dispositivoEdge.findUniqueOrThrow({
        where: { id: e.dispositivoEdge.id },
      });
      expect(dispositivo.ultimoConteo).toBe(9);
      expect(dispositivo.ultimoHeartbeat).not.toBeNull();
    });

    it('conserva el ultimo conteo si el latido no lo trae', async () => {
      await edge(e).post('/edge/heartbeat').send({ conteoActual: 9, timestamp: HORA_LATIDO });
      await edge(e).post('/edge/heartbeat').send({ timestamp: HORA_LATIDO });

      const dispositivo = await prisma.dispositivoEdge.findUniqueOrThrow({
        where: { id: e.dispositivoEdge.id },
      });
      expect(dispositivo.ultimoConteo).toBe(9);
    });

    it('exige API key', async () => {
      const r = await api(e.app).post('/edge/heartbeat').send({ timestamp: HORA_LATIDO });
      expect(r.status).toBe(401);
    });
  });

  describe('POST /edge/desconexion', () => {
    it('borra el ultimo latido para que el dispositivo pase a fuera de linea de inmediato', async () => {
      await edge(e).post('/edge/heartbeat').send({ conteoActual: 9, timestamp: HORA_LATIDO });

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
        // El escenario tiene un solo animal activo en el predio A.
        conteoEsperado: 1,
        enLinea: false,
      });
    });

    it('compara contra las ovejas activas del predio, no contra un valor fijo', async () => {
      await crearAnimal({ idPredio: e.predioA.id, idRegistrador: e.productor.id, numeroOreja: '0002' });
      await crearAnimal({ idPredio: e.predioA.id, idRegistrador: e.productor.id, numeroOreja: '0003' });
      // Los dados de baja y los de otro predio no cuentan.
      await crearAnimal({
        idPredio: e.predioA.id,
        idRegistrador: e.productor.id,
        numeroOreja: '0004',
        estado: 'INACTIVO',
      });

      const r = await api(e.app, e.productor.token).get('/vigilancia/estado');

      expect(r.body.dispositivos[0].conteoEsperado).toBe(3);
    });

    it('marca el dispositivo en linea tras un latido reciente', async () => {
      await edge(e).post('/edge/heartbeat').send({ conteoActual: 9, timestamp: HORA_LATIDO });

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

    it('el Trabajador tambien ve el estado', async () => {
      const r = await api(e.app, e.trabajador.token).get('/vigilancia/estado');
      expect(r.status).toBe(200);
    });

    it('no mezcla el estado de otro predio (RNF_08)', async () => {
      const r = await api(e.app, e.ajeno.token).get('/vigilancia/estado');

      expect(r.status).toBe(200);
      expect(r.body.dispositivos).toEqual([]);
    });

    it('responde 401 sin token', async () => {
      const r = await api(e.app).get('/vigilancia/estado');
      expect(r.status).toBe(401);
      expect(r.body.error.codigo).toBe('NO_AUTENTICADO');
    });
  });
});

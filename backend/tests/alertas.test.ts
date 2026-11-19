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
        regionInteres: null,
        regionInteresUpdatedAt: null,
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

  // ───────────────────────────────────────────────────────────────────────────
  // Region de Interes (ROI)
  // ───────────────────────────────────────────────────────────────────────────
  describe('PUT /vigilancia/dispositivos/:id/roi', () => {
    const rectanguloValido = {
      tipo: 'RECTANGULO',
      puntos: [
        { x: 0.1, y: 0.2 },
        { x: 0.8, y: 0.2 },
        { x: 0.8, y: 0.8 },
        { x: 0.1, y: 0.8 },
      ],
    };

    const poligonoValido = {
      tipo: 'POLIGONO',
      puntos: [
        { x: 0.15, y: 0.2 },
        { x: 0.55, y: 0.15 },
        { x: 0.85, y: 0.45 },
        { x: 0.75, y: 0.85 },
        { x: 0.2, y: 0.75 },
      ],
    };

    it('el Productor puede guardar un rectangulo valido y se refleja en estado y edge', async () => {
      const r = await api(e.app, e.productor.token)
        .put(`/vigilancia/dispositivos/${e.dispositivoEdge.id}/roi`)
        .send(rectanguloValido);

      expect(r.status).toBe(200);
      expect(r.body.id).toBe(e.dispositivoEdge.id);
      expect(r.body.regionInteres).toEqual(rectanguloValido);
      expect(r.body.regionInteresUpdatedAt).toBeTruthy();

      const estado = await api(e.app, e.productor.token).get('/vigilancia/estado');
      expect(estado.body.dispositivos[0].regionInteres).toEqual(rectanguloValido);
      expect(estado.body.dispositivos[0].regionInteresUpdatedAt).toBe(r.body.regionInteresUpdatedAt);

      const cfg = await edge(e).get('/edge/configuracion');
      expect(cfg.status).toBe(200);
      expect(cfg.body.regionInteres).toEqual(rectanguloValido);
      expect(cfg.body.regionInteresUpdatedAt).toBe(r.body.regionInteresUpdatedAt);
    });

    it('el Productor puede reemplazar la ROI con un poligono de 5 vertices', async () => {
      await api(e.app, e.productor.token)
        .put(`/vigilancia/dispositivos/${e.dispositivoEdge.id}/roi`)
        .send(rectanguloValido);

      const r = await api(e.app, e.productor.token)
        .put(`/vigilancia/dispositivos/${e.dispositivoEdge.id}/roi`)
        .send(poligonoValido);

      expect(r.status).toBe(200);
      expect(r.body.regionInteres).toEqual(poligonoValido);
      expect(r.body.regionInteresUpdatedAt).toBeTruthy();
    });

    it('rechaza con 403 al Trabajador', async () => {
      const r = await api(e.app, e.trabajador.token)
        .put(`/vigilancia/dispositivos/${e.dispositivoEdge.id}/roi`)
        .send(rectanguloValido);

      expect(r.status).toBe(403);
    });

    it('responde 404 para un dispositivo de otro predio (RNF_08)', async () => {
      const r = await api(e.app, e.ajeno.token)
        .put(`/vigilancia/dispositivos/${e.dispositivoEdge.id}/roi`)
        .send(rectanguloValido);

      expect(r.status).toBe(404);
    });

    it('rechaza con 400 coordenadas fuera de [0, 1]', async () => {
      const r = await api(e.app, e.productor.token)
        .put(`/vigilancia/dispositivos/${e.dispositivoEdge.id}/roi`)
        .send({
          tipo: 'RECTANGULO',
          puntos: [
            { x: -0.1, y: 0.2 },
            { x: 0.8, y: 0.2 },
            { x: 0.8, y: 1.2 },
            { x: 0.1, y: 0.8 },
          ],
        });

      expect(r.status).toBe(400);
      expect(r.body.error.codigo).toBe('VALIDACION');
    });

    it('rechaza con 400 poligono con menos de 3 o mas de 20 puntos', async () => {
      const pocos = await api(e.app, e.productor.token)
        .put(`/vigilancia/dispositivos/${e.dispositivoEdge.id}/roi`)
        .send({
          tipo: 'POLIGONO',
          puntos: [
            { x: 0.1, y: 0.1 },
            { x: 0.8, y: 0.8 },
          ],
        });
      expect(pocos.status).toBe(400);

      const muchosPuntos = Array.from({ length: 21 }, (_, i) => {
        const angulo = (2 * Math.PI * i) / 21;
        return {
          x: 0.5 + 0.3 * Math.cos(angulo),
          y: 0.5 + 0.3 * Math.sin(angulo),
        };
      });
      const muchos = await api(e.app, e.productor.token)
        .put(`/vigilancia/dispositivos/${e.dispositivoEdge.id}/roi`)
        .send({ tipo: 'POLIGONO', puntos: muchosPuntos });
      expect(muchos.status).toBe(400);
    });

    it('rechaza con 400 un rectangulo que no tenga exactamente 4 vertices', async () => {
      const con3 = await api(e.app, e.productor.token)
        .put(`/vigilancia/dispositivos/${e.dispositivoEdge.id}/roi`)
        .send({
          tipo: 'RECTANGULO',
          puntos: [
            { x: 0.1, y: 0.1 },
            { x: 0.8, y: 0.1 },
            { x: 0.8, y: 0.8 },
          ],
        });
      expect(con3.status).toBe(400);

      const con5 = await api(e.app, e.productor.token)
        .put(`/vigilancia/dispositivos/${e.dispositivoEdge.id}/roi`)
        .send({ ...poligonoValido, tipo: 'RECTANGULO' });
      expect(con5.status).toBe(400);
    });

    it('rechaza con 400 un area menor al 1% del fotograma', async () => {
      const r = await api(e.app, e.productor.token)
        .put(`/vigilancia/dispositivos/${e.dispositivoEdge.id}/roi`)
        .send({
          tipo: 'RECTANGULO',
          puntos: [
            { x: 0.1, y: 0.1 },
            { x: 0.16, y: 0.1 },
            { x: 0.16, y: 0.16 },
            { x: 0.1, y: 0.16 },
          ],
        });

      expect(r.status).toBe(400);
    });

    it('rechaza con 400 un poligono auto-intersectado', async () => {
      const r = await api(e.app, e.productor.token)
        .put(`/vigilancia/dispositivos/${e.dispositivoEdge.id}/roi`)
        .send({
          tipo: 'POLIGONO',
          puntos: [
            { x: 0.1, y: 0.1 },
            { x: 0.9, y: 0.9 },
            { x: 0.9, y: 0.1 },
            { x: 0.1, y: 0.9 },
          ],
        });

      expect(r.status).toBe(400);
    });
  });

  describe('DELETE /vigilancia/dispositivos/:id/roi', () => {
    const roi = {
      tipo: 'RECTANGULO',
      puntos: [
        { x: 0.2, y: 0.2 },
        { x: 0.8, y: 0.2 },
        { x: 0.8, y: 0.8 },
        { x: 0.2, y: 0.8 },
      ],
    };

    it('elimina la ROI y vuelve a imagen completa (null)', async () => {
      await api(e.app, e.productor.token)
        .put(`/vigilancia/dispositivos/${e.dispositivoEdge.id}/roi`)
        .send(roi);

      const del = await api(e.app, e.productor.token).delete(
        `/vigilancia/dispositivos/${e.dispositivoEdge.id}/roi`,
      );
      expect(del.status).toBe(204);

      const estado = await api(e.app, e.productor.token).get('/vigilancia/estado');
      expect(estado.body.dispositivos[0].regionInteres).toBeNull();
      expect(estado.body.dispositivos[0].regionInteresUpdatedAt).toBeTruthy();

      const cfg = await edge(e).get('/edge/configuracion');
      expect(cfg.status).toBe(200);
      expect(cfg.body.regionInteres).toBeNull();
      expect(cfg.body.regionInteresUpdatedAt).toBeTruthy();
    });

    it('rechaza con 403 al Trabajador y 404 a otro predio', async () => {
      const rTrab = await api(e.app, e.trabajador.token).delete(
        `/vigilancia/dispositivos/${e.dispositivoEdge.id}/roi`,
      );
      expect(rTrab.status).toBe(403);

      const rAjeno = await api(e.app, e.ajeno.token).delete(
        `/vigilancia/dispositivos/${e.dispositivoEdge.id}/roi`,
      );
      expect(rAjeno.status).toBe(404);
    });
  });

  describe('GET /edge/configuracion', () => {
    it('exige API key', async () => {
      const r = await api(e.app).get('/edge/configuracion');
      expect(r.status).toBe(401);
    });

    it('devuelve regionInteres null cuando no hay configuracion', async () => {
      const r = await edge(e).get('/edge/configuracion');
      expect(r.status).toBe(200);
      expect(r.body).toEqual({
        regionInteres: null,
        regionInteresUpdatedAt: null,
      });
    });
  });
});

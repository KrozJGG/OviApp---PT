import type { AddressInfo } from 'node:net';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
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

  // ───────────────────────────────────────────────────────────────────────────
  // Alertas por falta de ovejas (CONTEO), historial REST y Socket.IO
  // ───────────────────────────────────────────────────────────────────────────
  describe('Alertas CONTEO, historial y Socket.IO multi-predio', () => {
    function urlSocket(e: Escenario): string {
      const dir = e.app.address() as AddressInfo;
      return `http://127.0.0.1:${dir.port}`;
    }

    async function conectarSocket(e: Escenario, token?: string): Promise<ClientSocket> {
      return new Promise((resolve, reject) => {
        const cliente = ioClient(urlSocket(e), {
          transports: ['websocket'],
          reconnection: false,
          auth: token ? { token } : {},
        });
        cliente.once('connect', () => resolve(cliente));
        cliente.once('connect_error', (err) => {
          cliente.close();
          reject(err);
        });
      });
    }

    function esperarEvento<T = Record<string, unknown>>(
      socket: ClientSocket,
      evento: string,
      timeoutMs = 3000,
    ): Promise<T> {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Timeout esperando evento ${evento}`));
        }, timeoutMs);
        socket.once(evento, (payload: T) => {
          clearTimeout(timer);
          resolve(payload);
        });
      });
    }

    it('crea una sola alerta PENDIENTE al 3er heartbeat con deficit y la normaliza tras 2 normales', async () => {
      // El escenario tiene 1 animal activo; agregamos 2 mas -> conteoEsperado = 3.
      await crearAnimal({ idPredio: e.predioA.id, idRegistrador: e.productor.id, numeroOreja: '0002' });
      await crearAnimal({ idPredio: e.predioA.id, idRegistrador: e.productor.id, numeroOreja: '0003' });

      await edge(e).post('/edge/heartbeat').send({ conteoActual: 2, timestamp: HORA_LATIDO });
      await edge(e).post('/edge/heartbeat').send({ conteoActual: 2, timestamp: HORA_LATIDO });
      expect(await prisma.alerta.count({ where: { idPredio: e.predioA.id } })).toBe(0);

      await edge(e).post('/edge/heartbeat').send({ conteoActual: 2, timestamp: HORA_LATIDO });
      const alertas = await prisma.alerta.findMany({ where: { idPredio: e.predioA.id } });
      expect(alertas).toHaveLength(1);
      expect(alertas[0]).toMatchObject({
        tipo: 'CONTEO',
        estado: 'PENDIENTE',
        conteoDetectado: 2,
        conteoEsperado: 3,
        normalizadaEn: null,
      });

      // Un 4to heartbeat en deficit no duplica la fila.
      await edge(e).post('/edge/heartbeat').send({ conteoActual: 1, timestamp: HORA_LATIDO });
      expect(await prisma.alerta.count({ where: { idPredio: e.predioA.id } })).toBe(1);

      // 2 heartbeats normales consecutivos marcan normalizadaEn sin cambiar estado PENDIENTE.
      await edge(e).post('/edge/heartbeat').send({ conteoActual: 3, timestamp: HORA_LATIDO });
      let trasUno = await prisma.alerta.findUniqueOrThrow({ where: { id: alertas[0]!.id } });
      expect(trasUno.normalizadaEn).toBeNull();

      await edge(e).post('/edge/heartbeat').send({ conteoActual: 3, timestamp: HORA_LATIDO });
      trasUno = await prisma.alerta.findUniqueOrThrow({ where: { id: alertas[0]!.id } });
      expect(trasUno.estado).toBe('PENDIENTE');
      expect(trasUno.normalizadaEn).not.toBeNull();
    });

    it('GET /alertas y PATCH /alertas/:id/estado permiten PRODUCTOR y TRABAJADOR con aislamiento por predio', async () => {
      await edge(e).post('/edge/heartbeat').send({ conteoActual: 0, timestamp: HORA_LATIDO });
      await edge(e).post('/edge/heartbeat').send({ conteoActual: 0, timestamp: HORA_LATIDO });
      await edge(e).post('/edge/heartbeat').send({ conteoActual: 0, timestamp: HORA_LATIDO });

      // Trabajador consulta historial pendiente.
      const listado = await api(e.app, e.trabajador.token).get('/alertas?estado=PENDIENTE');
      expect(listado.status).toBe(200);
      expect(listado.body.datos).toHaveLength(1);
      const idAlerta = listado.body.datos[0].id as string;

      // Predio ajeno no ve nada ni puede actualizar (404).
      const listadoAjeno = await api(e.app, e.ajeno.token).get('/alertas');
      expect(listadoAjeno.status).toBe(200);
      expect(listadoAjeno.body.datos).toEqual([]);

      const patchAjeno = await api(e.app, e.ajeno.token)
        .patch(`/alertas/${idAlerta}/estado`)
        .send({ estado: 'RESUELTA' });
      expect(patchAjeno.status).toBe(404);

      // Trabajador marca la alerta como RESUELTA y queda registrada la auditoria.
      const resuelta = await api(e.app, e.trabajador.token)
        .patch(`/alertas/${idAlerta}/estado`)
        .send({ estado: 'RESUELTA' });
      expect(resuelta.status).toBe(200);
      expect(resuelta.body.estado).toBe('RESUELTA');
      expect(resuelta.body.revisadoPor).toMatchObject({
        id: e.trabajador.id,
        nombre: 'Trabajador A',
      });
      expect(resuelta.body.fechaRevision).toBeTruthy();

      // Reintentar cambiar estado sobre una alerta ya revisada responde 409.
      const duplicado = await api(e.app, e.productor.token)
        .patch(`/alertas/${idAlerta}/estado`)
        .send({ estado: 'DESCARTADA' });
      expect(duplicado.status).toBe(409);
      expect(duplicado.body.error.codigo).toBe('ALERTA_YA_REVISADA');
    });

    it('Socket.IO autentica por JWT y emite alerta:nueva y alerta:actualizada solo al predio correspondiente', async () => {
      // Sin token -> rechazado.
      await expect(conectarSocket(e)).rejects.toThrow('NO_AUTENTICADO');
      await expect(conectarSocket(e, 'token-invalido')).rejects.toThrow('TOKEN_INVALIDO');

      const sockProductor = await conectarSocket(e, e.productor.token);
      const sockTrabajador = await conectarSocket(e, e.trabajador.token);
      const sockAjeno = await conectarSocket(e, e.ajeno.token);

      let recibidoAjeno = false;
      sockAjeno.on('alerta:nueva', () => {
        recibidoAjeno = true;
      });
      sockAjeno.on('alerta:actualizada', () => {
        recibidoAjeno = true;
      });

      try {
        const promProdNueva = esperarEvento(sockProductor, 'alerta:nueva');
        const promTrabNueva = esperarEvento(sockTrabajador, 'alerta:nueva');

        await edge(e).post('/edge/heartbeat').send({ conteoActual: 0, timestamp: HORA_LATIDO });
        await edge(e).post('/edge/heartbeat').send({ conteoActual: 0, timestamp: HORA_LATIDO });
        await edge(e).post('/edge/heartbeat').send({ conteoActual: 0, timestamp: HORA_LATIDO });

        const [evProd, evTrab] = await Promise.all([promProdNueva, promTrabNueva]);
        expect(evProd.tipo).toBe('CONTEO');
        expect(evProd.estado).toBe('PENDIENTE');
        expect(evTrab.id).toBe(evProd.id);

        const promProdAct = esperarEvento(sockProductor, 'alerta:actualizada');
        const promTrabAct = esperarEvento(sockTrabajador, 'alerta:actualizada');

        const r = await api(e.app, e.productor.token)
          .patch(`/alertas/${evProd.id as string}/estado`)
          .send({ estado: 'DESCARTADA' });
        expect(r.status).toBe(200);

        const [actProd, actTrab] = await Promise.all([promProdAct, promTrabAct]);
        expect(actProd.estado).toBe('DESCARTADA');
        expect(actTrab.estado).toBe('DESCARTADA');
        expect((actTrab.revisadoPor as { nombre: string }).nombre).toBe('Productora A');

        // Pequeña espera para confirmar que el predio B nunca recibio nada.
        await new Promise((r) => setTimeout(r, 100));
        expect(recibidoAjeno).toBe(false);
      } finally {
        sockProductor.close();
        sockTrabajador.close();
        sockAjeno.close();
      }
    });
  });
});

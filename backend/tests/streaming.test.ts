import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/config/prisma';
import { reescribirPlaylist, traerArchivoStream } from '../src/modules/streaming/streaming.servicio';
import { api, crearEscenario, type Escenario } from './apoyo/fixtures';

/**
 * Proxy autenticado del video en vivo.
 *
 * MediaMTX no corre en la suite: su URL apunta a un puerto cerrado (.env.test),
 * asi que el camino feliz se verifica hasta donde depende de este backend —
 * autorizacion, firma del token y reescritura del manifiesto — y el proxy en si
 * se comprueba por su degradacion (STREAM_NO_DISPONIBLE) cuando el streamer no
 * responde, que es tambien el caso real de camara apagada.
 */

/** Extrae el token de la URL firmada que devuelve POST /streaming/token. */
function tokenDe(url: string): string {
  return new URL(url, 'http://local').searchParams.get('token') ?? '';
}

describe('Video en vivo (proxy de streaming)', () => {
  let e: Escenario;

  beforeEach(async () => {
    e = await crearEscenario();
  });

  describe('POST /streaming/token', () => {
    it('entrega la URL firmada del manifiesto para una camara del propio predio', async () => {
      const r = await api(e.app, e.productor.token)
        .post('/streaming/token')
        .send({ idDispositivo: e.dispositivoEdge.id });

      expect(r.status).toBe(200);
      expect(r.body.url).toMatch(/^\/streaming\/rebano\/index\.m3u8\?token=/);
      expect(r.body.expiraEnSeg).toBe(600);
      expect(tokenDe(r.body.url).length).toBeGreaterThan(0);
    });

    it('tambien lo entrega a un trabajador: ver la camara no es exclusivo del productor', async () => {
      const r = await api(e.app, e.trabajador.token)
        .post('/streaming/token')
        .send({ idDispositivo: e.dispositivoEdge.id });

      expect(r.status).toBe(200);
    });

    it('no se puede pedir acceso a una camara de otro predio (RNF_08)', async () => {
      const r = await api(e.app, e.ajeno.token)
        .post('/streaming/token')
        .send({ idDispositivo: e.dispositivoEdge.id });

      expect(r.status).toBe(404);
      expect(r.body.error.codigo).toBe('NO_ENCONTRADO');
    });

    it('exige sesion iniciada', async () => {
      const r = await api(e.app).post('/streaming/token').send({ idDispositivo: e.dispositivoEdge.id });
      expect(r.status).toBe(401);
    });

    it('rechaza un identificador de dispositivo que no es UUID', async () => {
      const r = await api(e.app, e.productor.token)
        .post('/streaming/token')
        .send({ idDispositivo: 'no-es-uuid' });

      expect(r.status).toBe(400);
      expect(r.body.error.codigo).toBe('VALIDACION');
    });
  });

  describe('GET /streaming/:pathName/:archivo', () => {
    async function tokenValido(): Promise<string> {
      const r = await api(e.app, e.productor.token)
        .post('/streaming/token')
        .send({ idDispositivo: e.dispositivoEdge.id });
      return tokenDe(r.body.url);
    }

    it('con un token valido pasa la autenticacion y solo falla porque el streamer no responde', async () => {
      const r = await api(e.app).get(`/streaming/rebano/index.m3u8?token=${await tokenValido()}`);

      expect(r.status).toBe(404);
      expect(r.body.error.codigo).toBe('STREAM_NO_DISPONIBLE');
    });

    it('rechaza la peticion sin token', async () => {
      const r = await api(e.app).get('/streaming/rebano/index.m3u8');

      expect(r.status).toBe(400);
      expect(r.body.error.codigo).toBe('VALIDACION');
    });

    it('rechaza un token inventado', async () => {
      const r = await api(e.app).get('/streaming/rebano/index.m3u8?token=cualquier-cosa');

      expect(r.status).toBe(401);
      expect(r.body.error.codigo).toBe('TOKEN_INVALIDO');
    });

    it('rechaza el access token de sesion: no sirve como token de video', async () => {
      const r = await api(e.app).get(`/streaming/rebano/index.m3u8?token=${e.productor.token}`);

      expect(r.status).toBe(401);
      expect(r.body.error.codigo).toBe('TOKEN_INVALIDO');
    });

    it('rechaza un token valido usado contra otro stream', async () => {
      const r = await api(e.app).get(`/streaming/otracamara/index.m3u8?token=${await tokenValido()}`);

      expect(r.status).toBe(401);
      expect(r.body.error.codigo).toBe('TOKEN_INVALIDO');
    });

    it('solo acepta nombres de archivo de la lista blanca', async () => {
      // Exigir que arranque con alfanumerico es lo que descarta cualquier
      // nombre pensado para leer otra cosa del servidor de streaming.
      const r = await api(e.app).get(`/streaming/rebano/.env?token=${await tokenValido()}`);

      expect(r.status).toBe(400);
      expect(r.body.error.codigo).toBe('VALIDACION');
    });

    it('una direccion con .. no llega al proxy: se normaliza antes de enrutar', async () => {
      const r = await api(e.app).get(`/streaming/rebano/..?token=${await tokenValido()}`);

      expect(r.status).toBe(404);
    });
  });

  describe('el token de video no abre el resto de la API', () => {
    it('no sirve como sesion para consultar el estado de vigilancia', async () => {
      const acceso = await api(e.app, e.productor.token)
        .post('/streaming/token')
        .send({ idDispositivo: e.dispositivoEdge.id });

      const r = await api(e.app, tokenDe(acceso.body.url)).get('/vigilancia/estado');

      expect(r.status).toBe(401);
      expect(r.body.error.codigo).toBe('TOKEN_INVALIDO');
    });
  });

  describe('reescritura del manifiesto', () => {
    const TOKEN = 'abc.123';

    it('firma cada segmento sin tocar las etiquetas', () => {
      const original = ['#EXTM3U', '#EXT-X-TARGETDURATION:2', '#EXTINF:2.0,', 'segment0.mp4', ''].join('\n');

      expect(reescribirPlaylist(original, TOKEN)).toBe(
        ['#EXTM3U', '#EXT-X-TARGETDURATION:2', '#EXTINF:2.0,', 'segment0.mp4?token=abc.123', ''].join('\n'),
      );
    });

    it('firma tambien el segmento de inicializacion de un HLS en fMP4', () => {
      // Sin esto, un stream fMP4 no arranca: el player pide init.mp4 sin token.
      const original = '#EXT-X-MAP:URI="init.mp4"\nsegment0.mp4';

      expect(reescribirPlaylist(original, TOKEN)).toBe(
        '#EXT-X-MAP:URI="init.mp4?token=abc.123"\nsegment0.mp4?token=abc.123',
      );
    });

    it('firma la sub-playlist de un manifiesto maestro', () => {
      const original = '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000\nstream.m3u8';

      expect(reescribirPlaylist(original, TOKEN)).toContain('stream.m3u8?token=abc.123');
    });

    it('conserva una query string ya presente', () => {
      expect(reescribirPlaylist('segment0.mp4?x=1', TOKEN)).toBe('segment0.mp4?x=1&token=abc.123');
    });
  });

  describe('reenvio hacia MediaMTX', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    /** Devuelve la URL con la que se llamo a MediaMTX. */
    async function urlPedidaAlStreamer(consulta: Record<string, string>): Promise<URL> {
      const espia = vi.fn(async () =>
        new Response('#EXTM3U', { headers: { 'content-type': 'application/vnd.apple.mpegurl' } }),
      );
      vi.stubGlobal('fetch', espia);

      await traerArchivoStream('rebano', 'index.m3u8', 'token-de-prueba', consulta);

      return new URL(espia.mock.calls[0]![0] as string);
    }

    it('devuelve los parametros propios de MediaMTX, sin los cuales responde 404', async () => {
      // MediaMTX cuelga `session` de las URIs que escribe en el manifiesto y
      // exige que vuelvan: sin esto la reproduccion no pasa del maestro.
      const url = await urlPedidaAlStreamer({ session: 'abc-123' });

      expect(url.pathname).toBe('/rebano/index.m3u8');
      expect(url.searchParams.get('session')).toBe('abc-123');
    });

    it('no le reenvia el token, que es de este proxy y alli no significa nada', async () => {
      const url = await urlPedidaAlStreamer({ session: 'abc-123' });

      expect(url.searchParams.has('token')).toBe(false);
    });
  });

  describe('aislamiento entre predios', () => {
    it('cada predio recibe un token firmado para su propio predio', async () => {
      const camaraAjena = await prisma.dispositivoEdge.create({
        data: {
          idPredio: e.predioB.id,
          nombre: 'Camara del predio B',
          apiKeyPrefijo: 'edge_b',
          apiKeyHash: 'no-se-usa-en-este-test',
        },
      });

      const r = await api(e.app, e.ajeno.token)
        .post('/streaming/token')
        .send({ idDispositivo: camaraAjena.id });

      expect(r.status).toBe(200);

      // Y el productor del predio A no puede pedir acceso a esa camara.
      const cruzado = await api(e.app, e.productor.token)
        .post('/streaming/token')
        .send({ idDispositivo: camaraAjena.id });

      expect(cruzado.status).toBe(404);
    });
  });
});

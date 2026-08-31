import type http from 'node:http';

/**
 * Cliente HTTP de la suite.
 *
 * Reemplaza a supertest por `fetch` sobre un servidor de larga vida. El motivo
 * es concreto y medido: con supertest el proceso de Node muere de golpe —sin
 * excepcion, sin stderr, sin informe de error fatal y sin que se disparen los
 * handlers de `exit`— tras algunos cientos de peticiones, y la RSS crece unos
 * 70 KB por peticion. Con el mismo servidor y `fetch`, 2000 peticiones seguidas
 * corren estables y con memoria plana.
 *
 * La superficie replicada es la que usa la suite: los cinco verbos, `send()`,
 * `set()` y una respuesta con `status`, `body`, `headers` y `text`.
 */

export interface Respuesta {
  status: number;
  /** Cuerpo JSON parseado. `{}` cuando la respuesta no trae cuerpo (204). */
  body: any;
  headers: Record<string, string>;
  text: string;
}

type Verbo = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/**
 * Peticion encadenable y esperable a la vez: `await c.get('/x')` funciona igual
 * que `await c.post('/x').set('K', 'V').send({ ... })`. Es un thenable, asi que
 * la peticion se dispara al hacer `await` y no antes.
 */
class Peticion implements PromiseLike<Respuesta> {
  private cuerpo: unknown;
  private tieneCuerpo = false;
  private readonly cabeceras: Record<string, string> = {};

  constructor(
    private readonly base: string,
    private readonly verbo: Verbo,
    private readonly ruta: string,
    cabecerasIniciales: Record<string, string> = {},
  ) {
    Object.assign(this.cabeceras, cabecerasIniciales);
  }

  set(clave: string, valor: string): this {
    this.cabeceras[clave] = valor;
    return this;
  }

  /**
   * Cuerpo JSON. Si no se llama, la peticion viaja sin cuerpo ni
   * `content-type`, igual que hacia supertest: hay endpoints cuya validacion
   * depende de esa diferencia.
   */
  send(cuerpo: unknown): this {
    this.cuerpo = cuerpo;
    this.tieneCuerpo = true;
    return this;
  }

  private async ejecutar(): Promise<Respuesta> {
    const cabeceras: Record<string, string> = { ...this.cabeceras };
    let body: string | undefined;

    if (this.tieneCuerpo) {
      body = JSON.stringify(this.cuerpo);
      cabeceras['content-type'] ??= 'application/json';
    }

    const r = await fetch(`${this.base}${this.ruta}`, {
      method: this.verbo,
      headers: cabeceras,
      body,
    });

    const text = await r.text();
    const tipo = r.headers.get('content-type') ?? '';

    let parseado: any = {};
    if (text.length > 0 && tipo.includes('json')) {
      try {
        parseado = JSON.parse(text);
      } catch {
        parseado = {};
      }
    }

    return {
      status: r.status,
      body: parseado,
      headers: Object.fromEntries(r.headers.entries()),
      text,
    };
  }

  then<R1 = Respuesta, R2 = never>(
    alCumplir?: ((v: Respuesta) => R1 | PromiseLike<R1>) | null,
    alFallar?: ((e: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.ejecutar().then(alCumplir, alFallar);
  }
}

export interface Cliente {
  get(ruta: string): Peticion;
  post(ruta: string): Peticion;
  patch(ruta: string): Peticion;
  put(ruta: string): Peticion;
  delete(ruta: string): Peticion;
}

/** URL base de un servidor que ya esta escuchando. */
export function urlDe(servidor: http.Server): string {
  const dir = servidor.address();
  if (dir === null || typeof dir === 'string') {
    throw new Error('El servidor de pruebas no esta escuchando en un puerto TCP.');
  }
  return `http://127.0.0.1:${dir.port}`;
}

/** Cliente contra `servidor`, con prefijo y cabeceras fijas ya aplicadas. */
export function clienteDe(
  servidor: http.Server,
  prefijo: string,
  cabeceras: Record<string, string> = {},
): Cliente {
  const base = `${urlDe(servidor)}${prefijo}`;
  const nueva = (verbo: Verbo) => (ruta: string) => new Peticion(base, verbo, ruta, cabeceras);

  return {
    get: nueva('GET'),
    post: nueva('POST'),
    patch: nueva('PATCH'),
    put: nueva('PUT'),
    delete: nueva('DELETE'),
  };
}

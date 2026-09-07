"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.urlDe = urlDe;
exports.clienteDe = clienteDe;
/**
 * Peticion encadenable y esperable a la vez: `await c.get('/x')` funciona igual
 * que `await c.post('/x').set('K', 'V').send({ ... })`. Es un thenable, asi que
 * la peticion se dispara al hacer `await` y no antes.
 */
class Peticion {
    base;
    verbo;
    ruta;
    cuerpo;
    tieneCuerpo = false;
    cabeceras = {};
    constructor(base, verbo, ruta, cabecerasIniciales = {}) {
        this.base = base;
        this.verbo = verbo;
        this.ruta = ruta;
        Object.assign(this.cabeceras, cabecerasIniciales);
    }
    set(clave, valor) {
        this.cabeceras[clave] = valor;
        return this;
    }
    /**
     * Cuerpo JSON. Si no se llama, la peticion viaja sin cuerpo ni
     * `content-type`, igual que hacia supertest: hay endpoints cuya validacion
     * depende de esa diferencia.
     */
    send(cuerpo) {
        this.cuerpo = cuerpo;
        this.tieneCuerpo = true;
        return this;
    }
    async ejecutar() {
        const cabeceras = { ...this.cabeceras };
        let body;
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
        let parseado = {};
        if (text.length > 0 && tipo.includes('json')) {
            try {
                parseado = JSON.parse(text);
            }
            catch {
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
    then(alCumplir, alFallar) {
        return this.ejecutar().then(alCumplir, alFallar);
    }
}
/** URL base de un servidor que ya esta escuchando. */
function urlDe(servidor) {
    const dir = servidor.address();
    if (dir === null || typeof dir === 'string') {
        throw new Error('El servidor de pruebas no esta escuchando en un puerto TCP.');
    }
    return `http://127.0.0.1:${dir.port}`;
}
/** Cliente contra `servidor`, con prefijo y cabeceras fijas ya aplicadas. */
function clienteDe(servidor, prefijo, cabeceras = {}) {
    const base = `${urlDe(servidor)}${prefijo}`;
    const nueva = (verbo) => (ruta) => new Peticion(base, verbo, ruta, cabeceras);
    return {
        get: nueva('GET'),
        post: nueva('POST'),
        patch: nueva('PATCH'),
        put: nueva('PUT'),
        delete: nueva('DELETE'),
    };
}
//# sourceMappingURL=cliente.js.map
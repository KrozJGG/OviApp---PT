"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.API_KEY_EDGE = exports.PASSWORD = void 0;
exports.cerrarServidor = cerrarServidor;
exports.limpiarBd = limpiarBd;
exports.crearEscenario = crearEscenario;
exports.iniciarSesion = iniciarSesion;
exports.api = api;
exports.crearUsuario = crearUsuario;
exports.crearAnimal = crearAnimal;
exports.fechaRelativa = fechaRelativa;
const node_http_1 = __importDefault(require("node:http"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const app_1 = require("../../src/app");
const cliente_1 = require("./cliente");
const prisma_1 = require("../../src/config/prisma");
/**
 * Escenario base compartido por toda la suite.
 *
 * Deliberadamente incluye un SEGUNDO predio con su propio productor y su propio
 * animal: casi todos los tests de aislamiento (RNF_08) consisten en pedir con el
 * token de un predio un recurso del otro y exigir 404.
 */
exports.PASSWORD = 'Prueba2026!';
exports.API_KEY_EDGE = 'edge_test.clave-secreta-de-prueba';
let servidorCacheado;
/**
 * Levanta una sola vez el servidor del proceso de test en un puerto libre.
 * `unref()` evita que el listener abierto impida al worker terminar.
 */
async function servidor() {
    if (!servidorCacheado) {
        const s = node_http_1.default.createServer((0, app_1.crearApp)());
        await new Promise((listo) => s.listen(0, '127.0.0.1', () => listo()));
        s.unref();
        servidorCacheado = s;
    }
    return servidorCacheado;
}
/** Cierra el servidor compartido. Opcional: `unref()` ya permite salir. */
async function cerrarServidor() {
    if (!servidorCacheado)
        return;
    const s = servidorCacheado;
    servidorCacheado = undefined;
    await new Promise((listo) => s.close(() => listo()));
}
/** Deja la base vacia. TRUNCATE no dispara el trigger append-only de RF_06. */
async function limpiarBd() {
    await prisma_1.prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "bitacora_entrada", "evento_animal", "tarea_animal", "tarea_usuario",
      "alerta", "evento", "tarea", "animal", "dispositivo_edge",
      "dispositivo_usuario", "refresh_token", "usuario", "predio"
    RESTART IDENTITY CASCADE
  `);
}
async function crearEscenario() {
    await limpiarBd();
    const hash = await bcryptjs_1.default.hash(exports.PASSWORD, 4);
    const predioA = await prisma_1.prisma.predio.create({ data: { nombre: 'Predio A' } });
    const predioB = await prisma_1.prisma.predio.create({ data: { nombre: 'Predio B' } });
    const productor = await prisma_1.prisma.usuario.create({
        data: {
            idPredio: predioA.id,
            nombre: 'Productora A',
            email: 'productor@test.cl',
            passwordHash: hash,
            rol: 'PRODUCTOR',
        },
    });
    const trabajador = await prisma_1.prisma.usuario.create({
        data: {
            idPredio: predioA.id,
            nombre: 'Trabajador A',
            email: 'trabajador@test.cl',
            passwordHash: hash,
            rol: 'TRABAJADOR',
        },
    });
    const ajeno = await prisma_1.prisma.usuario.create({
        data: {
            idPredio: predioB.id,
            nombre: 'Productor B',
            email: 'ajeno@test.cl',
            passwordHash: hash,
            rol: 'PRODUCTOR',
        },
    });
    const animal = await prisma_1.prisma.animal.create({
        data: {
            idPredio: predioA.id,
            numeroOreja: '0001',
            idRegistrador: productor.id,
            sexo: 'HEMBRA',
            raza: 'Suffolk',
            color: 'Blanco',
            pesoKg: 45,
        },
    });
    const animalAjeno = await prisma_1.prisma.animal.create({
        data: {
            idPredio: predioB.id,
            numeroOreja: '9001',
            idRegistrador: ajeno.id,
            sexo: 'MACHO',
            raza: 'Merino',
            pesoKg: 60,
        },
    });
    const [prefijo, secreto] = exports.API_KEY_EDGE.split('.');
    const dispositivoEdge = await prisma_1.prisma.dispositivoEdge.create({
        data: {
            idPredio: predioA.id,
            nombre: 'Camara de prueba',
            apiKeyPrefijo: prefijo,
            apiKeyHash: await bcryptjs_1.default.hash(secreto, 4),
            conteoEsperado: 10,
        },
    });
    const instancia = await servidor();
    return {
        app: instancia,
        predioA: { id: predioA.id, nombre: predioA.nombre },
        predioB: { id: predioB.id, nombre: predioB.nombre },
        productor: { id: productor.id, email: productor.email, token: await iniciarSesion(instancia, productor.email) },
        trabajador: { id: trabajador.id, email: trabajador.email, token: await iniciarSesion(instancia, trabajador.email) },
        ajeno: { id: ajeno.id, email: ajeno.email, token: await iniciarSesion(instancia, ajeno.email) },
        animal: { id: animal.id, numeroOreja: animal.numeroOreja },
        animalAjeno: { id: animalAjeno.id, numeroOreja: animalAjeno.numeroOreja },
        dispositivoEdge: { id: dispositivoEdge.id, apiKey: exports.API_KEY_EDGE },
    };
}
/** Obtiene un access token por el endpoint real de login (IF6-ENT). */
async function iniciarSesion(instancia, email, password = exports.PASSWORD) {
    const r = await api(instancia).post('/auth/login').send({ email, password });
    if (r.status !== 200) {
        throw new Error(`No se pudo iniciar sesion como ${email}: ${r.status} ${JSON.stringify(r.body)}`);
    }
    return r.body.accessToken;
}
/** Cliente con el prefijo /api/v1 ya aplicado y el token puesto. */
function api(instancia, token) {
    return (0, cliente_1.clienteDe)(instancia, app_1.PREFIJO_API, token ? { authorization: `Bearer ${token}` } : {});
}
async function crearUsuario(args) {
    return prisma_1.prisma.usuario.create({
        data: {
            idPredio: args.idPredio,
            nombre: args.nombre ?? 'Usuario de prueba',
            email: args.email,
            passwordHash: await bcryptjs_1.default.hash(exports.PASSWORD, 4),
            rol: args.rol ?? 'TRABAJADOR',
            estado: args.estado ?? 'HABILITADO',
        },
    });
}
async function crearAnimal(args) {
    return prisma_1.prisma.animal.create({
        data: {
            idPredio: args.idPredio,
            idRegistrador: args.idRegistrador,
            numeroOreja: args.numeroOreja,
            sexo: 'HEMBRA',
            raza: 'Corriedale',
            pesoKg: 42,
            ...(args.estado === 'INACTIVO'
                ? { estado: 'INACTIVO', motivoBaja: 'VENTA', fechaBaja: new Date('2026-01-15T00:00:00.000Z') }
                : {}),
        },
    });
}
/** Fecha ISO (YYYY-MM-DD) desplazada respecto de hoy. Util para fechas limite. */
function fechaRelativa(dias) {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0, 10);
}
//# sourceMappingURL=fixtures.js.map
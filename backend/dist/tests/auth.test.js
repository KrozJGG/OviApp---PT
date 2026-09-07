"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const prisma_1 = require("../src/config/prisma");
const fixtures_1 = require("./apoyo/fixtures");
/**
 * Sesión — IF6-ENT y RF_00 (H13 del plan).
 * Es la base de los otros 21 requerimientos: todos asumen usuario autenticado.
 */
(0, vitest_1.describe)('Autenticación (IF6-ENT)', () => {
    let e;
    (0, vitest_1.beforeEach)(async () => {
        e = await (0, fixtures_1.crearEscenario)();
    });
    (0, vitest_1.describe)('POST /auth/login', () => {
        (0, vitest_1.it)('entrega tokens y el perfil con credenciales válidas', async () => {
            const r = await (0, fixtures_1.api)(e.app).post('/auth/login').send({
                email: e.productor.email,
                password: fixtures_1.PASSWORD,
            });
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.accessToken).toBeTypeOf('string');
            (0, vitest_1.expect)(r.body.refreshToken).toBeTypeOf('string');
            (0, vitest_1.expect)(r.body.usuario).toMatchObject({
                email: e.productor.email,
                rol: 'PRODUCTOR',
                idPredio: e.predioA.id,
                predio: 'Predio A',
            });
            (0, vitest_1.expect)(r.body.usuario).not.toHaveProperty('passwordHash');
        });
        (0, vitest_1.it)('acepta el correo sin distinguir mayúsculas', async () => {
            const r = await (0, fixtures_1.api)(e.app).post('/auth/login').send({
                email: e.productor.email.toUpperCase(),
                password: fixtures_1.PASSWORD,
            });
            (0, vitest_1.expect)(r.status).toBe(200);
        });
        (0, vitest_1.it)('rechaza una contraseña incorrecta', async () => {
            const r = await (0, fixtures_1.api)(e.app).post('/auth/login').send({
                email: e.productor.email,
                password: 'incorrecta',
            });
            (0, vitest_1.expect)(r.status).toBe(401);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('CREDENCIALES_INVALIDAS');
        });
        (0, vitest_1.it)('no revela si el correo existe: mismo código y mensaje que la contraseña errónea', async () => {
            const inexistente = await (0, fixtures_1.api)(e.app)
                .post('/auth/login')
                .send({ email: 'nadie@test.cl', password: fixtures_1.PASSWORD });
            const passwordMala = await (0, fixtures_1.api)(e.app)
                .post('/auth/login')
                .send({ email: e.productor.email, password: 'incorrecta' });
            (0, vitest_1.expect)(inexistente.status).toBe(passwordMala.status);
            (0, vitest_1.expect)(inexistente.body.error.codigo).toBe(passwordMala.body.error.codigo);
            (0, vitest_1.expect)(inexistente.body.error.mensaje).toBe(passwordMala.body.error.mensaje);
        });
        (0, vitest_1.it)('rechaza a un usuario inhabilitado (RF_22)', async () => {
            const inhabilitado = await (0, fixtures_1.crearUsuario)({
                idPredio: e.predioA.id,
                email: 'inhabilitado@test.cl',
                estado: 'INHABILITADO',
            });
            const r = await (0, fixtures_1.api)(e.app)
                .post('/auth/login')
                .send({ email: inhabilitado.email, password: fixtures_1.PASSWORD });
            (0, vitest_1.expect)(r.status).toBe(401);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('USUARIO_INHABILITADO');
        });
        (0, vitest_1.it)('valida el formato del correo', async () => {
            const r = await (0, fixtures_1.api)(e.app).post('/auth/login').send({ email: 'no-es-correo', password: 'x' });
            (0, vitest_1.expect)(r.status).toBe(400);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('VALIDACION');
            (0, vitest_1.expect)(r.body.error.detalles).toEqual([
                vitest_1.expect.objectContaining({ campo: 'email' }),
            ]);
        });
    });
    (0, vitest_1.describe)('POST /auth/refresh', () => {
        (0, vitest_1.it)('renueva la sesión y rota el token de refresco', async () => {
            const sesion = await (0, fixtures_1.api)(e.app)
                .post('/auth/login')
                .send({ email: e.productor.email, password: fixtures_1.PASSWORD });
            const r = await (0, fixtures_1.api)(e.app)
                .post('/auth/refresh')
                .send({ refreshToken: sesion.body.refreshToken });
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.refreshToken).not.toBe(sesion.body.refreshToken);
        });
        (0, vitest_1.it)('no permite reutilizar un token ya consumido', async () => {
            const sesion = await (0, fixtures_1.api)(e.app)
                .post('/auth/login')
                .send({ email: e.productor.email, password: fixtures_1.PASSWORD });
            await (0, fixtures_1.api)(e.app).post('/auth/refresh').send({ refreshToken: sesion.body.refreshToken });
            const segundo = await (0, fixtures_1.api)(e.app)
                .post('/auth/refresh')
                .send({ refreshToken: sesion.body.refreshToken });
            (0, vitest_1.expect)(segundo.status).toBe(401);
            (0, vitest_1.expect)(segundo.body.error.codigo).toBe('TOKEN_INVALIDO');
        });
        (0, vitest_1.it)('rechaza un token de refresco expirado', async () => {
            const sesion = await (0, fixtures_1.api)(e.app)
                .post('/auth/login')
                .send({ email: e.productor.email, password: fixtures_1.PASSWORD });
            await prisma_1.prisma.refreshToken.updateMany({
                where: { idUsuario: e.productor.id },
                data: { expiraEn: new Date(Date.now() - 1000) },
            });
            const r = await (0, fixtures_1.api)(e.app)
                .post('/auth/refresh')
                .send({ refreshToken: sesion.body.refreshToken });
            (0, vitest_1.expect)(r.status).toBe(401);
        });
    });
    (0, vitest_1.describe)('POST /auth/logout', () => {
        (0, vitest_1.it)('revoca el token de refresco entregado', async () => {
            const sesion = await (0, fixtures_1.api)(e.app)
                .post('/auth/login')
                .send({ email: e.productor.email, password: fixtures_1.PASSWORD });
            const salida = await (0, fixtures_1.api)(e.app, sesion.body.accessToken)
                .post('/auth/logout')
                .send({ refreshToken: sesion.body.refreshToken });
            (0, vitest_1.expect)(salida.status).toBe(204);
            const reintento = await (0, fixtures_1.api)(e.app)
                .post('/auth/refresh')
                .send({ refreshToken: sesion.body.refreshToken });
            (0, vitest_1.expect)(reintento.status).toBe(401);
        });
        (0, vitest_1.it)('exige sesión iniciada', async () => {
            const r = await (0, fixtures_1.api)(e.app).post('/auth/logout').send({});
            (0, vitest_1.expect)(r.status).toBe(401);
        });
    });
    (0, vitest_1.describe)('GET /auth/me', () => {
        (0, vitest_1.it)('devuelve el perfil y el predio del usuario en sesión', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.trabajador.token).get('/auth/me');
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body).toMatchObject({
                email: e.trabajador.email,
                rol: 'TRABAJADOR',
                predio: { id: e.predioA.id, nombre: 'Predio A' },
            });
            (0, vitest_1.expect)(r.body).not.toHaveProperty('passwordHash');
        });
        (0, vitest_1.it)('responde 401 sin token', async () => {
            const r = await (0, fixtures_1.api)(e.app).get('/auth/me');
            (0, vitest_1.expect)(r.status).toBe(401);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('NO_AUTENTICADO');
        });
        (0, vitest_1.it)('responde 401 con un token manipulado', async () => {
            const r = await (0, fixtures_1.api)(e.app, `${e.productor.token}xx`).get('/auth/me');
            (0, vitest_1.expect)(r.status).toBe(401);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('TOKEN_INVALIDO');
        });
    });
    (0, vitest_1.describe)('Registro del token de notificaciones (IF3-SAL)', () => {
        (0, vitest_1.it)('registra el dispositivo del usuario', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .post('/dispositivos-push')
                .send({ tokenPush: 'token-fcm-de-prueba-0001', plataforma: 'ANDROID' });
            (0, vitest_1.expect)(r.status).toBe(201);
            const guardados = await prisma_1.prisma.dispositivoUsuario.count({
                where: { idUsuario: e.productor.id },
            });
            (0, vitest_1.expect)(guardados).toBe(1);
        });
        (0, vitest_1.it)('reasigna el token si el mismo equipo lo usa otra persona', async () => {
            await (0, fixtures_1.api)(e.app, e.productor.token)
                .post('/dispositivos-push')
                .send({ tokenPush: 'token-compartido', plataforma: 'ANDROID' });
            await (0, fixtures_1.api)(e.app, e.trabajador.token)
                .post('/dispositivos-push')
                .send({ tokenPush: 'token-compartido', plataforma: 'ANDROID' });
            const dispositivos = await prisma_1.prisma.dispositivoUsuario.findMany({
                where: { tokenPush: 'token-compartido' },
            });
            (0, vitest_1.expect)(dispositivos).toHaveLength(1);
            (0, vitest_1.expect)(dispositivos[0].idUsuario).toBe(e.trabajador.id);
        });
    });
});
//# sourceMappingURL=auth.test.js.map
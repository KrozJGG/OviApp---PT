"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const prisma_1 = require("../src/config/prisma");
const fixtures_1 = require("./apoyo/fixtures");
/**
 * Modulo 7 - Administracion (RF_20, RF_21, RF_22).
 * Todo el modulo es exclusivo del Productor: administra al personal del predio.
 */
(0, vitest_1.describe)('Administración de usuarios (RF_20, RF_21, RF_22)', () => {
    let e;
    (0, vitest_1.beforeEach)(async () => {
        e = await (0, fixtures_1.crearEscenario)();
    });
    (0, vitest_1.describe)('POST /usuarios — registrar (RF_20)', () => {
        (0, vitest_1.it)('crea el usuario y devuelve su ficha sin el hash de la contraseña', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).post('/usuarios').send({
                nombre: 'Nueva Trabajadora',
                email: 'nueva@test.cl',
                password: 'Clave2026!',
                rol: 'TRABAJADOR',
                rut: '12.345.678-9',
                telefono: '+56911112222',
            });
            (0, vitest_1.expect)(r.status).toBe(201);
            (0, vitest_1.expect)(r.body).toMatchObject({
                nombre: 'Nueva Trabajadora',
                email: 'nueva@test.cl',
                rol: 'TRABAJADOR',
                estado: 'HABILITADO',
                rut: '12.345.678-9',
                telefono: '+56911112222',
            });
            (0, vitest_1.expect)(r.body).not.toHaveProperty('passwordHash');
            (0, vitest_1.expect)(r.body).toHaveProperty('fotoUrl', null);
            const guardado = await prisma_1.prisma.usuario.findUnique({ where: { email: 'nueva@test.cl' } });
            (0, vitest_1.expect)(guardado?.idPredio).toBe(e.predioA.id);
            (0, vitest_1.expect)(guardado?.passwordHash).not.toBe('Clave2026!');
        });
        (0, vitest_1.it)('el usuario creado puede iniciar sesión con la contraseña entregada', async () => {
            await (0, fixtures_1.api)(e.app, e.productor.token).post('/usuarios').send({
                nombre: 'Con Sesión',
                email: 'consesion@test.cl',
                password: 'Clave2026!',
                rol: 'TRABAJADOR',
            });
            const login = await (0, fixtures_1.api)(e.app)
                .post('/auth/login')
                .send({ email: 'consesion@test.cl', password: 'Clave2026!' });
            (0, vitest_1.expect)(login.status).toBe(200);
            (0, vitest_1.expect)(login.body.usuario.idPredio).toBe(e.predioA.id);
        });
        (0, vitest_1.it)('normaliza el correo a minúsculas y sin espacios', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).post('/usuarios').send({
                nombre: 'Mayúsculas',
                email: '  MAYUSCULAS@Test.CL  ',
                password: 'Clave2026!',
                rol: 'TRABAJADOR',
            });
            (0, vitest_1.expect)(r.status).toBe(201);
            (0, vitest_1.expect)(r.body.email).toBe('mayusculas@test.cl');
        });
        (0, vitest_1.it)('ignora un idPredio enviado en el cuerpo: el usuario queda en el predio del token (RNF_08)', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).post('/usuarios').send({
                nombre: 'Intruso',
                email: 'intruso@test.cl',
                password: 'Clave2026!',
                rol: 'TRABAJADOR',
                idPredio: e.predioB.id,
            });
            (0, vitest_1.expect)(r.status).toBe(201);
            const guardado = await prisma_1.prisma.usuario.findUnique({ where: { email: 'intruso@test.cl' } });
            (0, vitest_1.expect)(guardado?.idPredio).toBe(e.predioA.id);
        });
        (0, vitest_1.it)('rechaza un correo ya registrado con 409 EMAIL_DUPLICADO', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).post('/usuarios').send({
                nombre: 'Repetida',
                email: e.trabajador.email,
                password: 'Clave2026!',
                rol: 'TRABAJADOR',
            });
            (0, vitest_1.expect)(r.status).toBe(409);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('EMAIL_DUPLICADO');
            (0, vitest_1.expect)(r.body.error.mensaje).toBe('Ya existe un usuario registrado con ese correo electrónico.');
        });
        (0, vitest_1.it)('detecta el correo duplicado aunque venga en mayúsculas', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).post('/usuarios').send({
                nombre: 'Repetida',
                email: e.trabajador.email.toUpperCase(),
                password: 'Clave2026!',
                rol: 'TRABAJADOR',
            });
            (0, vitest_1.expect)(r.status).toBe(409);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('EMAIL_DUPLICADO');
        });
        (0, vitest_1.it)('exige una contraseña de al menos 8 caracteres', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).post('/usuarios').send({
                nombre: 'Clave Corta',
                email: 'corta@test.cl',
                password: '1234567',
                rol: 'TRABAJADOR',
            });
            (0, vitest_1.expect)(r.status).toBe(400);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('VALIDACION');
            (0, vitest_1.expect)(r.body.error.detalles).toEqual([vitest_1.expect.objectContaining({ campo: 'password' })]);
        });
        (0, vitest_1.it)('rechaza un rol desconocido', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).post('/usuarios').send({
                nombre: 'Rol Raro',
                email: 'rolraro@test.cl',
                password: 'Clave2026!',
                rol: 'ADMINISTRADOR',
            });
            (0, vitest_1.expect)(r.status).toBe(400);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('VALIDACION');
        });
        (0, vitest_1.it)('responde 403 a un Trabajador', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.trabajador.token).post('/usuarios').send({
                nombre: 'No Autorizada',
                email: 'noautorizada@test.cl',
                password: 'Clave2026!',
                rol: 'TRABAJADOR',
            });
            (0, vitest_1.expect)(r.status).toBe(403);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('ROL_INSUFICIENTE');
        });
        (0, vitest_1.it)('responde 401 sin token', async () => {
            const r = await (0, fixtures_1.api)(e.app).post('/usuarios').send({
                nombre: 'Anónima',
                email: 'anonima@test.cl',
                password: 'Clave2026!',
                rol: 'TRABAJADOR',
            });
            (0, vitest_1.expect)(r.status).toBe(401);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('NO_AUTENTICADO');
        });
    });
    (0, vitest_1.describe)('GET /usuarios — listado del predio', () => {
        (0, vitest_1.it)('devuelve solo los usuarios del predio, ordenados por nombre', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get('/usuarios');
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.datos.map((u) => u.nombre)).toEqual([
                'Productora A',
                'Trabajador A',
            ]);
            (0, vitest_1.expect)(r.body.meta).toMatchObject({ pagina: 1, total: 2, totalPaginas: 1 });
            (0, vitest_1.expect)(r.body.datos[0]).not.toHaveProperty('passwordHash');
        });
        (0, vitest_1.it)('filtra por rol y por estado', async () => {
            await (0, fixtures_1.crearUsuario)({
                idPredio: e.predioA.id,
                email: 'fuera@test.cl',
                nombre: 'Fuera de Servicio',
                estado: 'INHABILITADO',
            });
            const porRol = await (0, fixtures_1.api)(e.app, e.productor.token).get('/usuarios?rol=PRODUCTOR');
            (0, vitest_1.expect)(porRol.status).toBe(200);
            (0, vitest_1.expect)(porRol.body.datos).toHaveLength(1);
            (0, vitest_1.expect)(porRol.body.datos[0].rol).toBe('PRODUCTOR');
            const porEstado = await (0, fixtures_1.api)(e.app, e.productor.token).get('/usuarios?estado=INHABILITADO');
            (0, vitest_1.expect)(porEstado.body.datos).toHaveLength(1);
            (0, vitest_1.expect)(porEstado.body.datos[0].email).toBe('fuera@test.cl');
        });
        (0, vitest_1.it)('busca por nombre o correo sin distinguir mayúsculas', async () => {
            const porNombre = await (0, fixtures_1.api)(e.app, e.productor.token).get('/usuarios?q=TRABAJ');
            (0, vitest_1.expect)(porNombre.status).toBe(200);
            (0, vitest_1.expect)(porNombre.body.datos).toHaveLength(1);
            (0, vitest_1.expect)(porNombre.body.datos[0].nombre).toBe('Trabajador A');
            const porCorreo = await (0, fixtures_1.api)(e.app, e.productor.token).get('/usuarios?q=PRODUCTOR@TEST');
            (0, vitest_1.expect)(porCorreo.body.datos).toHaveLength(1);
            (0, vitest_1.expect)(porCorreo.body.datos[0].email).toBe(e.productor.email);
        });
        (0, vitest_1.it)('pagina el resultado', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get('/usuarios?pagina=1&tamano=1');
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.datos).toHaveLength(1);
            (0, vitest_1.expect)(r.body.meta).toMatchObject({ pagina: 1, tamano: 1, total: 2, totalPaginas: 2 });
        });
        (0, vitest_1.it)('no muestra usuarios de otro predio (RNF_08)', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.ajeno.token).get('/usuarios');
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.datos).toHaveLength(1);
            (0, vitest_1.expect)(r.body.datos[0].email).toBe(e.ajeno.email);
        });
        (0, vitest_1.it)('responde 403 a un Trabajador', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.trabajador.token).get('/usuarios');
            (0, vitest_1.expect)(r.status).toBe(403);
        });
        (0, vitest_1.it)('responde 401 sin token', async () => {
            const r = await (0, fixtures_1.api)(e.app).get('/usuarios');
            (0, vitest_1.expect)(r.status).toBe(401);
        });
    });
    (0, vitest_1.describe)('GET /usuarios/:id', () => {
        (0, vitest_1.it)('devuelve la ficha del usuario del predio', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get(`/usuarios/${e.trabajador.id}`);
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body).toMatchObject({ id: e.trabajador.id, email: e.trabajador.email });
            (0, vitest_1.expect)(r.body).not.toHaveProperty('passwordHash');
        });
        (0, vitest_1.it)('responde 404 si el usuario es de otro predio (RNF_08)', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.ajeno.token).get(`/usuarios/${e.trabajador.id}`);
            (0, vitest_1.expect)(r.status).toBe(404);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('NO_ENCONTRADO');
        });
        (0, vitest_1.it)('responde 404 si el usuario no existe', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).get('/usuarios/00000000-0000-4000-8000-000000000000');
            (0, vitest_1.expect)(r.status).toBe(404);
        });
        (0, vitest_1.it)('responde 403 a un Trabajador', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.trabajador.token).get(`/usuarios/${e.productor.id}`);
            (0, vitest_1.expect)(r.status).toBe(403);
        });
        (0, vitest_1.it)('responde 401 sin token', async () => {
            const r = await (0, fixtures_1.api)(e.app).get(`/usuarios/${e.trabajador.id}`);
            (0, vitest_1.expect)(r.status).toBe(401);
        });
    });
    (0, vitest_1.describe)('PATCH /usuarios/:id — editar (RF_21)', () => {
        (0, vitest_1.it)('actualiza los datos y devuelve la ficha actualizada', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .patch(`/usuarios/${e.trabajador.id}`)
                .send({ nombre: 'Trabajador Renombrado', telefono: '+56900000000', rol: 'PRODUCTOR' });
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body).toMatchObject({
                id: e.trabajador.id,
                nombre: 'Trabajador Renombrado',
                telefono: '+56900000000',
                rol: 'PRODUCTOR',
            });
            (0, vitest_1.expect)(r.body).not.toHaveProperty('passwordHash');
        });
        (0, vitest_1.it)('permite cambiar el correo y lo normaliza', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .patch(`/usuarios/${e.trabajador.id}`)
                .send({ email: 'NUEVO.Correo@Test.CL' });
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.email).toBe('nuevo.correo@test.cl');
        });
        (0, vitest_1.it)('acepta reenviar el mismo correo del usuario sin marcarlo como duplicado', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .patch(`/usuarios/${e.trabajador.id}`)
                .send({ email: e.trabajador.email, nombre: 'Mismo Correo' });
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body.nombre).toBe('Mismo Correo');
        });
        (0, vitest_1.it)('rechaza el intento de cambiar el identificador con 409 IDENTIFICADOR_INMUTABLE', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .patch(`/usuarios/${e.trabajador.id}`)
                .send({ id: e.productor.id, nombre: 'Suplantador' });
            (0, vitest_1.expect)(r.status).toBe(409);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('IDENTIFICADOR_INMUTABLE');
            const sinCambios = await prisma_1.prisma.usuario.findUniqueOrThrow({ where: { id: e.trabajador.id } });
            (0, vitest_1.expect)(sinCambios.nombre).toBe('Trabajador A');
        });
        (0, vitest_1.it)('no permite editar a un usuario inhabilitado (409 USUARIO_INHABILITADO)', async () => {
            const fuera = await (0, fixtures_1.crearUsuario)({
                idPredio: e.predioA.id,
                email: 'inhabil@test.cl',
                estado: 'INHABILITADO',
            });
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .patch(`/usuarios/${fuera.id}`)
                .send({ nombre: 'No se puede' });
            (0, vitest_1.expect)(r.status).toBe(409);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('USUARIO_INHABILITADO');
            (0, vitest_1.expect)(r.body.error.mensaje).toBe('No se puede editar un usuario inhabilitado.');
        });
        (0, vitest_1.it)('rechaza un correo que ya usa otro usuario (409 EMAIL_DUPLICADO)', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token)
                .patch(`/usuarios/${e.trabajador.id}`)
                .send({ email: e.productor.email });
            (0, vitest_1.expect)(r.status).toBe(409);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('EMAIL_DUPLICADO');
        });
        (0, vitest_1.it)('exige al menos un campo para actualizar', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).patch(`/usuarios/${e.trabajador.id}`).send({});
            (0, vitest_1.expect)(r.status).toBe(400);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('VALIDACION');
        });
        (0, vitest_1.it)('responde 404 si el usuario es de otro predio (RNF_08)', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.ajeno.token)
                .patch(`/usuarios/${e.trabajador.id}`)
                .send({ nombre: 'Intromisión' });
            (0, vitest_1.expect)(r.status).toBe(404);
            const sinCambios = await prisma_1.prisma.usuario.findUniqueOrThrow({ where: { id: e.trabajador.id } });
            (0, vitest_1.expect)(sinCambios.nombre).toBe('Trabajador A');
        });
        (0, vitest_1.it)('responde 403 a un Trabajador', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.trabajador.token)
                .patch(`/usuarios/${e.trabajador.id}`)
                .send({ nombre: 'Yo mismo' });
            (0, vitest_1.expect)(r.status).toBe(403);
        });
        (0, vitest_1.it)('responde 401 sin token', async () => {
            const r = await (0, fixtures_1.api)(e.app).patch(`/usuarios/${e.trabajador.id}`).send({ nombre: 'Anónimo' });
            (0, vitest_1.expect)(r.status).toBe(401);
        });
    });
    (0, vitest_1.describe)('POST /usuarios/:id/inhabilitar — inhabilitar (RF_22)', () => {
        (0, vitest_1.it)('cambia el estado a INHABILITADO y devuelve la ficha actualizada', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).post(`/usuarios/${e.trabajador.id}/inhabilitar`);
            (0, vitest_1.expect)(r.status).toBe(200);
            (0, vitest_1.expect)(r.body).toMatchObject({ id: e.trabajador.id, estado: 'INHABILITADO' });
            (0, vitest_1.expect)(r.body).not.toHaveProperty('passwordHash');
        });
        (0, vitest_1.it)('no borra al usuario ni su histórico', async () => {
            const animal = await (0, fixtures_1.crearAnimal)({
                idPredio: e.predioA.id,
                idRegistrador: e.trabajador.id,
                numeroOreja: '0777',
            });
            await (0, fixtures_1.api)(e.app, e.productor.token).post(`/usuarios/${e.trabajador.id}/inhabilitar`);
            const usuario = await prisma_1.prisma.usuario.findUnique({ where: { id: e.trabajador.id } });
            (0, vitest_1.expect)(usuario).not.toBeNull();
            (0, vitest_1.expect)(usuario?.estado).toBe('INHABILITADO');
            const registrado = await prisma_1.prisma.animal.findUnique({ where: { id: animal.id } });
            (0, vitest_1.expect)(registrado?.idRegistrador).toBe(e.trabajador.id);
        });
        (0, vitest_1.it)('revoca las sesiones abiertas del usuario', async () => {
            const sesion = await (0, fixtures_1.api)(e.app)
                .post('/auth/login')
                .send({ email: e.trabajador.email, password: fixtures_1.PASSWORD });
            (0, vitest_1.expect)(sesion.status).toBe(200);
            await (0, fixtures_1.api)(e.app, e.productor.token).post(`/usuarios/${e.trabajador.id}/inhabilitar`);
            const refresco = await (0, fixtures_1.api)(e.app)
                .post('/auth/refresh')
                .send({ refreshToken: sesion.body.refreshToken });
            (0, vitest_1.expect)(refresco.status).toBe(401);
            const relogin = await (0, fixtures_1.api)(e.app)
                .post('/auth/login')
                .send({ email: e.trabajador.email, password: fixtures_1.PASSWORD });
            (0, vitest_1.expect)(relogin.status).toBe(401);
            (0, vitest_1.expect)(relogin.body.error.codigo).toBe('USUARIO_INHABILITADO');
        });
        (0, vitest_1.it)('rechaza inhabilitar a quien ya está inhabilitado (409 USUARIO_YA_INHABILITADO)', async () => {
            await (0, fixtures_1.api)(e.app, e.productor.token).post(`/usuarios/${e.trabajador.id}/inhabilitar`);
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).post(`/usuarios/${e.trabajador.id}/inhabilitar`);
            (0, vitest_1.expect)(r.status).toBe(409);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('USUARIO_YA_INHABILITADO');
        });
        (0, vitest_1.it)('no permite que el Productor se inhabilite a sí mismo (422 AUTOINHABILITACION)', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).post(`/usuarios/${e.productor.id}/inhabilitar`);
            (0, vitest_1.expect)(r.status).toBe(422);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('AUTOINHABILITACION');
            (0, vitest_1.expect)(r.body.error.mensaje).toBe('No puedes inhabilitar tu propia cuenta.');
        });
        (0, vitest_1.it)('no deja al predio sin ningún Productor habilitado (422 ULTIMO_PRODUCTOR)', async () => {
            // Con dos productores, el segundo puede inhabilitar al primero. El token de
            // acceso del inhabilitado sigue vigente unos minutos, y con el se intenta
            // inhabilitar al unico Productor que queda: ahi es donde la regla protege
            // al predio de quedarse sin quien lo administre.
            const segundo = await (0, fixtures_1.crearUsuario)({
                idPredio: e.predioA.id,
                email: 'productor2@test.cl',
                nombre: 'Productor Segundo',
                rol: 'PRODUCTOR',
            });
            const tokenSegundo = await (0, fixtures_1.iniciarSesion)(e.app, segundo.email);
            const primera = await (0, fixtures_1.api)(e.app, tokenSegundo).post(`/usuarios/${e.productor.id}/inhabilitar`);
            (0, vitest_1.expect)(primera.status).toBe(200);
            const r = await (0, fixtures_1.api)(e.app, e.productor.token).post(`/usuarios/${segundo.id}/inhabilitar`);
            (0, vitest_1.expect)(r.status).toBe(422);
            (0, vitest_1.expect)(r.body.error.codigo).toBe('ULTIMO_PRODUCTOR');
            (0, vitest_1.expect)(r.body.error.mensaje).toBe('El predio debe conservar al menos un Productor habilitado.');
            const sigueHabilitado = await prisma_1.prisma.usuario.findUniqueOrThrow({ where: { id: segundo.id } });
            (0, vitest_1.expect)(sigueHabilitado.estado).toBe('HABILITADO');
        });
        (0, vitest_1.it)('responde 404 si el usuario es de otro predio (RNF_08)', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.ajeno.token).post(`/usuarios/${e.trabajador.id}/inhabilitar`);
            (0, vitest_1.expect)(r.status).toBe(404);
            const sinCambios = await prisma_1.prisma.usuario.findUniqueOrThrow({ where: { id: e.trabajador.id } });
            (0, vitest_1.expect)(sinCambios.estado).toBe('HABILITADO');
        });
        (0, vitest_1.it)('responde 403 a un Trabajador', async () => {
            const r = await (0, fixtures_1.api)(e.app, e.trabajador.token).post(`/usuarios/${e.productor.id}/inhabilitar`);
            (0, vitest_1.expect)(r.status).toBe(403);
        });
        (0, vitest_1.it)('responde 401 sin token', async () => {
            const r = await (0, fixtures_1.api)(e.app).post(`/usuarios/${e.trabajador.id}/inhabilitar`);
            (0, vitest_1.expect)(r.status).toBe(401);
        });
    });
});
//# sourceMappingURL=usuarios.test.js.map
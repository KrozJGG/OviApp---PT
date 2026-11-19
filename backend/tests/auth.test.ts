import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { api, crearEscenario, crearUsuario, PASSWORD, type Escenario } from './apoyo/fixtures';

/**
 * Sesión — IF6-ENT y RF_00 (H13 del plan).
 * Es la base de los otros 21 requerimientos: todos asumen usuario autenticado.
 */
describe('Autenticación (IF6-ENT)', () => {
  let e: Escenario;

  beforeEach(async () => {
    e = await crearEscenario();
  });

  describe('POST /auth/login', () => {
    it('entrega tokens y el perfil con credenciales válidas', async () => {
      const r = await api(e.app).post('/auth/login').send({
        email: e.productor.email,
        password: PASSWORD,
      });

      expect(r.status).toBe(200);
      expect(r.body.accessToken).toBeTypeOf('string');
      expect(r.body.refreshToken).toBeTypeOf('string');
      expect(r.body.usuario).toMatchObject({
        email: e.productor.email,
        rol: 'PRODUCTOR',
        idPredio: e.predioA.id,
        predio: 'Predio A',
      });
      expect(r.body.usuario).not.toHaveProperty('passwordHash');
    });

    it('acepta el correo sin distinguir mayúsculas', async () => {
      const r = await api(e.app).post('/auth/login').send({
        email: e.productor.email.toUpperCase(),
        password: PASSWORD,
      });
      expect(r.status).toBe(200);
    });

    it('rechaza una contraseña incorrecta', async () => {
      const r = await api(e.app).post('/auth/login').send({
        email: e.productor.email,
        password: 'incorrecta',
      });
      expect(r.status).toBe(401);
      expect(r.body.error.codigo).toBe('CREDENCIALES_INVALIDAS');
    });

    it('no revela si el correo existe: mismo código y mensaje que la contraseña errónea', async () => {
      const inexistente = await api(e.app)
        .post('/auth/login')
        .send({ email: 'nadie@test.cl', password: PASSWORD });
      const passwordMala = await api(e.app)
        .post('/auth/login')
        .send({ email: e.productor.email, password: 'incorrecta' });

      expect(inexistente.status).toBe(passwordMala.status);
      expect(inexistente.body.error.codigo).toBe(passwordMala.body.error.codigo);
      expect(inexistente.body.error.mensaje).toBe(passwordMala.body.error.mensaje);
    });

    it('rechaza a un usuario inhabilitado (RF_22)', async () => {
      const inhabilitado = await crearUsuario({
        idPredio: e.predioA.id,
        email: 'inhabilitado@test.cl',
        estado: 'INHABILITADO',
      });

      const r = await api(e.app)
        .post('/auth/login')
        .send({ email: inhabilitado.email, password: PASSWORD });

      expect(r.status).toBe(401);
      expect(r.body.error.codigo).toBe('USUARIO_INHABILITADO');
    });

    it('valida el formato del correo', async () => {
      const r = await api(e.app).post('/auth/login').send({ email: 'no-es-correo', password: 'x' });
      expect(r.status).toBe(400);
      expect(r.body.error.codigo).toBe('VALIDACION');
      expect(r.body.error.detalles).toEqual([
        expect.objectContaining({ campo: 'email' }),
      ]);
    });
  });

  describe('POST /auth/registro', () => {
    it('crea el predio, el productor titular y devuelve la sesión iniciada (201)', async () => {
      const r = await api(e.app)
        .post('/auth/registro')
        .send({
          nombre: 'Laura González',
          email: 'Laura@NuevoPredio.cl',
          password: PASSWORD,
          rut: '14.222.333-4',
          telefono: '+56 9 1111 2222',
          predio: {
            nombre: 'Estancia Las Lengas',
            ubicacion: 'Coyhaique, Aysén',
          },
        });

      expect(r.status).toBe(201);
      expect(r.body.accessToken).toBeTypeOf('string');
      expect(r.body.refreshToken).toBeTypeOf('string');
      expect(r.body.usuario).toMatchObject({
        nombre: 'Laura González',
        email: 'laura@nuevopredio.cl',
        rol: 'PRODUCTOR',
        predio: 'Estancia Las Lengas',
      });
      expect(r.body.usuario).not.toHaveProperty('passwordHash');

      const predioCreado = await prisma.predio.findUnique({
        where: { id: r.body.usuario.idPredio },
      });
      expect(predioCreado).toMatchObject({
        nombre: 'Estancia Las Lengas',
        ubicacion: 'Coyhaique, Aysén',
      });
    });

    it('asigna un nombre por defecto al predio cuando no se envía o viene vacío', async () => {
      const r = await api(e.app)
        .post('/auth/registro')
        .send({
          nombre: 'Carlos Muñoz',
          email: 'carlos@sinpredio.cl',
          password: PASSWORD,
          predio: { nombre: '   ' },
        });

      expect(r.status).toBe(201);
      expect(r.body.usuario.predio).toBe('Predio de Carlos Muñoz');
    });

    it('permite registrar trabajadores opcionales en el mismo acto y todos quedan en el nuevo predio', async () => {
      const r = await api(e.app)
        .post('/auth/registro')
        .send({
          nombre: 'Laura González',
          email: 'laura@laslengas.cl',
          password: PASSWORD,
          predio: { nombre: 'Las Lengas' },
          trabajadores: [
            {
              nombre: 'Mateo Soto',
              email: 'mateo@laslengas.cl',
              password: PASSWORD,
              telefono: '+56 9 3333 4444',
            },
            {
              nombre: 'Ana Vera',
              email: 'ana@laslengas.cl',
              password: PASSWORD,
              rol: 'PRODUCTOR',
            },
          ],
        });

      expect(r.status).toBe(201);
      const idPredio = r.body.usuario.idPredio as string;

      const usuariosPredio = await prisma.usuario.findMany({
        where: { idPredio },
        orderBy: { email: 'asc' },
      });
      expect(usuariosPredio).toHaveLength(3);
      expect(usuariosPredio.map((u) => ({ email: u.email, rol: u.rol }))).toEqual([
        { email: 'ana@laslengas.cl', rol: 'PRODUCTOR' },
        { email: 'laura@laslengas.cl', rol: 'PRODUCTOR' },
        { email: 'mateo@laslengas.cl', rol: 'TRABAJADOR' },
      ]);

      // El trabajador recién creado puede iniciar sesión de inmediato
      const loginTrabajador = await api(e.app).post('/auth/login').send({
        email: 'mateo@laslengas.cl',
        password: PASSWORD,
      });
      expect(loginTrabajador.status).toBe(200);
      expect(loginTrabajador.body.usuario.idPredio).toBe(idPredio);
    });

    it('rechaza con 409 si el correo del titular o de un trabajador ya existe y no deja predios huérfanos', async () => {
      const prediosAntes = await prisma.predio.count();

      const r = await api(e.app)
        .post('/auth/registro')
        .send({
          nombre: 'Laura González',
          email: 'laura@laslengas.cl',
          password: PASSWORD,
          predio: { nombre: 'Predio Fallido' },
          trabajadores: [
            {
              nombre: 'Duplicado',
              email: e.trabajador.email,
              password: PASSWORD,
            },
          ],
        });

      expect(r.status).toBe(409);
      expect(r.body.error.codigo).toBe('EMAIL_DUPLICADO');

      const prediosDespues = await prisma.predio.count();
      expect(prediosDespues).toBe(prediosAntes);
    });

    it('rechaza con 409 si se repite el mismo correo dentro del formulario de registro', async () => {
      const r = await api(e.app)
        .post('/auth/registro')
        .send({
          nombre: 'Laura González',
          email: 'repetido@laslengas.cl',
          password: PASSWORD,
          trabajadores: [
            {
              nombre: 'Mateo Soto',
              email: 'REPETIDO@laslengas.cl',
              password: PASSWORD,
            },
          ],
        });

      expect(r.status).toBe(409);
      expect(r.body.error.codigo).toBe('EMAIL_DUPLICADO');
    });
  });

  describe('POST /auth/refresh', () => {
    it('renueva la sesión y rota el token de refresco', async () => {
      const sesion = await api(e.app)
        .post('/auth/login')
        .send({ email: e.productor.email, password: PASSWORD });

      const r = await api(e.app)
        .post('/auth/refresh')
        .send({ refreshToken: sesion.body.refreshToken });

      expect(r.status).toBe(200);
      expect(r.body.refreshToken).not.toBe(sesion.body.refreshToken);
    });

    it('no permite reutilizar un token ya consumido', async () => {
      const sesion = await api(e.app)
        .post('/auth/login')
        .send({ email: e.productor.email, password: PASSWORD });

      await api(e.app).post('/auth/refresh').send({ refreshToken: sesion.body.refreshToken });
      const segundo = await api(e.app)
        .post('/auth/refresh')
        .send({ refreshToken: sesion.body.refreshToken });

      expect(segundo.status).toBe(401);
      expect(segundo.body.error.codigo).toBe('TOKEN_INVALIDO');
    });

    it('rechaza un token de refresco expirado', async () => {
      const sesion = await api(e.app)
        .post('/auth/login')
        .send({ email: e.productor.email, password: PASSWORD });

      await prisma.refreshToken.updateMany({
        where: { idUsuario: e.productor.id },
        data: { expiraEn: new Date(Date.now() - 1000) },
      });

      const r = await api(e.app)
        .post('/auth/refresh')
        .send({ refreshToken: sesion.body.refreshToken });

      expect(r.status).toBe(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('revoca el token de refresco entregado', async () => {
      const sesion = await api(e.app)
        .post('/auth/login')
        .send({ email: e.productor.email, password: PASSWORD });

      const salida = await api(e.app, sesion.body.accessToken)
        .post('/auth/logout')
        .send({ refreshToken: sesion.body.refreshToken });
      expect(salida.status).toBe(204);

      const reintento = await api(e.app)
        .post('/auth/refresh')
        .send({ refreshToken: sesion.body.refreshToken });
      expect(reintento.status).toBe(401);
    });

    it('exige sesión iniciada', async () => {
      const r = await api(e.app).post('/auth/logout').send({});
      expect(r.status).toBe(401);
    });
  });

  describe('GET /auth/me', () => {
    it('devuelve el perfil y el predio del usuario en sesión', async () => {
      const r = await api(e.app, e.trabajador.token).get('/auth/me');

      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({
        email: e.trabajador.email,
        rol: 'TRABAJADOR',
        predio: { id: e.predioA.id, nombre: 'Predio A' },
      });
      expect(r.body).not.toHaveProperty('passwordHash');
    });

    it('responde 401 sin token', async () => {
      const r = await api(e.app).get('/auth/me');
      expect(r.status).toBe(401);
      expect(r.body.error.codigo).toBe('NO_AUTENTICADO');
    });

    it('responde 401 con un token manipulado', async () => {
      const r = await api(e.app, `${e.productor.token}xx`).get('/auth/me');
      expect(r.status).toBe(401);
      expect(r.body.error.codigo).toBe('TOKEN_INVALIDO');
    });
  });

  describe('Registro del token de notificaciones (IF3-SAL)', () => {
    it('registra el dispositivo del usuario', async () => {
      const r = await api(e.app, e.productor.token)
        .post('/dispositivos-push')
        .send({ tokenPush: 'token-fcm-de-prueba-0001', plataforma: 'ANDROID' });

      expect(r.status).toBe(201);
      const guardados = await prisma.dispositivoUsuario.count({
        where: { idUsuario: e.productor.id },
      });
      expect(guardados).toBe(1);
    });

    it('reasigna el token si el mismo equipo lo usa otra persona', async () => {
      await api(e.app, e.productor.token)
        .post('/dispositivos-push')
        .send({ tokenPush: 'token-compartido', plataforma: 'ANDROID' });
      await api(e.app, e.trabajador.token)
        .post('/dispositivos-push')
        .send({ tokenPush: 'token-compartido', plataforma: 'ANDROID' });

      const dispositivos = await prisma.dispositivoUsuario.findMany({
        where: { tokenPush: 'token-compartido' },
      });
      expect(dispositivos).toHaveLength(1);
      expect(dispositivos[0]!.idUsuario).toBe(e.trabajador.id);
    });
  });
});

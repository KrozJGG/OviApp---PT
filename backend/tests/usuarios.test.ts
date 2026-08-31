import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import {
  api,
  crearAnimal,
  crearEscenario,
  crearUsuario,
  iniciarSesion,
  PASSWORD,
  type Escenario,
} from './apoyo/fixtures';

/**
 * Modulo 7 - Administracion (RF_20, RF_21, RF_22).
 * Todo el modulo es exclusivo del Productor: administra al personal del predio.
 */
describe('Administración de usuarios (RF_20, RF_21, RF_22)', () => {
  let e: Escenario;

  beforeEach(async () => {
    e = await crearEscenario();
  });

  describe('POST /usuarios — registrar (RF_20)', () => {
    it('crea el usuario y devuelve su ficha sin el hash de la contraseña', async () => {
      const r = await api(e.app, e.productor.token).post('/usuarios').send({
        nombre: 'Nueva Trabajadora',
        email: 'nueva@test.cl',
        password: 'Clave2026!',
        rol: 'TRABAJADOR',
        rut: '12.345.678-9',
        telefono: '+56911112222',
      });

      expect(r.status).toBe(201);
      expect(r.body).toMatchObject({
        nombre: 'Nueva Trabajadora',
        email: 'nueva@test.cl',
        rol: 'TRABAJADOR',
        estado: 'HABILITADO',
        rut: '12.345.678-9',
        telefono: '+56911112222',
      });
      expect(r.body).not.toHaveProperty('passwordHash');
      expect(r.body).toHaveProperty('fotoUrl', null);

      const guardado = await prisma.usuario.findUnique({ where: { email: 'nueva@test.cl' } });
      expect(guardado?.idPredio).toBe(e.predioA.id);
      expect(guardado?.passwordHash).not.toBe('Clave2026!');
    });

    it('el usuario creado puede iniciar sesión con la contraseña entregada', async () => {
      await api(e.app, e.productor.token).post('/usuarios').send({
        nombre: 'Con Sesión',
        email: 'consesion@test.cl',
        password: 'Clave2026!',
        rol: 'TRABAJADOR',
      });

      const login = await api(e.app)
        .post('/auth/login')
        .send({ email: 'consesion@test.cl', password: 'Clave2026!' });

      expect(login.status).toBe(200);
      expect(login.body.usuario.idPredio).toBe(e.predioA.id);
    });

    it('normaliza el correo a minúsculas y sin espacios', async () => {
      const r = await api(e.app, e.productor.token).post('/usuarios').send({
        nombre: 'Mayúsculas',
        email: '  MAYUSCULAS@Test.CL  ',
        password: 'Clave2026!',
        rol: 'TRABAJADOR',
      });

      expect(r.status).toBe(201);
      expect(r.body.email).toBe('mayusculas@test.cl');
    });

    it('ignora un idPredio enviado en el cuerpo: el usuario queda en el predio del token (RNF_08)', async () => {
      const r = await api(e.app, e.productor.token).post('/usuarios').send({
        nombre: 'Intruso',
        email: 'intruso@test.cl',
        password: 'Clave2026!',
        rol: 'TRABAJADOR',
        idPredio: e.predioB.id,
      });

      expect(r.status).toBe(201);
      const guardado = await prisma.usuario.findUnique({ where: { email: 'intruso@test.cl' } });
      expect(guardado?.idPredio).toBe(e.predioA.id);
    });

    it('rechaza un correo ya registrado con 409 EMAIL_DUPLICADO', async () => {
      const r = await api(e.app, e.productor.token).post('/usuarios').send({
        nombre: 'Repetida',
        email: e.trabajador.email,
        password: 'Clave2026!',
        rol: 'TRABAJADOR',
      });

      expect(r.status).toBe(409);
      expect(r.body.error.codigo).toBe('EMAIL_DUPLICADO');
      expect(r.body.error.mensaje).toBe('Ya existe un usuario registrado con ese correo electrónico.');
    });

    it('detecta el correo duplicado aunque venga en mayúsculas', async () => {
      const r = await api(e.app, e.productor.token).post('/usuarios').send({
        nombre: 'Repetida',
        email: e.trabajador.email.toUpperCase(),
        password: 'Clave2026!',
        rol: 'TRABAJADOR',
      });

      expect(r.status).toBe(409);
      expect(r.body.error.codigo).toBe('EMAIL_DUPLICADO');
    });

    it('exige una contraseña de al menos 8 caracteres', async () => {
      const r = await api(e.app, e.productor.token).post('/usuarios').send({
        nombre: 'Clave Corta',
        email: 'corta@test.cl',
        password: '1234567',
        rol: 'TRABAJADOR',
      });

      expect(r.status).toBe(400);
      expect(r.body.error.codigo).toBe('VALIDACION');
      expect(r.body.error.detalles).toEqual([expect.objectContaining({ campo: 'password' })]);
    });

    it('rechaza un rol desconocido', async () => {
      const r = await api(e.app, e.productor.token).post('/usuarios').send({
        nombre: 'Rol Raro',
        email: 'rolraro@test.cl',
        password: 'Clave2026!',
        rol: 'ADMINISTRADOR',
      });

      expect(r.status).toBe(400);
      expect(r.body.error.codigo).toBe('VALIDACION');
    });

    it('responde 403 a un Trabajador', async () => {
      const r = await api(e.app, e.trabajador.token).post('/usuarios').send({
        nombre: 'No Autorizada',
        email: 'noautorizada@test.cl',
        password: 'Clave2026!',
        rol: 'TRABAJADOR',
      });

      expect(r.status).toBe(403);
      expect(r.body.error.codigo).toBe('ROL_INSUFICIENTE');
    });

    it('responde 401 sin token', async () => {
      const r = await api(e.app).post('/usuarios').send({
        nombre: 'Anónima',
        email: 'anonima@test.cl',
        password: 'Clave2026!',
        rol: 'TRABAJADOR',
      });

      expect(r.status).toBe(401);
      expect(r.body.error.codigo).toBe('NO_AUTENTICADO');
    });
  });

  describe('GET /usuarios — listado del predio', () => {
    it('devuelve solo los usuarios del predio, ordenados por nombre', async () => {
      const r = await api(e.app, e.productor.token).get('/usuarios');

      expect(r.status).toBe(200);
      expect(r.body.datos.map((u: { nombre: string }) => u.nombre)).toEqual([
        'Productora A',
        'Trabajador A',
      ]);
      expect(r.body.meta).toMatchObject({ pagina: 1, total: 2, totalPaginas: 1 });
      expect(r.body.datos[0]).not.toHaveProperty('passwordHash');
    });

    it('filtra por rol y por estado', async () => {
      await crearUsuario({
        idPredio: e.predioA.id,
        email: 'fuera@test.cl',
        nombre: 'Fuera de Servicio',
        estado: 'INHABILITADO',
      });

      const porRol = await api(e.app, e.productor.token).get('/usuarios?rol=PRODUCTOR');
      expect(porRol.status).toBe(200);
      expect(porRol.body.datos).toHaveLength(1);
      expect(porRol.body.datos[0].rol).toBe('PRODUCTOR');

      const porEstado = await api(e.app, e.productor.token).get('/usuarios?estado=INHABILITADO');
      expect(porEstado.body.datos).toHaveLength(1);
      expect(porEstado.body.datos[0].email).toBe('fuera@test.cl');
    });

    it('busca por nombre o correo sin distinguir mayúsculas', async () => {
      const porNombre = await api(e.app, e.productor.token).get('/usuarios?q=TRABAJ');
      expect(porNombre.status).toBe(200);
      expect(porNombre.body.datos).toHaveLength(1);
      expect(porNombre.body.datos[0].nombre).toBe('Trabajador A');

      const porCorreo = await api(e.app, e.productor.token).get('/usuarios?q=PRODUCTOR@TEST');
      expect(porCorreo.body.datos).toHaveLength(1);
      expect(porCorreo.body.datos[0].email).toBe(e.productor.email);
    });

    it('pagina el resultado', async () => {
      const r = await api(e.app, e.productor.token).get('/usuarios?pagina=1&tamano=1');

      expect(r.status).toBe(200);
      expect(r.body.datos).toHaveLength(1);
      expect(r.body.meta).toMatchObject({ pagina: 1, tamano: 1, total: 2, totalPaginas: 2 });
    });

    it('no muestra usuarios de otro predio (RNF_08)', async () => {
      const r = await api(e.app, e.ajeno.token).get('/usuarios');

      expect(r.status).toBe(200);
      expect(r.body.datos).toHaveLength(1);
      expect(r.body.datos[0].email).toBe(e.ajeno.email);
    });

    it('responde 403 a un Trabajador', async () => {
      const r = await api(e.app, e.trabajador.token).get('/usuarios');
      expect(r.status).toBe(403);
    });

    it('responde 401 sin token', async () => {
      const r = await api(e.app).get('/usuarios');
      expect(r.status).toBe(401);
    });
  });

  describe('GET /usuarios/:id', () => {
    it('devuelve la ficha del usuario del predio', async () => {
      const r = await api(e.app, e.productor.token).get(`/usuarios/${e.trabajador.id}`);

      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ id: e.trabajador.id, email: e.trabajador.email });
      expect(r.body).not.toHaveProperty('passwordHash');
    });

    it('responde 404 si el usuario es de otro predio (RNF_08)', async () => {
      const r = await api(e.app, e.ajeno.token).get(`/usuarios/${e.trabajador.id}`);

      expect(r.status).toBe(404);
      expect(r.body.error.codigo).toBe('NO_ENCONTRADO');
    });

    it('responde 404 si el usuario no existe', async () => {
      const r = await api(e.app, e.productor.token).get(
        '/usuarios/00000000-0000-4000-8000-000000000000',
      );
      expect(r.status).toBe(404);
    });

    it('responde 403 a un Trabajador', async () => {
      const r = await api(e.app, e.trabajador.token).get(`/usuarios/${e.productor.id}`);
      expect(r.status).toBe(403);
    });

    it('responde 401 sin token', async () => {
      const r = await api(e.app).get(`/usuarios/${e.trabajador.id}`);
      expect(r.status).toBe(401);
    });
  });

  describe('PATCH /usuarios/:id — editar (RF_21)', () => {
    it('actualiza los datos y devuelve la ficha actualizada', async () => {
      const r = await api(e.app, e.productor.token)
        .patch(`/usuarios/${e.trabajador.id}`)
        .send({ nombre: 'Trabajador Renombrado', telefono: '+56900000000', rol: 'PRODUCTOR' });

      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({
        id: e.trabajador.id,
        nombre: 'Trabajador Renombrado',
        telefono: '+56900000000',
        rol: 'PRODUCTOR',
      });
      expect(r.body).not.toHaveProperty('passwordHash');
    });

    it('permite cambiar el correo y lo normaliza', async () => {
      const r = await api(e.app, e.productor.token)
        .patch(`/usuarios/${e.trabajador.id}`)
        .send({ email: 'NUEVO.Correo@Test.CL' });

      expect(r.status).toBe(200);
      expect(r.body.email).toBe('nuevo.correo@test.cl');
    });

    it('acepta reenviar el mismo correo del usuario sin marcarlo como duplicado', async () => {
      const r = await api(e.app, e.productor.token)
        .patch(`/usuarios/${e.trabajador.id}`)
        .send({ email: e.trabajador.email, nombre: 'Mismo Correo' });

      expect(r.status).toBe(200);
      expect(r.body.nombre).toBe('Mismo Correo');
    });

    it('rechaza el intento de cambiar el identificador con 409 IDENTIFICADOR_INMUTABLE', async () => {
      const r = await api(e.app, e.productor.token)
        .patch(`/usuarios/${e.trabajador.id}`)
        .send({ id: e.productor.id, nombre: 'Suplantador' });

      expect(r.status).toBe(409);
      expect(r.body.error.codigo).toBe('IDENTIFICADOR_INMUTABLE');

      const sinCambios = await prisma.usuario.findUniqueOrThrow({ where: { id: e.trabajador.id } });
      expect(sinCambios.nombre).toBe('Trabajador A');
    });

    it('no permite editar a un usuario inhabilitado (409 USUARIO_INHABILITADO)', async () => {
      const fuera = await crearUsuario({
        idPredio: e.predioA.id,
        email: 'inhabil@test.cl',
        estado: 'INHABILITADO',
      });

      const r = await api(e.app, e.productor.token)
        .patch(`/usuarios/${fuera.id}`)
        .send({ nombre: 'No se puede' });

      expect(r.status).toBe(409);
      expect(r.body.error.codigo).toBe('USUARIO_INHABILITADO');
      expect(r.body.error.mensaje).toBe('No se puede editar un usuario inhabilitado.');
    });

    it('rechaza un correo que ya usa otro usuario (409 EMAIL_DUPLICADO)', async () => {
      const r = await api(e.app, e.productor.token)
        .patch(`/usuarios/${e.trabajador.id}`)
        .send({ email: e.productor.email });

      expect(r.status).toBe(409);
      expect(r.body.error.codigo).toBe('EMAIL_DUPLICADO');
    });

    it('exige al menos un campo para actualizar', async () => {
      const r = await api(e.app, e.productor.token).patch(`/usuarios/${e.trabajador.id}`).send({});

      expect(r.status).toBe(400);
      expect(r.body.error.codigo).toBe('VALIDACION');
    });

    it('responde 404 si el usuario es de otro predio (RNF_08)', async () => {
      const r = await api(e.app, e.ajeno.token)
        .patch(`/usuarios/${e.trabajador.id}`)
        .send({ nombre: 'Intromisión' });

      expect(r.status).toBe(404);
      const sinCambios = await prisma.usuario.findUniqueOrThrow({ where: { id: e.trabajador.id } });
      expect(sinCambios.nombre).toBe('Trabajador A');
    });

    it('responde 403 a un Trabajador', async () => {
      const r = await api(e.app, e.trabajador.token)
        .patch(`/usuarios/${e.trabajador.id}`)
        .send({ nombre: 'Yo mismo' });

      expect(r.status).toBe(403);
    });

    it('responde 401 sin token', async () => {
      const r = await api(e.app).patch(`/usuarios/${e.trabajador.id}`).send({ nombre: 'Anónimo' });
      expect(r.status).toBe(401);
    });
  });

  describe('POST /usuarios/:id/inhabilitar — inhabilitar (RF_22)', () => {
    it('cambia el estado a INHABILITADO y devuelve la ficha actualizada', async () => {
      const r = await api(e.app, e.productor.token).post(
        `/usuarios/${e.trabajador.id}/inhabilitar`,
      );

      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ id: e.trabajador.id, estado: 'INHABILITADO' });
      expect(r.body).not.toHaveProperty('passwordHash');
    });

    it('no borra al usuario ni su histórico', async () => {
      const animal = await crearAnimal({
        idPredio: e.predioA.id,
        idRegistrador: e.trabajador.id,
        numeroOreja: '0777',
      });

      await api(e.app, e.productor.token).post(`/usuarios/${e.trabajador.id}/inhabilitar`);

      const usuario = await prisma.usuario.findUnique({ where: { id: e.trabajador.id } });
      expect(usuario).not.toBeNull();
      expect(usuario?.estado).toBe('INHABILITADO');

      const registrado = await prisma.animal.findUnique({ where: { id: animal.id } });
      expect(registrado?.idRegistrador).toBe(e.trabajador.id);
    });

    it('revoca las sesiones abiertas del usuario', async () => {
      const sesion = await api(e.app)
        .post('/auth/login')
        .send({ email: e.trabajador.email, password: PASSWORD });
      expect(sesion.status).toBe(200);

      await api(e.app, e.productor.token).post(`/usuarios/${e.trabajador.id}/inhabilitar`);

      const refresco = await api(e.app)
        .post('/auth/refresh')
        .send({ refreshToken: sesion.body.refreshToken });
      expect(refresco.status).toBe(401);

      const relogin = await api(e.app)
        .post('/auth/login')
        .send({ email: e.trabajador.email, password: PASSWORD });
      expect(relogin.status).toBe(401);
      expect(relogin.body.error.codigo).toBe('USUARIO_INHABILITADO');
    });

    it('rechaza inhabilitar a quien ya está inhabilitado (409 USUARIO_YA_INHABILITADO)', async () => {
      await api(e.app, e.productor.token).post(`/usuarios/${e.trabajador.id}/inhabilitar`);

      const r = await api(e.app, e.productor.token).post(
        `/usuarios/${e.trabajador.id}/inhabilitar`,
      );

      expect(r.status).toBe(409);
      expect(r.body.error.codigo).toBe('USUARIO_YA_INHABILITADO');
    });

    it('no permite que el Productor se inhabilite a sí mismo (422 AUTOINHABILITACION)', async () => {
      const r = await api(e.app, e.productor.token).post(
        `/usuarios/${e.productor.id}/inhabilitar`,
      );

      expect(r.status).toBe(422);
      expect(r.body.error.codigo).toBe('AUTOINHABILITACION');
      expect(r.body.error.mensaje).toBe('No puedes inhabilitar tu propia cuenta.');
    });

    it('no deja al predio sin ningún Productor habilitado (422 ULTIMO_PRODUCTOR)', async () => {
      // Con dos productores, el segundo puede inhabilitar al primero. El token de
      // acceso del inhabilitado sigue vigente unos minutos, y con el se intenta
      // inhabilitar al unico Productor que queda: ahi es donde la regla protege
      // al predio de quedarse sin quien lo administre.
      const segundo = await crearUsuario({
        idPredio: e.predioA.id,
        email: 'productor2@test.cl',
        nombre: 'Productor Segundo',
        rol: 'PRODUCTOR',
      });
      const tokenSegundo = await iniciarSesion(e.app, segundo.email);

      const primera = await api(e.app, tokenSegundo).post(
        `/usuarios/${e.productor.id}/inhabilitar`,
      );
      expect(primera.status).toBe(200);

      const r = await api(e.app, e.productor.token).post(`/usuarios/${segundo.id}/inhabilitar`);

      expect(r.status).toBe(422);
      expect(r.body.error.codigo).toBe('ULTIMO_PRODUCTOR');
      expect(r.body.error.mensaje).toBe('El predio debe conservar al menos un Productor habilitado.');

      const sigueHabilitado = await prisma.usuario.findUniqueOrThrow({ where: { id: segundo.id } });
      expect(sigueHabilitado.estado).toBe('HABILITADO');
    });

    it('responde 404 si el usuario es de otro predio (RNF_08)', async () => {
      const r = await api(e.app, e.ajeno.token).post(`/usuarios/${e.trabajador.id}/inhabilitar`);

      expect(r.status).toBe(404);
      const sinCambios = await prisma.usuario.findUniqueOrThrow({ where: { id: e.trabajador.id } });
      expect(sinCambios.estado).toBe('HABILITADO');
    });

    it('responde 403 a un Trabajador', async () => {
      const r = await api(e.app, e.trabajador.token).post(
        `/usuarios/${e.productor.id}/inhabilitar`,
      );
      expect(r.status).toBe(403);
    });

    it('responde 401 sin token', async () => {
      const r = await api(e.app).post(`/usuarios/${e.trabajador.id}/inhabilitar`);
      expect(r.status).toBe(401);
    });
  });
});

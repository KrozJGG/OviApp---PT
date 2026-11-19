import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '../../config/env';
import { firmarAcceso } from '../../middleware/autenticar';
import type { ContextoUsuario } from '../../shared/contexto';
import { prisma } from '../../shared/db';
import { ErrorConflicto, ErrorNoAutenticado } from '../../shared/errores';
import type { DatosRegistro } from './auth.esquemas';

/**
 * Autenticación — IF6-ENT y H13 del plan.
 *
 * Se emiten dos tokens: uno de acceso corto (JWT, sin estado) y uno de refresco
 * largo (opaco, guardado hasheado). El refresco existe porque RNF_04 pide una
 * app que no exija reiniciar sesión a cada rato, y guardarlo en base es lo que
 * permite revocarlo en el logout y al inhabilitar a un usuario (RF_22).
 */

export interface Sesion {
  accessToken: string;
  refreshToken: string;
  expiraEn: string;
  usuario: {
    id: string;
    nombre: string;
    email: string;
    rol: string;
    idPredio: string;
    predio: string;
    fotoUrl: string | null;
  };
}

/** Mismo mensaje para correo inexistente y contraseña incorrecta: si no, el
 *  endpoint se convierte en un verificador de qué correos existen. */
const CREDENCIALES = 'El correo o la contraseña no son correctos.';

export async function login(email: string, password: string): Promise<Sesion> {
  const usuario = await prisma.usuario.findUnique({
    where: { email: email.toLowerCase() },
    include: { predio: { select: { nombre: true } } },
  });

  if (!usuario) {
    // Se compara igual contra un hash ficticio para que el tiempo de respuesta
    // no delate si el correo existe.
    await bcrypt.compare(password, '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin');
    throw new ErrorNoAutenticado('CREDENCIALES_INVALIDAS', CREDENCIALES);
  }

  if (!(await bcrypt.compare(password, usuario.passwordHash))) {
    throw new ErrorNoAutenticado('CREDENCIALES_INVALIDAS', CREDENCIALES);
  }

  // RF_22 — inhabilitar revoca el acceso sin borrar el historial.
  if (usuario.estado === 'INHABILITADO') {
    throw new ErrorNoAutenticado(
      'USUARIO_INHABILITADO',
      'Tu cuenta fue inhabilitada. Contacta al productor del predio.',
    );
  }

  const ctx: ContextoUsuario = {
    idUsuario: usuario.id,
    idPredio: usuario.idPredio,
    rol: usuario.rol,
    email: usuario.email,
  };

  return {
    accessToken: firmarAcceso(ctx),
    refreshToken: await emitirRefresh(usuario.id),
    expiraEn: env.JWT_ACCESS_TTL,
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      idPredio: usuario.idPredio,
      predio: usuario.predio.nombre,
      fotoUrl: usuario.fotoUrl,
    },
  };
}

/**
 * Alta inicial del predio y su productor titular (con trabajadores opcionales).
 * Todo ocurre en una única transacción para no dejar predios huérfanos si falla
 * un correo duplicado, y devuelve la sesión iniciada del productor titular.
 */
export async function registrar(datos: DatosRegistro): Promise<Sesion> {
  const correosSolicitados = [
    datos.email,
    ...datos.trabajadores.map((t) => t.email),
  ];

  if (new Set(correosSolicitados).size !== correosSolicitados.length) {
    throw new ErrorConflicto(
      'EMAIL_DUPLICADO',
      'No puedes repetir el mismo correo electrónico entre los usuarios.',
    );
  }

  const existente = await prisma.usuario.findFirst({
    where: { email: { in: correosSolicitados } },
    select: { id: true },
  });
  if (existente) {
    throw new ErrorConflicto(
      'EMAIL_DUPLICADO',
      'Ya existe un usuario registrado con ese correo electrónico.',
    );
  }

  const nombrePredioLimpio = datos.predio?.nombre?.trim();
  const nombrePredio =
    nombrePredioLimpio && nombrePredioLimpio.length > 0
      ? nombrePredioLimpio
      : `Predio de ${datos.nombre}`;

  const ubicacionPredioLimpia = datos.predio?.ubicacion?.trim();
  const ubicacionPredio =
    ubicacionPredioLimpia && ubicacionPredioLimpia.length > 0
      ? ubicacionPredioLimpia
      : null;

  const [hashTitular, hashesTrabajadores] = await Promise.all([
    bcrypt.hash(datos.password, env.BCRYPT_ROUNDS),
    Promise.all(
      datos.trabajadores.map((t) => bcrypt.hash(t.password, env.BCRYPT_ROUNDS)),
    ),
  ]);

  let creado: {
    id: string;
    nombre: string;
    email: string;
    rol: 'PRODUCTOR' | 'TRABAJADOR';
    idPredio: string;
    fotoUrl: string | null;
    predioNombre: string;
  };

  try {
    creado = await prisma.$transaction(async (tx) => {
      const predio = await tx.predio.create({
        data: {
          nombre: nombrePredio,
          ubicacion: ubicacionPredio,
        },
      });

      const titular = await tx.usuario.create({
        data: {
          idPredio: predio.id,
          nombre: datos.nombre,
          email: datos.email,
          passwordHash: hashTitular,
          rol: 'PRODUCTOR',
          rut: datos.rut || null,
          telefono: datos.telefono || null,
        },
      });

      if (datos.trabajadores.length > 0) {
        await tx.usuario.createMany({
          data: datos.trabajadores.map((t, idx) => ({
            idPredio: predio.id,
            nombre: t.nombre,
            email: t.email,
            passwordHash: hashesTrabajadores[idx]!,
            rol: t.rol ?? 'TRABAJADOR',
            rut: t.rut || null,
            telefono: t.telefono || null,
          })),
        });
      }

      return {
        id: titular.id,
        nombre: titular.nombre,
        email: titular.email,
        rol: titular.rol,
        idPredio: predio.id,
        fotoUrl: titular.fotoUrl,
        predioNombre: predio.nombre,
      };
    });
  } catch (e) {
    if (esUnicidadEmail(e)) {
      throw new ErrorConflicto(
        'EMAIL_DUPLICADO',
        'Ya existe un usuario registrado con ese correo electrónico.',
      );
    }
    throw e;
  }

  const ctx: ContextoUsuario = {
    idUsuario: creado.id,
    idPredio: creado.idPredio,
    rol: creado.rol,
    email: creado.email,
  };

  return {
    accessToken: firmarAcceso(ctx),
    refreshToken: await emitirRefresh(creado.id),
    expiraEn: env.JWT_ACCESS_TTL,
    usuario: {
      id: creado.id,
      nombre: creado.nombre,
      email: creado.email,
      rol: creado.rol,
      idPredio: creado.idPredio,
      predio: creado.predioNombre,
      fotoUrl: creado.fotoUrl,
    },
  };
}

/**
 * Rotación: cada uso consume el token de refresco y entrega uno nuevo. Si
 * alguien reutiliza uno ya consumido, no obtiene sesión.
 */
export async function refrescar(refreshToken: string): Promise<Sesion> {
  const hash = hashear(refreshToken);

  const guardado = await prisma.refreshToken.findUnique({
    where: { tokenHash: hash },
    include: { usuario: { include: { predio: { select: { nombre: true } } } } },
  });

  const invalido = new ErrorNoAutenticado('TOKEN_INVALIDO', 'Tu sesión expiró. Vuelve a iniciar sesión.');

  if (!guardado || guardado.revocadoEn !== null || guardado.expiraEn < new Date()) {
    throw invalido;
  }
  if (guardado.usuario.estado === 'INHABILITADO') {
    throw new ErrorNoAutenticado(
      'USUARIO_INHABILITADO',
      'Tu cuenta fue inhabilitada. Contacta al productor del predio.',
    );
  }

  const usuario = guardado.usuario;

  const [, nuevoRefresh] = await Promise.all([
    prisma.refreshToken.update({
      where: { id: guardado.id },
      data: { revocadoEn: new Date() },
    }),
    emitirRefresh(usuario.id),
  ]);

  return {
    accessToken: firmarAcceso({
      idUsuario: usuario.id,
      idPredio: usuario.idPredio,
      rol: usuario.rol,
      email: usuario.email,
    }),
    refreshToken: nuevoRefresh,
    expiraEn: env.JWT_ACCESS_TTL,
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      idPredio: usuario.idPredio,
      predio: usuario.predio.nombre,
      fotoUrl: usuario.fotoUrl,
    },
  };
}

/** Cierra la sesión: revoca el refresco y descarta el token push del equipo. */
export async function logout(idUsuario: string, refreshToken?: string): Promise<void> {
  if (refreshToken) {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashear(refreshToken), idUsuario, revocadoEn: null },
      data: { revocadoEn: new Date() },
    });
  } else {
    // Sin token explícito se cierran todas las sesiones del usuario.
    await prisma.refreshToken.updateMany({
      where: { idUsuario, revocadoEn: null },
      data: { revocadoEn: new Date() },
    });
  }
}

/** RF_22 — al inhabilitar a alguien hay que echarlo de sus sesiones abiertas. */
export async function revocarSesionesDe(idUsuario: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { idUsuario, revocadoEn: null },
    data: { revocadoEn: new Date() },
  });
}

async function emitirRefresh(idUsuario: string): Promise<string> {
  const token = randomBytes(48).toString('base64url');
  const expiraEn = new Date(Date.now() + env.JWT_REFRESH_TTL_DIAS * 86_400_000);

  await prisma.refreshToken.create({
    data: { idUsuario, tokenHash: hashear(token), expiraEn },
  });

  return token;
}

/**
 * SHA-256 y no bcrypt: el token ya es aleatorio de 48 bytes, no hay nada que
 * derivar por fuerza bruta, y el refresco se valida en cada renovación — un
 * hash lento ahí sería un costo sin beneficio.
 */
function hashear(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function esUnicidadEmail(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false;
  if ((e as { code?: unknown }).code !== 'P2002') return false;
  const destino = (e as { meta?: { target?: unknown } }).meta?.target;
  if (destino === undefined) return true;
  return Array.isArray(destino) ? destino.includes('email') : String(destino).includes('email');
}

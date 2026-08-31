import bcrypt from 'bcryptjs';
import { env } from '../../config/env';
import type { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../shared/db';
import { ErrorConflicto, ErrorNoEncontrado, ErrorReglaNegocio } from '../../shared/errores';
import { aSkipTake, paginar, type Paginado } from '../../shared/paginacion';
import { revocarSesionesDe } from '../auth/auth.servicio';
import type { DatosCrearUsuario, DatosEditarUsuario, FiltrosUsuarios } from './usuarios.esquemas';

/**
 * Modulo 7 - Administracion. Reglas de RF_20, RF_21 y RF_22.
 *
 * Todas las funciones reciben el `idPredio` del token y filtran por el: un
 * usuario de otro predio se trata como inexistente (404) y nunca como prohibido,
 * porque distinguirlos revelaria que existe (RNF_08).
 */

const MENSAJE_EMAIL_DUPLICADO = 'Ya existe un usuario registrado con ese correo electrónico.';
const MENSAJE_NO_ENCONTRADO = 'No se encontró el usuario solicitado.';

/** Proyeccion publica del usuario: el hash de la contrasena jamas sale de aqui. */
const CAMPOS_DTO = {
  id: true,
  nombre: true,
  email: true,
  rut: true,
  telefono: true,
  fotoUrl: true,
  rol: true,
  estado: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type UsuarioDto = Prisma.UsuarioGetPayload<{ select: typeof CAMPOS_DTO }>;

/** RF_20 - Registrar nuevo usuario. Se crea siempre en el predio del token. */
export async function crearUsuario(idPredio: string, datos: DatosCrearUsuario): Promise<UsuarioDto> {
  // La unicidad del correo es global, no por predio: se comprueba antes para
  // poder dar el mensaje correcto en vez del 409 generico de la base.
  const existente = await prisma.usuario.findUnique({
    where: { email: datos.email },
    select: { id: true },
  });
  if (existente) {
    throw new ErrorConflicto('EMAIL_DUPLICADO', MENSAJE_EMAIL_DUPLICADO);
  }

  try {
    return await prisma.usuario.create({
      data: {
        idPredio,
        nombre: datos.nombre,
        email: datos.email,
        passwordHash: await bcrypt.hash(datos.password, env.BCRYPT_ROUNDS),
        rol: datos.rol,
        rut: datos.rut ?? null,
        telefono: datos.telefono ?? null,
      },
      select: CAMPOS_DTO,
    });
  } catch (e) {
    // Dos altas simultaneas con el mismo correo: la base es el arbitro final.
    if (esUnicidadEmail(e)) {
      throw new ErrorConflicto('EMAIL_DUPLICADO', MENSAJE_EMAIL_DUPLICADO);
    }
    throw e;
  }
}

/** Listado de los usuarios del predio, ordenado por nombre. */
export async function listarUsuarios(
  idPredio: string,
  filtros: FiltrosUsuarios,
): Promise<Paginado<UsuarioDto>> {
  const where: Prisma.UsuarioWhereInput = {
    idPredio,
    ...(filtros.rol ? { rol: filtros.rol } : {}),
    ...(filtros.estado ? { estado: filtros.estado } : {}),
    ...(filtros.q
      ? {
          OR: [
            { nombre: { contains: filtros.q, mode: 'insensitive' as const } },
            { email: { contains: filtros.q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [filas, total] = await Promise.all([
    prisma.usuario.findMany({
      where,
      select: CAMPOS_DTO,
      orderBy: { nombre: 'asc' },
      ...aSkipTake(filtros),
    }),
    prisma.usuario.count({ where }),
  ]);

  return paginar(filas, total, filtros);
}

export async function obtenerUsuario(idPredio: string, id: string): Promise<UsuarioDto> {
  const usuario = await prisma.usuario.findFirst({ where: { id, idPredio }, select: CAMPOS_DTO });
  if (!usuario) {
    throw new ErrorNoEncontrado(MENSAJE_NO_ENCONTRADO);
  }
  return usuario;
}

/**
 * RF_21 - El identificador unico del usuario no se edita.
 * Se responde 409 y no 400 porque el dato en si es valido: lo que no se permite
 * es cambiarlo.
 */
export function verificarIdentificadorInmutable(cuerpo: unknown): void {
  if (typeof cuerpo === 'object' && cuerpo !== null && 'id' in cuerpo) {
    throw new ErrorConflicto(
      'IDENTIFICADOR_INMUTABLE',
      'El identificador del usuario no se puede modificar.',
    );
  }
}

/** RF_21 - Editar informacion de usuario. Solo si esta habilitado. */
export async function editarUsuario(
  idPredio: string,
  id: string,
  datos: DatosEditarUsuario,
): Promise<UsuarioDto> {
  const actual = await prisma.usuario.findFirst({
    where: { id, idPredio },
    select: { id: true, estado: true },
  });
  if (!actual) {
    throw new ErrorNoEncontrado(MENSAJE_NO_ENCONTRADO);
  }

  // RF_21 - "solo permite la edicion si el usuario esta habilitado".
  if (actual.estado === 'INHABILITADO') {
    throw new ErrorConflicto('USUARIO_INHABILITADO', 'No se puede editar un usuario inhabilitado.');
  }

  if (datos.email !== undefined) {
    const duenoDelCorreo = await prisma.usuario.findUnique({
      where: { email: datos.email },
      select: { id: true },
    });
    if (duenoDelCorreo && duenoDelCorreo.id !== id) {
      throw new ErrorConflicto('EMAIL_DUPLICADO', MENSAJE_EMAIL_DUPLICADO);
    }
  }

  try {
    return await prisma.usuario.update({
      where: { id },
      data: {
        ...(datos.nombre === undefined ? {} : { nombre: datos.nombre }),
        ...(datos.email === undefined ? {} : { email: datos.email }),
        ...(datos.rol === undefined ? {} : { rol: datos.rol }),
        ...(datos.rut === undefined ? {} : { rut: datos.rut }),
        ...(datos.telefono === undefined ? {} : { telefono: datos.telefono }),
      },
      select: CAMPOS_DTO,
    });
  } catch (e) {
    if (esUnicidadEmail(e)) {
      throw new ErrorConflicto('EMAIL_DUPLICADO', MENSAJE_EMAIL_DUPLICADO);
    }
    throw e;
  }
}

/**
 * RF_22 - Inhabilitar usuario.
 *
 * No se borra nada: el historico (animales registrados, bitacora, tareas) queda
 * intacto y solo se corta el acceso. Las comprobaciones y el cambio de estado
 * van en una misma transaccion para que dos inhabilitaciones simultaneas no
 * puedan dejar al predio sin ningun Productor habilitado.
 */
export async function inhabilitarUsuario(
  idPredio: string,
  idSolicitante: string,
  id: string,
): Promise<UsuarioDto> {
  const actualizado = await prisma.$transaction(async (tx) => {
    const objetivo = await tx.usuario.findFirst({
      where: { id, idPredio },
      select: { id: true, rol: true, estado: true },
    });
    if (!objetivo) {
      throw new ErrorNoEncontrado(MENSAJE_NO_ENCONTRADO);
    }

    if (objetivo.id === idSolicitante) {
      throw new ErrorReglaNegocio('AUTOINHABILITACION', 'No puedes inhabilitar tu propia cuenta.');
    }

    if (objetivo.estado === 'INHABILITADO') {
      throw new ErrorConflicto('USUARIO_YA_INHABILITADO', 'El usuario ya está inhabilitado.');
    }

    if (objetivo.rol === 'PRODUCTOR') {
      const otrosProductores = await tx.usuario.count({
        where: { idPredio, rol: 'PRODUCTOR', estado: 'HABILITADO', id: { not: id } },
      });
      if (otrosProductores === 0) {
        throw new ErrorReglaNegocio(
          'ULTIMO_PRODUCTOR',
          'El predio debe conservar al menos un Productor habilitado.',
        );
      }
    }

    return tx.usuario.update({
      where: { id },
      data: { estado: 'INHABILITADO' },
      select: CAMPOS_DTO,
    });
  });

  // El corte de acceso tiene que ser inmediato: si no, quien ya tenia la sesion
  // abierta seguiria renovandola hasta que caducara su token de refresco.
  await revocarSesionesDe(id);

  return actualizado;
}

/** true si el error de Prisma es la violacion de unicidad del correo. */
function esUnicidadEmail(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false;
  if ((e as { code?: unknown }).code !== 'P2002') return false;
  const destino = (e as { meta?: { target?: unknown } }).meta?.target;
  if (destino === undefined) return true;
  return Array.isArray(destino) ? destino.includes('email') : String(destino).includes('email');
}

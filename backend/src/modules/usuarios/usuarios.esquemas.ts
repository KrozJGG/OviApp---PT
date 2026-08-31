import { z } from 'zod';
import { esquemaPaginacion } from '../../shared/paginacion';

/**
 * Modulo 7 - Administracion (RF_20, RF_21, RF_22).
 *
 * El predio NUNCA se acepta desde el cuerpo: sale siempre del token (RNF_08),
 * asi que no aparece en ninguno de estos esquemas.
 */

/** Correo normalizado: se recorta y se pasa a minusculas antes de validarlo. */
const campoEmail = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('El correo electrónico no es válido.'));

const campoNombre = z
  .string()
  .trim()
  .min(2, 'El nombre debe tener al menos 2 caracteres.')
  .max(120, 'El nombre no puede superar los 120 caracteres.');

const campoPassword = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .max(72, 'La contraseña no puede superar los 72 caracteres.');

const campoRol = z.enum(['PRODUCTOR', 'TRABAJADOR'], {
  message: 'El rol debe ser PRODUCTOR o TRABAJADOR.',
});

/** Opcionales que ademas se pueden vaciar mandando null (RF_21). */
const campoRut = z.string().trim().max(20, 'El RUT no puede superar los 20 caracteres.').nullish();
const campoTelefono = z
  .string()
  .trim()
  .max(30, 'El teléfono no puede superar los 30 caracteres.')
  .nullish();

/** RF_20 - Registrar nuevo usuario. */
export const esquemaCrearUsuario = z.object({
  nombre: campoNombre,
  email: campoEmail,
  password: campoPassword,
  rol: campoRol,
  rut: campoRut,
  telefono: campoTelefono,
});

export type DatosCrearUsuario = z.infer<typeof esquemaCrearUsuario>;

/**
 * RF_21 - Editar informacion de usuario.
 * `id` y `estado` quedan fuera a proposito: el identificador es inmutable y el
 * estado solo cambia por la accion de inhabilitar (RF_22).
 */
export const esquemaEditarUsuario = z
  .object({
    nombre: campoNombre.optional(),
    email: campoEmail.optional(),
    rol: campoRol.optional(),
    rut: campoRut,
    telefono: campoTelefono,
  })
  .refine((datos) => Object.values(datos).some((v) => v !== undefined), {
    message: 'Debes enviar al menos un campo para actualizar.',
  });

export type DatosEditarUsuario = z.infer<typeof esquemaEditarUsuario>;

/** Filtros del listado del predio. */
export const esquemaListarUsuarios = esquemaPaginacion.extend({
  rol: campoRol.optional(),
  estado: z
    .enum(['HABILITADO', 'INHABILITADO'], {
      message: 'El estado debe ser HABILITADO o INHABILITADO.',
    })
    .optional(),
  q: z.string().trim().min(1).max(120).optional(),
});

export type FiltrosUsuarios = z.infer<typeof esquemaListarUsuarios>;

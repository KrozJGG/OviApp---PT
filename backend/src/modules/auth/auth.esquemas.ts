import { z } from 'zod';

const campoEmail = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Ingresa un correo electrónico válido.'));

const campoNombre = z
  .string()
  .trim()
  .min(2, 'El nombre debe tener al menos 2 caracteres.')
  .max(120, 'El nombre no puede superar los 120 caracteres.');

const campoPasswordNuevo = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .max(72, 'La contraseña no puede superar los 72 caracteres.');

const campoRut = z.string().trim().max(20, 'El RUT no puede superar los 20 caracteres.').nullish();
const campoTelefono = z
  .string()
  .trim()
  .max(30, 'El teléfono no puede superar los 30 caracteres.')
  .nullish();

export const esquemaLogin = z.object({
  email: z.email('Ingresa un correo electrónico válido.').trim().toLowerCase(),
  password: z.string().min(1, 'Ingresa tu contraseña.'),
});

export type DatosLogin = z.infer<typeof esquemaLogin>;

export const esquemaTrabajadorRegistro = z.object({
  nombre: campoNombre,
  email: campoEmail,
  password: campoPasswordNuevo,
  rol: z
    .enum(['PRODUCTOR', 'TRABAJADOR'], {
      message: 'El rol debe ser PRODUCTOR o TRABAJADOR.',
    })
    .default('TRABAJADOR'),
  rut: campoRut,
  telefono: campoTelefono,
});

export const esquemaRegistro = z.object({
  nombre: campoNombre,
  email: campoEmail,
  password: campoPasswordNuevo,
  rut: campoRut,
  telefono: campoTelefono,
  predio: z
    .object({
      nombre: z
        .string()
        .trim()
        .max(120, 'El nombre del predio no puede superar los 120 caracteres.')
        .nullish(),
      ubicacion: z
        .string()
        .trim()
        .max(160, 'La ubicación no puede superar los 160 caracteres.')
        .nullish(),
    })
    .optional(),
  trabajadores: z
    .array(esquemaTrabajadorRegistro)
    .max(25, 'Puedes registrar hasta 25 trabajadores en el alta inicial.')
    .default([]),
});

export type DatosRegistro = z.infer<typeof esquemaRegistro>;

export const esquemaRefresh = z.object({
  refreshToken: z.string().min(20, 'El token de sesión no es válido.'),
});

export const esquemaLogout = z.object({
  refreshToken: z.string().min(20).optional(),
});

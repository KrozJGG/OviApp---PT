import { z } from 'zod';

export const esquemaLogin = z.object({
  email: z.email('Ingresa un correo electrónico válido.').trim().toLowerCase(),
  password: z.string().min(1, 'Ingresa tu contraseña.'),
});

export type DatosLogin = z.infer<typeof esquemaLogin>;

export const esquemaRefresh = z.object({
  refreshToken: z.string().min(20, 'El token de sesión no es válido.'),
});

export const esquemaLogout = z.object({
  refreshToken: z.string().min(20).optional(),
});

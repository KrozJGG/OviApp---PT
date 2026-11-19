import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { esTest } from '../../config/env';
import { autenticar } from '../../middleware/autenticar';
import { ctxDe } from '../../shared/contexto';
import { prisma } from '../../shared/db';
import { ErrorNoEncontrado } from '../../shared/errores';
import { validarCuerpo } from '../../shared/validacion';
import { esquemaLogin, esquemaLogout, esquemaRefresh, esquemaRegistro } from './auth.esquemas';
import { login, logout, refrescar, registrar } from './auth.servicio';

/** Sesión — IF6-ENT y RF_00 (H13 del plan). */
export const enrutadorAuth = Router();

/**
 * RNF_03 — el login y el registro son los endpoints públicos que reciben credenciales,
 * así que conviene limitarlos por IP. Se desactiva en tests para que
 * la suite pueda hacer decenas de solicitudes seguidas.
 */
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => esTest,
  message: {
    error: {
      codigo: 'DEMASIADOS_INTENTOS',
      mensaje: 'Demasiados intentos de inicio de sesión. Espera unos minutos.',
    },
  },
});

enrutadorAuth.post('/login', limiteLogin, async (req: Request, res: Response) => {
  const datos = validarCuerpo(esquemaLogin, req);
  res.json(await login(datos.email, datos.password));
});

enrutadorAuth.post('/registro', limiteLogin, async (req: Request, res: Response) => {
  const datos = validarCuerpo(esquemaRegistro, req);
  res.status(201).json(await registrar(datos));
});

enrutadorAuth.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = validarCuerpo(esquemaRefresh, req);
  res.json(await refrescar(refreshToken));
});

enrutadorAuth.post('/logout', autenticar, async (req: Request, res: Response) => {
  const ctx = ctxDe(req);
  const { refreshToken } = validarCuerpo(esquemaLogout, req);
  await logout(ctx.idUsuario, refreshToken);
  res.status(204).end();
});

/** Perfil del usuario en sesión: alimenta los guards por rol de la app. */
enrutadorAuth.get('/me', autenticar, async (req: Request, res: Response) => {
  const ctx = ctxDe(req);

  const usuario = await prisma.usuario.findUnique({
    where: { id: ctx.idUsuario },
    include: { predio: { select: { id: true, nombre: true, ubicacion: true } } },
  });

  if (!usuario || usuario.estado === 'INHABILITADO') {
    throw new ErrorNoEncontrado('No se encontró el usuario de la sesión.');
  }

  res.json({
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rut: usuario.rut,
    telefono: usuario.telefono,
    fotoUrl: usuario.fotoUrl,
    rol: usuario.rol,
    estado: usuario.estado,
    predio: usuario.predio,
  });
});

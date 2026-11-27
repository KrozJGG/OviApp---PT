import cors from 'cors';
import express, { type Express, type Request, type Response } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env, esTest } from './config/env';
import { logger } from './config/logger';
import { manejadorErrores, noEncontrado } from './middleware/manejadorErrores';

import { enrutadorAgenda, enrutadorInicio } from './modules/agenda/agenda.rutas';
import {
  enrutadorAlertas,
  enrutadorEdge,
  enrutadorVigilancia,
} from './modules/alertas/alertas.rutas';
import { enrutadorAnimales } from './modules/animales/animales.rutas';
import { enrutadorAuth } from './modules/auth/auth.rutas';
import { enrutadorBitacora } from './modules/bitacora/bitacora.rutas';
import { enrutadorEventos } from './modules/eventos/eventos.rutas';
import { enrutadorDispositivosPush } from './modules/notificaciones/dispositivos.rutas';
import { enrutadorStreaming } from './modules/streaming/streaming.rutas';
import { enrutadorTareas } from './modules/tareas/tareas.rutas';
import { enrutadorUsuarios } from './modules/usuarios/usuarios.rutas';

export const PREFIJO_API = '/api/v1';

export function crearApp(): Express {
  const app = express();

  // Detras de un proxy (Railway, Render, Nginx) para que el rate-limit y los
  // logs vean la IP real del cliente y no la del balanceador.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGINS === '*' ? true : env.CORS_ORIGINS.split(',').map((o) => o.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  if (!esTest) {
    app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));
  }

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ estado: 'ok', servicio: 'oviapp-api', entorno: env.NODE_ENV });
  });

  const api = express.Router();

  // Sesion y perfil (IF6-ENT, H13)
  api.use('/auth', enrutadorAuth);
  api.use('/dispositivos-push', enrutadorDispositivosPush);

  // Modulo 7 - Administracion (RF_20 a RF_22)
  api.use('/usuarios', enrutadorUsuarios);

  // Modulo 1 - Ficha Animal (RF_01 a RF_04)
  api.use('/animales', enrutadorAnimales);
  // Modulo 2 - Bitacora (RF_05, RF_06). Comparte prefijo: sus rutas llevan un
  // segmento extra (/:idAnimal/bitacora), asi que no colisionan con las de arriba.
  api.use('/animales', enrutadorBitacora);

  // Modulo 3 - Organizador de eventos (RF_07 a RF_10)
  api.use('/eventos', enrutadorEventos);

  // Modulo 4 - Planificacion de actividades (RF_11 a RF_14)
  api.use('/tareas', enrutadorTareas);

  // Modulo 5 - Pantalla de inicio y calendario (RF_15, RF_16)
  api.use('/inicio', enrutadorInicio);
  api.use('/agenda', enrutadorAgenda);

  // Modulo 6 - Vigilancia y deteccion (RF_17 a RF_19)
  api.use('/edge', enrutadorEdge);
  api.use('/vigilancia', enrutadorVigilancia);
  api.use('/alertas', enrutadorAlertas);
  // Video en vivo de la camara: unica via de acceso, el puerto de MediaMTX no
  // se publica al host.
  api.use('/streaming', enrutadorStreaming);

  app.use(PREFIJO_API, api);

  app.use(noEncontrado);
  app.use(manejadorErrores);

  return app;
}

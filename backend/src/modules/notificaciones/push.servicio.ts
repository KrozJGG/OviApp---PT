import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { prisma } from '../../shared/db';

/**
 * Notificaciones push - RF_18, IF3-SAL, IF4-SAL.
 *
 * Firebase se carga de forma perezosa y solo si PUSH_HABILITADO es true. Si no
 * hay credencial configurada el envio se registra en el log y el flujo sigue:
 * una alerta debe quedar almacenada y consultable (RF_17, RF_19) aunque el
 * canal push no este disponible.
 */

export interface MensajePush {
  titulo: string;
  cuerpo: string;
  /** Datos que la app usa para el deep-link al abrir la notificacion. */
  datos: Record<string, string>;
}

export interface ResultadoEnvio {
  enviados: number;
  fallidos: number;
  omitido: boolean;
}

type Mensajeria = {
  sendEachForMulticast(mensaje: {
    tokens: string[];
    notification: { title: string; body: string };
    data: Record<string, string>;
    android: { priority: 'high' };
  }): Promise<{ successCount: number; failureCount: number; responses: Array<{ success: boolean; error?: { code: string } }> }>;
};

let mensajeria: Mensajeria | null | undefined;

async function obtenerMensajeria(): Promise<Mensajeria | null> {
  if (mensajeria !== undefined) return mensajeria;

  if (!env.PUSH_HABILITADO || !env.FIREBASE_CREDENCIALES_JSON) {
    mensajeria = null;
    return null;
  }

  try {
    // Import dinamico: firebase-admin solo se carga si realmente se va a usar.
    const { cert, getApp, getApps, initializeApp } = await import('firebase-admin/app');
    const { getMessaging } = await import('firebase-admin/messaging');

    const credencial = JSON.parse(env.FIREBASE_CREDENCIALES_JSON) as Record<string, unknown>;
    const app = getApps().length > 0
      ? getApp()
      : initializeApp({ credential: cert(credencial as never) });

    mensajeria = getMessaging(app) as unknown as Mensajeria;
    logger.info('Notificaciones push habilitadas (FCM).');
  } catch (e) {
    logger.error({ err: e }, 'No se pudo inicializar Firebase; las push quedan deshabilitadas.');
    mensajeria = null;
  }

  return mensajeria;
}

/** Envia a todos los dispositivos registrados de los usuarios indicados. */
export async function enviarAUsuarios(
  idUsuarios: string[],
  mensaje: MensajePush,
): Promise<ResultadoEnvio> {
  if (idUsuarios.length === 0) return { enviados: 0, fallidos: 0, omitido: true };

  const dispositivos = await prisma.dispositivoUsuario.findMany({
    where: { idUsuario: { in: idUsuarios } },
    select: { tokenPush: true },
  });
  const tokens = dispositivos.map((d) => d.tokenPush);
  if (tokens.length === 0) return { enviados: 0, fallidos: 0, omitido: true };

  const fcm = await obtenerMensajeria();
  if (!fcm) {
    logger.info({ tokens: tokens.length, titulo: mensaje.titulo }, 'Push omitida (FCM deshabilitado)');
    return { enviados: 0, fallidos: 0, omitido: true };
  }

  const respuesta = await fcm.sendEachForMulticast({
    tokens,
    notification: { title: mensaje.titulo, body: mensaje.cuerpo },
    data: mensaje.datos,
    android: { priority: 'high' },
  });

  // Un token invalido significa que la app se desinstalo o se reinstalo:
  // se limpia para que la tabla no acumule destinos muertos.
  const muertos = respuesta.responses
    .map((r, i) => ({ r, token: tokens[i]! }))
    .filter(({ r }) => !r.success && esTokenMuerto(r.error?.code))
    .map(({ token }) => token);

  if (muertos.length > 0) {
    await prisma.dispositivoUsuario.deleteMany({ where: { tokenPush: { in: muertos } } });
  }

  return {
    enviados: respuesta.successCount,
    fallidos: respuesta.failureCount,
    omitido: false,
  };
}

/** Todos los usuarios habilitados de un predio: destinatarios de RF_18. */
export async function usuariosDelPredio(idPredio: string): Promise<string[]> {
  const usuarios = await prisma.usuario.findMany({
    where: { idPredio, estado: 'HABILITADO' },
    select: { id: true },
  });
  return usuarios.map((u) => u.id);
}

function esTokenMuerto(codigo: string | undefined): boolean {
  return (
    codigo === 'messaging/registration-token-not-registered' ||
    codigo === 'messaging/invalid-registration-token' ||
    codigo === 'messaging/invalid-argument'
  );
}

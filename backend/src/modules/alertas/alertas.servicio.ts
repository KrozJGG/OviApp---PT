import { prisma } from '../../shared/db';
import type { DatosHeartbeat } from './alertas.esquemas';

/**
 * Reglas de negocio del Modulo 6 - Vigilancia y conteo de ovejas (IF2-SAL).
 *
 * La deteccion de ovejas corre en el dispositivo edge; el servidor recibe el
 * latido con el conteo actualizado y expone el estado operativo y conteo a la app.
 */

/**
 * Minutos sin latido tras los cuales un dispositivo se considera fuera de linea.
 *
 * El ia-engine late cada HEARTBEAT_INTERVALO_SEG (5s en docker-compose.yml);
 * 3 minutos tolera cortes transitorios de red sin marcar "Sin señal" de mas.
 */
export const MINUTOS_EN_LINEA = 3;

const MS_EN_LINEA = MINUTOS_EN_LINEA * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Latido de presencia y conteo del dispositivo (IF5-ENT)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /edge/heartbeat - el dispositivo informa que sigue vivo y reporta el
 * conteo mas reciente de ovejas detectadas para mantener IF2-SAL al dia.
 */
export async function registrarHeartbeat(
  idDispositivo: string,
  datos: DatosHeartbeat,
): Promise<void> {
  await tocarDispositivo(idDispositivo, datos.conteoActual);
}

/**
 * Aviso de apagado limpio del dispositivo edge (SIGTERM/SIGINT).
 *
 * Borra ultimoHeartbeat en vez de solo dejar de recibirlos: asi estaEnLinea()
 * pasa a false de inmediato, sin esperar los MINUTOS_EN_LINEA del timeout.
 * Solo cubre el apagado ordenado — un SIGKILL o corte de energia no llega a
 * avisar, y para esos casos sigue siendo el timeout la unica red de seguridad.
 */
export async function desconectarDispositivo(idDispositivo: string): Promise<void> {
  await prisma.dispositivoEdge.update({
    where: { id: idDispositivo },
    data: { ultimoHeartbeat: null },
  });
}

async function tocarDispositivo(
  idDispositivo: string,
  conteo: number | undefined,
): Promise<void> {
  await prisma.dispositivoEdge.update({
    where: { id: idDispositivo },
    data: {
      ultimoHeartbeat: new Date(),
      ...(conteo === undefined ? {} : { ultimoConteo: conteo }),
    },
    select: { id: true },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Estado de vigilancia (IF2-SAL)
// ─────────────────────────────────────────────────────────────────────────────

export interface DispositivoEstado {
  id: string;
  nombre: string;
  ultimoHeartbeat: Date | null;
  /// Mediana del conteo que envio el ia-engine en el ultimo heartbeat.
  ultimoConteo: number | null;
  /// Ovejas ACTIVAS registradas en el predio: contra esto se compara lo detectado.
  conteoEsperado: number;
  enLinea: boolean;
}

export interface EstadoVigilancia {
  dispositivos: DispositivoEstado[];
}

/** Un dispositivo esta en linea si latio dentro de los ultimos MINUTOS_EN_LINEA. */
export function estaEnLinea(ultimoHeartbeat: Date | null, ahora: Date = new Date()): boolean {
  if (!ultimoHeartbeat) return false;
  return ahora.getTime() - ultimoHeartbeat.getTime() <= MS_EN_LINEA;
}

/**
 * IF2-SAL - encabezado de la pantalla de vigilancia.
 *
 * El conteo esperado no es un valor fijo del dispositivo: son las ovejas que el
 * usuario tiene registradas como ACTIVAS. Asi, al dar de alta o de baja un
 * animal, la comparacion con lo que detecta la camara se ajusta sola.
 */
export async function estadoVigilancia(idPredio: string): Promise<EstadoVigilancia> {
  const [dispositivos, animalesActivos] = await Promise.all([
    prisma.dispositivoEdge.findMany({
      where: { idPredio },
      select: {
        id: true,
        nombre: true,
        ultimoHeartbeat: true,
        ultimoConteo: true,
      },
      orderBy: { nombre: 'asc' },
    }),
    prisma.animal.count({ where: { idPredio, estado: 'ACTIVO' } }),
  ]);

  const ahora = new Date();

  return {
    dispositivos: dispositivos.map((d) => ({
      ...d,
      conteoEsperado: animalesActivos,
      enLinea: estaEnLinea(d.ultimoHeartbeat, ahora),
    })),
  };
}

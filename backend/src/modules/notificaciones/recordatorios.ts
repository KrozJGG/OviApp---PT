import cron from 'node-cron';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { prisma } from '../../shared/db';
import { ZONA_HORARIA, aFechaSolo, fechaLocalISO, finDelDia, inicioDelDia, sumarDias } from '../../shared/fechas';
import { enviarAUsuarios, usuariosDelPredio } from './push.servicio';

/**
 * IF4-SAL - Recordatorio de evento calendarizado.
 *
 * Anticipacion segun la interfaz de salida de la tesis:
 *   24 h para eventos del Modulo Organizador
 *   48 h para hitos del Modulo de Planificacion
 *
 * Se ejecuta una vez al dia (CRON_RECORDATORIOS) en la zona del predio, no cada
 * hora: en terreno un aviso a las 08:00 del dia anterior es util, uno a las
 * 03:00 no lo es.
 */
export function iniciarRecordatorios(): () => void {
  if (!env.CRON_HABILITADO) {
    logger.info('Recordatorios programados deshabilitados (CRON_HABILITADO=false).');
    return () => undefined;
  }

  const tarea = cron.schedule(
    env.CRON_RECORDATORIOS,
    () => {
      void ejecutarRecordatorios().catch((err: unknown) => {
        logger.error({ err }, 'Fallo la ejecucion de recordatorios');
      });
    },
    { timezone: ZONA_HORARIA },
  );

  logger.info(`Recordatorios programados con "${env.CRON_RECORDATORIOS}" (${ZONA_HORARIA}).`);
  return () => {
    void tarea.stop();
  };
}

export interface ResumenRecordatorios {
  eventos: number;
  tareas: number;
}

export async function ejecutarRecordatorios(hoy = fechaLocalISO()): Promise<ResumenRecordatorios> {
  const [eventos, tareas] = await Promise.all([
    recordarEventos(sumarDias(hoy, 1)),
    recordarTareas(sumarDias(hoy, 2)),
  ]);
  logger.info({ eventos, tareas }, 'Recordatorios enviados');
  return { eventos, tareas };
}

/** Eventos programados para dentro de 24 h: avisa a todo el predio. */
async function recordarEventos(fechaObjetivo: string): Promise<number> {
  const eventos = await prisma.evento.findMany({
    where: {
      estado: 'PROGRAMADO',
      eliminadoEn: null,
      fechaInicio: { gte: inicioDelDia(fechaObjetivo), lt: finDelDia(fechaObjetivo) },
    },
    select: {
      id: true,
      idPredio: true,
      tipo: true,
      descripcion: true,
      fechaInicio: true,
      _count: { select: { animales: true } },
    },
  });

  for (const evento of eventos) {
    const destinatarios = await usuariosDelPredio(evento.idPredio);
    await enviarAUsuarios(destinatarios, {
      titulo: `Manana: ${etiqueta(evento.tipo)}`,
      cuerpo: evento._count.animales > 0
        ? `${evento._count.animales} animales involucrados. ${evento.descripcion ?? ''}`.trim()
        : (evento.descripcion ?? 'Evento programado para manana.'),
      datos: { tipo: 'RECORDATORIO_EVENTO', idEvento: evento.id },
    });
  }

  return eventos.length;
}

/** Tareas que vencen en 48 h: avisa solo a sus responsables. */
async function recordarTareas(fechaObjetivo: string): Promise<number> {
  const tareas = await prisma.tarea.findMany({
    where: { estado: 'ACTIVA', fechaLimite: aFechaSolo(fechaObjetivo) },
    select: {
      id: true,
      titulo: true,
      descripcion: true,
      responsables: { select: { idUsuario: true } },
    },
  });

  for (const tarea of tareas) {
    const destinatarios = tarea.responsables.map((r) => r.idUsuario);
    if (destinatarios.length === 0) continue;
    await enviarAUsuarios(destinatarios, {
      titulo: `Vence en 2 dias: ${tarea.titulo}`,
      cuerpo: tarea.descripcion ?? 'Tarea del predio pendiente.',
      datos: { tipo: 'RECORDATORIO_TAREA', idTarea: tarea.id },
    });
  }

  return tareas.length;
}

const ETIQUETAS: Record<string, string> = {
  ENCASTE: 'Encaste',
  ESQUILA: 'Esquila',
  ATENCION_SANITARIA: 'Atencion sanitaria',
  OTRO: 'Evento del predio',
};

function etiqueta(tipo: string): string {
  return ETIQUETAS[tipo] ?? tipo;
}

import { Prisma } from '../../generated/prisma/client';
import { emitirAPredio } from '../../realtime/socket';
import type { ContextoEdge, ContextoUsuario } from '../../shared/contexto';
import { prisma } from '../../shared/db';
import { ErrorConflicto, ErrorNoEncontrado } from '../../shared/errores';
import { finDelDia, inicioDelDia } from '../../shared/fechas';
import { aSkipTake, paginar, type Paginado } from '../../shared/paginacion';
import type {
  DatosCambiarEstadoAlerta,
  DatosHeartbeat,
  DatosRegionInteres,
  FiltrosListadoAlertas,
} from './alertas.esquemas';
import { redondearCoord } from './alertas.geometria';
import {
  aAlertaDto,
  evaluadorAlertasService,
  inclusionAlerta,
  type AlertaDto,
} from './evaluadorAlertas.servicio';

/**
 * Reglas de negocio del Modulo 6 - Vigilancia, conteo de ovejas y alertas (IF2-SAL).
 *
 * La deteccion de ovejas corre en el dispositivo edge; el servidor recibe el
 * latido con el conteo actualizado, evalua las reglas de alerta por falta de
 * ovejas (CONTEO) y expone el estado operativo y el historial a la app.
 */

/**
 * Minutos sin latido tras los cuales un dispositivo se considera fuera de linea.
 *
 * El ia-engine late cada HEARTBEAT_INTERVALO_SEG (5s en docker-compose.yml);
 * 3 minutos tolera cortes transitorios de red sin marcar "Sin señal" de mas.
 */
export const MINUTOS_EN_LINEA = 3;

const MS_EN_LINEA = MINUTOS_EN_LINEA * 60 * 1000;

export type { AlertaDto };

// ─────────────────────────────────────────────────────────────────────────────
// Latido de presencia y conteo del dispositivo (IF5-ENT)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /edge/heartbeat - el dispositivo informa que sigue vivo y reporta la
 * mediana del conteo de ovejas detectadas. Ademas de actualizar IF2-SAL,
 * evalua las alertas por deficit contra el conteo de animales ACTIVOS del predio.
 */
export async function registrarHeartbeat(
  edge: ContextoEdge,
  datos: DatosHeartbeat,
): Promise<void> {
  await tocarDispositivo(edge.idDispositivo, datos.conteoActual);

  if (datos.conteoActual !== undefined) {
    const conteoEsperado = await prisma.animal.count({
      where: { idPredio: edge.idPredio, estado: 'ACTIVO' },
    });

    await evaluadorAlertasService.evaluarConteo({
      idDispositivoEdge: edge.idDispositivo,
      idPredio: edge.idPredio,
      conteoDetectado: datos.conteoActual,
      conteoEsperado,
    });
  }
}

/**
 * Aviso de apagado limpio del dispositivo edge (SIGTERM/SIGINT).
 *
 * Borra ultimoHeartbeat en vez de solo dejar de recibirlos y reinicia los
 * contadores en memoria del evaluador (preservando alertas PENDIENTE en BD).
 */
export async function desconectarDispositivo(idDispositivo: string): Promise<void> {
  await prisma.dispositivoEdge.update({
    where: { id: idDispositivo },
    data: { ultimoHeartbeat: null },
  });
  evaluadorAlertasService.limpiarSeguimientoDispositivo(idDispositivo);
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
// Gestion e historial de alertas (RF_18 / RF_19)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /alertas - historial ordenado cronologicamente descendente, aislado por
 * `idPredio`, con filtros opcionales por estado y rango de fechas (hora local).
 */
export async function listarAlertas(
  idPredio: string,
  filtros: FiltrosListadoAlertas,
): Promise<Paginado<AlertaDto>> {
  const where: Prisma.AlertaWhereInput = {
    idPredio,
    ...(filtros.estado ? { estado: filtros.estado } : {}),
    ...(filtros.desde || filtros.hasta
      ? {
          fechaDeteccion: {
            ...(filtros.desde ? { gte: inicioDelDia(filtros.desde) } : {}),
            ...(filtros.hasta ? { lt: finDelDia(filtros.hasta) } : {}),
          },
        }
      : {}),
  };

  const [filas, total] = await Promise.all([
    prisma.alerta.findMany({
      where,
      include: inclusionAlerta,
      orderBy: [{ fechaDeteccion: 'desc' }, { createdAt: 'desc' }],
      ...aSkipTake(filtros),
    }),
    prisma.alerta.count({ where }),
  ]);

  return paginar(filas.map(aAlertaDto), total, filtros);
}

/**
 * PATCH /alertas/:id/estado - marca una alerta PENDIENTE como RESUELTA o DESCARTADA.
 * Accesible a PRODUCTOR y TRABAJADOR del mismo predio; registra auditoria,
 * limpia el estado de seguimiento del dispositivo y sincroniza por Socket.IO.
 */
export async function cambiarEstadoAlerta(
  idAlerta: string,
  ctx: ContextoUsuario,
  datos: DatosCambiarEstadoAlerta,
): Promise<AlertaDto> {
  const existente = await prisma.alerta.findFirst({
    where: { id: idAlerta, idPredio: ctx.idPredio },
    select: { id: true, estado: true, idDispositivoEdge: true },
  });

  if (!existente) {
    throw new ErrorNoEncontrado('No se encontro la alerta solicitada.');
  }

  if (existente.estado !== 'PENDIENTE') {
    throw new ErrorConflicto(
      'ALERTA_YA_REVISADA',
      'Esta alerta ya fue marcada como revisada anteriormente.',
    );
  }

  const actualizada = await prisma.alerta.update({
    where: { id: existente.id },
    data: {
      estado: datos.estado,
      idRevisadoPor: ctx.idUsuario,
      fechaRevision: new Date(),
    },
    include: inclusionAlerta,
  });

  evaluadorAlertasService.limpiarSeguimientoDispositivo(existente.idDispositivoEdge);

  const dto = aAlertaDto(actualizada);
  emitirAPredio(ctx.idPredio, 'alerta:actualizada', dto);
  return dto;
}

// ─────────────────────────────────────────────────────────────────────────────
// Estado de vigilancia (IF2-SAL)
// ─────────────────────────────────────────────────────────────────────────────

export interface RegionInteres {
  tipo: 'RECTANGULO' | 'POLIGONO';
  puntos: Array<{ x: number; y: number }>;
}

export interface DispositivoEstado {
  id: string;
  nombre: string;
  ultimoHeartbeat: Date | null;
  /// Mediana del conteo que envio el ia-engine en el ultimo heartbeat.
  ultimoConteo: number | null;
  /// Ovejas ACTIVAS registradas en el predio: contra esto se compara lo detectado.
  conteoEsperado: number;
  enLinea: boolean;
  regionInteres: RegionInteres | null;
  regionInteresUpdatedAt: Date | null;
}

export interface EstadoVigilancia {
  dispositivos: DispositivoEstado[];
}

export interface RespuestaRoi {
  id: string;
  regionInteres: RegionInteres;
  regionInteresUpdatedAt: Date;
}

export interface ConfiguracionEdge {
  regionInteres: RegionInteres | null;
  regionInteresUpdatedAt: Date | null;
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
        regionInteres: true,
        regionInteresUpdatedAt: true,
      },
      orderBy: { nombre: 'asc' },
    }),
    prisma.animal.count({ where: { idPredio, estado: 'ACTIVO' } }),
  ]);

  const ahora = new Date();

  return {
    dispositivos: dispositivos.map((d) => ({
      ...d,
      regionInteres: (d.regionInteres as RegionInteres | null) ?? null,
      conteoEsperado: animalesActivos,
      enLinea: estaEnLinea(d.ultimoHeartbeat, ahora),
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Region de Interes (ROI) del dispositivo edge
// ─────────────────────────────────────────────────────────────────────────────

async function exigirDispositivoDelPredio(idDispositivo: string, idPredio: string): Promise<void> {
  // findFirst con ambos ids: un dispositivo de otro predio responde 404 igual
  // que uno inexistente (RNF_08).
  const dispositivo = await prisma.dispositivoEdge.findFirst({
    where: { id: idDispositivo, idPredio },
    select: { id: true },
  });

  if (!dispositivo) {
    throw new ErrorNoEncontrado('No se encontro la camara solicitada.');
  }
}

/** PUT /vigilancia/dispositivos/:id/roi - guarda o reemplaza la ROI del dispositivo. */
export async function actualizarRegionInteres(
  idDispositivo: string,
  idPredio: string,
  roi: DatosRegionInteres,
): Promise<RespuestaRoi> {
  await exigirDispositivoDelPredio(idDispositivo, idPredio);

  const roiNormalizada: RegionInteres = {
    tipo: roi.tipo,
    puntos: roi.puntos.map((p) => ({
      x: redondearCoord(p.x),
      y: redondearCoord(p.y),
    })),
  };

  const actualizado = await prisma.dispositivoEdge.update({
    where: { id: idDispositivo },
    data: {
      regionInteres: roiNormalizada as unknown as Prisma.InputJsonValue,
      regionInteresUpdatedAt: new Date(),
    },
    select: {
      id: true,
      regionInteres: true,
      regionInteresUpdatedAt: true,
    },
  });

  return {
    id: actualizado.id,
    regionInteres: actualizado.regionInteres as unknown as RegionInteres,
    regionInteresUpdatedAt: actualizado.regionInteresUpdatedAt!,
  };
}

/** DELETE /vigilancia/dispositivos/:id/roi - vuelve a deteccion en imagen completa. */
export async function eliminarRegionInteres(idDispositivo: string, idPredio: string): Promise<void> {
  await exigirDispositivoDelPredio(idDispositivo, idPredio);

  await prisma.dispositivoEdge.update({
    where: { id: idDispositivo },
    data: {
      regionInteres: Prisma.DbNull,
      regionInteresUpdatedAt: new Date(),
    },
    select: { id: true },
  });
}

/** GET /edge/configuracion - entrega la ROI vigente al modulo ia-engine. */
export async function obtenerConfiguracionEdge(idDispositivo: string): Promise<ConfiguracionEdge> {
  const dispositivo = await prisma.dispositivoEdge.findUniqueOrThrow({
    where: { id: idDispositivo },
    select: {
      regionInteres: true,
      regionInteresUpdatedAt: true,
    },
  });

  return {
    regionInteres: (dispositivo.regionInteres as RegionInteres | null) ?? null,
    regionInteresUpdatedAt: dispositivo.regionInteresUpdatedAt,
  };
}

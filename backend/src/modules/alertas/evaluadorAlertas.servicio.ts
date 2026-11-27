import { env } from '../../config/env';
import type { Prisma } from '../../generated/prisma/client';
import type { EstadoAlerta, TipoAlerta } from '../../generated/prisma/enums';
import { emisorSocketPredio, type EmisorAlertas } from '../../realtime/socket';
import { prisma as prismaGlobal, type ClienteDb } from '../../shared/db';

/**
 * Evaluador de alertas por falta de ovejas (CONTEO).
 *
 * Implementa una maquina de estados de tres fases por dispositivo edge:
 * 1. Monitoreo normal: exige `heartbeatsConfirmacion` (default 3) heartbeats
 *    consecutivos con deficit (`conteoDetectado < conteoEsperado`) para iniciar
 *    una alerta nueva y emitir `alerta:nueva`.
 * 2. Alerta PENDIENTE activa (`normalizadaEn === null`): mientras persista el
 *    deficit re-emite `alerta:recordatorio` cada `renotificacionSeg` (default 60 s)
 *    sin limite de intentos; si llegan `heartbeatsNormalizacion` (default 2)
 *    heartbeats consecutivos normalizados, persiste `normalizadaEn`, emite
 *    `alerta:actualizada` y silencia definitivamente la alerta (posible oclusion).
 * 3. Alerta PENDIENTE silenciada (`normalizadaEn !== null`): nunca vuelve a
 *    emitir recordatorios sonoros, manteniendose PENDIENTE hasta revision manual.
 */

export const inclusionAlerta = {
  dispositivoEdge: { select: { id: true, nombre: true } },
  revisadoPor: { select: { id: true, nombre: true } },
} satisfies Prisma.AlertaInclude;

export type AlertaConRelaciones = Prisma.AlertaGetPayload<{
  include: typeof inclusionAlerta;
}>;

export interface AlertaDto {
  id: string;
  idPredio: string;
  idDispositivoEdge: string;
  dispositivo: { id: string; nombre: string };
  tipo: TipoAlerta;
  estado: EstadoAlerta;
  conteoDetectado: number;
  conteoEsperado: number;
  descripcion: string;
  fechaDeteccion: Date;
  normalizadaEn: Date | null;
  revisadoPor: { id: string; nombre: string } | null;
  fechaRevision: Date | null;
  creadoEn: Date;
  actualizadoEn: Date;
}

export function aAlertaDto(alerta: AlertaConRelaciones): AlertaDto {
  return {
    id: alerta.id,
    idPredio: alerta.idPredio,
    idDispositivoEdge: alerta.idDispositivoEdge,
    dispositivo: alerta.dispositivoEdge,
    tipo: alerta.tipo,
    estado: alerta.estado,
    conteoDetectado: alerta.conteoDetectado,
    conteoEsperado: alerta.conteoEsperado,
    descripcion: alerta.descripcion,
    fechaDeteccion: alerta.fechaDeteccion,
    normalizadaEn: alerta.normalizadaEn,
    revisadoPor: alerta.revisadoPor,
    fechaRevision: alerta.fechaRevision,
    creadoEn: alerta.createdAt,
    actualizadoEn: alerta.updatedAt,
  };
}

export function construirDescripcionConteo(detectadas: number, esperadas: number): string {
  const faltantes = Math.max(0, esperadas - detectadas);
  const palabra = faltantes === 1 ? 'oveja' : 'ovejas';
  return `Faltan ${faltantes} ${palabra}: ${detectadas} de ${esperadas} detectadas`;
}

export interface EntradaEvaluacionConteo {
  idDispositivoEdge: string;
  idPredio: string;
  conteoDetectado: number;
  conteoEsperado: number;
}

export type ResultadoEvaluacion =
  | { accion: 'SIN_CAMBIOS' }
  | { accion: 'ACUMULANDO_DEFICIT'; heartbeatsConDeficit: number }
  | { accion: 'ALERTA_CREADA'; alerta: AlertaDto }
  | { accion: 'RECORDATORIO_EMITIDO'; alerta: AlertaDto }
  | { accion: 'EN_ESPERA_RENOTIFICACION'; alerta: AlertaDto }
  | { accion: 'NORMALIZANDO'; heartbeatsNormales: number }
  | { accion: 'ALERTA_NORMALIZADA'; alerta: AlertaDto }
  | { accion: 'SILENCIADA_PERMANENTE'; alerta: AlertaDto };

interface EstadoDispositivoAlerta {
  heartbeatsConDeficit: number;
  heartbeatsNormalesConsecutivos: number;
  ultimaEmisionMs: number | null;
}

export interface OpcionesEvaluadorAlertas {
  db?: ClienteDb;
  emisor?: EmisorAlertas;
  ahora?: () => Date;
  heartbeatsConfirmacion?: number;
  heartbeatsNormalizacion?: number;
  renotificacionSeg?: number;
}

export class EvaluadorAlertasService {
  private readonly db: ClienteDb;
  private readonly emisor: EmisorAlertas;
  private readonly ahora: () => Date;
  private readonly heartbeatsConfirmacion: number;
  private readonly heartbeatsNormalizacion: number;
  private readonly renotificacionSeg: number;
  private readonly estados = new Map<string, EstadoDispositivoAlerta>();

  constructor(opciones: OpcionesEvaluadorAlertas = {}) {
    this.db = opciones.db ?? prismaGlobal;
    this.emisor = opciones.emisor ?? emisorSocketPredio;
    this.ahora = opciones.ahora ?? (() => new Date());
    this.heartbeatsConfirmacion =
      opciones.heartbeatsConfirmacion ?? env.ALERTA_HEARTBEATS_CONFIRMACION;
    this.heartbeatsNormalizacion =
      opciones.heartbeatsNormalizacion ?? env.ALERTA_HEARTBEATS_NORMALIZACION;
    this.renotificacionSeg = opciones.renotificacionSeg ?? env.ALERTA_RENOTIFICACION_SEG;
  }

  private obtenerEstado(idDispositivoEdge: string): EstadoDispositivoAlerta {
    let estado = this.estados.get(idDispositivoEdge);
    if (!estado) {
      estado = {
        heartbeatsConDeficit: 0,
        heartbeatsNormalesConsecutivos: 0,
        ultimaEmisionMs: null,
      };
      this.estados.set(idDispositivoEdge, estado);
    }
    return estado;
  }

  async evaluarConteo(entrada: EntradaEvaluacionConteo): Promise<ResultadoEvaluacion> {
    const { idDispositivoEdge, idPredio, conteoDetectado, conteoEsperado } = entrada;
    const ahora = this.ahora();
    const estado = this.obtenerEstado(idDispositivoEdge);

    const alertaPendiente = await this.db.alerta.findFirst({
      where: {
        idDispositivoEdge,
        idPredio,
        tipo: 'CONTEO',
        estado: 'PENDIENTE',
      },
      include: inclusionAlerta,
    });

    const enDeficit = conteoEsperado > 0 && conteoDetectado < conteoEsperado;

    // ── Fase 1: Monitoreo normal (sin alerta PENDIENTE) ──────────────────────
    if (!alertaPendiente) {
      estado.heartbeatsNormalesConsecutivos = 0;
      estado.ultimaEmisionMs = null;

      if (!enDeficit) {
        estado.heartbeatsConDeficit = 0;
        return { accion: 'SIN_CAMBIOS' };
      }

      estado.heartbeatsConDeficit += 1;
      if (estado.heartbeatsConDeficit < this.heartbeatsConfirmacion) {
        return {
          accion: 'ACUMULANDO_DEFICIT',
          heartbeatsConDeficit: estado.heartbeatsConDeficit,
        };
      }

      const descripcion = construirDescripcionConteo(conteoDetectado, conteoEsperado);
      let creada: AlertaConRelaciones;
      try {
        creada = await this.db.alerta.create({
          data: {
            idPredio,
            idDispositivoEdge,
            tipo: 'CONTEO',
            estado: 'PENDIENTE',
            conteoDetectado,
            conteoEsperado,
            descripcion,
            fechaDeteccion: ahora,
          },
          include: inclusionAlerta,
        });
      } catch (e) {
        if (esErrorUnicidad(e)) {
          return { accion: 'SIN_CAMBIOS' };
        }
        throw e;
      }

      estado.heartbeatsConDeficit = 0;
      estado.heartbeatsNormalesConsecutivos = 0;
      estado.ultimaEmisionMs = ahora.getTime();

      const dto = aAlertaDto(creada);
      this.emisor.emitirAPredio(idPredio, 'alerta:nueva', dto);
      return { accion: 'ALERTA_CREADA', alerta: dto };
    }

    // ── Fase 3: Alerta PENDIENTE ya normalizada/silenciada definitivamente ───
    if (alertaPendiente.normalizadaEn !== null) {
      estado.heartbeatsConDeficit = 0;
      return { accion: 'SILENCIADA_PERMANENTE', alerta: aAlertaDto(alertaPendiente) };
    }

    // ── Fase 2: Alerta PENDIENTE activa (normalizadaEn === null) ─────────────
    if (!enDeficit) {
      estado.heartbeatsNormalesConsecutivos += 1;

      if (estado.heartbeatsNormalesConsecutivos < this.heartbeatsNormalizacion) {
        return {
          accion: 'NORMALIZANDO',
          heartbeatsNormales: estado.heartbeatsNormalesConsecutivos,
        };
      }

      const actualizada = await this.db.alerta.update({
        where: { id: alertaPendiente.id },
        data: { normalizadaEn: ahora },
        include: inclusionAlerta,
      });

      estado.heartbeatsConDeficit = 0;
      estado.heartbeatsNormalesConsecutivos = 0;
      estado.ultimaEmisionMs = null;

      const dto = aAlertaDto(actualizada);
      this.emisor.emitirAPredio(idPredio, 'alerta:actualizada', dto);
      return { accion: 'ALERTA_NORMALIZADA', alerta: dto };
    }

    // Sigue en deficit: reinicia contador de normalizacion y evalua recordatorio.
    estado.heartbeatsNormalesConsecutivos = 0;
    const ultimaEmision = estado.ultimaEmisionMs ?? alertaPendiente.fechaDeteccion.getTime();
    const transcurridoMs = ahora.getTime() - ultimaEmision;

    if (transcurridoMs >= this.renotificacionSeg * 1000) {
      estado.ultimaEmisionMs = ahora.getTime();
      const dto = aAlertaDto(alertaPendiente);
      this.emisor.emitirAPredio(idPredio, 'alerta:recordatorio', {
        ...dto,
        conteoActualDetectado: conteoDetectado,
        conteoActualEsperado: conteoEsperado,
        recordatorioEn: ahora.toISOString(),
      });
      return { accion: 'RECORDATORIO_EMITIDO', alerta: dto };
    }

    return { accion: 'EN_ESPERA_RENOTIFICACION', alerta: aAlertaDto(alertaPendiente) };
  }

  /** Limpia el seguimiento en memoria (al resolver/descartar o desconectar el edge). */
  limpiarSeguimientoDispositivo(idDispositivoEdge: string): void {
    this.estados.delete(idDispositivoEdge);
  }

  /** Reinicia todos los contadores en memoria (uso principal en pruebas). */
  reiniciarEstado(): void {
    this.estados.clear();
  }
}

function esErrorUnicidad(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'P2002';
}

export const evaluadorAlertasService = new EvaluadorAlertasService();

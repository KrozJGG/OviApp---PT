import { z } from 'zod';
import { esquemaPaginacion } from '../../shared/paginacion';
import {
  AREA_MINIMA_ROI,
  LADO_MINIMO_BBOX_ROI,
  areaPoligono,
  dimensionesBbox,
  esPoligonoAutoIntersectado,
} from './alertas.geometria';

/**
 * Esquemas del Modulo 6 - Vigilancia y conteo de ovejas (IF2-SAL / IF5-ENT).
 *
 * El modelo de vision por computadora vive en el dispositivo edge: aqui se
 * valida el latido con el conteo actual que emite y la configuracion de Region
 * de Interes (ROI) definida por el Productor. Ni el predio ni el dispositivo
 * llegan por el cuerpo, salen siempre del contexto autenticado (RNF_08).
 */

const conteo = z
  .number('Debe ser un numero entero.')
  .int('Debe ser un numero entero.')
  .min(0, 'No puede ser negativo.');

/** Marca de tiempo emitida por el dispositivo. Se acepta con 'Z' o con desfase. */
const marcaDeTiempo = z.iso.datetime({
  offset: true,
  message: 'La marca de tiempo debe venir en formato ISO 8601.',
});

/** POST /edge/heartbeat - latido de presencia y conteo actual del dispositivo. */
export const esquemaHeartbeat = z.object({
  conteoActual: conteo.optional(),
  timestamp: marcaDeTiempo,
});

export type DatosHeartbeat = z.infer<typeof esquemaHeartbeat>;

const coordenadaNormalizada = z
  .number('Debe ser un numero.')
  .finite('Debe ser un numero finito.')
  .min(0, 'La coordenada debe estar entre 0 y 1.')
  .max(1, 'La coordenada debe estar entre 0 y 1.');

const esquemaPuntoNormalizado = z.object({
  x: coordenadaNormalizada,
  y: coordenadaNormalizada,
});

/** PUT /vigilancia/dispositivos/:id/roi - delimitacion de zona de deteccion. */
export const esquemaRegionInteres = z
  .object({
    tipo: z.enum(['RECTANGULO', 'POLIGONO'], 'El tipo de zona debe ser RECTANGULO o POLIGONO.'),
    puntos: z
      .array(esquemaPuntoNormalizado)
      .min(3, 'Debe tener al menos 3 puntos.')
      .max(20, 'No puede superar los 20 puntos.'),
  })
  .superRefine((val, ctx) => {
    if (val.tipo === 'RECTANGULO' && val.puntos.length !== 4) {
      ctx.addIssue({
        code: 'custom',
        path: ['puntos'],
        message: 'Un rectangulo debe tener exactamente 4 vertices.',
      });
      return;
    }

    if (esPoligonoAutoIntersectado(val.puntos)) {
      ctx.addIssue({
        code: 'custom',
        path: ['puntos'],
        message: 'Las lineas de la zona no pueden cruzarse.',
      });
      return;
    }

    const { ancho, alto } = dimensionesBbox(val.puntos);
    const area = areaPoligono(val.puntos);
    if (ancho < LADO_MINIMO_BBOX_ROI || alto < LADO_MINIMO_BBOX_ROI || area < AREA_MINIMA_ROI) {
      ctx.addIssue({
        code: 'custom',
        path: ['puntos'],
        message: 'El area seleccionada es demasiado pequena.',
      });
    }
  });

export type DatosRegionInteres = z.infer<typeof esquemaRegionInteres>;

export const ESTADOS_ALERTA = ['PENDIENTE', 'RESUELTA', 'DESCARTADA'] as const;
export const ESTADOS_CIERRE_ALERTA = ['RESUELTA', 'DESCARTADA'] as const;

/** GET /alertas - historial paginado con filtros opcionales por estado y rango de fechas. */
export const esquemaListadoAlertas = esquemaPaginacion.extend({
  estado: z.enum(ESTADOS_ALERTA, 'El estado de la alerta no es valido.').optional(),
  desde: z.iso.date('La fecha inicial del rango no es valida.').optional(),
  hasta: z.iso.date('La fecha final del rango no es valida.').optional(),
});

export type FiltrosListadoAlertas = z.infer<typeof esquemaListadoAlertas>;

/** PATCH /alertas/:id/estado - marca una alerta pendiente como RESUELTA o DESCARTADA. */
export const esquemaCambiarEstadoAlerta = z.object({
  estado: z.enum(
    ESTADOS_CIERRE_ALERTA,
    'El estado debe ser RESUELTA o DESCARTADA.',
  ),
});

export type DatosCambiarEstadoAlerta = z.infer<typeof esquemaCambiarEstadoAlerta>;

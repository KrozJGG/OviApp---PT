import { logger } from '../../config/logger';
import type { EstadoAlerta, NivelAlerta, TipoAlerta } from '../../generated/prisma/enums';
import type { ContextoEdge } from '../../shared/contexto';
import { prisma } from '../../shared/db';
import { ErrorConflicto, ErrorNoEncontrado, ErrorReglaNegocio } from '../../shared/errores';
import { finDelDia, inicioDelDia, ZONA_HORARIA } from '../../shared/fechas';
import { aSkipTake, paginar, type Paginado } from '../../shared/paginacion';
import { enviarAUsuarios, usuariosDelPredio } from '../notificaciones/push.servicio';
import type { DatosHeartbeat, DatosIngestaAlerta, FiltrosAlertas } from './alertas.esquemas';

/**
 * Reglas de negocio del Modulo 6 - Vigilancia y deteccion (RF_17 a RF_19).
 *
 * La deteccion en si corre en el dispositivo edge; el servidor recibe la senal,
 * la almacena, avisa a los usuarios del predio (RF_18) y la expone como
 * historial (RF_19).
 */

/** Minutos sin latido tras los cuales un dispositivo se considera fuera de linea. */
export const MINUTOS_EN_LINEA = 15;

const MS_EN_LINEA = MINUTOS_EN_LINEA * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// DTO
// ─────────────────────────────────────────────────────────────────────────────

export interface ReferenciaNombrada {
  id: string;
  nombre: string;
}

export interface AlertaDto {
  id: string;
  tipoAlerta: TipoAlerta;
  descripcion: string | null;
  nivel: NivelAlerta;
  conteoAnimales: number | null;
  conteoEsperado: number | null;
  fechaHora: Date;
  estado: EstadoAlerta;
  fechaRevision: Date | null;
  revisadoPor: ReferenciaNombrada | null;
  dispositivo: ReferenciaNombrada | null;
}

interface FilaAlerta {
  id: string;
  tipoAlerta: TipoAlerta;
  descripcion: string | null;
  nivel: NivelAlerta;
  conteoAnimales: number | null;
  conteoEsperado: number | null;
  fechaHora: Date;
  estado: EstadoAlerta;
  fechaRevision: Date | null;
  revisadoPor: ReferenciaNombrada | null;
  dispositivoEdge: ReferenciaNombrada | null;
}

/** Relaciones que necesita `aDto`. */
const relacionesAlerta = {
  revisadoPor: { select: { id: true, nombre: true } },
  dispositivoEdge: { select: { id: true, nombre: true } },
} as const;

export function aDto(fila: FilaAlerta): AlertaDto {
  return {
    id: fila.id,
    tipoAlerta: fila.tipoAlerta,
    descripcion: fila.descripcion,
    nivel: fila.nivel,
    conteoAnimales: fila.conteoAnimales,
    conteoEsperado: fila.conteoEsperado,
    fechaHora: fila.fechaHora,
    estado: fila.estado,
    fechaRevision: fila.fechaRevision,
    revisadoPor: fila.revisadoPor,
    dispositivo: fila.dispositivoEdge,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Ingesta desde el modulo edge (RF_17, RF_18, IF5-ENT)
// ─────────────────────────────────────────────────────────────────────────────

export interface ResultadoIngesta {
  idAlerta: string;
  duplicada: boolean;
}

/**
 * RF_17 - almacena la alerta emitida por el dispositivo edge.
 *
 * Es idempotente a proposito: la conectividad rural es intermitente y el
 * dispositivo reintenta. La clave (dispositivo, fechaHora, tipoAlerta) identifica
 * el mismo hecho detectado, asi que un reintento devuelve la alerta ya guardada
 * en vez de duplicarla o de fallar, y no vuelve a notificar.
 */
export async function ingestarAlerta(
  edge: ContextoEdge,
  datos: DatosIngestaAlerta,
): Promise<ResultadoIngesta> {
  const fechaHora = new Date(datos.timestamp);

  // El latido se actualiza siempre, tambien en un reintento: si el dispositivo
  // habla, esta vivo.
  const dispositivo = await tocarDispositivo(edge.idDispositivo, datos.conteoAnimales);

  const yaGuardada = await buscarGemela(edge.idDispositivo, fechaHora, datos.tipoAlerta);
  if (yaGuardada) {
    return { idAlerta: yaGuardada, duplicada: true };
  }

  const datosAlerta = {
    idPredio: edge.idPredio,
    idDispositivoEdge: edge.idDispositivo,
    tipoAlerta: datos.tipoAlerta,
    descripcion: datos.descripcion ?? null,
    conteoAnimales: datos.conteoAnimales ?? null,
    conteoEsperado: datos.conteoEsperado ?? dispositivo.conteoEsperado,
    fechaHora,
    ...(datos.nivel ? { nivel: datos.nivel } : {}),
  };

  let idAlerta: string;
  try {
    const creada = await prisma.alerta.create({ data: datosAlerta, select: { id: true } });
    idAlerta = creada.id;
  } catch (e) {
    // Carrera entre dos reintentos simultaneos: la unicidad uq_alerta_edge la
    // resuelve la base, y el segundo se comporta como el duplicado que es.
    if (!esUnicidadVulnerada(e)) throw e;
    const gemela = await buscarGemela(edge.idDispositivo, fechaHora, datos.tipoAlerta);
    if (!gemela) throw e;
    return { idAlerta: gemela, duplicada: true };
  }

  await notificarAlerta({
    idAlerta,
    idPredio: edge.idPredio,
    nombreDispositivo: dispositivo.nombre,
    tipoAlerta: datos.tipoAlerta,
    conteoAnimales: datos.conteoAnimales ?? null,
    conteoEsperado: datosAlerta.conteoEsperado,
    descripcion: datos.descripcion ?? null,
    fechaHora,
  });

  return { idAlerta, duplicada: false };
}

/** Latido del dispositivo: alimenta el indicador "en linea" de IF2-SAL. */
export async function registrarHeartbeat(
  idDispositivo: string,
  datos: DatosHeartbeat,
): Promise<void> {
  await tocarDispositivo(idDispositivo, datos.conteoActual);
}

/** Configuracion que el dispositivo edge necesita para evaluar sus reglas. */
export interface ConfiguracionEdge {
  idDispositivo: string;
  nombre: string;
  /// Linea base del rebano. Sin este valor el modulo edge no puede emitir
  /// alertas de CONTEO, porque no tiene contra que comparar lo que detecta.
  conteoEsperado: number | null;
}

/**
 * GET /edge/configuracion - el dispositivo lee su propia configuracion.
 *
 * Va en un endpoint aparte y no en la respuesta del heartbeat porque el latido
 * responde 204 sin cuerpo por contrato (IF5-ENT) y porque la configuracion se
 * consulta al arrancar, no en cada latido.
 */
export async function configuracionEdge(idDispositivo: string): Promise<ConfiguracionEdge> {
  const dispositivo = await prisma.dispositivoEdge.findUnique({
    where: { id: idDispositivo },
    select: { id: true, nombre: true, conteoEsperado: true },
  });

  if (!dispositivo) {
    throw new ErrorNoEncontrado('El dispositivo edge no existe.');
  }

  return {
    idDispositivo: dispositivo.id,
    nombre: dispositivo.nombre,
    conteoEsperado: dispositivo.conteoEsperado,
  };
}

async function tocarDispositivo(
  idDispositivo: string,
  conteo: number | undefined,
): Promise<{ nombre: string; conteoEsperado: number | null }> {
  return prisma.dispositivoEdge.update({
    where: { id: idDispositivo },
    data: {
      ultimoHeartbeat: new Date(),
      ...(conteo === undefined ? {} : { ultimoConteo: conteo }),
    },
    select: { nombre: true, conteoEsperado: true },
  });
}

async function buscarGemela(
  idDispositivo: string,
  fechaHora: Date,
  tipoAlerta: TipoAlerta,
): Promise<string | null> {
  const fila = await prisma.alerta.findFirst({
    where: { idDispositivoEdge: idDispositivo, fechaHora, tipoAlerta },
    select: { id: true },
  });
  return fila?.id ?? null;
}

function esUnicidadVulnerada(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'P2002';
}

// ─────────────────────────────────────────────────────────────────────────────
// Notificacion push (RF_18, IF4-SAL)
// ─────────────────────────────────────────────────────────────────────────────

interface AvisoAlerta {
  idAlerta: string;
  idPredio: string;
  nombreDispositivo: string;
  tipoAlerta: TipoAlerta;
  conteoAnimales: number | null;
  conteoEsperado: number | null;
  descripcion: string | null;
  fechaHora: Date;
}

const TITULO_POR_TIPO: Record<TipoAlerta, string> = {
  CONTEO: 'Alerta de conteo',
  DISPERSION: 'Alerta de dispersión',
  AMENAZA: 'Alerta de amenaza',
};

/**
 * RF_18 - avisa a todos los usuarios habilitados del predio.
 *
 * Nunca hace fallar la ingesta: la alerta ya quedo almacenada y consultable
 * (RF_17, RF_19), asi que una caida del canal push se registra y se sigue.
 */
async function notificarAlerta(aviso: AvisoAlerta): Promise<void> {
  try {
    const destinatarios = await usuariosDelPredio(aviso.idPredio);
    await enviarAUsuarios(destinatarios, {
      titulo: TITULO_POR_TIPO[aviso.tipoAlerta],
      cuerpo: cuerpoNotificacion(aviso),
      // Deep-link: la app abre el detalle de la alerta al tocar la notificacion.
      datos: { tipo: 'ALERTA', idAlerta: aviso.idAlerta },
    });
  } catch (e) {
    logger.error(
      { err: e, idAlerta: aviso.idAlerta, idPredio: aviso.idPredio },
      'No se pudo enviar la notificacion push de la alerta; la alerta si quedo almacenada.',
    );
  }
}

/** Tipo de evento, hora y cantidad de ovejas detectadas, como pide RF_18. */
export function cuerpoNotificacion(aviso: AvisoAlerta): string {
  const partes = [`${aviso.nombreDispositivo}, ${horaLocal(aviso.fechaHora)} h.`];

  if (aviso.conteoAnimales !== null) {
    const ovejas =
      aviso.conteoAnimales === 1 ? '1 oveja detectada' : `${aviso.conteoAnimales} ovejas detectadas`;
    partes.push(
      aviso.conteoEsperado !== null ? `${ovejas} de ${aviso.conteoEsperado} esperadas.` : `${ovejas}.`,
    );
  }

  if (aviso.descripcion) {
    partes.push(aviso.descripcion);
  }

  return partes.join(' ');
}

function horaLocal(instante: Date): string {
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: ZONA_HORARIA,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(instante);
}

// ─────────────────────────────────────────────────────────────────────────────
// Historial de alertas (RF_19)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * RF_19 - historial del predio del usuario en sesion.
 * El filtro por `idPredio` no es opcional: es el aislamiento de RNF_08.
 */
export async function listarAlertas(
  idPredio: string,
  filtros: FiltrosAlertas,
): Promise<Paginado<AlertaDto>> {
  if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
    throw new ErrorReglaNegocio(
      'RANGO_INVALIDO',
      'La fecha inicial del rango no puede ser posterior a la final.',
    );
  }

  const rango = {
    ...(filtros.desde ? { gte: inicioDelDia(filtros.desde) } : {}),
    ...(filtros.hasta ? { lt: finDelDia(filtros.hasta) } : {}),
  };

  const where = {
    idPredio,
    ...(filtros.tipo ? { tipoAlerta: filtros.tipo } : {}),
    ...(filtros.estado ? { estado: filtros.estado } : {}),
    ...(filtros.desde || filtros.hasta ? { fechaHora: rango } : {}),
  };

  const [filas, total] = await Promise.all([
    prisma.alerta.findMany({
      where,
      include: relacionesAlerta,
      orderBy: { fechaHora: 'desc' },
      ...aSkipTake(filtros),
    }),
    prisma.alerta.count({ where }),
  ]);

  return paginar(filas.map(aDto), total, filtros);
}

/** Detalle de una alerta. Destino del deep-link de la notificacion (RF_18). */
export async function obtenerAlerta(idPredio: string, id: string): Promise<AlertaDto> {
  const fila = await prisma.alerta.findFirst({
    where: { id, idPredio },
    include: relacionesAlerta,
  });
  if (!fila) {
    throw new ErrorNoEncontrado('No se encontró la alerta solicitada.');
  }
  return aDto(fila);
}

/**
 * Marca la alerta como revisada. Deja constancia de quien la reviso y cuando,
 * que es lo que convierte el listado en un historial util y no en una bandeja
 * que se llena sola.
 */
export async function revisarAlerta(
  idPredio: string,
  idUsuario: string,
  id: string,
): Promise<AlertaDto> {
  const actual = await prisma.alerta.findFirst({
    where: { id, idPredio },
    select: { id: true, estado: true },
  });
  if (!actual) {
    throw new ErrorNoEncontrado('No se encontró la alerta solicitada.');
  }
  if (actual.estado === 'REVISADA') {
    throw new ErrorConflicto('ALERTA_YA_REVISADA', 'Esta alerta ya fue marcada como revisada.');
  }

  const fila = await prisma.alerta.update({
    where: { id: actual.id },
    data: { estado: 'REVISADA', idRevisadoPor: idUsuario, fechaRevision: new Date() },
    include: relacionesAlerta,
  });

  return aDto(fila);
}

// ─────────────────────────────────────────────────────────────────────────────
// Estado de vigilancia (IF2-SAL)
// ─────────────────────────────────────────────────────────────────────────────

export interface DispositivoEstado {
  id: string;
  nombre: string;
  ultimoHeartbeat: Date | null;
  ultimoConteo: number | null;
  conteoEsperado: number | null;
  enLinea: boolean;
}

export interface ResumenAlerta {
  id: string;
  tipoAlerta: TipoAlerta;
  descripcion: string | null;
  nivel: NivelAlerta;
  conteoAnimales: number | null;
  fechaHora: Date;
}

export interface EstadoVigilancia {
  dispositivos: DispositivoEstado[];
  alertasSinRevisar: number;
  ultimaAlerta: ResumenAlerta | null;
}

/** Un dispositivo esta en linea si latio dentro de los ultimos 15 minutos. */
export function estaEnLinea(ultimoHeartbeat: Date | null, ahora: Date = new Date()): boolean {
  if (!ultimoHeartbeat) return false;
  return ahora.getTime() - ultimoHeartbeat.getTime() <= MS_EN_LINEA;
}

/** IF2-SAL - encabezado de la pantalla de vigilancia. */
export async function estadoVigilancia(idPredio: string): Promise<EstadoVigilancia> {
  const [dispositivos, alertasSinRevisar, ultima] = await Promise.all([
    prisma.dispositivoEdge.findMany({
      where: { idPredio },
      select: {
        id: true,
        nombre: true,
        ultimoHeartbeat: true,
        ultimoConteo: true,
        conteoEsperado: true,
      },
      orderBy: { nombre: 'asc' },
    }),
    prisma.alerta.count({ where: { idPredio, estado: 'NUEVA' } }),
    prisma.alerta.findFirst({
      where: { idPredio },
      orderBy: { fechaHora: 'desc' },
      select: {
        id: true,
        tipoAlerta: true,
        descripcion: true,
        nivel: true,
        conteoAnimales: true,
        fechaHora: true,
      },
    }),
  ]);

  const ahora = new Date();

  return {
    dispositivos: dispositivos.map((d) => ({ ...d, enLinea: estaEnLinea(d.ultimoHeartbeat, ahora) })),
    alertasSinRevisar,
    ultimaAlerta: ultima,
  };
}

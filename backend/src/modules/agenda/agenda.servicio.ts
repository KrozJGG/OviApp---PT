import type { TipoAlerta } from '../../generated/prisma/enums';
import { prisma } from '../../shared/db';
import { ErrorReglaNegocio } from '../../shared/errores';
import { aFechaSolo, diferenciaDias, fechaLocalISO, finDelDia, inicioDelDia } from '../../shared/fechas';
import { etiquetaTipoEvento } from '../bitacora/bitacora.servicio';

/**
 * Modulo 5 - Pantalla de inicio y calendario (RF_15, RF_16).
 *
 * Este modulo solo LEE. Su razon de ser es que la app no tenga que fusionar dos
 * listados distintos (eventos del Modulo 3 y tareas del Modulo 4) ni duplicar la
 * logica de agrupacion por dia: aqui salen ya unificados en `ItemAgenda`,
 * ordenados y con los conteos por dia que pinta el calendario.
 *
 * Toda consulta filtra por `idPredio` (RNF_08).
 */

/** Item unificado del calendario: un evento o una tarea con forma comun. */
export interface ItemAgenda {
  id: string;
  clase: 'EVENTO' | 'TAREA';
  /** TipoEvento para eventos; 'TAREA' para tareas. */
  tipo: string;
  /** 'Esquila', 'Encaste', ... o el titulo de la tarea. */
  titulo: string;
  descripcion: string | null;
  /** fechaInicio del evento | fechaLimite de la tarea. */
  fecha: Date;
  /** EstadoEvento | EstadoTarea. */
  estado: string;
  meta: Record<string, unknown>;
}

/** Conteos por dia que alimentan los puntos del calendario (mockup 06). */
export type ConteosPorDia = Record<string, { eventos: number; tareas: number }>;

export interface ResumenInicio {
  animalesActivos: number;
  tareasHoy: number;
  alertasSinLeer: number;
  ultimaAlerta: {
    id: string;
    tipoAlerta: TipoAlerta;
    descripcion: string | null;
    fechaHora: Date;
  } | null;
}

export interface AgendaDelDia {
  fecha: string;
  items: ItemAgenda[];
}

export interface AgendaDelRango {
  desde: string;
  hasta: string;
  items: ItemAgenda[];
  porDia: ConteosPorDia;
}

/** Ancho maximo del rango del calendario, en dias calendario inclusive. */
export const DIAS_MAXIMOS_RANGO = 366;

// ─── RF_15 - tarjetas de la pantalla de inicio ───────────────────────────────

/**
 * Resumen del mockup 02: rebano activo, tareas de hoy, alertas sin leer y la
 * ultima alerta recibida. Los cuatro conteos son independientes entre si, asi
 * que se resuelven en paralelo: la pantalla de inicio es la primera que ve el
 * usuario al abrir la app y encadenar cuatro round-trips a la base se nota.
 */
export async function obtenerResumenInicio(idPredio: string): Promise<ResumenInicio> {
  const hoy = fechaLocalISO();

  const [animalesActivos, tareasHoy, alertasSinLeer, ultimaAlerta] = await Promise.all([
    prisma.animal.count({ where: { idPredio, estado: 'ACTIVO' } }),
    prisma.tarea.count({ where: { idPredio, estado: 'ACTIVA', fechaLimite: aFechaSolo(hoy) } }),
    prisma.alerta.count({ where: { idPredio, estado: 'NUEVA' } }),
    prisma.alerta.findFirst({
      where: { idPredio },
      orderBy: { fechaHora: 'desc' },
      select: { id: true, tipoAlerta: true, descripcion: true, fechaHora: true },
    }),
  ]);

  return { animalesActivos, tareasHoy, alertasSinLeer, ultimaAlerta };
}

// ─── RF_15 - actividades del dia ─────────────────────────────────────────────

/**
 * Eventos y tareas de hoy en la zona horaria del predio.
 *
 * El dia se acota con `inicioDelDia`/`finDelDia` y no comparando en UTC: entre
 * las 21:00 y medianoche de Chile continental el dia UTC ya es el siguiente, y
 * el productor veria la agenda de manana en pantalla.
 *
 * Un dia sin actividades es una respuesta valida (200 con `items: []`).
 */
export async function obtenerAgendaDelDia(idPredio: string, hoy = fechaLocalISO()): Promise<AgendaDelDia> {
  const items = await recolectarItems(idPredio, hoy, hoy);
  return { fecha: hoy, items };
}

// ─── RF_16 - calendario general ──────────────────────────────────────────────

/**
 * Rango efectivo del calendario. Sin parametros, el mes calendario en curso, que
 * es lo que la app pide al abrir la pantalla del calendario.
 */
export function resolverRango(
  filtros: { desde?: string | undefined; hasta?: string | undefined },
  hoy = fechaLocalISO(),
): { desde: string; hasta: string } {
  const mes = mesDe(hoy);
  const desde = filtros.desde ?? mes.desde;
  const hasta = filtros.hasta ?? mes.hasta;

  if (hasta < desde) {
    throw new ErrorReglaNegocio(
      'RANGO_INVALIDO',
      'La fecha final del rango no puede ser anterior a la inicial.',
    );
  }

  if (diferenciaDias(desde, hasta) + 1 > DIAS_MAXIMOS_RANGO) {
    throw new ErrorReglaNegocio('RANGO_INVALIDO', 'El rango no puede superar un año.');
  }

  return { desde, hasta };
}

/**
 * Calendario general. No se pagina a proposito: un mes de un predio artesanal
 * son decenas de items, y paginar obligaria a la app a pedir varias paginas
 * antes de poder pintar los puntos de un mes completo.
 */
export async function obtenerAgendaDelRango(
  idPredio: string,
  filtros: { desde?: string | undefined; hasta?: string | undefined },
): Promise<AgendaDelRango> {
  const { desde, hasta } = resolverRango(filtros);
  const items = await recolectarItems(idPredio, desde, hasta);
  return { desde, hasta, items, porDia: contarPorDia(items) };
}

// ─── Recoleccion y unificacion ───────────────────────────────────────────────

/** Item con el dia calendario ya resuelto, para agrupar y ordenar sin recalcular. */
interface ItemFechado {
  dia: string;
  item: ItemAgenda;
}

async function recolectarItems(idPredio: string, desde: string, hasta: string): Promise<ItemAgenda[]> {
  const [eventos, tareas] = await Promise.all([
    prisma.evento.findMany({
      where: {
        idPredio,
        // RF_10 - los eventos eliminados son un soft delete: nunca se muestran.
        estado: { not: 'ELIMINADO' },
        fechaInicio: { gte: inicioDelDia(desde), lt: finDelDia(hasta) },
      },
      select: {
        id: true,
        tipo: true,
        descripcion: true,
        fechaInicio: true,
        estado: true,
        _count: { select: { animales: true } },
      },
    }),
    prisma.tarea.findMany({
      where: {
        idPredio,
        fechaLimite: { gte: aFechaSolo(desde), lte: aFechaSolo(hasta) },
      },
      select: {
        id: true,
        titulo: true,
        descripcion: true,
        fechaLimite: true,
        estado: true,
        completadaEn: true,
        responsables: { select: { usuario: { select: { id: true, nombre: true } } } },
      },
    }),
  ]);

  const fechados: ItemFechado[] = [
    ...eventos.map((e) => ({
      // El dia de un evento es el dia LOCAL del predio, no el dia UTC.
      dia: fechaLocalISO(e.fechaInicio),
      item: {
        id: e.id,
        clase: 'EVENTO' as const,
        tipo: e.tipo,
        titulo: etiquetaTipoEvento(e.tipo),
        descripcion: e.descripcion,
        fecha: e.fechaInicio,
        estado: e.estado,
        meta: { animales: e._count.animales },
      },
    })),
    ...tareas.map((t) => ({
      // `fechaLimite` es @db.Date: ya es una fecha sin hora, se lee tal cual.
      dia: t.fechaLimite.toISOString().slice(0, 10),
      item: {
        id: t.id,
        clase: 'TAREA' as const,
        tipo: 'TAREA',
        titulo: t.titulo,
        descripcion: t.descripcion,
        fecha: t.fechaLimite,
        estado: t.estado,
        meta: {
          responsables: t.responsables.map((r) => ({ id: r.usuario.id, nombre: r.usuario.nombre })),
          completadaEn: t.completadaEn,
        },
      },
    })),
  ];

  // Primero por dia calendario y despues por instante: una tarea se guarda a
  // medianoche UTC, que en Chile cae la tarde anterior, asi que ordenar solo por
  // `fecha` la colaria antes de los eventos del dia previo.
  fechados.sort((a, b) =>
    a.dia === b.dia ? a.item.fecha.getTime() - b.item.fecha.getTime() : a.dia < b.dia ? -1 : 1,
  );

  return fechados.map((f) => f.item);
}

/**
 * Conteos por dia para los puntos azules (eventos) y verdes (tareas) del
 * calendario. Solo aparecen los dias con actividad: los vacios no se envian.
 */
function contarPorDia(items: ItemAgenda[]): ConteosPorDia {
  const porDia: ConteosPorDia = {};

  for (const item of items) {
    const dia = diaDelItem(item);
    const casilla = (porDia[dia] ??= { eventos: 0, tareas: 0 });
    if (item.clase === 'EVENTO') casilla.eventos += 1;
    else casilla.tareas += 1;
  }

  return porDia;
}

function diaDelItem(item: ItemAgenda): string {
  return item.clase === 'EVENTO' ? fechaLocalISO(item.fecha) : item.fecha.toISOString().slice(0, 10);
}

/** Primer y ultimo dia del mes calendario al que pertenece la fecha dada. */
function mesDe(iso: string): { desde: string; hasta: string } {
  const anio = Number(iso.slice(0, 4));
  const mes = Number(iso.slice(5, 7));
  // Dia 0 del mes siguiente = ultimo dia de este mes, bisiestos incluidos.
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const mm = String(mes).padStart(2, '0');
  return { desde: `${anio}-${mm}-01`, hasta: `${anio}-${mm}-${String(ultimo).padStart(2, '0')}` };
}

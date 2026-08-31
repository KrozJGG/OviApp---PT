import type { EstadoAnimal, EstadoEvento, SexoAnimal, TipoEvento } from '../../generated/prisma/enums';
import type { Prisma } from '../../generated/prisma/client';
import type { ContextoUsuario } from '../../shared/contexto';
import { prisma, type ClienteDb, type TX } from '../../shared/db';
import { ErrorConflicto, ErrorNoEncontrado, ErrorReglaNegocio } from '../../shared/errores';
import { esPasada, fechaLocalISO, finDelDia, inicioDelDia } from '../../shared/fechas';
import { aSkipTake, paginar, type Paginado } from '../../shared/paginacion';
import {
  marcarEventoEliminado,
  registrarEventoEnAnimales,
  sincronizarEventoEnAnimales,
} from '../bitacora/bitacora.servicio';
import type { DatosCrearEvento, DatosEditarEvento, FiltrosListadoEventos } from './eventos.esquemas';

/**
 * Modulo 3 - Organizador de eventos (RF_07 a RF_10).
 *
 * Todo lo que muta un evento escribe ademas la bitacora de cada animal
 * involucrado (RF_06.d) dentro de la MISMA transaccion: si falla una parte no
 * queda un evento sin rastro en el historial de los animales.
 */

// ─── DTO ─────────────────────────────────────────────────────────────────────

interface AnimalDeEvento {
  id: string;
  numeroOreja: string;
  sexo: SexoAnimal;
  raza: string | null;
  estado: EstadoAnimal;
}

interface EventoConRelaciones {
  id: string;
  tipo: TipoEvento;
  descripcion: string | null;
  fechaInicio: Date;
  estado: EstadoEvento;
  eliminadoEn: Date | null;
  createdAt: Date;
  updatedAt: Date;
  creador: { id: string; nombre: string };
  animales: { animal: AnimalDeEvento }[];
}

export interface EventoDto {
  id: string;
  tipo: TipoEvento;
  descripcion: string | null;
  fechaInicio: Date;
  estado: EstadoEvento;
  eliminadoEn: Date | null;
  creador: { id: string; nombre: string };
  animales: AnimalDeEvento[];
  creadoEn: Date;
  actualizadoEn: Date;
}

function aDto(evento: EventoConRelaciones): EventoDto {
  return {
    id: evento.id,
    tipo: evento.tipo,
    descripcion: evento.descripcion,
    fechaInicio: evento.fechaInicio,
    estado: evento.estado,
    eliminadoEn: evento.eliminadoEn,
    creador: evento.creador,
    animales: evento.animales.map((ea) => ea.animal),
    creadoEn: evento.createdAt,
    actualizadoEn: evento.updatedAt,
  };
}

/** Relaciones que necesita el DTO: quien lo creo (RF_08) y sus animales. */
const inclusionEvento = {
  creador: { select: { id: true, nombre: true } },
  animales: {
    include: {
      animal: { select: { id: true, numeroOreja: true, sexo: true, raza: true, estado: true } },
    },
    orderBy: { animal: { numeroOreja: 'asc' } },
  },
} satisfies Prisma.EventoInclude;

async function leerEvento(db: ClienteDb, id: string): Promise<EventoDto> {
  const evento = await db.evento.findUniqueOrThrow({ where: { id }, include: inclusionEvento });
  return aDto(evento);
}

// ─── Reglas de negocio ───────────────────────────────────────────────────────

/**
 * RF_07 - "solo permite el registro si todos los animales seleccionados estan
 * activos". Un animal inexistente o de otro predio se trata igual que uno
 * inactivo: no se confirma su existencia, para no filtrar datos entre predios
 * (RNF_08).
 *
 * En `detalles` viaja el numero de oreja de cada animal problematico, que es lo
 * que la app puede mostrar en pantalla. Si el animal no es visible para el
 * predio se devuelve su identificador, el unico dato que aporto el cliente.
 */
async function exigirAnimalesActivos(
  db: ClienteDb,
  idPredio: string,
  idAnimales: string[],
): Promise<void> {
  if (idAnimales.length === 0) return;

  const visibles = await db.animal.findMany({
    where: { id: { in: idAnimales }, idPredio },
    select: { id: true, numeroOreja: true, estado: true },
  });
  const porId = new Map(visibles.map((a) => [a.id, a]));

  const problematicos = idAnimales.flatMap((id) => {
    const animal = porId.get(id);
    if (!animal) return [id];
    return animal.estado === 'ACTIVO' ? [] : [animal.numeroOreja];
  });

  if (problematicos.length > 0) {
    throw new ErrorReglaNegocio(
      'ANIMALES_INACTIVOS',
      'Hay animales seleccionados que no estan activos.',
      problematicos,
    );
  }
}

function exigirSeleccionNoVacia(idAnimales: string[]): void {
  if (idAnimales.length === 0) {
    throw new ErrorReglaNegocio(
      'ANIMALES_REQUERIDOS',
      'Selecciona al menos un animal para el evento.',
    );
  }
}

/**
 * Pre-condicion 1 del CU "Registrar Evento Calendarizado": la fecha del evento
 * debe ser hoy o posterior. Se compara en la zona del predio y no en UTC: de
 * noche la fecha UTC ya es la del dia siguiente, y un evento de hoy quedaria
 * aceptado o rechazado segun la hora a la que se registre.
 */
function exigirFechaNoPasada(fechaInicio: Date): void {
  if (esPasada(fechaLocalISO(fechaInicio), fechaLocalISO())) {
    throw new ErrorReglaNegocio('FECHA_PASADA', 'La fecha del evento no puede ser anterior a hoy.');
  }
}

/** Quita duplicados conservando el orden en que los envio el cliente. */
function unicos(ids: string[]): string[] {
  return [...new Set(ids)];
}

/**
 * Localiza un evento del predio del usuario. Si existe pero es de otro predio
 * se responde 404 igual que si no existiera (RNF_08).
 */
async function eventoDelPredio(db: ClienteDb, id: string, idPredio: string) {
  const evento = await db.evento.findFirst({
    where: { id, idPredio },
    select: { id: true, tipo: true, descripcion: true, fechaInicio: true, estado: true },
  });
  if (!evento) {
    throw new ErrorNoEncontrado('No se encontró el evento solicitado.');
  }
  return evento;
}

function exigirNoEliminado(estado: EstadoEvento): void {
  if (estado === 'ELIMINADO') {
    throw new ErrorConflicto(
      'EVENTO_ELIMINADO',
      'Este evento fue eliminado y ya no se puede modificar.',
    );
  }
}

// ─── Casos de uso ────────────────────────────────────────────────────────────

/** RF_07 - Registrar evento. Solo el Productor. */
export async function crearEvento(
  ctx: ContextoUsuario,
  datos: DatosCrearEvento,
): Promise<EventoDto> {
  const idAnimales = unicos(datos.idAnimales);
  exigirSeleccionNoVacia(idAnimales);

  const fechaInicio = new Date(datos.fechaInicio);
  exigirFechaNoPasada(fechaInicio);

  const descripcion = datos.descripcion ?? null;

  return prisma.$transaction(async (tx: TX) => {
    await exigirAnimalesActivos(tx, ctx.idPredio, idAnimales);

    const evento = await tx.evento.create({
      data: {
        idPredio: ctx.idPredio,
        idCreador: ctx.idUsuario,
        tipo: datos.tipo,
        descripcion,
        fechaInicio,
      },
      select: { id: true },
    });

    await tx.eventoAnimal.createMany({
      data: idAnimales.map((idAnimal) => ({ idEvento: evento.id, idAnimal })),
    });

    // RF_06.d - el evento queda anotado en la bitacora de cada animal.
    await registrarEventoEnAnimales(tx, {
      idEvento: evento.id,
      idAnimales,
      idUsuario: ctx.idUsuario,
      tipoEvento: datos.tipo,
      descripcion,
      fechaEvento: fechaInicio,
    });

    return leerEvento(tx, evento.id);
  });
}

/** Listado de eventos del predio, base del calendario. Ambos roles. */
export async function listarEventos(
  ctx: ContextoUsuario,
  filtros: FiltrosListadoEventos,
): Promise<Paginado<EventoDto>> {
  if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
    throw new ErrorReglaNegocio(
      'RANGO_INVALIDO',
      'La fecha inicial del rango debe ser anterior a la final.',
    );
  }

  const rango = {
    ...(filtros.desde ? { gte: inicioDelDia(filtros.desde) } : {}),
    ...(filtros.hasta ? { lt: finDelDia(filtros.hasta) } : {}),
  };

  const where: Prisma.EventoWhereInput = {
    idPredio: ctx.idPredio,
    // Un evento eliminado sigue existiendo (RF_10) pero no vuelve al calendario
    // salvo que se pida explicitamente.
    ...(filtros.estado
      ? { estado: filtros.estado }
      : filtros.incluirEliminados
        ? {}
        : { estado: { not: 'ELIMINADO' } }),
    ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
    ...(filtros.desde || filtros.hasta ? { fechaInicio: rango } : {}),
  };

  const [eventos, total] = await Promise.all([
    prisma.evento.findMany({
      where,
      include: inclusionEvento,
      orderBy: { fechaInicio: 'desc' },
      ...aSkipTake(filtros),
    }),
    prisma.evento.count({ where }),
  ]);

  return paginar(eventos.map(aDto), total, filtros);
}

/**
 * RF_08 - Consultar detalle de un evento. Ambos roles.
 * Los eliminados si se pueden consultar: siguen citados desde la bitacora de
 * los animales y RF_08 permite llegar al detalle desde ahi.
 */
export async function obtenerEvento(ctx: ContextoUsuario, id: string): Promise<EventoDto> {
  await eventoDelPredio(prisma, id, ctx.idPredio);
  return leerEvento(prisma, id);
}

/** RF_09 - Editar evento. Solo el Productor. */
export async function editarEvento(
  ctx: ContextoUsuario,
  id: string,
  datos: DatosEditarEvento,
  opciones: { intentaCambiarTipo: boolean },
): Promise<EventoDto> {
  const evento = await eventoDelPredio(prisma, id, ctx.idPredio);

  if (opciones.intentaCambiarTipo) {
    throw new ErrorConflicto(
      'TIPO_EVENTO_INMUTABLE',
      'El tipo de evento no se puede modificar una vez registrado.',
    );
  }
  exigirNoEliminado(evento.estado);

  const fechaInicio = datos.fechaInicio ? new Date(datos.fechaInicio) : evento.fechaInicio;
  const descripcion = datos.descripcion === undefined ? evento.descripcion : datos.descripcion;

  return prisma.$transaction(async (tx: TX) => {
    const actuales = await tx.eventoAnimal.findMany({
      where: { idEvento: id },
      select: { idAnimal: true },
    });
    const yaEstaban = new Set(actuales.map((ea) => ea.idAnimal));

    const idAnimalesFinal = datos.idAnimales
      ? unicos(datos.idAnimales)
      : actuales.map((ea) => ea.idAnimal);

    if (datos.idAnimales) {
      exigirSeleccionNoVacia(idAnimalesFinal);
      // Solo los animales que se AGREGAN deben estar activos: los que ya
      // participaban se conservan aunque se hayan dado de baja despues, para no
      // reescribir la historia del evento (RF_09).
      await exigirAnimalesActivos(
        tx,
        ctx.idPredio,
        idAnimalesFinal.filter((idAnimal) => !yaEstaban.has(idAnimal)),
      );

      await tx.eventoAnimal.deleteMany({ where: { idEvento: id } });
      await tx.eventoAnimal.createMany({
        data: idAnimalesFinal.map((idAnimal) => ({ idEvento: id, idAnimal })),
      });
    }

    await tx.evento.update({ where: { id }, data: { descripcion, fechaInicio } });

    // RF_06 - la bitacora refleja la lista final; nunca se borra una entrada.
    await sincronizarEventoEnAnimales(tx, {
      idEvento: id,
      idAnimalesFinal,
      idUsuario: ctx.idUsuario,
      tipoEvento: evento.tipo,
      descripcion,
      fechaEvento: fechaInicio,
    });

    return leerEvento(tx, id);
  });
}

/**
 * RF_10 - Eliminar evento. Solo el Productor.
 * Borrado logico: la fila y sus animales asociados se conservan, y las entradas
 * de bitacora quedan marcadas como "evento eliminado" en vez de desaparecer.
 */
export async function eliminarEvento(ctx: ContextoUsuario, id: string): Promise<void> {
  const evento = await eventoDelPredio(prisma, id, ctx.idPredio);
  exigirNoEliminado(evento.estado);

  await prisma.$transaction(async (tx: TX) => {
    await tx.evento.update({
      where: { id },
      data: { estado: 'ELIMINADO', eliminadoEn: new Date() },
    });
    await marcarEventoEliminado(tx, id);
  });
}

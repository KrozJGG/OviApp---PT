import type { Prisma } from '../../generated/prisma/client';
import type { AnimalModel } from '../../generated/prisma/models';
import type { ContextoUsuario } from '../../shared/contexto';
import { prisma, type TX } from '../../shared/db';
import { ErrorConflicto, ErrorNoEncontrado, ErrorReglaNegocio } from '../../shared/errores';
import { aFechaSolo, fechaLocalISO } from '../../shared/fechas';
import { aSkipTake, paginar, type Paginado } from '../../shared/paginacion';
import {
  registrarAlta,
  registrarBaja,
  registrarModificacion,
  type CambioCampo,
} from '../bitacora/bitacora.servicio';
import type {
  DatosBajaAnimal,
  DatosCrearAnimal,
  DatosEditarAnimal,
  FiltrosListadoAnimales,
} from './animales.esquemas';

/**
 * Modulo 1 - Ficha Animal (RF_01 a RF_04).
 *
 * Aqui viven las reglas de negocio; el controlador solo valida y responde.
 *
 * Toda mutacion escribe su entrada de bitacora DENTRO de la misma transaccion
 * (RF_06): si la escritura del animal se revierte, la trazabilidad tambien, y
 * el historial que exige el SAG nunca queda a medias.
 */

// --- DTO ---------------------------------------------------------------------

export interface AnimalDto {
  id: string;
  numeroOreja: string;
  sexo: AnimalModel['sexo'];
  raza: string | null;
  color: string | null;
  pesoKg: number | null;
  fechaNacimiento: Date | null;
  descripcion: string | null;
  estado: AnimalModel['estado'];
  motivoBaja: AnimalModel['motivoBaja'];
  fechaBaja: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** `pesoKg` es Decimal en la base; la app espera un numero. */
export function aDto(a: AnimalModel): AnimalDto {
  return {
    id: a.id,
    numeroOreja: a.numeroOreja,
    sexo: a.sexo,
    raza: a.raza,
    color: a.color,
    pesoKg: a.pesoKg === null ? null : Number(a.pesoKg),
    fechaNacimiento: a.fechaNacimiento,
    descripcion: a.descripcion,
    estado: a.estado,
    motivoBaja: a.motivoBaja,
    fechaBaja: a.fechaBaja,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

export interface ResumenRebano {
  activos: number;
  inactivos: number;
}

export interface ListadoAnimales extends Paginado<AnimalDto> {
  resumen: ResumenRebano;
}

export interface EntradaResumida {
  id: string;
  tipo: string;
  titulo: string;
  descripcion: string | null;
  fecha: Date;
}

export interface FichaAnimal extends AnimalDto {
  registrador: { id: string; nombre: string };
  ultimasEntradas: EntradaResumida[];
}

/** Cuantas entradas de bitacora se adjuntan a la ficha (RF_02, mockup 04). */
const ENTRADAS_EN_FICHA = 5;

// --- RF_01 - Registrar animal ------------------------------------------------

export async function crear(ctx: ContextoUsuario, datos: DatosCrearAnimal): Promise<AnimalDto> {
  const numeroOreja = datos.numeroOreja;

  if (typeof datos.fechaNacimiento === 'string') {
    exigirNoFutura(datos.fechaNacimiento, 'La fecha de nacimiento no puede ser posterior a hoy.');
  }

  // El indice uq_animal_oreja ya lo garantiza, pero se comprueba antes para
  // poder decir cual es el numero repetido en vez de dar un 409 generico.
  const existente = await prisma.animal.findUnique({
    where: { idPredio_numeroOreja: { idPredio: ctx.idPredio, numeroOreja } },
    select: { id: true },
  });
  if (existente) throw errorOrejaDuplicada(numeroOreja);

  try {
    return await prisma.$transaction(async (tx: TX) => {
      const animal = await tx.animal.create({
        data: {
          idPredio: ctx.idPredio,
          idRegistrador: ctx.idUsuario,
          numeroOreja,
          sexo: datos.sexo,
          raza: normalizarTexto(datos.raza) ?? null,
          color: normalizarTexto(datos.color) ?? null,
          pesoKg: datos.pesoKg ?? null,
          fechaNacimiento:
            typeof datos.fechaNacimiento === 'string' ? aFechaSolo(datos.fechaNacimiento) : null,
          descripcion: normalizarTexto(datos.descripcion) ?? null,
        },
      });

      // RF_06.a - la ficha nace con su primera entrada de bitacora.
      await registrarAlta(tx, {
        idAnimal: animal.id,
        idUsuario: ctx.idUsuario,
        numeroOreja: animal.numeroOreja,
        datosIniciales: datosIniciales(animal),
      });

      return aDto(animal);
    });
  } catch (e) {
    // Carrera entre la comprobacion de arriba y el INSERT: gana la base.
    if (codigoPrisma(e) === 'P2002') throw errorOrejaDuplicada(numeroOreja);
    throw e;
  }
}

// --- Listado del rebano (mockup 03) ------------------------------------------

export async function listar(
  ctx: ContextoUsuario,
  filtros: FiltrosListadoAnimales,
): Promise<ListadoAnimales> {
  const where: Prisma.AnimalWhereInput = {
    idPredio: ctx.idPredio,
    ...(filtros.estado ? { estado: filtros.estado } : {}),
    // Busqueda por prefijo: en terreno se teclea el inicio de la caravana.
    ...(filtros.q ? { numeroOreja: { startsWith: filtros.q, mode: 'insensitive' } } : {}),
  };

  const delPredio = { idPredio: ctx.idPredio };

  const [filas, total, activos, inactivos] = await Promise.all([
    prisma.animal.findMany({ where, orderBy: { numeroOreja: 'asc' }, ...aSkipTake(filtros) }),
    prisma.animal.count({ where }),
    prisma.animal.count({ where: { ...delPredio, estado: 'ACTIVO' } }),
    prisma.animal.count({ where: { ...delPredio, estado: 'INACTIVO' } }),
  ]);

  // El resumen cuenta el rebano completo, no la pagina: es el subtitulo de la
  // pantalla ("47 animales activos") y no debe cambiar al paginar ni al filtrar.
  return { ...paginar(filas.map(aDto), total, filtros), resumen: { activos, inactivos } };
}

// --- RF_02 - Consultar ficha -------------------------------------------------

export async function obtenerFicha(ctx: ContextoUsuario, id: string): Promise<FichaAnimal> {
  // Sin filtrar por estado: RF_02 exige poder consultar tambien la ficha de un
  // animal dado de baja.
  const animal = await prisma.animal.findFirst({
    where: { id, idPredio: ctx.idPredio },
    include: { registrador: { select: { id: true, nombre: true } } },
  });
  if (!animal) throw errorAnimalNoEncontrado();

  const entradas = await prisma.bitacoraEntrada.findMany({
    where: { idAnimal: animal.id },
    orderBy: [{ fechaEvento: 'desc' }, { createdAt: 'desc' }],
    take: ENTRADAS_EN_FICHA,
    select: { id: true, tipo: true, titulo: true, descripcion: true, fechaEvento: true },
  });

  return {
    ...aDto(animal),
    registrador: animal.registrador,
    ultimasEntradas: entradas.map((e) => ({
      id: e.id,
      tipo: e.tipo,
      titulo: e.titulo,
      descripcion: e.descripcion,
      fecha: e.fechaEvento,
    })),
  };
}

// --- RF_03 - Editar datos generales ------------------------------------------

export async function editar(
  ctx: ContextoUsuario,
  id: string,
  datos: DatosEditarAnimal,
): Promise<AnimalDto> {
  // H7 - el numero de oreja identifica al animal en el registro SAG: cambiarlo
  // romperia la trazabilidad, asi que no se ignora en silencio, se rechaza.
  if (datos.numeroOreja !== undefined) {
    throw new ErrorConflicto('IDENTIFICADOR_INMUTABLE', 'El número de oreja no se puede modificar.');
  }

  const animal = await buscarDelPredio(id, ctx.idPredio);

  if (animal.estado === 'INACTIVO') {
    throw new ErrorConflicto(
      'ANIMAL_INACTIVO',
      'No se pueden editar los datos de un animal dado de baja.',
    );
  }

  if (typeof datos.fechaNacimiento === 'string') {
    exigirNoFutura(datos.fechaNacimiento, 'La fecha de nacimiento no puede ser posterior a hoy.');
  }

  const { cambios, data } = calcularCambios(animal, datos);

  // Sin cambios reales no hay nada que registrar: una entrada de bitacora vacia
  // solo ensuciaria el historial que se le muestra al productor.
  if (cambios.length === 0) return aDto(animal);

  return prisma.$transaction(async (tx: TX) => {
    const actualizado = await tx.animal.update({ where: { id: animal.id }, data });

    // RF_06.b - queda constancia de que campo cambio, desde que valor y a cual.
    await registrarModificacion(tx, { idAnimal: animal.id, idUsuario: ctx.idUsuario, cambios });

    return aDto(actualizado);
  });
}

/**
 * Compara el animal guardado con los datos recibidos y devuelve solo los
 * cambios REALES: los campos que no vinieron, o que vinieron con el mismo
 * valor, no generan entrada de bitacora ni se tocan en la base.
 */
export function calcularCambios(
  animal: AnimalModel,
  datos: DatosEditarAnimal,
): { cambios: CambioCampo[]; data: Prisma.AnimalUpdateInput } {
  const cambios: CambioCampo[] = [];
  const data: Prisma.AnimalUpdateInput = {};

  const cambio = (campo: string, anterior: unknown, nuevo: unknown): boolean => {
    if (anterior === nuevo) return false;
    cambios.push({ campo, valorAnterior: anterior, valorNuevo: nuevo });
    return true;
  };

  if (datos.sexo !== undefined && cambio('sexo', animal.sexo, datos.sexo)) {
    data.sexo = datos.sexo;
  }

  const raza = normalizarTexto(datos.raza);
  if (raza !== undefined && cambio('raza', animal.raza, raza)) {
    data.raza = raza;
  }

  const color = normalizarTexto(datos.color);
  if (color !== undefined && cambio('color', animal.color, color)) {
    data.color = color;
  }

  const descripcion = normalizarTexto(datos.descripcion);
  if (descripcion !== undefined && cambio('descripcion', animal.descripcion, descripcion)) {
    data.descripcion = descripcion;
  }

  if (datos.pesoKg !== undefined) {
    // Decimal vs number: sin convertir, 45 y Decimal(45) nunca serian iguales
    // y toda edicion registraria un cambio de peso que no ocurrio.
    const anterior = animal.pesoKg === null ? null : Number(animal.pesoKg);
    if (cambio('pesoKg', anterior, datos.pesoKg)) data.pesoKg = datos.pesoKg;
  }

  if (datos.fechaNacimiento !== undefined) {
    const anterior = animal.fechaNacimiento === null ? null : aIsoSolo(animal.fechaNacimiento);
    if (cambio('fechaNacimiento', anterior, datos.fechaNacimiento)) {
      data.fechaNacimiento =
        datos.fechaNacimiento === null ? null : aFechaSolo(datos.fechaNacimiento);
    }
  }

  return { cambios, data };
}

// --- RF_04 - Registrar baja --------------------------------------------------

export async function darDeBaja(
  ctx: ContextoUsuario,
  id: string,
  datos: DatosBajaAnimal,
): Promise<AnimalDto> {
  const animal = await buscarDelPredio(id, ctx.idPredio);

  if (animal.estado === 'INACTIVO') {
    throw new ErrorConflicto('ANIMAL_YA_INACTIVO', 'Este animal ya fue dado de baja.');
  }

  exigirNoFutura(datos.fecha, 'La fecha de baja no puede ser posterior a hoy.');

  const fechaBaja = aFechaSolo(datos.fecha);

  return prisma.$transaction(async (tx: TX) => {
    // El animal y su historial se conservan siempre: la baja es un cambio de
    // estado, nunca un borrado (RF_04, trazabilidad SAG).
    const actualizado = await tx.animal.update({
      where: { id: animal.id },
      data: { estado: 'INACTIVO', motivoBaja: datos.motivo, fechaBaja },
    });

    // RF_06.c
    await registrarBaja(tx, {
      idAnimal: animal.id,
      idUsuario: ctx.idUsuario,
      motivo: datos.motivo,
      fecha: fechaBaja,
    });

    return aDto(actualizado);
  });
}

// --- Eliminacion definitiva ---------------------------------------------------

/**
 * Borra el animal de la base, con todo lo que cuelga de el.
 *
 * Es la alternativa que se le ofrece al Productor despues de registrar la baja
 * (RF_04): dejarlo inactivo -el camino por defecto, que conserva la
 * trazabilidad- o sacarlo del rebano por completo. Por eso solo se admite sobre
 * un animal ya INACTIVO: primero se registra por que salio, y despues se decide
 * si se conserva su historial.
 *
 * La bitacora y los vinculos con eventos y tareas se van en cascada desde la
 * propia base: sin el animal no describen nada. Es la unica excepcion al
 * caracter append-only de la bitacora (RF_06), y el trigger la reconoce por
 * eso mismo -- solo la admite cuando el animal ya no esta.
 */
export async function eliminar(ctx: ContextoUsuario, id: string): Promise<void> {
  const animal = await buscarDelPredio(id, ctx.idPredio);

  if (animal.estado !== 'INACTIVO') {
    throw new ErrorConflicto(
      'ANIMAL_ACTIVO',
      'Primero hay que registrar la baja del animal para poder eliminarlo del rebaño.',
    );
  }

  await prisma.animal.delete({ where: { id: animal.id } });
}

// --- Apoyo -------------------------------------------------------------------

/**
 * Busca el animal dentro del predio del usuario.
 * Si existe pero es de otro predio responde 404 igual que si no existiera:
 * distinguirlos filtraria informacion entre predios (RNF_08).
 */
async function buscarDelPredio(id: string, idPredio: string): Promise<AnimalModel> {
  const animal = await prisma.animal.findFirst({ where: { id, idPredio } });
  if (!animal) throw errorAnimalNoEncontrado();
  return animal;
}

function errorAnimalNoEncontrado(): ErrorNoEncontrado {
  return new ErrorNoEncontrado('No se encontró el animal solicitado.');
}

function errorOrejaDuplicada(numeroOreja: string): ErrorConflicto {
  return new ErrorConflicto(
    'OREJA_DUPLICADA',
    `Ya existe un animal con el número de oreja ${numeroOreja} en este predio.`,
  );
}

/** Ninguna de estas fechas puede estar en el futuro: describen algo ya ocurrido. */
function exigirNoFutura(iso: string, mensaje: string): void {
  if (iso > fechaLocalISO()) throw new ErrorReglaNegocio('FECHA_FUTURA', mensaje);
}

/** undefined = el campo no vino; null o cadena vacia = el usuario borro el dato. */
function normalizarTexto(valor: string | null | undefined): string | null | undefined {
  if (valor === undefined) return undefined;
  if (valor === null || valor === '') return null;
  return valor;
}

/** Los campos @db.Date se guardan a medianoche UTC: basta con recortar. */
function aIsoSolo(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/** Foto de los datos con los que nacio la ficha, para la entrada de ALTA. */
function datosIniciales(a: AnimalModel): Record<string, unknown> {
  return {
    numeroOreja: a.numeroOreja,
    sexo: a.sexo,
    raza: a.raza,
    color: a.color,
    pesoKg: a.pesoKg === null ? null : Number(a.pesoKg),
    fechaNacimiento: a.fechaNacimiento === null ? null : aIsoSolo(a.fechaNacimiento),
    descripcion: a.descripcion,
  };
}

function codigoPrisma(e: unknown): string | undefined {
  if (typeof e !== 'object' || e === null) return undefined;
  const codigo = (e as { code?: unknown }).code;
  return typeof codigo === 'string' ? codigo : undefined;
}

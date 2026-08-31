import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/db';
import { ctxDe } from '../../shared/contexto';
import { ErrorNoEncontrado } from '../../shared/errores';
import { aSkipTake, esquemaPaginacion, paginar } from '../../shared/paginacion';
import { validarCuerpo, validarParams, validarQuery } from '../../shared/validacion';
import { agregarNota } from './bitacora.servicio';

const esquemaParams = z.object({
  idAnimal: z.uuid('El identificador del animal no es valido.'),
});

const esquemaNota = z.object({
  contenido: z
    .string()
    .trim()
    .min(1, 'La nota no puede estar vacia.')
    .max(1000, 'La nota no puede superar los 1000 caracteres.'),
});

const esquemaListado = esquemaPaginacion.extend({
  tipo: z.enum(['ALTA', 'MODIFICACION', 'BAJA', 'EVENTO', 'NOTA']).optional(),
});

/**
 * Confirma que el animal existe y pertenece al predio del usuario.
 * Si es de otro predio se responde 404 igual que si no existiera: distinguirlos
 * filtraria informacion entre predios (RNF_08).
 */
async function animalDelPredio(idAnimal: string, idPredio: string) {
  const animal = await prisma.animal.findFirst({
    where: { id: idAnimal, idPredio },
    select: { id: true, numeroOreja: true },
  });
  if (!animal) {
    throw new ErrorNoEncontrado('No se encontro el animal solicitado.');
  }
  return animal;
}

/** GET /animales/:idAnimal/bitacora - RF_05 */
export async function listar(req: Request, res: Response): Promise<void> {
  const ctx = ctxDe(req);
  const { idAnimal } = validarParams(esquemaParams, req);
  const filtros = validarQuery(esquemaListado, req);

  await animalDelPredio(idAnimal, ctx.idPredio);

  const where = { idAnimal, ...(filtros.tipo ? { tipo: filtros.tipo } : {}) };

  const [entradas, total] = await Promise.all([
    prisma.bitacoraEntrada.findMany({
      where,
      orderBy: [{ fechaEvento: 'desc' }, { createdAt: 'desc' }],
      include: { usuario: { select: { id: true, nombre: true } } },
      ...aSkipTake(filtros),
    }),
    prisma.bitacoraEntrada.count({ where }),
  ]);

  res.json(paginar(entradas.map(aDto), total, filtros));
}

/** POST /animales/:idAnimal/bitacora - nota manual (Nota_bitacora del MER) */
export async function crearNota(req: Request, res: Response): Promise<void> {
  const ctx = ctxDe(req);
  const { idAnimal } = validarParams(esquemaParams, req);
  const { contenido } = validarCuerpo(esquemaNota, req);

  await animalDelPredio(idAnimal, ctx.idPredio);

  const entrada = await agregarNota(prisma, {
    idAnimal,
    idUsuario: ctx.idUsuario,
    contenido,
  });

  const conUsuario = await prisma.bitacoraEntrada.findUniqueOrThrow({
    where: { id: entrada.id },
    include: { usuario: { select: { id: true, nombre: true } } },
  });

  res.status(201).json(aDto(conUsuario));
}

type EntradaConUsuario = Awaited<ReturnType<typeof prisma.bitacoraEntrada.findUniqueOrThrow>> & {
  usuario: { id: string; nombre: string } | null;
};

function aDto(e: EntradaConUsuario) {
  return {
    id: e.id,
    tipo: e.tipo,
    titulo: e.titulo,
    descripcion: e.descripcion,
    datos: e.datos,
    idEvento: e.idEvento,
    eventoEliminado: e.eventoEliminado,
    fecha: e.fechaEvento,
    registradaEn: e.createdAt,
    usuario: e.usuario,
  };
}

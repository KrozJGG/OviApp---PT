import { z } from 'zod';

export const TAMANO_PAGINA_POR_DEFECTO = 20;
export const TAMANO_PAGINA_MAXIMO = 100;

/**
 * Query de paginacion compartida por todos los listados.
 * Se compone con `.extend()` en cada modulo para agregar sus propios filtros.
 */
export const esquemaPaginacion = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  tamano: z.coerce.number().int().min(1).max(TAMANO_PAGINA_MAXIMO).default(TAMANO_PAGINA_POR_DEFECTO),
});

export type Paginacion = z.infer<typeof esquemaPaginacion>;

export interface MetaPaginacion {
  pagina: number;
  tamano: number;
  total: number;
  totalPaginas: number;
}

export interface Paginado<T> {
  datos: T[];
  meta: MetaPaginacion;
}

/** Traduce { pagina, tamano } a los argumentos skip/take de Prisma. */
export function aSkipTake(p: Paginacion): { skip: number; take: number } {
  return { skip: (p.pagina - 1) * p.tamano, take: p.tamano };
}

export function paginar<T>(datos: T[], total: number, p: Paginacion): Paginado<T> {
  return {
    datos,
    meta: {
      pagina: p.pagina,
      tamano: p.tamano,
      total,
      totalPaginas: total === 0 ? 0 : Math.ceil(total / p.tamano),
    },
  };
}

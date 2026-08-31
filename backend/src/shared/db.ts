import { prisma } from '../config/prisma';
import type { Prisma } from '../generated/prisma/client';

export { prisma };

/**
 * Cliente dentro de una transaccion (`prisma.$transaction(async (tx) => ...)`).
 *
 * Los servicios que participan de una operacion mas grande reciben este tipo
 * en lugar del cliente global. RF_06 depende de ello: la entrada de bitacora se
 * escribe en la MISMA transaccion que la mutacion del animal, de modo que si
 * una falla se revierten ambas y la trazabilidad nunca queda incompleta.
 */
export type TX = Prisma.TransactionClient;

/** Acepta indistintamente el cliente global o una transaccion. */
export type ClienteDb = TX | typeof prisma;

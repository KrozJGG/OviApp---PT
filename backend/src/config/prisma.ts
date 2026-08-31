import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { env, esProduccion } from './env';

/**
 * Cliente Prisma unico del proceso.
 *
 * Desde Prisma 7 la conexion llega por driver adapter (`@prisma/adapter-pg`) en
 * lugar de la url del schema. El adaptador mantiene su propio pool de `pg`.
 */
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL, max: env.DB_POOL_MAX });

export const prisma = new PrismaClient({
  adapter,
  log: esProduccion ? ['error'] : ['error', 'warn'],
});

/** Tipo del cliente o de una transaccion; los repositorios aceptan ambos. */
export type ClientePrisma = Omit<PrismaClient, '$connect' | '$disconnect' | '$transaction' | '$extends'>;

export async function cerrarPrisma(): Promise<void> {
  await prisma.$disconnect();
}

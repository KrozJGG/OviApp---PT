"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.cerrarPrisma = cerrarPrisma;
const adapter_pg_1 = require("@prisma/adapter-pg");
const client_1 = require("../generated/prisma/client");
const env_1 = require("./env");
/**
 * Cliente Prisma unico del proceso.
 *
 * Desde Prisma 7 la conexion llega por driver adapter (`@prisma/adapter-pg`) en
 * lugar de la url del schema. El adaptador mantiene su propio pool de `pg`.
 */
const adapter = new adapter_pg_1.PrismaPg({ connectionString: env_1.env.DATABASE_URL, max: env_1.env.DB_POOL_MAX });
exports.prisma = new client_1.PrismaClient({
    adapter,
    log: env_1.esProduccion ? ['error'] : ['error', 'warn'],
});
async function cerrarPrisma() {
    await exports.prisma.$disconnect();
}
//# sourceMappingURL=prisma.js.map
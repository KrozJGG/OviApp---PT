import 'dotenv/config';
import path from 'node:path';
import { defineConfig, env } from 'prisma/config';

/**
 * Configuracion del CLI de Prisma 7.
 *
 * Desde Prisma 7 la URL de conexion ya no vive en `schema.prisma`: el CLI la lee
 * de aqui (para migrate / db / studio) y el cliente en runtime la recibe a traves
 * del driver adapter (`src/config/prisma.ts`).
 */
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
});

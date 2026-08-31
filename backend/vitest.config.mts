import { config as cargarEnv } from 'dotenv';
import { defineConfig } from 'vitest/config';

// Las variables de .env.test se inyectan en process.env ANTES de que se cargue
// cualquier modulo del proyecto. Importa el orden: `src/config/env.ts` hace
// `dotenv/config`, y dotenv no pisa variables ya definidas, asi que de este modo
// la suite nunca toca la base de desarrollo.
const { parsed } = cargarEnv({ path: '.env.test' });

const entorno = { ...(parsed ?? {}) };

// Un DATABASE_URL puesto en la linea de comandos gana sobre .env.test. Permite
// correr un archivo de test contra una base aislada sin tocar la configuracion:
//   DATABASE_URL=...oviapp_test_animales npx vitest run tests/animales.test.ts
if (process.env.DATABASE_URL) {
  entorno.DATABASE_URL = process.env.DATABASE_URL;
}

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    env: entorno,
    globalSetup: ['./tests/apoyo/setupGlobal.ts'],
    // La suite comparte una unica base y cada test la deja limpia: ejecutar
    // archivos en paralelo haria que se pisaran entre si.
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 30_000,
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/generated/**', 'src/server.ts'],
      reporter: ['text', 'html'],
    },
  },
});

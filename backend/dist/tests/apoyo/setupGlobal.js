"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = setup;
const node_child_process_1 = require("node:child_process");
const dotenv_1 = require("dotenv");
/**
 * Prepara la base de tests una sola vez por corrida: aplica todas las
 * migraciones sobre `oviapp_test` (puerto 5434 del docker-compose).
 *
 * Se usa `migrate deploy` y no `db push` para que la suite se ejecute contra
 * exactamente el mismo SQL que produccion, triggers y CHECK incluidos: son
 * parte de lo que hay que probar (RF_04, RF_06).
 */
async function setup() {
    const { parsed } = (0, dotenv_1.config)({ path: '.env.test' });
    const env = { ...process.env, ...parsed };
    // Mismo criterio que vitest.config.mts: un DATABASE_URL dado por linea de
    // comandos gana, para poder migrar una base de tests aislada.
    if (process.env.DATABASE_URL) {
        env.DATABASE_URL = process.env.DATABASE_URL;
    }
    if (!env.DATABASE_URL?.includes('test')) {
        throw new Error(`La suite se negó a correr: DATABASE_URL no apunta a una base de tests (${env.DATABASE_URL ?? 'sin valor'}).`);
    }
    (0, node_child_process_1.execFileSync)('npx', ['prisma', 'migrate', 'deploy'], {
        env,
        stdio: 'inherit',
        shell: process.platform === 'win32',
    });
}
//# sourceMappingURL=setupGlobal.js.map
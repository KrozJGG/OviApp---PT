import 'dotenv/config';
import { prisma } from '../src/config/prisma';

/**
 * Comprueba que las garantias declaradas en la migracion `reglas_dominio` estan
 * realmente activas en la base apuntada por DATABASE_URL.
 *
 * Es distinto de la suite de tests: aqui no se prueba la API, sino que la base
 * por si sola rechaza los estados que los requerimientos prohiben, aunque
 * alguien escriba directamente con SQL.
 *
 *   npm run db:verificar
 */
async function main(): Promise<void> {
  const entrada = await prisma.bitacoraEntrada.findFirstOrThrow({ where: { tipo: 'ALTA' } });

  const casos: Array<{ nombre: string; permitido: boolean; ejecutar: () => Promise<unknown> }> = [
    {
      nombre: 'RF_06 - eliminar una entrada de bitacora',
      permitido: false,
      ejecutar: () => prisma.bitacoraEntrada.delete({ where: { id: entrada.id } }),
    },
    {
      nombre: 'RF_06 - cambiar el tipo de una entrada',
      permitido: false,
      ejecutar: () =>
        prisma.bitacoraEntrada.update({ where: { id: entrada.id }, data: { tipo: 'NOTA' } }),
    },
    {
      nombre: 'RF_06 - mover una entrada a otro animal',
      permitido: false,
      ejecutar: () =>
        prisma.$executeRawUnsafe(
          `UPDATE bitacora_entrada SET id_animal = (SELECT id FROM animal WHERE id <> '${entrada.idAnimal}' LIMIT 1) WHERE id = '${entrada.id}'`,
        ),
    },
    {
      nombre: 'RF_09 - reconciliar titulo y fecha del evento',
      permitido: true,
      ejecutar: () =>
        prisma.bitacoraEntrada.update({ where: { id: entrada.id }, data: { titulo: entrada.titulo } }),
    },
    {
      nombre: 'RF_10 - marcar la entrada como evento eliminado',
      permitido: true,
      ejecutar: () =>
        prisma.bitacoraEntrada.update({ where: { id: entrada.id }, data: { eventoEliminado: false } }),
    },
    {
      nombre: 'RF_04 - dejar un animal INACTIVO sin motivo ni fecha de baja',
      permitido: false,
      ejecutar: () =>
        prisma.$executeRawUnsafe(`UPDATE animal SET estado = 'INACTIVO' WHERE numero_oreja = '0042'`),
    },
    {
      nombre: 'RF_01 - repetir el numero de oreja dentro del predio',
      permitido: false,
      // updated_at se completa explicitamente: Prisma resuelve @updatedAt en el
      // cliente, asi que un INSERT en SQL crudo debe darle valor o fallaria por
      // NOT NULL antes de llegar a la restriccion que se quiere probar.
      ejecutar: () =>
        prisma.$executeRawUnsafe(
          `INSERT INTO animal (id_predio, numero_oreja, id_registrador, sexo, updated_at)
           SELECT id_predio, numero_oreja, id_registrador, sexo, now() FROM animal WHERE numero_oreja = '0042'`,
        ),
    },
  ];

  let fallos = 0;

  for (const caso of casos) {
    let paso = true;
    let motivo = '';
    try {
      await caso.ejecutar();
    } catch (e) {
      paso = false;
      motivo = primeraLineaRelevante(e);
    }

    const correcto = paso === caso.permitido;
    if (!correcto) fallos += 1;
    const marca = correcto ? 'ok   ' : 'FALLA';
    const veredicto = caso.permitido ? 'permitido' : 'rechazado';
    console.log(`  ${marca} ${veredicto.padEnd(9)} ${caso.nombre}${motivo ? `\n           ${motivo}` : ''}`);
  }

  console.log(
    fallos === 0
      ? '\n  Las reglas de dominio estan activas en la base.'
      : `\n  ${fallos} regla(s) no se comportaron como exige el requerimiento.`,
  );

  await prisma.$disconnect();
  process.exit(fallos === 0 ? 0 : 1);
}

function primeraLineaRelevante(e: unknown): string {
  const mensaje = e instanceof Error ? e.message : String(e);
  const linea = mensaje
    .split('\n')
    .map((l) => l.trim())
    .find((l) => /RF_06|ck_animal_baja|uq_animal_oreja|violates|constraint|Unique/i.test(l));
  return (linea ?? '').slice(0, 120);
}

void main();

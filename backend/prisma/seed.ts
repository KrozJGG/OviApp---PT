import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import type { MotivoBaja, SexoAnimal, TipoAlerta } from '../src/generated/prisma/enums';

/**
 * Datos semilla de OviApp.
 *
 * Reproduce el estado que muestran los mockups de la tesis (Figuras 6.5 y 6.6)
 * para poder comparar la app contra el diseno durante el desarrollo:
 * 47 animales activos, la esquila del Hato Norte, la tarea de los cercos y las
 * tres alertas de vigilancia.
 *
 * Es idempotente: se puede correr las veces que haga falta.
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const PASSWORD_DEMO = 'Ovi2026!';
const API_KEY_EDGE = 'edge_hatonorte.7f3a91c4e08b45d2a6f1';

/** PRNG determinista: dos corridas del seed generan el mismo rebano. */
function prng(semilla: number): () => number {
  let s = semilla >>> 0;
  return () => {
    s = (s * 1_664_525 + 1_013_904_223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

const RAZAS = ['Suffolk', 'Merino', 'Corriedale', 'Romney Marsh', 'Criolla', 'Texel'];
const COLORES = ['Blanco', 'Blanco con manchas', 'Negro', 'Café claro', 'Gris'];

/** Fecha local (zona del predio) a medianoche UTC, para columnas @db.Date. */
function fechaSolo(d: Date): Date {
  return new Date(`${d.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function aHoraLocal(base: Date, hora: number, minuto = 0): Date {
  const d = new Date(base);
  d.setHours(hora, minuto, 0, 0);
  return d;
}

function sumarDias(d: Date, dias: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + dias);
  return x;
}

async function main(): Promise<void> {
  const hoy = new Date();
  const ayer = sumarDias(hoy, -1);

  console.log('Limpiando datos anteriores...');
  // TRUNCATE en vez de deleteMany: es una sola sentencia, respeta las FK con
  // CASCADE y -- lo importante -- no dispara los triggers de fila, de modo que
  // el guardian append-only de la bitacora (RF_06) no bloquea el reseteo.
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "bitacora_entrada", "evento_animal", "tarea_animal", "tarea_usuario",
      "alerta", "evento", "tarea", "animal", "dispositivo_edge",
      "dispositivo_usuario", "refresh_token", "usuario", "predio"
    RESTART IDENTITY CASCADE
  `);

  // ── Predio ────────────────────────────────────────────────────────────────
  const predio = await prisma.predio.create({
    data: { nombre: 'Fundo El Manzano', ubicacion: 'Ñuble, Región de Ñuble' },
  });

  // Un segundo predio, vacio, para poder probar el aislamiento de RNF_08.
  const otroPredio = await prisma.predio.create({
    data: { nombre: 'Fundo Los Maitenes', ubicacion: 'Biobío' },
  });

  // ── Usuarios ──────────────────────────────────────────────────────────────
  const hash = await bcrypt.hash(PASSWORD_DEMO, 10);

  const manuel = await prisma.usuario.create({
    data: {
      idPredio: predio.id,
      nombre: 'Manuel Sáez',
      rut: '12.345.678-9',
      telefono: '+56 9 8765 4321',
      email: 'manuel@oviapp.cl',
      passwordHash: hash,
      rol: 'PRODUCTOR',
    },
  });

  const rosa = await prisma.usuario.create({
    data: {
      idPredio: predio.id,
      nombre: 'Rosa Millán',
      rut: '15.876.234-1',
      telefono: '+56 9 5544 3322',
      email: 'rosa@oviapp.cl',
      passwordHash: hash,
      rol: 'TRABAJADOR',
    },
  });

  const pedro = await prisma.usuario.create({
    data: {
      idPredio: predio.id,
      nombre: 'Pedro Huenchual',
      email: 'pedro@oviapp.cl',
      passwordHash: hash,
      rol: 'TRABAJADOR',
    },
  });

  // Usuario del otro predio: no debe ver nada de El Manzano.
  await prisma.usuario.create({
    data: {
      idPredio: otroPredio.id,
      nombre: 'Carmen Vidal',
      email: 'carmen@oviapp.cl',
      passwordHash: hash,
      rol: 'PRODUCTOR',
    },
  });

  // ── Rebaño ────────────────────────────────────────────────────────────────
  // Los cuatro primeros son los que aparecen en el mockup 03.
  const destacados: Array<{
    numeroOreja: string;
    raza: string;
    sexo: SexoAnimal;
    pesoKg: number;
    color: string;
  }> = [
    { numeroOreja: '0042', raza: 'Suffolk', sexo: 'HEMBRA', pesoKg: 45, color: 'Blanco' },
    { numeroOreja: '0118', raza: 'Merino', sexo: 'MACHO', pesoKg: 62, color: 'Blanco' },
    { numeroOreja: '0091', raza: 'Corriedale', sexo: 'HEMBRA', pesoKg: 51, color: 'Blanco con manchas' },
  ];

  const azar = prng(20260828);
  const activos: string[] = [];

  for (const d of destacados) {
    const animal = await prisma.animal.create({
      data: {
        idPredio: predio.id,
        numeroOreja: d.numeroOreja,
        idRegistrador: manuel.id,
        sexo: d.sexo,
        raza: d.raza,
        color: d.color,
        pesoKg: d.pesoKg,
        fechaNacimiento: fechaSolo(sumarDias(hoy, -Math.floor(400 + azar() * 900))),
        descripcion: null,
      },
    });
    activos.push(animal.id);
    await crearAltaBitacora(animal.id, manuel.id, d.numeroOreja);
  }

  // Hasta completar los 47 activos del mockup.
  for (let i = activos.length; i < 47; i += 1) {
    const numeroOreja = String(120 + i * 7).padStart(4, '0');
    const sexo: SexoAnimal = azar() > 0.78 ? 'MACHO' : 'HEMBRA';
    const animal = await prisma.animal.create({
      data: {
        idPredio: predio.id,
        numeroOreja,
        idRegistrador: azar() > 0.5 ? manuel.id : rosa.id,
        sexo,
        raza: RAZAS[Math.floor(azar() * RAZAS.length)]!,
        color: COLORES[Math.floor(azar() * COLORES.length)]!,
        pesoKg: Math.round((sexo === 'MACHO' ? 55 + azar() * 20 : 38 + azar() * 16) * 10) / 10,
        fechaNacimiento: fechaSolo(sumarDias(hoy, -Math.floor(200 + azar() * 1400))),
      },
    });
    activos.push(animal.id);
    await crearAltaBitacora(animal.id, manuel.id, numeroOreja);
  }

  // Animales dados de baja: el #0007 es el "Inactivo" del mockup 03.
  const bajas: Array<{ numeroOreja: string; motivo: MotivoBaja; raza: string; peso: number }> = [
    { numeroOreja: '0007', motivo: 'VENTA', raza: 'Criolla', peso: 38 },
    { numeroOreja: '0015', motivo: 'MUERTE', raza: 'Romney Marsh', peso: 41 },
    { numeroOreja: '0023', motivo: 'FAENA', raza: 'Suffolk', peso: 58 },
  ];

  for (const b of bajas) {
    const fechaBaja = sumarDias(hoy, -Math.floor(20 + azar() * 120));
    const animal = await prisma.animal.create({
      data: {
        idPredio: predio.id,
        numeroOreja: b.numeroOreja,
        idRegistrador: manuel.id,
        sexo: 'HEMBRA',
        raza: b.raza,
        color: 'Blanco',
        pesoKg: b.peso,
        fechaNacimiento: fechaSolo(sumarDias(hoy, -900)),
        estado: 'INACTIVO',
        motivoBaja: b.motivo,
        fechaBaja: fechaSolo(fechaBaja),
      },
    });
    await crearAltaBitacora(animal.id, manuel.id, b.numeroOreja);
    await prisma.bitacoraEntrada.create({
      data: {
        idAnimal: animal.id,
        idUsuario: manuel.id,
        tipo: 'BAJA',
        titulo: `Baja por ${b.motivo.toLowerCase()}`,
        descripcion:
          'El animal fue dado de baja del rebaño. Se conserva su historial completo para trazabilidad SAG.',
        datos: { motivo: b.motivo, fecha: fechaBaja.toISOString().slice(0, 10) },
        fechaEvento: fechaBaja,
      },
    });
  }

  // ── Evento del mockup 02: "Esquila Hato Norte", hoy 09:00, 47 animales ────
  const esquila = await prisma.evento.create({
    data: {
      idPredio: predio.id,
      idCreador: manuel.id,
      tipo: 'ESQUILA',
      descripcion: 'Esquila Hato Norte',
      fechaInicio: aHoraLocal(hoy, 9, 0),
      animales: { create: activos.map((idAnimal) => ({ idAnimal })) },
    },
  });

  await prisma.bitacoraEntrada.createMany({
    data: activos.map((idAnimal) => ({
      idAnimal,
      idUsuario: manuel.id,
      tipo: 'EVENTO' as const,
      idEvento: esquila.id,
      titulo: 'Esquila',
      descripcion: 'Esquila Hato Norte',
      datos: { tipoEvento: 'ESQUILA' },
      fechaEvento: aHoraLocal(hoy, 9, 0),
    })),
  });

  // Un encaste pasado, para que el calendario tenga historia.
  const encaste = await prisma.evento.create({
    data: {
      idPredio: predio.id,
      idCreador: manuel.id,
      tipo: 'ENCASTE',
      descripcion: 'Encaste de otoño - lote de hembras adultas',
      fechaInicio: aHoraLocal(sumarDias(hoy, -35), 10, 30),
      estado: 'REALIZADO',
      animales: { create: activos.slice(0, 12).map((idAnimal) => ({ idAnimal })) },
    },
  });

  await prisma.bitacoraEntrada.createMany({
    data: activos.slice(0, 12).map((idAnimal) => ({
      idAnimal,
      idUsuario: manuel.id,
      tipo: 'EVENTO' as const,
      idEvento: encaste.id,
      titulo: 'Encaste',
      descripcion: 'Encaste de otoño - lote de hembras adultas',
      datos: { tipoEvento: 'ENCASTE' },
      fechaEvento: aHoraLocal(sumarDias(hoy, -35), 10, 30),
    })),
  });

  // Visita veterinaria futura.
  await prisma.evento.create({
    data: {
      idPredio: predio.id,
      idCreador: manuel.id,
      tipo: 'ATENCION_SANITARIA',
      descripcion: 'Visita veterinaria - vacunación clostridial',
      fechaInicio: aHoraLocal(sumarDias(hoy, 9), 11, 0),
      animales: { create: activos.slice(0, 20).map((idAnimal) => ({ idAnimal })) },
    },
  });

  // ── Tareas ────────────────────────────────────────────────────────────────
  // "Revisar cercos sector 4 - Vence hoy - Asignada a Rosa" del mockup 02.
  await prisma.tarea.create({
    data: {
      idPredio: predio.id,
      idCreador: manuel.id,
      titulo: 'Revisar cercos sector 4',
      descripcion: 'Recorrer el perímetro del potrero 4 y reparar los tramos caídos.',
      fechaLimite: fechaSolo(hoy),
      responsables: { create: [{ idUsuario: rosa.id }] },
    },
  });

  await prisma.tarea.create({
    data: {
      idPredio: predio.id,
      idCreador: rosa.id,
      titulo: 'Reponer sal mineral en bebederos',
      descripcion: 'Bebederos del potrero 2 y 3.',
      fechaLimite: fechaSolo(hoy),
      responsables: { create: [{ idUsuario: pedro.id }] },
    },
  });

  await prisma.tarea.create({
    data: {
      idPredio: predio.id,
      idCreador: manuel.id,
      titulo: 'Rotar rebaño al potrero 5',
      descripcion: 'Evitar sobrepastoreo del potrero 3.',
      fechaLimite: fechaSolo(hoy),
      responsables: { create: [{ idUsuario: rosa.id }, { idUsuario: pedro.id }] },
    },
  });

  await prisma.tarea.create({
    data: {
      idPredio: predio.id,
      idCreador: manuel.id,
      titulo: 'Preparar galpón de esquila',
      descripcion: 'Limpiar y habilitar el galpón antes de la esquila.',
      fechaLimite: fechaSolo(sumarDias(hoy, -3)),
      estado: 'COMPLETADA',
      completadaEn: sumarDias(hoy, -3),
      idCompletadaPor: pedro.id,
      responsables: { create: [{ idUsuario: pedro.id }] },
    },
  });

  await prisma.tarea.create({
    data: {
      idPredio: predio.id,
      idCreador: manuel.id,
      titulo: 'Comprar antiparasitario',
      descripcion: 'Para la desparasitación previa a la visita veterinaria.',
      fechaLimite: fechaSolo(sumarDias(hoy, 5)),
      responsables: { create: [{ idUsuario: manuel.id }] },
    },
  });

  // ── Vigilancia ────────────────────────────────────────────────────────────
  const [prefijo, secreto] = API_KEY_EDGE.split('.') as [string, string];
  const dispositivo = await prisma.dispositivoEdge.create({
    data: {
      idPredio: predio.id,
      nombre: 'Cámara Hato Norte',
      apiKeyPrefijo: prefijo,
      apiKeyHash: await bcrypt.hash(secreto, 10),
      conteoEsperado: 47,
      ultimoConteo: 47,
      // Dentro de MINUTOS_EN_LINEA, para que la demo arranque con la camara en
      // linea y se pueda entrar a la vista en vivo.
      ultimoHeartbeat: new Date(Date.now() - 60 * 1000),
    },
  });

  const alertas: Array<{
    tipo: TipoAlerta;
    descripcion: string;
    nivel: 'INFO' | 'ADVERTENCIA' | 'CRITICA';
    conteo: number;
    fecha: Date;
  }> = [
    {
      tipo: 'AMENAZA',
      descripcion: 'Movimiento no identificado en el perímetro',
      nivel: 'CRITICA',
      conteo: 47,
      fecha: aHoraLocal(ayer, 23, 15),
    },
    {
      tipo: 'CONTEO',
      descripcion: 'Conteo normal del rebaño',
      nivel: 'INFO',
      conteo: 47,
      fecha: aHoraLocal(ayer, 18, 0),
    },
  ];

  for (const a of alertas) {
    await prisma.alerta.create({
      data: {
        idPredio: predio.id,
        idDispositivoEdge: dispositivo.id,
        tipoAlerta: a.tipo,
        descripcion: a.descripcion,
        nivel: a.nivel,
        conteoAnimales: a.conteo,
        conteoEsperado: 47,
        fechaHora: a.fecha,
        estado: a.tipo === 'CONTEO' ? 'REVISADA' : 'NUEVA',
        ...(a.tipo === 'CONTEO'
          ? { idRevisadoPor: manuel.id, fechaRevision: aHoraLocal(ayer, 19, 0) }
          : {}),
      },
    });
  }

  console.log(`
Datos semilla listos.

  Predio            ${predio.nombre}
  Animales activos  47   (inactivos: ${bajas.length})
  Usuarios          manuel@oviapp.cl  (PRODUCTOR)
                    rosa@oviapp.cl    (TRABAJADOR)
                    pedro@oviapp.cl   (TRABAJADOR)
                    carmen@oviapp.cl  (PRODUCTOR de otro predio, para probar RNF_08)
  Contraseña        ${PASSWORD_DEMO}
  API key edge      ${API_KEY_EDGE}
`);

  async function crearAltaBitacora(idAnimal: string, idUsuario: string, numeroOreja: string) {
    await prisma.bitacoraEntrada.create({
      data: {
        idAnimal,
        idUsuario,
        tipo: 'ALTA',
        titulo: `Alta del animal #${numeroOreja}`,
        descripcion: 'Ingreso al rebaño con sus datos iniciales.',
        datos: { numeroOreja },
      },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e: unknown) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

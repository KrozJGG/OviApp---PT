import http from 'node:http';
import bcrypt from 'bcryptjs';
import { crearApp, PREFIJO_API } from '../../src/app';
import { clienteDe } from './cliente';
import { prisma } from '../../src/config/prisma';
import type { RolUsuario } from '../../src/generated/prisma/enums';
import { evaluadorAlertasService } from '../../src/modules/alertas/evaluadorAlertas.servicio';
import { cerrarSocket, inicializarSocket } from '../../src/realtime/socket';

/**
 * Escenario base compartido por toda la suite.
 *
 * Deliberadamente incluye un SEGUNDO predio con su propio productor y su propio
 * animal: casi todos los tests de aislamiento (RNF_08) consisten en pedir con el
 * token de un predio un recurso del otro y exigir 404.
 */

export const PASSWORD = 'Prueba2026!';
export const API_KEY_EDGE = 'edge_test.clave-secreta-de-prueba';

export interface Escenario {
  /**
   * Servidor HTTP compartido, ya escuchando, y no la app de Express suelta: un
   * unico listener de larga vida, igual que en produccion. Ver el encabezado de
   * `cliente.ts` para el porque.
   */
  app: http.Server;
  predioA: { id: string; nombre: string };
  predioB: { id: string; nombre: string };
  productor: { id: string; email: string; token: string };
  trabajador: { id: string; email: string; token: string };
  ajeno: { id: string; email: string; token: string };
  animal: { id: string; numeroOreja: string };
  animalAjeno: { id: string; numeroOreja: string };
  dispositivoEdge: { id: string; apiKey: string };
}

let servidorCacheado: http.Server | undefined;

/**
 * Levanta una sola vez el servidor del proceso de test en un puerto libre.
 * `unref()` evita que el listener abierto impida al worker terminar.
 */
async function servidor(): Promise<http.Server> {
  if (!servidorCacheado) {
    const s = http.createServer(crearApp());
    inicializarSocket(s);
    await new Promise<void>((listo) => s.listen(0, '127.0.0.1', () => listo()));
    s.unref();
    servidorCacheado = s;
  }
  return servidorCacheado;
}

/** Cierra el servidor compartido. Opcional: `unref()` ya permite salir. */
export async function cerrarServidor(): Promise<void> {
  if (!servidorCacheado) return;
  const s = servidorCacheado;
  servidorCacheado = undefined;
  await cerrarSocket();
  await new Promise<void>((listo) => s.close(() => listo()));
}

/** Deja la base vacia. TRUNCATE no dispara el trigger append-only de RF_06. */
export async function limpiarBd(): Promise<void> {
  evaluadorAlertasService.reiniciarEstado();
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "alerta", "bitacora_entrada", "evento_animal", "tarea_animal", "tarea_usuario",
      "evento", "tarea", "animal", "dispositivo_edge",
      "dispositivo_usuario", "refresh_token", "usuario", "predio"
    RESTART IDENTITY CASCADE
  `);
}

export async function crearEscenario(): Promise<Escenario> {
  await limpiarBd();

  const hash = await bcrypt.hash(PASSWORD, 4);

  const predioA = await prisma.predio.create({ data: { nombre: 'Predio A' } });
  const predioB = await prisma.predio.create({ data: { nombre: 'Predio B' } });

  const productor = await prisma.usuario.create({
    data: {
      idPredio: predioA.id,
      nombre: 'Productora A',
      email: 'productor@test.cl',
      passwordHash: hash,
      rol: 'PRODUCTOR',
    },
  });

  const trabajador = await prisma.usuario.create({
    data: {
      idPredio: predioA.id,
      nombre: 'Trabajador A',
      email: 'trabajador@test.cl',
      passwordHash: hash,
      rol: 'TRABAJADOR',
    },
  });

  const ajeno = await prisma.usuario.create({
    data: {
      idPredio: predioB.id,
      nombre: 'Productor B',
      email: 'ajeno@test.cl',
      passwordHash: hash,
      rol: 'PRODUCTOR',
    },
  });

  const animal = await prisma.animal.create({
    data: {
      idPredio: predioA.id,
      numeroOreja: '0001',
      idRegistrador: productor.id,
      sexo: 'HEMBRA',
      raza: 'Suffolk',
      color: 'Blanco',
      pesoKg: 45,
    },
  });

  const animalAjeno = await prisma.animal.create({
    data: {
      idPredio: predioB.id,
      numeroOreja: '9001',
      idRegistrador: ajeno.id,
      sexo: 'MACHO',
      raza: 'Merino',
      pesoKg: 60,
    },
  });

  const [prefijo, secreto] = API_KEY_EDGE.split('.') as [string, string];
  const dispositivoEdge = await prisma.dispositivoEdge.create({
    data: {
      idPredio: predioA.id,
      nombre: 'Camara de prueba',
      apiKeyPrefijo: prefijo,
      apiKeyHash: await bcrypt.hash(secreto, 4),
    },
  });

  const instancia = await servidor();

  return {
    app: instancia,
    predioA: { id: predioA.id, nombre: predioA.nombre },
    predioB: { id: predioB.id, nombre: predioB.nombre },
    productor: { id: productor.id, email: productor.email, token: await iniciarSesion(instancia, productor.email) },
    trabajador: { id: trabajador.id, email: trabajador.email, token: await iniciarSesion(instancia, trabajador.email) },
    ajeno: { id: ajeno.id, email: ajeno.email, token: await iniciarSesion(instancia, ajeno.email) },
    animal: { id: animal.id, numeroOreja: animal.numeroOreja },
    animalAjeno: { id: animalAjeno.id, numeroOreja: animalAjeno.numeroOreja },
    dispositivoEdge: { id: dispositivoEdge.id, apiKey: API_KEY_EDGE },
  };
}

/** Obtiene un access token por el endpoint real de login (IF6-ENT). */
export async function iniciarSesion(
  instancia: http.Server,
  email: string,
  password = PASSWORD,
): Promise<string> {
  const r = await api(instancia).post('/auth/login').send({ email, password });
  if (r.status !== 200) {
    throw new Error(`No se pudo iniciar sesion como ${email}: ${r.status} ${JSON.stringify(r.body)}`);
  }
  return r.body.accessToken as string;
}

/** Cliente con el prefijo /api/v1 ya aplicado y el token puesto. */
export function api(instancia: http.Server, token?: string) {
  return clienteDe(
    instancia,
    PREFIJO_API,
    token ? { authorization: `Bearer ${token}` } : {},
  );
}

export async function crearUsuario(args: {
  idPredio: string;
  email: string;
  rol?: RolUsuario;
  nombre?: string;
  estado?: 'HABILITADO' | 'INHABILITADO';
}) {
  return prisma.usuario.create({
    data: {
      idPredio: args.idPredio,
      nombre: args.nombre ?? 'Usuario de prueba',
      email: args.email,
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      rol: args.rol ?? 'TRABAJADOR',
      estado: args.estado ?? 'HABILITADO',
    },
  });
}

export async function crearAnimal(args: {
  idPredio: string;
  idRegistrador: string;
  numeroOreja: string;
  estado?: 'ACTIVO' | 'INACTIVO';
}) {
  return prisma.animal.create({
    data: {
      idPredio: args.idPredio,
      idRegistrador: args.idRegistrador,
      numeroOreja: args.numeroOreja,
      sexo: 'HEMBRA',
      raza: 'Corriedale',
      pesoKg: 42,
      ...(args.estado === 'INACTIVO'
        ? { estado: 'INACTIVO' as const, motivoBaja: 'VENTA' as const, fechaBaja: new Date('2026-01-15T00:00:00.000Z') }
        : {}),
    },
  });
}

/** Fecha ISO (YYYY-MM-DD) desplazada respecto de hoy. Util para fechas limite. */
export function fechaRelativa(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

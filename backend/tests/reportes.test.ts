import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { aFechaSolo, fechaLocalISO, inicioDelDia } from '../src/shared/fechas';
import { api, crearEscenario, type Escenario } from './apoyo/fixtures';

/**
 * Modulo 8 - Reportes y Paneles de Informacion (RF23, RF24 / IF4-SAL).
 */
describe('Modulo 8 - Reportes y Paneles de Informacion (RF23, RF24)', () => {
  let e: Escenario;

  beforeEach(async () => {
    e = await crearEscenario();
  });

  // ── Control de acceso y validacion ────────────────────────────────────────
  describe('Seguridad y validacion de parametros', () => {
    it('responde 401 sin token en resumen y exportar', async () => {
      const r1 = await api(e.app).get('/reportes/resumen');
      const r2 = await api(e.app).get('/reportes/exportar?formato=pdf');
      expect(r1.status).toBe(401);
      expect(r2.status).toBe(401);
    });

    it('rechaza con 403 al Trabajador en resumen y exportar', async () => {
      const r1 = await api(e.app, e.trabajador.token).get('/reportes/resumen');
      const r2 = await api(e.app, e.trabajador.token).get('/reportes/exportar?formato=csv');
      expect(r1.status).toBe(403);
      expect(r2.status).toBe(403);
    });

    it('rechaza con 400 formato invalido o fecha mal formada', async () => {
      const rFecha = await api(e.app, e.productor.token).get('/reportes/resumen?desde=01-01-2026');
      expect(rFecha.status).toBe(400);
      expect(rFecha.body.error.codigo).toBe('VALIDACION');

      const rFormato = await api(e.app, e.productor.token).get('/reportes/exportar?formato=xlsx');
      expect(rFormato.status).toBe(400);
      expect(rFormato.body.error.codigo).toBe('VALIDACION');
    });

    it('rechaza con 422 RANGO_INVALIDO cuando hasta < desde o supera 366 dias', async () => {
      const invertido = await api(e.app, e.productor.token).get(
        '/reportes/resumen?desde=2026-06-01&hasta=2026-05-01',
      );
      expect(invertido.status).toBe(422);
      expect(invertido.body.error.codigo).toBe('RANGO_INVALIDO');

      const largo = await api(e.app, e.productor.token).get(
        '/reportes/resumen?desde=2025-01-01&hasta=2026-01-05',
      );
      expect(largo.status).toBe(422);
      expect(largo.body.error.codigo).toBe('RANGO_INVALIDO');
    });
  });

  // ── Consolidacion mensual (RF23) ──────────────────────────────────────────
  describe('GET /reportes/resumen (RF23)', () => {
    it('consolida bajas por mes y motivo, tareas cumplidas, eventos sanitarios y eventos IA', async () => {
      // Escenario ya tiene 1 animal activo (0001, HEMBRA, Suffolk, 45 kg).
      // Agregamos 1 macho activo (55 kg) y 3 bajas en meses distintos.
      const macho = await prisma.animal.create({
        data: {
          idPredio: e.predioA.id,
          idRegistrador: e.productor.id,
          numeroOreja: '0010',
          sexo: 'MACHO',
          raza: 'Merino',
          pesoKg: 55,
          createdAt: inicioDelDia('2026-02-10'),
        },
      });

      await prisma.animal.createMany({
        data: [
          {
            idPredio: e.predioA.id,
            idRegistrador: e.productor.id,
            numeroOreja: '0020',
            sexo: 'HEMBRA',
            estado: 'INACTIVO',
            motivoBaja: 'VENTA',
            fechaBaja: aFechaSolo('2026-01-15'),
            createdAt: inicioDelDia('2025-08-01'),
          },
          {
            idPredio: e.predioA.id,
            idRegistrador: e.productor.id,
            numeroOreja: '0021',
            sexo: 'HEMBRA',
            estado: 'INACTIVO',
            motivoBaja: 'MUERTE',
            fechaBaja: aFechaSolo('2026-01-22'),
            createdAt: inicioDelDia('2025-08-01'),
          },
          {
            idPredio: e.predioA.id,
            idRegistrador: e.productor.id,
            numeroOreja: '0022',
            sexo: 'MACHO',
            estado: 'INACTIVO',
            motivoBaja: 'FAENA',
            fechaBaja: aFechaSolo('2026-03-05'),
            createdAt: inicioDelDia('2025-08-01'),
          },
        ],
      });

      // Eventos: 1 sanitario en enero (2 animales), 1 esquila en marzo (1 animal), 1 eliminado (ignorado)
      await prisma.evento.create({
        data: {
          idPredio: e.predioA.id,
          idCreador: e.productor.id,
          tipo: 'ATENCION_SANITARIA',
          estado: 'REALIZADO',
          fechaInicio: inicioDelDia('2026-01-20'),
          animales: { create: [{ idAnimal: e.animal.id }, { idAnimal: macho.id }] },
        },
      });
      await prisma.evento.create({
        data: {
          idPredio: e.predioA.id,
          idCreador: e.productor.id,
          tipo: 'ESQUILA',
          estado: 'PROGRAMADO',
          fechaInicio: inicioDelDia('2026-03-12'),
          animales: { create: [{ idAnimal: e.animal.id }] },
        },
      });
      await prisma.evento.create({
        data: {
          idPredio: e.predioA.id,
          idCreador: e.productor.id,
          tipo: 'OTRO',
          estado: 'ELIMINADO',
          eliminadoEn: inicioDelDia('2026-02-05'),
          fechaInicio: inicioDelDia('2026-02-04'),
        },
      });

      // Notas y modificaciones en bitacora
      await prisma.bitacoraEntrada.createMany({
        data: [
          {
            idAnimal: e.animal.id,
            idUsuario: e.trabajador.id,
            tipo: 'NOTA',
            titulo: 'Observacion de campo',
            fechaEvento: inicioDelDia('2026-02-15'),
          },
          {
            idAnimal: macho.id,
            idUsuario: e.productor.id,
            tipo: 'MODIFICACION',
            titulo: 'Actualizacion de peso',
            fechaEvento: inicioDelDia('2026-02-16'),
          },
        ],
      });

      // Tareas: 1 completada a tiempo (enero), 1 completada atrasada (febrero), 1 vencida (marzo)
      await prisma.tarea.create({
        data: {
          idPredio: e.predioA.id,
          idCreador: e.productor.id,
          titulo: 'Vacunar lote',
          fechaLimite: aFechaSolo('2026-01-18'),
          estado: 'COMPLETADA',
          completadaEn: inicioDelDia('2026-01-17'),
          idCompletadaPor: e.trabajador.id,
          responsables: { create: [{ idUsuario: e.trabajador.id }] },
        },
      });
      await prisma.tarea.create({
        data: {
          idPredio: e.predioA.id,
          idCreador: e.productor.id,
          titulo: 'Reparar cerco',
          fechaLimite: aFechaSolo('2026-02-10'),
          estado: 'COMPLETADA',
          completadaEn: inicioDelDia('2026-02-12'),
          idCompletadaPor: e.trabajador.id,
          responsables: { create: [{ idUsuario: e.trabajador.id }] },
        },
      });
      await prisma.tarea.create({
        data: {
          idPredio: e.predioA.id,
          idCreador: e.productor.id,
          titulo: 'Limpiar bebederos',
          fechaLimite: aFechaSolo('2026-03-01'),
          estado: 'ACTIVA',
          responsables: { create: [{ idUsuario: e.productor.id }] },
        },
      });

      // Eventos de vigilancia IA en enero y febrero
      await prisma.eventoVigilancia.createMany({
        data: [
          {
            idPredio: e.predioA.id,
            idDispositivo: e.dispositivoEdge.id,
            tipo: 'DISCREPANCIA_CONTEO',
            conteoDetectado: 1,
            animalesActivos: 2,
            diferencia: 1,
            ocurridoEn: inicioDelDia('2026-01-25'),
          },
          {
            idPredio: e.predioA.id,
            idDispositivo: e.dispositivoEdge.id,
            tipo: 'DESCONEXION',
            conteoDetectado: 2,
            animalesActivos: 2,
            diferencia: 0,
            ocurridoEn: inicioDelDia('2026-02-14'),
          },
        ],
      });

      const r = await api(e.app, e.productor.token).get(
        '/reportes/resumen?desde=2026-01-01&hasta=2026-03-31',
      );

      expect(r.status).toBe(200);
      expect(r.body.predio.nombre).toBe('Predio A');
      expect(r.body.periodo).toEqual({ desde: '2026-01-01', hasta: '2026-03-31', meses: 3 });

      // Inventario
      expect(r.body.inventario).toMatchObject({
        activos: 2,
        inactivos: 3,
        totalHistorico: 5,
        machos: 1,
        hembras: 1,
        pesoPromedioKg: 50,
        pesoTotalKg: 100,
        bajasPeriodo: { total: 3, venta: 1, muerte: 1, faena: 1 },
        tasaMortalidadPct: 20, // 1 / (2 + 3) = 20%
        tasaExtraccionPct: 40, // (1 + 1) / 5 = 40%
      });

      // Eventos
      expect(r.body.eventos).toMatchObject({
        total: 2,
        programados: 1,
        realizados: 1,
        porTipo: { ATENCION_SANITARIA: 1, ESQUILA: 1, ENCASTE: 0, OTRO: 0 },
        animalesAtendidosPorTipo: { ATENCION_SANITARIA: 2, ESQUILA: 1, ENCASTE: 0, OTRO: 0 },
        notasBitacora: 1,
        modificacionesBitacora: 1,
      });

      // Tareas
      expect(r.body.tareas).toMatchObject({
        totalPeriodo: 3,
        completadasPeriodo: 2,
        vencidas: 1,
        completadasATiempo: 1,
        completadasAtrasadas: 1,
        tasaCumplimientoPct: 66.7,
        tasaATiempoPct: 50,
      });
      expect(r.body.tareas.porResponsable).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            idUsuario: e.trabajador.id,
            asignadas: 2,
            completadas: 2,
            tasaCumplimientoPct: 100,
          }),
        ]),
      );

      // Vigilancia IA
      expect(r.body.vigilancia.eventosPeriodo).toEqual({
        total: 2,
        discrepancias: 1,
        desconexiones: 1,
        promedioDiferenciaCabezas: 1,
      });

      // Serie mensual continua (Ene, Feb, Mar)
      expect(r.body.serieMensual).toHaveLength(3);
      expect(r.body.serieMensual[0]).toMatchObject({
        mes: '2026-01',
        bajasTotal: 2,
        bajasVenta: 1,
        bajasMuerte: 1,
        bajasFaena: 0,
        tareasCompletadas: 1,
        tareasATiempo: 1,
        eventosSanitarios: 1,
        discrepanciasIA: 1,
      });
      expect(r.body.serieMensual[1]).toMatchObject({
        mes: '2026-02',
        altas: 1,
        bajasTotal: 0,
        tareasCompletadas: 1,
        tareasATiempo: 0,
        desconexionesIA: 1,
      });
      expect(r.body.serieMensual[2]).toMatchObject({
        mes: '2026-03',
        bajasTotal: 1,
        bajasFaena: 1,
        tareasVencidas: 1,
        eventosProductivos: 1,
      });
    });

    it('registra discrepancia IA desde heartbeat con cooldown y desconexion automaticamente', async () => {
      // Predio A tiene 1 animal activo: conteoActual 0 genera discrepancia.
      const h1 = await api(e.app)
        .post('/edge/heartbeat')
        .set('X-Edge-Key', e.dispositivoEdge.apiKey)
        .send({ conteoActual: 0 });
      expect(h1.status).toBe(204);

      // Un segundo heartbeat inmediato dentro del cooldown NO debe duplicar el evento.
      const h2 = await api(e.app)
        .post('/edge/heartbeat')
        .set('X-Edge-Key', e.dispositivoEdge.apiKey)
        .send({ conteoActual: 0 });
      expect(h2.status).toBe(204);

      const d1 = await api(e.app)
        .post('/edge/desconexion')
        .set('X-Edge-Key', e.dispositivoEdge.apiKey)
        .send({});
      expect(d1.status).toBe(204);

      const hoy = fechaLocalISO();
      const r = await api(e.app, e.productor.token).get(
        `/reportes/resumen?desde=${hoy}&hasta=${hoy}`,
      );

      expect(r.status).toBe(200);
      expect(r.body.vigilancia.eventosPeriodo).toEqual({
        total: 2,
        discrepancias: 1,
        desconexiones: 1,
        promedioDiferenciaCabezas: 1,
      });
    });

    it('aisla estrictamente los datos por predio (RNF08)', async () => {
      await prisma.eventoVigilancia.create({
        data: {
          idPredio: e.predioA.id,
          idDispositivo: e.dispositivoEdge.id,
          tipo: 'DISCREPANCIA_CONTEO',
          conteoDetectado: 0,
          animalesActivos: 1,
          diferencia: 1,
          ocurridoEn: inicioDelDia('2026-02-10'),
        },
      });

      const r = await api(e.app, e.ajeno.token).get(
        '/reportes/resumen?desde=2026-02-01&hasta=2026-02-28',
      );
      expect(r.status).toBe(200);
      expect(r.body.predio.nombre).toBe('Predio B');
      expect(r.body.inventario.activos).toBe(1);
      expect(r.body.vigilancia.eventosPeriodo.total).toBe(0);
      expect(r.body.vigilancia.dispositivos).toEqual([]);
    });
  });

  // ── Exportacion PDF y CSV (RF24 / IF4-SAL) ────────────────────────────────
  describe('GET /reportes/exportar (RF24 / IF4-SAL)', () => {
    it('exporta CSV UTF-8 con BOM y cabeceras de descarga', async () => {
      const r = await api(e.app, e.productor.token).get(
        '/reportes/exportar?desde=2026-01-01&hasta=2026-03-31&formato=csv',
      );

      expect(r.status).toBe(200);
      expect(r.headers['content-type']).toContain('text/csv');
      expect(r.headers['content-disposition']).toContain('oviapp-reporte-2026-01-01_a_2026-03-31.csv');
      // Verifica BOM UTF-8 (EF BB BF)
      expect(r.bytes[0]).toBe(0xef);
      expect(r.bytes[1]).toBe(0xbb);
      expect(r.bytes[2]).toBe(0xbf);
      expect(r.text).toContain('REPORTE CONSOLIDADO DEL PREDIO - OVIAPP');
      expect(r.text).toContain('Predio A');
      expect(r.text).toContain('Ene 2026');
      expect(r.text).toContain('Mar 2026');
    });

    it('exporta PDF 1.4 valido con cabeceras de descarga', async () => {
      const r = await api(e.app, e.productor.token).get(
        '/reportes/exportar?desde=2026-01-01&hasta=2026-03-31&formato=pdf',
      );

      expect(r.status).toBe(200);
      expect(r.headers['content-type']).toContain('application/pdf');
      expect(r.headers['content-disposition']).toContain('oviapp-reporte-2026-01-01_a_2026-03-31.pdf');

      const contenidoLatin1 = Buffer.from(r.bytes).toString('latin1');
      expect(contenidoLatin1.startsWith('%PDF-1.4')).toBe(true);
      expect(contenidoLatin1.trimEnd().endsWith('%%EOF')).toBe(true);
      expect(contenidoLatin1).toContain('OviApp - Reporte Consolidado del Predio');
      expect(contenidoLatin1).toContain('Predio A');
    });
  });
});

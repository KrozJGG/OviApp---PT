import { describe, expect, it } from 'vitest';
import type { ClienteDb } from '../src/shared/db';
import type { EmisorAlertas, EventoAlertaWs } from '../src/realtime/socket';
import { EvaluadorAlertasService } from '../src/modules/alertas/evaluadorAlertas.servicio';

interface FilaAlertaFake {
  id: string;
  idPredio: string;
  idDispositivoEdge: string;
  tipo: 'CONTEO';
  estado: 'PENDIENTE' | 'RESUELTA' | 'DESCARTADA';
  conteoDetectado: number;
  conteoEsperado: number;
  descripcion: string;
  fechaDeteccion: Date;
  normalizadaEn: Date | null;
  idRevisadoPor: string | null;
  fechaRevision: Date | null;
  createdAt: Date;
  updatedAt: Date;
  dispositivoEdge: { id: string; nombre: string };
  revisadoPor: { id: string; nombre: string } | null;
}

interface EventoEmitido {
  idPredio: string;
  evento: EventoAlertaWs;
  payload: Record<string, unknown>;
}

function crearEntornoUnitario(opciones?: {
  heartbeatsConfirmacion?: number;
  heartbeatsNormalizacion?: number;
  renotificacionSeg?: number;
}) {
  const filas: FilaAlertaFake[] = [];
  const eventos: EventoEmitido[] = [];
  let relojMs = Date.parse('2026-11-27T12:00:00.000Z');
  let secuencia = 1;

  const dbFake = {
    alerta: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        return (
          filas.find(
            (f) =>
              f.idDispositivoEdge === where.idDispositivoEdge &&
              f.idPredio === where.idPredio &&
              f.tipo === where.tipo &&
              f.estado === where.estado,
          ) ?? null
        );
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const ahora = new Date(relojMs);
        const nueva: FilaAlertaFake = {
          id: `alerta-${secuencia++}`,
          idPredio: data.idPredio as string,
          idDispositivoEdge: data.idDispositivoEdge as string,
          tipo: 'CONTEO',
          estado: 'PENDIENTE',
          conteoDetectado: data.conteoDetectado as number,
          conteoEsperado: data.conteoEsperado as number,
          descripcion: data.descripcion as string,
          fechaDeteccion: (data.fechaDeteccion as Date) ?? ahora,
          normalizadaEn: null,
          idRevisadoPor: null,
          fechaRevision: null,
          createdAt: ahora,
          updatedAt: ahora,
          dispositivoEdge: {
            id: data.idDispositivoEdge as string,
            nombre: 'Camara Corral 1',
          },
          revisadoPor: null,
        };
        filas.push(nueva);
        return nueva;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const fila = filas.find((f) => f.id === where.id);
        if (!fila) throw new Error('No encontrada');
        if ('normalizadaEn' in data) {
          fila.normalizadaEn = data.normalizadaEn as Date | null;
        }
        fila.updatedAt = new Date(relojMs);
        return fila;
      },
    },
  } as unknown as ClienteDb;

  const emisor: EmisorAlertas = {
    emitirAPredio: (idPredio, evento, payload) => {
      eventos.push({ idPredio, evento, payload: payload as Record<string, unknown> });
    },
  };

  const evaluador = new EvaluadorAlertasService({
    db: dbFake,
    emisor,
    ahora: () => new Date(relojMs),
    heartbeatsConfirmacion: opciones?.heartbeatsConfirmacion ?? 3,
    heartbeatsNormalizacion: opciones?.heartbeatsNormalizacion ?? 2,
    renotificacionSeg: opciones?.renotificacionSeg ?? 60,
  });

  const avanzarSeg = (seg: number) => {
    relojMs += seg * 1000;
  };

  const latido = (conteoDetectado: number, conteoEsperado = 40) =>
    evaluador.evaluarConteo({
      idDispositivoEdge: 'disp-1',
      idPredio: 'predio-1',
      conteoDetectado,
      conteoEsperado,
    });

  return { evaluador, filas, eventos, avanzarSeg, latido };
}

describe('EvaluadorAlertasService (unitarias)', () => {
  it('exige 3 heartbeats consecutivos con deficit para crear la alerta y emitir alerta:nueva', async () => {
    const { filas, eventos, latido } = crearEntornoUnitario();

    const r1 = await latido(38, 40);
    const r2 = await latido(38, 40);
    expect(r1).toEqual({ accion: 'ACUMULANDO_DEFICIT', heartbeatsConDeficit: 1 });
    expect(r2).toEqual({ accion: 'ACUMULANDO_DEFICIT', heartbeatsConDeficit: 2 });
    expect(filas).toHaveLength(0);
    expect(eventos).toHaveLength(0);

    const r3 = await latido(38, 40);
    expect(r3.accion).toBe('ALERTA_CREADA');
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      tipo: 'CONTEO',
      estado: 'PENDIENTE',
      conteoDetectado: 38,
      conteoEsperado: 40,
      normalizadaEn: null,
    });
    expect(eventos).toHaveLength(1);
    expect(eventos[0]?.evento).toBe('alerta:nueva');
    expect(eventos[0]?.idPredio).toBe('predio-1');
  });

  it('reinicia el contador a 0 si el conteo se normaliza antes del 3er heartbeat (oclusion)', async () => {
    const { filas, eventos, latido } = crearEntornoUnitario();

    await latido(37, 40);
    await latido(37, 40);
    const normal = await latido(40, 40);
    expect(normal).toEqual({ accion: 'SIN_CAMBIOS' });

    const r1 = await latido(37, 40);
    const r2 = await latido(37, 40);
    expect(r1).toEqual({ accion: 'ACUMULANDO_DEFICIT', heartbeatsConDeficit: 1 });
    expect(r2).toEqual({ accion: 'ACUMULANDO_DEFICIT', heartbeatsConDeficit: 2 });
    expect(filas).toHaveLength(0);
    expect(eventos).toHaveLength(0);
  });

  it('no duplica filas y re-notifica cada 60 s sin limite mientras persista el deficit', async () => {
    const { filas, eventos, avanzarSeg, latido } = crearEntornoUnitario();

    await latido(38, 40);
    await latido(38, 40);
    await latido(38, 40);
    expect(filas).toHaveLength(1);
    expect(eventos).toHaveLength(1);

    // Antes de 60 s no re-notifica.
    avanzarSeg(30);
    expect((await latido(38, 40)).accion).toBe('EN_ESPERA_RENOTIFICACION');
    avanzarSeg(29);
    expect((await latido(38, 40)).accion).toBe('EN_ESPERA_RENOTIFICACION');
    expect(eventos).toHaveLength(1);

    // A los 60 s exactos emite primer recordatorio.
    avanzarSeg(1);
    expect((await latido(37, 40)).accion).toBe('RECORDATORIO_EMITIDO');
    expect(eventos).toHaveLength(2);
    expect(eventos[1]?.evento).toBe('alerta:recordatorio');
    expect(eventos[1]?.payload.conteoActualDetectado).toBe(37);

    // A los 120 s y 180 s sigue re-notificando sin limite ni duplicar filas.
    avanzarSeg(60);
    expect((await latido(36, 40)).accion).toBe('RECORDATORIO_EMITIDO');
    avanzarSeg(60);
    expect((await latido(36, 40)).accion).toBe('RECORDATORIO_EMITIDO');

    expect(filas).toHaveLength(1);
    expect(eventos.filter((e) => e.evento === 'alerta:recordatorio')).toHaveLength(3);
  });

  it('un solo heartbeat normal no silencia un deficit real en curso', async () => {
    const { filas, eventos, avanzarSeg, latido } = crearEntornoUnitario();

    await latido(38, 40);
    await latido(38, 40);
    await latido(38, 40);

    // 1 solo heartbeat normal -> NORMALIZANDO (1/2), todavia no silencia.
    avanzarSeg(5);
    const n1 = await latido(40, 40);
    expect(n1).toEqual({ accion: 'NORMALIZANDO', heartbeatsNormales: 1 });
    expect(filas[0]?.normalizadaEn).toBeNull();

    // Vuelve el deficit -> reinicia contador normal y sigue recordando a los 60 s.
    avanzarSeg(55);
    const rec = await latido(38, 40);
    expect(rec.accion).toBe('RECORDATORIO_EMITIDO');
    expect(filas[0]?.normalizadaEn).toBeNull();
    expect(eventos.map((e) => e.evento)).toEqual(['alerta:nueva', 'alerta:recordatorio']);
  });

  it('tras 2 heartbeats consecutivos normalizados silencia la alerta para siempre manteniendo PENDIENTE', async () => {
    const { filas, eventos, avanzarSeg, latido } = crearEntornoUnitario();

    await latido(38, 40);
    await latido(38, 40);
    await latido(38, 40);

    avanzarSeg(5);
    expect(await latido(40, 40)).toEqual({ accion: 'NORMALIZANDO', heartbeatsNormales: 1 });

    avanzarSeg(5);
    const n2 = await latido(40, 40);
    expect(n2.accion).toBe('ALERTA_NORMALIZADA');
    expect(filas[0]?.estado).toBe('PENDIENTE');
    expect(filas[0]?.normalizadaEn).not.toBeNull();
    expect(eventos[1]?.evento).toBe('alerta:actualizada');

    // Aunque pasen > 60 s y vuelvan heartbeats con deficit, esa alerta NO vuelve a sonar.
    avanzarSeg(120);
    expect((await latido(35, 40)).accion).toBe('SILENCIADA_PERMANENTE');
    avanzarSeg(120);
    expect((await latido(35, 40)).accion).toBe('SILENCIADA_PERMANENTE');
    expect(filas).toHaveLength(1);
    expect(eventos.filter((e) => e.evento === 'alerta:recordatorio')).toHaveLength(0);
  });

  it('al resolver/descartar y limpiar seguimiento vuelve a exigir 3 heartbeats para una alerta nueva', async () => {
    const { evaluador, filas, eventos, latido } = crearEntornoUnitario();

    await latido(38, 40);
    await latido(38, 40);
    await latido(38, 40);
    expect(filas).toHaveLength(1);

    // Simulamos que un usuario marco la alerta como RESUELTA.
    filas[0]!.estado = 'RESUELTA';
    evaluador.limpiarSeguimientoDispositivo('disp-1');

    expect(await latido(38, 40)).toEqual({ accion: 'ACUMULANDO_DEFICIT', heartbeatsConDeficit: 1 });
    expect(await latido(38, 40)).toEqual({ accion: 'ACUMULANDO_DEFICIT', heartbeatsConDeficit: 2 });
    expect((await latido(38, 40)).accion).toBe('ALERTA_CREADA');
    expect(filas).toHaveLength(2);
    expect(eventos.filter((e) => e.evento === 'alerta:nueva')).toHaveLength(2);
  });

  it('no dispara alertas si el predio no tiene animales activos (conteoEsperado = 0)', async () => {
    const { filas, eventos, latido } = crearEntornoUnitario();

    expect(await latido(0, 0)).toEqual({ accion: 'SIN_CAMBIOS' });
    expect(await latido(0, 0)).toEqual({ accion: 'SIN_CAMBIOS' });
    expect(await latido(0, 0)).toEqual({ accion: 'SIN_CAMBIOS' });
    expect(filas).toHaveLength(0);
    expect(eventos).toHaveLength(0);
  });
});

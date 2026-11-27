import { prisma } from '../../shared/db';
import { ErrorReglaNegocio } from '../../shared/errores';
import { aFechaSolo, diferenciaDias, fechaLocalISO, finDelDia, inicioDelDia } from '../../shared/fechas';
import { estaEnLinea } from '../alertas/alertas.servicio';

/**
 * Modulo 8 - Reportes y Paneles de Informacion (RF23, RF24).
 *
 * Consolida los indicadores productivos, sanitarios, operativos y de vigilancia
 * del predio dentro de un rango de hasta 12 meses, garantizando aislamiento
 * estricto por `idPredio` (RNF08) y series mensuales continuas sin huecos.
 */

export const DIAS_MAXIMOS_REPORTE = 366;

const MESES_CORTOS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
] as const;

export interface SerieMensualReporte {
  mes: string;
  etiqueta: string;
  altas: number;
  bajasTotal: number;
  bajasVenta: number;
  bajasMuerte: number;
  bajasFaena: number;
  tareasCompletadas: number;
  tareasATiempo: number;
  tareasVencidas: number;
  eventosTotal: number;
  eventosSanitarios: number;
  eventosProductivos: number;
  eventosIA: number;
  discrepanciasIA: number;
  desconexionesIA: number;
}

export interface ResumenReporte {
  predio: {
    nombre: string;
    ubicacion: string | null;
  };
  periodo: {
    desde: string;
    hasta: string;
    meses: number;
  };
  generadoEn: string;
  inventario: {
    activos: number;
    inactivos: number;
    totalHistorico: number;
    machos: number;
    hembras: number;
    pesoPromedioKg: number | null;
    pesoTotalKg: number;
    porRaza: Array<{ raza: string; cantidad: number }>;
    altasPeriodo: number;
    bajasPeriodo: {
      total: number;
      venta: number;
      muerte: number;
      faena: number;
    };
    tasaMortalidadPct: number;
    tasaExtraccionPct: number;
  };
  eventos: {
    total: number;
    programados: number;
    realizados: number;
    porTipo: {
      ENCASTE: number;
      ESQUILA: number;
      ATENCION_SANITARIA: number;
      OTRO: number;
    };
    animalesAtendidosPorTipo: {
      ENCASTE: number;
      ESQUILA: number;
      ATENCION_SANITARIA: number;
      OTRO: number;
    };
    notasBitacora: number;
    modificacionesBitacora: number;
  };
  tareas: {
    totalPeriodo: number;
    completadasPeriodo: number;
    activasPendientes: number;
    vencidas: number;
    completadasATiempo: number;
    completadasAtrasadas: number;
    tasaCumplimientoPct: number;
    tasaATiempoPct: number;
    porResponsable: Array<{
      idUsuario: string;
      nombre: string;
      asignadas: number;
      completadas: number;
      tasaCumplimientoPct: number;
    }>;
  };
  vigilancia: {
    dispositivos: Array<{
      id: string;
      nombre: string;
      enLinea: boolean;
      ultimoConteo: number | null;
      conteoEsperado: number;
      brechaActual: number | null;
      tieneRoi: boolean;
      ultimoHeartbeat: string | null;
    }>;
    eventosPeriodo: {
      total: number;
      discrepancias: number;
      desconexiones: number;
      promedioDiferenciaCabezas: number;
    };
  };
  serieMensual: SerieMensualReporte[];
}

/**
 * Resuelve el rango efectivo del reporte. Sin parametros cubre los ultimos
 * 6 meses calendario (desde el dia 1 de hace 5 meses hasta hoy inclusive).
 */
export function resolverRangoReporte(
  filtros: { desde?: string | undefined; hasta?: string | undefined },
  hoy = fechaLocalISO(),
): { desde: string; hasta: string } {
  const hasta = filtros.hasta ?? hoy;
  const desde = filtros.desde ?? inicioHaceMeses(hasta, 5);

  if (hasta < desde) {
    throw new ErrorReglaNegocio(
      'RANGO_INVALIDO',
      'La fecha final del rango no puede ser anterior a la inicial.',
    );
  }

  if (diferenciaDias(desde, hasta) + 1 > DIAS_MAXIMOS_REPORTE) {
    throw new ErrorReglaNegocio('RANGO_INVALIDO', 'El rango no puede superar un año.');
  }

  return { desde, hasta };
}

export async function obtenerResumenReporte(
  idPredio: string,
  filtros: { desde?: string | undefined; hasta?: string | undefined },
  hoy = fechaLocalISO(),
): Promise<ResumenReporte> {
  const { desde, hasta } = resolverRangoReporte(filtros, hoy);
  const inicioTs = inicioDelDia(desde);
  const finTs = finDelDia(hasta);
  const desdeDate = aFechaSolo(desde);
  const hastaDate = aFechaSolo(hasta);

  const [predio, animales, eventos, entradasBitacora, tareas, dispositivos, eventosVigilancia] =
    await Promise.all([
      prisma.predio.findUniqueOrThrow({
        where: { id: idPredio },
        select: { nombre: true, ubicacion: true },
      }),
      prisma.animal.findMany({
        where: { idPredio },
        select: {
          estado: true,
          sexo: true,
          raza: true,
          pesoKg: true,
          motivoBaja: true,
          fechaBaja: true,
          createdAt: true,
        },
      }),
      prisma.evento.findMany({
        where: {
          idPredio,
          estado: { not: 'ELIMINADO' },
          fechaInicio: { gte: inicioTs, lt: finTs },
        },
        select: {
          tipo: true,
          estado: true,
          fechaInicio: true,
          animales: { select: { idAnimal: true } },
        },
      }),
      prisma.bitacoraEntrada.findMany({
        where: {
          animal: { idPredio },
          tipo: { in: ['NOTA', 'MODIFICACION'] },
          fechaEvento: { gte: inicioTs, lt: finTs },
        },
        select: { tipo: true },
      }),
      prisma.tarea.findMany({
        where: {
          idPredio,
          OR: [
            { fechaLimite: { gte: desdeDate, lte: hastaDate } },
            { estado: 'COMPLETADA', completadaEn: { gte: inicioTs, lt: finTs } },
          ],
        },
        select: {
          estado: true,
          fechaLimite: true,
          completadaEn: true,
          responsables: {
            select: { usuario: { select: { id: true, nombre: true } } },
          },
        },
      }),
      prisma.dispositivoEdge.findMany({
        where: { idPredio },
        select: {
          id: true,
          nombre: true,
          ultimoHeartbeat: true,
          ultimoConteo: true,
          regionInteres: true,
        },
        orderBy: { nombre: 'asc' },
      }),
      prisma.eventoVigilancia.findMany({
        where: {
          idPredio,
          ocurridoEn: { gte: inicioTs, lt: finTs },
        },
        select: {
          tipo: true,
          diferencia: true,
          ocurridoEn: true,
        },
      }),
    ]);

  // ── Inicializar serie mensual continua ──────────────────────────────────
  const serie = construirSerieVacia(desde, hasta);
  const porMes = new Map(serie.map((s) => [s.mes, s]));

  // ── 1. Inventario y dinamica productiva ─────────────────────────────────
  let activos = 0;
  let inactivos = 0;
  let machos = 0;
  let hembras = 0;
  let sumaPesos = 0;
  let cantidadConPeso = 0;
  const conteoRazas = new Map<string, number>();
  let altasPeriodo = 0;
  const bajasPeriodo = { total: 0, venta: 0, muerte: 0, faena: 0 };

  for (const a of animales) {
    if (a.estado === 'ACTIVO') {
      activos += 1;
      if (a.sexo === 'MACHO') machos += 1;
      else hembras += 1;
      if (a.pesoKg !== null) {
        sumaPesos += Number(a.pesoKg);
        cantidadConPeso += 1;
      }
      const raza = a.raza?.trim() || 'Sin especificar';
      conteoRazas.set(raza, (conteoRazas.get(raza) ?? 0) + 1);
    } else {
      inactivos += 1;
    }

    const diaAlta = fechaLocalISO(a.createdAt);
    if (diaAlta >= desde && diaAlta <= hasta) {
      altasPeriodo += 1;
      const fila = porMes.get(diaAlta.slice(0, 7));
      if (fila) fila.altas += 1;
    }

    if (a.estado === 'INACTIVO' && a.fechaBaja) {
      const diaBaja = a.fechaBaja.toISOString().slice(0, 10);
      if (diaBaja >= desde && diaBaja <= hasta) {
        bajasPeriodo.total += 1;
        const fila = porMes.get(diaBaja.slice(0, 7));
        if (fila) fila.bajasTotal += 1;
        if (a.motivoBaja === 'VENTA') {
          bajasPeriodo.venta += 1;
          if (fila) fila.bajasVenta += 1;
        } else if (a.motivoBaja === 'MUERTE') {
          bajasPeriodo.muerte += 1;
          if (fila) fila.bajasMuerte += 1;
        } else if (a.motivoBaja === 'FAENA') {
          bajasPeriodo.faena += 1;
          if (fila) fila.bajasFaena += 1;
        }
      }
    }
  }

  const basePoblacional = activos + bajasPeriodo.total;
  const tasaMortalidadPct = porcentaje(bajasPeriodo.muerte, basePoblacional);
  const tasaExtraccionPct = porcentaje(bajasPeriodo.venta + bajasPeriodo.faena, basePoblacional);

  const porRaza = Array.from(conteoRazas.entries())
    .map(([raza, cantidad]) => ({ raza, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad || a.raza.localeCompare(b.raza));

  // ── 2. Eventos productivos y sanitarios ─────────────────────────────────
  const eventosPorTipo = { ENCASTE: 0, ESQUILA: 0, ATENCION_SANITARIA: 0, OTRO: 0 };
  const animalesUnicos = {
    ENCASTE: new Set<string>(),
    ESQUILA: new Set<string>(),
    ATENCION_SANITARIA: new Set<string>(),
    OTRO: new Set<string>(),
  };
  let programados = 0;
  let realizados = 0;

  for (const ev of eventos) {
    if (ev.estado === 'PROGRAMADO') programados += 1;
    else if (ev.estado === 'REALIZADO') realizados += 1;

    eventosPorTipo[ev.tipo] += 1;
    for (const rel of ev.animales) {
      animalesUnicos[ev.tipo].add(rel.idAnimal);
    }

    const mesEv = fechaLocalISO(ev.fechaInicio).slice(0, 7);
    const fila = porMes.get(mesEv);
    if (fila) {
      fila.eventosTotal += 1;
      if (ev.tipo === 'ATENCION_SANITARIA') fila.eventosSanitarios += 1;
      else fila.eventosProductivos += 1;
    }
  }

  let notasBitacora = 0;
  let modificacionesBitacora = 0;
  for (const b of entradasBitacora) {
    if (b.tipo === 'NOTA') notasBitacora += 1;
    else if (b.tipo === 'MODIFICACION') modificacionesBitacora += 1;
  }

  // ── 3. Cumplimiento operativo (tareas) ──────────────────────────────────
  let completadasPeriodo = 0;
  let activasPendientes = 0;
  let vencidas = 0;
  let completadasATiempo = 0;
  let completadasAtrasadas = 0;

  const porRespMap = new Map<string, { idUsuario: string; nombre: string; asignadas: number; completadas: number }>();

  for (const t of tareas) {
    const limiteIso = t.fechaLimite.toISOString().slice(0, 10);
    const completadaEnPeriodo =
      t.estado === 'COMPLETADA' &&
      t.completadaEn !== null &&
      fechaLocalISO(t.completadaEn) >= desde &&
      fechaLocalISO(t.completadaEn) <= hasta;

    const esCompletada = t.estado === 'COMPLETADA';

    if (esCompletada && completadaEnPeriodo && t.completadaEn) {
      completadasPeriodo += 1;
      const aTiempo = t.completadaEn.getTime() < finDelDia(limiteIso).getTime();
      if (aTiempo) completadasATiempo += 1;
      else completadasAtrasadas += 1;

      const mesComp = fechaLocalISO(t.completadaEn).slice(0, 7);
      const fila = porMes.get(mesComp);
      if (fila) {
        fila.tareasCompletadas += 1;
        if (aTiempo) fila.tareasATiempo += 1;
      }
    } else if (!esCompletada) {
      if (limiteIso < hoy) {
        vencidas += 1;
        const fila = porMes.get(limiteIso.slice(0, 7));
        if (fila) fila.tareasVencidas += 1;
      } else {
        activasPendientes += 1;
      }
    }

    for (const r of t.responsables) {
      const actual = porRespMap.get(r.usuario.id) ?? {
        idUsuario: r.usuario.id,
        nombre: r.usuario.nombre,
        asignadas: 0,
        completadas: 0,
      };
      actual.asignadas += 1;
      if (esCompletada) actual.completadas += 1;
      porRespMap.set(r.usuario.id, actual);
    }
  }

  const totalTareasPeriodo = completadasPeriodo + activasPendientes + vencidas;
  const porResponsable = Array.from(porRespMap.values())
    .map((u) => ({
      ...u,
      tasaCumplimientoPct: porcentaje(u.completadas, u.asignadas),
    }))
    .sort((a, b) => b.completadas - a.completadas || a.nombre.localeCompare(b.nombre));

  // ── 4. Vigilancia y eventos IA ──────────────────────────────────────────
  const ahora = new Date();
  let discrepancias = 0;
  let desconexiones = 0;
  let sumaDiferencia = 0;

  for (const ev of eventosVigilancia) {
    const mesEv = fechaLocalISO(ev.ocurridoEn).slice(0, 7);
    const fila = porMes.get(mesEv);
    if (fila) fila.eventosIA += 1;

    if (ev.tipo === 'DISCREPANCIA_CONTEO') {
      discrepancias += 1;
      sumaDiferencia += ev.diferencia;
      if (fila) fila.discrepanciasIA += 1;
    } else {
      desconexiones += 1;
      if (fila) fila.desconexionesIA += 1;
    }
  }

  return {
    predio: {
      nombre: predio.nombre,
      ubicacion: predio.ubicacion,
    },
    periodo: {
      desde,
      hasta,
      meses: serie.length,
    },
    generadoEn: ahora.toISOString(),
    inventario: {
      activos,
      inactivos,
      totalHistorico: activos + inactivos,
      machos,
      hembras,
      pesoPromedioKg: cantidadConPeso > 0 ? redondear1(sumaPesos / cantidadConPeso) : null,
      pesoTotalKg: redondear1(sumaPesos),
      porRaza,
      altasPeriodo,
      bajasPeriodo,
      tasaMortalidadPct,
      tasaExtraccionPct,
    },
    eventos: {
      total: eventos.length,
      programados,
      realizados,
      porTipo: eventosPorTipo,
      animalesAtendidosPorTipo: {
        ENCASTE: animalesUnicos.ENCASTE.size,
        ESQUILA: animalesUnicos.ESQUILA.size,
        ATENCION_SANITARIA: animalesUnicos.ATENCION_SANITARIA.size,
        OTRO: animalesUnicos.OTRO.size,
      },
      notasBitacora,
      modificacionesBitacora,
    },
    tareas: {
      totalPeriodo: totalTareasPeriodo,
      completadasPeriodo,
      activasPendientes,
      vencidas,
      completadasATiempo,
      completadasAtrasadas,
      tasaCumplimientoPct: porcentaje(completadasPeriodo, totalTareasPeriodo),
      tasaATiempoPct: porcentaje(completadasATiempo, completadasPeriodo),
      porResponsable,
    },
    vigilancia: {
      dispositivos: dispositivos.map((d) => ({
        id: d.id,
        nombre: d.nombre,
        enLinea: estaEnLinea(d.ultimoHeartbeat, ahora),
        ultimoConteo: d.ultimoConteo,
        conteoEsperado: activos,
        brechaActual: d.ultimoConteo === null ? null : Math.max(0, activos - d.ultimoConteo),
        tieneRoi: d.regionInteres !== null,
        ultimoHeartbeat: d.ultimoHeartbeat ? d.ultimoHeartbeat.toISOString() : null,
      })),
      eventosPeriodo: {
        total: eventosVigilancia.length,
        discrepancias,
        desconexiones,
        promedioDiferenciaCabezas:
          discrepancias > 0 ? redondear1(sumaDiferencia / discrepancias) : 0,
      },
    },
    serieMensual: serie,
  };
}

function construirSerieVacia(desde: string, hasta: string): SerieMensualReporte[] {
  const resultado: SerieMensualReporte[] = [];
  let anio = Number(desde.slice(0, 4));
  let mes = Number(desde.slice(5, 7));
  const anioFin = Number(hasta.slice(0, 4));
  const mesFin = Number(hasta.slice(5, 7));

  while (anio < anioFin || (anio === anioFin && mes <= mesFin)) {
    const mm = String(mes).padStart(2, '0');
    resultado.push({
      mes: `${anio}-${mm}`,
      etiqueta: `${MESES_CORTOS[mes - 1]} ${anio}`,
      altas: 0,
      bajasTotal: 0,
      bajasVenta: 0,
      bajasMuerte: 0,
      bajasFaena: 0,
      tareasCompletadas: 0,
      tareasATiempo: 0,
      tareasVencidas: 0,
      eventosTotal: 0,
      eventosSanitarios: 0,
      eventosProductivos: 0,
      eventosIA: 0,
      discrepanciasIA: 0,
      desconexionesIA: 0,
    });
    mes += 1;
    if (mes > 12) {
      mes = 1;
      anio += 1;
    }
  }

  return resultado;
}

function inicioHaceMeses(iso: string, mesesAtras: number): string {
  const anio = Number(iso.slice(0, 4));
  const mes = Number(iso.slice(5, 7));
  const fecha = new Date(Date.UTC(anio, mes - 1 - mesesAtras, 1));
  const y = fecha.getUTCFullYear();
  const m = String(fecha.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

function porcentaje(parte: number, total: number): number {
  if (total <= 0) return 0;
  return redondear1((parte / total) * 100);
}

function redondear1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Utilidades de fecha.
 *
 * El predio opera en una sola zona horaria (sur de Chile), asi que "hoy" se
 * calcula siempre contra la zona configurada y no contra UTC: si no, entre las
 * 21:00 y medianoche el resumen del dia (RF_15) mostraria el dia siguiente.
 */
export const ZONA_HORARIA = 'America/Santiago';

/** Fecha local (YYYY-MM-DD) del instante dado en la zona del predio. */
export function fechaLocalISO(instante: Date = new Date(), zona = ZONA_HORARIA): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(instante);
}

/** Convierte 'YYYY-MM-DD' al Date de medianoche UTC que Prisma guarda en @db.Date. */
export function aFechaSolo(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** Inicio del dia local, expresado como instante absoluto. */
export function inicioDelDia(iso: string, zona = ZONA_HORARIA): Date {
  return new Date(`${iso}T00:00:00${desplazamiento(iso, zona)}`);
}

/** Fin del dia local (exclusivo): el instante en que empieza el dia siguiente. */
export function finDelDia(iso: string, zona = ZONA_HORARIA): Date {
  const siguiente = sumarDias(iso, 1);
  return inicioDelDia(siguiente, zona);
}

export function sumarDias(iso: string, dias: number): string {
  const base = new Date(`${iso}T12:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

/** Diferencia en dias calendario entre dos fechas ISO (b - a). */
export function diferenciaDias(a: string, b: string): number {
  const ms = Date.parse(`${b}T12:00:00.000Z`) - Date.parse(`${a}T12:00:00.000Z`);
  return Math.round(ms / 86_400_000);
}

/** true si la fecha ISO es anterior a hoy en la zona del predio. */
export function esPasada(iso: string, hoy = fechaLocalISO()): boolean {
  return iso < hoy;
}

/**
 * Desplazamiento UTC ('-04:00' / '-03:00') de la zona en esa fecha.
 * Chile cambia de horario dos veces al ano, asi que no se puede fijar.
 */
function desplazamiento(iso: string, zona: string): string {
  const referencia = new Date(`${iso}T12:00:00.000Z`);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    timeZoneName: 'longOffset',
  });
  const parte = fmt.formatToParts(referencia).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+00:00';
  const signo = parte.replace('GMT', '').trim();
  return signo === '' ? '+00:00' : signo;
}

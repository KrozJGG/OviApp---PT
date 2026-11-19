/**
 * Utilidades geometricas puras para validar Regiones de Interes (ROI)
 * expresadas en coordenadas normalizadas [0, 1].
 */

export const AREA_MINIMA_ROI = 0.01;
export const LADO_MINIMO_BBOX_ROI = 0.05;

export interface PuntoNormalizado {
  x: number;
  y: number;
}

const EPS = 1e-9;

/** Redondea una coordenada normalizada a 4 decimales para almacenamiento estable. */
export function redondearCoord(valor: number): number {
  return Math.round(valor * 10000) / 10000;
}

/** Calcula el area de un poligono simple usando la formula del zapatero (Shoelace). */
export function areaPoligono(puntos: readonly PuntoNormalizado[]): number {
  if (puntos.length < 3) return 0;

  let suma = 0;
  for (let i = 0; i < puntos.length; i += 1) {
    const actual = puntos[i]!;
    const siguiente = puntos[(i + 1) % puntos.length]!;
    suma += actual.x * siguiente.y - siguiente.x * actual.y;
  }
  return Math.abs(suma) / 2;
}

/** Ancho y alto del rectangulo envolvente (bounding box) en coordenadas normalizadas. */
export function dimensionesBbox(puntos: readonly PuntoNormalizado[]): { ancho: number; alto: number } {
  if (puntos.length === 0) return { ancho: 0, alto: 0 };

  let minX = puntos[0]!.x;
  let maxX = puntos[0]!.x;
  let minY = puntos[0]!.y;
  let maxY = puntos[0]!.y;

  for (let i = 1; i < puntos.length; i += 1) {
    const p = puntos[i]!;
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  return { ancho: maxX - minX, alto: maxY - minY };
}

function orientacion(a: PuntoNormalizado, b: PuntoNormalizado, c: PuntoNormalizado): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function puntoEnSegmento(a: PuntoNormalizado, b: PuntoNormalizado, p: PuntoNormalizado): boolean {
  return (
    p.x >= Math.min(a.x, b.x) - EPS &&
    p.x <= Math.max(a.x, b.x) + EPS &&
    p.y >= Math.min(a.y, b.y) - EPS &&
    p.y <= Math.max(a.y, b.y) + EPS
  );
}

function segmentosSeCruzan(
  a: PuntoNormalizado,
  b: PuntoNormalizado,
  c: PuntoNormalizado,
  d: PuntoNormalizado,
): boolean {
  const o1 = orientacion(a, b, c);
  const o2 = orientacion(a, b, d);
  const o3 = orientacion(c, d, a);
  const o4 = orientacion(c, d, b);

  if (((o1 > EPS && o2 < -EPS) || (o1 < -EPS && o2 > EPS)) &&
      ((o3 > EPS && o4 < -EPS) || (o3 < -EPS && o4 > EPS))) {
    return true;
  }

  if (Math.abs(o1) <= EPS && puntoEnSegmento(a, b, c)) return true;
  if (Math.abs(o2) <= EPS && puntoEnSegmento(a, b, d)) return true;
  if (Math.abs(o3) <= EPS && puntoEnSegmento(c, d, a)) return true;
  if (Math.abs(o4) <= EPS && puntoEnSegmento(c, d, b)) return true;

  return false;
}

/**
 * Indica si alguna pareja de aristas no adyacentes del poligono se cruza
 * o se solapa colinealmente.
 */
export function esPoligonoAutoIntersectado(puntos: readonly PuntoNormalizado[]): boolean {
  const n = puntos.length;
  if (n < 4) return false;

  for (let i = 0; i < n; i += 1) {
    const a = puntos[i]!;
    const b = puntos[(i + 1) % n]!;

    for (let j = i + 1; j < n; j += 1) {
      // Ignora aristas adyacentes que comparten un vertice.
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;

      const c = puntos[j]!;
      const d = puntos[(j + 1) % n]!;
      if (segmentosSeCruzan(a, b, c, d)) {
        return true;
      }
    }
  }

  return false;
}

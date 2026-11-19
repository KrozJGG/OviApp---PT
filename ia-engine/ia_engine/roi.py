"""
Utilidades puras para manipular y evaluar la Región de Interés (ROI).

Se mantiene libre de dependencias obligatorias de OpenCV/Ultralytics/NumPy
en los imports de nivel superior para permitir pruebas unitarias ligeras.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from typing import Any, Iterable, Sequence

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class RegionInteres:
    """Región de Interés normalizada en [0.0, 1.0]."""

    tipo: str
    puntos: tuple[tuple[float, float], ...]
    updated_at: str | None = None


def _es_numero_valido(valor: Any) -> bool:
    return (
        isinstance(valor, (int, float))
        and not isinstance(valor, bool)
        and math.isfinite(float(valor))
    )


def parsear_roi(payload: dict[str, Any] | None) -> RegionInteres | None:
    """
    Parsea de forma defensiva la ROI recibida desde GET /api/v1/edge/configuracion
    o directamente un diccionario con {tipo, puntos}.

    Si la configuración es nula o está malformada retorna None (imagen completa)
    para no interrumpir la detección.
    """
    if payload is None:
        return None

    if not isinstance(payload, dict):
        logger.warning("Payload de ROI inválido (no es dict); usando imagen completa.")
        return None

    if "regionInteres" in payload:
        cruda = payload.get("regionInteres")
        updated_at = payload.get("regionInteresUpdatedAt")
    else:
        cruda = payload
        updated_at = payload.get("regionInteresUpdatedAt")

    if cruda is None:
        return None

    if not isinstance(cruda, dict):
        logger.warning("regionInteres inválida (no es dict); usando imagen completa.")
        return None

    tipo = cruda.get("tipo")
    puntos_crudos = cruda.get("puntos")

    if tipo not in ("RECTANGULO", "POLIGONO") or not isinstance(puntos_crudos, list):
        logger.warning("regionInteres con tipo o puntos inválidos; usando imagen completa.")
        return None

    if len(puntos_crudos) < 3 or (tipo == "RECTANGULO" and len(puntos_crudos) != 4):
        logger.warning("regionInteres con cantidad de vértices inválida; usando imagen completa.")
        return None

    puntos: list[tuple[float, float]] = []
    for punto in puntos_crudos:
        if not isinstance(punto, dict):
            logger.warning("Vértice de ROI inválido; usando imagen completa.")
            return None
        x_val = punto.get("x")
        y_val = punto.get("y")
        if not (_es_numero_valido(x_val) and _es_numero_valido(y_val)):
            logger.warning("Coordenadas no numéricas en ROI; usando imagen completa.")
            return None
        x = float(x_val)
        y = float(y_val)
        if not (0.0 <= x <= 1.0 and 0.0 <= y <= 1.0):
            logger.warning("Coordenadas fuera de [0, 1] en ROI; usando imagen completa.")
            return None
        puntos.append((x, y))

    marca_tiempo = str(updated_at) if updated_at is not None else None
    return RegionInteres(tipo=tipo, puntos=tuple(puntos), updated_at=marca_tiempo)


def calcular_bbox_recorte(
    roi: RegionInteres,
    ancho: int,
    alto: int,
    margen: float = 0.03,
) -> tuple[int, int, int, int]:
    """
    Calcula el bounding box en píxeles (x1, y1, x2, y2) expandido por `margen`
    normalizado y acotado a los límites de la imagen [0, ancho] x [0, alto].
    """
    if ancho <= 0 or alto <= 0:
        raise ValueError(f"Dimensiones de imagen inválidas: {ancho}x{alto}")

    xs = [p[0] for p in roi.puntos]
    ys = [p[1] for p in roi.puntos]

    min_x = max(0.0, min(xs) - margen)
    max_x = min(1.0, max(xs) + margen)
    min_y = max(0.0, min(ys) - margen)
    max_y = min(1.0, max(ys) + margen)

    x1 = max(0, min(ancho - 1, math.floor(min_x * ancho)))
    y1 = max(0, min(alto - 1, math.floor(min_y * alto)))
    x2 = max(x1 + 1, min(ancho, math.ceil(max_x * ancho)))
    y2 = max(y1 + 1, min(alto, math.ceil(max_y * alto)))

    return x1, y1, x2, y2


def recortar_frame(
    frame: Any,
    roi: RegionInteres,
    margen: float = 0.03,
) -> tuple[Any, tuple[int, int, int, int]]:
    """Recorta la subimagen correspondiente al bounding box con margen de la ROI."""
    alto, ancho = frame.shape[:2]
    bbox = calcular_bbox_recorte(roi, ancho, alto, margen=margen)
    x1, y1, x2, y2 = bbox
    recorte = frame[y1:y2, x1:x2]
    copia = getattr(recorte, "copy", None)
    return (copia() if callable(copia) else recorte), bbox


def _punto_en_segmento(
    px: float,
    py: float,
    ax: float,
    ay: float,
    bx: float,
    by: float,
    tol: float = 1e-9,
) -> bool:
    cruz = (bx - ax) * (py - ay) - (by - ay) * (px - ax)
    escala = max(1.0, math.hypot(bx - ax, by - ay))
    if abs(cruz) > tol * escala:
        return False

    return (
        min(ax, bx) - tol <= px <= max(ax, bx) + tol
        and min(ay, by) - tol <= py <= max(ay, by) + tol
    )


def punto_en_poligono(
    x: float,
    y: float,
    poligono: Sequence[tuple[float, float]],
) -> bool:
    """
    Determina si el punto (x, y) cae dentro o sobre el borde del polígono
    mediante el algoritmo ray-casting.
    """
    n = len(poligono)
    if n < 3:
        return False

    for i in range(n):
        ax, ay = poligono[i]
        bx, by = poligono[(i + 1) % n]
        if _punto_en_segmento(x, y, ax, ay, bx, by):
            return True

    dentro = False
    j = n - 1
    for i in range(n):
        xi, yi = poligono[i]
        xj, yj = poligono[j]
        if (yi > y) != (yj > y):
            x_interseccion = (xj - xi) * (y - yi) / (yj - yi) + xi
            if x < x_interseccion:
                dentro = not dentro
        j = i

    return dentro


def contar_en_roi(
    boxes_xywh: Iterable[Sequence[float]],
    ancho_orig: int,
    alto_orig: int,
    roi: RegionInteres,
    offset: tuple[int, int] = (0, 0),
) -> int:
    """
    Reproyecta los centros (cx, cy) de cada caja detectada al espacio normalizado
    del fotograma original y cuenta cuántas caen dentro del polígono de la ROI.
    """
    if ancho_orig <= 0 or alto_orig <= 0:
        return 0

    ox, oy = offset
    total = 0
    for box in boxes_xywh:
        if len(box) < 2:
            continue
        cx_norm = (ox + float(box[0])) / ancho_orig
        cy_norm = (oy + float(box[1])) / alto_orig
        if punto_en_poligono(cx_norm, cy_norm, roi.puntos):
            total += 1

    return total

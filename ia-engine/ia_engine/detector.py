"""
Detector de ovejas con YOLO.

Carga el modelo una sola vez y, por cada fotograma, devuelve cuántas
ovejas detectó. YOLO ya elimina detecciones duplicadas dentro de un mismo
frame (NMS), así que el conteo es directamente el número de cajas.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import numpy as np
from ultralytics import YOLO

from .config import config, parsear_clases

logger = logging.getLogger(__name__)

# Ventanas de un mismo frame que se procesan juntas cuando hay tiling.
VENTANAS_POR_LOTE = 8


@dataclass
class ResultadoDeteccion:
    """Resultado del procesamiento de un frame."""

    conteo: int
    """Cantidad de ovejas detectadas en el fotograma."""

    confianza_promedio: float = 0.0
    """Confianza promedio de las detecciones."""


class Detector:
    """Detector YOLO compartido por todos los streams."""

    def __init__(self, model_path: str, confianza: float) -> None:
        logger.info("Cargando modelo YOLO desde %s ...", model_path)
        self._modelo = YOLO(model_path)

        # Intentar usar GPU; si no está disponible, cae a CPU.
        dispositivo = "cuda:0"
        try:
            # Warm-up: una inferencia de prueba para forzar la carga en GPU.
            dummy = np.zeros((640, 640, 3), dtype=np.uint8)
            self._modelo.predict(dummy, device=dispositivo, verbose=False)
            logger.info("Modelo cargado en GPU (CUDA).")
        except Exception:
            dispositivo = "cpu"
            logger.warning("GPU no disponible — usando CPU.")

        self._dispositivo = dispositivo
        self._confianza = confianza
        self._clases = self._resolver_clases()
        # Ultralytics espera False, no 0, para desactivar el tiling.
        self._tile: int | bool = config.tile_inferencia or False
        logger.info("Tiling de inferencia: %s", self._tile or "desactivado")

    def _resolver_clases(self) -> list[int] | None:
        """
        Traduce los nombres de CLASES_OBJETIVO a los ids del modelo cargado.

        Devuelve None cuando no hay que filtrar: o porque la configuración está
        vacía, o porque el modelo tiene una sola clase (que es el caso (sheep)).
        """
        objetivo = parsear_clases(config.clases_objetivo)
        nombres: dict[int, str] = dict(self._modelo.names or {})

        if not objetivo or len(nombres) <= 1:
            logger.info("Sin filtro de clases: se cuentan todas las detecciones.")
            return None

        ids = [i for i, nombre in nombres.items() if str(nombre).lower() in objetivo]

        if not ids:
            logger.error(
                "Ninguna de las clases %s existe en el modelo (tiene %d clases). "
                "Se contarán TODAS las detecciones, lo que inflará el conteo.",
                sorted(objetivo),
                len(nombres),
            )
            return None

        logger.info(
            "Contando solo las clases %s (ids %s) de las %d del modelo.",
            sorted(str(nombres[i]) for i in ids),
            ids,
            len(nombres),
        )
        return ids

    def detectar(self, frame: np.ndarray) -> ResultadoDeteccion:
        """
        Ejecuta YOLO sobre un frame y devuelve la cantidad de ovejas.
        """
        resultados = self._modelo.predict(
            frame,
            device=self._dispositivo,
            conf=self._confianza,
            classes=self._clases,
            tile=self._tile,
            batch=VENTANAS_POR_LOTE,
            verbose=False,
        )

        if not resultados or len(resultados[0].boxes) == 0:
            return ResultadoDeteccion(conteo=0)

        cajas = resultados[0].boxes
        confianza_promedio = float(cajas.conf.mean().item()) if len(cajas.conf) else 0.0

        return ResultadoDeteccion(conteo=len(cajas), confianza_promedio=confianza_promedio)

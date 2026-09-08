"""
Detector de ovejas con YOLO + ByteTrack.

Encapsula la carga del modelo, la inferencia sobre cada fotograma,
y el tracking entre frames para obtener conteos estables sin contar
la misma oveja dos veces.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

import numpy as np
import supervision as sv
from ultralytics import YOLO

from .config import config

logger = logging.getLogger(__name__)


@dataclass
class ResultadoDeteccion:
    """Resultado del procesamiento de un frame."""

    conteo: int
    """Cantidad de ovejas únicas detectadas en la zona de interés."""

    centroides: list[tuple[float, float]] = field(default_factory=list)
    """Coordenadas (x, y) del centroide de cada detección."""

    confianza_promedio: float = 0.0
    """Confianza promedio de las detecciones."""


class Detector:
    """
    Detector YOLO con tracking.

    Carga el modelo una sola vez y se reutiliza para todos los streams.
    ByteTrack mantiene IDs estables entre frames consecutivos dentro
    de un mismo stream (cada stream tiene su propio tracker).
    """

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

    def crear_tracker(self) -> sv.ByteTrack:
        """Crea un tracker independiente para un stream."""
        return sv.ByteTrack(
            track_activation_threshold=self._confianza,
            minimum_matching_threshold=0.8,
            frame_rate=config.fps_procesamiento,
        )

    def detectar(
        self,
        frame: np.ndarray,
        tracker: sv.ByteTrack,
    ) -> ResultadoDeteccion:
        """
        Ejecuta YOLO sobre un frame y actualiza el tracker.

        Args:
            frame: Imagen BGR (numpy array) del fotograma.
            tracker: Instancia de ByteTrack propia del stream.

        Returns:
            ResultadoDeteccion con conteo, centroides y confianza.
        """
        resultados = self._modelo.predict(
            frame,
            device=self._dispositivo,
            conf=self._confianza,
            verbose=False,
        )

        if not resultados or len(resultados[0].boxes) == 0:
            return ResultadoDeteccion(conteo=0)

        # Convertir resultados YOLO al formato de supervision.
        detecciones = sv.Detections.from_ultralytics(resultados[0])

        # Actualizar tracking para IDs estables entre frames.
        detecciones = tracker.update_with_detections(detecciones)

        conteo = len(detecciones)

        # Calcular centroides (centro de cada bounding box).
        centroides: list[tuple[float, float]] = []
        if detecciones.xyxy is not None and len(detecciones.xyxy) > 0:
            for box in detecciones.xyxy:
                cx = float((box[0] + box[2]) / 2)
                cy = float((box[1] + box[3]) / 2)
                centroides.append((cx, cy))

        confianza_promedio = 0.0
        if detecciones.confidence is not None and len(detecciones.confidence) > 0:
            confianza_promedio = float(np.mean(detecciones.confidence))

        return ResultadoDeteccion(
            conteo=conteo,
            centroides=centroides,
            confianza_promedio=confianza_promedio,
        )

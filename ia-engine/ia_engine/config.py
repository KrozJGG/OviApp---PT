"""
Configuración centralizada del módulo ia-engine.

Todas las variables se leen del entorno (inyectadas por docker-compose).
pydantic-settings valida tipos y valores por defecto.
"""

from __future__ import annotations

from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings


class Config(BaseSettings):
    """Variables de entorno del ia-engine."""

    # ── Conexión al backend ──────────────────────────────────────────────
    backend_url: str = "http://backend:3000"
    """URL base del backend Express (dentro de la red Docker)."""

    edge_api_key: str
    """API key del dispositivo edge (formato: prefijo.secreto)."""

    # ── Streams RTSP ─────────────────────────────────────────────────────
    rtsp_streams: str = "rebano=rtsp://mediamtx:8554/rebano"
    """
    Streams RTSP a monitorear.
    Formato: nombre1=url1,nombre2=url2
    """

    # ── Modelo YOLO (ONNX en CPU) ────────────────────────────────────────
    model_path: str = "models/sheep_detection.onnx"
    """Ruta del modelo YOLO exportado a ONNX (clase única: sheep)."""

    imgsz: int = Field(default=1280, ge=320)
    """Resolución de entrada del modelo (debe coincidir con el ONNX exportado)."""

    confianza_minima: float = Field(default=0.25, gt=0.0, le=1.0)
    """Umbral de confianza mínimo para aceptar una detección de oveja."""

    iou_nms: float = Field(default=0.50, gt=0.0, le=1.0)
    """Umbral IoU de NMS para suprimir cajas duplicadas sobre una misma oveja."""

    tile_size: int = Field(default=0, ge=0)
    """
    Tamaño de ventana para teselado de alta resolución en Ultralytics.
    0 desactiva el tiling (recomendado al inferir fotograma completo con imgsz=1280).
    """

    # ── Procesamiento RTSP y estabilización ──────────────────────────────
    vid_stride: int = Field(default=30, ge=1)
    """
    Salto de fotogramas nativo de Ultralytics.
    Sobre un stream de 60 FPS, vid_stride=30 procesa 2 FPS (~10 muestras cada 5 s).
    """

    ventana_mediana: int = Field(default=5, ge=1)
    """Tamaño de la ventana deslizante (deque) para calcular la mediana de conteo."""

    # ── Heartbeat ────────────────────────────────────────────────────────
    heartbeat_intervalo_seg: int = Field(default=5, gt=0)
    """Segundos entre cada envío de conteo estabilizado al backend."""

    # ── Región de Interés (ROI) y cadencia de inferencia ─────────────────
    roi_modo: Literal["recorte", "filtro"] = "recorte"
    """
    Estrategia cuando existe ROI activa:
    - "recorte": recorta al bounding box de la ROI con margen y filtra por polígono.
    - "filtro": infiere fotograma completo y filtra centros dentro del polígono.
    """

    roi_margen_recorte: float = Field(default=0.03, ge=0.0, le=0.2)
    """Margen normalizado extra alrededor del bounding box de la ROI al recortar."""

    roi_sync_intervalo_seg: int = Field(default=5, gt=0)
    """Segundos entre consultas al backend para detectar cambios de ROI."""

    intervalo_inferencia_seg: float = Field(default=0.5, gt=0.0)
    """Segundos mínimos entre inferencias consecutivas (~2 FPS por defecto)."""

    model_config = {"env_prefix": "", "case_sensitive": False}


def parsear_streams(raw: str) -> dict[str, str]:
    """
    Parsea la cadena de streams RTSP a un diccionario {nombre: url}.

    Ejemplo:
        "rebano=rtsp://mediamtx:8554/rebano" → {"rebano": "rtsp://mediamtx:8554/rebano"}
    """
    streams: dict[str, str] = {}
    for entrada in raw.split(","):
        entrada = entrada.strip()
        if "=" not in entrada:
            continue
        nombre, url = entrada.split("=", 1)
        streams[nombre.strip()] = url.strip()
    return streams


# Instancia global — se carga al importar el módulo.
config = Config()  # type: ignore[call-arg]

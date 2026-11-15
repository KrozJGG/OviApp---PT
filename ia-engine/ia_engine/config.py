"""
Configuración centralizada del módulo ia-engine.

Todas las variables se leen del entorno (inyectadas por docker-compose).
pydantic-settings valida tipos y valores por defecto.
"""

from __future__ import annotations

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

    confianza_minima: float = Field(default=0.35, gt=0.0, le=1.0)
    """Umbral de confianza mínimo para aceptar una detección de oveja."""

    # ── Procesamiento RTSP y estabilización ──────────────────────────────
    vid_stride: int = Field(default=10, ge=1)
    """
    Salto de fotogramas nativo de Ultralytics.
    Sobre un stream de 30 FPS, vid_stride=10 procesa ~3 FPS y vid_stride=15 ~2 FPS.
    """

    ventana_mediana: int = Field(default=5, ge=1)
    """Tamaño de la ventana deslizante (deque) para calcular la mediana de conteo."""

    # ── Heartbeat ────────────────────────────────────────────────────────
    heartbeat_intervalo_seg: int = Field(default=5, gt=0)
    """Segundos entre cada envío de conteo estabilizado al backend."""

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

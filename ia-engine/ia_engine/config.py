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
    Ejemplo: rebano=rtsp://mediamtx:8554/rebano,potrero=rtsp://mediamtx:8554/potrero
    """

    # ── Modelo YOLO ──────────────────────────────────────────────────────
    model_path: str = "models/sheep_detection.pt"
    """Ruta del modelo YOLO. Por defecto el detector de ovejas de una sola clase de models/."""

    confianza_minima: float = 0.35
    """
    Umbral de confianza mínimo para aceptar una detección.

    0.5 descartaba casi la mitad de las ovejas reales en pruebas con
    rebano.mp4. 0.35 es un punto intermedio: rescata más detecciones válidas
    sin bajar directo a los 0.25 por defecto de Ultralytics.
    """

    clases_objetivo: str = "sheep"
    """
    Nombres de clase que cuentan como oveja, separados por coma.

    sheep_detection.pt tiene una sola clase ("sheep"), así que el filtro no
    cambia nada; importa si se vuelve a un preentrenado de COCO como yolo26n,
    que detecta 80 clases y sin filtrar sumaría personas, perros y vehículos.
    Los nombres se comparan contra los del propio modelo (`model.names`), sin
    distinguir mayúsculas. Vacío = sin filtro.
    """

    # ── Procesamiento ────────────────────────────────────────────────────
    intervalo_inferencia_seg: float = Field(default=5.0, gt=0)
    """
    Segundos entre cada inferencia del modelo.

    Las ovejas se mueven despacio, así que no hace falta analizar varios
    frames por segundo. Con 5 s y un heartbeat de 15 s se toman ~3 muestras
    por ventana, lo que mantiene bajo el uso de CPU.
    """

    tile_inferencia: int = Field(default=640, ge=0)
    """
    Tamaño en píxeles de las ventanas en que se divide cada frame (0 = frame completo).

    Con frame completo, un video 720p se reduce a 640 y las ovejas lejanas
    quedan en unos 16x7 px. Las ventanas de 640 mantienen la resolución
    original. Bajar de 640 parte y duplica ovejas.
    """

    # ── Heartbeat ────────────────────────────────────────────────────────
    heartbeat_intervalo_seg: int = Field(default=15, gt=0)
    """
    Segundos entre cada envío del conteo al backend.

    En cada envío se reporta la MEDIANA de las muestras tomadas en la
    ventana, que descarta lecturas atípicas del modelo.
    """

    model_config = {"env_prefix": "", "case_sensitive": False}


def parsear_streams(raw: str) -> dict[str, str]:
    """
    Parsea la cadena de streams RTSP a un diccionario {nombre: url}.

    Ejemplo:
        "rebano=rtsp://mediamtx:8554/rebano,potrero=rtsp://mediamtx:8554/potrero"
        → {"rebano": "rtsp://mediamtx:8554/rebano", "potrero": "rtsp://mediamtx:8554/potrero"}
    """
    streams: dict[str, str] = {}
    for entrada in raw.split(","):
        entrada = entrada.strip()
        if "=" not in entrada:
            continue
        nombre, url = entrada.split("=", 1)
        streams[nombre.strip()] = url.strip()
    return streams


def parsear_clases(raw: str) -> set[str]:
    """Convierte «sheep,oveja» en {'sheep', 'oveja'}. Vacío = sin filtro."""
    return {c.strip().lower() for c in raw.split(",") if c.strip()}


# Instancia global — se carga al importar el módulo.
config = Config()  # type: ignore[call-arg]

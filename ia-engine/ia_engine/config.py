"""
Configuración centralizada del módulo ia-engine.

Todas las variables se leen del entorno (inyectadas por docker-compose).
pydantic-settings valida tipos y valores por defecto.
"""

from __future__ import annotations

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
    model_path: str = "/app/models/ovejas.pt"
    """Ruta absoluta al archivo .pt del modelo YOLO entrenado."""

    confianza_minima: float = 0.5
    """Umbral de confianza mínimo para aceptar una detección."""

    # ── Procesamiento ────────────────────────────────────────────────────
    fps_procesamiento: int = 2
    """Fotogramas por segundo a enviar al modelo (el resto se descarta)."""

    # ── Heartbeat ────────────────────────────────────────────────────────
    heartbeat_intervalo_seg: int = 300
    """Segundos entre cada heartbeat al backend (por defecto 5 min)."""

    # ── Alertas ──────────────────────────────────────────────────────────
    alerta_cooldown_seg: int = 300
    """Segundos mínimos entre dos alertas del mismo tipo (evita spam)."""

    conteo_umbral_diferencia: int = 2
    """
    Diferencia mínima entre conteo detectado y conteo esperado para
    emitir una alerta de CONTEO. Evita falsas alarmas por ruido.
    """

    conteo_frames_confirmacion: int = 5
    """
    Cantidad de frames consecutivos donde el conteo debe mantenerse
    anormal antes de emitir la alerta. Evita picos transitorios.
    """

    # ── Dispersión ───────────────────────────────────────────────────────
    dispersion_umbral: float = 0.6
    """
    Umbral normalizado de dispersión del rebaño (0-1).
    Si la distancia promedio entre centroides supera este porcentaje
    del área de la zona, se considera dispersión anormal.
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


# Instancia global — se carga al importar el módulo.
config = Config()  # type: ignore[call-arg]

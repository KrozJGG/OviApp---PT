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
    model_path: str = "yolo26n.pt"
    """Nombre o ruta del modelo YOLO. Por defecto usa YOLO26n preentrenado (se descarga automáticamente)."""

    confianza_minima: float = 0.5
    """Umbral de confianza mínimo para aceptar una detección."""

    clases_objetivo: str = "sheep"
    """
    Nombres de clase que cuentan como oveja, separados por coma.

    yolo26n es el preentrenado de COCO y detecta 80 clases: sin filtrar, el
    conteo sumaría personas, perros y vehículos. Los nombres se comparan contra
    los del propio modelo (`model.names`), sin distinguir mayúsculas.

    Dejarlo vacío desactiva el filtro, que es lo correcto para un modelo
    entrenado con una sola clase.
    """

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

    conteo_esperado: int | None = None
    """
    Línea base del rebaño, como respaldo si el backend no responde.

    Normalmente NO se define: el valor autoritativo vive en la tabla
    dispositivo_edge y se lee al arrancar desde GET /api/v1/edge/configuracion.
    Definir esta variable solo tiene sentido para pruebas sin backend.
    """

    # ── Dispersión ───────────────────────────────────────────────────────
    dispersion_umbral: float = 0.35
    """
    Umbral del índice de dispersión del rebaño.

    El índice es la distancia promedio entre centroides dividida por la
    diagonal del fotograma. Referencias de la escala:

      ~0.05 – 0.15  rebaño apiñado, comportamiento normal
      ~0.20 – 0.30  repartido por buena parte del cuadro
      ~0.37         máximo práctico: ovejas distribuidas por todo el fotograma

    Como el máximo alcanzable ronda 0.37, cualquier umbral sobre ~0.4 hace que
    la alerta nunca se dispare. Conviene ajustarlo con vídeo real del predio.
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

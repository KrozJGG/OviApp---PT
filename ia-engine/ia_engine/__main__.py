"""
Punto de entrada del módulo ia-engine.

Ejecutado con: python -m ia_engine

Flujo lineal en CPU:
1. Carga el modelo YOLO en formato ONNX (`task="detect"`).
2. Consume el stream RTSP con el generador nativo de Ultralytics
   (`stream=True`, `stream_buffer=False`, `vid_stride=...`).
3. Acumula los conteos de ovejas recientes en una ventana (`deque`) y calcula
   la mediana estadística para evitar saltos por oclusiones breves.
4. Envía periódicamente ese conteo estabilizado al backend vía heartbeat.

Se detiene limpiamente con Ctrl+C (SIGINT) o SIGTERM (Docker stop).
"""

from __future__ import annotations

import logging
import signal
import statistics
import sys
import threading
import time
from collections import deque

from ultralytics import YOLO

from .cliente_api import ClienteAPI
from .config import config, parsear_streams

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)


class _FiltroWaitingStream(logging.Filter):
    """Filtra avisos de polling de Ultralytics cuando vid_stride > 1 espera el siguiente frame."""

    def filter(self, record: logging.LogRecord) -> bool:
        return "Waiting for stream" not in record.getMessage()


logging.getLogger("ultralytics").addFilter(_FiltroWaitingStream())
logger = logging.getLogger("ia_engine")

_REINTENTO_STREAM_SEG = 3


def main() -> None:
    """Punto de entrada principal."""
    logger.info("═══════════════════════════════════════════════════")
    logger.info("  OviApp — Módulo de IA (conteo ovino CPU + ONNX)")
    logger.info("═══════════════════════════════════════════════════")

    streams = parsear_streams(config.rtsp_streams)
    if not streams:
        logger.error("No se configuraron streams RTSP. Revisa RTSP_STREAMS.")
        sys.exit(1)

    nombre_stream, url_rtsp = next(iter(streams.items()))
    if len(streams) > 1:
        logger.warning(
            "Se configuraron %d streams; este modo lineal monitoreará '%s'.",
            len(streams),
            nombre_stream,
        )

    tile_activo = config.tile_size if config.tile_size > 0 else None

    logger.info("Stream '%s' → %s", nombre_stream, url_rtsp)
    logger.info(
        "Modelo ONNX: %s (confianza=%.2f, tile=%s, vid_stride=%d)",
        config.model_path,
        config.confianza_minima,
        tile_activo,
        config.vid_stride,
    )
    logger.info("Mediana sobre %d muestras | Heartbeat cada %d s", config.ventana_mediana, config.heartbeat_intervalo_seg)

    modelo = YOLO(config.model_path, task="detect")
    cliente = ClienteAPI(backend_url=config.backend_url, api_key=config.edge_api_key)

    detenido = threading.Event()

    def _manejar_senal(signum: int, _frame: object) -> None:
        logger.info("Señal %s recibida — deteniendo...", signal.Signals(signum).name)
        detenido.set()

    signal.signal(signal.SIGINT, _manejar_senal)
    signal.signal(signal.SIGTERM, _manejar_senal)

    ventana: deque[int] = deque(maxlen=config.ventana_mediana)
    proximo_heartbeat = time.monotonic() + config.heartbeat_intervalo_seg

    logger.info("Módulo ia-engine iniciado.")

    while not detenido.is_set():
        resultados = None
        try:
            resultados = modelo.predict(
                source=url_rtsp,
                stream=True,
                stream_buffer=False,
                tile=tile_activo,
                vid_stride=config.vid_stride,
                conf=config.confianza_minima,
                device="cpu",
                verbose=False,
            )

            for resultado in resultados:
                if detenido.is_set():
                    break

                conteo_frame = len(resultado.boxes) if resultado.boxes is not None else 0
                ventana.append(conteo_frame)

                ahora = time.monotonic()
                if ahora >= proximo_heartbeat:
                    mediana = int(round(statistics.median(ventana)))
                    if cliente.enviar_heartbeat(mediana):
                        logger.info(
                            "[%s] Heartbeat enviado — %d ovejas detectadas (muestras=%s)",
                            nombre_stream,
                            mediana,
                            list(ventana),
                        )
                    proximo_heartbeat = ahora + config.heartbeat_intervalo_seg
        except Exception as e:
            if not detenido.is_set():
                logger.warning("[%s] Error leyendo el stream RTSP: %s", nombre_stream, e)
        finally:
            if resultados is not None:
                cerrar = getattr(resultados, "close", None)
                if callable(cerrar):
                    cerrar()

        if not detenido.is_set():
            logger.info(
                "[%s] Stream finalizado o desconectado. Reintentando en %d s...",
                nombre_stream,
                _REINTENTO_STREAM_SEG,
            )
            detenido.wait(_REINTENTO_STREAM_SEG)

    cliente.enviar_desconexion()
    logger.info("Módulo ia-engine detenido.")


if __name__ == "__main__":
    main()

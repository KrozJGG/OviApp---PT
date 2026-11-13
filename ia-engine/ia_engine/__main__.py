"""
Punto de entrada del módulo ia-engine.

Ejecutado con: python -m ia_engine

Flujo:
1. Carga el Detector (modelo YOLO, una sola vez).
2. Arranca un LectorStream por cada stream RTSP: cada uno lee su video y
   cada INTERVALO_INFERENCIA_SEG le pasa un frame al Detector.
3. Cada HEARTBEAT_INTERVALO_SEG toma la mediana del conteo de cada stream
   y la envía al backend en el heartbeat.

Se detiene limpiamente con Ctrl+C (SIGINT) o SIGTERM (Docker stop).
"""

from __future__ import annotations

import logging
import signal
import sys
import threading

from .cliente_api import ClienteAPI
from .config import config, parsear_streams
from .detector import Detector
from .lector_stream import LectorStream

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
logger = logging.getLogger("ia_engine")


def _conteo_total(lectores: list[LectorStream]) -> int | None:
    """Suma la mediana de cada stream. None si ningún stream tiene conteo aún."""
    conteos = [
        conteo
        for conteo in (lector.tomar_conteo_heartbeat() for lector in lectores)
        if conteo is not None
    ]
    return sum(conteos) if conteos else None


def main() -> None:
    """Punto de entrada principal."""
    logger.info("═══════════════════════════════════════════════════")
    logger.info("  OviApp — Módulo de IA (detección de ovejas)")
    logger.info("═══════════════════════════════════════════════════")

    streams = parsear_streams(config.rtsp_streams)
    if not streams:
        logger.error("No se configuraron streams RTSP. Revisa RTSP_STREAMS.")
        sys.exit(1)

    logger.info("Streams configurados: %s", list(streams.keys()))
    logger.info("Inferencia cada %.1f s", config.intervalo_inferencia_seg)
    logger.info("Heartbeat cada %d s", config.heartbeat_intervalo_seg)

    # ── Inicializar componentes ──────────────────────────────────────
    detector = Detector(model_path=config.model_path, confianza=config.confianza_minima)
    cliente = ClienteAPI(backend_url=config.backend_url, api_key=config.edge_api_key)

    lectores = [LectorStream(nombre, url, detector) for nombre, url in streams.items()]
    for lector in lectores:
        lector.iniciar()

    # ── Manejo de señales para cierre limpio ─────────────────────────
    detenido = threading.Event()

    def _manejar_senal(signum: int, _frame: object) -> None:
        logger.info("Señal %s recibida — deteniendo...", signal.Signals(signum).name)
        detenido.set()

    signal.signal(signal.SIGINT, _manejar_senal)
    signal.signal(signal.SIGTERM, _manejar_senal)

    logger.info("Módulo ia-engine iniciado.")

    # ── Loop de heartbeat ────────────────────────────────────────────
    # Se espera primero para que la ventana inicial ya tenga muestras.
    while not detenido.wait(config.heartbeat_intervalo_seg):
        conteo = _conteo_total(lectores)

        if cliente.enviar_heartbeat(conteo):
            logger.info(
                "Heartbeat enviado — %s",
                f"{conteo} ovejas detectadas" if conteo is not None else "sin conteo aún",
            )

        for lector in lectores:
            if not lector.esta_vivo():
                logger.error("Stream '%s' se detuvo inesperadamente.", lector.nombre)

    # ── Cierre limpio ────────────────────────────────────────────────
    logger.info("Deteniendo streams...")
    for lector in lectores:
        lector.detener()

    # Avisar al backend para que "en línea" caiga de inmediato en vez de
    # esperar el timeout por falta de heartbeat.
    cliente.enviar_desconexion()
    logger.info("Módulo ia-engine detenido.")


if __name__ == "__main__":
    main()

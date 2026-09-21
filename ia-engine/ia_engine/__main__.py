"""
Punto de entrada del módulo ia-engine.

Ejecutado con: python -m ia_engine

Arranca:
1. El Detector (carga el modelo YOLO una sola vez).
2. El ClienteAPI (conexión HTTP al backend).
3. Un LectorStream por cada stream RTSP configurado.
4. Un loop de heartbeat periódico.

Se detiene limpiamente con Ctrl+C (SIGINT) o SIGTERM (Docker stop).
"""

from __future__ import annotations

import logging
import signal
import sys
import threading
import time

from .analizador import Analizador
from .cliente_api import ClienteAPI
from .config import config, parsear_streams
from .detector import Detector
from .lector_stream import LectorStream

# ── Logging ──────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
logger = logging.getLogger("ia_engine")


def _sincronizar_conteo_esperado(
    cliente: ClienteAPI,
    lectores: list[LectorStream],
) -> None:
    """
    Lee la línea base del rebaño desde el backend y la aplica a cada stream.

    Es lo que habilita la alerta de CONTEO: el Analizador solo puede decidir si
    faltan ovejas comparando lo detectado contra este número. Si el backend no
    responde se usa CONTEO_ESPERADO del entorno, y si tampoco existe se deja el
    valor anterior en lugar de borrarlo.
    """
    remoto = cliente.obtener_configuracion()
    esperado = remoto.get("conteoEsperado") if remoto else None
    origen = "backend"

    if esperado is None:
        esperado = config.conteo_esperado
        origen = "variable de entorno"

    if esperado is None:
        logger.warning(
            "Sin conteo esperado: el predio no fijó una línea base y no hay "
            "CONTEO_ESPERADO en el entorno. Las alertas de CONTEO quedan "
            "inactivas; las de DISPERSION siguen funcionando."
        )
        return

    for lector in lectores:
        lector.estado.conteo_esperado = esperado

    logger.info("Conteo esperado = %d (según %s).", esperado, origen)


def main() -> None:
    """Punto de entrada principal."""
    logger.info("═══════════════════════════════════════════════════")
    logger.info("  OviApp — Módulo de IA (visión por computadora)")
    logger.info("═══════════════════════════════════════════════════")

    # ── Parsear streams configurados ─────────────────────────────────
    streams = parsear_streams(config.rtsp_streams)
    if not streams:
        logger.error("No se configuraron streams RTSP. Revisa RTSP_STREAMS.")
        sys.exit(1)

    logger.info("Streams configurados: %s", list(streams.keys()))
    logger.info("FPS procesamiento: %d", config.fps_procesamiento)
    logger.info("Heartbeat cada %d seg", config.heartbeat_intervalo_seg)

    # ── Inicializar componentes ──────────────────────────────────────
    detector = Detector(
        model_path=config.model_path,
        confianza=config.confianza_minima,
    )

    cliente = ClienteAPI(
        backend_url=config.backend_url,
        api_key=config.edge_api_key,
    )

    analizador = Analizador(cliente)

    # ── Crear y arrancar un LectorStream por cada stream ─────────────
    lectores: list[LectorStream] = []
    for nombre, url in streams.items():
        lector = LectorStream(
            nombre=nombre,
            url_rtsp=url,
            detector=detector,
            analizador=analizador,
        )
        lector.iniciar()
        lectores.append(lector)

    # ── Línea base del rebaño ────────────────────────────────────────
    # Sin conteo esperado, la regla de CONTEO no puede evaluarse: es la
    # comparación contra este número la que decide si faltan ovejas.
    _sincronizar_conteo_esperado(cliente, lectores)

    # ── Manejo de señales para cierre limpio ─────────────────────────
    detenido = threading.Event()

    def _manejar_senal(signum: int, _frame: object) -> None:
        nombre_senal = signal.Signals(signum).name
        logger.info("Señal %s recibida — deteniendo...", nombre_senal)
        detenido.set()

    signal.signal(signal.SIGINT, _manejar_senal)
    signal.signal(signal.SIGTERM, _manejar_senal)

    # ── Loop de heartbeat ────────────────────────────────────────────
    logger.info("Módulo ia-engine iniciado. Esperando frames...")

    while not detenido.is_set():
        # Máximo detectado en cada stream desde el heartbeat anterior (no el
        # último frame: un solo instante puede subestimar el rebaño).
        conteo_actual: int | None = None
        for lector in lectores:
            if lector.estado.ultimo_conteo is not None:
                if conteo_actual is None:
                    conteo_actual = 0
                conteo_actual += lector.estado.tomar_conteo_heartbeat()

        cliente.enviar_heartbeat(conteo_actual)

        if conteo_actual is not None:
            logger.info(
                "Heartbeat enviado — conteo actual: %d", conteo_actual
            )
        else:
            logger.info("Heartbeat enviado — sin conteo aún.")

        # Verificar que los hilos de los streams siguen vivos.
        for lector in lectores:
            if not lector.esta_vivo():
                logger.error(
                    "Stream '%s' se detuvo inesperadamente.",
                    lector.nombre,
                )

        # Refrescar la línea base: el Productor puede cambiarla en cualquier
        # momento, y esto también la recupera si el backend estaba caído al
        # arrancar el módulo.
        _sincronizar_conteo_esperado(cliente, lectores)

        detenido.wait(config.heartbeat_intervalo_seg)

    # ── Cierre limpio ────────────────────────────────────────────────
    logger.info("Deteniendo streams...")
    for lector in lectores:
        lector.detener()

    # Dar 5 segundos para que los hilos terminen.
    for lector in lectores:
        lector._hilo.join(timeout=5)

    # Avisar al backend para que "en línea" caiga de inmediato en vez de
    # esperar el timeout por falta de heartbeat. Solo cubre este apagado
    # ordenado (SIGTERM/SIGINT); un SIGKILL no llega a avisar.
    try:
        cliente.enviar_desconexion()
    except Exception:
        logger.exception("Error inesperado al avisar la desconexión.")

    logger.info("Módulo ia-engine detenido.")


if __name__ == "__main__":
    main()

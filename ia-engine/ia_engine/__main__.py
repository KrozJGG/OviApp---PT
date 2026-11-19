"""
Punto de entrada del módulo ia-engine.

Ejecutado con: python -m ia_engine

Flujo en CPU con soporte de Región de Interés (ROI):
1. Carga el modelo YOLO en formato ONNX (`task="detect"`).
2. Inicia `CapturadorRTSP` en segundo plano conservando solo el último frame.
3. Sincroniza periódicamente la ROI configurada desde el backend (`GET /edge/configuracion`).
4. Aplica recorte con margen + filtrado exacto por polígono (o frame completo si no hay ROI).
5. Estabiliza el conteo con mediana móvil y envía el heartbeat periódico al backend.

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

from .captura_rtsp import CapturadorRTSP
from .cliente_api import ClienteAPI
from .config import config, parsear_streams
from .roi import RegionInteres, contar_en_roi, parsear_roi, recortar_frame

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)

logger = logging.getLogger("ia_engine")

_REINTENTO_STREAM_SEG = 3.0


def _describir_roi(roi: RegionInteres | None) -> str:
    if roi is None:
        return "imagen completa"
    return f"{roi.tipo} ({len(roi.puntos)} vértices)"


def _sincronizar_roi(
    cliente: ClienteAPI,
    roi_actual: RegionInteres | None,
) -> tuple[RegionInteres | None, bool]:
    """Consulta el backend y reporta si la ROI cambió respecto al estado actual."""
    ok, data = cliente.obtener_configuracion()
    if not ok:
        return roi_actual, False

    nueva_roi = parsear_roi(data)
    if nueva_roi == roi_actual:
        return roi_actual, False

    logger.info("ROI actualizada → %s", _describir_roi(nueva_roi))
    return nueva_roi, True


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
        "Modelo ONNX: %s (imgsz=%d, confianza=%.2f, iou=%.2f, tile=%s, intervalo=%.2fs)",
        config.model_path,
        config.imgsz,
        config.confianza_minima,
        config.iou_nms,
        tile_activo,
        config.intervalo_inferencia_seg,
    )
    logger.info(
        "ROI modo=%s (margen=%.2f, sync=%ds) | Mediana=%d muestras | Heartbeat=%ds",
        config.roi_modo,
        config.roi_margen_recorte,
        config.roi_sync_intervalo_seg,
        config.ventana_mediana,
        config.heartbeat_intervalo_seg,
    )

    modelo = YOLO(config.model_path, task="detect")
    cliente = ClienteAPI(backend_url=config.backend_url, api_key=config.edge_api_key)

    detenido = threading.Event()

    def _manejar_senal(signum: int, _frame: object) -> None:
        logger.info("Señal %s recibida — deteniendo...", signal.Signals(signum).name)
        detenido.set()

    signal.signal(signal.SIGINT, _manejar_senal)
    signal.signal(signal.SIGTERM, _manejar_senal)

    roi_actual, _ = _sincronizar_roi(cliente, None)
    logger.info("Configuración inicial de ROI: %s", _describir_roi(roi_actual))

    capturador = CapturadorRTSP(url_rtsp=url_rtsp, reintento_seg=_REINTENTO_STREAM_SEG)
    capturador.iniciar()

    ventana: deque[int] = deque(maxlen=config.ventana_mediana)
    ahora_inicio = time.monotonic()
    proximo_heartbeat = ahora_inicio + config.heartbeat_intervalo_seg
    proximo_sync_roi = ahora_inicio + config.roi_sync_intervalo_seg
    ultimo_seq = 0

    logger.info("Módulo ia-engine iniciado.")

    try:
        while not detenido.is_set():
            ahora = time.monotonic()

            if ahora >= proximo_sync_roi:
                roi_actual, cambio = _sincronizar_roi(cliente, roi_actual)
                if cambio:
                    ventana.clear()
                proximo_sync_roi = time.monotonic() + config.roi_sync_intervalo_seg

            capturado = capturador.obtener_ultimo_frame(ultimo_seq=ultimo_seq, timeout=0.5)
            if capturado is not None:
                ultimo_seq, frame = capturado
                inicio_inf = time.monotonic()

                try:
                    if roi_actual is None:
                        imagen = frame
                        offset = (0, 0)
                    elif config.roi_modo == "recorte":
                        imagen, (x1, y1, _, _) = recortar_frame(
                            frame,
                            roi_actual,
                            margen=config.roi_margen_recorte,
                        )
                        offset = (x1, y1)
                    else:
                        imagen = frame
                        offset = (0, 0)

                    resultados = modelo.predict(
                        source=imagen,
                        imgsz=config.imgsz,
                        conf=config.confianza_minima,
                        iou=config.iou_nms,
                        device="cpu",
                        verbose=False,
                        **({"tile": tile_activo} if tile_activo is not None else {}),
                    )

                    boxes = resultados[0].boxes if resultados else None
                    if boxes is None or len(boxes) == 0:
                        conteo_frame = 0
                    elif roi_actual is None:
                        conteo_frame = len(boxes)
                    else:
                        alto_orig, ancho_orig = frame.shape[:2]
                        conteo_frame = contar_en_roi(
                            boxes.xywh.tolist(),
                            ancho_orig,
                            alto_orig,
                            roi_actual,
                            offset=offset,
                        )

                    ventana.append(conteo_frame)
                except Exception as e:
                    logger.warning("[%s] Error procesando frame: %s", nombre_stream, e)

                duracion_inf = time.monotonic() - inicio_inf
                restante = config.intervalo_inferencia_seg - duracion_inf
                if restante > 0:
                    espera_max = min(
                        restante,
                        max(0.0, proximo_heartbeat - time.monotonic()),
                        max(0.0, proximo_sync_roi - time.monotonic()),
                    )
                    if espera_max > 0:
                        detenido.wait(espera_max)

            ahora_hb = time.monotonic()
            if ahora_hb >= proximo_heartbeat:
                if len(ventana) > 0:
                    mediana = int(round(statistics.median(ventana)))
                    if cliente.enviar_heartbeat(mediana):
                        logger.info(
                            "[%s] Heartbeat enviado — %d ovejas detectadas (roi=%s, muestras=%s)",
                            nombre_stream,
                            mediana,
                            _describir_roi(roi_actual),
                            list(ventana),
                        )
                proximo_heartbeat = time.monotonic() + config.heartbeat_intervalo_seg
    finally:
        capturador.detener()
        cliente.enviar_desconexion()
        logger.info("Módulo ia-engine detenido.")


if __name__ == "__main__":
    main()

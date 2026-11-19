"""
Capturador RTSP en hilo dedicado sin acumulación de buffer.

Mantiene únicamente el último fotograma disponible del stream para evitar que la
latencia crezca cuando la inferencia en CPU es más lenta que el FPS de la cámara.
"""

from __future__ import annotations

import logging
import os
import threading
from typing import Any

import cv2

logger = logging.getLogger(__name__)


class CapturadorRTSP:
    """Lector RTSP asíncrono que descarta fotogramas intermedios antiguos."""

    def __init__(self, url_rtsp: str, reintento_seg: float = 3.0) -> None:
        self._url_rtsp = url_rtsp
        self._reintento_seg = reintento_seg
        self._detenido = threading.Event()
        self._condicion = threading.Condition()
        self._frame: Any = None
        self._seq: int = 0
        self._hilo: threading.Thread | None = None

    def iniciar(self) -> None:
        """Inicia el hilo demonio de lectura RTSP."""
        if self._hilo is not None and self._hilo.is_alive():
            return
        os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp")
        self._hilo = threading.Thread(
            target=self._bucle_captura,
            name="captura-rtsp",
            daemon=True,
        )
        self._hilo.start()

    def _bucle_captura(self) -> None:
        while not self._detenido.is_set():
            cap = cv2.VideoCapture(self._url_rtsp, cv2.CAP_FFMPEG)
            if not cap.isOpened():
                cap.release()
                if not self._detenido.is_set():
                    logger.warning(
                        "No se pudo abrir el stream RTSP (%s). Reintentando en %.1f s...",
                        self._url_rtsp,
                        self._reintento_seg,
                    )
                    self._detenido.wait(self._reintento_seg)
                continue

            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            logger.info("Conectado al stream RTSP: %s", self._url_rtsp)

            try:
                while not self._detenido.is_set():
                    ok, frame = cap.read()
                    if not ok or frame is None:
                        break

                    with self._condicion:
                        self._seq += 1
                        self._frame = frame
                        self._condicion.notify_all()
            except Exception as exc:
                if not self._detenido.is_set():
                    logger.warning("Error leyendo stream RTSP: %s", exc)
            finally:
                cap.release()

            if not self._detenido.is_set():
                logger.info(
                    "Stream RTSP desconectado o finalizado. Reintentando en %.1f s...",
                    self._reintento_seg,
                )
                self._detenido.wait(self._reintento_seg)

    def obtener_ultimo_frame(
        self,
        ultimo_seq: int = 0,
        timeout: float = 1.0,
    ) -> tuple[int, Any] | None:
        """
        Espera hasta `timeout` segundos por un frame más reciente que `ultimo_seq`.
        Retorna `(seq, copia_frame)` o `None` si no hubo uno nuevo a tiempo.
        """
        with self._condicion:
            if not self._detenido.is_set() and (self._frame is None or self._seq <= ultimo_seq):
                self._condicion.wait(timeout=timeout)

            if self._detenido.is_set() or self._frame is None or self._seq <= ultimo_seq:
                return None

            return self._seq, self._frame.copy()

    def detener(self) -> None:
        """Detiene el hilo lector y libera el recurso de captura."""
        self._detenido.set()
        with self._condicion:
            self._condicion.notify_all()
        if self._hilo is not None:
            self._hilo.join(timeout=5.0)

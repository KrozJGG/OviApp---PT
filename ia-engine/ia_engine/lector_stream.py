"""
Lector de streams RTSP — captura de video y descarte de fotogramas.

Cada instancia de LectorStream corre en su propio hilo y se encarga de:
1. Abrir un stream RTSP con OpenCV.
2. Descartar frames para procesar solo los necesarios según FPS_PROCESAMIENTO.
3. Enviar cada frame útil al Detector y luego al Analizador.
4. Reconectar automáticamente si el stream se corta (backoff exponencial).
"""

from __future__ import annotations

import logging
import threading
import time

import cv2
import numpy as np

from .analizador import Analizador, EstadoStream
from .config import config
from .detector import Detector

logger = logging.getLogger(__name__)

# Reconexión
_MAX_BACKOFF_SEG = 60
_BACKOFF_INICIAL_SEG = 2


class LectorStream:
    """
    Hilo que consume un stream RTSP y procesa frames con el Detector.

    Cada stream tiene su propio tracker (ByteTrack) y estado de análisis,
    pero comparte la instancia del Detector (modelo YOLO) y del Analizador.
    """

    def __init__(
        self,
        nombre: str,
        url_rtsp: str,
        detector: Detector,
        analizador: Analizador,
    ) -> None:
        self.nombre = nombre
        self._url = url_rtsp
        self._detector = detector
        self._analizador = analizador
        self._tracker = detector.crear_tracker()
        self._estado = analizador.crear_estado(nombre)
        self._detenido = threading.Event()
        self._hilo = threading.Thread(
            target=self._loop,
            daemon=True,
            name=f"stream-{nombre}",
        )

    @property
    def estado(self) -> EstadoStream:
        """Estado de análisis de este stream (para heartbeats)."""
        return self._estado

    def iniciar(self) -> None:
        """Inicia el hilo de captura."""
        logger.info("Iniciando stream '%s' → %s", self.nombre, self._url)
        self._hilo.start()

    def detener(self) -> None:
        """Señala al hilo que se detenga."""
        self._detenido.set()

    def esta_vivo(self) -> bool:
        """Retorna True si el hilo sigue corriendo."""
        return self._hilo.is_alive()

    # ── Loop principal ───────────────────────────────────────────────────

    def _loop(self) -> None:
        """Loop de captura con reconexión automática."""
        backoff = _BACKOFF_INICIAL_SEG

        while not self._detenido.is_set():
            cap = self._conectar()
            if cap is None:
                logger.warning(
                    "[%s] No se pudo conectar. Reintentando en %ds...",
                    self.nombre,
                    backoff,
                )
                self._detenido.wait(backoff)
                backoff = min(backoff * 2, _MAX_BACKOFF_SEG)
                continue

            # Conexión exitosa — resetear backoff.
            backoff = _BACKOFF_INICIAL_SEG
            logger.info("[%s] Conectado al stream RTSP.", self.nombre)

            try:
                self._procesar_stream(cap)
            except Exception:
                logger.exception("[%s] Error en el procesamiento del stream.", self.nombre)
            finally:
                cap.release()

            if not self._detenido.is_set():
                logger.warning(
                    "[%s] Stream desconectado. Reconectando en %ds...",
                    self.nombre,
                    backoff,
                )
                self._detenido.wait(backoff)

    def _conectar(self) -> cv2.VideoCapture | None:
        """Intenta abrir el stream RTSP."""
        try:
            cap = cv2.VideoCapture(self._url, cv2.CAP_FFMPEG)

            # Configurar buffer mínimo para reducir latencia.
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

            if not cap.isOpened():
                return None

            return cap
        except Exception:
            logger.exception("[%s] Excepción al abrir el stream.", self.nombre)
            return None

    def _procesar_stream(self, cap: cv2.VideoCapture) -> None:
        """
        Lee frames del stream y procesa solo los necesarios.

        Si el stream corre a 30fps y FPS_PROCESAMIENTO=2, solo 2 de cada
        30 frames se envían al modelo YOLO. Los demás se descartan
        con cap.grab() (más rápido que cap.read() porque no decodifica).
        """
        fps_stream = cap.get(cv2.CAP_PROP_FPS)
        if fps_stream <= 0:
            fps_stream = 30.0  # Asumir 30fps si no se puede determinar.

        # Cada cuántos frames procesar uno.
        intervalo = max(1, int(fps_stream / config.fps_procesamiento))
        contador_frames = 0

        logger.info(
            "[%s] Stream a %.0f fps — procesando 1 de cada %d frames (%d fps efectivos).",
            self.nombre,
            fps_stream,
            intervalo,
            config.fps_procesamiento,
        )

        while not self._detenido.is_set():
            # grab() lee el frame sin decodificarlo (rápido).
            ok = cap.grab()
            if not ok:
                logger.warning("[%s] No se pudo leer el frame — stream caído.", self.nombre)
                break

            contador_frames += 1

            # Solo decodificar y procesar cada N frames.
            if contador_frames % intervalo != 0:
                continue

            # retrieve() decodifica el frame ya capturado.
            ok, frame = cap.retrieve()
            if not ok or frame is None:
                continue

            self._procesar_frame(frame)

    def _procesar_frame(self, frame: np.ndarray) -> None:
        """Envía un frame al Detector y luego al Analizador."""
        resultado = self._detector.detectar(frame, self._tracker)
        self._analizador.evaluar(resultado, self._estado)

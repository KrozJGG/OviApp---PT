"""
Lector de streams RTSP — captura de video y muestreo del conteo.

Cada instancia de LectorStream corre en su propio hilo y se encarga de:
1. Abrir un stream RTSP con OpenCV.
2. Leer el stream continuamente (para no acumular retraso) y, cada
   INTERVALO_INFERENCIA_SEG, pasar el frame actual al Detector.
3. Guardar el conteo de cada inferencia como muestra de la ventana actual.
4. Entregar la mediana de la ventana cuando el loop principal envía el heartbeat.
5. Reconectar automáticamente si el stream se corta (backoff exponencial).
"""

from __future__ import annotations

import logging
import statistics
import threading
import time

import cv2

from .config import config
from .detector import Detector

logger = logging.getLogger(__name__)

# Reconexión
_MAX_BACKOFF_SEG = 60
_BACKOFF_INICIAL_SEG = 2


class LectorStream:
    """Hilo que consume un stream RTSP y cuenta ovejas con el Detector."""

    def __init__(self, nombre: str, url_rtsp: str, detector: Detector) -> None:
        self.nombre = nombre
        self._url = url_rtsp
        self._detector = detector

        # Conteos tomados desde el último heartbeat. Los escribe el hilo del
        # stream y los consume el loop principal, por eso van con lock.
        self._muestras: list[int] = []
        self._lock = threading.Lock()

        # Último conteo reportado; se reutiliza si una ventana queda sin muestras.
        self.ultimo_conteo: int | None = None

        self._detenido = threading.Event()
        self._hilo = threading.Thread(
            target=self._loop,
            daemon=True,
            name=f"stream-{nombre}",
        )

    # ── API pública ──────────────────────────────────────────────────────

    def iniciar(self) -> None:
        """Inicia el hilo de captura."""
        logger.info("Iniciando stream '%s' → %s", self.nombre, self._url)
        self._hilo.start()

    def detener(self, timeout: float = 5) -> None:
        """Señala al hilo que se detenga y espera a que termine."""
        self._detenido.set()
        self._hilo.join(timeout=timeout)

    def esta_vivo(self) -> bool:
        """Retorna True si el hilo sigue corriendo."""
        return self._hilo.is_alive()

    def tomar_conteo_heartbeat(self) -> int | None:
        """
        Devuelve la mediana de los conteos de la ventana y la reinicia.

        La mediana descarta lecturas atípicas (una pérdida puntual de precisión
        del modelo o un falso positivo aislado). Si la ventana no tuvo muestras,
        devuelve el último conteo conocido, o None si aún no hay ninguno.
        """
        with self._lock:
            muestras = self._muestras
            self._muestras = []

        if muestras:
            self.ultimo_conteo = int(round(statistics.median(muestras)))
            logger.info(
                "[%s] Muestras de la ventana: %s → mediana %d",
                self.nombre,
                muestras,
                self.ultimo_conteo,
            )

        return self.ultimo_conteo

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
            # Buffer mínimo para reducir latencia.
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            if not cap.isOpened():
                return None
            return cap
        except Exception:
            logger.exception("[%s] Excepción al abrir el stream.", self.nombre)
            return None

    def _procesar_stream(self, cap: cv2.VideoCapture) -> None:
        """
        Lee el stream sin pausa y ejecuta el modelo cada INTERVALO_INFERENCIA_SEG.

        Los frames intermedios se descartan con cap.grab(), que no los
        convierte a imagen; solo el frame que toca analizar se decodifica con
        cap.retrieve(). Leer de forma continua evita que el video se atrase
        respecto del tiempo real.
        """
        intervalo = config.intervalo_inferencia_seg
        # Analizar el primer frame apenas se conecta.
        proxima_inferencia = time.monotonic()

        logger.info("[%s] Analizando 1 frame cada %.1f s.", self.nombre, intervalo)

        while not self._detenido.is_set():
            if not cap.grab():
                logger.warning("[%s] No se pudo leer el frame — stream caído.", self.nombre)
                break

            ahora = time.monotonic()
            if ahora < proxima_inferencia:
                continue

            ok, frame = cap.retrieve()
            if not ok or frame is None:
                continue

            proxima_inferencia = ahora + intervalo
            resultado = self._detector.detectar(frame)

            with self._lock:
                self._muestras.append(resultado.conteo)

            logger.debug(
                "[%s] %d ovejas detectadas (confianza media %.2f).",
                self.nombre,
                resultado.conteo,
                resultado.confianza_promedio,
            )

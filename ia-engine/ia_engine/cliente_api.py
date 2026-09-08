"""
Cliente HTTP para comunicarse con el backend Express.

Envía alertas (POST /api/v1/edge/alertas) y heartbeats
(POST /api/v1/edge/heartbeat) autenticándose con la API key
del dispositivo edge en el header x-edge-key.

Incluye reintentos con backoff exponencial para tolerar cortes de red
(RNF - Tolerancia a Fallos de Red) y una cola local en memoria
para alertas que no se pudieron entregar.
"""

from __future__ import annotations

import logging
import queue
import threading
import time
from datetime import datetime, timezone
from typing import Any

import requests

from .config import config

logger = logging.getLogger(__name__)

# Cabecera que espera el middleware autenticarEdge del backend.
_CABECERA_EDGE = "x-edge-key"

# Configuración de reintentos
_MAX_REINTENTOS = 5
_BACKOFF_BASE_SEG = 2
_TIMEOUT_SEG = 10


class ClienteAPI:
    """
    Cliente HTTP al backend de OviApp.

    Características:
    - Autenticación automática con API key en cada petición.
    - Reintentos con backoff exponencial ante fallos de red.
    - Cola de alertas pendientes que se reintenta en segundo plano.
    """

    def __init__(self, backend_url: str, api_key: str) -> None:
        self._base_url = backend_url.rstrip("/")
        self._session = requests.Session()
        self._session.headers.update({
            _CABECERA_EDGE: api_key,
            "Content-Type": "application/json",
        })
        # Cola de alertas que no se pudieron enviar.
        self._cola_pendientes: queue.Queue[dict[str, Any]] = queue.Queue(maxsize=200)
        self._hilo_reintentos = threading.Thread(
            target=self._procesar_pendientes,
            daemon=True,
            name="reintento-alertas",
        )
        self._hilo_reintentos.start()

    # ── API pública ──────────────────────────────────────────────────────

    def enviar_alerta(
        self,
        tipo_alerta: str,
        conteo_animales: int | None = None,
        conteo_esperado: int | None = None,
        nivel: str = "ADVERTENCIA",
        descripcion: str | None = None,
    ) -> bool:
        """
        Envía una alerta al backend. Si falla, la encola para reintento.

        Retorna True si se entregó exitosamente, False si se encoló.
        """
        payload: dict[str, Any] = {
            "tipoAlerta": tipo_alerta,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        if conteo_animales is not None:
            payload["conteoAnimales"] = conteo_animales
        if conteo_esperado is not None:
            payload["conteoEsperado"] = conteo_esperado
        if nivel:
            payload["nivel"] = nivel
        if descripcion:
            payload["descripcion"] = descripcion

        ok = self._post_con_reintento(f"{self._base_url}/api/v1/edge/alertas", payload)
        if not ok:
            self._encolar(payload)
        return ok

    def enviar_heartbeat(self, conteo_actual: int | None = None) -> bool:
        """Envía un latido de presencia al backend."""
        payload: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        if conteo_actual is not None:
            payload["conteoActual"] = conteo_actual

        return self._post_con_reintento(
            f"{self._base_url}/api/v1/edge/heartbeat", payload
        )

    # ── Internos ─────────────────────────────────────────────────────────

    def _post_con_reintento(self, url: str, payload: dict[str, Any]) -> bool:
        """POST con reintentos y backoff exponencial."""
        for intento in range(_MAX_REINTENTOS):
            try:
                resp = self._session.post(url, json=payload, timeout=_TIMEOUT_SEG)
                if resp.status_code in (200, 201, 204):
                    return True

                logger.warning(
                    "Backend respondió %d en %s: %s",
                    resp.status_code,
                    url,
                    resp.text[:200],
                )
                # 4xx (excepto 429) → no reintentar, el payload es inválido.
                if 400 <= resp.status_code < 500 and resp.status_code != 429:
                    return False

            except requests.RequestException as e:
                logger.warning(
                    "Error de red al enviar a %s (intento %d/%d): %s",
                    url,
                    intento + 1,
                    _MAX_REINTENTOS,
                    e,
                )

            if intento < _MAX_REINTENTOS - 1:
                espera = _BACKOFF_BASE_SEG * (2**intento)
                time.sleep(espera)

        return False

    def _encolar(self, payload: dict[str, Any]) -> None:
        """Encola una alerta para reintento posterior."""
        try:
            self._cola_pendientes.put_nowait(payload)
            logger.info(
                "Alerta encolada para reintento (%d pendientes).",
                self._cola_pendientes.qsize(),
            )
        except queue.Full:
            logger.error(
                "Cola de alertas pendientes llena — se descartó la alerta: %s",
                payload.get("tipoAlerta"),
            )

    def _procesar_pendientes(self) -> None:
        """Hilo daemon que reintenta enviar alertas pendientes."""
        while True:
            payload = self._cola_pendientes.get()  # bloquea hasta tener algo
            logger.info("Reintentando alerta pendiente: %s", payload.get("tipoAlerta"))

            ok = self._post_con_reintento(
                f"{self._base_url}/api/v1/edge/alertas", payload
            )
            if not ok:
                # Volver a encolar si sigue sin funcionar
                self._encolar(payload)
                # Esperar antes de reintentar la siguiente
                time.sleep(30)

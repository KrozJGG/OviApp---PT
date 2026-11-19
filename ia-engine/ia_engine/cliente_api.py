"""
Cliente HTTP para comunicarse con el backend Express.

Envía el conteo de ovejas en cada heartbeat (POST /api/v1/edge/heartbeat)
y avisa del apagado limpio (POST /api/v1/edge/desconexion), autenticándose
con la API key del dispositivo edge en el header x-edge-key.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import requests

logger = logging.getLogger(__name__)

# Cabecera que espera el middleware autenticarEdge del backend.
_CABECERA_EDGE = "x-edge-key"
_TIMEOUT_SEG = 10


class ClienteAPI:
    """Cliente HTTP al backend de OviApp."""

    def __init__(self, backend_url: str, api_key: str) -> None:
        self._base_url = backend_url.rstrip("/")
        self._session = requests.Session()
        self._session.headers.update({
            _CABECERA_EDGE: api_key,
            "Content-Type": "application/json",
        })

    def enviar_heartbeat(self, conteo_actual: int | None = None) -> bool:
        """
        Envía el latido con el conteo de ovejas detectadas.

        No reintenta: el siguiente heartbeat llega en pocos segundos con un
        conteo más reciente, así que reenviar uno viejo no aporta nada.
        """
        payload: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        if conteo_actual is not None:
            payload["conteoActual"] = conteo_actual

        url = f"{self._base_url}/api/v1/edge/heartbeat"
        try:
            resp = self._session.post(url, json=payload, timeout=_TIMEOUT_SEG)
        except requests.RequestException as e:
            logger.warning("Error de red al enviar el heartbeat: %s", e)
            return False

        if resp.status_code in (200, 201, 204):
            return True

        logger.warning(
            "Backend respondió %d al heartbeat: %s",
            resp.status_code,
            resp.text[:200],
        )
        return False

    def obtener_configuracion(self) -> tuple[bool, dict[str, Any] | None]:
        """
        Consulta la configuración activa del dispositivo (ROI vigente).

        Retorna `(True, payload)` en caso de éxito y `(False, None)` si hubo un
        error de red o respuesta inesperada, permitiendo conservar la última ROI
        conocida durante cortes temporales del backend.
        """
        url = f"{self._base_url}/api/v1/edge/configuracion"
        try:
            resp = self._session.get(url, timeout=_TIMEOUT_SEG)
        except requests.RequestException as e:
            logger.warning("Error de red al consultar la configuración edge: %s", e)
            return False, None

        if resp.status_code == 200:
            try:
                data = resp.json()
            except ValueError as e:
                logger.warning("Respuesta JSON inválida en /edge/configuracion: %s", e)
                return False, None
            return (True, data) if isinstance(data, dict) else (False, None)

        logger.warning(
            "Backend respondió %d a /edge/configuracion: %s",
            resp.status_code,
            resp.text[:200],
        )
        return False, None

    def enviar_desconexion(self) -> None:
        """
        Avisa al backend de un apagado limpio (SIGTERM/SIGINT).

        Un solo intento con timeout corto, para no demorar el apagado si el
        backend no responde dentro del grace period de Docker.
        """
        try:
            self._session.post(
                f"{self._base_url}/api/v1/edge/desconexion",
                json={"timestamp": datetime.now(timezone.utc).isoformat()},
                timeout=3,
            )
        except requests.RequestException as e:
            logger.warning("No se pudo avisar la desconexión al backend: %s", e)

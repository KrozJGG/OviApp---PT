"""
Analizador de alertas — reglas de negocio de detección.

Evalúa los resultados del Detector frame a frame y decide cuándo
emitir alertas al backend. Implementa:
- Alerta CONTEO: diferencia sostenida entre detectado y esperado.
- Alerta DISPERSION: ovejas excesivamente dispersas (posible pánico).
- Cooldown por tipo de alerta para evitar spam.

La alerta AMENAZA queda como stub — se activará cuando el modelo
sea entrenado para detectar depredadores/intrusos.
"""

from __future__ import annotations

import logging
import math
import time
from collections import deque
from dataclasses import dataclass, field

from .cliente_api import ClienteAPI
from .config import config
from .detector import ResultadoDeteccion

logger = logging.getLogger(__name__)


@dataclass
class EstadoStream:
    """Estado de análisis de un stream individual."""

    nombre: str
    conteo_esperado: int | None = None

    # Ventana deslizante de conteos recientes para confirmar anomalías.
    historial_conteos: deque[int] = field(
        default_factory=lambda: deque(maxlen=config.conteo_frames_confirmacion)
    )

    # Último timestamp de cada tipo de alerta emitida (para cooldown).
    _ultimo_alerta: dict[str, float] = field(default_factory=dict)

    # Último conteo reportado en el heartbeat.
    ultimo_conteo: int | None = None

    def puede_alertar(self, tipo: str) -> bool:
        """Verifica si pasó el cooldown para este tipo de alerta."""
        ultimo = self._ultimo_alerta.get(tipo, 0)
        return (time.time() - ultimo) >= config.alerta_cooldown_seg

    def registrar_alerta(self, tipo: str) -> None:
        """Registra que se emitió una alerta de este tipo."""
        self._ultimo_alerta[tipo] = time.time()


class Analizador:
    """
    Evalúa detecciones y emite alertas al backend cuando corresponde.

    Cada stream tiene su propio EstadoStream. El Analizador es
    thread-safe respecto a la emisión de alertas porque cada hilo
    (LectorStream) trabaja con su propio estado.
    """

    def __init__(self, cliente: ClienteAPI) -> None:
        self._cliente = cliente

    def crear_estado(self, nombre_stream: str) -> EstadoStream:
        """Crea un estado de análisis para un stream nuevo."""
        return EstadoStream(nombre=nombre_stream)

    def evaluar(
        self,
        resultado: ResultadoDeteccion,
        estado: EstadoStream,
    ) -> None:
        """
        Evalúa un resultado de detección y emite alertas si corresponde.

        Se llama una vez por cada frame procesado.
        """
        estado.historial_conteos.append(resultado.conteo)
        estado.ultimo_conteo = resultado.conteo

        self._evaluar_conteo(resultado, estado)
        self._evaluar_dispersion(resultado, estado)
        # TODO: Evaluar AMENAZA cuando el modelo soporte multi-clase.

    # ── Reglas de alerta ─────────────────────────────────────────────────

    def _evaluar_conteo(
        self,
        resultado: ResultadoDeteccion,
        estado: EstadoStream,
    ) -> None:
        """
        Alerta CONTEO — el conteo detectado difiere del esperado de forma
        sostenida durante varios frames consecutivos.
        """
        if estado.conteo_esperado is None:
            return
        if not estado.puede_alertar("CONTEO"):
            return

        # Solo alertar si tenemos suficientes frames para confirmar.
        if len(estado.historial_conteos) < config.conteo_frames_confirmacion:
            return

        # Verificar que TODOS los frames recientes muestran diferencia.
        todos_anomalos = all(
            abs(c - estado.conteo_esperado) >= config.conteo_umbral_diferencia
            for c in estado.historial_conteos
        )

        if not todos_anomalos:
            return

        conteo_promedio = sum(estado.historial_conteos) // len(estado.historial_conteos)
        diferencia = conteo_promedio - estado.conteo_esperado

        if diferencia < 0:
            descripcion = (
                f"[{estado.nombre}] Faltan ovejas: {conteo_promedio} detectadas "
                f"de {estado.conteo_esperado} esperadas."
            )
            nivel = "CRITICA"
        else:
            descripcion = (
                f"[{estado.nombre}] Exceso de ovejas: {conteo_promedio} detectadas "
                f"de {estado.conteo_esperado} esperadas."
            )
            nivel = "ADVERTENCIA"

        logger.warning("Alerta CONTEO: %s", descripcion)
        self._cliente.enviar_alerta(
            tipo_alerta="CONTEO",
            conteo_animales=conteo_promedio,
            conteo_esperado=estado.conteo_esperado,
            nivel=nivel,
            descripcion=descripcion,
        )
        estado.registrar_alerta("CONTEO")

    def _evaluar_dispersion(
        self,
        resultado: ResultadoDeteccion,
        estado: EstadoStream,
    ) -> None:
        """
        Alerta DISPERSION — las ovejas están excesivamente separadas,
        lo que puede indicar pánico, ataque o comportamiento anormal.

        Se calcula la distancia promedio entre todos los pares de centroides y
        se normaliza contra la diagonal del FOTOGRAMA, que es una referencia
        fija. Normalizar contra la caja que envuelve a las propias detecciones
        haría la medida invariante a la escala —numerador y denominador crecen
        juntos cuando el rebaño se abre— y acabaría midiendo la forma de la
        distribución en vez de cuánto se dispersó.
        """
        if not estado.puede_alertar("DISPERSION"):
            return

        # Necesitamos al menos 3 ovejas para evaluar dispersión.
        if len(resultado.centroides) < 3:
            return

        # Sin referencia del fotograma no hay contra qué normalizar.
        if resultado.diagonal_frame <= 0:
            return

        # Calcular distancia promedio entre todos los pares de centroides.
        centroides = resultado.centroides
        n = len(centroides)
        total_dist = 0.0
        pares = 0

        for i in range(n):
            for j in range(i + 1, n):
                dx = centroides[i][0] - centroides[j][0]
                dy = centroides[i][1] - centroides[j][1]
                total_dist += math.sqrt(dx * dx + dy * dy)
                pares += 1

        if pares == 0:
            return

        dist_promedio = total_dist / pares

        # Referencia fija: la diagonal del fotograma. Un rebaño apiñado da un
        # índice cercano a 0 y uno repartido por toda la imagen se acerca a 1.
        dispersion_normalizada = dist_promedio / resultado.diagonal_frame

        if dispersion_normalizada < config.dispersion_umbral:
            return

        descripcion = (
            f"[{estado.nombre}] Dispersión anormal detectada: "
            f"índice {dispersion_normalizada:.2f} "
            f"(umbral: {config.dispersion_umbral:.2f}), "
            f"{n} ovejas."
        )

        logger.warning("Alerta DISPERSION: %s", descripcion)
        self._cliente.enviar_alerta(
            tipo_alerta="DISPERSION",
            conteo_animales=resultado.conteo,
            nivel="ADVERTENCIA",
            descripcion=descripcion,
        )
        estado.registrar_alerta("DISPERSION")

"""
Script de diagnóstico para el "conteo pegado" reportado en el módulo de IA.

No forma parte del paquete ia_engine ni corre en producción: es una
herramienta manual para separar, con evidencia, cuánto pesa cada causa
posible de la discrepancia entre lo que el usuario ve a ojo en rebano.mp4
y lo que reporta la app (que venía mostrando siempre "5 ovejas"):

  (a) el heartbeat mandaba el conteo de un único frame (ya corregido en
      analizador.py/__main__.py: ahora manda el máximo de la ventana).
  (b) CONFIANZA_MINIMA=0.5 es más estricto que el conf=0.25 por defecto
      de Ultralytics.
  (c) CLASES_OBJETIVO="sheep" filtra otras clases COCO (persona, perro,
      vaca, etc.) que una prueba manual sin filtro sí cuenta.
  (d) yolo26n.pt es un preentrenado de COCO sin fine-tuning para esta
      cámara/ángulo/resolución: puede tener techo de recall bajo incluso
      en la mejor configuración.

Uso:
    ia-engine/venv/Scripts/python.exe ia-engine/scripts/diagnostico_conteo.py

Requiere el mismo video que usa camara_mock (videos/rebano.mp4 en la raíz
del repo) y el modelo versionado (ia-engine/models/yolo26n.pt).
"""

from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path

import cv2

RAIZ_REPO = Path(__file__).resolve().parents[2]
VIDEO = RAIZ_REPO / "videos" / "rebano.mp4"
MODELO = RAIZ_REPO / "ia-engine" / "models" / "yolo26n.pt"
SALIDA = Path(__file__).resolve().parent / "salida_diagnostico"

FPS_PRODUCCION = 2
CLASE_OBJETIVO = "sheep"


def cargar_modelo():
    from ultralytics import YOLO

    if not MODELO.exists():
        sys.exit(f"No se encontró el modelo en {MODELO}")
    return YOLO(str(MODELO))


def id_clase_sheep(modelo) -> int | None:
    for i, nombre in modelo.names.items():
        if str(nombre).lower() == CLASE_OBJETIVO:
            return i
    return None


def paso1_matriz_confianza_clases(modelo) -> None:
    """
    Corre 4 combinaciones (conf 0.5/0.25 x con/sin filtro de clase) sobre
    frames muestreados del video y compara cuántas detecciones de CADA clase
    COCO aparecen. Si "sin filtro" trae muchas clases no-sheep, la prueba
    manual del usuario (que no filtró clases) no es comparable 1:1 contra
    la config de producción.
    """
    print("\n=== Paso 1: matriz confianza x filtro de clases ===")
    id_sheep = id_clase_sheep(modelo)
    if id_sheep is None:
        print("El modelo no tiene una clase 'sheep' — revisar modelo.names.")
        return

    cap = cv2.VideoCapture(str(VIDEO))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    # Muestrear 12 frames repartidos en todo el video, no todo el video entero
    # (este paso es sobre distribución de clases, no sobre la serie temporal).
    indices = [int(total_frames * i / 12) for i in range(12)]

    for conf in (0.5, 0.25):
        for filtrar in (True, False):
            contador_por_clase: Counter[str] = Counter()
            for idx in indices:
                cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
                ok, frame = cap.read()
                if not ok:
                    continue
                clases = [id_sheep] if filtrar else None
                resultado = modelo.predict(frame, conf=conf, classes=clases, verbose=False)[0]
                for cls_id in resultado.boxes.cls.tolist():
                    contador_por_clase[modelo.names[int(cls_id)]] += 1

            etiqueta = f"conf={conf} filtro_sheep={'si' if filtrar else 'no'}"
            total = sum(contador_por_clase.values())
            desglose = ", ".join(f"{k}={v}" for k, v in contador_por_clase.most_common())
            print(f"{etiqueta:35s} total={total:4d}  [{desglose}]")

    cap.release()


def paso2_serie_temporal(modelo) -> None:
    """
    Reproduce la config de producción (conf=0.5, solo sheep, 2 FPS) sobre el
    video ENTERO y registra el conteo crudo de cada frame procesado (antes
    de tracking). Si la serie oscila mucho, confirma que un snapshot de un
    solo frame (el bug ya corregido) explicaba buena parte del problema. Si
    queda plana en un número bajo, el techo está en el modelo, no en el
    snapshot.
    """
    print("\n=== Paso 2: serie temporal con config de producción (conf=0.5, sheep, 2 FPS) ===")
    id_sheep = id_clase_sheep(modelo)
    cap = cv2.VideoCapture(str(VIDEO))
    fps_video = cap.get(cv2.CAP_PROP_FPS) or 25
    salto = max(1, round(fps_video / FPS_PRODUCCION))

    conteos: list[int] = []
    idx = 0
    while True:
        ok = cap.grab()
        if not ok:
            break
        if idx % salto == 0:
            ok, frame = cap.retrieve()
            if not ok:
                break
            resultado = modelo.predict(
                frame, conf=0.5, classes=[id_sheep] if id_sheep is not None else None, verbose=False
            )[0]
            conteos.append(len(resultado.boxes))
        idx += 1
    cap.release()

    if not conteos:
        print("No se procesó ningún frame — revisar la ruta del video.")
        return

    print(f"Frames procesados: {len(conteos)}")
    print(f"Min={min(conteos)}  Max={max(conteos)}  Media={sum(conteos) / len(conteos):.1f}")
    print(f"Serie completa: {conteos}")


def paso3_frames_anotados(modelo) -> None:
    """
    Guarda ~8 frames con bounding boxes dibujados (config de producción) para
    inspección visual manual: contar a ojo las ovejas reales vs. las que el
    modelo marcó, y así confirmar o descartar el techo de recall del modelo.
    """
    print(f"\n=== Paso 3: frames anotados para inspección visual (guardando en {SALIDA}) ===")
    SALIDA.mkdir(parents=True, exist_ok=True)
    id_sheep = id_clase_sheep(modelo)

    cap = cv2.VideoCapture(str(VIDEO))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    indices = [int(total_frames * i / 8) for i in range(8)]

    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ok, frame = cap.read()
        if not ok:
            continue
        resultado = modelo.predict(
            frame, conf=0.5, classes=[id_sheep] if id_sheep is not None else None, verbose=False
        )[0]
        anotado = resultado.plot()
        destino = SALIDA / f"frame_{idx:06d}_conteo_{len(resultado.boxes)}.jpg"
        cv2.imwrite(str(destino), anotado)
        print(f"  {destino.name}")

    cap.release()
    print("Revisar a ojo cada imagen: contar ovejas reales visibles vs. las marcadas.")


def main() -> None:
    if not VIDEO.exists():
        sys.exit(f"No se encontró el video en {VIDEO}")

    modelo = cargar_modelo()
    print(f"Modelo cargado: {MODELO}")
    print(f"Clases del modelo: {len(modelo.names)}")

    paso1_matriz_confianza_clases(modelo)
    paso2_serie_temporal(modelo)
    paso3_frames_anotados(modelo)


if __name__ == "__main__":
    main()

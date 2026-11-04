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
  (d) el modelo no está ajustado a esta cámara/ángulo/resolución: puede
      tener techo de recall bajo incluso en la mejor configuración
      (con yolo26n.pt, preentrenado COCO, ese techo era evidente).

Uso:
    ia-engine/venv/Scripts/python.exe ia-engine/scripts/diagnostico_conteo.py
    # solo los frames anotados, más frames y comparando contra yolo26n:
    ia-engine/venv/Scripts/python.exe ia-engine/scripts/diagnostico_conteo.py \
        --solo-frames --frames 16 --comparar yolo26n.pt

Los frames anotados quedan en ia-engine/scripts/salida_diagnostico/ (se
vacía en cada corrida). Cada imagen lleva una cabecera con modelo, umbral y
conteo, y cada caja su confianza. Con --comparar, además se guarda en
comparacion/ cada frame con los dos modelos uno encima del otro.

Requiere el mismo video que usa camara_mock (videos/rebano.mp4 en la raíz
del repo) y los modelos en ia-engine/models/.
"""

from __future__ import annotations

import argparse
import shutil
import sys
from collections import Counter
from pathlib import Path

import cv2
import numpy as np

RAIZ_REPO = Path(__file__).resolve().parents[2]
VIDEO = RAIZ_REPO / "videos" / "rebano.mp4"
CARPETA_MODELOS = RAIZ_REPO / "ia-engine" / "models"
SALIDA = Path(__file__).resolve().parent / "salida_diagnostico"

FPS_PRODUCCION = 2
CLASE_OBJETIVO = "sheep"
# Igual que CONFIANZA_MINIMA en docker-compose.yml.
CONFIANZA_PRODUCCION = 0.35


def cargar_modelo(nombre: str):
    from ultralytics import YOLO

    ruta = Path(nombre)
    if not ruta.is_absolute() and not ruta.exists():
        ruta = CARPETA_MODELOS / nombre
    if not ruta.exists():
        sys.exit(f"No se encontró el modelo en {ruta}")
    modelo = YOLO(str(ruta))
    modelo.nombre_archivo = ruta.name
    return modelo


def id_clase_sheep(modelo) -> int | None:
    for i, nombre in modelo.names.items():
        if str(nombre).lower() == CLASE_OBJETIVO:
            return i
    return None


def predecir(modelo, frame, conf: float):
    """Inferencia con la misma config que producción: solo la clase sheep."""
    id_sheep = id_clase_sheep(modelo)
    clases = [id_sheep] if id_sheep is not None else None
    return modelo.predict(frame, conf=conf, classes=clases, verbose=False)[0]


def paso1_matriz_confianza_clases(modelo, conf: float) -> None:
    """
    Corre varias combinaciones (confianza x con/sin filtro de clase) sobre
    frames muestreados del video y compara cuántas detecciones de CADA clase
    aparecen. Si "sin filtro" trae muchas clases no-sheep, la prueba manual
    del usuario (que no filtró clases) no es comparable 1:1 contra la config
    de producción.
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

    for c in sorted({0.5, conf, 0.25}, reverse=True):
        for filtrar in (True, False):
            contador_por_clase: Counter[str] = Counter()
            for idx in indices:
                cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
                ok, frame = cap.read()
                if not ok:
                    continue
                clases = [id_sheep] if filtrar else None
                resultado = modelo.predict(frame, conf=c, classes=clases, verbose=False)[0]
                for cls_id in resultado.boxes.cls.tolist():
                    contador_por_clase[modelo.names[int(cls_id)]] += 1

            etiqueta = f"conf={c} filtro_sheep={'si' if filtrar else 'no'}"
            total = sum(contador_por_clase.values())
            desglose = ", ".join(f"{k}={v}" for k, v in contador_por_clase.most_common())
            print(f"{etiqueta:35s} total={total:4d}  [{desglose}]")

    cap.release()


def paso2_serie_temporal(modelo, conf: float) -> None:
    """
    Reproduce la config de producción (solo sheep, 2 FPS) sobre el video
    ENTERO y registra el conteo crudo de cada frame procesado (antes de
    tracking). Si la serie oscila mucho, confirma que un snapshot de un solo
    frame (el bug ya corregido) explicaba buena parte del problema. Si queda
    plana en un número bajo, el techo está en el modelo, no en el snapshot.
    """
    print(f"\n=== Paso 2: serie temporal con config de producción (conf={conf}, sheep, 2 FPS) ===")
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
            conteos.append(len(predecir(modelo, frame, conf).boxes))
        idx += 1
    cap.release()

    if not conteos:
        print("No se procesó ningún frame — revisar la ruta del video.")
        return

    print(f"Frames procesados: {len(conteos)}")
    print(f"Min={min(conteos)}  Max={max(conteos)}  Media={sum(conteos) / len(conteos):.1f}")
    print(f"Serie completa: {conteos}")


def anotar(modelo, frame, conf: float) -> tuple[np.ndarray, int]:
    """Dibuja cajas con su confianza y una cabecera con modelo, umbral y conteo."""
    resultado = predecir(modelo, frame, conf)
    n = len(resultado.boxes)
    # Cajas finas y etiqueta chica: con 20 ovejas juntas, las gruesas tapan
    # justo lo que se quiere revisar a ojo.
    imagen = resultado.plot(line_width=1, font_size=0.4, labels=True, conf=True)

    alto_cabecera = 34
    cabecera = np.zeros((alto_cabecera, imagen.shape[1], 3), dtype=np.uint8)
    texto = f"{modelo.nombre_archivo} | conf>={conf} | {n} ovejas"
    cv2.putText(cabecera, texto, (10, 23), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2, cv2.LINE_AA)
    return np.vstack([cabecera, imagen]), n


def paso3_frames_anotados(modelo, conf: float, cantidad: int, comparar=None) -> None:
    """
    Guarda frames repartidos en el video con las cajas dibujadas (config de
    producción) para inspección visual manual: contar a ojo las ovejas reales
    vs. las que el modelo marcó. Con `comparar`, guarda también cada frame
    con los dos modelos apilados para verlos contra el mismo cuadro.
    """
    print(f"\n=== Paso 3: frames anotados para inspección visual (guardando en {SALIDA}) ===")
    # Se vacía para no mezclar imágenes de corridas con otro modelo o umbral.
    shutil.rmtree(SALIDA, ignore_errors=True)
    SALIDA.mkdir(parents=True)
    if comparar is not None:
        (SALIDA / "comparacion").mkdir()

    cap = cv2.VideoCapture(str(VIDEO))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps_video = cap.get(cv2.CAP_PROP_FPS) or 25
    indices = [int(total_frames * i / cantidad) for i in range(cantidad)]

    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ok, frame = cap.read()
        if not ok:
            continue
        segundo = idx / fps_video
        base = f"frame_{idx:06d}_t{segundo:05.1f}s"

        imagen, n = anotar(modelo, frame, conf)
        cv2.imwrite(str(SALIDA / f"{base}_conteo_{n}.jpg"), imagen)
        linea = f"  {base}: {modelo.nombre_archivo}={n}"

        if comparar is not None:
            otra, n_otro = anotar(comparar, frame, conf)
            cv2.imwrite(str(SALIDA / "comparacion" / f"{base}.jpg"), np.vstack([imagen, otra]))
            linea += f"  {comparar.nombre_archivo}={n_otro}"
        print(linea)

    cap.release()
    print("Revisar a ojo cada imagen: contar ovejas reales visibles vs. las marcadas.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Diagnóstico del conteo de ovejas sobre videos/rebano.mp4.")
    parser.add_argument("--modelo", default="sheep_detection.pt", help="archivo en ia-engine/models/ o ruta")
    parser.add_argument("--conf", type=float, default=CONFIANZA_PRODUCCION, help="umbral de confianza")
    parser.add_argument("--frames", type=int, default=8, help="cantidad de frames anotados a guardar")
    parser.add_argument("--comparar", help="segundo modelo para guardar ambos sobre el mismo frame")
    parser.add_argument("--solo-frames", action="store_true", help="saltar los pasos 1 y 2")
    args = parser.parse_args()

    if not VIDEO.exists():
        sys.exit(f"No se encontró el video en {VIDEO}")

    modelo = cargar_modelo(args.modelo)
    print(f"Modelo cargado: {modelo.nombre_archivo} ({len(modelo.names)} clases)")
    comparar = cargar_modelo(args.comparar) if args.comparar else None

    if not args.solo_frames:
        paso1_matriz_confianza_clases(modelo, args.conf)
        paso2_serie_temporal(modelo, args.conf)
    paso3_frames_anotados(modelo, args.conf, args.frames, comparar)


if __name__ == "__main__":
    main()

"""
Corre el modelo sobre algunos frames de un video y guarda las imágenes con
las bounding boxes y el número de ovejas detectadas, para revisarlas a ojo.

Igual que diagnostico_conteo.py, no forma parte del paquete ia_engine ni corre
en producción. Por defecto toma 5 frames de videos/rebano_LQ.mp4, uno cada 2
segundos (0, 2, 4, 6 y 8 s), con sheep_detection.pt, y el umbral y las ventanas
de producción (--tile 0 analiza el frame completo).

Uso:
    ia-engine/venv/Scripts/python.exe ia-engine/scripts/detectar_frames_video.py
    # otro muestreo u otro video:
    ia-engine/venv/Scripts/python.exe ia-engine/scripts/detectar_frames_video.py \
        --frames 8 --intervalo 1 --video videos/rebano.mp4

Las imágenes quedan en ia-engine/scripts/salida_frames_video/ (se vacía en cada
corrida). Cada una lleva una cabecera con modelo, umbral y conteo, y el conteo
se repite en el nombre del archivo.
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

import cv2
from ultralytics import YOLO

RAIZ_REPO = Path(__file__).resolve().parents[2]
CONFIANZA_PRODUCCION = 0.35

VIDEO_POR_DEFECTO = RAIZ_REPO / "videos" / "rebano_LQ.mp4"
SALIDA = Path(__file__).resolve().parent / "salida_frames_video"
# Igual que TILE_INFERENCIA en docker-compose.yml.
TILE_PRODUCCION = 640


def cargar_modelo(nombre: str):
    ruta = Path(nombre)
    if not ruta.is_absolute() and not ruta.exists():
        ruta = RAIZ_REPO / "ia-engine" / "models" / nombre
    if not ruta.exists():
        sys.exit(f"No se encontró el modelo en {ruta}")
    modelo = YOLO(str(ruta))
    modelo.nombre_archivo = ruta.name
    return modelo


def anotar(modelo, frame, conf: float, tile: int | bool) -> tuple[object, int]:
    id_sheep = next(
        (i for i, nombre in modelo.names.items() if str(nombre).lower() == "sheep"),
        None,
    )
    clases = [id_sheep] if id_sheep is not None else None
    resultado = modelo.predict(
        frame,
        conf=conf,
        classes=clases,
        tile=tile,
        batch=8,
        verbose=False,
    )[0]
    cantidad = len(resultado.boxes)
    imagen = resultado.plot(line_width=1, font_size=0.4, labels=True, conf=True)
    cabecera = cv2.copyMakeBorder(imagen[:0], 34, 0, 0, 0, cv2.BORDER_CONSTANT, value=(0, 0, 0))
    cv2.putText(
        cabecera,
        f"{modelo.nombre_archivo} | conf>={conf} | tile={tile or 'no'} | {cantidad} ovejas",
        (10, 23),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.65,
        (255, 255, 255),
        2,
        cv2.LINE_AA,
    )
    return cv2.vconcat([cabecera, imagen]), cantidad


def indices_a_muestrear(cantidad: int, intervalo: float, fps: float, total_frames: int) -> list[int]:
    """
    Índices de un frame cada `intervalo` segundos, sin repetidos. El último se
    acota al final del video: en un clip de 8 s, el segundo 8 cae justo un
    frame después del último.
    """
    indices = [min(round(i * intervalo * fps), total_frames - 1) for i in range(cantidad)]
    return list(dict.fromkeys(indices))


def main() -> None:
    parser = argparse.ArgumentParser(description="Guarda frames de un video con las detecciones del modelo dibujadas.")
    parser.add_argument("--video", type=Path, default=VIDEO_POR_DEFECTO, help="ruta del video")
    parser.add_argument("--modelo", default="sheep_detection.pt", help="archivo en ia-engine/models/ o ruta")
    parser.add_argument("--conf", type=float, default=CONFIANZA_PRODUCCION, help="umbral de confianza")
    parser.add_argument("--frames", type=int, default=5, help="cantidad de frames a procesar")
    parser.add_argument("--intervalo", type=float, default=2.0, help="segundos entre frames")
    parser.add_argument("--tile", type=int, default=TILE_PRODUCCION, help="tamaño de ventana en px; 0 = frame completo")
    args = parser.parse_args()

    if not args.video.exists():
        sys.exit(f"No se encontró el video en {args.video}")

    cap = cv2.VideoCapture(str(args.video))
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if not cap.isOpened() or fps <= 0 or total_frames <= 0:
        sys.exit(f"No se pudo leer el video {args.video}")

    modelo = cargar_modelo(args.modelo)
    print(f"Modelo: {modelo.nombre_archivo} | conf>={args.conf} | tile={args.tile or 'no'}")
    print(f"Video: {args.video.name} | {total_frames / fps:.1f} s a {fps:.1f} FPS")

    # Se vacía para no mezclar imágenes de corridas con otro modelo o umbral.
    shutil.rmtree(SALIDA, ignore_errors=True)
    SALIDA.mkdir(parents=True)

    for idx in indices_a_muestrear(args.frames, args.intervalo, fps, total_frames):
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ok, frame = cap.read()
        if not ok:
            print(f"  frame {idx}: no se pudo leer, se omite")
            continue

        imagen, n = anotar(modelo, frame, args.conf, args.tile or False)
        nombre = f"frame_{idx:06d}_t{idx / fps:05.1f}s_conteo_{n}.jpg"
        cv2.imwrite(str(SALIDA / nombre), imagen)
        print(f"  {nombre}: {n} ovejas")

    cap.release()
    print(f"Imágenes guardadas en {SALIDA}")


if __name__ == "__main__":
    main()

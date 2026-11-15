# ──────────────────────────────────────────────────────────────────────────────
# Dockerfile del módulo ia-engine (CPU + ONNX Runtime)
#
# Instala PyTorch/Torchvision en su variante CPU antes de requirements.txt
# para evitar descargar los binarios CUDA (~2.5 GB), y usa ONNX Runtime para
# ejecutar la detección ovina en CPU.
# ──────────────────────────────────────────────────────────────────────────────

FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1

# Paquetes de sistema mínimos para OpenCV y decodificación RTSP
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalar PyTorch y Torchvision versión CPU explícitamente antes de requirements.txt
RUN pip install --no-cache-dir \
    torch torchvision \
    --index-url https://download.pytorch.org/whl/cpu

# Instalar dependencias Python (cache de capas Docker)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código fuente y modelos
COPY ia_engine/ ./ia_engine/
COPY models/ ./models/

# Garantizar que el modelo ONNX exista si solo se copió el .pt
RUN if [ ! -f models/sheep_detection.onnx ] && [ -f models/sheep_detection.pt ]; then \
        python -c "from ultralytics import YOLO; YOLO('models/sheep_detection.pt').export(format='onnx', imgsz=640, simplify=True, dynamic=False, opset=12)"; \
    fi

# El módulo se ejecuta como paquete Python
CMD ["python", "-m", "ia_engine"]

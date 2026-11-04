# ──────────────────────────────────────────────────────────────────────────────
# Dockerfile del módulo ia-engine (GPU NVIDIA)
#
# Imagen base CUDA para aprovechar la GPU del host.
# En Windows con Docker Desktop + WSL2 el soporte GPU viene integrado;
# en Linux nativo se necesita nvidia-container-toolkit.
# ──────────────────────────────────────────────────────────────────────────────

FROM nvidia/cuda:12.6.3-runtime-ubuntu24.04

ENV DEBIAN_FRONTEND=noninteractive

# Paquetes de sistema necesarios para OpenCV y Python
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.12 \
    python3.12-venv \
    python3-pip \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalar dependencias Python primero (cache de capas Docker)
COPY requirements.txt .
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# Copiar código fuente y modelos
COPY ia_engine/ ./ia_engine/
# Los .pt viven en models/ (sheep_detection.pt y yolo26n.pt de respaldo).
# Si falta el de MODEL_PATH, ultralytics intenta descargarlo y en un predio
# sin internet el contenedor no arranca.
COPY models/ ./models/

# El módulo se ejecuta como paquete Python
CMD ["python3", "-m", "ia_engine"]

# Walkthrough — Módulo ia-engine

## Resumen

Se creó el módulo completo de visión por computadora **ia-engine** como servicio Docker integrado al stack de OviApp. El módulo consume streams RTSP de MediaMTX, detecta ovejas con YOLO, y envía alertas al backend Express.

## Archivos Creados

| Archivo | Propósito |
|---------|-----------|
| [`requirements.txt`](file:///c:/Users/Deus%20Eros/Documents/CODE/OviApp---PT/ia-engine/requirements.txt) | Dependencias Python (ultralytics, supervision, requests, pydantic-settings) |
| [`Dockerfile`](file:///c:/Users/Deus%20Eros/Documents/CODE/OviApp---PT/ia-engine/Dockerfile) | Imagen CUDA 12.6 + Python 3.12 para GPU NVIDIA |
| [`.dockerignore`](file:///c:/Users/Deus%20Eros/Documents/CODE/OviApp---PT/ia-engine/.dockerignore) | Exclusiones del contexto Docker |
| [`models/.gitkeep`](file:///c:/Users/Deus%20Eros/Documents/CODE/OviApp---PT/ia-engine/models/.gitkeep) | Directorio para el modelo YOLO `.pt` |
| [`ia_engine/__init__.py`](file:///c:/Users/Deus%20Eros/Documents/CODE/OviApp---PT/ia-engine/ia_engine/__init__.py) | Package init |
| [`ia_engine/config.py`](file:///c:/Users/Deus%20Eros/Documents/CODE/OviApp---PT/ia-engine/ia_engine/config.py) | Configuración desde variables de entorno |
| [`ia_engine/cliente_api.py`](file:///c:/Users/Deus%20Eros/Documents/CODE/OviApp---PT/ia-engine/ia_engine/cliente_api.py) | Cliente HTTP con reintentos y cola de alertas |
| [`ia_engine/detector.py`](file:///c:/Users/Deus%20Eros/Documents/CODE/OviApp---PT/ia-engine/ia_engine/detector.py) | YOLO + ByteTrack para conteo estable |
| [`ia_engine/analizador.py`](file:///c:/Users/Deus%20Eros/Documents/CODE/OviApp---PT/ia-engine/ia_engine/analizador.py) | Reglas de alerta (CONTEO, DISPERSION) con cooldown |
| [`ia_engine/lector_stream.py`](file:///c:/Users/Deus%20Eros/Documents/CODE/OviApp---PT/ia-engine/ia_engine/lector_stream.py) | Captura RTSP con descarte de frames y reconexión |
| [`ia_engine/__main__.py`](file:///c:/Users/Deus%20Eros/Documents/CODE/OviApp---PT/ia-engine/ia_engine/__main__.py) | Punto de entrada: orquesta todo |

## Archivo Modificado

| Archivo | Cambio |
|---------|--------|
| [`docker-compose.yml`](file:///c:/Users/Deus%20Eros/Documents/CODE/OviApp---PT/docker-compose.yml) | Nuevo servicio `ia-engine` con GPU NVIDIA |

## Flujo de Datos

```
Cámara/Mock → RTSP → MediaMTX → ia-engine (YOLO) → HTTP → Backend → Push → App
```

1. **LectorStream** abre el stream RTSP y descarta frames (30fps → 2fps efectivos).
2. **Detector** procesa cada frame con YOLO y ByteTrack para conteo estable.
3. **Analizador** evalúa reglas de alerta con cooldown anti-spam.
4. **ClienteAPI** envía alertas a `POST /api/v1/edge/alertas` y heartbeats periódicos.

## Cómo Ejecutar

### Prerequisitos
1. Copiar tu modelo `.pt` entrenado a `ia-engine/models/ovejas.pt`.
2. Asegurarte de que Docker Desktop esté corriendo.
3. El seed del backend ya crea el dispositivo edge con la API key configurada.

### Levantar todo
```bash
docker compose up --build
```

### Solo el ia-engine (si el resto ya está corriendo)
```bash
docker compose up --build ia-engine
```

## Alertas Implementadas

| Tipo | Lógica | Estado |
|------|--------|--------|
| **CONTEO** | Diferencia sostenida entre conteo detectado y esperado durante N frames consecutivos | ✅ Implementado |
| **DISPERSION** | Distancia promedio entre centroides supera umbral normalizado | ✅ Implementado |
| **AMENAZA** | Detección de clase distinta a "oveja" (depredadores, intrusos) | 🔲 Stub (requiere modelo multi-clase) |

## Próximos Pasos

1. **Colocar el modelo `.pt`** en `ia-engine/models/`.
2. **Encender Docker Desktop** y probar con `docker compose up --build`.
3. Verificar heartbeats y alertas en los logs y en la API del backend.
4. Cuando tengas un modelo multi-clase, activar la detección de amenazas en `analizador.py`.

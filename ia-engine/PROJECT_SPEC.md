# Especificación del Proyecto - Módulo de Inteligencia Artificial (Edge Computing)

## 1. Descripción General
El módulo de IA es responsable del procesamiento de video en tiempo real en el predio para monitorear el rebaño ovino. Identifica anomalías y contabiliza animales, enviando alertas al backend. 

## 2. Tecnologías y Hardware
- **Hardware:** Raspberry Pi 4 (8GB RAM), Cámaras IP (RTSP, visión nocturna IR, IP67).
- **Lenguaje:** Python
- **Modelo de Visión:** YOLOv26-nano (optimizado para edge computing).

## 3. Funcionalidades y Detecciones
1. **Conteo de Ovejas:** Monitoreo continuo de la cantidad de animales en cámara.
2. **Detección de Dispersión Anormal:** Identificación de comportamientos inusuales en el rebaño que sugieran pánico o ataques.
3. **Detección de Intrusos/Depredadores:** Detección de entidades no deseadas en el perímetro.
4. **Envío de Alertas:** Comunicación con el Backend (`POST /api/alertas`) enviando el tipo de alerta, timestamp, y conteo de animales.

## 4. Requerimientos No Funcionales
- **Procesamiento Local:** Todo el análisis de imágenes se realiza localmente (Edge) sin enviar video a la nube, reduciendo la dependencia de internet.
- **Tolerancia a Fallos de Red:** Debe poder almacenar alertas temporalmente o manejar cortes de red hacia el backend.
- **Rendimiento Edge:** Procesar señales RTSP con latencia mínima.

# streaming/

Carpeta que centraliza todo lo relacionado con la transmisión de video en OviApp.

## Estructura

```
streaming/
├── mediamtx.yml          # Configuración del servidor de streaming MediaMTX
├── viewer/
│   ├── index.html        # Página web para ver la transmisión en el navegador
│   ├── player.js         # Carga el stream HLS con hls.js
│   └── style.css
└── README.md             # Este archivo
```

La cámara simulada no vive aquí: es el servicio `camara_mock` del
`docker-compose.yml`, que publica `videos/rebano.mp4` en loop por RTSP.

## Cómo ver la transmisión

Una vez que los contenedores estén corriendo (`docker compose up -d`):

| Método | URL / Comando |
|--------|---------------|
| **Navegador (HLS)** | Abrir `streaming/viewer/index.html` con Live Server o similar |
| **VLC / ffplay** | `rtsp://localhost:8554/rebano` |

WebRTC está **deshabilitado** (`webrtc: no` en `mediamtx.yml`) y el puerto 8889
no se publica en el compose. Se desactivó porque la negociación ICE falla en
redes con NAT asimétrico; HLS, que es HTTP puro, no tiene ese problema.

## mediamtx.yml

Configura el servidor MediaMTX. Actualmente define:
- HLS habilitado en el puerto `8888`
- WebRTC deshabilitado
- Un path estático llamado `rebano` que espera que FFmpeg publique en él

> **Nota de seguridad:** el puerto `8888` se publica sin autenticación, así que
> cualquiera con acceso a la red puede ver el stream. Antes de un despliegue
> real conviene el proxy HLS con JWT que propone
> `docs/analisis-mediamtx-comparativo.md`.


## viewer/index.html

Reproductor HLS personalizable. Consume el stream desde:
`http://localhost:8888/rebano/index.m3u8`

Para personalizarlo edita directamente el HTML/CSS del archivo.

# streaming/

Carpeta que centraliza todo lo relacionado con la transmisión de video en OviApp.

## Estructura

```
streaming/
├── mediamtx.yml          # Configuración del servidor de streaming MediaMTX
├── viewer/
│   └── index.html        # Página web para ver la transmisión en el navegador
├── scripts/
│   └── camara-mock.sh    # Script que simula una cámara RTSP publicando un video en loop
└── README.md             # Este archivo
```

## Cómo ver la transmisión

Una vez que los contenedores estén corriendo (`docker compose up -d`):

| Método | URL / Comando |
|--------|---------------|
| **Navegador (HLS)** | Abrir `streaming/viewer/index.html` con Live Server o similar |
| **WebRTC** | `http://localhost:8889/rebano` (reproductor integrado de MediaMTX) |
| **VLC / ffplay** | `rtsp://localhost:8554/rebano` |

## mediamtx.yml

Configura el servidor MediaMTX. Actualmente define:
- HLS habilitado en el puerto `8888`
- WebRTC habilitado en el puerto `8889`
- Un path estático llamado `rebano` que espera que FFmpeg publique en él


## viewer/index.html

Reproductor HLS personalizable. Consume el stream desde:
`http://localhost:8888/rebano/index.m3u8`

Para personalizarlo edita directamente el HTML/CSS del archivo.

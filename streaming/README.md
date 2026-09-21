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

**Desde la app (forma normal):** pantalla Vigilancia → «Ver en vivo». La app pide
un token de corta duración al backend y reproduce el HLS a través del proxy
autenticado `/api/v1/streaming`. Es la única vía de acceso al video para un
usuario, y exige sesión iniciada.

**Para depurar (VLC, ffplay, el visor de `viewer/`):** los puertos de MediaMTX ya
no se publican al host (ver más abajo), así que hay que reabrirlos localmente
creando un `docker-compose.override.yml` en la raíz del repo. Docker Compose lo
mezcla solo, sin tocar el archivo versionado, y conviene dejarlo fuera de git:

```yaml
# docker-compose.override.yml — SOLO para desarrollo local
services:
  mediamtx:
    ports:
      - "8554:8554"   # RTSP  -> rtsp://localhost:8554/rebano
      - "8888:8888"   # HLS   -> http://localhost:8888/rebano/index.m3u8
```

WebRTC está **deshabilitado** (`webrtc: no` en `mediamtx.yml`) y el puerto 8889
no se publica en el compose. Se desactivó porque la negociación ICE falla en
redes con NAT asimétrico; HLS, que es HTTP puro, no tiene ese problema.

## mediamtx.yml

Configura el servidor MediaMTX. Actualmente define:
- HLS habilitado en el puerto `8888`
- WebRTC deshabilitado
- Un path estático llamado `rebano` que espera que FFmpeg publique en él

> **Seguridad:** MediaMTX no tiene autenticación propia, así que sus puertos ya
> **no se publican al host** en `docker-compose.yml`. Solo lo alcanzan los otros
> contenedores por la red interna (`mediamtx:8888`), y el único camino al video
> desde afuera es el proxy autenticado del backend
> (`backend/src/modules/streaming/`), que exige un token de corta duración
> emitido para un usuario con sesión iniciada del predio dueño de la cámara.
> Es el patrón que proponía `docs/analisis-mediamtx-comparativo.md`.
>
> Queda un riesgo residual conocido: dentro de la LAN el token viaja en texto
> plano como query string. Si la red del predio deja de ser de confianza, el
> siguiente paso es HTTPS interno con certificado propio.


## viewer/index.html

Reproductor HLS personalizable. Consume el stream desde:
`http://localhost:8888/rebano/index.m3u8`

Para personalizarlo edita directamente el HTML/CSS del archivo.

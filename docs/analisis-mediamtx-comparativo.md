# Análisis Comparativo: MediaMTX en OviApp vs. camera-relay-mediamtx-ubb

> **Repositorio analizado:** https://github.com/Marco-0107/camera-relay-mediamtx-ubb
> **Fecha de análisis:** 2026-09-05

---

## 1. Resumen Ejecutivo

| | **OviApp (tu proyecto)** | **camera-relay-ubb** |
|---|---|---|
| **Propósito** | App de gestión ganadera ovina; el stream es para monitoreo del rebaño | Sistema dedicado 100% a retransmitir cámaras RTSP de forma segura |
| **Fuente de video** | FFmpeg mockeando una cámara con un `.mp4` en loop | Cámaras RTSP reales registradas dinámicamente vía API |
| **Protocolos activos** | HLS + WebRTC (ambos expuestos al exterior) | Solo HLS expuesto; WebRTC deshabilitado en producción |
| **Control de MediaMTX** | Ninguno — `mediamtx.yml` es estático | API REST (puerto 9997) — se agregan/eliminan cámaras en caliente |
| **Persistencia de datos** | PostgreSQL + Prisma ORM | Archivos JSON en disco (`cameras.json`, `areas.json`) |
| **Frontend** | App móvil (Flutter) | React (Vite) con panel web completo |
| **Backend** | TypeScript + Prisma + JWT (sistema completo) | JavaScript puro (Express sin DB) |
| **Integración con streaming** | No existe — el backend no habla con MediaMTX | Profunda — el backend gestiona el ciclo de vida completo de los streams |

---

## 2. Arquitectura General

### 2.1 Tu proyecto (OviApp)

```
┌──────────────────────────────────────────────────────────────┐
│  Docker Compose                                              │
│                                                              │
│  ┌─────────────┐   RTSP push   ┌────────────────────────┐   │
│  │ camara_mock │──────────────►│       mediamtx         │   │
│  │ (FFmpeg)    │               │  (HLS :8888)            │   │
│  └─────────────┘               │  (WebRTC :8889)         │   │
│                                │  (RTSP :8554)           │   │
│  ┌─────────────┐               └────────────┬───────────┘   │
│  │   backend   │  (NO se comunica)           │               │
│  │ (TS+Prisma) │                             │               │
│  └─────────────┘               ┌────────────▼───────────┐   │
│                                │  Navegador/VLC/Flutter  │   │
│  ┌─────────────┐               │  accede directamente    │   │
│  │  PostgreSQL │               │  al puerto de MediaMTX  │   │
│  └─────────────┘               └─────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

**Flujo:** FFmpeg → (RTSP) → MediaMTX → (HLS/WebRTC) → Cliente.
El backend de OviApp **nunca toca** MediaMTX.

### 2.2 camera-relay-ubb

```
┌──────────────────────────────────────────────────────────────┐
│  Docker Compose                                              │
│                                                              │
│  ┌─────────────┐   RTSP pull  ┌────────────────────────┐   │
│  │  Cámara IP  │◄─────────────│       mediamtx         │   │
│  │  (real)     │              │  (HLS :8888) INTERNO    │   │
│  └─────────────┘              │  (RTSP :8554)           │   │
│                               │  (API :9997) INTERNO    │   │
│                               └────────────┬───────────┘   │
│  ┌─────────────────────────┐               │ proxy HLS      │
│  │        backend          │◄──────────────┘               │
│  │  - Gestiona cámaras     │  Control API (add/del paths)   │
│  │  - Proxy HLS            │                               │
│  │  - Sirve el frontend    │                               │
│  └────────────┬────────────┘                               │
│               │ :3000                                       │
│  ┌────────────▼───────────┐                               │
│  │  Navegador (React app) │                               │
│  │  todo pasa por :3000   │                               │
│  └─────────────────────────┘                               │
└──────────────────────────────────────────────────────────────┘
```

**Flujo:** El cliente habla SOLO con el backend (`:3000`). El backend actúa
como intermediario: registra cámaras en MediaMTX vía su API y hace de proxy
para el video HLS. MediaMTX nunca queda expuesto directamente al navegador.

---

## 3. Análisis Detallado: `mediamtx.yml`

### Tu archivo (9 líneas)

```yaml
hls: yes
webrtc: yes
webrtcICEHostNAT1To1IPs: [127.0.0.1]

paths:
  rebano:
    source: publisher   # espera que alguien publique en este path
    record: no
```

- **Path definido de forma estática** en el archivo. Hay un único stream llamado `rebano`.
- El `source: publisher` significa que MediaMTX espera que una fuente externa (FFmpeg) le envíe el video por RTSP push.
- `webrtcICEHostNAT1To1IPs: [127.0.0.1]` apunta a localhost, lo que **rompe el acceso desde otras máquinas en producción**.

### Archivo de camera-relay-ubb (comentado línea a línea)

```yaml
logLevel: info

api: yes                      # LA CLAVE DIFERENCIADORA
apiAddress: :9997             # Habilita la Control API HTTP de MediaMTX
                              # El backend la usa para add/delete paths en caliente

authInternalUsers:
  - user: any                 # Permite que cualquiera publique y lea
    pass:                     # Sin contraseña (se confía en la red Docker)
    permissions:
      - action: api           # Puede llamar a la API de control
      - action: publish       # Puede enviar video
      - action: read          # Puede recibir video
      - action: playback      # Puede acceder a grabaciones

rtsp: yes
rtspTransports: [tcp]         # Solo TCP (más estable a través de NAT/firewalls)
rtspAddress: :8554

webrtc: no                    # WebRTC DESHABILITADO
                              # Razón: en la red universitaria el NAT impide
                              # la negociación ICE cuando los puertos externos
                              # e internos difieren. Se usa HLS en su lugar.

hls: yes
hlsAddress: :8888             # INTERNO, no se expone en docker-compose
hlsAlwaysRemux: yes           # Genera HLS aunque nadie esté viendo
hlsVariant: lowLatency        # LL-HLS: menor latencia (~2-3s vs ~10s normal)
hlsSegmentCount: 7            # Número de segmentos en el playlist
hlsSegmentDuration: 1s        # Segmentos de 1 segundo
hlsPartDuration: 200ms        # Partes de 200ms (para LL-HLS)

paths: {}                     # SIN paths predefinidos — se crean vía API REST
```

### Tabla de diferencias

| Parámetro | OviApp | camera-relay-ubb | Por qué importa |
|---|---|---|---|
| `api` | No definido (desactivado) | `yes` (`:9997`) | Sin API no se pueden gestionar streams desde código |
| `authInternalUsers` | No definido | Definido | Controla quién puede publicar/leer |
| `webrtc` | `yes` | `no` | UBB lo desactiva por problemas de NAT universitario |
| `hlsVariant` | No definido (standard) | `lowLatency` | LL-HLS reduce latencia de ~10s a ~2-3s |
| `hlsAlwaysRemux` | No definido | `yes` | Sin esto, HLS no genera segmentos si nadie está mirando |
| `paths` | Estático (`rebano`) | `{}` vacío | UBB crea paths dinámicamente via API |

---

## 4. Análisis Detallado: `docker-compose.yml`

### Tu archivo

```yaml
mediamtx:
  ports:
    - "8554:8554"       # RTSP público
    - "8888:8888"       # HLS público — EXPUESTO al exterior sin control
    - "8889:8889"       # WebRTC público
    - "8189:8189/udp"   # ICE/UDP

camara_mock:            # contenedor extra que simula la cámara
  image: linuxserver/ffmpeg:latest
  volumes:
    - ./videos:/videos
  entrypoint: >
    ffmpeg -re -stream_loop -1 -i /videos/rebano.mp4 -c copy -f rtsp rtsp://mediamtx:8554/rebano
```

**ADVERTENCIA:** El puerto `:8888` (HLS) y `:8889` (WebRTC) quedan expuestos directamente.
Cualquiera que conozca la IP del servidor puede ver el video sin autenticación.

### camera-relay-ubb

```yaml
mediamtx:
  ports:
    - "8554:8554"       # RTSP (opcional para debug con VLC)
    - "8889:8889"       # WebRTC/WHEP
    - "8189:8189/udp"   # ICE
    # Puerto 8888 (HLS) NO está aquí — solo accesible internamente
    # Puerto 9997 (API) NO está expuesto — solo el backend lo usa

backend:
  environment:
    - MEDIAMTX_API_URL=http://mediamtx:9997          # interno
    - MEDIAMTX_WEBRTC_PUBLIC_URL=http://${SERVER_HOST}:8889
    - MEDIAMTX_RTSP_PUBLIC_URL=rtsp://${SERVER_HOST}:8554
    - FRONTEND_DIR=/app/frontend
  volumes:
    - ./backend/data:/app/data          # Persistencia de JSON
    - ./frontend/dist:/app/frontend:ro  # Build del frontend embebido
```

---

## 5. La Clave Diferenciadora: La Control API de MediaMTX

Esta es la diferencia arquitectónica más importante. El repo de la UBB usa la
API REST que MediaMTX expone en el puerto `9997` para gestionar streams en tiempo
real desde el código, **sin tocar el archivo `mediamtx.yml`**.

### ¿Qué puede hacer esta API?

El cliente `mediamtxClient.js` implementa 4 operaciones clave:

```javascript
// Agregar un nuevo path (nueva cámara)
POST /v3/config/paths/add/{nombre}
Body: { source: "rtsp://usuario:pass@192.168.1.50:554/stream", sourceOnDemand: false }

// Eliminar un path (quitar cámara)
DELETE /v3/config/paths/delete/{nombre}

// Consultar el estado de un path (esta activo el stream?)
GET /v3/paths/get/{nombre}
// Retorna: { name, state, tracks, readers, ... }

// Listar todos los paths activos
GET /v3/paths/list
```

### Flujo completo cuando un usuario agrega una cámara

```
Usuario llena el formulario web (nombre, URL RTSP, usuario, contraseña)
    │
    ▼
Frontend → POST /api/cameras → Backend (camerasService.js)
    │
    ├─ Valida y genera un "pathName" único (ej: "entrada-principal")
    │
    ├─ Llama a MediaMTX Control API:
    │   POST /v3/config/paths/add/entrada-principal
    │   { source: "rtsp://admin:pass@192.168.1.50:554/stream" }
    │
    ├─ MediaMTX comienza a hacer RTSP PULL de la cámara real
    │
    └─ Guarda en cameras.json:
        { id, name, pathName, source (URL real), maskedUrl, createdAt }
    │
    ▼
Usuario ve el stream en vivo en el frontend vía:
  HLS:  GET /hls/entrada-principal/index.m3u8  (proxied por el backend)
  RTSP: rtsp://SERVER_IP:8554/entrada-principal
```

### Resincronización al reiniciar

MediaMTX almacena los paths agregados por API **solo en memoria**. Si el contenedor
reinicia, los paths se pierden. El backend soluciona esto al arrancar:

```javascript
// server.js — se ejecuta al arrancar el proceso
await resyncWithMediamtx();

// camerasService.js
async function resyncWithMediamtx({ retries = 10, delayMs = 1500 }) {
  const cameras = await store.getCameras(); // Lee cameras.json

  // Espera a que MediaMTX este listo (puede tardar en arrancar)
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mediamtx.listPaths(); // prueba conectividad
      break;
    } catch {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  // Re-registra todas las camaras
  for (const camera of cameras) {
    await mediamtx.addPath(camera.pathName, {
      source: camera.source,
      sourceOnDemand: camera.sourceOnDemand,
    });
  }
}
```

---

## 6. Proxy HLS: Por Qué el Backend Actúa de Intermediario

Este patrón de seguridad **no existe** en OviApp.

### En OviApp
El navegador accede directamente a `http://localhost:8888/rebano/index.m3u8`.
El puerto HLS queda expuesto públicamente.

### En camera-relay-ubb
El puerto `8888` de MediaMTX no aparece en los `ports` del docker-compose.
El backend hace de proxy transparente:

```javascript
// server.js
app.get('/hls/*', async (req, res) => {
  const upstreamPath = req.path.replace(/^\/hls/, '');
  // Llama internamente a http://mediamtx:8888/...
  const upstream = await fetch(`${env.mediamtxHlsInternalUrl}${upstreamPath}`);
  if (!upstream.ok) { res.status(upstream.status).end(); return; }

  const ct = upstream.headers.get('content-type');
  if (ct) res.setHeader('Content-Type', ct);
  res.setHeader('Cache-Control', 'no-cache');
  res.send(Buffer.from(await upstream.arrayBuffer()));
});
```

**Ventajas del proxy:**
1. El frontend hace peticiones al mismo origen (`:3000`) — sin problemas de CORS.
2. Se puede agregar autenticación JWT fácilmente modificando solo el backend.
3. El servidor HLS interno nunca queda expuesto a internet.

---

## 7. Gestión de Áreas de Interés

Un concepto único del repo de la UBB que OviApp no tiene actualmente.

Las **áreas de interés** son rectángulos dibujados sobre el frame del video que
marcan zonas relevantes (ej: "Entrada", "Zona de peligro"). Se almacenan como
coordenadas normalizadas (valores 0-1) relativas al tamaño del video:

```javascript
// areasService.js
const area = {
  id: crypto.randomUUID(),
  label: "Entrada Principal",
  x: 0.1,        // 10% desde la izquierda del frame
  y: 0.2,        // 20% desde arriba
  width: 0.3,    // 30% del ancho total
  height: 0.4,   // 40% del alto total
};
```

Se guardan en `areas.json` indexadas por `cameraId`:

```json
{
  "uuid-camara-1": [
    { "id": "...", "label": "Entrada", "x": 0.1, "y": 0.2, "width": 0.3, "height": 0.4 }
  ]
}
```

El frontend las dibuja sobre el video usando un `<canvas>` superpuesto (`AreasCanvas.jsx`).

**Relevancia para OviApp:** Este concepto podría adaptarse como "zonas de monitoreo
del rebaño" — definir qué parte del campo/corral es cada zona y pasarle esas
coordenadas al servidor de IA (`ia-server`) para análisis focalizado.

---

## 8. Persistencia: PostgreSQL vs. JSON Files

| | OviApp | camera-relay-ubb |
|---|---|---|
| **Motor** | PostgreSQL 16 + Prisma ORM | Archivos JSON en disco |
| **Migraciones** | `prisma migrate deploy` (automático en arranque) | No aplica |
| **Transacciones** | Sí | No (riesgo de corrupción bajo carga concurrente) |
| **Escalabilidad** | Alta | Baja (un solo servidor) |
| **Complejidad de setup** | Mayor (requiere DB container) | Mínima |
| **Adecuado para** | Muchos usuarios, datos estructurados | Instalación simple en un servidor |

OviApp usa PostgreSQL, que es la elección correcta para un sistema multi-usuario
con datos de animales, eventos, bitácora, etc.

---

## 9. Protocolos de Reproducción de Video

### camera-relay-ubb: dos implementaciones en paralelo

#### 9.1 HLS via `useHls.js` (recomendado en producción)

```javascript
const url = `${hlsBaseUrl}/${pathName}/index.m3u8`;
// hlsBaseUrl viene de /api/config → es la URL del BACKEND, no de MediaMTX directo
const hls = new Hls({ lowLatencyMode: true, enableWorker: true });
hls.loadSource(url);
hls.attachMedia(videoRef.current);
hls.on(Hls.Events.MANIFEST_PARSED, () => videoRef.current?.play());
hls.on(Hls.Events.ERROR, (_event, data) => {
  if (data.fatal) setStatus('error'); // Manejo de errores explícito
});
```

#### 9.2 WebRTC/WHEP via `useWhep.js` (desactivado en producción por NAT)

WHEP = **WebRTC HTTP Egress Protocol** — estándar moderno (RFC) para consumir
streams WebRTC vía HTTP en lugar del proceso ICE tradicional.

```javascript
const res = await fetch(`${whepBaseUrl}/${pathName}/whep`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/sdp' },
  body: pc.localDescription.sdp,  // Offer SDP del cliente
});
const answerSdp = await res.text();
await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
// Video llega por WebRTC con latencia <500ms (mucho mejor que HLS)
```

**Por que lo desactivaron en producción:** En redes con NAT asimétrico (como las
universitarias), el intercambio ICE falla cuando el puerto externo es diferente
al interno. HLS (HTTP puro) no tiene este problema.

### OviApp: implementación simple actual

```html
<!-- index.html — acceso directo a MediaMTX sin proxy -->
<script>
  const streamUrl = "http://localhost:8888/rebano/index.m3u8";
  const hls = new Hls();
  hls.loadSource(streamUrl);
  hls.attachMedia(video);
</script>
```

---

## 10. Backend: Diferencias Tecnológicas

| | OviApp | camera-relay-ubb |
|---|---|---|
| **Lenguaje** | TypeScript | JavaScript (ESM) |
| **ORM / DB** | Prisma + PostgreSQL | Sin ORM, JSON en disco |
| **Auth** | JWT (access + refresh tokens) | **Sin autenticación** |
| **Módulos de dominio** | agenda, alertas, animales, auth, bitacora, eventos, notificaciones, tareas, usuarios | cameras, areas, config |
| **Integración MediaMTX** | **Ninguna** | `mediamtxClient.js` (CRUD completo via Control API) |
| **Manejo del streaming** | Solo el `index.html` estático | Backend completo (proxy HLS + Control API) |

---

## 11. Conclusión: Qué Puedes Adoptar de camera-relay-ubb en OviApp

### Lo que definitivamente vale la pena adoptar

**1. Activar la Control API de MediaMTX en `mediamtx.yml`:**

```yaml
api: yes
apiAddress: :9997
```

Esto te permite consultar el estado del stream desde tu backend.
`GET /v3/paths/get/rebano` responde con si está activo, cuántos lectores hay, etc.
Muy útil para las **alertas** de OviApp (saber si la cámara del rebaño está offline).

**2. Mejorar la configuración HLS para baja latencia:**

```yaml
hlsAlwaysRemux: yes       # Genera segmentos aunque nadie esté mirando
hlsVariant: lowLatency    # LL-HLS: reduce latencia de ~10s a ~2-3s
hlsSegmentCount: 7
hlsSegmentDuration: 1s
hlsPartDuration: 200ms
```

Beneficio inmediato sin ningún costo.

**3. Proxy HLS en el backend (cuando se vaya a producción):**

Patrón: el backend verifica el JWT del usuario, y solo entonces hace el proxy
hacia MediaMTX internamente. Las credenciales del ganadero protegen el acceso al video.

**4. Endpoint de estado del stream:**

```
GET /api/streaming/status
→ { activo: true, lectores: 3, pistas: ["video", "audio"] }
```

Que consulte `http://mediamtx:9997/v3/paths/get/rebano` internamente.
Útil para mostrar en la app móvil si la cámara del rebaño está en vivo o no.

### Lo que NO necesitas (diferencia de contexto)

| Característica | Por qué no aplica en OviApp |
|---|---|
| Gestión dinámica de cámaras | Tienes UNA sola cámara (el rebaño). No necesitas add/delete paths en caliente. |
| Áreas de interés (canvas) | El análisis visual es tarea del módulo `ia-server`, no del frontend. |
| Cambiar a JSON store | Ya tienes PostgreSQL, que es mejor para tu escala. |
| Eliminar autenticación | OviApp necesita mantener JWT para múltiples ganaderos. |
| Frontend React web | OviApp usa Flutter mobile como cliente principal. |

---

## 12. `mediamtx.yml` Mejorado para OviApp (Sugerencia)

```yaml
# mediamtx.yml — versión mejorada para OviApp
logLevel: info

# Habilita la Control API para consultar estado desde el backend
api: yes
apiAddress: :9997

# RTSP: recibe el stream de FFmpeg (camara_mock) o de la cámara real futura
rtsp: yes
rtspAddress: :8554

# HLS con baja latencia para el visualizador web y la app móvil
hls: yes
hlsAddress: :8888
hlsAlwaysRemux: yes        # Genera segmentos aunque nadie esté mirando
hlsVariant: lowLatency     # LL-HLS: ~2-3s de latencia (vs ~10s estándar)
hlsSegmentCount: 7
hlsSegmentDuration: 1s
hlsPartDuration: 200ms

# WebRTC: útil para vista previa de baja latencia
# En producción con NAT, puede fallar — usar HLS como fallback
webrtc: yes
webrtcICEHostNAT1To1IPs: [] # Vacío en local; poner IP pública en producción

paths:
  rebano:
    source: publisher       # FFmpeg o cámara real envía el video aquí
    record: no
```

---

*Documento generado mediante análisis del repositorio https://github.com/Marco-0107/camera-relay-mediamtx-ubb*
*El repositorio clonado puede eliminarse de `C:\Users\Deus Eros\Documents\CODE\_ref_camera-relay` una vez leído este documento.*

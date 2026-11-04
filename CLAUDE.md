# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

OviApp: gestión y monitoreo de ganadería ovina. Código, comentarios, commits y mensajes de error están en español; mantener ese idioma. Pensado para correr **en una LAN de un predio rural, sin depender de internet**.

## Arquitectura general

Monorepo con cuatro piezas que se hablan solo por HTTP/RTSP:

```
camara_mock (ffmpeg, loop de videos/rebano.mp4)
   └─RTSP─> mediamtx ─RTSP─> ia-engine (YOLO + ByteTrack) ─HTTP x-edge-key─> backend ─> Postgres
                └─HLS─> backend (proxy autenticado) ─HTTP─> app Flutter <─JWT─┘
```

- `backend/` — API Express 5 + TypeScript + Prisma 7 (adapter `pg`). Un módulo por carpeta en `src/modules/<x>/` con `*.rutas.ts` / `*.controlador.ts` / `*.servicio.ts` / `*.esquemas.ts` (Zod). Los controladores solo parsean y delegan; las reglas viven en el servicio. Se montan en `src/app.ts` bajo `/api/v1`.
- `ia-engine/` — worker Python sin servidor HTTP (`python -m ia_engine`). Lee RTSP, cuenta ovejas, emite alertas y heartbeats al backend.
- `mobile/` — Flutter (Riverpod, go_router, Dio). Target real: Android/iOS; también compila a web.
- `streaming/` — `mediamtx.yml` y un visor HLS estático de depuración. `camara_mock` vive solo en `docker-compose.yml`.

No hay broker, WebSocket ni push en tiempo real para datos: la app hace REST bajo demanda (pull-to-refresh).

## Comandos

Todo el stack (desde la raíz). En Windows, `levantar-oviapp.bat [seed] [sin-ia]` levanta Docker, contenedores, seed y la app en Edge.

```bash
docker compose up -d --build                 # db, db-test, backend, mediamtx, camara_mock
docker compose --profile ia up -d ia-engine  # el módulo de IA NO arranca por defecto (imagen CUDA + reserva de GPU NVIDIA)
```

Backend (`cd backend`):

```bash
npm run dev            # tsx watch
npm run typecheck      # tsc --noEmit
npm run lint
npm test               # vitest run, toda la suite
npx vitest run tests/streaming.test.ts        # un archivo
npx vitest run -t "nombre del test"           # un test
npm run db:seed        # dentro del contenedor: docker compose exec -T backend npx prisma db seed
npm run db:migrate     # prisma migrate dev
```

- Los tests **exigen `db-test` arriba** (`docker compose up -d db-test`, puerto 5434). `setupGlobal.ts` aplica las migraciones y se niega a correr si `DATABASE_URL` no contiene "test". Los archivos corren en serie (`fileParallelism: false`) porque comparten una base. El cliente HTTP de tests (`tests/apoyo/cliente.ts`) usa `fetch`, no supertest, a propósito.
- Cambiar código del backend requiere `docker compose up -d --build backend` para que el contenedor lo vea (incluye `prisma/seed.ts`).
- Seed: `manuel@oviapp.cl` (Productor), `rosa@oviapp.cl` (Trabajador), `carmen@oviapp.cl` (otro predio); contraseña `Ovi2026!`.

Mobile (`cd mobile`): `flutter pub get`, `flutter analyze`, `flutter test`, `flutter run -d chrome` (o `-d edge --web-port=5000`). Un aviso `use_null_aware_elements` en `ovi_widgets.dart` es preexistente.

ia-engine: no tiene tests. `ia-engine/venv/Scripts/python.exe ia-engine/scripts/diagnostico_conteo.py` corre el modelo sobre `videos/rebano.mp4` con matriz de confianza/clases, serie temporal y frames anotados (salida ignorada por git).

## Convenciones que cruzan módulos

- **Multi-predio (RNF_08):** `idPredio` sale siempre del JWT (`ctxDe(req)`) o de la API key del dispositivo (`edgeDe(req)`), nunca del cuerpo. Un recurso de otro predio responde 404 igual que uno inexistente. Cada servicio filtra por predio.
- **Dos identidades:** usuarios con JWT (`middleware/autenticar.ts`, `req.ctx`) y dispositivos edge con `x-edge-key` = `prefijo.secreto` (`autenticarEdge.ts`, `req.edge`). Rutas edge en `/api/v1/edge/*`.
- **Errores:** siempre `{ error: { codigo, mensaje, detalles? } }` vía clases de `shared/errores.ts` (agregar el código a `CodigoError`). Validación con `validarCuerpo/Params/Query` de `shared/validacion.ts`, dentro del controlador (en Express 5 `req.query` es de solo lectura).
- **Mobile:** ninguna feature crea su propio `Dio` ni captura `DioException`; todo pasa por `dioProvider` y extensiones de `core/red/api.dart`, y a la UI solo llega `ErrorApi`. Los estados de red se pintan con `OviAsync`. Features en `lib/features/<x>/{datos,pantallas,widgets}`; rutas nombradas en `core/router/rutas.dart`.
- **URL de la API en mobile** está fijada por build (`--dart-define=API_URL=...`; `10.0.2.2:3000` en Android, `localhost:3000` si no). No hay configuración en runtime.

## Vigilancia y video en vivo (lo que requiere leer varios archivos)

**"En línea" no es un healthcheck.** `estaEnLinea()` (`alertas.servicio.ts`) compara `ultimoHeartbeat` con `MINUTOS_EN_LINEA` (3). El ia-engine late cada `HEARTBEAT_INTERVALO_SEG` (60, en compose); si se cambia uno, ajustar el otro. Un apagado limpio del ia-engine (SIGTERM) llama a `POST /edge/desconexion`, que pone `ultimoHeartbeat = null` para caer a "Sin señal" al instante; un SIGKILL solo lo detecta el timeout. Ese flag mide la **IA**, no el video: la cámara puede emitir con el chip en "Sin señal", por eso "Ver en vivo" no depende de él.

**El conteo del heartbeat es el máximo de la ventana**, no el último frame (`EstadoStream.tomar_conteo_heartbeat` en `analizador.py`, consume y reinicia). Un frame suelto oscilaba entre 4 y 11 con el mismo video. `CONFIANZA_MINIMA=0.35` (0.5 descartaba casi la mitad). El modelo en uso es `sheep_detection.pt` (una sola clase): sobre `rebano.mp4` a 0.35 cuenta 17-22 por frame, contra 7-13 del `yolo26n.pt` de COCO, que se conserva como respaldo.

**Proxy de streaming (`backend/src/modules/streaming/`).** MediaMTX no tiene auth, así que en `docker-compose.yml` **no publica puertos**; solo el backend lo alcanza (`MEDIAMTX_URL_INTERNO`). Flujo: `POST /streaming/token` (JWT de sesión, valida que la cámara sea del predio) → URL con token propio de 10 min (`proposito: 'stream'`, no intercambiable con el access token) → el reproductor pide manifiesto y segmentos por `GET /streaming/:pathName/:archivo?token=`, que valida el token a mano. Va por query y no por header porque AVPlayer no reenvía headers a los segmentos HLS. Dos detalles que ya rompieron algo:
- `reescribirPlaylist` agrega `token=` a cada línea **y** a los `URI="..."` de etiquetas como `#EXT-X-MAP`.
- MediaMTX cuelga `session=` de las URIs que escribe; hay que devolvérselo o responde 404 (`consultaDeMediamtx` en el controlador).

Para depurar con VLC/ffplay hay que reabrir 8554/8888 con un `docker-compose.override.yml` local (ver `streaming/README.md`). La pantalla mobile renueva el token sola a los ~70% de su vida. El reproductor se elige por plataforma con export condicional (`widgets/reproductor_vivo.dart` → `_nativo` con `video_player`, `_web` con hls.js); `mobile/web/hls.min.js` está vendorizado a propósito porque no hay internet en el predio.

**Cámara única hardcodeada:** el stream se llama `rebano` en `mediamtx.yml`, en `RTSP_STREAMS` del compose y en `PATH_STREAM` de `streaming.servicio.ts`. Soportar más cámaras exige una columna en `dispositivo_edge`.

## Otras trampas

- Prisma 7: el cliente generado está en `backend/src/generated/`; la URL de conexión vive en `prisma.config.ts` y en el adapter (`src/config/prisma.ts`), no en `schema.prisma`.
- `RF_06`: las entradas de bitácora se escriben en la misma transacción que la mutación del animal (tipo `TX` en `shared/db.ts`); tablas con triggers append-only. `TRUNCATE` en los tests no los dispara.
- Los modelos viven en `ia-engine/models/` (`sheep_detection.pt` en uso, `yolo26n.pt` de respaldo) y `.gitignore` ignora `ia-engine/models/*.pt`: no están en git, hay que copiarlos a mano en cada máquina. El compose usa `MODEL_PATH=/app/models/sheep_detection.pt`.
- Documentación de fondo: `mobile/PROJECT_SPEC.md`, `backend/PROJECT_SPEC.md`, `ia-engine/PROJECT_SPEC.md`, `streaming/README.md`. Los códigos RF_xx/RNF_xx/IFx en los comentarios remiten a los requerimientos del informe en `docs/`.

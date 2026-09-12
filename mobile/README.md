# mobile — aplicación OviApp

Cliente Flutter de OviApp: monitoreo y gestión para la ganadería ovina artesanal.
Es la interfaz principal del sistema para el Productor y el Trabajador (Pastor).

## Estado actual

Las 18 pantallas del diseño están implementadas y la app compila sin errores.

| Módulo | Pantallas | RF |
|--------|-----------|-----|
| Autenticación | arranque, login | IF6-ENT |
| 1 · Ficha Animal | rebaño, ficha, formulario | RF_01–RF_04 |
| 2 · Bitácora | bitácora | RF_05, RF_06 |
| 3 · Organizador de eventos | detalle, formulario | RF_07–RF_10 |
| 4 · Planificación | tareas, detalle, formulario | RF_11–RF_14 |
| 5 · Pantalla de Inicio | inicio, calendario | RF_15, RF_16 |
| 6 · Vigilancia | vigilancia, detalle de alerta | RF_19 |
| 7 · Administración | más, usuarios, formulario | RF_20–RF_22 |

## Requisitos

- Flutter con Dart **>= 3.10** (ver `environment` en `pubspec.yaml`)
- El backend corriendo en `localhost:3000` — desde la raíz del repo:
  `docker compose up -d`, o `levantar-oviapp.bat` en Windows.

## Cómo ejecutar

```bash
flutter pub get

# Navegador (Microsoft Edge)
flutter run -d edge --web-port=5000

# Emulador Android — el target real del proyecto
flutter run
```

### URL de la API

`lib/core/red/cliente_api.dart` la resuelve sola: `10.0.2.2:3000` en el emulador
de Android y `localhost:3000` en el resto. Para apuntar a otro servidor:

```bash
flutter run --dart-define=API_URL=https://api.oviapp.cl/api/v1
```

### Credenciales de prueba

Las crea `backend/prisma/seed.ts` (`npm run db:seed`):

| Correo | Rol |
|--------|-----|
| `manuel@oviapp.cl` | Productor — acceso total |
| `rosa@oviapp.cl` | Trabajador |
| `carmen@oviapp.cl` | Productor de otro predio, para probar el aislamiento (RNF_08) |

Contraseña para todas: `Ovi2026!`

## Estructura

```
lib/
├── core/
│   ├── almacenamiento/   # sesión en almacenamiento seguro
│   ├── red/              # Dio, interceptores, ErrorApi, paginación
│   ├── router/           # rutas y shell de las 5 pestañas
│   ├── tema/             # colores y ThemeData
│   ├── widgets/          # OviTarjeta, OviChip, OviAsync, selectores…
│   └── formato.dart      # fechas, pesos y textos en español
└── features/
    └── <módulo>/
        ├── datos/        # modelos y repositorio
        └── pantallas/
```

Ninguna pantalla construye su propio `Dio` ni captura `DioException`: todo pasa
por `dioProvider` y lo que llega a la UI es siempre un `ErrorApi`.

## Comandos útiles

```bash
flutter analyze     # análisis estático
flutter test        # pruebas de widgets
```

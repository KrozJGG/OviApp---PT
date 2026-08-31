# OviApp — Plan de Desarrollo

> Aplicación Móvil de Monitoreo y Gestión para la Ganadería Ovina Artesanal
> Universidad del Bío-Bío · Proyecto de Título · Tomás Sáez, Christian Jamett
> Fuente: `docs/CABR_01_CINF_FINAL_AP_2026_1_JAMETTySAEZ.pdf`

Este documento es el plan de construcción del **producto de software** (app Flutter + backend
Node/Express + PostgreSQL). Cubre los 22 requerimientos funcionales (RF_01–RF_22), los 8 no
funcionales (RNF_01–RNF_08), las 6 interfaces de entrada y 4 de salida, el modelo de datos del
capítulo 6 y el estándar visual de los mockups (Figuras 6.5 y 6.6).

**Fuera de alcance de este plan (se aborda por separado):** el módulo de visión por computadora
(YOLO sobre Raspberry Pi), el entrenamiento del modelo y el agente IA. Este plan **sí** define el
*contrato de integración* con ese módulo (§7) y un **simulador** para poder desarrollar y probar
los RF_17–RF_19 sin depender del hardware.

---

## 1. Stack tecnológico fijado

| Capa | Tecnología | Notas |
|---|---|---|
| App móvil | **Flutter** (Dart) | Android 10+ / iOS 14+ (RNF_05) |
| Backend | **Node.js + Express + TypeScript** | API REST, JWT |
| Base de datos | **PostgreSQL 16** | Alojada en la nube (RNF_02) |
| ORM / migraciones | **Prisma** | Los `.sql` de `prisma migrate` alimentan el Apéndice D (diccionario de datos) |
| Validación | **Zod** | Un esquema por endpoint, reutilizado en tests |
| Push | **Firebase Cloud Messaging** | IF3-SAL / IF4-SAL (RF_18) |
| Contenedores | **Docker + docker-compose** | Postgres + API en local |
| Versionado | **Git / GitHub** | `main` protegida + ramas por incremento |

**Decisión sobre TypeScript:** la tesis dice "Node.js" sin especificar lenguaje. Se usa TypeScript
porque los tipos del dominio (roles, estados de animal, tipos de evento y de alerta) son exactamente
las reglas que los RF exigen validar; tenerlas en el compilador evita la mitad de los bugs de RBAC y
de máquina de estados. No contradice nada de lo declarado en el capítulo 2.

### Dependencias principales

**Backend** — `express`, `@prisma/client`, `zod`, `jsonwebtoken`, `bcrypt`, `helmet`, `cors`,
`pino` + `pino-http`, `node-cron`, `firebase-admin`, `dotenv`. Dev: `typescript`, `tsx`,
`vitest`, `supertest`, `eslint`, `prettier`.

**Flutter** — `flutter_riverpod` (estado), `go_router` (navegación), `dio` (HTTP + interceptor
JWT), `freezed` + `json_serializable` (modelos), `flutter_secure_storage` (tokens),
`table_calendar` (RF_16), `firebase_messaging` + `flutter_local_notifications` (RF_18),
`google_fonts` (Poppins/Inter), `intl` (formato es_CL), `cached_network_image`.
Dev: `build_runner`, `mocktail`, `integration_test`.

> Fijar versiones exactas en el primer commit de cada proyecto (`package.json` con `--save-exact`,
> `pubspec.yaml` sin `^`). Un proyecto de título se defiende un año después de escribirlo; las
> versiones flotantes rompen la reproducibilidad del build.

---

## 2. Hallazgos sobre el documento fuente

Antes de programar hay que resolver **13 inconsistencias** entre el capítulo 3 (RF), el capítulo 5
(casos de uso) y el capítulo 6 (MER). Ninguna es grave, pero cada una define una tabla o una regla
de negocio, así que conviene zanjarlas antes de la Fase 0. Se propone una resolución para cada una;
las marcadas 🔴 requieren tu confirmación porque implican corregir el documento de tesis.

| # | Hallazgo | Resolución propuesta |
|---|---|---|
| H1 | **RF_20, RF_21 y RF_22 (gestión de usuarios) están listados dentro del "Módulo 6: Vigilancia y detección"** (§3.4), pero corresponden a CU_01–CU_03 del *Módulo Gestión Administrativa* (Figura 5.1). | 🔴 Reagrupar como **Módulo 7 · Administración**. En el código quedan en `usuarios/`, no en `vigilancia/`. |
| H2 | **La bitácora tiene dos naturalezas contradictorias.** RF_05/RF_06 la describen como un log **automático y de solo lectura**; el MER solo define `Nota_bitacora(contenido, id_usuario)`, que es una **nota manual**. | 🔴 Unificar en `bitacora_entrada` con columna `tipo` (`ALTA` / `MODIFICACION` / `BAJA` / `EVENTO` / `NOTA`). Cubre ambas naturalezas y preserva el append-only que exige RF_06. |
| H3 | **No existe la entidad `Predio`** en el MER, pero RF_19 ("alertas del predio del usuario autenticado"), IF5-ENT e IF3-SAL usan `id_predio`, y RNF_07 exige incorporar nuevos predios sin cambios estructurales. | 🔴 Agregar `predio`. `usuario`, `animal`, `evento`, `tarea` y `alerta` cuelgan de él. Es la base del aislamiento multi-predio que pide RNF_08. |
| H4 | **Falta `Dispositivo_edge`** en el MER, pero IF5-ENT envía `id_dispositivo_edge` e IF2-SAL muestra `estado_edge`. | 🔴 Agregar `dispositivo_edge`, con API key propia por predio. |
| H5 | **No hay dónde guardar el token push.** RF_18 e IF3-SAL requieren notificar al dispositivo del usuario. | Agregar `dispositivo_usuario(token_push, plataforma)`. |
| H6 | **Canal de notificaciones contradictorio.** §6.1 dice "WebSocket por la red local del predio, sin dependencia de internet"; RF_18, IF3-SAL e IF4-SAL dicen **push FCM/APNs desde el backend en la nube**. | 🔴 **FCM como canal único.** Es lo que dicen los RF y las interfaces, y es lo único que funciona cuando el usuario **no** está en el predio — que es justamente el escenario que motiva la alerta. Corregir §6.1. |
| H7 | **Identificador del animal.** RF_01 lo define como el nº de oreja y RF_03 lo declara inmutable; el MER usa `ID_animal` como PK y no tiene columna `color`, que RF_01 sí pide. | PK técnica `id UUID` + `numero_oreja TEXT` con `UNIQUE(id_predio, numero_oreja)`, inmutable a nivel de servicio. Agregar `color`. |
| H8 | **Los campos del animal divergen** entre RF_01 (sexo, raza, color, peso, observaciones), el CU Registro Animal (agrega *especie* y *fecha_nacimiento*) y el MER. | Unión de los tres, **menos `especie`**: el Límite (a) del §3.1 restringe el sistema a ovinos, así que esa columna sería siempre `'ovino'`. |
| H9 | **RF_04 dice que solo el Productor da de baja un animal**; la Figura 5.2 muestra "Inhabilitar animal" también para el Trabajador. | Manda el RF: **solo Productor**. Corregir la Figura 5.2. |
| H10 | **`Tarea_animal` existe en el MER** pero ningún RF pide asociar animales a tareas (RF_11 solo pide usuarios responsables). | Crear la tabla (está en el MER) y exponer el selector de animales como **campo opcional** del formulario de tarea. |
| H11 | **`Alerta` no tiene FK a predio ni a dispositivo** en el MER, pero RF_19 exige filtrar por predio. | Agregar `id_predio` e `id_dispositivo_edge`. |
| H12 | **RNF_02 se rotula "Disponibilidad offline"** en la Tabla 3.3, pero su texto y el Límite (d) del §3.1 dicen que la app administrativa **requiere internet**; lo offline es solo el módulo edge. | La app es **online-first**. Se agrega caché de solo-lectura (últimas listas vistas) como mejora de UX, no como requisito. Renombrar RNF_02 a *"Operación edge autónoma / backend en la nube"*. |
| H13 | **No hay RF de inicio de sesión**, aunque IF6-ENT lo define y los 22 RF asumen un usuario autenticado. | Se implementa como base técnica de la Fase 1. Sugerido: agregar **RF_00 Autenticar usuario** a la tesis para cerrar la trazabilidad. |

**Además, conviene declarar explícitamente fuera de alcance en la tesis:** recuperación de
contraseña, registro público de cuentas (ya prohibido por el Límite (f)) y generación del FMA
(Límite (c)).

---

## 3. Alcance funcional consolidado

Los 22 RF reagrupados en los módulos que efectivamente se construyen (con H1 aplicado):

| Módulo | RF | Productor | Trabajador |
|---|---|---|---|
| **M1 · Ficha Animal** | RF_01 registrar · RF_02 consultar · RF_03 editar · RF_04 dar de baja | todos | RF_01, RF_02, RF_03 |
| **M2 · Bitácora Animal** | RF_05 consultar · RF_06 generación automática | lectura | lectura |
| **M3 · Organizador de Eventos** | RF_07 crear · RF_08 consultar · RF_09 editar · RF_10 eliminar | todos | RF_08 (solo lectura) |
| **M4 · Planificación de Actividades** | RF_11 crear · RF_12 editar · RF_13 completar · RF_14 eliminar | todos | todos |
| **M5 · Pantalla de Inicio** | RF_15 resumen del día · RF_16 calendario general | todos | todos |
| **M6 · Vigilancia y Detección** | RF_17 ingesta edge · RF_18 push · RF_19 historial | RF_19 | RF_19 |
| **M7 · Administración** *(H1)* | RF_20 crear usuario · RF_21 editar · RF_22 inhabilitar | todos | — |

### Reglas de negocio transversales

Salen directo de los RF y **cada una debe tener un test que la cubra**:

1. `numero_oreja` único por predio; el alta falla si ya existe. *(RF_01)*
2. `numero_oreja` es inmutable después del alta. *(RF_03)*
3. Solo se puede editar un animal **activo**. *(RF_03)*
4. Solo se puede dar de baja un animal **activo**; la baja lo excluye del conteo activo pero **jamás** borra su historial — trazabilidad SAG. *(RF_04)*
5. Un evento solo se registra si **todos** los animales seleccionados están activos. *(RF_07)*
6. El `tipo` de un evento **no se puede editar** una vez creado. *(RF_09)*
7. Eliminar un evento es **soft delete**: las entradas de bitácora ya generadas se conservan, marcadas como *"evento eliminado"*. *(RF_10)*
8. Las entradas de bitácora son **append-only**: no se modifican ni se eliminan. *(RF_06)*
9. Una tarea **completada** no se puede editar; completarla registra fecha y autor. *(RF_12, RF_13)*
10. Fecha límite de tarea y fecha de evento deben ser ≥ hoy al crearlos. *(IF4-ENT, CU Registrar Evento Calendarizado)*
11. El email de usuario es único; el alta falla si ya existe. *(RF_20)*
12. Solo se edita o inhabilita un usuario **habilitado**; inhabilitar revoca el acceso sin borrar su historial. *(RF_21, RF_22)*
13. Todo listado se filtra por el `id_predio` del token — un usuario nunca ve datos de otro predio. *(RF_19, RNF_08)*

---

## 4. Arquitectura y estructura del repositorio

```
OviApp - PT/
├── docs/                        # tesis PDF, este plan, diagramas exportados
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/          # SQL versionado → Apéndice D de la tesis
│   │   └── seed.ts              # predio demo + 47 animales + usuarios de prueba
│   ├── src/
│   │   ├── config/              # env (Zod), logger, prisma client
│   │   ├── middleware/          # auth JWT, RBAC, tenant, errores, rate-limit
│   │   ├── modules/
│   │   │   ├── auth/            # RF_00 (H13), IF6-ENT
│   │   │   ├── usuarios/        # RF_20–22  (M7)
│   │   │   ├── animales/        # RF_01–04  (M1)
│   │   │   ├── bitacora/        # RF_05–06  (M2)
│   │   │   ├── eventos/         # RF_07–10  (M3)
│   │   │   ├── tareas/          # RF_11–14  (M4)
│   │   │   ├── agenda/          # RF_15–16  (M5)
│   │   │   ├── alertas/         # RF_17–19  (M6)
│   │   │   └── notificaciones/  # FCM + cron recordatorios (IF3-SAL, IF4-SAL)
│   │   ├── shared/              # errores de dominio, paginación, tipos
│   │   ├── app.ts               # armado de Express
│   │   └── server.ts
│   ├── tests/                   # integración por módulo (supertest)
│   ├── docker-compose.yml
│   └── package.json
├── mobile/
│   ├── lib/
│   │   ├── core/
│   │   │   ├── theme/           # paleta §6.3.3, tipografía §6.3.4
│   │   │   ├── network/         # dio, interceptores, manejo de errores
│   │   │   ├── router/          # go_router + guards por rol
│   │   │   └── widgets/         # OviCard, OviStatTile, OviChipEstado, OviEmptyState
│   │   ├── features/
│   │   │   ├── auth/            # {data, domain, presentation}
│   │   │   ├── inicio/
│   │   │   ├── rebano/
│   │   │   ├── bitacora/
│   │   │   ├── calendario/
│   │   │   ├── eventos/
│   │   │   ├── tareas/
│   │   │   ├── vigilancia/
│   │   │   └── administracion/
│   │   └── main.dart
│   ├── test/                    # unit + widget
│   ├── integration_test/        # flujos E2E
│   └── pubspec.yaml
└── edge/                        # ⚠️ fuera de este plan — solo el contrato (§7)
```

### Capas del backend

`route` → `controller` (parseo + Zod) → `service` (reglas de negocio) → `repository` (Prisma).

Regla: **las reglas de negocio del §3 viven solo en `service`**. El controller no valida dominio y
el repository no decide nada. Así cada regla tiene un único lugar donde probarse y donde
justificarse en el informe.

### Capas de la app

Por feature: `data` (DTOs + datasource Dio) → `domain` (entidades + casos de uso) → `presentation`
(Riverpod notifiers + pantallas). El estado de red se modela con un `AsyncValue` por pantalla, de
modo que *cargando / vacío / error / con datos* sean siempre los cuatro estados renderizados —
importa porque RNF_04 exige que la app sea comprensible sin capacitación.

### Multi-tenant

El JWT lleva `{ sub, rol, idPredio }`. Un middleware `tenant` inyecta `req.ctx.idPredio` y **todo**
repositorio lo recibe como filtro obligatorio. Nunca se acepta `id_predio` desde el body del
cliente (salvo en la ingesta edge, que se autentica con la API key del dispositivo). Esto es lo que
implementa RNF_08 y el filtro exigido por RF_19.

---

## 5. Modelo de datos

Toma el MER del §6.2 y le aplica H2, H3, H4, H5, H7, H8, H10 y H11. Se muestra en SQL porque es lo
que hay que llevar al Apéndice D de la tesis; en el repo se declara en `schema.prisma` y se genera
con `prisma migrate`.

### Extensiones y tipos enumerados

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- email case-insensitive

CREATE TYPE rol_usuario    AS ENUM ('PRODUCTOR', 'TRABAJADOR');
CREATE TYPE estado_usuario AS ENUM ('HABILITADO', 'INHABILITADO');
CREATE TYPE sexo_animal    AS ENUM ('MACHO', 'HEMBRA');
CREATE TYPE estado_animal  AS ENUM ('ACTIVO', 'INACTIVO');
CREATE TYPE motivo_baja    AS ENUM ('VENTA', 'MUERTE', 'FAENA');
CREATE TYPE tipo_evento    AS ENUM ('ENCASTE', 'ESQUILA', 'ATENCION_SANITARIA', 'OTRO');
CREATE TYPE estado_evento  AS ENUM ('PROGRAMADO', 'REALIZADO', 'ELIMINADO');
CREATE TYPE estado_tarea   AS ENUM ('ACTIVA', 'COMPLETADA');
CREATE TYPE tipo_bitacora  AS ENUM ('ALTA', 'MODIFICACION', 'BAJA', 'EVENTO', 'NOTA');
CREATE TYPE tipo_alerta    AS ENUM ('CONTEO', 'DISPERSION', 'AMENAZA');
CREATE TYPE nivel_alerta   AS ENUM ('INFO', 'ADVERTENCIA', 'CRITICA');
CREATE TYPE estado_alerta  AS ENUM ('NUEVA', 'REVISADA');
```

### Tablas

```sql
-- H3 · raíz multi-tenant
CREATE TABLE predio (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL,
  ubicacion   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE usuario (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_predio      UUID NOT NULL REFERENCES predio(id),
  nombre         TEXT NOT NULL,
  rut            TEXT,
  telefono       TEXT,
  email          CITEXT NOT NULL UNIQUE,          -- RF_20: unicidad
  foto_url       TEXT,
  password_hash  TEXT NOT NULL,                   -- RNF_03: bcrypt/argon2
  rol            rol_usuario    NOT NULL DEFAULT 'TRABAJADOR',
  estado         estado_usuario NOT NULL DEFAULT 'HABILITADO',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- H5 · destino de las notificaciones push (IF3-SAL, IF4-SAL)
CREATE TABLE dispositivo_usuario (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario  UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  token_push  TEXT NOT NULL UNIQUE,
  plataforma  TEXT NOT NULL CHECK (plataforma IN ('ANDROID', 'IOS')),
  ultimo_uso  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE animal (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_predio        UUID NOT NULL REFERENCES predio(id),
  numero_oreja     TEXT NOT NULL,                 -- H7: identificador de negocio, inmutable
  id_registrador   UUID NOT NULL REFERENCES usuario(id),
  sexo             sexo_animal NOT NULL,
  raza             TEXT,
  color            TEXT,                          -- H8: pedido por RF_01, faltaba en el MER
  peso_kg          NUMERIC(6,2),
  fecha_nacimiento DATE,
  descripcion      TEXT,
  estado           estado_animal NOT NULL DEFAULT 'ACTIVO',
  motivo_baja      motivo_baja,                   -- RF_04
  fecha_baja       DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_animal_oreja UNIQUE (id_predio, numero_oreja),
  CONSTRAINT ck_animal_baja  CHECK (
    (estado = 'ACTIVO'   AND motivo_baja IS NULL     AND fecha_baja IS NULL) OR
    (estado = 'INACTIVO' AND motivo_baja IS NOT NULL AND fecha_baja IS NOT NULL)
  )
);

-- H2 · unifica el log automático de RF_06 con la nota manual del MER
CREATE TABLE bitacora_entrada (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_animal    UUID NOT NULL REFERENCES animal(id),
  id_usuario   UUID REFERENCES usuario(id),       -- NULL si la generó el sistema
  tipo         tipo_bitacora NOT NULL,
  titulo       TEXT NOT NULL,
  descripcion  TEXT,
  datos        JSONB,                             -- {campo, valor_anterior, valor_nuevo} en MODIFICACION
  id_evento    UUID,                              -- FK a evento, se agrega más abajo
  fecha_evento TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- RF_06 append-only: se revocan UPDATE y DELETE al rol de la aplicación
REVOKE UPDATE, DELETE ON bitacora_entrada FROM oviapp_app;

CREATE TABLE evento (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_predio   UUID NOT NULL REFERENCES predio(id),
  id_creador  UUID NOT NULL REFERENCES usuario(id),
  tipo        tipo_evento NOT NULL,               -- RF_09: inmutable
  descripcion TEXT,
  fecha_inicio TIMESTAMPTZ NOT NULL,
  estado      estado_evento NOT NULL DEFAULT 'PROGRAMADO',
  eliminado_en TIMESTAMPTZ,                       -- RF_10: soft delete
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- referencia diferida: bitacora_entrada se crea antes que evento
ALTER TABLE bitacora_entrada
  ADD CONSTRAINT fk_bitacora_evento FOREIGN KEY (id_evento) REFERENCES evento(id);

CREATE TABLE evento_animal (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_evento UUID NOT NULL REFERENCES evento(id) ON DELETE CASCADE,
  id_animal UUID NOT NULL REFERENCES animal(id),
  CONSTRAINT uq_evento_animal UNIQUE (id_evento, id_animal)
);

CREATE TABLE tarea (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_predio          UUID NOT NULL REFERENCES predio(id),
  id_creador         UUID NOT NULL REFERENCES usuario(id),
  titulo             TEXT NOT NULL,
  descripcion        TEXT,
  fecha_limite       DATE NOT NULL,
  estado             estado_tarea NOT NULL DEFAULT 'ACTIVA',
  completada_en      TIMESTAMPTZ,                 -- RF_13
  id_completada_por  UUID REFERENCES usuario(id), -- RF_13
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tarea_usuario (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_tarea   UUID NOT NULL REFERENCES tarea(id) ON DELETE CASCADE,
  id_usuario UUID NOT NULL REFERENCES usuario(id),
  CONSTRAINT uq_tarea_usuario UNIQUE (id_tarea, id_usuario)
);

-- H10 · está en el MER; la UI la expone como campo opcional
CREATE TABLE tarea_animal (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_tarea  UUID NOT NULL REFERENCES tarea(id) ON DELETE CASCADE,
  id_animal UUID NOT NULL REFERENCES animal(id),
  CONSTRAINT uq_tarea_animal UNIQUE (id_tarea, id_animal)
);

-- H4 · emisor de IF5-ENT, estado mostrado en IF2-SAL
CREATE TABLE dispositivo_edge (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_predio         UUID NOT NULL REFERENCES predio(id),
  nombre            TEXT NOT NULL,
  api_key_hash      TEXT NOT NULL,
  ultimo_heartbeat  TIMESTAMPTZ,
  conteo_esperado   INT,                          -- baseline del rebaño
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE alerta (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_predio           UUID NOT NULL REFERENCES predio(id),            -- H11
  id_dispositivo_edge UUID REFERENCES dispositivo_edge(id),           -- H11
  tipo_alerta         tipo_alerta  NOT NULL,
  descripcion         TEXT,
  nivel               nivel_alerta NOT NULL DEFAULT 'ADVERTENCIA',
  conteo_animales     INT,                        -- RF_17
  conteo_esperado     INT,
  fecha_hora          TIMESTAMPTZ NOT NULL,       -- timestamp emitido por el edge
  estado              estado_alerta NOT NULL DEFAULT 'NUEVA',
  id_revisado_por     UUID REFERENCES usuario(id),
  fecha_revision      TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- idempotencia de la ingesta edge: la conectividad rural obliga a reintentos (§7)
  CONSTRAINT uq_alerta_edge UNIQUE (id_dispositivo_edge, fecha_hora, tipo_alerta)
);
```

### Índices

```sql
CREATE INDEX ix_animal_predio_estado   ON animal(id_predio, estado);
CREATE INDEX ix_animal_oreja_busqueda  ON animal(id_predio, numero_oreja text_pattern_ops);
CREATE INDEX ix_bitacora_animal_fecha  ON bitacora_entrada(id_animal, fecha_evento DESC);
CREATE INDEX ix_evento_predio_fecha    ON evento(id_predio, fecha_inicio);
CREATE INDEX ix_tarea_predio_fecha     ON tarea(id_predio, fecha_limite);
CREATE INDEX ix_alerta_predio_fecha    ON alerta(id_predio, fecha_hora DESC);
```

> Con 10–100 animales y 3–5 usuarios concurrentes por predio (Restricción (e) del §3.2) el volumen
> es mínimo. Estos índices no son por rendimiento: existen porque las consultas de RF_16 y RF_19
> filtran por predio + rango de fechas, y son las únicas que crecen sin techo con el tiempo.

### Datos semilla

El seed debe reproducir el estado que muestran los mockups, para poder comparar la app contra la
Figura 6.5 durante el desarrollo: 1 predio, 1 Productor ("Manuel"), 2 Trabajadores, **47 animales
activos** + algunos inactivos, 3 tareas para hoy, 1 evento *Esquila Hato Norte* a las 09:00, y 3
alertas (dispersión, intruso, conteo normal).

---

## 6. Catálogo de la API REST

Base: `/api/v1`. Todo bajo HTTPS (RNF_03). Autenticación `Bearer <JWT>` salvo `login` y la ingesta
edge (API key). Cuerpos en JSON `camelCase`; la BD usa `snake_case` y Prisma hace el mapeo.

### Autenticación — IF6-ENT, H13

| Método | Ruta | Rol | Cubre |
|---|---|---|---|
| `POST` | `/auth/login` | público | IF6-ENT · emite access (15 min) + refresh (30 d) |
| `POST` | `/auth/refresh` | público + refresh token | — |
| `POST` | `/auth/logout` | autenticado | revoca refresh y borra token push |
| `GET` | `/auth/me` | autenticado | perfil + rol para los guards de la app |
| `POST` | `/dispositivos-push` | autenticado | registra token FCM (IF3-SAL, IF4-SAL) |

### M7 · Administración — RF_20, RF_21, RF_22

| Método | Ruta | Rol | Cubre |
|---|---|---|---|
| `POST` | `/usuarios` | Productor | **RF_20** · 409 si el email existe |
| `GET` | `/usuarios` | Productor | listado del predio |
| `GET` | `/usuarios/:id` | Productor | — |
| `PATCH` | `/usuarios/:id` | Productor | **RF_21** · 409 si está inhabilitado |
| `POST` | `/usuarios/:id/inhabilitar` | Productor | **RF_22** · 409 si ya está inhabilitado |

### M1 · Ficha Animal — RF_01 a RF_04

| Método | Ruta | Rol | Cubre |
|---|---|---|---|
| `POST` | `/animales` | Productor, Trabajador | **RF_01** · IF1-ENT · 409 si el nº de oreja existe · crea entrada `ALTA` en bitácora |
| `GET` | `/animales?estado=&q=&page=&size=` | ambos | lista del mockup 03 (chips Todos/Activos/Inactivos + búsqueda por nº de oreja) |
| `GET` | `/animales/:id` | ambos | **RF_02** · IF1-SAL · devuelve la ficha con o sin estado activo |
| `PATCH` | `/animales/:id` | ambos | **RF_03** · 409 si está inactivo · rechaza `numeroOreja` · crea entrada `MODIFICACION` con valor anterior y nuevo |
| `POST` | `/animales/:id/baja` | **solo Productor** | **RF_04** (H9) · body `{motivo, fecha}` · crea entrada `BAJA` |

### M2 · Bitácora — RF_05, RF_06

| Método | Ruta | Rol | Cubre |
|---|---|---|---|
| `GET` | `/animales/:id/bitacora?page=&size=` | ambos | **RF_05** · orden cronológico descendente |
| `POST` | `/animales/:id/bitacora` | ambos | nota manual (`Nota_bitacora` del MER, H2) |

> **RF_06 no tiene endpoint propio.** Es un efecto: cada servicio que muta un animal o lo asocia a
> un evento escribe la entrada **dentro de la misma transacción**. Si la bitácora falla, la
> operación completa se revierte — de otro modo se rompe la trazabilidad SAG que justifica RF_04.

### M3 · Organizador de Eventos — RF_07 a RF_10

| Método | Ruta | Rol | Cubre |
|---|---|---|---|
| `POST` | `/eventos` | **solo Productor** | **RF_07** · IF3-ENT · 422 si algún animal está inactivo · entrada `EVENTO` en cada bitácora |
| `GET` | `/eventos?desde=&hasta=&tipo=` | ambos | — |
| `GET` | `/eventos/:id` | ambos | **RF_08** · incluye animales y usuario que lo registró |
| `PATCH` | `/eventos/:id` | **solo Productor** | **RF_09** · rechaza cambio de `tipo` · reconcilia bitácoras de animales agregados/quitados |
| `DELETE` | `/eventos/:id` | **solo Productor** | **RF_10** · soft delete · marca las entradas de bitácora como *"evento eliminado"* |

### M4 · Planificación — RF_11 a RF_14

| Método | Ruta | Rol | Cubre |
|---|---|---|---|
| `POST` | `/tareas` | ambos | **RF_11** · IF4-ENT · `fechaLimite >= hoy` · responsables obligatorios |
| `GET` | `/tareas?estado=&desde=&hasta=` | ambos | — |
| `GET` | `/tareas/:id` | ambos | — |
| `PATCH` | `/tareas/:id` | ambos | **RF_12** · 409 si ya está completada |
| `POST` | `/tareas/:id/completar` | ambos | **RF_13** · registra fecha y autor · 409 si ya estaba completada |
| `DELETE` | `/tareas/:id` | ambos | **RF_14** · borrado definitivo (el RF dice "de forma permanente") |

### M5 · Inicio y Calendario — RF_15, RF_16

| Método | Ruta | Rol | Cubre |
|---|---|---|---|
| `GET` | `/inicio/resumen` | ambos | tarjetas del mockup 02: animales activos, tareas de hoy, alertas sin leer |
| `GET` | `/agenda/hoy` | ambos | **RF_15** · tareas con vencimiento hoy + eventos de hoy, en una lista tipada |
| `GET` | `/agenda?desde=&hasta=` | ambos | **RF_16** · eventos + tareas unificados para pintar el calendario del mockup 06 |

> `/agenda` devuelve una lista de ítems con forma común `{ id, clase: 'EVENTO' \| 'TAREA', tipo,
> titulo, fecha, estado }`. El calendario del mockup pinta un punto azul para evento y verde para
> tarea; si la app tuviera que unir dos listados por su cuenta, la lógica de agrupación por día
> quedaría duplicada en Dart y en el informe.

### M6 · Vigilancia — RF_17 a RF_19

| Método | Ruta | Auth | Cubre |
|---|---|---|---|
| `POST` | `/edge/alertas` | **API key del dispositivo** | **RF_17** · IF5-ENT · almacena y dispara **RF_18** |
| `POST` | `/edge/heartbeat` | API key | alimenta `estado_edge` de IF2-SAL |
| `GET` | `/alertas?desde=&hasta=&tipo=&page=` | Bearer | **RF_19** · IF2-SAL · filtrado por predio del token |
| `GET` | `/alertas/:id` | Bearer | destino del deep-link de la notificación push |
| `POST` | `/alertas/:id/revisar` | Bearer | marca `REVISADA` (campos `id_revisado_por`/`fecha_revision` del MER) |
| `GET` | `/vigilancia/estado` | Bearer | último conteo + estado del dispositivo (encabezado del mockup 10) |

### Convenciones de error

Un solo formato, para que la app tenga un único punto de traducción a mensajes en español:

```json
{ "error": { "codigo": "ANIMAL_INACTIVO", "mensaje": "...", "detalles": {} } }
```

`400` validación Zod · `401` sin token / expirado · `403` rol insuficiente · `404` no existe o es de
otro predio · `409` conflicto de estado (duplicado, ya completada, ya inhabilitado) · `422` regla de
negocio (animal inactivo en un evento).

---

## 7. Contrato con el módulo edge (IA — fuera de este plan)

Este es el único punto de contacto. Mientras el módulo de visión no exista, se desarrolla contra un
**simulador** (`backend/scripts/simular-edge.ts`) que emite estas mismas llamadas.

**Ingesta — `POST /api/v1/edge/alertas`**
`Header: X-Edge-Key: <api key del dispositivo>`

```json
{
  "tipoAlerta": "DISPERSION",
  "conteoAnimales": 38,
  "conteoEsperado": 47,
  "nivel": "ADVERTENCIA",
  "descripcion": "Dispersión anormal detectada en sector norte",
  "timestamp": "2026-06-28T03:42:11-04:00"
}
```

- `tipoAlerta` ∈ `CONTEO` · `DISPERSION` · `AMENAZA` (los tres tipos que el §6.2 asigna a `Alerta`).
- El backend **no** recibe imágenes: el Límite (b) del §3.1 prohíbe procesamiento en la nube.
- Respuesta `201 { "idAlerta": "..." }`. Ante error de red el edge reintenta con backoff — la
  Restricción (a) del §3.2 dice que la conectividad rural es intermitente, así que la ingesta debe
  ser **idempotente**: `UNIQUE (id_dispositivo_edge, fecha_hora, tipo_alerta)`.
- El backend debe cumplir RNF_06: almacenar y publicar en **≤ 5 s** desde la emisión. Por eso el
  envío FCM va *después* del `201`, en el mismo proceso pero fuera de la transacción.

**Heartbeat — `POST /api/v1/edge/heartbeat`** → `{ "conteoActual": 47, "timestamp": "..." }`.
Alimenta el bloque "Última detección · Hace 5 min · 47/47 · Normal" del mockup 10.

Cuando el módulo de visión esté listo, solo se le entrega la URL del backend y su API key. Nada más
del sistema cambia.

---

## 8. Diseño de la app y pantallas

### Design system (§6.3)

```dart
// mobile/lib/core/theme/ovi_colors.dart
static const primary        = Color(0xFF2050F0);
static const primaryDark    = Color(0xFF061991);
static const primaryLight   = Color(0xFF4F75F7);
static const surface        = Color(0xFFEEF2FE);
static const surfaceSecond  = Color(0xFFD5DFFE);
static const accent         = Color(0xFF6366F1);
static const success        = Color(0xFF22C55E);
static const danger         = Color(0xFFFF6347);
static const textPrimary    = Color(0xFF1A1A2E);
static const textSecondary  = Color(0xFF6B7280);
```

Tipografía **Poppins** (alternativa Inter) vía `google_fonts`, con la jerarquía del §6.3.4:
títulos 20–28 Bold · subtítulos 16–18 SemiBold · cuerpo 14–16 Regular · secundario 12–13 Regular
gris · botones 14–16 Medium. Todo esto se declara **una vez** en un `ThemeData` y nunca se repite
un color literal en una pantalla.

**Nota sobre §6.3.4:** el texto dice que la fuente elegida es *Poppins* y luego la jerarquía se
describe toda en *Inter*, y el cierre del §6.3.5 dice "la tipografía Inter". Hay que elegir una.
Recomendación: **Inter**, porque es la que aparece en los mockups renderizados y tiene mejor
legibilidad a 12–13 px, que es el tamaño del texto secundario en las tarjetas.

### Estructura de navegación (§6.3.5)

`ShellRoute` de `go_router` con **bottom nav fija de 5 tabs**: Inicio · Rebaño · Calendario ·
Vigilancia · Más. Ítem activo en `primary`. FAB en Rebaño, Calendario y Tareas.
RNF_04 exige llegar a cualquier función principal en **≤ 3 interacciones** desde el inicio — el
shell de 5 tabs ya garantiza 1, y cada tab debe resolver su acción principal en 2 más.

### Inventario de pantallas

Los mockups de la tesis vienen numerados (02 Inicio, 03 Rebaño, 06 Calendario, 10 Vigilancia), lo
que implica un set completo de ~13. Las cuatro publicadas quedan fijas; el resto se propone aquí y
**hay que contrastarlo contra el Figma original**.

| # | Pantalla | Patrón (§6.3.5) | RF | Estado |
|---|---|---|---|---|
| 01 | Login | formulario | IF6-ENT, H13 | por diseñar |
| **02** | **Inicio (Home)** | **Dashboard** | RF_15, RF_18 | ✅ Figura 6.5 izq. |
| **03** | **Rebaño (lista de animales)** | **Lista** | RF_02 | ✅ Figura 6.5 der. |
| 04 | Ficha animal (detalle) | Dashboard | RF_02 | por diseñar |
| 05 | Registrar / editar animal | formulario | RF_01, RF_03 | por diseñar |
| 05b | Dar de baja animal | modal | RF_04 | por diseñar |
| 06 | **Calendario general** | **Calendario/Timeline** | RF_16 | ✅ Figura 6.6 izq. |
| 07 | Detalle de evento | Dashboard | RF_08 | por diseñar |
| 08 | Crear / editar evento | formulario + selector de animales | RF_07, RF_09, RF_10 | por diseñar |
| 09 | Crear / editar tarea + detalle | formulario | RF_11–RF_14 | por diseñar |
| **10** | **Vigilancia y detección** | **Lista + panel** | RF_19 | ✅ Figura 6.6 der. |
| 11 | Detalle de alerta | Dashboard | RF_19 | por diseñar |
| 12 | Más (perfil, sesión) | Lista | — | por diseñar |
| 13 | Gestión de usuarios + alta/edición | Lista + formulario | RF_20–RF_22 | por diseñar |
| 14 | Bitácora del animal | Timeline | RF_05 | por diseñar |

### Detalles que salen de los mockups y hay que respetar

- **Mockup 02:** saludo "Buenos días / Hola, {nombre}" + campana con badge · tarjeta "Resumen de hoy"
  con **tres métricas** (47 animales activos en `primary`, 3 tareas hoy, 2 alertas sin leer en
  `danger`) · sección "Agenda · Hoy" con chip de tipo por ítem (Esquila azul, Tarea verde) · banner
  de alertas en fondo `danger` tenue con contador y última detección.
- **Mockup 03:** subtítulo con conteo ("47 animales activos") · búsqueda "Buscar por Nº de oreja…" ·
  chips de filtro Todos / Activos / Inactivos · tarjetas con ícono de sexo (♀/♂), `#0042` en
  negrita, chip de estado verde/gris y línea "Raza · Sexo · Peso" · **animales inactivos atenuados** ·
  FAB azul.
- **Mockup 06:** grilla mensual con navegación de meses, día seleccionado en círculo `primary`,
  **puntos bajo el día** (azul = evento, verde = tarea), leyenda, y bajo la grilla el detalle del día
  con las mismas tarjetas de la agenda.
- **Mockup 10:** bloque superior con badge "EN VIVO", placeholder de video, "Última detección /
  Ovejas detectadas / 47 / 47" y chip de estado "Normal" · "Historial de alertas" con acción
  "Filtrar" · tarjetas con ícono por tipo y color por severidad (dispersión = ámbar, intruso =
  rojo, conteo normal = verde) y timestamp relativo ("Hoy 03:42", "Ayer 23:15").

> El placeholder de "video en vivo" es del módulo edge. En este plan se implementa **solo el
> contenedor y sus estados** (sin dispositivo / sin conexión / última captura). El stream se conecta
> después, sin tocar el resto de la pantalla.

---

## 9. Fases de desarrollo

Nueve incrementos. Cada uno termina en una app instalable y en verde. La duración es una estimación
en semanas de trabajo del equipo (2 personas, dedicación parcial) — ajústala a la Carta Gantt del
Apéndice E.

### Fase 0 · Fundaciones — ~2 semanas
**No entrega RF. Entrega la capacidad de entregar RF.**
- Monorepo, `.gitignore`, `.editorconfig`, ESLint/Prettier, `analysis_options.yaml`.
- `docker-compose` con PostgreSQL 16 + pgAdmin.
- `schema.prisma` completo del §5 + primera migración + seed del §5.
- Esqueleto Express: config con Zod, logger `pino`, `helmet`, CORS, handler de errores, `/health`.
- Esqueleto Flutter: tema del §8, `go_router` con el shell de 5 tabs y pantallas vacías, cliente Dio.
- CI en GitHub Actions: lint + tests de backend + `flutter analyze` + `flutter test`.
- **DoD:** `docker compose up` levanta la API con datos semilla; la app compila y navega entre los 5 tabs; CI en verde.

### Fase 1 · Autenticación, RBAC y usuarios — ~2 semanas · RF_20, RF_21, RF_22
- Backend: login/refresh/logout/me, hash **bcrypt** (RNF_03), middlewares `auth`, `rbac(rol)` y `tenant`.
- Backend: CRUD de usuarios con las reglas 11 y 12 del §3.
- App: pantalla 01 Login, almacenamiento de tokens en `flutter_secure_storage`, interceptor de
  refresh, guards de `go_router` por rol, pantalla 13 Gestión de usuarios (visible solo a Productor).
- **DoD:** un Trabajador recibe 403 en todos los endpoints de `/usuarios` y no ve la sección en la
  app; el email duplicado da 409 con mensaje legible.

### Fase 2 · Ficha Animal y Bitácora — ~3 semanas · RF_01–RF_06
El incremento más importante: la bitácora automática es la columna vertebral de la trazabilidad.
- Backend: CRUD de animales, baja con motivo, escritura transaccional de bitácora, listado con
  búsqueda y filtro por estado, paginación.
- App: pantallas 03 Rebaño (fiel al mockup), 04 Ficha, 05 Registrar/editar, 05b Baja, 14 Bitácora.
- **DoD:** registrar → editar → dar de baja un animal produce **tres** entradas de bitácora
  correlativas, la de modificación muestra valor anterior y nuevo, y ninguna se puede alterar.

### Fase 3 · Organizador de Eventos — ~2 semanas · RF_07–RF_10
- Backend: CRUD con soft delete, validación de animales activos, reconciliación de bitácoras al editar.
- App: pantallas 07 Detalle y 08 Crear/editar con selector múltiple de animales activos.
- **DoD:** un Trabajador puede ver eventos pero no crearlos, editarlos ni eliminarlos; eliminar un
  evento conserva las entradas de bitácora marcadas como *"evento eliminado"*.

### Fase 4 · Planificación de Actividades — ~1,5 semanas · RF_11–RF_14
- Backend: CRUD, asignación de responsables, completar con fecha y autor.
- App: pantalla 09, checkbox de completar desde la lista.
- **DoD:** una tarea completada no admite edición y sigue visible en el historial con su estado.

### Fase 5 · Inicio y Calendario — ~2 semanas · RF_15, RF_16
- Backend: `/inicio/resumen`, `/agenda/hoy`, `/agenda?desde=&hasta=`.
- App: pantalla 02 fiel a la Figura 6.5, pantalla 06 con `table_calendar` y marcadores por tipo.
- **DoD:** un evento y una tarea creados hoy aparecen sin recargar en Inicio y en Calendario; el
  estado vacío muestra el mensaje del CU ("no hay tareas ni eventos programados").

### Fase 6 · Vigilancia y notificaciones — ~2,5 semanas · RF_17, RF_18, RF_19
- Backend: `POST /edge/alertas` con API key e idempotencia, heartbeat, historial con filtros,
  integración `firebase-admin`, cron de recordatorios de IF4-SAL (24 h eventos / 48 h tareas).
- **Simulador de edge** (§7) para desarrollar sin la Raspberry.
- App: pantalla 10 fiel a la Figura 6.6, pantalla 11, `firebase_messaging` con deep-link al detalle,
  badge de no leídas en Inicio.
- **DoD:** el simulador emite una alerta y en < 5 s (RNF_06) llega la push a ambos roles; al tocarla
  se abre el detalle correcto.

### Fase 7 · Endurecimiento de RNF y pruebas — ~2 semanas
Cada RNF necesita una evidencia medible para el capítulo de validación:

| RNF | Qué se hace | Evidencia |
|---|---|---|
| RNF_01 · Desempeño | Índices del §5, paginación, medición con `k6` | p95 < 3 s en 4G simulado |
| RNF_02 · Edge autónomo / nube | Despliegue del backend en la nube | URL pública + simulador local funcionando |
| RNF_03 · Seguridad | HTTPS, bcrypt cost 12, RBAC, rate-limit de login, `helmet` | Informe de `npm audit` + matriz rol×endpoint |
| RNF_04 · Usabilidad | Auditoría de ≤ 3 interacciones, targets táctiles ≥ 48 dp, textos en español rural | Prueba con 3 usuarios reales + tiempo de aprendizaje |
| RNF_05 · Compatibilidad | Build Android 10 (API 29) e iOS 14, prueba en pantalla de 5" | Capturas en 3 dispositivos |
| RNF_06 · Desempeño edge | Medición emisión → visible en app | Log con marcas de tiempo, < 5 s |
| RNF_07 · Escalabilidad | Alta de un 2º predio y un 2º dispositivo edge sin migración | Demo de dos predios aislados |
| RNF_08 · Privacidad | Test de fuga entre predios en cada endpoint listable | Suite `tenant-isolation.spec.ts` |

Además: cerrar las **pruebas de aceptación del Apéndice B**, derivándolas de las post-condiciones de
las 11 tablas de casos de uso del capítulo 5.

### Fase 8 · Implantación y cierre — ~1,5 semanas
- Despliegue del backend + Postgres gestionado, backups automáticos, dominio y certificado.
- Build firmado de Android (APK/AAB) y distribución (Play Console interno o APK directo).
- Manual de usuario ilustrado y plan de capacitación (§8.1) para Productor y Trabajador.
- Estrategia de implantación (§8.2), retrospectiva y esfuerzo real (Apéndice E).

---

## 10. Matriz de trazabilidad de construcción

Cierra el ciclo **RF → CU → endpoint → pantalla → prueba → fase**. Es lo que se lleva al informe
para demostrar cobertura completa.

| RF | CU | Endpoint principal | Pantalla | Prueba de aceptación | Fase |
|---|---|---|---|---|---|
| RF_01 | CU_08 | `POST /animales` | 05 | PA-01 alta + rechazo de nº duplicado | 2 |
| RF_02 | CU_21 | `GET /animales/:id` | 03, 04 | PA-02 ficha visible activo e inactivo | 2 |
| RF_03 | CU_09 | `PATCH /animales/:id` | 05 | PA-03 nº inmutable + bloqueo si inactivo | 2 |
| RF_04 | CU_07, CU_10 | `POST /animales/:id/baja` | 05b | PA-04 baja excluye del conteo, conserva historial | 2 |
| RF_05 | CU_11 | `GET /animales/:id/bitacora` | 14 | PA-05 orden cronológico + estado vacío | 2 |
| RF_06 | CU_04,07,08,09,10 | *(efecto transaccional)* | 14 | PA-06 las 4 causas generan entrada; append-only | 2 |
| RF_07 | CU_04 | `POST /eventos` | 08 | PA-07 rechaza animal inactivo; publica en calendario | 3 |
| RF_08 | CU_22 | `GET /eventos/:id` | 07 | PA-08 accesible desde calendario y desde bitácora | 3 |
| RF_09 | CU_05 | `PATCH /eventos/:id` | 08 | PA-09 tipo inmutable; bitácoras reconciliadas | 3 |
| RF_10 | CU_06 | `DELETE /eventos/:id` | 07 | PA-10 sale del calendario, bitácora marcada | 3 |
| RF_11 | CU_12 | `POST /tareas` | 09 | PA-11 fecha ≥ hoy; visible para todo el predio | 4 |
| RF_12 | CU_13 | `PATCH /tareas/:id` | 09 | PA-12 bloqueo si completada | 4 |
| RF_13 | CU_14 | `POST /tareas/:id/completar` | 09, 02 | PA-13 registra fecha y autor | 4 |
| RF_14 | CU_15 | `DELETE /tareas/:id` | 09 | PA-14 desaparece del calendario | 4 |
| RF_15 | CU_17 | `GET /agenda/hoy` | 02 | PA-15 tareas + eventos del día; estado vacío | 5 |
| RF_16 | CU_16 | `GET /agenda` | 06 | PA-16 navegación entre meses, pasado y futuro | 5 |
| RF_17 | CU_19 | `POST /edge/alertas` | — | PA-17 alerta con timestamp, tipo y conteo; idempotente | 6 |
| RF_18 | CU_20 | *(efecto de RF_17)* | push → 11 | PA-18 push a ambos roles < 5 s con deep-link | 6 |
| RF_19 | CU_18 | `GET /alertas` | 10 | PA-19 filtros por fecha y tipo; aislamiento por predio | 6 |
| RF_20 | CU_01 | `POST /usuarios` | 13 | PA-20 email duplicado rechazado; puede iniciar sesión | 1 |
| RF_21 | CU_02 | `PATCH /usuarios/:id` | 13 | PA-21 bloqueo si inhabilitado | 1 |
| RF_22 | CU_03 | `POST /usuarios/:id/inhabilitar` | 13 | PA-22 acceso revocado, historial conservado | 1 |

---

## 11. Estrategia de pruebas

**Backend (Vitest + Supertest, base de datos real efímera en Docker).** Un archivo de integración
por módulo, más dos suites transversales: `rbac.spec.ts` (matriz rol × endpoint completa) y
`tenant-isolation.spec.ts` (RNF_08, un test por endpoint listable). Las 13 reglas de negocio del §3
son la lista de casos obligatorios — si una regla no tiene test, la fase no está cerrada.

**Flutter.** Unit sobre repositorios y notifiers (con `mocktail` sobre Dio); widget tests de las 4
pantallas de los mockups verificando los cuatro estados (cargando / vacío / error / con datos);
`integration_test` para tres flujos completos: *login → registrar animal → ver bitácora*,
*crear tarea → completarla → verla en Inicio*, y *recibir alerta simulada → abrir detalle*.

**Aceptación (Apéndice B).** Las PA-01…PA-22 de la matriz, escritas en formato Dado/Cuando/Entonces
sobre las post-condiciones de los casos de uso, ejecutadas manualmente con un Productor y un
Trabajador reales (actividad 5.2 del Objetivo 5).

**Rendimiento.** `k6` contra los tres endpoints más pesados (`/animales`, `/agenda`, `/alertas`)
para RNF_01, y medición extremo a extremo del simulador edge para RNF_06.

---

## 12. Convenciones de trabajo

- **Ramas:** `main` protegida; una rama por fase (`fase/2-ficha-animal`) y ramas cortas por RF
  (`rf/03-editar-animal`). PR con al menos una revisión del otro integrante.
- **Commits:** Conventional Commits con el RF en el scope — `feat(rf-01): registrar animal`. Al
  final del proyecto, `git log` es la evidencia del esfuerzo real del Apéndice E.4.
- **Nomenclatura:** dominio en **español** (tablas, entidades, rutas); palabras técnicas en inglés
  (`repository`, `middleware`). `snake_case` en BD, `camelCase` en JSON y Dart, `PascalCase` en tipos.
- **Secretos:** nunca en el repo. `.env.example` versionado, `.env` ignorado.
- **Documentación viva:** cada fase actualiza este archivo y `backend/openapi.yaml`. El §7.2 de la
  tesis (estructura del código y endpoints) se genera desde ahí, no se escribe a mano al final.

---

## 13. Riesgos del desarrollo

| Riesgo | Impacto | Mitigación |
|---|---|---|
| El módulo edge llega tarde o no llega | RF_17–19 sin validar | El simulador del §7 desacopla por completo; la Fase 6 no depende del hardware |
| FCM requiere cuenta de Firebase y, en iOS, cuenta de desarrollador de pago | RF_18 bloqueado | Configurar Firebase en la Fase 0; si iOS no es viable, entregar **solo Android** — RNF_05 lo permite acotar y hay que declararlo |
| Los mockups 01, 04, 05, 07–09, 11–14 no existen aún | Retrabajo de UI | Diseñarlos en la Fase 0/1 reutilizando los 3 patrones del §6.3.5 antes de codificar cada fase |
| Bitácora automática mal diseñada | Pierde la trazabilidad SAG, que es el corazón del proyecto | Es lo primero de la Fase 2 y se escribe en la misma transacción que la mutación |
| Sin acceso a un predio real para validar | Objetivo 5 incompleto | Agendar la validación de campo **antes** de la Fase 6, no al final |
| Alcance creciendo hacia funciones no especificadas (pesajes, potreros, reportes) | Retraso | Ninguna función fuera de RF_01–RF_22 entra sin actualizar el capítulo 3 |

---

## 14. Decisiones que necesito de ustedes

1. **H1, H2, H3, H4, H6:** ¿se corrigen en el documento de tesis? Definen tablas y cambian el §3.4, el §6.1 y el MER del §6.2.
2. **Poppins o Inter** (§8) — el §6.3.4 nombra ambas y los mockups usan Inter.
3. **¿iOS entra en el alcance?** RNF_05 lo exige, pero implica cuenta de desarrollador Apple. Si no, acotar RNF_05 a Android.
4. **Existe un Figma con los mockups 01–13?** Si sí, lo uso como fuente en vez del inventario propuesto en §8.
5. **¿Dónde se despliega el backend?** (Railway, Render, Fly.io, VPS propio). Afecta la Fase 8 y el flujo de caja del §4.1.3.

---

*Última actualización: 30 de agosto de 2026*

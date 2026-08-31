# OviApp — Contrato de la app móvil

Referencia única para construir las features de `mobile/`. Las formas JSON de esta
página están **verificadas contra la API en ejecución** con la base sembrada, no
inferidas del código.

Base de la API: `/api/v1`. Auth `Bearer <accessToken>` en todo salvo `/auth/login`.

---

## 1. Núcleo ya disponible (no reimplementar)

| Archivo | Qué ofrece |
|---|---|
| `core/proveedores.dart` | `dioProvider` — cliente HTTP con token, refresh automático y errores traducidos |
| `core/red/api.dart` | extensión sobre `Dio`: `traerMapa`, `traerPaginado<T>`, `enviar`, `parchar`, `borrar` |
| `core/red/paginado.dart` | `Paginado<T>` (`datos`, `meta`, `hayMas`, `estaVacio`, `mas()`), `MetaPaginacion` |
| `core/red/error_api.dart` | `ErrorApi` (`codigo`, `mensaje`, `status`, `mensajeDe(campo)`) |
| `core/red/cliente_api.dart` | `comoErrorApi(Object)` |
| `core/widgets/ovi_estados.dart` | `OviAsync<T>`, `OviCargando`, `OviEstadoVacio`, `OviEstadoError` |
| `core/widgets/ovi_widgets.dart` | `OviTarjeta`, `OviChip` + `TonoChip`, `OviMetrica`, `OviEncabezadoSeccion`, `OviDato`, `OviIconoSexo`, `mostrarMensaje()` |
| `core/tema/ovi_colores.dart` | `OviColores.*` — **única** fuente de color |
| `core/tema/ovi_tema.dart` | `OviTema.radioTarjeta`, `radioControl`, `alturaMinimaControl`, `espacio` |
| `core/formato.dart` | `Fmt.*` (fechas, horas, `fechaHoraRelativa`, `hace`, `peso`, `iso`, `saludo`) y `Etiquetas.*` (enums → español) |
| `core/router/rutas.dart` | `Rutas.*` — navegar **solo** por nombre: `context.goNamed(...)` / `pushNamed(...)` |
| `features/auth/sesion.dart` | `sesionProvider`, `esProductorProvider`, `usuarioActualProvider` |

### Reglas no negociables

1. **Ningún color literal.** Siempre `OviColores.*`.
2. **Ningún `DioException` fuera de la capa de datos.** Usar los métodos de `api.dart`; lo que sale es `ErrorApi`.
3. **Los cuatro estados siempre.** Toda pantalla que lee de red usa `OviAsync` (cargando / error / vacío / datos). Una pantalla en blanco es un bug.
4. **Textos en español de Chile**, sin jerga técnica. El `mensaje` de `ErrorApi` ya viene redactado: mostrarlo tal cual.
5. **Controles de 48 dp mínimo** (`OviTema.alturaMinimaControl`). Se opera con guantes y a pleno sol.
6. **Permisos en la UI:** si el rol no puede hacer algo, el control **no se muestra** (`esProductorProvider`). El backend igual lo bloquea, pero un botón que siempre falla es un defecto de usabilidad.
7. **Navegación por nombre**, nunca por ruta literal.
8. Comentarios y nombres en español, sin tildes en identificadores.
9. Nada de `part`/`build_runner`: los modelos se escriben a mano con `desdeJson`.

### Patrón de una feature

```
features/<nombre>/
  datos/<nombre>_repositorio.dart   // modelos + llamadas HTTP
  <nombre>_proveedores.dart         // providers de Riverpod
  pantallas/<pantalla>.dart         // UI
```

Modelo: clase inmutable con `const` constructor y `factory X.desdeJson(Map<String, dynamic>)`.
Repositorio: clase que recibe `Dio` y expone métodos que devuelven modelos.
Providers: `Provider` para el repositorio, `FutureProvider`/`AsyncNotifierProvider` para el estado.

Ejemplo mínimo del estilo esperado:

```dart
final repoAnimalesProvider = Provider((ref) => RepositorioAnimales(ref.watch(dioProvider)));

final animalProvider = FutureProvider.family<Animal, String>(
  (ref, id) => ref.watch(repoAnimalesProvider).ficha(id),
);
```

Refrescar tras una mutación: `ref.invalidate(animalProvider(id))`.

---

## 2. Endpoints y formas exactas

Todo campo `DateTime` llega como ISO-8601 en UTC (`2026-08-31T13:00:00.000Z`).
Los listados responden `{ datos: [...], meta: { pagina, tamano, total, totalPaginas } }`
y aceptan `pagina` y `tamano` (máx. 100).

### Sesión

`GET /auth/me`
```json
{ "id":"…", "nombre":"Manuel Sáez", "email":"manuel@oviapp.cl", "rut":"12.345.678-9",
  "telefono":"+56 9 8765 4321", "fotoUrl":null, "rol":"PRODUCTOR", "estado":"HABILITADO",
  "predio": { "id":"…", "nombre":"Fundo El Manzano", "ubicacion":"Ñuble, Región de Ñuble" } }
```

### Inicio — RF_15

`GET /inicio/resumen`
```json
{ "animalesActivos":47, "tareasHoy":3, "alertasSinLeer":2,
  "ultimaAlerta": { "id":"…", "tipoAlerta":"DISPERSION", "descripcion":"…", "fechaHora":"…" } }
```
`ultimaAlerta` puede ser `null`.

`GET /agenda/hoy`
```json
{ "fecha":"2026-08-31",
  "items":[ { "id":"…", "clase":"TAREA", "tipo":"TAREA", "titulo":"Revisar cercos sector 4",
              "descripcion":"…", "fecha":"…", "estado":"ACTIVA",
              "meta": { "responsables":[{"id":"…","nombre":"Rosa Millán"}], "completadaEn":null } },
            { "id":"…", "clase":"EVENTO", "tipo":"ESQUILA", "titulo":"Esquila",
              "descripcion":"Esquila Hato Norte", "fecha":"…", "estado":"PROGRAMADO",
              "meta": { "animales":47 } } ] }
```

### Calendario — RF_16

`GET /agenda?desde=AAAA-MM-DD&hasta=AAAA-MM-DD` → misma forma de `items` (sin `fecha` de nivel superior).
`clase` es `EVENTO` o `TAREA`; en eventos `tipo` es el tipo de evento, en tareas es `TAREA`.

### Rebaño — RF_01 a RF_04

`GET /animales?estado=ACTIVO|INACTIVO&q=<nº oreja>&pagina=&tamano=`
```json
{ "id":"…", "numeroOreja":"0042", "sexo":"HEMBRA", "raza":"Suffolk", "color":"Blanco",
  "pesoKg":45, "fechaNacimiento":"…", "descripcion":null, "estado":"ACTIVO",
  "motivoBaja":null, "fechaBaja":null, "createdAt":"…", "updatedAt":"…" }
```

`GET /animales/:id` → lo anterior más:
```json
{ "registrador": {"id":"…","nombre":"Manuel Sáez"},
  "ultimasEntradas":[ {"id":"…","tipo":"EVENTO","titulo":"Esquila","descripcion":"…","fecha":"…"} ] }
```

`POST /animales` → 201. Cuerpo: `numeroOreja`* , `sexo`* (`MACHO`|`HEMBRA`), `raza`, `color`, `pesoKg` (número), `fechaNacimiento` (`AAAA-MM-DD`), `descripcion`.
409 `NUMERO_OREJA_DUPLICADO` si ya existe.

`PATCH /animales/:id` → mismos campos opcionales. **No enviar `numeroOreja`**: es inmutable y devuelve 409. 409 si el animal está inactivo.

`POST /animales/:id/baja` → **solo Productor**. Cuerpo: `{ "motivo":"VENTA"|"MUERTE"|"FAENA", "fecha":"AAAA-MM-DD" }`.

### Bitácora — RF_05, RF_06

`GET /animales/:idAnimal/bitacora?tipo=ALTA|MODIFICACION|BAJA|EVENTO|NOTA&pagina=&tamano=`
```json
{ "id":"…", "tipo":"EVENTO", "titulo":"Esquila", "descripcion":"Esquila Hato Norte",
  "datos": {"tipoEvento":"ESQUILA"}, "idEvento":"…", "eventoEliminado":false,
  "fecha":"…", "registradaEn":"…", "usuario":{"id":"…","nombre":"Manuel Sáez"} }
```
`usuario` puede ser `null` (la generó el sistema). En `MODIFICACION`, `datos` trae `{campo, valorAnterior, valorNuevo}`. Si `eventoEliminado` es `true`, marcar la entrada como «evento eliminado» (RF_10).

`POST /animales/:idAnimal/bitacora` → 201. Cuerpo `{ "contenido": "…" }` (1–1000 caracteres).
Las entradas son de **solo lectura**: no hay editar ni eliminar.

### Eventos — RF_07 a RF_10

`GET /eventos?desde=&hasta=&tipo=&estado=&incluirEliminados=true`
```json
{ "id":"…", "tipo":"ATENCION_SANITARIA", "descripcion":"Visita veterinaria…",
  "fechaInicio":"…", "estado":"PROGRAMADO", "eliminadoEn":null,
  "creador":{"id":"…","nombre":"…"},
  "animales":[{"id":"…","numeroOreja":"0042","sexo":"HEMBRA","raza":"Suffolk","estado":"ACTIVO"}],
  "creadoEn":"…", "actualizadoEn":"…" }
```

`GET /eventos/:id` → misma forma.
`POST /eventos` → **solo Productor**, 201. Cuerpo: `tipo`* (`ENCASTE`|`ESQUILA`|`ATENCION_SANITARIA`|`OTRO`), `fechaInicio`* (ISO **con offset**, p. ej. `2026-09-09T14:00:00.000Z`), `descripcion`, `idAnimales`* (lista de uuid, no vacía). 422 si algún animal está inactivo.
`PATCH /eventos/:id` → **solo Productor**. `descripcion`, `fechaInicio`, `idAnimales`. **No enviar `tipo`** (409, inmutable).
`DELETE /eventos/:id` → **solo Productor**, 204. Soft delete.

### Tareas — RF_11 a RF_14

`GET /tareas?estado=ACTIVA|COMPLETADA&desde=&hasta=&idResponsable=`
```json
{ "id":"…", "titulo":"Preparar galpón de esquila", "descripcion":"…",
  "fechaLimite":"2026-08-28T00:00:00.000Z", "estado":"COMPLETADA", "completadaEn":"…",
  "creador":{"id":"…","nombre":"…"}, "completadaPor":{"id":"…","nombre":"…"},
  "responsables":[{"id":"…","nombre":"Pedro Huenchual"}], "animales":[],
  "createdAt":"…", "updatedAt":"…" }
```
`POST /tareas` → 201, **ambos roles**. Cuerpo: `titulo`*, `fechaLimite`* (`AAAA-MM-DD`, ≥ hoy), `idResponsables`* (no vacía), `descripcion`, `idAnimales` (opcional).
422 `RESPONSABLES_REQUERIDOS` si viene vacía; 422 `FECHA_PASADA` si la fecha ya pasó.
`PATCH /tareas/:id` → 409 `TAREA_COMPLETADA` si ya está completada.
`POST /tareas/:id/completar` → 200.
`DELETE /tareas/:id` → 204, borrado definitivo.

`animales` en una tarea es opcional (H10): mostrar el selector, pero no exigirlo.

### Vigilancia — RF_17 a RF_19

`GET /alertas?desde=&hasta=&tipo=CONTEO|DISPERSION|AMENAZA&estado=NUEVA|REVISADA`
```json
{ "id":"…", "tipoAlerta":"DISPERSION", "descripcion":"Dispersión anormal…",
  "nivel":"ADVERTENCIA", "conteoAnimales":38, "conteoEsperado":47,
  "fechaHora":"…", "estado":"NUEVA", "fechaRevision":null, "revisadoPor":null,
  "dispositivo":{"id":"…","nombre":"Cámara Hato Norte"} }
```
`GET /alertas/:id` → misma forma. `POST /alertas/:id/revisar` → 200, marca `REVISADA`.

`GET /vigilancia/estado`
```json
{ "dispositivos":[ { "id":"…", "nombre":"Cámara Hato Norte", "ultimoHeartbeat":"…",
                     "ultimoConteo":47, "conteoEsperado":47, "enLinea":true } ],
  "alertasSinRevisar":2,
  "ultimaAlerta":{ "id":"…","tipoAlerta":"DISPERSION","descripcion":"…","nivel":"ADVERTENCIA",
                   "conteoAnimales":38,"fechaHora":"…" } }
```
El vídeo en vivo es del módulo edge y **queda fuera de alcance**: se pinta el contenedor con sus estados (sin dispositivo / fuera de línea / última captura), nunca un reproductor.

### Administración — RF_20 a RF_22

`GET /usuarios?rol=&estado=&q=` → `{ id, nombre, email, rut, telefono, fotoUrl, rol, estado, createdAt, updatedAt }`
`POST /usuarios` → **solo Productor**, 201. Cuerpo: `nombre`*, `email`*, `password`* (≥ 8), `rol`* (`PRODUCTOR`|`TRABAJADOR`), `rut`, `telefono`. 409 `EMAIL_DUPLICADO`.
`PATCH /usuarios/:id` → `nombre`, `email`, `rol`, `rut`, `telefono`. 409 si está inhabilitado.
`POST /usuarios/:id/inhabilitar` → 200. 422 `AUTOINHABILITACION` si es uno mismo; 422 `ULTIMO_PRODUCTOR` si dejaría el predio sin productor.
No existe rehabilitar.

---

## 3. Pantallas y firmas exactas

El router (`core/router/rutas.dart`) ya importa estos archivos con estos nombres.

| Archivo | Clase y constructor |
|---|---|
| `features/inicio/pantallas/inicio.dart` | `PantallaInicio({super.key})` |
| `features/rebano/pantallas/rebano.dart` | `PantallaRebano({super.key})` |
| `features/rebano/pantallas/ficha_animal.dart` | `PantallaFichaAnimal({super.key, required String idAnimal})` |
| `features/rebano/pantallas/formulario_animal.dart` | `PantallaFormularioAnimal({super.key, String? idAnimal})` — alta si es `null`, edición si no |
| `features/bitacora/pantallas/bitacora.dart` | `PantallaBitacora({super.key, required String idAnimal, String? numeroOreja})` |
| `features/calendario/pantallas/calendario.dart` | `PantallaCalendario({super.key})` |
| `features/eventos/pantallas/detalle_evento.dart` | `PantallaDetalleEvento({super.key, required String idEvento})` |
| `features/eventos/pantallas/formulario_evento.dart` | `PantallaFormularioEvento({super.key, String? idEvento, String? fechaSugerida})` |
| `features/tareas/pantallas/tareas.dart` | `PantallaTareas({super.key})` |
| `features/tareas/pantallas/detalle_tarea.dart` | `PantallaDetalleTarea({super.key, required String idTarea})` |
| `features/tareas/pantallas/formulario_tarea.dart` | `PantallaFormularioTarea({super.key, String? idTarea, String? fechaSugerida})` |
| `features/vigilancia/pantallas/vigilancia.dart` | `PantallaVigilancia({super.key})` |
| `features/vigilancia/pantallas/detalle_alerta.dart` | `PantallaDetalleAlerta({super.key, required String idAlerta})` |
| `features/mas/pantallas/mas.dart` | `PantallaMas({super.key})` |
| `features/administracion/pantallas/usuarios.dart` | `PantallaUsuarios({super.key})` |
| `features/administracion/pantallas/formulario_usuario.dart` | `PantallaFormularioUsuario({super.key, String? idUsuario})` |

Nombres de ruta disponibles en `Rutas`: `inicio`, `rebano`, `animalNuevo`, `animalFicha`,
`animalEditar`, `animalBitacora`, `calendario`, `tareas`, `tareaNueva`, `tareaDetalle`,
`tareaEditar`, `eventoNuevo`, `eventoDetalle`, `eventoEditar`, `vigilancia`,
`alertaDetalle`, `mas`, `usuarios`, `usuarioNuevo`, `usuarioEditar`.

Parámetros de ruta: `animalFicha` / `animalEditar` / `animalBitacora` usan `id`;
`eventoDetalle` / `eventoEditar` usan `id`; `tareaDetalle` / `tareaEditar` usan `id`;
`alertaDetalle` usa `id`; `usuarioEditar` usa `id`.
`animalBitacora` acepta `?oreja=`; `eventoNuevo` y `tareaNueva` aceptan `?fecha=AAAA-MM-DD`.

---

## 4. Los cuatro mockups de la tesis

Son el estándar visual; el resto de pantallas se deriva de sus tres patrones
(dashboard, lista, calendario).

**02 · Inicio** — saludo «Buenos días / Hola, {nombre}» y campana con badge ·
tarjeta «Resumen de hoy» con tres métricas (47 animales activos en `primary`,
3 tareas hoy, 2 alertas sin leer en `peligro`) · «Agenda · Hoy» con la fecha a la
derecha y un chip de tipo por ítem (evento azul, tarea verde) · banner de alertas
sobre `peligroFondo` con contador y última detección, que lleva a Vigilancia.

**03 · Rebaño** — título «Rebaño» y subtítulo «47 animales activos» ·
buscador «Buscar por Nº de oreja…» · chips Todos / Activos / Inactivos ·
tarjetas con `OviIconoSexo`, `#0042` en negrita, `OviChip.estadoAnimal` y la línea
«Raza · Sexo · Peso» · **los inactivos atenuados** (`OviTarjeta(atenuada: true)`) ·
FAB azul de alta.

**06 · Calendario** — grilla mensual navegable (`table_calendar`), día
seleccionado en círculo `primary`, **puntos bajo el día** (azul = evento, verde =
tarea), leyenda «● Evento ● Tarea», y bajo la grilla el detalle del día con las
mismas tarjetas de la agenda.

**10 · Vigilancia** — encabezado «Vigilancia del rebaño» · bloque superior con
badge «EN VIVO», marco del vídeo y la fila «Última detección / Ovejas detectadas
/ 47 / 47» con chip de estado · «Historial de alertas» con acción «Filtrar» ·
tarjetas con icono por tipo y color por severidad (dispersión `advertencia`,
intruso `peligro`, conteo normal `exito`) y marca de tiempo relativa
(`Fmt.fechaHoraRelativa`).

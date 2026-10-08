# Recorrido grabado de la app móvil (avance)

Guion para grabar un video corto (unos 10 minutos) que muestre al profesor guía lo que la app móvil ya hace, contrastado con los requerimientos funcionales del informe (capítulo 3, RF_01 a RF_22).

Al final hay una tabla que compara cada RF con su estado real en la app. En la tabla, **✅** significa que el requerimiento está completo, **⚠️** que está implementado solo en parte y **❌** que todavía no está en la app móvil.

---

## 1. Antes de grabar

1. Levantar el sistema con datos de prueba recién sembrados:

   ```bat
   levantar-oviapp.bat seed sin-ia
   ```

   `sin-ia` omite el ia-engine, porque ese módulo necesita GPU NVIDIA y el modelo `.pt`. Las alertas que se muestran en el video vienen de la semilla. La cámara en vivo (MediaMTX y la cámara simulada) sí se levanta.

2. La app se abre en Edge (build web, puerto 5000). Para que se vea como un teléfono, abre DevTools (F12), activa la vista de dispositivo (Ctrl+Shift+M) y elige un teléfono Android de unas 6".

3. Credenciales de la semilla (todas usan la contraseña `Ovi2026!`):

   | Usuario | Rol | Uso en el video |
   |---|---|---|
   | `manuel@oviapp.cl` | Productor | Recorrido principal |
   | `rosa@oviapp.cl` | Trabajador | Mostrar las restricciones por rol |
   | `carmen@oviapp.cl` | Productor de otro predio | Opcional: aislamiento entre predios (RNF_08) |

4. Qué deja cargado la semilla (sirve para saber qué va a aparecer en pantalla):
   - Predio **Fundo El Manzano**, con 47 animales activos y 3 inactivos: `#0007` (venta), `#0015` (muerte) y `#0023` (faena).
   - Hoy: el evento **Esquila Hato Norte** a las 09:00 y tres tareas que vencen hoy (entre ellas «Revisar cercos sector 4», asignada a Rosa).
   - Un encaste hace 35 días, una visita veterinaria en 9 días, una tarea completada y otra que vence en 5 días.
   - Alertas: **Dispersión** (ayer) e **Intruso** (hoy, 03:42) sin revisar, y **Conteo** (ayer) ya revisada.

5. Antes de empezar, decide si vas a mostrar **«Eliminar del rebaño»** (ver la sección 5). Si no quieres mostrarlo, en el paso 7 elige «Dejar inactivo».

---

## 2. Guion del recorrido

Los tiempos son orientativos. Los pasos marcados como *(opcional)* se pueden saltar si el video se alarga.

### Paso 1: Inicio de sesión (≈ 20 s)
- Pantalla de arranque y luego el login. Ingresa como **manuel@oviapp.cl**.
- Qué decir: no hay registro abierto; solo entra quien fue creado por un Productor. La sesión queda guardada de forma segura, así que la próxima vez se entra directo.

### Paso 2: Pantalla de Inicio, RF_15 (≈ 45 s)
- Muestra el saludo y las tres métricas: **animales activos (47)**, **tareas de hoy** y **alertas sin leer**. Cada métrica es un acceso directo a su módulo.
- Muestra la tarjeta roja de vigilancia («2 alertas de vigilancia · Última: intruso…»).
- En **Agenda · Hoy** aparecen la esquila y las tareas del día. Toca **Esquila Hato Norte** para abrir el detalle del evento (RF_08): tipo, fecha, descripción, quién lo registró y los animales involucrados.
- Muestra la barra inferior con 5 pestañas y comenta que cualquier función queda a 3 toques o menos (RNF_04).

### Paso 3: Rebaño, consultar la ficha, RF_02 y RF_05 (≈ 1 min)
- Pestaña **Rebaño**: contador de activos, lista con sexo, raza y peso.
- Escribe `0042` en el buscador; la búsqueda espera a que termines de escribir.
- Usa los filtros **Activos / Inactivos**. Abre **#0007** (inactivo) para mostrar que la ficha sigue disponible, con el motivo y la fecha de baja.
- Vuelve y abre **#0042**: datos generales, quién lo registró y las últimas entradas de la bitácora.
- En la bitácora, toca **Ver todo** para abrir el timeline de solo lectura (RF_05).
- *(opcional)* Toca el botón **+ Nota** para agregar una observación manual. Es la única entrada que escribe el usuario.

### Paso 4: Registrar y editar un animal, RF_01, RF_03 y RF_06 (≈ 1 min 15 s)
- En Rebaño, toca el botón **+** e ingresa N° de oreja `0200`, sexo Hembra, raza Suffolk, color Blanco, peso 40 kg y una observación. Guarda.
- *(opcional)* Intenta registrar un `0042` repetido para mostrar el rechazo por identificador duplicado.
- En la ficha nueva, muestra que la bitácora ya tiene la entrada **«Alta del animal #0200»** (RF_06a).
- Toca **Editar** (lápiz): el N° de oreja aparece bloqueado porque es inmutable. Cambia el peso a 42 kg y guarda.
- Muestra en la bitácora la nueva entrada de **modificación** (RF_06b).

### Paso 5: Calendario y eventos, RF_16, RF_07, RF_09 y RF_10 (≈ 2 min)
- Pestaña **Calendario**: vista mensual, con un punto azul para los días con eventos y uno verde para los días con tareas. Avanza un mes para mostrar la visita veterinaria, retrocede para ver el encaste pasado y toca un día para ver su detalle.
- Toca **+**. Como Productor aparecen dos opciones: **Evento** o **Tarea**. Elige **Evento del ciclo productivo**.
  - Tipo: Atención sanitaria. Fecha: hoy. Animales involucrados: **#0200** y **#0042**. Agrega una descripción y guarda (RF_07).
- Ve a Rebaño, abre **#0200** y luego su bitácora: aparece la entrada del evento (RF_06d).
- Vuelve al evento y toca **Editar**: el tipo está bloqueado. Cambia la descripción y guarda (RF_09).
- Toca **Eliminar evento** (RF_10). El evento desaparece del calendario, y en la bitácora de #0200 la entrada sigue ahí con la etiqueta **«Evento eliminado»**.

### Paso 6: Tareas, RF_11 a RF_14 (≈ 1 min 30 s)
- Desde Calendario, abre el ícono de **Tareas**: lista con los filtros **Activas / Completadas / Todas**.
- Toca **+** y crea «Vacunar corderos», con fecha de término mañana, responsables **Rosa y Pedro** y *(opcional)* animales asociados (RF_11).
- Abre la tarea, toca **Editar** y cambia la fecha (RF_12).
- Toca **Marcar como completada**. Muestra que queda registrado quién la completó y cuándo, y que ya no se puede editar (RF_13).
- Abre otra tarea y **elimínala** (RF_14).

### Paso 7: Baja del animal, RF_04 y RF_06c (≈ 45 s)
- Ve a Rebaño, abre **#0200** y toca **Registrar baja**. Elige el motivo (venta, muerte o faena) y la fecha, y confirma.
- El animal pasa a **Inactivo**, sale del conteo de activos y se agrega la entrada de baja en su bitácora.
- Aparece el diálogo **«Dejar inactivo / Eliminar del rebaño»**. Para mantenerte fiel al informe, elige **Dejar inactivo** (ver la sección 5).

### Paso 8: Vigilancia, RF_17 y RF_19 (≈ 1 min 30 s)
- Pestaña **Vigilancia**: la tarjeta de la **Cámara Hato Norte** muestra el estado (en línea o sin señal), la última detección y las ovejas detectadas.
- **Historial de alertas**: usa el filtro por tipo (Conteo, Dispersión anormal o Intruso detectado).
- Abre la alerta de **Intruso**. El detalle muestra fecha y hora, ovejas detectadas y esperadas, la diferencia y el dispositivo. Toca **Marcar como revisada**: baja el contador de «sin leer» y la alerta muestra quién la revisó y cuándo.
- Toca **Ver en vivo**: transmisión de la cámara (HLS a través de MediaMTX).
- Qué decir sobre RF_17: el backend recibe las señales del módulo edge por una API autenticada con API key, y el ia-engine (YOLO con ByteTrack) ya detecta conteo y dispersión. No se levantó en este video porque requiere GPU.

### Paso 9: Administración de usuarios, RF_20 a RF_22 (≈ 1 min)
- Pestaña **Más**: perfil, predio y la opción **Usuarios del predio**, visible solo para el Productor.
- Toca **+** y crea «Juan Pérez», `juan@oviapp.cl`, contraseña de 8 o más caracteres, rol Trabajador (RF_20).
- En el menú del usuario, elige **Editar** y cambia el nombre o el rol (RF_21).
- En el menú, elige **Inhabilitar** y confirma (RF_22). Comenta que uno no puede inhabilitarse a sí mismo.

### Paso 10: Roles, cerrando con el Trabajador (≈ 1 min)
- En Más, toca **Cerrar sesión**.
- *(opcional)* Intenta entrar como `juan@oviapp.cl`: el acceso es rechazado porque el usuario está inhabilitado.
- Entra como **rosa@oviapp.cl** (Trabajador) y muestra:
  - En **Más** no aparece la administración de usuarios.
  - En **Calendario**, el **+** abre directo el formulario de tarea, porque el Trabajador no crea eventos.
  - En el detalle de un evento no aparecen Editar ni Eliminar.
  - En la ficha de un animal activo no aparece **Registrar baja**, aunque sí puede registrar y editar animales.
- Qué decir: los permisos también se validan en el backend (responde 403), no solo se ocultan en la interfaz (RNF_03).

---

## 3. Comparación: requerimientos del informe y app móvil

| RF | Informe (capítulo 3) | Estado en la app | Observación | Paso |
|---|---|---|---|---|
| RF_01 | Registrar animal | ✅ | Oreja única validada. Agrega fecha de nacimiento, que no está en el informe. | 4 |
| RF_02 | Consultar ficha animal | ✅ | Búsqueda por N° de oreja y filtro activos/inactivos. La ficha de un inactivo sigue visible. | 3 |
| RF_03 | Editar datos generales | ✅ | Oreja bloqueada; solo se editan animales activos; queda la entrada en la bitácora. | 4 |
| RF_04 | Registrar baja | ✅ | Motivo y fecha; solo Productor. **Ojo:** existe además la eliminación definitiva (sección 5). | 7 |
| RF_05 | Consultar bitácora | ✅ | Timeline cronológico de solo lectura. | 3 |
| RF_06 | Entradas automáticas en la bitácora | ✅ | Alta, modificación, baja y evento. La base de datos impide editar o borrar entradas. | 4, 5, 7 |
| RF_07 | Registrar evento | ✅ | Solo Productor; tipos encaste, esquila, atención sanitaria y otro; exige al menos un animal activo. | 5 |
| RF_08 | Consultar detalle de evento | ⚠️ | Se abre desde el Calendario y el Inicio, pero **no desde la bitácora del animal**, como pide el informe. | 2, 5 |
| RF_09 | Editar evento | ✅ | El tipo queda bloqueado después de crear el evento. | 5 |
| RF_10 | Eliminar evento | ✅ | Las entradas de la bitácora se conservan marcadas como «Evento eliminado». | 5 |
| RF_11 | Crear tarea | ⚠️ | Tiene fecha de término y varios responsables; **falta la opción «duración estimada»**. Agrega animales opcionales. | 6 |
| RF_12 | Editar tarea | ✅ | Solo mientras la tarea no esté completada. | 6 |
| RF_13 | Completar tarea | ✅ | Registra quién la completó y cuándo. | 6 |
| RF_14 | Eliminar tarea | ✅ | | 6 |
| RF_15 | Actividades del día | ✅ | Agrega métricas y un aviso de alertas. | 2 |
| RF_16 | Calendario general | ✅ | Vista mensual navegable con eventos y tareas. | 5 |
| RF_17 | Recepción de señales edge | ✅ (backend) | Endpoint `/edge/alertas` con API key y el ia-engine con YOLO. La detección de intrusos está pendiente de un modelo multiclase. En la app se ve como estado del dispositivo y alertas. | 8 |
| RF_18 | Notificaciones push | ❌ | El backend tiene el servicio (Firebase), pero desactivado (`PUSH_HABILITADO=false`), y la app **no integra Firebase Messaging**. La pantalla de destino (detalle de alerta) ya existe. | — |
| RF_19 | Historial de alertas | ⚠️ | Filtro por tipo ✅. **Filtro por rango de fechas: el backend lo soporta, pero la app no lo muestra.** | 8 |
| RF_20 | Registrar usuario | ✅ | Correo único; rol Productor o Trabajador. | 9 |
| RF_21 | Editar usuario | ✅ | Solo usuarios habilitados. | 9 |
| RF_22 | Inhabilitar usuario | ✅ | Revoca el acceso sin borrar su historial. | 9, 10 |

**Resumen:** 18 de 22 RF completos (82%), 3 parciales (RF_08, RF_11, RF_19) y 1 pendiente en la app (RF_18).

### Funcionalidades implementadas que el informe no describe

- Inicio de sesión con sesión persistente y pantalla de arranque. El informe lo menciona como interfaz de entrada (IF6), pero no tiene un RF propio.
- **Cámara en vivo** (HLS a través de MediaMTX), con renovación automática del permiso de visualización.
- **Marcar alerta como revisada** y contador de alertas sin leer en el Inicio.
- **Notas manuales** en la bitácora del animal.
- Listado de tareas con filtros por estado y tareas vinculadas a animales.
- RUT y teléfono opcionales en la ficha de usuario.
- Recordatorios programados de eventos y tareas (backend, IF4). Dependen de las push, así que tampoco llegan al teléfono todavía.
- Eliminación definitiva de un animal (ver la sección 5).

---

## 4. Requerimientos no funcionales que se notan en el video

| RNF | Qué se ve |
|---|---|
| RNF_03 Seguridad | Login obligatorio y roles validados en el backend (paso 10). Las contraseñas se guardan con bcrypt. |
| RNF_04 Usabilidad | Barra inferior de 5 pestañas y funciones a 3 toques o menos. |
| RNF_05 Compatibilidad | El video se graba en el build web con vista de teléfono; la app es Flutter y compila para Android e iOS. |
| RNF_08 Privacidad | *(opcional)* Entrar como `carmen@oviapp.cl` (otro predio) muestra un predio vacío. |
| RNF_02 Offline | No hay caché local en la app: sin conexión no muestra datos. Mejor no mencionarlo en el video. |

---

## 5. Puntos a tener claros antes de mostrar el video

1. **La eliminación definitiva de un animal contradice el informe.** RF_04 dice que el animal y su historial «se conservan de forma permanente para trazabilidad y cumplimiento normativo SAG», y RF_06 dice que las entradas de la bitácora «no pueden ser modificadas ni eliminadas». La función nueva borra la ficha y la bitácora completas (migración `20260924120000_eliminar_animal`). Hay dos caminos: no mostrarla (elige «Dejar inactivo» en el paso 7) o mostrarla y agregarla al informe como un cambio de alcance justificado.
2. **Pastor o Trabajador:** el informe usa «Pastor» en los RF y «Trabajador» en RF_20; la app usa «Trabajador». Conviene unificar el término en el informe.
3. **RF_18** es el único RF sin nada visible en la app. Si el profesor pregunta: el servicio de push está en el backend y el siguiente paso es integrar `firebase_messaging` en Flutter.

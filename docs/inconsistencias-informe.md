# Pendientes del informe: inconsistencias y secciones por redactar

Revisión del informe `docs/2026_2_CINF_FINAL_PT_CABR___Jamett_y_Saez.pdf` (compilado el 2026-11-04) contra el código del repositorio. La estructura de capítulos se comparó con el informe de Joaquín Maureira (mismo profesor guía), que está completo.

Cada inconsistencia trae una acción sugerida. En casi todas hay dos caminos: **corregir el informe** para que describa lo que se construyó, o **justificar el cambio** en el capítulo 7 (lo que se planificó, lo que se hizo y por qué). Lo segundo es lo que la comisión espera ver en un proyecto con Cascada: Maureira lo hace en 7.2 (retroalimentación de cada iteración) y en 7.4.3 (riesgos concretados).

---

## 1. Arquitectura y despliegue

- [ ] **Nube o LAN.** RNF-02 (3.5) dice que el servidor y la base de datos están "alojados en la nube", y 6.1 describe una sincronización entre un cache SQLite en la Raspberry Pi y PostgreSQL en la nube (write-behind). El código corre todo en la LAN del predio (Docker Compose: Postgres, backend, MediaMTX, ia-engine) y no tiene SQLite.
  *Acción:* reescribir RNF-02 y el último punto de 6.1. Explicar en 7.1 que se eligió una LAN local porque el predio no tiene internet confiable.
- [ ] **El informe se contradice a sí mismo.** La conclusión de factibilidad (4.1.4) dice que una sola Raspberry Pi 4 ejecuta el backend y la IA, y que "no se requiere hosting en la nube". RNF-02 dice lo contrario. Hay que elegir una versión y usarla en los capítulos 3, 4 y 6.
- [ ] **Hardware del módulo edge.** Las secciones 3.2(c), 4.1.1 (Tabla 4.3), 4.1.4, 6.1 e IF5-ENT especifican una Raspberry Pi 4. El ia-engine usa una imagen `nvidia/cuda` y reserva una GPU NVIDIA en el compose; una Pi no tiene CUDA.
  *Acción:* dos caminos. (a) Corregir el informe: el prototipo corre en un equipo con GPU, y la Pi queda como despliegue objetivo o como trabajo futuro, con su justificación. (b) Medir el rendimiento en CPU o en una Pi y dejarlo documentado. En cualquier caso, la Tabla 4.3 y el flujo de caja (hardware de producción) tienen que calzar con lo que se elija.
- [ ] **Versión del modelo YOLO.** 1.3.3 y 2.6 dicen YOLOv26, 6.1 dice YOLOv8-nano. El código usa `sheep_detection.pt` (una sola clase) y conserva `yolo26n.pt` como respaldo.
  *Acción:* unificar en todo el informe y declarar qué modelo es, de dónde salió y con qué datos se entrenó (objetivo específico 3).
- [ ] **TLS.** RNF-03 exige TLS 1.2 o superior entre la app, el servidor y el módulo edge. Hoy todo va por HTTP plano en la LAN.
  *Acción:* implementar TLS (por ejemplo, un proxy inverso con certificado local) o acotar RNF-03 a la LAN y dejarlo como trabajo futuro.
- [ ] **Desempeño en 4G.** RNF-01 mide la respuesta "bajo condiciones normales de red móvil (4G/LTE)". Si el sistema es LAN, la condición de medición cambia.

## 2. Notificaciones y tiempo real

- [ ] **Push implementado a medias.** RF_18, IF3-SAL e IF4-SAL piden push por FCM/APNs. El backend ya lo tiene (`firebase-admin`, `notificaciones/push.servicio.ts`, `dispositivos.rutas.ts`, `recordatorios.ts`), pero está apagado (`PUSH_HABILITADO: "false"` en el compose) y la app mobile no registra su token: `pubspec.yaml` no incluye `firebase_messaging`.
  *Acción:* terminar el lado mobile, o declarar en el informe que el canal está implementado en el servidor y pendiente en el cliente. Ojo: FCM necesita internet, y eso choca con la premisa de una LAN sin internet. Conviene explicitarlo.
- [ ] **WebSocket.** 6.1 dice que las alertas llegan "vía WebSocket por la red local". No hay WebSocket: la app consulta por REST (pull-to-refresh).
  *Acción:* corregir 6.1, o describir el polling como decisión de diseño.

## 3. Requerimientos e interfaces

- [ ] **Borrado definitivo de animales contra RF_04 y RF_06.** RF_04 dice que "el animal y todo su historial se conservan de forma permanente para trazabilidad y cumplimiento normativo SAG", y RF_06 que la bitácora no se elimina. El código expone `DELETE /animales/:id` (solo Productor) y la migración `20260924120000_eliminar_animal` borra la bitácora en cascada.
  *Acción:* es la inconsistencia más delicada, porque contradice el argumento SAG del capítulo 1. Hay que quitar la función o agregar un RF nuevo que la justifique y acote (por ejemplo, solo para registros creados por error).
- [ ] **`id_predio` en el cuerpo.** IF1-ENT e IF5-ENT incluyen `id_predio` entre los datos de entrada. El código, por diseño (RNF_08), lo toma del JWT o de la API key del dispositivo, nunca del cuerpo.
  *Acción:* sacar `id_predio` de esas interfaces y explicar por qué en 6.1 o en RNF_08.
- [ ] **IF2-ENT AtencionSanitaria** pide `{tipo_atencion, producto, dosis, ...}`. El código registra la atención sanitaria como un evento con tipo y descripción, sin producto ni dosis.
- [ ] **IF1-SAL FichaAnimal** promete `historial_pesajes[]` e `historial_sanitario[]`. No existen como estructuras: el peso es un campo del animal y la historia vive en la bitácora.
- [ ] **IF4-ENT Tarea** incluye `frecuencia` (tareas diarias o semanales). Las tareas no tienen recurrencia.
- [ ] **Video en vivo sin requerimiento.** El streaming HLS (`POST /streaming/token`, proxy autenticado a MediaMTX, reproductor en la app) está construido pero no aparece en ningún RF, IF ni caso de uso.
  *Acción:* agregar un RF (por ejemplo, RF_23 "Ver cámara en vivo") con su IF de salida y su fila en la matriz de trazabilidad.
- [ ] **Médico veterinario.** Aparece como usuario en 1.5.1, en los límites (3.1 f) y en la actividad 2.3 del objetivo 2, pero no en la Tabla 3.1 ni en el sistema (solo existen Productor y Trabajador).
  *Acción:* sacarlo de 3.1(f) y de la actividad 2.3, o dejar claro que es un actor del dominio y no un usuario del sistema.
- [ ] **Rol "Pastor" o "Trabajador".** El informe alterna los dos nombres, incluso dentro de la Tabla 3.1. El código usa `TRABAJADOR`. Elegir uno.

## 4. Modelo de datos (6.2)

- [ ] **Faltan entidades que existen en `schema.prisma`:** `Predio` (raíz del multi-predio, RNF_07 y RNF_08), `DispositivoEdge` (emisor de IF5-ENT), `DispositivoUsuario` (tokens push) y `RefreshToken`.
- [ ] **`Nota_bitacora`.** El informe la describe como notas escritas a mano. El código la reemplazó por `BitacoraEntrada`, que une las entradas automáticas de RF_06 con las notas manuales (tipo `NOTA`) y es append-only por trigger.
- [ ] **`Animal`.** El informe usa `Id_productor`. El código usa `idPredio` y agrega `numeroOreja` (único por predio), `color`, `motivoBaja` y `fechaBaja`.
- [ ] **`Alerta`.** El informe no tiene `id_predio`, `conteo_animales`, `conteo_esperado` ni `id_dispositivo_edge`, pero RF_17 pide guardar la cantidad de ovejas detectadas.
- [ ] **Figura 6.1** tiene el pie "Enter Caption". Falta el modelo relacional, que Maureira presenta en una subsección propia (6.2.3) después del MER.
- [ ] **Referencia rota.** El encabezado de `backend/prisma/schema.prisma` cita `docs/PLAN_DESARROLLO.md` (hallazgos H2 a H13), que se borró en el commit `287cb4a3`. Hay que restaurarlo, quitar la referencia o mover los hallazgos al cap. 7 del informe.

## 5. Texto heredado de otra versión del proyecto

- [ ] **Gazebo, drones y simulación 3D.** Aparecen en la Tabla 2.1 (tamaño y complejidad del software), en la Tabla 4.5 (licencias) y en 1.3.3. No existen en el repositorio. Eliminarlos o explicar que se descartaron.
- [ ] **Metodología.** La sección 1.7 dice "Cascada con reducción de riesgos" y la 2.2 solo "Cascada". Unificar el nombre y justificarlo como lo hace Maureira en su 2.3: la tabla de riesgo lleva a la elección del modelo.
- [ ] **"Composición del informe" (1.7)** describe 4 capítulos con otra numeración: dice que la factibilidad está en el cap. 2 y el análisis en el cap. 4. Reescribirla para los 9 capítulos reales.

## 6. Errores de edición sueltos

- [ ] 1.1.1: "trazabilidaUnderfulld" (se coló un aviso de LaTeX en el texto).
- [ ] Tabla 4.6 (hosting y dominio) con "XX". Si el sistema es LAN, la tabla cambia de sentido: reemplazarla por el costo del hardware del predio.
- [ ] 4.1.3: "el VAN obtenido es positivo ($ )" no tiene cifra. Además, "Los 6.050.000 CLP de beneficios no son un costo" mezcla inversión y beneficio. Conviene rehacer el flujo de caja con el criterio de Maureira (4.3.1): explicar de dónde sale cada fila y qué ahorro representa.
- [ ] 4.1.3: "Calculo del VAN con una tasa de descuento del 10" (falta el "%").
- [ ] Tabla 5.1 tiene el pie "Calculo costo de desarrollo y soporte." (copiado de la Tabla 4.7).
- [ ] Tabla 3.4: el encabezado "IdentificadorÑteommbre del" está corrupto. Lo mismo pasa en la Tabla 3.5.
- [ ] Referencias cruzadas corridas en 3.5, 3.6 y 3.7 ("véase la Tabla 3.2" para los RNF, que están en la 3.3, y así sucesivamente).
- [ ] La Tabla 4.3 especifica "Ubuntu server 26.04 LTS" y la 4.1 "Windows 11"; revisar que calcen con el despliegue real (Docker).

---

## 7. Secciones por redactar (formato de la universidad)

El informe de Maureira sirve de modelo para cada una. Lo que él incluye y aquí falta:

- [ ] **Resumen** (1 página): problema, solución construida con su stack, cuántos RF se implementaron y verificaron, y beneficios esperados. Palabras clave.
- [ ] **Agradecimientos.**
- [ ] **Acrónimos**: lista alfabética (API, edge, HLS, JWT, RTSP, SAG, FMA, YOLO, etc.).
- [ ] **6.4 Diseño de arquitectura.** Maureira lo pone al final del capítulo 6, con la configuración inicial del entorno, la arquitectura final (vista lógica) y la justificación de cada decisión. Aquí va el diagrama cámara → MediaMTX → ia-engine → backend → Postgres → app, la decisión LAN y Docker, MediaMTX sin puertos publicados y el proxy autenticado.
- [ ] **Cap. 7 Desarrollo del trabajo** (hoy es la plantilla):
  - [ ] 7.1 Estructura del código: tabla de directorios del backend (`src/modules/<x>/` con rutas, controlador, servicio y esquemas), del mobile (`lib/features/<x>/{datos,pantallas,widgets}`, `core/`) y del ia-engine, con el flujo típico de una petición.
  - [ ] Endpoints con el formato de la plantilla: URL, método y parámetros con tipo, si es requerido y sus restricciones. Maureira deja 5 en el cap. 7 y el catálogo completo en un apéndice ("Funcionalidad-endpoints").
  - [ ] 7.2 Iteraciones: qué se construyó en cada una, cuándo y qué retroalimentación hubo. Aquí caben bien los cambios de rumbo: el modelo COCO reemplazado por `sheep_detection.pt`, el conteo por máximo de la ventana, la confianza bajada de 0.5 a 0.35, el token de stream por query porque AVPlayer no reenvía headers, la reescritura del playlist HLS.
  - [ ] 7.3 Riesgos de alto nivel: tabla de probabilidad, impacto y estrategia, y cuáles se concretaron.
  - [ ] 7.4 Retrospectiva: cumplimiento por objetivo, éxito o fracaso, riesgos concretados, planificado contra real.
  - [ ] 7.5 Pruebas de aceptación: checklists por perfil (Productor y Trabajador) con el RF y el CU de cada fila. Se pueden apoyar en la suite de vitest del backend.
- [ ] **Cap. 8 Implantación y puesta en marcha:** plan de capacitación por perfil, plan de entrenamiento por fases, estrategia elegida y justificada (piloto en un predio parece lo natural), preparación de datos y Gantt de la puesta en marcha. Si no hay predio real, decirlo: Maureira explica que su puesta en producción ocurre después de la titulación.
- [ ] **Cap. 9 Conclusiones:** logro de cada objetivo específico (y hasta dónde llegó la validación en terreno), tiempo estimado contra real, competencias del perfil de la carrera, opinión personal y trabajo futuro.
- [ ] **Apéndices:**
  - [ ] A. Definiciones del negocio (encaste, esquila, parición, capón, FMA, SAG, potrero, condición corporal) y términos técnicos.
  - [ ] B. Pruebas de aceptación, si no van en 7.5.
  - [ ] C. Recopilación de información: las conversaciones con lugareños de Chiloé que se citan en 4.1.2, con a quién, cuándo, para qué y qué se obtuvo.
  - [ ] D. Diccionario de datos: una tabla por entidad con campo, tipo, nulo y descripción (Maureira, apéndice F). Se puede generar desde `schema.prisma`.
  - [ ] E. Gestión: Gantt base y Gantt real con desviaciones, estimación por puntos de casos de uso (UAW, UUCW, TCF, EF, UCP, LOE) y resumen de horas por fase y por tipo de actividad.
  - [ ] Casos de uso restantes: el cap. 5 especifica 11 casos y la matriz de trazabilidad nombra CU_01 a CU_22. Faltan las especificaciones (Maureira las deja en un apéndice) y una tabla con la lista completa de CU.

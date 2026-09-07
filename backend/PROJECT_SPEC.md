# Especificación del Proyecto - Servidor Backend

## 1. Descripción General
El backend actúa como el núcleo central del sistema, gestionando la lógica de negocio, la persistencia de datos y la comunicación entre la aplicación móvil y el servidor de IA (Edge Computing).

## 2. Tecnologías
- **Entorno de Ejecución:** Node.js
- **Base de Datos:** PostgreSQL
- **Despliegue:** Ubuntu Server (Docker)
- **Seguridad:** JWT para autenticación, TLS 1.2+, bcrypt/argon2 para contraseñas.

## 3. Modelo de Datos (Entidades Clave)
- `Usuario`: id, nombre, rut, teléfono, email, rol, estado.
- `Animal`: id, productor_id, sexo, raza, peso, fecha_nacimiento, estado.
- `Nota_bitacora`: Registro cronológico por animal.
- `Evento_calendarizado` / `Tarea_predio`: Planificación de actividades.
- `Alerta`: Registro de eventos detectados por IA (conteo, dispersión, intrusos).

## 4. Endpoints y Servicios (API REST)
- **Autenticación:** `/auth/login`, `/auth/register` (solo Productor).
- **Gestión de Rebaño:** `/api/animales` (CRUD), `/api/bitacora`.
- **Planificación:** `/api/eventos`, `/api/tareas`.
- **Integración Edge Computing:** Endpoint para recibir alertas (`POST /api/alertas`) desde la Raspberry Pi.
- **Notificaciones Push:** Servicio para despachar notificaciones a los dispositivos móviles (vía FCM/APNs).

## 5. Requerimientos No Funcionales
- **Escalabilidad:** Arquitectura capaz de soportar múltiples predios y dispositivos Edge sin cambios estructurales.
- **Seguridad:** Endpoints protegidos según rol de usuario.
- **Integridad:** Trazabilidad de cada cambio en la base de datos.

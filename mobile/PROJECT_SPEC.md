# Especificación del Proyecto - Aplicación Móvil (Frontend)

## 1. Descripción General
La aplicación móvil "OviApp" es la interfaz principal para la gestión administrativa y monitoreo de predios ganaderos ovinos. Permite a productores y pastores gestionar el rebaño, planificar tareas, y recibir alertas en tiempo real sobre situaciones anómalas.

## 2. Tecnologías
- **Framework:** Flutter
- **Lenguaje:** Dart
- **Plataformas:** Android 10+ e iOS 14+
- **Diseño:** Minimalista y funcional para entornos rurales. Tipografía: Poppins/Inter. Colores principales: Tonos azules (Primary #2050F0).

## 3. Usuarios y Roles
- **Productor:** Acceso total (CRUD de animales, usuarios, tareas, eventos, visualización de alertas).
- **Trabajador (Pastor):** Acceso limitado (lectura de fichas, registro de actividades diarias, marcar tareas completadas).

## 4. Módulos Principales (Requerimientos Funcionales)
1. **Autenticación:** Login con correo y contraseña. Soporte de JWT.
2. **Pantalla de Inicio (Dashboard):** Resumen del día con tareas activas y eventos próximos.
3. **Módulo Ficha Animal:** CRUD de animales (ID, sexo, raza, peso, estado). Historial clínico y bitácora.
4. **Módulo Organizador / Calendario:** Planificación de eventos (encaste, esquila, visitas veterinarias) y tareas (revisión de cercos, etc.).
5. **Módulo de Vigilancia y Alertas:** Historial de alertas enviadas por el sistema de IA (conteo, dispersión, intrusos) y visualización de estado en vivo.
6. **Notificaciones Push:** Recepción de notificaciones sobre alertas del rebaño y recordatorios de eventos.

## 5. Requerimientos No Funcionales
- **Usabilidad:** Interfaz intuitiva, aprendizaje en < 15 min.
- **Rendimiento:** Tiempos de respuesta < 3 seg en redes 4G/LTE.
- **Disponibilidad Offline:** Sincronización y persistencia local (SQLite) para zonas sin conexión.

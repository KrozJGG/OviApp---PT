import 'package:flutter/material.dart';

/// Paleta corporativa de OviApp.
///
/// Los valores salen de la guia de colores de la tesis (seccion 6.3.3). Se
/// declaran una sola vez aqui: ninguna pantalla debe escribir un color literal.
abstract final class OviColores {
  /// Azul brillante: botones principales, encabezados, navegacion activa.
  static const primary = Color(0xFF2050F0);

  /// Azul oscuro: barra de estado, secciones destacadas, texto de alto contraste.
  static const primaryDark = Color(0xFF061991);

  /// Azul claro: estados hover, bordes activos, elementos secundarios.
  static const primaryLight = Color(0xFF4F75F7);

  /// Azul muy claro: fondo general de las pantallas.
  static const superficie = Color(0xFFEEF2FE);

  /// Azul pastel: cards, secciones agrupadas, areas de contenido diferenciadas.
  static const superficieSecundaria = Color(0xFFD5DFFE);

  /// Indigo: enlaces, chips interactivos, atencion secundaria.
  static const acento = Color(0xFF6366F1);

  /// Verde: confirmaciones, estados activos, chips positivos.
  static const exito = Color(0xFF22C55E);

  /// Coral-rojo: alertas criticas, eliminacion, vigilancia urgente.
  static const peligro = Color(0xFFFF6347);

  /// Negro azulado: todo el texto principal.
  static const textoPrimario = Color(0xFF1A1A2E);

  /// Gris medio: texto complementario, placeholders, metadata.
  static const textoSecundario = Color(0xFF6B7280);

  /// Blanco de las tarjetas sobre el fondo azulado.
  static const tarjeta = Color(0xFFFFFFFF);

  /// Separadores y bordes de baja jerarquia.
  static const borde = Color(0xFFE2E8FA);

  // ── Colores de estado usados por chips y alertas ────────────────────────────
  // Estos NO son la marca: codifican significado. El ambar existe porque las
  // alertas de dispersion del mockup 10 no son criticas pero tampoco normales.

  static const advertencia = Color(0xFFF59E0B);
  static const exitoFondo = Color(0xFFE4F7EC);
  static const peligroFondo = Color(0xFFFEECE8);
  static const advertenciaFondo = Color(0xFFFDF3E2);
  static const neutroFondo = Color(0xFFF1F3F9);
}

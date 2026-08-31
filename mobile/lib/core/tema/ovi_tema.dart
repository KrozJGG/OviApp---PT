import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import 'ovi_colores.dart';

/// Tema unico de la aplicacion.
///
/// La jerarquia tipografica sigue la seccion 6.3.4 de la tesis. Se usa Inter y
/// no Poppins porque es la de los mockups renderizados y se lee mejor en los
/// 12-13 px del texto secundario de las tarjetas.
///
/// Las medidas tactiles no son decorativas: RNF_04 exige que la app la opere
/// alguien con guantes y a pleno sol, asi que ningun control baja de 48 dp.
abstract final class OviTema {
  static const double radioTarjeta = 16;
  static const double radioControl = 12;
  static const double alturaMinimaControl = 48;
  static const double espacio = 16;

  static ThemeData claro() {
    final base = ThemeData(
      useMaterial3: true,
      colorScheme: const ColorScheme.light(
        primary: OviColores.primary,
        onPrimary: Colors.white,
        primaryContainer: OviColores.superficieSecundaria,
        onPrimaryContainer: OviColores.primaryDark,
        secondary: OviColores.acento,
        onSecondary: Colors.white,
        error: OviColores.peligro,
        onError: Colors.white,
        surface: OviColores.tarjeta,
        onSurface: OviColores.textoPrimario,
        surfaceContainerLowest: Colors.white,
        surfaceContainerLow: OviColores.superficie,
        outline: OviColores.borde,
      ),
      scaffoldBackgroundColor: OviColores.superficie,
      splashFactory: InkSparkle.splashFactory,
    );

    final texto = GoogleFonts.interTextTheme(base.textTheme).apply(
      bodyColor: OviColores.textoPrimario,
      displayColor: OviColores.textoPrimario,
    );

    return base.copyWith(
      textTheme: texto.copyWith(
        // Titulos de seccion y nombres de modulo: 20-28 px Bold.
        headlineMedium: texto.headlineMedium?.copyWith(
          fontSize: 28,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.5,
        ),
        headlineSmall: texto.headlineSmall?.copyWith(
          fontSize: 24,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.3,
        ),
        titleLarge: texto.titleLarge?.copyWith(fontSize: 20, fontWeight: FontWeight.w700),
        // Encabezados de card y nombres de campo: 16-18 px SemiBold.
        titleMedium: texto.titleMedium?.copyWith(fontSize: 17, fontWeight: FontWeight.w600),
        titleSmall: texto.titleSmall?.copyWith(fontSize: 15, fontWeight: FontWeight.w600),
        // Cuerpo: 14-16 px Regular.
        bodyLarge: texto.bodyLarge?.copyWith(fontSize: 16, height: 1.45),
        bodyMedium: texto.bodyMedium?.copyWith(fontSize: 14.5, height: 1.45),
        // Secundario: 12-13 px gris.
        bodySmall: texto.bodySmall?.copyWith(
          fontSize: 12.5,
          color: OviColores.textoSecundario,
          height: 1.35,
        ),
        labelLarge: texto.labelLarge?.copyWith(fontSize: 15, fontWeight: FontWeight.w500),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: OviColores.superficie,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: texto.headlineSmall?.copyWith(
          fontSize: 24,
          fontWeight: FontWeight.w700,
          color: OviColores.textoPrimario,
        ),
        iconTheme: const IconThemeData(color: OviColores.textoPrimario),
        systemOverlayStyle: SystemUiOverlayStyle.dark,
      ),
      cardTheme: CardThemeData(
        color: OviColores.tarjeta,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radioTarjeta),
          side: const BorderSide(color: OviColores.borde),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: OviColores.primary,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(alturaMinimaControl),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(radioControl)),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: OviColores.primary,
          minimumSize: const Size.fromHeight(alturaMinimaControl),
          side: const BorderSide(color: OviColores.primaryLight),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(radioControl)),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: OviColores.primary,
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        hintStyle: const TextStyle(color: OviColores.textoSecundario, fontSize: 15),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radioControl),
          borderSide: const BorderSide(color: OviColores.borde),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radioControl),
          borderSide: const BorderSide(color: OviColores.borde),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radioControl),
          borderSide: const BorderSide(color: OviColores.primary, width: 1.6),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radioControl),
          borderSide: const BorderSide(color: OviColores.peligro),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radioControl),
          borderSide: const BorderSide(color: OviColores.peligro, width: 1.6),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        indicatorColor: Colors.transparent,
        elevation: 0,
        height: 68,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        iconTheme: WidgetStateProperty.resolveWith(
          (estados) => IconThemeData(
            size: 24,
            color: estados.contains(WidgetState.selected)
                ? OviColores.primary
                : OviColores.textoSecundario,
          ),
        ),
        labelTextStyle: WidgetStateProperty.resolveWith(
          (estados) => TextStyle(
            fontSize: 11.5,
            fontWeight: estados.contains(WidgetState.selected) ? FontWeight.w600 : FontWeight.w500,
            color: estados.contains(WidgetState.selected)
                ? OviColores.primary
                : OviColores.textoSecundario,
          ),
        ),
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: OviColores.primary,
        foregroundColor: Colors.white,
        elevation: 3,
      ),
      chipTheme: ChipThemeData(
        backgroundColor: Colors.white,
        selectedColor: OviColores.primary,
        side: const BorderSide(color: OviColores.borde),
        labelStyle: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w500),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      ),
      dividerTheme: const DividerThemeData(color: OviColores.borde, thickness: 1, space: 1),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: OviColores.textoPrimario,
        contentTextStyle: const TextStyle(color: Colors.white, fontSize: 14.5),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(radioControl)),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      ),
      listTileTheme: const ListTileThemeData(
        minVerticalPadding: 12,
        iconColor: OviColores.textoSecundario,
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(color: OviColores.primary),
    );
  }
}

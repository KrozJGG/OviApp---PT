import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'core/router/rutas.dart';
import 'core/tema/ovi_tema.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  // Nombres de meses y dias en español: la app se usa en el sur de Chile y no
  // hay ninguna pantalla en ingles.
  initializeDateFormatting('es');

  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ),
  );

  runApp(const ProviderScope(child: OviApp()));
}

class OviApp extends ConsumerWidget {
  const OviApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: 'OviApp',
      debugShowCheckedModeBanner: false,
      theme: OviTema.claro(),
      routerConfig: ref.watch(routerProvider),
      // La app es monolingue: se fija el español en vez de seguir el idioma del
      // telefono, igual que los textos escritos a mano de las pantallas.
      locale: const Locale('es'),
      supportedLocales: const [Locale('es')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      // El diseño esta calculado para textos hasta 1.3x: mas alla, las tarjetas
      // del resumen del dia se desbordan. Se respeta la preferencia del sistema
      // dentro de ese rango en lugar de ignorarla.
      builder: (context, hijo) {
        final escala = MediaQuery.textScalerOf(context).clamp(
          minScaleFactor: 1,
          maxScaleFactor: 1.3,
        );
        return MediaQuery(
          data: MediaQuery.of(context).copyWith(textScaler: escala),
          child: hijo!,
        );
      },
    );
  }
}

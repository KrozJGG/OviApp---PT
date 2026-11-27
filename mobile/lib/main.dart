import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'core/alertas_tiempo_real/coordinador_alertas_realtime.dart';
import 'core/router/rutas.dart';
import 'core/tema/ovi_tema.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
    FlutterForegroundTask.initCommunicationPort();
  }

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

class OviApp extends ConsumerStatefulWidget {
  const OviApp({super.key});

  @override
  ConsumerState<OviApp> createState() => _OviAppState();
}

class _OviAppState extends ConsumerState<OviApp> {
  StreamSubscription<String>? _subNotificaciones;

  @override
  void initState() {
    super.initState();
    final notificaciones = ref.read(notificacionesLocalesProvider);
    _subNotificaciones = notificaciones.alTocarRuta.listen(_navegarDesdeNotificacion);
    unawaited(_revisarLanzamientoDesdeNotificacion());
  }

  Future<void> _revisarLanzamientoDesdeNotificacion() async {
    final ruta = await ref
        .read(notificacionesLocalesProvider)
        .rutaDeLanzamientoInicial();
    if (ruta != null && mounted) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _navegarDesdeNotificacion(ruta);
      });
    }
  }

  void _navegarDesdeNotificacion(String ruta) {
    final router = ref.read(routerProvider);
    if (ruta == '/vigilancia') {
      router.goNamed(Rutas.vigilancia);
    } else {
      router.go(ruta);
    }
  }

  @override
  void dispose() {
    _subNotificaciones?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Mantiene vivo el coordinador de alertas en tiempo real mientras exista sesion.
    ref.watch(coordinadorAlertasProvider);

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

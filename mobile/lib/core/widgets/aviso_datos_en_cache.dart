import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../tema/ovi_colores.dart';

/// Aviso fijo que se muestra mientras la app enseña datos del caché.
///
/// Sin esto, el caché seria peligroso: el usuario creeria estar viendo el
/// estado actual del rebaño cuando en realidad es el de la ultima vez que hubo
/// señal. Por eso siempre dice a que hora se obtuvo lo que se ve.
class AvisoDatosEnCache extends StatelessWidget {
  const AvisoDatosEnCache({super.key, required this.guardadoEn});

  /// Se escucha un `ValueNotifier<DateTime?>`: `null` oculta el aviso.
  final ValueListenable<DateTime?> guardadoEn;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<DateTime?>(
      valueListenable: guardadoEn,
      builder: (context, momento, _) {
        if (momento == null) return const SizedBox.shrink();

        final hora = DateFormat("d MMM, HH:mm", 'es').format(momento.toLocal());

        return Semantics(
          liveRegion: true,
          child: Container(
            width: double.infinity,
            color: OviColores.peligroFondo,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                const Icon(Icons.wifi_off_rounded, size: 18, color: OviColores.peligro),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Sin conexión · datos del $hora',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: OviColores.textoPrimario,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}


import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../red/cliente_api.dart';
import '../red/error_api.dart';
import '../tema/ovi_colores.dart';

/// Renderiza los cuatro estados de una pantalla que depende de la red:
/// cargando, error, vacio y con datos.
///
/// Existe para que ninguna pantalla se olvide de alguno. RNF_04 pide que la app
/// se entienda sin capacitacion, y una pantalla en blanco cuando no hay datos o
/// cuando fallo la red es exactamente lo que hace que alguien crea que la app
/// esta rota.
class OviAsync<T> extends StatelessWidget {
  const OviAsync({
    super.key,
    required this.valor,
    required this.enDatos,
    this.estaVacio,
    this.vacio,
    this.alReintentar,
  });

  final AsyncValue<T> valor;
  final Widget Function(T datos) enDatos;

  /// Permite tratar una lista vacia como "sin resultados" y no como datos.
  final bool Function(T datos)? estaVacio;
  final Widget? vacio;
  final VoidCallback? alReintentar;

  @override
  Widget build(BuildContext context) {
    return valor.when(
      loading: () => const OviCargando(),
      error: (e, _) => OviEstadoError(error: comoErrorApi(e), alReintentar: alReintentar),
      data: (datos) {
        if (estaVacio?.call(datos) ?? false) {
          return vacio ?? const OviEstadoVacio(mensaje: 'Todavía no hay nada por aquí.');
        }
        return enDatos(datos);
      },
    );
  }
}

class OviCargando extends StatelessWidget {
  const OviCargando({super.key, this.mensaje});

  final String? mensaje;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(
            width: 32,
            height: 32,
            child: CircularProgressIndicator(strokeWidth: 3),
          ),
          if (mensaje != null) ...[
            const SizedBox(height: 16),
            Text(mensaje!, style: Theme.of(context).textTheme.bodySmall),
          ],
        ],
      ),
    );
  }
}

class OviEstadoVacio extends StatelessWidget {
  const OviEstadoVacio({
    super.key,
    required this.mensaje,
    this.detalle,
    this.icono = Icons.inbox_outlined,
    this.accion,
  });

  final String mensaje;
  final String? detalle;
  final IconData icono;
  final Widget? accion;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: const BoxDecoration(
                color: OviColores.superficieSecundaria,
                shape: BoxShape.circle,
              ),
              child: Icon(icono, size: 30, color: OviColores.primary),
            ),
            const SizedBox(height: 20),
            Text(
              mensaje,
              textAlign: TextAlign.center,
              style: texto.titleSmall?.copyWith(color: OviColores.textoPrimario),
            ),
            if (detalle != null) ...[
              const SizedBox(height: 8),
              Text(detalle!, textAlign: TextAlign.center, style: texto.bodySmall),
            ],
            if (accion != null) ...[const SizedBox(height: 20), accion!],
          ],
        ),
      ),
    );
  }
}

class OviEstadoError extends StatelessWidget {
  const OviEstadoError({super.key, required this.error, this.alReintentar});

  final ErrorApi error;
  final VoidCallback? alReintentar;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: const BoxDecoration(
                color: OviColores.peligroFondo,
                shape: BoxShape.circle,
              ),
              child: Icon(
                error.esDeRed ? Icons.wifi_off_rounded : Icons.error_outline_rounded,
                size: 30,
                color: OviColores.peligro,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              error.mensaje,
              textAlign: TextAlign.center,
              style: texto.titleSmall?.copyWith(color: OviColores.textoPrimario),
            ),
            if (alReintentar != null) ...[
              const SizedBox(height: 20),
              OutlinedButton.icon(
                onPressed: alReintentar,
                icon: const Icon(Icons.refresh_rounded, size: 20),
                label: const Text('Reintentar'),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(180, OviTemaMedidas.alturaControl),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Medidas usadas por widgets que no pueden leer el tema (constructores const).
abstract final class OviTemaMedidas {
  static const double alturaControl = 48;
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/formato.dart';
import '../../../core/router/rutas.dart';
import '../../../core/tema/ovi_colores.dart';
import '../../../core/widgets/ovi_estados.dart';
import '../../../core/widgets/ovi_widgets.dart';
import '../datos/alerta.dart';
import '../vigilancia_proveedores.dart';

/// Pantalla 10 — Vigilancia del rebaño (IF2-SAL).
///
/// Muestra lo que detecta la cámara: el ia-engine envía cada pocos segundos la
/// cantidad de ovejas detectadas, y aquí se compara con las ovejas activas que
/// el usuario tiene registradas.
class PantallaVigilancia extends ConsumerWidget {
  const PantallaVigilancia({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final estado = ref.watch(estadoVigilanciaProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Row(
          children: [
            Icon(Icons.videocam_rounded, color: OviColores.primary),
            SizedBox(width: 10),
            Text('Vigilancia del rebaño'),
          ],
        ),
        titleSpacing: 20,
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(estadoVigilanciaProvider),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
          children: [
            OviAsync<EstadoVigilancia>(
              valor: estado,
              alReintentar: () => ref.invalidate(estadoVigilanciaProvider),
              enDatos: (e) => _TarjetaEstado(estado: e),
            ),
          ],
        ),
      ),
    );
  }
}

/// Estado del dispositivo: si está en línea, cuándo detectó por última vez y
/// cuántas ovejas vio frente a las activas registradas.
class _TarjetaEstado extends StatelessWidget {
  const _TarjetaEstado({required this.estado});

  final EstadoVigilancia estado;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    final d = estado.principal;

    if (d == null) {
      return const OviEstadoVacio(
        mensaje: 'No hay cámaras registradas',
        detalle: 'El predio todavía no tiene un dispositivo de detección asociado.',
        icono: Icons.videocam_off_outlined,
      );
    }

    return OviTarjeta(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(d.nombre, style: texto.titleMedium)),
              OviChip(
                texto: d.enLinea ? 'En línea' : 'Sin señal',
                tono: d.enLinea ? TonoChip.exito : TonoChip.neutro,
                icono: d.enLinea
                    ? Icons.circle
                    : Icons.signal_wifi_statusbar_null_rounded,
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _Dato(
                  etiqueta: 'Última detección',
                  valor: d.ultimoHeartbeat == null
                      ? 'Sin datos'
                      : Fmt.hace(d.ultimoHeartbeat!),
                ),
              ),
              Expanded(
                child: _Dato(
                  etiqueta: 'Ovejas detectadas',
                  valor: d.ultimoConteo == null ? '—' : '${d.ultimoConteo}',
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          // Siempre disponible, incluso con el chip en "Sin señal": ese estado
          // dice que el módulo de detección dejó de latir, no que no haya
          // imagen — la cámara emite por otra vía. Si no hubiera video, lo
          // informa la propia pantalla al conectarse.
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => context.goNamed(
                Rutas.vigilanciaEnVivo,
                pathParameters: {'idDispositivo': d.id},
              ),
              icon: const Icon(Icons.play_circle_outline_rounded, size: 20),
              label: const Text('Ver en vivo'),
            ),
          ),
        ],
      ),
    );
  }
}

class _Dato extends StatelessWidget {
  const _Dato({required this.etiqueta, required this.valor});

  final String etiqueta;
  final String valor;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(etiqueta, style: texto.bodySmall),
        const SizedBox(height: 2),
        Text(valor, style: texto.titleSmall),
      ],
    );
  }
}

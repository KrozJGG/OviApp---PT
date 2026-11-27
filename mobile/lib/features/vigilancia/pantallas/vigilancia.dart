import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/formato.dart';
import '../../../core/router/rutas.dart';
import '../../../core/tema/ovi_colores.dart';
import '../../../core/widgets/ovi_estados.dart';
import '../../../core/widgets/ovi_widgets.dart';
import '../../auth/sesion.dart';
import '../datos/alerta.dart';
import '../vigilancia_proveedores.dart';
import '../widgets/banner_alerta_pendiente.dart';

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
    final alertasPendientes = ref.watch(alertasPendientesProvider);
    final esProductor = ref.watch(esProductorProvider);

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
        actions: [
          IconButton(
            tooltip: 'Historial de alertas',
            onPressed: () => context.goNamed(Rutas.vigilanciaAlertas),
            icon: const Icon(Icons.history_rounded),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(estadoVigilanciaProvider);
          ref.invalidate(alertasPendientesProvider);
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
          children: [
            if (alertasPendientes.valueOrNull case final pendientes?
                when pendientes.isNotEmpty)
              for (final alerta in pendientes)
                BannerAlertaPendiente(alerta: alerta),
            OviAsync<EstadoVigilancia>(
              valor: estado,
              alReintentar: () => ref.invalidate(estadoVigilanciaProvider),
              enDatos: (e) => _TarjetaEstado(estado: e, esProductor: esProductor),
            ),
            const SizedBox(height: 16),
            OviTarjeta(
              alTocar: () => context.goNamed(Rutas.vigilanciaAlertas),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: const BoxDecoration(
                      color: OviColores.superficieSecundaria,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.notifications_active_outlined,
                      color: OviColores.primary,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Historial de alertas',
                          style: Theme.of(context).textTheme.titleSmall,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Revisa alertas pasadas, filtros y quién las atendió',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  const Icon(
                    Icons.chevron_right_rounded,
                    color: OviColores.textoSecundario,
                  ),
                ],
              ),
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
  const _TarjetaEstado({required this.estado, required this.esProductor});

  final EstadoVigilancia estado;
  final bool esProductor;

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
          const SizedBox(height: 12),
          Row(
            children: [
              const Expanded(
                child: _Dato(
                  etiqueta: 'Zona de detección',
                  valor: '',
                  ocultarValor: true,
                ),
              ),
              OviChip(
                texto: d.resumenRoi,
                tono: d.tieneRoi ? TonoChip.info : TonoChip.neutro,
                icono: d.tieneRoi
                    ? Icons.crop_free_rounded
                    : Icons.fullscreen_rounded,
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
          if (esProductor) ...[
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: FilledButton.tonalIcon(
                onPressed: () => context.goNamed(
                  Rutas.vigilanciaEnVivo,
                  pathParameters: {'idDispositivo': d.id},
                  queryParameters: const {'editarRoi': 'true'},
                ),
                style: FilledButton.styleFrom(
                  backgroundColor: OviColores.superficieSecundaria,
                  foregroundColor: OviColores.primaryDark,
                  minimumSize: const Size.fromHeight(48),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  textStyle: const TextStyle(
                    fontSize: 15.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                icon: const Icon(Icons.crop_free_rounded, size: 20),
                label: const Text('Zona de detección'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _Dato extends StatelessWidget {
  const _Dato({
    required this.etiqueta,
    required this.valor,
    this.ocultarValor = false,
  });

  final String etiqueta;
  final String valor;
  final bool ocultarValor;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(etiqueta, style: texto.bodySmall),
        if (!ocultarValor) ...[
          const SizedBox(height: 2),
          Text(valor, style: texto.titleSmall),
        ],
      ],
    );
  }
}

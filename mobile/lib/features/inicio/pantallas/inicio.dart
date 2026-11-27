import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/formato.dart';
import '../../../core/router/rutas.dart';
import '../../../core/tema/ovi_colores.dart';
import '../../../core/widgets/fila_agenda.dart';
import '../../../core/widgets/ovi_estados.dart';
import '../../../core/widgets/ovi_widgets.dart';
import '../../auth/sesion.dart';
import '../../calendario/calendario_proveedores.dart';
import '../../calendario/datos/agenda.dart';

/// Pantalla 02 — Inicio (RF_15). Vista tipo dashboard.
///
/// Resume el día: las métricas del rebaño, la agenda de hoy y un acceso
/// directo a la vigilancia del rebaño.
class PantallaInicio extends ConsumerWidget {
  const PantallaInicio({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final resumen = ref.watch(resumenInicioProvider);
    final agenda = ref.watch(agendaDeHoyProvider);
    final usuario = ref.watch(usuarioActualProvider);
    final esProductor = ref.watch(esProductorProvider);
    final texto = Theme.of(context).textTheme;

    // El nombre de pila basta: el saludo se lee de un vistazo desde el campo.
    final nombrePila = (usuario?.nombre ?? '').split(' ').first;

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(resumenInicioProvider);
            ref.invalidate(agendaDeHoyProvider);
          },
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(Fmt.saludo(), style: texto.bodySmall),
                        Text(
                          nombrePila.isEmpty ? 'Hola' : 'Hola, $nombrePila',
                          style: texto.headlineSmall,
                        ),
                      ],
                    ),
                  ),
                  if (esProductor) ...[
                    IconButton.filledTonal(
                      onPressed: () => context.goNamed(Rutas.reportes),
                      tooltip: 'Reportes',
                      icon: const Icon(Icons.bar_chart_rounded),
                      style: IconButton.styleFrom(
                        backgroundColor: OviColores.superficieSecundaria,
                        foregroundColor: OviColores.primary,
                      ),
                    ),
                    const SizedBox(width: 8),
                  ],
                  IconButton.filledTonal(
                    onPressed: () => context.goNamed(Rutas.vigilancia),
                    tooltip: 'Vigilancia',
                    icon: const Icon(Icons.videocam_outlined),
                    style: IconButton.styleFrom(
                      backgroundColor: OviColores.superficieSecundaria,
                      foregroundColor: OviColores.primary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // ── Resumen de hoy ──────────────────────────────────────────
              OviAsync<ResumenInicio>(
                valor: resumen,
                alReintentar: () => ref.invalidate(resumenInicioProvider),
                enDatos: (r) => OviTarjeta(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const OviEncabezadoSeccion(titulo: 'Resumen de hoy'),
                      Row(
                        children: [
                          Expanded(
                            child: OviMetrica(
                              valor: '${r.animalesActivos}',
                              etiqueta: 'Animales\nactivos',
                              alTocar: () => context.goNamed(Rutas.rebano),
                            ),
                          ),
                          Expanded(
                            child: OviMetrica(
                              valor: '${r.tareasHoy}',
                              etiqueta: 'Tareas\nhoy',
                              color: OviColores.exito,
                              alTocar: () => context.goNamed(Rutas.tareas),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // ── Agenda de hoy ───────────────────────────────────────────
              OviEncabezadoSeccion(
                titulo: 'Agenda · Hoy',
                detalle: Fmt.diaSemanaCorto(DateTime.now()),
              ),
              OviAsync<List<ItemAgenda>>(
                valor: agenda,
                alReintentar: () => ref.invalidate(agendaDeHoyProvider),
                estaVacio: (lista) => lista.isEmpty,
                vacio: const Padding(
                  padding: EdgeInsets.only(top: 12),
                  child: OviEstadoVacio(
                    mensaje: 'Nada programado para hoy',
                    detalle: 'Los eventos y tareas del día aparecerán aquí.',
                    icono: Icons.event_available_outlined,
                  ),
                ),
                enDatos: (lista) => Column(
                  children: [
                    for (final item in lista)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: FilaAgenda(item: item),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

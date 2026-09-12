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
/// Resume el día: las tres métricas del rebaño, la agenda de hoy y un aviso si
/// hay alertas de vigilancia sin revisar.
class PantallaInicio extends ConsumerWidget {
  const PantallaInicio({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final resumen = ref.watch(resumenInicioProvider);
    final agenda = ref.watch(agendaDeHoyProvider);
    final usuario = ref.watch(usuarioActualProvider);
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
                  _BotonAlertas(
                    sinLeer: resumen.valueOrNull?.alertasSinLeer ?? 0,
                    alTocar: () => context.goNamed(Rutas.vigilancia),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // ── Resumen de hoy ──────────────────────────────────────────
              OviAsync<ResumenInicio>(
                valor: resumen,
                alReintentar: () => ref.invalidate(resumenInicioProvider),
                enDatos: (r) => Column(
                  children: [
                    OviTarjeta(
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
                              Expanded(
                                child: OviMetrica(
                                  valor: '${r.alertasSinLeer}',
                                  etiqueta: 'Alertas\nsin leer',
                                  color: r.alertasSinLeer > 0
                                      ? OviColores.peligro
                                      : OviColores.textoSecundario,
                                  alTocar: () => context.goNamed(Rutas.vigilancia),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),

                    // Aviso de vigilancia del mockup: solo si hay algo que ver.
                    if (r.alertasSinLeer > 0 && r.ultimaAlerta != null) ...[
                      const SizedBox(height: 12),
                      _AvisoVigilancia(
                        sinLeer: r.alertasSinLeer,
                        ultima: r.ultimaAlerta!,
                      ),
                    ],
                  ],
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

/// Campana con el contador de alertas sin revisar.
class _BotonAlertas extends StatelessWidget {
  const _BotonAlertas({required this.sinLeer, required this.alTocar});

  final int sinLeer;
  final VoidCallback alTocar;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        IconButton.filledTonal(
          onPressed: alTocar,
          tooltip: 'Vigilancia',
          icon: const Icon(Icons.notifications_none_rounded),
          style: IconButton.styleFrom(
            backgroundColor: OviColores.superficieSecundaria,
            foregroundColor: OviColores.primary,
          ),
        ),
        if (sinLeer > 0)
          Positioned(
            right: 2,
            top: 2,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
              constraints: const BoxConstraints(minWidth: 18),
              decoration: BoxDecoration(
                color: OviColores.peligro,
                borderRadius: BorderRadius.circular(9),
                border: Border.all(color: OviColores.superficie, width: 1.5),
              ),
              child: Text(
                sinLeer > 9 ? '9+' : '$sinLeer',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 10.5,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// Tarjeta roja del mockup: «2 alertas de vigilancia · Última: …».
class _AvisoVigilancia extends StatelessWidget {
  const _AvisoVigilancia({required this.sinLeer, required this.ultima});

  final int sinLeer;
  final AlertaResumida ultima;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;

    return OviTarjeta(
      color: OviColores.peligroFondo,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      alTocar: () => context.goNamed(Rutas.vigilancia),
      child: Row(
        children: [
          const Icon(Icons.warning_amber_rounded, color: OviColores.peligro),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$sinLeer ${sinLeer == 1 ? 'alerta' : 'alertas'} de vigilancia',
                  style: texto.titleSmall?.copyWith(color: const Color(0xFFC2381C)),
                ),
                const SizedBox(height: 1),
                Text(
                  'Última: ${Etiquetas.tipoAlerta(ultima.tipoAlerta).toLowerCase()}, '
                  '${Fmt.hora(ultima.fechaHora)}',
                  style: texto.bodySmall,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded, color: OviColores.peligro),
        ],
      ),
    );
  }
}

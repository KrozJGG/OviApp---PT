import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/formato.dart';
import '../../../core/red/error_api.dart';
import '../../../core/red/paginado.dart';
import '../../../core/tema/ovi_colores.dart';
import '../../../core/widgets/ovi_estados.dart';
import '../../../core/widgets/ovi_widgets.dart';
import '../datos/alerta.dart';
import '../vigilancia_proveedores.dart';

/// Historial completo de alertas de vigilancia del predio.
/// Accesible para PRODUCTOR y TRABAJADOR, con filtros por estado y rango de fechas.
class PantallaHistorialAlertas extends ConsumerStatefulWidget {
  const PantallaHistorialAlertas({super.key});

  @override
  ConsumerState<PantallaHistorialAlertas> createState() =>
      _PantallaHistorialAlertasState();
}

class _PantallaHistorialAlertasState
    extends ConsumerState<PantallaHistorialAlertas> {
  String? _estado;
  DateTime? _desde;
  DateTime? _hasta;
  int _pagina = 1;
  String? _actualizandoId;

  FiltroHistorialAlertas get _filtro => FiltroHistorialAlertas(
        estado: _estado,
        desde: _desde,
        hasta: _hasta,
        pagina: _pagina,
      );

  Future<void> _seleccionarRangoFechas() async {
    final ahora = DateTime.now();
    final inicial = (_desde != null && _hasta != null)
        ? DateTimeRange(start: _desde!, end: _hasta!)
        : DateTimeRange(
            start: ahora.subtract(const Duration(days: 7)),
            end: ahora,
          );

    final rango = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2024),
      lastDate: ahora.add(const Duration(days: 1)),
      initialDateRange: inicial,
      locale: const Locale('es'),
    );

    if (rango != null && mounted) {
      setState(() {
        _desde = rango.start;
        _hasta = rango.end;
        _pagina = 1;
      });
    }
  }

  void _limpiarFechas() {
    setState(() {
      _desde = null;
      _hasta = null;
      _pagina = 1;
    });
  }

  Future<void> _marcarEstado(AlertaVigilancia alerta, String estado) async {
    setState(() => _actualizandoId = alerta.id);
    try {
      await ref
          .read(vigilanciaRepositorioProvider)
          .cambiarEstadoAlerta(alerta.id, estado);
      if (!mounted) return;
      final txt = estado == 'RESUELTA' ? 'resuelta' : 'descartada';
      mostrarMensaje(context, 'Alerta marcada como $txt.');
    } on ErrorApi catch (e) {
      if (mounted) mostrarMensaje(context, e.mensaje, esError: true);
    } finally {
      if (mounted) setState(() => _actualizandoId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final historial = ref.watch(historialAlertasProvider(_filtro));
    final texto = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Historial de alertas'),
      ),
      body: Column(
        children: [
          // ── Filtros por estado y rango de fechas ──────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _ChipFiltroEstado(
                        etiqueta: 'Todas',
                        seleccionado: _estado == null,
                        alTocar: () => setState(() {
                          _estado = null;
                          _pagina = 1;
                        }),
                      ),
                      const SizedBox(width: 8),
                      _ChipFiltroEstado(
                        etiqueta: 'Pendientes',
                        seleccionado: _estado == 'PENDIENTE',
                        alTocar: () => setState(() {
                          _estado = 'PENDIENTE';
                          _pagina = 1;
                        }),
                      ),
                      const SizedBox(width: 8),
                      _ChipFiltroEstado(
                        etiqueta: 'Resueltas',
                        seleccionado: _estado == 'RESUELTA',
                        alTocar: () => setState(() {
                          _estado = 'RESUELTA';
                          _pagina = 1;
                        }),
                      ),
                      const SizedBox(width: 8),
                      _ChipFiltroEstado(
                        etiqueta: 'Descartadas',
                        seleccionado: _estado == 'DESCARTADA',
                        alTocar: () => setState(() {
                          _estado = 'DESCARTADA';
                          _pagina = 1;
                        }),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _seleccionarRangoFechas,
                        icon: const Icon(Icons.date_range_rounded, size: 18),
                        label: Text(
                          (_desde != null && _hasta != null)
                              ? '${Fmt.diaMes(_desde!)} – ${Fmt.diaMes(_hasta!)}'
                              : 'Filtrar por fechas',
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ),
                    if (_desde != null || _hasta != null) ...[
                      const SizedBox(width: 8),
                      IconButton(
                        tooltip: 'Limpiar fechas',
                        onPressed: _limpiarFechas,
                        icon: const Icon(Icons.close_rounded),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),

          // ── Listado paginado ──────────────────────────────────────────────
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async =>
                  ref.invalidate(historialAlertasProvider(_filtro)),
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
                children: [
                  OviAsync<Paginado<AlertaVigilancia>>(
                    valor: historial,
                    alReintentar: () =>
                        ref.invalidate(historialAlertasProvider(_filtro)),
                    estaVacio: (p) => p.estaVacio,
                    vacio: const Padding(
                      padding: EdgeInsets.only(top: 32),
                      child: OviEstadoVacio(
                        mensaje: 'Sin alertas registradas',
                        detalle:
                            'No hay alertas que coincidan con los filtros seleccionados.',
                        icono: Icons.notifications_none_rounded,
                      ),
                    ),
                    enDatos: (paginado) => Column(
                      children: [
                        for (final alerta in paginado.datos)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: _TarjetaAlertaHistorial(
                              alerta: alerta,
                              actualizando: _actualizandoId == alerta.id,
                              alResolver: () => _marcarEstado(alerta, 'RESUELTA'),
                              alDescartar: () =>
                                  _marcarEstado(alerta, 'DESCARTADA'),
                            ),
                          ),
                        if (paginado.meta.totalPaginas > 1)
                          Padding(
                            padding: const EdgeInsets.only(top: 8),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                TextButton.icon(
                                  onPressed: _pagina > 1
                                      ? () => setState(() => _pagina -= 1)
                                      : null,
                                  icon: const Icon(Icons.chevron_left_rounded),
                                  label: const Text('Anterior'),
                                ),
                                Text(
                                  'Página ${paginado.meta.pagina} de ${paginado.meta.totalPaginas}',
                                  style: texto.bodySmall,
                                ),
                                TextButton.icon(
                                  onPressed: paginado.hayMas
                                      ? () => setState(() => _pagina += 1)
                                      : null,
                                  icon: const Icon(Icons.chevron_right_rounded),
                                  label: const Text('Siguiente'),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ChipFiltroEstado extends StatelessWidget {
  const _ChipFiltroEstado({
    required this.etiqueta,
    required this.seleccionado,
    required this.alTocar,
  });

  final String etiqueta;
  final bool seleccionado;
  final VoidCallback alTocar;

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(
      label: Text(etiqueta),
      selected: seleccionado,
      onSelected: (_) => alTocar(),
    );
  }
}

class _TarjetaAlertaHistorial extends StatelessWidget {
  const _TarjetaAlertaHistorial({
    required this.alerta,
    required this.actualizando,
    required this.alResolver,
    required this.alDescartar,
  });

  final AlertaVigilancia alerta;
  final bool actualizando;
  final VoidCallback alResolver;
  final VoidCallback alDescartar;

  TonoChip _tonoEstado(String estado) => switch (estado) {
        'PENDIENTE' => TonoChip.peligro,
        'RESUELTA' => TonoChip.exito,
        'DESCARTADA' => TonoChip.neutro,
        _ => TonoChip.neutro,
      };

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;

    return OviTarjeta(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  Etiquetas.tipoAlerta(alerta.tipo),
                  style: texto.titleMedium,
                ),
              ),
              OviChip(
                texto: Etiquetas.estadoAlerta(alerta.estado),
                tono: _tonoEstado(alerta.estado),
              ),
            ],
          ),
          const SizedBox(height: 8),
          OviDato(
            etiqueta: 'Fecha y hora',
            valor: Fmt.fechaHora(alerta.fechaDeteccion),
            icono: Icons.schedule_rounded,
          ),
          OviDato(
            etiqueta: 'Conteo',
            valor:
                '${alerta.conteoDetectado} detectadas de ${alerta.conteoEsperado} esperadas',
            icono: Icons.pets_outlined,
          ),
          OviDato(
            etiqueta: 'Cámara',
            valor: alerta.dispositivo.nombre,
            icono: Icons.videocam_outlined,
          ),
          if (alerta.esNormalizada) ...[
            const SizedBox(height: 6),
            OviChip(
              texto:
                  'Normalizada a las ${Fmt.hora(alerta.normalizadaEn!)} · Posible oclusión',
              tono: TonoChip.advertencia,
              icono: Icons.info_outline_rounded,
            ),
          ],
          if (alerta.revisadoPor != null && alerta.fechaRevision != null) ...[
            const Divider(height: 20),
            Row(
              children: [
                const Icon(
                  Icons.person_outline_rounded,
                  size: 16,
                  color: OviColores.textoSecundario,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    '${Etiquetas.estadoAlerta(alerta.estado)} por ${alerta.revisadoPor!.nombre} · ${Fmt.fechaHora(alerta.fechaRevision!)}',
                    style: texto.bodySmall,
                  ),
                ),
              ],
            ),
          ],
          if (alerta.esPendiente) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: FilledButton.tonal(
                    onPressed: actualizando ? null : alResolver,
                    child: const Text('Resuelta'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton(
                    onPressed: actualizando ? null : alDescartar,
                    child: const Text('Descartada'),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

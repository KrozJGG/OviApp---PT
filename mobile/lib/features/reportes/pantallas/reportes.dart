import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/red/cliente_api.dart';
import '../../../core/tema/ovi_colores.dart';
import '../../../core/widgets/ovi_estados.dart';
import '../../../core/widgets/ovi_widgets.dart';
import '../datos/descargador_archivo.dart';
import '../datos/reporte.dart';
import '../reportes_proveedores.dart';
import '../widgets/graficos_reporte.dart';

/// Módulo 8 — Reportes y Paneles de Información (RF23, RF24).
///
/// Consolida variables productivas (inventario y bajas por mes/motivo),
/// sanitarias (eventos y cobertura), operativas (tareas cumplidas por mes y
/// responsable) y de vigilancia IA (discrepancias y desconexiones por mes),
/// con exportación en PDF y CSV exclusiva para el Productor.
class PantallaReportes extends ConsumerStatefulWidget {
  const PantallaReportes({super.key});

  @override
  ConsumerState<PantallaReportes> createState() => _PantallaReportesState();
}

class _PantallaReportesState extends ConsumerState<PantallaReportes> {
  bool _exportando = false;

  Future<void> _seleccionarRangoPersonalizado() async {
    final rangoActual = ref.read(rangoReporteProvider);
    final hoy = DateTime.now();
    final inicioActual = DateTime.tryParse(rangoActual.desde) ??
        DateTime(hoy.year, hoy.month - 5, 1);
    final finActual = DateTime.tryParse(rangoActual.hasta) ?? hoy;

    final elegido = await showDateRangePicker(
      context: context,
      locale: const Locale('es', 'CL'),
      firstDate: DateTime(hoy.year - 5, 1, 1),
      lastDate: DateTime(hoy.year + 1, 12, 31),
      initialDateRange: DateTimeRange(
        start: inicioActual,
        end: finActual.isBefore(inicioActual) ? inicioActual : finActual,
      ),
      helpText: 'Seleccionar período del reporte',
      saveText: 'Aplicar',
    );

    if (elegido == null || !mounted) return;

    if (elegido.end.difference(elegido.start).inDays + 1 > 366) {
      mostrarMensaje(
        context,
        'El rango del reporte no puede superar un año (366 días).',
        esError: true,
      );
      return;
    }

    String iso(DateTime d) =>
        '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

    ref.read(rangoReporteProvider.notifier).state = RangoReporte(
      desde: iso(elegido.start),
      hasta: iso(elegido.end),
      preset: PresetRango.personalizado,
    );
  }

  Future<void> _exportar(String formato) async {
    if (_exportando) return;
    setState(() => _exportando = true);

    try {
      final rango = ref.read(rangoReporteProvider);
      final archivo = await ref
          .read(reportesRepositorioProvider)
          .exportar(rango: rango, formato: formato);
      final resultado = await guardarArchivoExportado(
        bytes: archivo.bytes,
        nombreArchivo: archivo.nombreArchivo,
        tipoMime: archivo.tipoMime,
      );
      if (mounted) {
        mostrarMensaje(context, resultado);
      }
    } catch (e) {
      if (mounted) {
        mostrarMensaje(context, comoErrorApi(e).mensaje, esError: true);
      }
    } finally {
      if (mounted) setState(() => _exportando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final rango = ref.watch(rangoReporteProvider);
    final resumenAsync = ref.watch(resumenReporteProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Reportes y métricas'),
        actions: [
          if (_exportando)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16),
              child: Center(
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2.2),
                ),
              ),
            )
          else
            PopupMenuButton<String>(
              tooltip: 'Exportar reporte',
              icon: const Icon(Icons.download_rounded),
              onSelected: _exportar,
              itemBuilder: (_) => const [
                PopupMenuItem(
                  value: 'pdf',
                  child: ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(Icons.picture_as_pdf_outlined,
                        color: OviColores.peligro),
                    title: Text('Exportar PDF'),
                  ),
                ),
                PopupMenuItem(
                  value: 'csv',
                  child: ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(Icons.table_chart_outlined,
                        color: OviColores.exito),
                    title: Text('Exportar CSV'),
                  ),
                ),
              ],
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(resumenReporteProvider),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
          children: [
            _SelectorPeriodo(
              rango: rango,
              alElegirPreset: (preset) {
                if (preset == PresetRango.personalizado) {
                  _seleccionarRangoPersonalizado();
                } else {
                  ref.read(rangoReporteProvider.notifier).state =
                      RangoReporte.desdePreset(preset);
                }
              },
            ),
            const SizedBox(height: 16),
            OviAsync<ResumenReporte>(
              valor: resumenAsync,
              alReintentar: () => ref.invalidate(resumenReporteProvider),
              enDatos: (r) => _CuerpoReporte(
                reporte: r,
                exportando: _exportando,
                alExportar: _exportar,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SelectorPeriodo extends StatelessWidget {
  const _SelectorPeriodo({
    required this.rango,
    required this.alElegirPreset,
  });

  final RangoReporte rango;
  final ValueChanged<PresetRango> alElegirPreset;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (final preset in PresetRango.values)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(preset.etiqueta),
                    selected: rango.preset == preset,
                    onSelected: (_) => alElegirPreset(preset),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'Período: ${rango.desde} al ${rango.hasta}',
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }
}

class _CuerpoReporte extends StatelessWidget {
  const _CuerpoReporte({
    required this.reporte,
    required this.exportando,
    required this.alExportar,
  });

  final ResumenReporte reporte;
  final bool exportando;
  final ValueChanged<String> alExportar;

  @override
  Widget build(BuildContext context) {
    final inv = reporte.inventario;
    final tar = reporte.tareas;
    final ev = reporte.eventos;
    final vig = reporte.vigilancia;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ── Tarjetas KPI principales ────────────────────────────────────────
        OviTarjeta(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              OviEncabezadoSeccion(
                titulo: 'Resumen ejecutivo',
                detalle: '${reporte.meses} meses',
              ),
              Row(
                children: [
                  Expanded(
                    child: OviMetrica(
                      valor: '${inv.activos}',
                      etiqueta: 'Rebaño\nactivo',
                      color: OviColores.primary,
                    ),
                  ),
                  Expanded(
                    child: OviMetrica(
                      valor: '${inv.bajasTotal}',
                      etiqueta: 'Bajas en\nperíodo',
                      color: OviColores.peligro,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: OviMetrica(
                      valor: '${tar.tasaCumplimientoPct}%',
                      etiqueta: 'Tareas\ncumplidas',
                      color: OviColores.exito,
                    ),
                  ),
                  Expanded(
                    child: OviMetrica(
                      valor: '${vig.totalEventos}',
                      etiqueta: 'Eventos\nIA',
                      color: OviColores.acento,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // ── Botones rápidos de exportación (RF24) ───────────────────────────
        Row(
          children: [
            Expanded(
              child: FilledButton.icon(
                onPressed: exportando ? null : () => alExportar('pdf'),
                icon: const Icon(Icons.picture_as_pdf_outlined, size: 18),
                label: const Text('Exportar PDF'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: exportando ? null : () => alExportar('csv'),
                icon: const Icon(Icons.table_chart_outlined, size: 18),
                label: const Text('Exportar CSV'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 18),

        // ── Bloque 1: Producción e inventario (bajas por mes) ───────────────
        OviTarjeta(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const OviEncabezadoSeccion(
                titulo: 'Bajas por mes y motivo',
              ),
              GraficoBarrasMensual(
                mensajeVacio: 'Sin bajas registradas en el período',
                leyenda: const [
                  LeyendaGrafico(etiqueta: 'Venta', color: OviColores.primary),
                  LeyendaGrafico(etiqueta: 'Muerte', color: OviColores.peligro),
                  LeyendaGrafico(
                      etiqueta: 'Faena', color: OviColores.advertencia),
                ],
                columnas: [
                  for (final m in reporte.serieMensual)
                    ColumnaGrafico(
                      etiqueta: m.mesCorto,
                      segmentos: [
                        SegmentoBarra(
                            valor: m.bajasVenta, color: OviColores.primary),
                        SegmentoBarra(
                            valor: m.bajasMuerte, color: OviColores.peligro),
                        SegmentoBarra(
                            valor: m.bajasFaena, color: OviColores.advertencia),
                      ],
                    ),
                ],
              ),
              const Divider(height: 24),
              OviDato(
                etiqueta: 'Altas período',
                valor: '${inv.altasPeriodo} animales registrados',
                icono: Icons.add_circle_outline_rounded,
              ),
              OviDato(
                etiqueta: 'Composición',
                valor: '${inv.hembras} hembras · ${inv.machos} machos',
                icono: Icons.pets_outlined,
              ),
              OviDato(
                etiqueta: 'Peso promedio',
                valor: inv.pesoPromedioKg == null
                    ? 'Sin registros de peso'
                    : '${inv.pesoPromedioKg} kg (${inv.pesoTotalKg} kg total)',
                icono: Icons.monitor_weight_outlined,
              ),
              OviDato(
                etiqueta: 'Tasas período',
                valor:
                    'Mortalidad ${inv.tasaMortalidadPct}% · Extracción ${inv.tasaExtraccionPct}%',
                icono: Icons.analytics_outlined,
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // ── Bloque 2: Tareas cumplidas por mes y responsable ────────────────
        OviTarjeta(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              OviEncabezadoSeccion(
                titulo: 'Tareas cumplidas por mes',
                detalle: '${tar.completadasPeriodo}/${tar.totalPeriodo}',
              ),
              GraficoBarrasMensual(
                mensajeVacio: 'Sin tareas registradas en el período',
                leyenda: const [
                  LeyendaGrafico(
                      etiqueta: 'Cumplidas', color: OviColores.exito),
                  LeyendaGrafico(
                      etiqueta: 'Vencidas', color: OviColores.peligro),
                ],
                columnas: [
                  for (final m in reporte.serieMensual)
                    ColumnaGrafico(
                      etiqueta: m.mesCorto,
                      segmentos: [
                        SegmentoBarra(
                            valor: m.tareasCompletadas,
                            color: OviColores.exito),
                        SegmentoBarra(
                            valor: m.tareasVencidas, color: OviColores.peligro),
                      ],
                    ),
                ],
              ),
              const Divider(height: 24),
              OviDato(
                etiqueta: 'A tiempo',
                valor:
                    '${tar.completadasATiempo} de ${tar.completadasPeriodo} (${tar.tasaATiempoPct}%)',
                icono: Icons.check_circle_outline_rounded,
              ),
              OviDato(
                etiqueta: 'Pendientes',
                valor:
                    '${tar.activasPendientes} activas · ${tar.vencidas} vencidas',
                icono: Icons.schedule_rounded,
              ),
              if (tar.porResponsable.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(
                  'Cumplimiento por responsable',
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                const SizedBox(height: 6),
                for (final u in tar.porResponsable)
                  BarraProgresoEtiquetada(
                    titulo: u.nombre,
                    detalle:
                        '${u.completadas}/${u.asignadas} (${u.tasaCumplimientoPct}%)',
                    fraccion: u.asignadas == 0 ? 0 : u.completadas / u.asignadas,
                    color: OviColores.exito,
                  ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 14),

        // ── Bloque 3: Gestión sanitaria y productiva ────────────────────────
        OviTarjeta(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              OviEncabezadoSeccion(
                titulo: 'Eventos sanitarios y productivos',
                detalle: '${ev.total} eventos',
              ),
              GraficoBarrasMensual(
                mensajeVacio: 'Sin eventos registrados en el período',
                leyenda: const [
                  LeyendaGrafico(
                      etiqueta: 'Sanitarios', color: OviColores.peligro),
                  LeyendaGrafico(
                      etiqueta: 'Productivos', color: OviColores.primary),
                ],
                columnas: [
                  for (final m in reporte.serieMensual)
                    ColumnaGrafico(
                      etiqueta: m.mesCorto,
                      segmentos: [
                        SegmentoBarra(
                            valor: m.eventosSanitarios,
                            color: OviColores.peligro),
                        SegmentoBarra(
                            valor: m.eventosProductivos,
                            color: OviColores.primary),
                      ],
                    ),
                ],
              ),
              const Divider(height: 24),
              OviDato(
                etiqueta: 'Sanitarios',
                valor:
                    '${ev.porTipo['ATENCION_SANITARIA'] ?? 0} (${ev.animalesAtendidosPorTipo['ATENCION_SANITARIA'] ?? 0} animales)',
                icono: Icons.medical_services_outlined,
              ),
              OviDato(
                etiqueta: 'Esquila',
                valor:
                    '${ev.porTipo['ESQUILA'] ?? 0} (${ev.animalesAtendidosPorTipo['ESQUILA'] ?? 0} animales)',
                icono: Icons.content_cut_rounded,
              ),
              OviDato(
                etiqueta: 'Encaste',
                valor:
                    '${ev.porTipo['ENCASTE'] ?? 0} (${ev.animalesAtendidosPorTipo['ENCASTE'] ?? 0} animales)',
                icono: Icons.favorite_border_rounded,
              ),
              OviDato(
                etiqueta: 'Bitácora',
                valor:
                    '${ev.notasBitacora} notas · ${ev.modificacionesBitacora} cambios de ficha',
                icono: Icons.menu_book_outlined,
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // ── Bloque 4: Vigilancia y eventos IA ───────────────────────────────
        OviTarjeta(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              OviEncabezadoSeccion(
                titulo: 'Notificaciones y eventos IA',
                detalle: '${vig.totalEventos} eventos',
              ),
              GraficoBarrasMensual(
                mensajeVacio: 'Sin discrepancias ni desconexiones en el período',
                leyenda: const [
                  LeyendaGrafico(
                      etiqueta: 'Discrepancia conteo',
                      color: OviColores.acento),
                  LeyendaGrafico(
                      etiqueta: 'Desconexión', color: OviColores.advertencia),
                ],
                columnas: [
                  for (final m in reporte.serieMensual)
                    ColumnaGrafico(
                      etiqueta: m.mesCorto,
                      segmentos: [
                        SegmentoBarra(
                            valor: m.discrepanciasIA, color: OviColores.acento),
                        SegmentoBarra(
                            valor: m.desconexionesIA,
                            color: OviColores.advertencia),
                      ],
                    ),
                ],
              ),
              const Divider(height: 24),
              OviDato(
                etiqueta: 'Discrepancias',
                valor:
                    '${vig.discrepancias} (brecha prom. ${vig.promedioDiferenciaCabezas} cabezas)',
                icono: Icons.visibility_outlined,
              ),
              OviDato(
                etiqueta: 'Desconexiones',
                valor: '${vig.desconexiones} registros de corte',
                icono: Icons.wifi_off_rounded,
              ),
              for (final d in vig.dispositivos) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        '${d.nombre} · ${d.ultimoConteo ?? '—'}/${d.conteoEsperado} ovejas',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ),
                    OviChip(
                      texto: d.enLinea ? 'En línea' : 'Sin señal',
                      tono: d.enLinea ? TonoChip.exito : TonoChip.neutro,
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

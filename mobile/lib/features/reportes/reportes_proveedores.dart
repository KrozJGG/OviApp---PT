import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/proveedores.dart';
import 'datos/reporte.dart';
import 'datos/reportes_repositorio.dart';

final reportesRepositorioProvider = Provider<ReportesRepositorio>(
  (ref) => ReportesRepositorio(ref.watch(clienteApiProvider)),
);

/// Rango temporal seleccionado en el panel de reportes (por defecto: 6 meses).
final rangoReporteProvider = StateProvider<RangoReporte>(
  (ref) => RangoReporte.desdePreset(PresetRango.meses6),
);

/// Resumen consolidado del predio para el rango activo (RF23).
final resumenReporteProvider = FutureProvider.autoDispose<ResumenReporte>((ref) {
  final rango = ref.watch(rangoReporteProvider);
  return ref.watch(reportesRepositorioProvider).obtenerResumen(rango);
});

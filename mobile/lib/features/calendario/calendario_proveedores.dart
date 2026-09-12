import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/formato.dart';
import '../../core/proveedores.dart';
import '../../core/red/api.dart';
import 'datos/agenda.dart';

/// Mes que el calendario está mostrando. Se guarda el día 1 como clave.
final mesVisibleProvider = NotifierProvider<MesVisibleNotifier, DateTime>(
  MesVisibleNotifier.new,
);

class MesVisibleNotifier extends Notifier<DateTime> {
  @override
  DateTime build() {
    final hoy = DateTime.now();
    return DateTime(hoy.year, hoy.month);
  }

  void ir(DateTime mes) => state = DateTime(mes.year, mes.month);
}

/// Día seleccionado dentro del mes; gobierna la lista inferior del mockup 06.
final diaSeleccionadoProvider = NotifierProvider<DiaSeleccionadoNotifier, DateTime>(
  DiaSeleccionadoNotifier.new,
);

class DiaSeleccionadoNotifier extends Notifier<DateTime> {
  @override
  DateTime build() => DateTime.now();

  void elegir(DateTime dia) => state = dia;
}

/// Agenda del mes visible. Se pide el mes completo de una vez: son pocos
/// registros y evita una petición por cada día que el usuario toca.
final agendaDelMesProvider = FutureProvider.autoDispose<AgendaDelRango>((ref) async {
  final mes = ref.watch(mesVisibleProvider);
  final desde = DateTime(mes.year, mes.month, 1);
  // El día 0 del mes siguiente es el último del actual.
  final hasta = DateTime(mes.year, mes.month + 1, 0);

  final json = await ref.watch(dioProvider).traerMapa(
    '/agenda',
    consulta: {'desde': Fmt.iso(desde), 'hasta': Fmt.iso(hasta)},
  );
  return AgendaDelRango.desdeJson(json);
});

/// `GET /agenda/hoy` — la sección «Agenda · Hoy» de la pantalla de inicio.
final agendaDeHoyProvider = FutureProvider.autoDispose<List<ItemAgenda>>((ref) async {
  final json = await ref.watch(dioProvider).traerMapa('/agenda/hoy');
  return (json['items'] as List<dynamic>? ?? const [])
      .whereType<Map<String, dynamic>>()
      .map(ItemAgenda.desdeJson)
      .toList(growable: false);
});

/// `GET /inicio/resumen` — RF_15.
final resumenInicioProvider = FutureProvider.autoDispose<ResumenInicio>((ref) async {
  final json = await ref.watch(dioProvider).traerMapa('/inicio/resumen');
  return ResumenInicio.desdeJson(json);
});

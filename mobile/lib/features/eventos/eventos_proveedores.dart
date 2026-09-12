import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/formato.dart';
import '../../core/proveedores.dart';
import '../../core/red/api.dart';
import 'datos/evento.dart';

/// Detalle de un evento (RF_08).
final eventoProvider = FutureProvider.autoDispose.family<Evento, String>((ref, id) async {
  final json = await ref.watch(dioProvider).traerMapa('/eventos/$id');
  return Evento.desdeJson(json);
});

/// Operaciones de escritura del Módulo 3. Todas son exclusivas del Productor
/// (RF_07, RF_09, RF_10): el backend responde 403 al Trabajador.
class EventosRepositorio {
  const EventosRepositorio(this._ref);

  final Ref _ref;

  Future<Evento> crear({
    required String tipo,
    required DateTime fechaInicio,
    required List<String> idAnimales,
    String? descripcion,
  }) async {
    final json = await _ref.read(dioProvider).enviar('/eventos', cuerpo: {
      'tipo': tipo,
      'fechaInicio': fechaInicio.toUtc().toIso8601String(),
      'idAnimales': idAnimales,
      'descripcion': descripcion,
    });
    return Evento.desdeJson(json);
  }

  /// RF_09 — el tipo no viaja: es inmutable y el backend responde 409 si llega.
  Future<Evento> editar(
    String id, {
    required DateTime fechaInicio,
    required List<String> idAnimales,
    String? descripcion,
  }) async {
    final json = await _ref.read(dioProvider).parchar('/eventos/$id', cuerpo: {
      'fechaInicio': fechaInicio.toUtc().toIso8601String(),
      'idAnimales': idAnimales,
      'descripcion': descripcion,
    });
    return Evento.desdeJson(json);
  }

  /// RF_10 — borrado lógico; la bitácora de los animales se conserva.
  Future<void> eliminar(String id) => _ref.read(dioProvider).borrar('/eventos/$id');
}

final eventosRepositorioProvider =
    Provider<EventosRepositorio>(EventosRepositorio.new);

/// Convierte «AAAA-MM-DD» de la query string a fecha, para el botón «+» del
/// calendario, que abre el formulario con el día ya elegido.
DateTime? fechaSugeridaDe(String? iso) {
  if (iso == null || iso.isEmpty) return null;
  final f = DateTime.tryParse(iso);
  if (f == null) return null;
  // Se preserva la hora por defecto de los mockups: 09:00 del día elegido.
  return DateTime(f.year, f.month, f.day, 9);
}

/// Fecha con la hora puesta a las 9 de la mañana, la hora tipo de una faena.
DateTime aLasNueve(DateTime dia) => DateTime(dia.year, dia.month, dia.day, 9);

/// «AAAA-MM-DD» para navegar al formulario con un día preseleccionado.
String isoDe(DateTime f) => Fmt.iso(f);

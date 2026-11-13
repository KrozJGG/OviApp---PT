import '../../../core/red/json.dart';

/// Elemento del calendario general: un evento o una tarea, ya unificados por
/// el backend (RF_15, RF_16).
class ItemAgenda {
  const ItemAgenda({
    required this.id,
    required this.clase,
    required this.tipo,
    required this.titulo,
    required this.fecha,
    required this.estado,
    this.descripcion,
    this.meta = const {},
  });

  final String id;

  /// `EVENTO` o `TAREA`. Decide el color del punto y a dónde navega el toque.
  final String clase;

  /// Para un evento, su tipo (ENCASTE, ESQUILA…). Para una tarea, `TAREA`.
  final String tipo;
  final String titulo;
  final DateTime fecha;
  final String estado;
  final String? descripcion;
  final Map<String, dynamic> meta;

  bool get esEvento => clase == 'EVENTO';

  /// Responsables de una tarea, tal como vienen dentro de `meta`.
  List<Referencia> get responsables => Referencia.lista(meta['responsables']);

  factory ItemAgenda.desdeJson(Map<String, dynamic> j) {
    final clase = (j['clase'] as String?) ?? 'TAREA';

    return ItemAgenda(
      id: j['id'] as String,
      clase: clase,
      tipo: (j['tipo'] as String?) ?? 'OTRO',
      titulo: (j['titulo'] as String?) ?? '',
      // Las dos clases traen `fecha`, pero no son lo mismo: el evento manda un
      // instante (`fechaInicio`) y la tarea un dia del calendario
      // (`fechaLimite`, @db.Date), que no se convierte a hora local.
      fecha: clase == 'EVENTO' ? fechaDe(j['fecha']) : fechaSoloDe(j['fecha']),
      estado: (j['estado'] as String?) ?? '',
      descripcion: j['descripcion'] as String?,
      meta: j['meta'] is Map ? Map<String, dynamic>.from(j['meta'] as Map) : const {},
    );
  }
}

/// `GET /agenda?desde&hasta` — items del rango más el conteo por día que
/// alimenta los puntitos del calendario mensual.
class AgendaDelRango {
  const AgendaDelRango({required this.items, required this.porDia});

  final List<ItemAgenda> items;

  /// `{ '2026-09-28': {eventos: 1, tareas: 2} }` — la forma exacta depende del
  /// backend, así que se conserva cruda y se consulta con [deDia].
  final Map<String, dynamic> porDia;

  /// Items de un día concreto, en orden cronológico.
  List<ItemAgenda> deDia(DateTime dia) {
    final items = this
        .items
        .where((i) => _mismoDia(i.fecha.toLocal(), dia))
        .toList(growable: false);
    return items..sort((a, b) => a.fecha.compareTo(b.fecha));
  }

  static bool _mismoDia(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;

  factory AgendaDelRango.desdeJson(Map<String, dynamic> j) => AgendaDelRango(
        items: (j['items'] as List<dynamic>? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(ItemAgenda.desdeJson)
            .toList(growable: false),
        porDia: j['porDia'] is Map
            ? Map<String, dynamic>.from(j['porDia'] as Map)
            : const {},
      );
}

/// `GET /inicio/resumen` — métricas del rebaño del mockup 02.
class ResumenInicio {
  const ResumenInicio({
    required this.animalesActivos,
    required this.tareasHoy,
  });

  final int animalesActivos;
  final int tareasHoy;

  factory ResumenInicio.desdeJson(Map<String, dynamic> j) => ResumenInicio(
        animalesActivos: enteroNulo(j['animalesActivos']) ?? 0,
        tareasHoy: enteroNulo(j['tareasHoy']) ?? 0,
      );
}

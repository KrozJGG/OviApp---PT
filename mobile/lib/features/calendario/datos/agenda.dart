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

  factory ItemAgenda.desdeJson(Map<String, dynamic> j) => ItemAgenda(
        id: j['id'] as String,
        clase: (j['clase'] as String?) ?? 'TAREA',
        tipo: (j['tipo'] as String?) ?? 'OTRO',
        titulo: (j['titulo'] as String?) ?? '',
        fecha: fechaDe(j['fecha']),
        estado: (j['estado'] as String?) ?? '',
        descripcion: j['descripcion'] as String?,
        meta: j['meta'] is Map ? Map<String, dynamic>.from(j['meta'] as Map) : const {},
      );
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

/// `GET /inicio/resumen` — las tres métricas y la última alerta del mockup 02.
class ResumenInicio {
  const ResumenInicio({
    required this.animalesActivos,
    required this.tareasHoy,
    required this.alertasSinLeer,
    this.ultimaAlerta,
  });

  final int animalesActivos;
  final int tareasHoy;
  final int alertasSinLeer;
  final AlertaResumida? ultimaAlerta;

  factory ResumenInicio.desdeJson(Map<String, dynamic> j) => ResumenInicio(
        animalesActivos: enteroNulo(j['animalesActivos']) ?? 0,
        tareasHoy: enteroNulo(j['tareasHoy']) ?? 0,
        alertasSinLeer: enteroNulo(j['alertasSinLeer']) ?? 0,
        ultimaAlerta: j['ultimaAlerta'] is Map
            ? AlertaResumida.desdeJson(
                Map<String, dynamic>.from(j['ultimaAlerta'] as Map),
              )
            : null,
      );
}

/// Alerta reducida que aparece en el resumen de inicio y en vigilancia.
class AlertaResumida {
  const AlertaResumida({
    required this.id,
    required this.tipoAlerta,
    required this.fechaHora,
    this.descripcion,
    this.nivel,
    this.conteoAnimales,
  });

  final String id;
  final String tipoAlerta;
  final DateTime fechaHora;
  final String? descripcion;
  final String? nivel;
  final int? conteoAnimales;

  factory AlertaResumida.desdeJson(Map<String, dynamic> j) => AlertaResumida(
        id: j['id'] as String,
        tipoAlerta: (j['tipoAlerta'] as String?) ?? 'CONTEO',
        fechaHora: fechaDe(j['fechaHora']),
        descripcion: j['descripcion'] as String?,
        nivel: j['nivel'] as String?,
        conteoAnimales: enteroNulo(j['conteoAnimales']),
      );
}

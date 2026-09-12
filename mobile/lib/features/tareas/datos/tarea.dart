import '../../../core/red/json.dart';
import '../../eventos/datos/evento.dart';

/// Tarea operativa del predio — Módulo 4 (RF_11 a RF_14).
class Tarea {
  const Tarea({
    required this.id,
    required this.titulo,
    required this.fechaLimite,
    required this.estado,
    required this.responsables,
    required this.animales,
    this.descripcion,
    this.completadaEn,
    this.creador,
    this.completadaPor,
  });

  final String id;
  final String titulo;
  final DateTime fechaLimite;
  final String estado;
  final List<Referencia> responsables;
  final List<AnimalDeEvento> animales;
  final String? descripcion;

  /// RF_13 — se registran al marcarla como completada.
  final DateTime? completadaEn;
  final Referencia? creador;
  final Referencia? completadaPor;

  bool get estaCompletada => estado == 'COMPLETADA';

  /// Una tarea activa cuyo plazo ya pasó. Se destaca en el listado.
  bool get estaVencida {
    if (estaCompletada) return false;
    final hoy = DateTime.now();
    final limite = fechaLimite.toLocal();
    return DateTime(limite.year, limite.month, limite.day)
        .isBefore(DateTime(hoy.year, hoy.month, hoy.day));
  }

  factory Tarea.desdeJson(Map<String, dynamic> j) => Tarea(
        id: j['id'] as String,
        titulo: (j['titulo'] as String?) ?? '',
        fechaLimite: fechaDe(j['fechaLimite']),
        estado: (j['estado'] as String?) ?? 'ACTIVA',
        responsables: Referencia.lista(j['responsables']),
        animales: (j['animales'] as List<dynamic>? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(AnimalDeEvento.desdeJson)
            .toList(growable: false),
        descripcion: j['descripcion'] as String?,
        completadaEn: fechaNulaDe(j['completadaEn']),
        creador: Referencia.desdeJsonNula(j['creador']),
        completadaPor: Referencia.desdeJsonNula(j['completadaPor']),
      );
}

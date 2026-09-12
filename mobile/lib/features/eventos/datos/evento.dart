import '../../../core/red/json.dart';

/// Animal asociado a un evento, con lo justo para pintarlo en una lista.
class AnimalDeEvento {
  const AnimalDeEvento({
    required this.id,
    required this.numeroOreja,
    required this.sexo,
    required this.estado,
    this.raza,
  });

  final String id;
  final String numeroOreja;
  final String sexo;
  final String estado;
  final String? raza;

  factory AnimalDeEvento.desdeJson(Map<String, dynamic> j) => AnimalDeEvento(
        id: j['id'] as String,
        numeroOreja: (j['numeroOreja'] as String?) ?? '',
        sexo: (j['sexo'] as String?) ?? 'HEMBRA',
        estado: (j['estado'] as String?) ?? 'ACTIVO',
        raza: j['raza'] as String?,
      );
}

/// Evento del ciclo productivo — Módulo 3 (RF_07 a RF_10).
class Evento {
  const Evento({
    required this.id,
    required this.tipo,
    required this.fechaInicio,
    required this.estado,
    required this.animales,
    this.descripcion,
    this.eliminadoEn,
    this.creador,
  });

  final String id;

  /// RF_09 — inmutable una vez creado.
  final String tipo;
  final DateTime fechaInicio;
  final String estado;
  final List<AnimalDeEvento> animales;
  final String? descripcion;
  final DateTime? eliminadoEn;
  final Referencia? creador;

  bool get estaEliminado => eliminadoEn != null;

  factory Evento.desdeJson(Map<String, dynamic> j) => Evento(
        id: j['id'] as String,
        tipo: (j['tipo'] as String?) ?? 'OTRO',
        fechaInicio: fechaDe(j['fechaInicio']),
        estado: (j['estado'] as String?) ?? 'PROGRAMADO',
        animales: (j['animales'] as List<dynamic>? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(AnimalDeEvento.desdeJson)
            .toList(growable: false),
        descripcion: j['descripcion'] as String?,
        eliminadoEn: fechaNulaDe(j['eliminadoEn']),
        creador: Referencia.desdeJsonNula(j['creador']),
      );
}

/// Los cuatro tipos que acepta la API, en el orden en que se ofrecen.
const tiposDeEvento = <String>['ENCASTE', 'ESQUILA', 'ATENCION_SANITARIA', 'OTRO'];

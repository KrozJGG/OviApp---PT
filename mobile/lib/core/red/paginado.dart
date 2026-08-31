/// Envoltorio de los listados de la API: `{ datos, meta }`.
class Paginado<T> {
  const Paginado({required this.datos, required this.meta});

  final List<T> datos;
  final MetaPaginacion meta;

  bool get hayMas => meta.pagina < meta.totalPaginas;
  bool get estaVacio => datos.isEmpty;

  static Paginado<T> desdeJson<T>(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) mapear,
  ) {
    final datos = (json['datos'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(mapear)
        .toList(growable: false);

    return Paginado<T>(
      datos: datos,
      meta: MetaPaginacion.desdeJson(json['meta'] as Map<String, dynamic>? ?? const {}),
    );
  }

  /// Concatena la pagina siguiente conservando el meta mas reciente.
  Paginado<T> mas(Paginado<T> siguiente) =>
      Paginado(datos: [...datos, ...siguiente.datos], meta: siguiente.meta);
}

class MetaPaginacion {
  const MetaPaginacion({
    required this.pagina,
    required this.tamano,
    required this.total,
    required this.totalPaginas,
  });

  final int pagina;
  final int tamano;
  final int total;
  final int totalPaginas;

  static const vacio = MetaPaginacion(pagina: 1, tamano: 20, total: 0, totalPaginas: 0);

  factory MetaPaginacion.desdeJson(Map<String, dynamic> json) => MetaPaginacion(
        pagina: (json['pagina'] as num?)?.toInt() ?? 1,
        tamano: (json['tamano'] as num?)?.toInt() ?? 20,
        total: (json['total'] as num?)?.toInt() ?? 0,
        totalPaginas: (json['totalPaginas'] as num?)?.toInt() ?? 0,
      );
}

import 'package:dio/dio.dart';

import '../../../core/formato.dart';
import '../../../core/red/api.dart';
import 'animal.dart';

/// Acceso a `/animales` — Módulo 1 (RF_01 a RF_04).
///
/// No captura errores: lo que sale de aquí es siempre un `ErrorApi`, que es lo
/// que la capa de pantallas sabe mostrar.
class RebanoRepositorio {
  const RebanoRepositorio(this._dio);

  final Dio _dio;

  /// Listado paginado con búsqueda por número de oreja y filtro de estado.
  Future<ListadoRebano> listar({
    int pagina = 1,
    int tamano = 20,
    String? q,
    String? estado,
  }) async {
    final json = await _dio.traerMapa(
      '/animales',
      consulta: {'pagina': pagina, 'tamano': tamano, 'q': q, 'estado': estado},
    );
    return ListadoRebano.desdeJson(json);
  }

  /// RF_02 — ficha individual con registrador y últimos movimientos.
  Future<FichaAnimal> obtener(String id) async {
    final json = await _dio.traerMapa('/animales/$id');
    return FichaAnimal.desdeJson(json);
  }

  /// RF_01 — alta. El número de oreja debe ser único en el predio.
  Future<Animal> crear({
    required String numeroOreja,
    required String sexo,
    String? raza,
    String? color,
    double? pesoKg,
    DateTime? fechaNacimiento,
    String? descripcion,
  }) async {
    final json = await _dio.enviar('/animales', cuerpo: {
      'numeroOreja': numeroOreja,
      'sexo': sexo,
      'raza': raza,
      'color': color,
      'pesoKg': pesoKg,
      'fechaNacimiento': fechaNacimiento == null ? null : Fmt.iso(fechaNacimiento),
      'descripcion': descripcion,
    });
    return Animal.desdeJson(json);
  }

  /// RF_03 — edición parcial. El número de oreja no viaja: es inmutable.
  Future<Animal> editar(
    String id, {
    required String sexo,
    String? raza,
    String? color,
    double? pesoKg,
    DateTime? fechaNacimiento,
    String? descripcion,
  }) async {
    final json = await _dio.parchar('/animales/$id', cuerpo: {
      'sexo': sexo,
      'raza': raza,
      'color': color,
      'pesoKg': pesoKg,
      'fechaNacimiento': fechaNacimiento == null ? null : Fmt.iso(fechaNacimiento),
      'descripcion': descripcion,
    });
    return Animal.desdeJson(json);
  }

  /// RF_04 — baja. Solo Productor; el backend responde 403 al Trabajador.
  Future<Animal> darDeBaja(
    String id, {
    required String motivo,
    required DateTime fecha,
  }) async {
    final json = await _dio.enviar(
      '/animales/$id/baja',
      cuerpo: {'motivo': motivo, 'fecha': Fmt.iso(fecha)},
    );
    return Animal.desdeJson(json);
  }

  /// Eliminación definitiva. Solo Productor y solo sobre un animal ya inactivo:
  /// el backend responde 403 al Trabajador y 409 si el animal sigue activo.
  Future<void> eliminar(String id) => _dio.borrar('/animales/$id');
}

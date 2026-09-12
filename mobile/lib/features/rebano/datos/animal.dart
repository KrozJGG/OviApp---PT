import '../../../core/red/json.dart';
import '../../../core/red/paginado.dart';

/// Ficha de un animal del rebaño — Módulo 1 (RF_01 a RF_04).
class Animal {
  const Animal({
    required this.id,
    required this.numeroOreja,
    required this.sexo,
    required this.estado,
    this.raza,
    this.color,
    this.pesoKg,
    this.fechaNacimiento,
    this.descripcion,
    this.motivoBaja,
    this.fechaBaja,
  });

  final String id;

  /// Identificador de negocio. Inmutable después del alta (RF_03).
  final String numeroOreja;
  final String sexo;
  final String estado;
  final String? raza;
  final String? color;
  final double? pesoKg;
  final DateTime? fechaNacimiento;
  final String? descripcion;

  /// Solo presentes cuando `estado == 'INACTIVO'` (RF_04).
  final String? motivoBaja;
  final DateTime? fechaBaja;

  bool get estaActivo => estado == 'ACTIVO';

  factory Animal.desdeJson(Map<String, dynamic> j) => Animal(
        id: j['id'] as String,
        numeroOreja: (j['numeroOreja'] as String?) ?? '',
        sexo: (j['sexo'] as String?) ?? 'HEMBRA',
        estado: (j['estado'] as String?) ?? 'ACTIVO',
        raza: j['raza'] as String?,
        color: j['color'] as String?,
        pesoKg: decimalNulo(j['pesoKg']),
        fechaNacimiento: fechaNulaDe(j['fechaNacimiento']),
        descripcion: j['descripcion'] as String?,
        motivoBaja: j['motivoBaja'] as String?,
        fechaBaja: fechaNulaDe(j['fechaBaja']),
      );
}

/// Entrada de bitácora resumida que acompaña a la ficha (IF1-SAL).
class EntradaResumida {
  const EntradaResumida({
    required this.id,
    required this.tipo,
    required this.titulo,
    required this.fecha,
    this.descripcion,
  });

  final String id;
  final String tipo;
  final String titulo;
  final DateTime fecha;
  final String? descripcion;

  factory EntradaResumida.desdeJson(Map<String, dynamic> j) => EntradaResumida(
        id: j['id'] as String,
        tipo: (j['tipo'] as String?) ?? 'NOTA',
        titulo: (j['titulo'] as String?) ?? '',
        fecha: fechaDe(j['fecha']),
        descripcion: j['descripcion'] as String?,
      );
}

/// Ficha completa: el animal más quién lo registró y sus últimos movimientos.
class FichaAnimal {
  const FichaAnimal({
    required this.animal,
    required this.registrador,
    required this.ultimasEntradas,
  });

  final Animal animal;
  final Referencia? registrador;
  final List<EntradaResumida> ultimasEntradas;

  factory FichaAnimal.desdeJson(Map<String, dynamic> j) => FichaAnimal(
        animal: Animal.desdeJson(j),
        registrador: Referencia.desdeJsonNula(j['registrador']),
        ultimasEntradas: (j['ultimasEntradas'] as List<dynamic>? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(EntradaResumida.desdeJson)
            .toList(growable: false),
      );
}

/// Contadores que el listado devuelve junto a la página (mockup 03).
class ResumenRebano {
  const ResumenRebano({required this.activos, required this.inactivos});

  final int activos;
  final int inactivos;

  static const vacio = ResumenRebano(activos: 0, inactivos: 0);

  factory ResumenRebano.desdeJson(Map<String, dynamic> j) => ResumenRebano(
        activos: enteroNulo(j['activos']) ?? 0,
        inactivos: enteroNulo(j['inactivos']) ?? 0,
      );
}

/// `GET /animales` devuelve el paginado estándar más un `resumen`.
class ListadoRebano {
  const ListadoRebano({required this.pagina, required this.resumen});

  final Paginado<Animal> pagina;
  final ResumenRebano resumen;

  factory ListadoRebano.desdeJson(Map<String, dynamic> j) => ListadoRebano(
        pagina: Paginado.desdeJson(j, Animal.desdeJson),
        resumen: ResumenRebano.desdeJson(
          (j['resumen'] as Map<String, dynamic>?) ?? const {},
        ),
      );

  ListadoRebano mas(ListadoRebano siguiente) => ListadoRebano(
        pagina: pagina.mas(siguiente.pagina),
        resumen: siguiente.resumen,
      );
}

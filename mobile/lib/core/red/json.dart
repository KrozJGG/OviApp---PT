/// Conversiones repetidas al leer JSON de la API.
///
/// Los modelos se escriben a mano (no hay codegen en el proyecto), así que
/// estas tres funciones evitan repetir el mismo casteo defensivo en cada uno.
library;

// Los nombres llevan sufijo `De` a proposito: varios modelos tienen un campo
// llamado `fecha`, y sin el sufijo el campo taparia a la funcion.

/// Fecha ISO-8601 que puede venir nula.
DateTime? fechaNulaDe(Object? valor) {
  if (valor is! String || valor.isEmpty) return null;
  return DateTime.tryParse(valor);
}

/// Fecha ISO-8601 obligatoria. Si la API la omite se usa el epoch en lugar de
/// reventar: una fecha rara se ve en pantalla, una excepción rompe la lista.
DateTime fechaDe(Object? valor) =>
    fechaNulaDe(valor) ?? DateTime.fromMillisecondsSinceEpoch(0);

/// Fecha sin hora: los campos `@db.Date` de la API ("2026-11-05T00:00:00.000Z").
///
/// Se arma como medianoche LOCAL y nunca se convierte. Un vencimiento o una
/// fecha de nacimiento son un día del calendario, no un instante: pasarlos por
/// `toLocal()` en Chile (UTC-3) los corre al día anterior, y la tarea del 5
/// aparece vencida el 4.
DateTime? fechaSoloNulaDe(Object? valor) {
  if (valor is! String || valor.length < 10) return null;
  final partes = valor.substring(0, 10).split('-');
  if (partes.length != 3) return null;

  final anio = int.tryParse(partes[0]);
  final mes = int.tryParse(partes[1]);
  final dia = int.tryParse(partes[2]);
  if (anio == null || mes == null || dia == null) return null;

  return DateTime(anio, mes, dia);
}

/// Fecha sin hora obligatoria. Igual que [fechaDe], prefiere el epoch a reventar.
DateTime fechaSoloDe(Object? valor) =>
    fechaSoloNulaDe(valor) ?? DateTime.fromMillisecondsSinceEpoch(0);

/// Número que puede venir nulo, como `int` o como `double`.
double? decimalNulo(Object? valor) => (valor as num?)?.toDouble();

/// Entero que puede venir nulo.
int? enteroNulo(Object? valor) => (valor as num?)?.toInt();

/// `{ id, nombre }` — la forma con la que la API referencia usuarios,
/// dispositivos y creadores.
class Referencia {
  const Referencia({required this.id, required this.nombre});

  final String id;
  final String nombre;

  static Referencia? desdeJsonNula(Object? valor) {
    if (valor is! Map) return null;
    final mapa = Map<String, dynamic>.from(valor);
    return Referencia(
      id: (mapa['id'] as String?) ?? '',
      nombre: (mapa['nombre'] as String?) ?? '',
    );
  }

  static List<Referencia> lista(Object? valor) {
    if (valor is! List) return const [];
    return valor
        .map(desdeJsonNula)
        .whereType<Referencia>()
        .toList(growable: false);
  }
}

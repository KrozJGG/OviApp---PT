/// Permiso temporal para ver el video en vivo (`POST /streaming/token`).
///
/// El backend no expone el servidor de streaming: entrega esta URL ya firmada,
/// con un token de vida corta incrustado. No es un límite de uso — se puede
/// pedir uno nuevo cuantas veces haga falta — sino el modo de que el manifiesto
/// y cada segmento viajen autenticados sin depender de cabeceras, que es lo
/// único que funciona igual en Android, iOS y navegador.
class AccesoStream {
  const AccesoStream({required this.url, required this.expiraEnSeg});

  /// URL absoluta del manifiesto HLS, con el token incluido.
  final Uri url;

  /// Segundos de validez del permiso. La pantalla lo renueva antes de que venza.
  final int expiraEnSeg;
}

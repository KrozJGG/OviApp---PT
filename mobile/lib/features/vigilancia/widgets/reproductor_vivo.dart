/// Reproductor del video en vivo, resuelto por plataforma.
///
/// En Android e iOS el motor de video del sistema reproduce HLS sin ayuda; en el
/// navegador solo Safari lo hace, así que la versión web se apoya en hls.js. La
/// pantalla no necesita saber cuál está usando: ambas exponen el mismo widget
/// `ReproductorVivo(url:, alFallar:)` y cambian de fuente sin cortes cuando la
/// pantalla renueva el permiso.
library;

export 'reproductor_vivo_nativo.dart' if (dart.library.js_interop) 'reproductor_vivo_web.dart';

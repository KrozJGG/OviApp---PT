import 'dart:js_interop';
import 'dart:js_interop_unsafe';
import 'dart:ui_web' as ui_web;

import 'package:flutter/material.dart';
import 'package:web/web.dart' as web;

/// Enlace mínimo con hls.js, que `web/index.html` carga por `<script>`.
@JS('Hls')
extension type _Hls._(JSObject _) implements JSObject {
  external factory _Hls();

  external static bool isSupported();
  external void loadSource(String url);
  external void attachMedia(web.HTMLVideoElement video);
  external void destroy();
}

/// Reproductor HLS para el build web.
///
/// Ningún navegador basado en Chromium reproduce HLS por su cuenta, así que se
/// monta un `<video>` real como vista de plataforma y se le conecta hls.js.
/// Safari sí lo soporta de forma nativa y en ese caso se usa directo, sin la
/// librería.
class ReproductorVivo extends StatefulWidget {
  const ReproductorVivo({
    super.key,
    required this.url,
    required this.alFallar,
    this.superposicion,
    this.bloquearControles = false,
  });

  final Uri url;

  /// Se invoca cuando la reproducción se cae; la pantalla decide qué mostrar.
  final VoidCallback alFallar;

  /// Capa opcional alineada exactamente al fotograma (ROI de lectura o editor).
  final Widget? superposicion;

  /// Desactiva los controles y eventos del DOM para permitir dibujar encima.
  final bool bloquearControles;

  @override
  State<ReproductorVivo> createState() => _ReproductorVivoState();
}

class _ReproductorVivoState extends State<ReproductorVivo> {
  /// Cada instancia necesita su propio tipo de vista registrado.
  static int _secuencia = 0;

  late final String _tipoVista;
  late final web.HTMLVideoElement _video;
  _Hls? _hls;
  double _aspectRatio = 16 / 9;

  @override
  void initState() {
    super.initState();

    _video = web.HTMLVideoElement()
      ..autoplay = true
      // Sin silenciar, el navegador bloquea la reproducción automática.
      ..muted = true;

    _video.style
      ..setProperty('width', '100%')
      ..setProperty('height', '100%')
      ..setProperty('object-fit', 'contain');

    _actualizarInteraccionVideo();

    _video.addEventListener('error', ((web.Event _) => widget.alFallar()).toJS);
    _video.addEventListener(
      'loadedmetadata',
      ((web.Event _) {
        final ancho = _video.videoWidth;
        final alto = _video.videoHeight;
        if (mounted && ancho > 0 && alto > 0) {
          setState(() => _aspectRatio = ancho / alto);
        }
      }).toJS,
    );

    _tipoVista = 'ovi-video-vivo-${_secuencia++}';
    ui_web.platformViewRegistry.registerViewFactory(_tipoVista, (int _) => _video);

    _cargar(widget.url);
  }

  void _actualizarInteraccionVideo() {
    _video.controls = !widget.bloquearControles;
    _video.style.setProperty(
      'pointer-events',
      widget.bloquearControles ? 'none' : 'auto',
    );
  }

  @override
  void didUpdateWidget(ReproductorVivo anterior) {
    super.didUpdateWidget(anterior);

    if (widget.bloquearControles != anterior.bloquearControles) {
      _actualizarInteraccionVideo();
    }

    if (widget.url == anterior.url) return;

    // Renovación del permiso: basta con cambiarle la fuente a la instancia que
    // ya está enganchada al <video>; recrearla obligaría a rearmar el buffer.
    final hls = _hls;
    if (hls != null) {
      hls.loadSource(widget.url.toString());
    } else {
      _video.src = widget.url.toString();
    }
  }

  void _cargar(Uri url) {
    // Si el <script> de hls.js no cargó, se intenta igual por si el navegador
    // es Safari, que reproduce HLS sin ayuda. En cualquier otro, el <video>
    // emite `error` y la pantalla muestra el estado correspondiente.
    if (!globalContext.has('Hls') || !_Hls.isSupported()) {
      _video.src = url.toString();
      return;
    }

    final hls = _Hls();
    hls.loadSource(url.toString());
    hls.attachMedia(_video);
    _hls = hls;
  }

  @override
  void dispose() {
    _hls?.destroy();
    _video.pause();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: _aspectRatio,
      child: Stack(
        fit: StackFit.expand,
        children: [
          IgnorePointer(
            ignoring: widget.bloquearControles,
            child: HtmlElementView(viewType: _tipoVista),
          ),
          if (widget.superposicion != null) widget.superposicion!,
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../../../core/widgets/ovi_estados.dart';

/// Reproductor HLS para Android e iOS.
///
/// ExoPlayer y AVPlayer reproducen HLS de forma nativa, así que alcanza con
/// apuntarlos al manifiesto.
class ReproductorVivo extends StatefulWidget {
  const ReproductorVivo({super.key, required this.url, required this.alFallar});

  final Uri url;

  /// Se invoca cuando la reproducción se cae; la pantalla decide qué mostrar.
  final VoidCallback alFallar;

  @override
  State<ReproductorVivo> createState() => _ReproductorVivoState();
}

class _ReproductorVivoState extends State<ReproductorVivo> {
  VideoPlayerController? _controlador;

  @override
  void initState() {
    super.initState();
    _cargar(widget.url);
  }

  @override
  void didUpdateWidget(ReproductorVivo anterior) {
    super.didUpdateWidget(anterior);
    if (widget.url != anterior.url) _cargar(widget.url);
  }

  /// Prepara la fuente nueva y recién cuando está lista descarta la anterior.
  ///
  /// Ese orden es lo que hace invisible la renovación del permiso: si se
  /// liberara primero el reproductor viejo, la pantalla quedaría en negro
  /// mientras el nuevo inicializa.
  Future<void> _cargar(Uri url) async {
    final nuevo = VideoPlayerController.networkUrl(url);

    try {
      await nuevo.initialize();
      await nuevo.play();
    } catch (_) {
      await nuevo.dispose();
      if (mounted) widget.alFallar();
      return;
    }

    if (!mounted) {
      await nuevo.dispose();
      return;
    }

    final anterior = _controlador;
    setState(() => _controlador = nuevo);
    await anterior?.dispose();
  }

  @override
  void dispose() {
    _controlador?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controlador = _controlador;

    if (controlador == null) {
      return const OviCargando(mensaje: 'Conectando con la cámara…');
    }

    return AspectRatio(
      aspectRatio: controlador.value.aspectRatio,
      child: VideoPlayer(controlador),
    );
  }
}

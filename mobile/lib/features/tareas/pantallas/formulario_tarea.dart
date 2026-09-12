import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/formato.dart';
import '../../../core/red/cliente_api.dart';
import '../../../core/red/error_api.dart';
import '../../../core/tema/ovi_colores.dart';
import '../../../core/widgets/ovi_estados.dart';
import '../../../core/widgets/ovi_widgets.dart';
import '../../../core/widgets/selectores.dart';
import '../../calendario/calendario_proveedores.dart';
import '../datos/tarea.dart';
import '../tareas_proveedores.dart';

/// Crear (RF_11) y editar (RF_12) una tarea del predio.
class PantallaFormularioTarea extends ConsumerStatefulWidget {
  const PantallaFormularioTarea({super.key, this.idTarea, this.fechaSugerida});

  final String? idTarea;

  /// «AAAA-MM-DD» cuando se llega desde el botón + del calendario.
  final String? fechaSugerida;

  bool get esEdicion => idTarea != null;

  @override
  ConsumerState<PantallaFormularioTarea> createState() => _PantallaFormularioTareaState();
}

class _PantallaFormularioTareaState extends ConsumerState<PantallaFormularioTarea> {
  final _formulario = GlobalKey<FormState>();
  final _titulo = TextEditingController();
  final _descripcion = TextEditingController();

  late DateTime _fechaLimite;
  Set<String> _responsables = {};
  Set<String> _animales = {};
  bool _enviando = false;
  bool _precargado = false;
  ErrorApi? _error;

  @override
  void initState() {
    super.initState();
    _fechaLimite = DateTime.tryParse(widget.fechaSugerida ?? '') ?? DateTime.now();
  }

  @override
  void dispose() {
    _titulo.dispose();
    _descripcion.dispose();
    super.dispose();
  }

  void _precargar(Tarea t) {
    if (_precargado) return;
    _precargado = true;
    _titulo.text = t.titulo;
    _descripcion.text = t.descripcion ?? '';
    _fechaLimite = t.fechaLimite.toLocal();
    _responsables = t.responsables.map((r) => r.id).toSet();
    _animales = t.animales.map((a) => a.id).toSet();
  }

  Future<void> _guardar() async {
    setState(() => _error = null);
    if (!_formulario.currentState!.validate()) return;

    if (_responsables.isEmpty) {
      setState(() => _error = const ErrorApi(
            codigo: 'SIN_RESPONSABLE',
            mensaje: 'Asigna al menos un responsable a la tarea.',
          ));
      return;
    }

    setState(() => _enviando = true);
    final repo = ref.read(tareasRepositorioProvider);

    try {
      if (widget.esEdicion) {
        await repo.editar(
          widget.idTarea!,
          titulo: _titulo.text.trim(),
          fechaLimite: _fechaLimite,
          idResponsables: _responsables.toList(),
          idAnimales: _animales.toList(),
          descripcion: _descripcion.text.trim().isEmpty ? null : _descripcion.text.trim(),
        );
        ref.invalidate(tareaProvider(widget.idTarea!));
      } else {
        await repo.crear(
          titulo: _titulo.text.trim(),
          fechaLimite: _fechaLimite,
          idResponsables: _responsables.toList(),
          idAnimales: _animales.toList(),
          descripcion: _descripcion.text.trim().isEmpty ? null : _descripcion.text.trim(),
        );
      }

      ref.invalidate(tareasProvider);
      ref.invalidate(agendaDelMesProvider);
      ref.invalidate(agendaDeHoyProvider);
      ref.invalidate(resumenInicioProvider);

      if (!mounted) return;
      mostrarMensaje(
        context,
        widget.esEdicion ? 'Tarea actualizada.' : 'Tarea creada.',
      );
      context.pop();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = comoErrorApi(e));
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.esEdicion) {
      final tarea = ref.watch(tareaProvider(widget.idTarea!));
      return Scaffold(
        appBar: AppBar(title: const Text('Editar tarea')),
        body: OviAsync<Tarea>(
          valor: tarea,
          alReintentar: () => ref.invalidate(tareaProvider(widget.idTarea!)),
          enDatos: (t) {
            _precargar(t);
            return _cuerpo(context);
          },
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Nueva tarea')),
      body: _cuerpo(context),
    );
  }

  Widget _cuerpo(BuildContext context) {
    final texto = Theme.of(context).textTheme;

    return Form(
      key: _formulario,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          Text('Título', style: texto.titleSmall),
          const SizedBox(height: 8),
          TextFormField(
            controller: _titulo,
            decoration: const InputDecoration(hintText: 'Ej: Revisar cercos sector 4'),
            validator: (v) =>
                (v ?? '').trim().isEmpty ? 'Escribe un título para la tarea.' : null,
          ),
          const SizedBox(height: 20),

          Text('Fecha de término', style: texto.titleSmall),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            icon: const Icon(Icons.calendar_today_rounded, size: 18),
            label: Text(Fmt.fecha(_fechaLimite)),
            onPressed: () async {
              final elegida = await showDatePicker(
                context: context,
                initialDate: _fechaLimite,
                firstDate: DateTime(2020),
                lastDate: DateTime(2035, 12, 31),
                locale: const Locale('es'),
              );
              if (elegida != null) setState(() => _fechaLimite = elegida);
            },
          ),
          const SizedBox(height: 20),

          CampoSeleccion(
            etiqueta: 'Responsables',
            obligatorio: true,
            icono: Icons.people_alt_rounded,
            resumen: _responsables.isEmpty
                ? 'Elegir responsables'
                : '${_responsables.length} seleccionado'
                    '${_responsables.length == 1 ? '' : 's'}',
            error: _error?.codigo == 'SIN_RESPONSABLE' ? _error!.mensaje : null,
            alTocar: () async {
              final elegidos = await elegirUsuarios(
                context,
                seleccionados: _responsables,
              );
              if (elegidos != null) setState(() => _responsables = elegidos.toSet());
            },
          ),
          const SizedBox(height: 20),

          CampoSeleccion(
            etiqueta: 'Animales (opcional)',
            icono: Icons.pets_rounded,
            resumen: _animales.isEmpty
                ? 'Ninguno'
                : '${_animales.length} seleccionado'
                    '${_animales.length == 1 ? '' : 's'}',
            alTocar: () async {
              final elegidos = await elegirAnimales(
                context,
                seleccionados: _animales,
                titulo: 'Animales de la tarea',
              );
              if (elegidos != null) setState(() => _animales = elegidos.toSet());
            },
          ),
          const SizedBox(height: 20),

          Text('Descripción', style: texto.titleSmall),
          const SizedBox(height: 8),
          TextFormField(
            controller: _descripcion,
            maxLines: 4,
            decoration: const InputDecoration(
              hintText: 'Qué hay que hacer exactamente',
            ),
          ),

          if (_error != null && _error!.codigo != 'SIN_RESPONSABLE') ...[
            const SizedBox(height: 20),
            _AvisoError(mensaje: _error!.mensaje),
          ],

          const SizedBox(height: 28),
          FilledButton(
            onPressed: _enviando ? null : _guardar,
            child: _enviando
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white),
                  )
                : Text(widget.esEdicion ? 'Guardar cambios' : 'Crear tarea'),
          ),
        ],
      ),
    );
  }
}

/// Aviso de error de formulario, con el mismo aspecto que el del login.
class _AvisoError extends StatelessWidget {
  const _AvisoError({required this.mensaje});

  final String mensaje;

  @override
  Widget build(BuildContext context) {
    return OviTarjeta(
      color: OviColores.peligroFondo,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.error_outline_rounded, size: 19, color: OviColores.peligro),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              mensaje,
              style: const TextStyle(
                fontSize: 13.5,
                color: Color(0xFFC2381C),
                height: 1.35,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

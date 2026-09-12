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
import '../datos/evento.dart';
import '../eventos_proveedores.dart';

/// Registrar (RF_07) y editar (RF_09) un evento del ciclo productivo.
///
/// Solo Productor. El tipo se elige al crear y después queda bloqueado: el
/// backend responde 409 si llega en un PATCH.
class PantallaFormularioEvento extends ConsumerStatefulWidget {
  const PantallaFormularioEvento({super.key, this.idEvento, this.fechaSugerida});

  final String? idEvento;

  /// «AAAA-MM-DD» cuando se llega desde el botón + del calendario.
  final String? fechaSugerida;

  bool get esEdicion => idEvento != null;

  @override
  ConsumerState<PantallaFormularioEvento> createState() =>
      _PantallaFormularioEventoState();
}

class _PantallaFormularioEventoState extends ConsumerState<PantallaFormularioEvento> {
  final _formulario = GlobalKey<FormState>();
  final _descripcion = TextEditingController();

  String _tipo = 'ENCASTE';
  late DateTime _fecha;
  Set<String> _animales = {};
  bool _enviando = false;
  bool _precargado = false;
  ErrorApi? _error;

  @override
  void initState() {
    super.initState();
    _fecha = fechaSugeridaDe(widget.fechaSugerida) ?? aLasNueve(DateTime.now());
  }

  @override
  void dispose() {
    _descripcion.dispose();
    super.dispose();
  }

  void _precargar(Evento e) {
    if (_precargado) return;
    _precargado = true;
    _tipo = e.tipo;
    _fecha = e.fechaInicio.toLocal();
    _descripcion.text = e.descripcion ?? '';
    _animales = e.animales.map((a) => a.id).toSet();
  }

  Future<void> _guardar() async {
    setState(() => _error = null);
    if (!_formulario.currentState!.validate()) return;

    // RF_07 — un evento sin animales no tiene sentido de negocio.
    if (_animales.isEmpty) {
      setState(() => _error = const ErrorApi(
            codigo: 'SIN_ANIMALES',
            mensaje: 'Selecciona al menos un animal para el evento.',
          ));
      return;
    }

    setState(() => _enviando = true);
    final repo = ref.read(eventosRepositorioProvider);
    final descripcion =
        _descripcion.text.trim().isEmpty ? null : _descripcion.text.trim();

    try {
      if (widget.esEdicion) {
        await repo.editar(
          widget.idEvento!,
          fechaInicio: _fecha,
          idAnimales: _animales.toList(),
          descripcion: descripcion,
        );
        ref.invalidate(eventoProvider(widget.idEvento!));
      } else {
        await repo.crear(
          tipo: _tipo,
          fechaInicio: _fecha,
          idAnimales: _animales.toList(),
          descripcion: descripcion,
        );
      }

      ref.invalidate(agendaDelMesProvider);
      ref.invalidate(agendaDeHoyProvider);

      if (!mounted) return;
      mostrarMensaje(
        context,
        widget.esEdicion ? 'Evento actualizado.' : 'Evento registrado.',
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
      final evento = ref.watch(eventoProvider(widget.idEvento!));
      return Scaffold(
        appBar: AppBar(title: const Text('Editar evento')),
        body: OviAsync<Evento>(
          valor: evento,
          alReintentar: () => ref.invalidate(eventoProvider(widget.idEvento!)),
          enDatos: (e) {
            _precargar(e);
            return _cuerpo(context);
          },
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Nuevo evento')),
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
          Text('Tipo de evento', style: texto.titleSmall),
          const SizedBox(height: 8),
          if (widget.esEdicion)
            // RF_09 — inmutable: se muestra pero no se puede cambiar.
            OviTarjeta(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              color: OviColores.neutroFondo,
              child: Row(
                children: [
                  const Icon(Icons.lock_outline_rounded,
                      size: 18, color: OviColores.textoSecundario),
                  const SizedBox(width: 10),
                  Expanded(child: Text(Etiquetas.tipoEvento(_tipo))),
                ],
              ),
            )
          else
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final tipo in tiposDeEvento)
                  ChoiceChip(
                    label: Text(Etiquetas.tipoEvento(tipo)),
                    selected: _tipo == tipo,
                    showCheckmark: false,
                    onSelected: (_) => setState(() => _tipo = tipo),
                    labelStyle: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w600,
                      color: _tipo == tipo ? Colors.white : OviColores.textoSecundario,
                    ),
                  ),
              ],
            ),
          if (widget.esEdicion) ...[
            const SizedBox(height: 6),
            Text('El tipo no se puede cambiar después de crear el evento.',
                style: texto.bodySmall),
          ],
          const SizedBox(height: 20),

          Text('Fecha y hora', style: texto.titleSmall),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  icon: const Icon(Icons.calendar_today_rounded, size: 18),
                  label: Text(Fmt.fecha(_fecha)),
                  onPressed: () async {
                    final elegida = await showDatePicker(
                      context: context,
                      initialDate: _fecha,
                      firstDate: DateTime(2020),
                      lastDate: DateTime(2035, 12, 31),
                      locale: const Locale('es'),
                    );
                    if (elegida == null) return;
                    setState(() => _fecha = DateTime(
                          elegida.year,
                          elegida.month,
                          elegida.day,
                          _fecha.hour,
                          _fecha.minute,
                        ));
                  },
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  icon: const Icon(Icons.schedule_rounded, size: 18),
                  label: Text(Fmt.hora(_fecha)),
                  onPressed: () async {
                    final hora = await showTimePicker(
                      context: context,
                      initialTime: TimeOfDay.fromDateTime(_fecha),
                    );
                    if (hora == null) return;
                    setState(() => _fecha = DateTime(
                          _fecha.year,
                          _fecha.month,
                          _fecha.day,
                          hora.hour,
                          hora.minute,
                        ));
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          CampoSeleccion(
            etiqueta: 'Animales involucrados',
            obligatorio: true,
            icono: Icons.pets_rounded,
            resumen: _animales.isEmpty
                ? 'Elegir animales'
                : '${_animales.length} seleccionado'
                    '${_animales.length == 1 ? '' : 's'}',
            error: _error?.codigo == 'SIN_ANIMALES' ? _error!.mensaje : null,
            alTocar: () async {
              final elegidos = await elegirAnimales(
                context,
                seleccionados: _animales,
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
              hintText: 'Detalle del evento',
            ),
          ),

          if (_error != null && _error!.codigo != 'SIN_ANIMALES') ...[
            const SizedBox(height: 20),
            OviTarjeta(
              color: OviColores.peligroFondo,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.error_outline_rounded,
                      size: 19, color: OviColores.peligro),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      _error!.mensaje,
                      style: const TextStyle(
                        fontSize: 13.5,
                        color: Color(0xFFC2381C),
                        height: 1.35,
                      ),
                    ),
                  ),
                ],
              ),
            ),
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
                : Text(widget.esEdicion ? 'Guardar cambios' : 'Registrar evento'),
          ),
        ],
      ),
    );
  }
}

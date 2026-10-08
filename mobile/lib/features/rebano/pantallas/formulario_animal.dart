import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/formato.dart';
import '../../../core/red/cliente_api.dart';
import '../../../core/red/error_api.dart';
import '../../../core/tema/ovi_colores.dart';
import '../../../core/widgets/ovi_estados.dart';
import '../../../core/widgets/ovi_widgets.dart';
import '../datos/animal.dart';
import '../rebano_proveedores.dart';

/// Pantalla 05 — alta (RF_01) y edición (RF_03) de un animal.
///
/// Es la misma pantalla en los dos modos: la diferencia es que en edición el
/// número de oreja va bloqueado, porque es inmutable después del alta.
class PantallaFormularioAnimal extends ConsumerStatefulWidget {
  const PantallaFormularioAnimal({super.key, this.idAnimal});

  final String? idAnimal;

  bool get esEdicion => idAnimal != null;

  @override
  ConsumerState<PantallaFormularioAnimal> createState() => _PantallaFormularioAnimalState();
}

class _PantallaFormularioAnimalState extends ConsumerState<PantallaFormularioAnimal> {
  final _formulario = GlobalKey<FormState>();
  final _oreja = TextEditingController();
  final _raza = TextEditingController();
  final _color = TextEditingController();
  final _peso = TextEditingController();
  final _descripcion = TextEditingController();

  String _sexo = 'HEMBRA';
  DateTime? _nacimiento;
  bool _enviando = false;
  bool _precargado = false;
  ErrorApi? _error;

  @override
  void dispose() {
    _oreja.dispose();
    _raza.dispose();
    _color.dispose();
    _peso.dispose();
    _descripcion.dispose();
    super.dispose();
  }

  void _precargar(Animal a) {
    if (_precargado) return;
    _precargado = true;
    _oreja.text = a.numeroOreja;
    _raza.text = a.raza ?? '';
    _color.text = a.color ?? '';
    _peso.text = a.pesoKg?.toString() ?? '';
    _descripcion.text = a.descripcion ?? '';
    _sexo = a.sexo;
    _nacimiento = a.fechaNacimiento;
  }

  Future<void> _guardar() async {
    setState(() => _error = null);
    if (!_formulario.currentState!.validate()) return;

    setState(() => _enviando = true);
    final repo = ref.read(rebanoRepositorioProvider);
    final peso = double.tryParse(_peso.text.trim().replaceAll(',', '.'));

    try {
      final guardado = widget.esEdicion
          ? await repo.editar(
              widget.idAnimal!,
              sexo: _sexo,
              raza: _textoONulo(_raza),
              color: _textoONulo(_color),
              pesoKg: peso,
              fechaNacimiento: _nacimiento,
              descripcion: _textoONulo(_descripcion),
            )
          : await repo.crear(
              numeroOreja: _oreja.text.trim(),
              sexo: _sexo,
              raza: _textoONulo(_raza),
              color: _textoONulo(_color),
              pesoKg: peso,
              fechaNacimiento: _nacimiento,
              descripcion: _textoONulo(_descripcion),
            );

      ref.read(rebanoProvider.notifier).recargar();
      if (widget.esEdicion) ref.invalidate(fichaAnimalProvider(widget.idAnimal!));

      if (!mounted) return;
      mostrarMensaje(
        context,
        widget.esEdicion
            ? 'Ficha de #${guardado.numeroOreja} actualizada.'
            : 'Animal #${guardado.numeroOreja} registrado.',
      );
      context.pop();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = comoErrorApi(e));
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  static String? _textoONulo(TextEditingController c) {
    final v = c.text.trim();
    return v.isEmpty ? null : v;
  }

  @override
  Widget build(BuildContext context) {
    // En edición hay que esperar la ficha antes de pintar el formulario.
    if (widget.esEdicion) {
      final ficha = ref.watch(fichaAnimalProvider(widget.idAnimal!));
      return Scaffold(
        appBar: AppBar(title: const Text('Editar animal')),
        body: OviAsync<FichaAnimal>(
          valor: ficha,
          alReintentar: () => ref.invalidate(fichaAnimalProvider(widget.idAnimal!)),
          enDatos: (f) {
            _precargar(f.animal);
            return _formularioWidget(context);
          },
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Registrar animal')),
      body: _formularioWidget(context),
    );
  }

  Widget _formularioWidget(BuildContext context) {
    final texto = Theme.of(context).textTheme;

    return Form(
      key: _formulario,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          Text('N° de oreja', style: texto.titleSmall),
          const SizedBox(height: 8),
          TextFormField(
            controller: _oreja,
            // RF_03: el identificador es inmutable después del alta.
            enabled: !widget.esEdicion,
            textCapitalization: TextCapitalization.characters,
            decoration: InputDecoration(
              hintText: 'Ej: 0042',
              helperText: widget.esEdicion
                  ? 'El número de oreja no se puede cambiar.'
                  : 'Debe ser único dentro del predio.',
            ),
            validator: (v) {
              if (widget.esEdicion) return null;
              final valor = (v ?? '').trim();
              if (valor.isEmpty) return 'Escribe el número de oreja.';
              if (valor.length > 30) return 'Máximo 30 caracteres.';
              return null;
            },
          ),
          const SizedBox(height: 20),

          Text('Sexo', style: texto.titleSmall),
          const SizedBox(height: 8),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(
                value: 'HEMBRA',
                label: Text('Hembra'),
                icon: Icon(Icons.female_rounded),
              ),
              ButtonSegment(
                value: 'MACHO',
                label: Text('Macho'),
                icon: Icon(Icons.male_rounded),
              ),
            ],
            selected: {_sexo},
            showSelectedIcon: false,
            onSelectionChanged: (s) => setState(() => _sexo = s.first),
          ),
          const SizedBox(height: 20),

          _Campo(
            etiqueta: 'Raza',
            controlador: _raza,
            hint: 'Ej: Suffolk',
            error: _error?.mensajeDe('raza'),
          ),
          _Campo(
            etiqueta: 'Color',
            controlador: _color,
            hint: 'Ej: Blanco',
            error: _error?.mensajeDe('color'),
          ),
          _Campo(
            etiqueta: 'Peso (kg)',
            controlador: _peso,
            hint: 'Ej: 45',
            teclado: const TextInputType.numberWithOptions(decimal: true),
            formateadores: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))],
            error: _error?.mensajeDe('pesoKg'),
            validador: (v) {
              final valor = (v ?? '').trim();
              if (valor.isEmpty) return null;
              final n = double.tryParse(valor.replaceAll(',', '.'));
              if (n == null) return 'Escribe un número válido.';
              if (n <= 0) return 'El peso debe ser mayor que cero.';
              return null;
            },
          ),

          Text('Fecha de nacimiento', style: texto.titleSmall),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            icon: const Icon(Icons.calendar_today_rounded, size: 18),
            label: Text(_nacimiento == null ? 'Sin definir' : Fmt.fecha(_nacimiento!)),
            onPressed: () async {
              final elegida = await showDatePicker(
                context: context,
                initialDate: _nacimiento ?? DateTime.now(),
                firstDate: DateTime(2010),
                lastDate: DateTime.now(),
              );
              if (elegida != null) setState(() => _nacimiento = elegida);
            },
          ),
          if (_nacimiento != null)
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                onPressed: () => setState(() => _nacimiento = null),
                child: const Text('Quitar fecha'),
              ),
            ),
          const SizedBox(height: 20),

          _Campo(
            etiqueta: 'Observaciones',
            controlador: _descripcion,
            hint: 'Notas iniciales sobre el animal',
            lineas: 4,
            error: _error?.mensajeDe('descripcion'),
          ),

          if (_error != null && _error!.detalles == null) ...[
            const SizedBox(height: 4),
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
            const SizedBox(height: 16),
          ],

          const SizedBox(height: 8),
          FilledButton(
            onPressed: _enviando ? null : _guardar,
            child: _enviando
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white),
                  )
                : Text(widget.esEdicion ? 'Guardar cambios' : 'Registrar animal'),
          ),
        ],
      ),
    );
  }
}

/// Campo de texto con etiqueta, usado por todos los formularios del módulo.
class _Campo extends StatelessWidget {
  const _Campo({
    required this.etiqueta,
    required this.controlador,
    this.hint,
    this.teclado,
    this.formateadores,
    this.validador,
    this.error,
    this.lineas = 1,
  });

  final String etiqueta;
  final TextEditingController controlador;
  final String? hint;
  final TextInputType? teclado;
  final List<TextInputFormatter>? formateadores;
  final String? Function(String?)? validador;
  final String? error;
  final int lineas;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(etiqueta, style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          TextFormField(
            controller: controlador,
            keyboardType: teclado,
            inputFormatters: formateadores,
            maxLines: lineas,
            validator: validador,
            decoration: InputDecoration(hintText: hint, errorText: error),
          ),
        ],
      ),
    );
  }
}

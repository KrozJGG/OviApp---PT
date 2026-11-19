import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/red/cliente_api.dart';
import '../../../core/red/error_api.dart';
import '../../../core/tema/ovi_colores.dart';
import '../../../core/widgets/ovi_widgets.dart';
import '../sesion.dart';

/// Formulario de registro inicial del predio, su productor titular y
/// trabajadores opcionales cuando se instala la aplicación por primera vez.
class PantallaRegistro extends ConsumerStatefulWidget {
  const PantallaRegistro({super.key});

  @override
  ConsumerState<PantallaRegistro> createState() => _PantallaRegistroState();
}

class _BorradorTrabajador {
  final nombre = TextEditingController();
  final email = TextEditingController();
  final password = TextEditingController();
  final rut = TextEditingController();
  final telefono = TextEditingController();
  String rol = 'TRABAJADOR';
  bool verPassword = false;

  void dispose() {
    nombre.dispose();
    email.dispose();
    password.dispose();
    rut.dispose();
    telefono.dispose();
  }

  TrabajadorRegistro aModelo() => TrabajadorRegistro(
        nombre: nombre.text.trim(),
        email: email.text.trim(),
        password: password.text,
        rol: rol,
        rut: rut.text.trim().isEmpty ? null : rut.text.trim(),
        telefono: telefono.text.trim().isEmpty ? null : telefono.text.trim(),
      );
}

class _PantallaRegistroState extends ConsumerState<PantallaRegistro> {
  final _formulario = GlobalKey<FormState>();

  // Datos del Productor titular
  final _nombre = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _rut = TextEditingController();
  final _telefono = TextEditingController();

  // Datos del Predio (opcionales)
  final _nombrePredio = TextEditingController();
  final _ubicacionPredio = TextEditingController();

  // Trabajadores adicionales (opcionales)
  final List<_BorradorTrabajador> _trabajadores = [];

  bool _verPassword = false;
  bool _enviando = false;
  ErrorApi? _error;

  @override
  void dispose() {
    _nombre.dispose();
    _email.dispose();
    _password.dispose();
    _rut.dispose();
    _telefono.dispose();
    _nombrePredio.dispose();
    _ubicacionPredio.dispose();
    for (final t in _trabajadores) {
      t.dispose();
    }
    super.dispose();
  }

  void _agregarTrabajador() {
    setState(() {
      _trabajadores.add(_BorradorTrabajador());
    });
  }

  void _quitarTrabajador(int indice) {
    setState(() {
      final borrador = _trabajadores.removeAt(indice);
      borrador.dispose();
    });
  }

  bool _correoRepetidoEnFormulario(String correo, {int? exceptoIndice}) {
    final limpio = correo.trim().toLowerCase();
    if (limpio.isEmpty) return false;

    if (exceptoIndice != null &&
        _email.text.trim().toLowerCase() == limpio) {
      return true;
    }

    for (var i = 0; i < _trabajadores.length; i++) {
      if (i == exceptoIndice) continue;
      if (_trabajadores[i].email.text.trim().toLowerCase() == limpio) {
        return true;
      }
    }
    return false;
  }

  Future<void> _registrar() async {
    setState(() => _error = null);
    if (!_formulario.currentState!.validate()) return;

    setState(() => _enviando = true);
    try {
      await ref.read(sesionProvider.notifier).registrarPredio(
            nombre: _nombre.text,
            email: _email.text,
            password: _password.text,
            rut: _rut.text,
            telefono: _telefono.text,
            nombrePredio: _nombrePredio.text,
            ubicacionPredio: _ubicacionPredio.text,
            trabajadores: _trabajadores.map((t) => t.aModelo()).toList(),
          );
      // El router redirige automáticamente a /inicio al cambiar la sesión.
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = comoErrorApi(e));
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;

    return Scaffold(
      backgroundColor: OviColores.superficie,
      appBar: AppBar(title: const Text('Registrar nuevo predio')),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 36),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: Form(
                key: _formulario,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Configura tu cuenta de productor, tu predio y, si lo deseas, agrega desde ya a tu equipo de trabajo.',
                      style: texto.bodyMedium,
                    ),
                    const SizedBox(height: 24),

                    // ── 1. Productor titular ───────────────────────────────
                    Text('1. Tus datos (Productor)', style: texto.titleMedium),
                    const SizedBox(height: 12),
                    OviTarjeta(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text('Nombre', style: texto.titleSmall),
                          const SizedBox(height: 8),
                          TextFormField(
                            controller: _nombre,
                            textCapitalization: TextCapitalization.words,
                            textInputAction: TextInputAction.next,
                            decoration: InputDecoration(
                              hintText: 'Nombre y apellido',
                              errorText: _error?.mensajeDe('nombre'),
                            ),
                            validator: (v) {
                              final valor = (v ?? '').trim();
                              if (valor.isEmpty) return 'Escribe tu nombre.';
                              if (valor.length < 2) {
                                return 'El nombre debe tener al menos 2 caracteres.';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 16),

                          Text('Correo', style: texto.titleSmall),
                          const SizedBox(height: 8),
                          TextFormField(
                            controller: _email,
                            keyboardType: TextInputType.emailAddress,
                            textInputAction: TextInputAction.next,
                            autocorrect: false,
                            decoration: InputDecoration(
                              hintText: 'tu@correo.cl',
                              helperText: 'Con este correo iniciarás sesión.',
                              errorText: _error?.mensajeDe('email'),
                            ),
                            validator: (v) {
                              final valor = (v ?? '').trim();
                              if (valor.isEmpty) return 'Escribe tu correo.';
                              if (!valor.contains('@') || !valor.contains('.')) {
                                return 'Ese correo no parece válido.';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 16),

                          Text('Contraseña', style: texto.titleSmall),
                          const SizedBox(height: 8),
                          TextFormField(
                            controller: _password,
                            obscureText: !_verPassword,
                            textInputAction: TextInputAction.next,
                            decoration: InputDecoration(
                              hintText: 'Mínimo 8 caracteres',
                              errorText: _error?.mensajeDe('password'),
                              suffixIcon: IconButton(
                                onPressed: () =>
                                    setState(() => _verPassword = !_verPassword),
                                icon: Icon(
                                  _verPassword
                                      ? Icons.visibility_off_outlined
                                      : Icons.visibility_outlined,
                                ),
                                tooltip: _verPassword
                                    ? 'Ocultar contraseña'
                                    : 'Mostrar contraseña',
                              ),
                            ),
                            validator: (v) {
                              final valor = v ?? '';
                              if (valor.isEmpty) return 'Escribe una contraseña.';
                              if (valor.length < 8) {
                                return 'Debe tener al menos 8 caracteres.';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 16),

                          Text('RUT (opcional)', style: texto.titleSmall),
                          const SizedBox(height: 8),
                          TextFormField(
                            controller: _rut,
                            textInputAction: TextInputAction.next,
                            decoration: InputDecoration(
                              hintText: '12.345.678-9',
                              errorText: _error?.mensajeDe('rut'),
                            ),
                          ),
                          const SizedBox(height: 16),

                          Text('Teléfono (opcional)', style: texto.titleSmall),
                          const SizedBox(height: 8),
                          TextFormField(
                            controller: _telefono,
                            keyboardType: TextInputType.phone,
                            textInputAction: TextInputAction.next,
                            decoration: InputDecoration(
                              hintText: '+56 9 1234 5678',
                              errorText: _error?.mensajeDe('telefono'),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // ── 2. Datos del Predio ────────────────────────────────
                    Text('2. Tu predio', style: texto.titleMedium),
                    const SizedBox(height: 12),
                    OviTarjeta(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            'Nombre del predio (opcional)',
                            style: texto.titleSmall,
                          ),
                          const SizedBox(height: 8),
                          TextFormField(
                            controller: _nombrePredio,
                            textCapitalization: TextCapitalization.words,
                            textInputAction: TextInputAction.next,
                            decoration: InputDecoration(
                              hintText: 'Ej. Fundo El Manzano',
                              helperText:
                                  'Si lo dejas en blanco, usaremos "Predio de tu nombre".',
                              errorText: _error?.mensajeDe('predio.nombre'),
                            ),
                          ),
                          const SizedBox(height: 16),

                          Text(
                            'Ubicación (opcional)',
                            style: texto.titleSmall,
                          ),
                          const SizedBox(height: 8),
                          TextFormField(
                            controller: _ubicacionPredio,
                            textCapitalization: TextCapitalization.words,
                            textInputAction: TextInputAction.done,
                            decoration: InputDecoration(
                              hintText: 'Ej. Ñuble, Región de Ñuble',
                              errorText: _error?.mensajeDe('predio.ubicacion'),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // ── 3. Trabajadores opcionales ─────────────────────────
                    Text('3. Trabajadores (opcional)', style: texto.titleMedium),
                    const SizedBox(height: 6),
                    Text(
                      'Puedes añadir ahora a quienes trabajarán en el predio o crearlos más adelante desde Más → Usuarios.',
                      style: texto.bodySmall,
                    ),
                    const SizedBox(height: 12),

                    for (var i = 0; i < _trabajadores.length; i++) ...[
                      _TarjetaTrabajador(
                        indice: i,
                        borrador: _trabajadores[i],
                        alQuitar: () => _quitarTrabajador(i),
                        alCambiar: () => setState(() {}),
                        validarCorreoRepetido: (correo) =>
                            _correoRepetidoEnFormulario(
                          correo,
                          exceptoIndice: i,
                        ),
                      ),
                      const SizedBox(height: 14),
                    ],

                    OutlinedButton.icon(
                      onPressed: _enviando ? null : _agregarTrabajador,
                      icon: const Icon(Icons.person_add_alt_1_rounded, size: 19),
                      label: const Text('Agregar trabajador'),
                    ),

                    if (_error != null) ...[
                      const SizedBox(height: 20),
                      OviTarjeta(
                        color: OviColores.peligroFondo,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 12,
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Icon(
                              Icons.error_outline_rounded,
                              size: 19,
                              color: OviColores.peligro,
                            ),
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
                      onPressed: _enviando ? null : _registrar,
                      child: _enviando
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.4,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Crear predio y entrar'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _TarjetaTrabajador extends StatelessWidget {
  const _TarjetaTrabajador({
    required this.indice,
    required this.borrador,
    required this.alQuitar,
    required this.alCambiar,
    required this.validarCorreoRepetido,
  });

  final int indice;
  final _BorradorTrabajador borrador;
  final VoidCallback alQuitar;
  final VoidCallback alCambiar;
  final bool Function(String correo) validarCorreoRepetido;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;

    return OviTarjeta(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Trabajador #${indice + 1}',
                  style: texto.titleSmall,
                ),
              ),
              IconButton(
                onPressed: alQuitar,
                tooltip: 'Quitar trabajador',
                icon: const Icon(
                  Icons.delete_outline_rounded,
                  color: OviColores.peligro,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),

          Text('Nombre', style: texto.titleSmall),
          const SizedBox(height: 6),
          TextFormField(
            controller: borrador.nombre,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(hintText: 'Nombre y apellido'),
            validator: (v) {
              final valor = (v ?? '').trim();
              if (valor.isEmpty) return 'Escribe el nombre.';
              if (valor.length < 2) {
                return 'Debe tener al menos 2 caracteres.';
              }
              return null;
            },
          ),
          const SizedBox(height: 14),

          Text('Correo', style: texto.titleSmall),
          const SizedBox(height: 6),
          TextFormField(
            controller: borrador.email,
            keyboardType: TextInputType.emailAddress,
            autocorrect: false,
            decoration: const InputDecoration(hintText: 'persona@correo.cl'),
            validator: (v) {
              final valor = (v ?? '').trim();
              if (valor.isEmpty) return 'Escribe el correo.';
              if (!valor.contains('@') || !valor.contains('.')) {
                return 'Ese correo no parece válido.';
              }
              if (validarCorreoRepetido(valor)) {
                return 'Este correo ya está repetido en el formulario.';
              }
              return null;
            },
          ),
          const SizedBox(height: 14),

          Text('Contraseña', style: texto.titleSmall),
          const SizedBox(height: 6),
          TextFormField(
            controller: borrador.password,
            obscureText: !borrador.verPassword,
            decoration: InputDecoration(
              hintText: 'Mínimo 8 caracteres',
              suffixIcon: IconButton(
                onPressed: () {
                  borrador.verPassword = !borrador.verPassword;
                  alCambiar();
                },
                icon: Icon(
                  borrador.verPassword
                      ? Icons.visibility_off_outlined
                      : Icons.visibility_outlined,
                ),
                tooltip: borrador.verPassword ? 'Ocultar' : 'Mostrar',
              ),
            ),
            validator: (v) {
              final valor = v ?? '';
              if (valor.isEmpty) return 'Escribe una contraseña.';
              if (valor.length < 8) {
                return 'Debe tener al menos 8 caracteres.';
              }
              return null;
            },
          ),
          const SizedBox(height: 14),

          Text('Rol', style: texto.titleSmall),
          const SizedBox(height: 6),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'TRABAJADOR', label: Text('Trabajador')),
              ButtonSegment(value: 'PRODUCTOR', label: Text('Productor')),
            ],
            selected: {borrador.rol},
            showSelectedIcon: false,
            onSelectionChanged: (s) {
              borrador.rol = s.first;
              alCambiar();
            },
          ),
          const SizedBox(height: 14),

          Text('RUT (opcional)', style: texto.titleSmall),
          const SizedBox(height: 6),
          TextFormField(
            controller: borrador.rut,
            decoration: const InputDecoration(hintText: '12.345.678-9'),
          ),
          const SizedBox(height: 14),

          Text('Teléfono (opcional)', style: texto.titleSmall),
          const SizedBox(height: 6),
          TextFormField(
            controller: borrador.telefono,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(hintText: '+56 9 1234 5678'),
          ),
        ],
      ),
    );
  }
}


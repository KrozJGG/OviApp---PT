import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/red/cliente_api.dart';
import '../../../core/red/error_api.dart';
import '../../../core/tema/ovi_colores.dart';
import '../../../core/widgets/ovi_estados.dart';
import '../../../core/widgets/ovi_widgets.dart';
import '../administracion_proveedores.dart';
import '../datos/usuario.dart';

/// Alta (RF_20) y edición (RF_21) de un usuario del predio. Solo Productor.
class PantallaFormularioUsuario extends ConsumerStatefulWidget {
  const PantallaFormularioUsuario({super.key, this.idUsuario});

  final String? idUsuario;

  bool get esEdicion => idUsuario != null;

  @override
  ConsumerState<PantallaFormularioUsuario> createState() =>
      _PantallaFormularioUsuarioState();
}

class _PantallaFormularioUsuarioState
    extends ConsumerState<PantallaFormularioUsuario> {
  final _formulario = GlobalKey<FormState>();
  final _nombre = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _rut = TextEditingController();
  final _telefono = TextEditingController();

  String _rol = 'TRABAJADOR';
  bool _verPassword = false;
  bool _enviando = false;
  bool _precargado = false;
  ErrorApi? _error;

  @override
  void dispose() {
    _nombre.dispose();
    _email.dispose();
    _password.dispose();
    _rut.dispose();
    _telefono.dispose();
    super.dispose();
  }

  void _precargar(Usuario u) {
    if (_precargado) return;
    _precargado = true;
    _nombre.text = u.nombre;
    _email.text = u.email;
    _rut.text = u.rut ?? '';
    _telefono.text = u.telefono ?? '';
    _rol = u.rol;
  }

  Future<void> _guardar() async {
    setState(() => _error = null);
    if (!_formulario.currentState!.validate()) return;

    setState(() => _enviando = true);
    final repo = ref.read(usuariosRepositorioProvider);

    try {
      if (widget.esEdicion) {
        await repo.editar(
          widget.idUsuario!,
          nombre: _nombre.text.trim(),
          email: _email.text.trim(),
          rol: _rol,
          rut: _opcional(_rut),
          telefono: _opcional(_telefono),
        );
        ref.invalidate(usuarioProvider(widget.idUsuario!));
      } else {
        await repo.crear(
          nombre: _nombre.text.trim(),
          email: _email.text.trim(),
          password: _password.text,
          rol: _rol,
          rut: _opcional(_rut),
          telefono: _opcional(_telefono),
        );
      }

      ref.invalidate(usuariosProvider);
      if (!mounted) return;
      mostrarMensaje(
        context,
        widget.esEdicion ? 'Usuario actualizado.' : 'Usuario creado.',
      );
      context.pop();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = comoErrorApi(e));
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  static String? _opcional(TextEditingController c) {
    final v = c.text.trim();
    return v.isEmpty ? null : v;
  }

  @override
  Widget build(BuildContext context) {
    if (widget.esEdicion) {
      final usuario = ref.watch(usuarioProvider(widget.idUsuario!));
      return Scaffold(
        appBar: AppBar(title: const Text('Editar usuario')),
        body: OviAsync<Usuario>(
          valor: usuario,
          alReintentar: () => ref.invalidate(usuarioProvider(widget.idUsuario!)),
          enDatos: (u) {
            _precargar(u);
            return _cuerpo(context);
          },
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Nuevo usuario')),
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
          Text('Nombre', style: texto.titleSmall),
          const SizedBox(height: 8),
          TextFormField(
            controller: _nombre,
            textCapitalization: TextCapitalization.words,
            decoration: InputDecoration(
              hintText: 'Nombre y apellido',
              errorText: _error?.mensajeDe('nombre'),
            ),
            validator: (v) =>
                (v ?? '').trim().isEmpty ? 'Escribe el nombre.' : null,
          ),
          const SizedBox(height: 20),

          Text('Correo', style: texto.titleSmall),
          const SizedBox(height: 8),
          TextFormField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            autocorrect: false,
            decoration: InputDecoration(
              hintText: 'persona@correo.cl',
              helperText: 'Con este correo iniciará sesión.',
              errorText: _error?.mensajeDe('email'),
            ),
            validator: (v) {
              final valor = (v ?? '').trim();
              if (valor.isEmpty) return 'Escribe el correo.';
              if (!valor.contains('@') || !valor.contains('.')) {
                return 'Ese correo no parece válido.';
              }
              return null;
            },
          ),
          const SizedBox(height: 20),

          // La contraseña solo se fija al crear: cambiarla es otro flujo.
          if (!widget.esEdicion) ...[
            Text('Contraseña', style: texto.titleSmall),
            const SizedBox(height: 8),
            TextFormField(
              controller: _password,
              obscureText: !_verPassword,
              decoration: InputDecoration(
                hintText: 'Mínimo 8 caracteres',
                errorText: _error?.mensajeDe('password'),
                suffixIcon: IconButton(
                  tooltip: _verPassword ? 'Ocultar' : 'Mostrar',
                  onPressed: () => setState(() => _verPassword = !_verPassword),
                  icon: Icon(_verPassword
                      ? Icons.visibility_off_outlined
                      : Icons.visibility_outlined),
                ),
              ),
              validator: (v) {
                final valor = v ?? '';
                if (valor.isEmpty) return 'Escribe una contraseña.';
                if (valor.length < 8) return 'Debe tener al menos 8 caracteres.';
                return null;
              },
            ),
            const SizedBox(height: 20),
          ],

          Text('Rol', style: texto.titleSmall),
          const SizedBox(height: 8),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'TRABAJADOR', label: Text('Trabajador')),
              ButtonSegment(value: 'PRODUCTOR', label: Text('Productor')),
            ],
            selected: {_rol},
            showSelectedIcon: false,
            onSelectionChanged: (s) => setState(() => _rol = s.first),
          ),
          const SizedBox(height: 6),
          Text(
            _rol == 'PRODUCTOR'
                ? 'Acceso total: puede dar de baja animales, gestionar eventos y usuarios.'
                : 'Acceso operativo: registra animales, tareas y notas de bitácora.',
            style: texto.bodySmall,
          ),
          const SizedBox(height: 20),

          Text('RUT (opcional)', style: texto.titleSmall),
          const SizedBox(height: 8),
          TextFormField(
            controller: _rut,
            decoration: InputDecoration(
              hintText: '12.345.678-9',
              errorText: _error?.mensajeDe('rut'),
            ),
          ),
          const SizedBox(height: 20),

          Text('Teléfono (opcional)', style: texto.titleSmall),
          const SizedBox(height: 8),
          TextFormField(
            controller: _telefono,
            keyboardType: TextInputType.phone,
            decoration: InputDecoration(
              hintText: '+56 9 1234 5678',
              errorText: _error?.mensajeDe('telefono'),
            ),
          ),

          if (_error != null && _error!.detalles == null) ...[
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
                : Text(widget.esEdicion ? 'Guardar cambios' : 'Crear usuario'),
          ),
        ],
      ),
    );
  }
}

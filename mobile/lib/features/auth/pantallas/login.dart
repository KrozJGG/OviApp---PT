import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/red/cliente_api.dart';
import '../../../core/tema/ovi_colores.dart';
import '../../../core/widgets/ovi_widgets.dart';
import '../sesion.dart';
import 'arranque.dart';

/// Pantalla 01 - Inicio de sesion (IF6-ENT).
///
/// Es la unica puerta de entrada: el sistema no admite registro abierto ni
/// acceso anonimo (limite (f) del capitulo 3). Dos campos y un boton: cualquier
/// cosa mas seria una barrera para un usuario sin formacion tecnica (RNF_04).
class PantallaLogin extends ConsumerStatefulWidget {
  const PantallaLogin({super.key});

  @override
  ConsumerState<PantallaLogin> createState() => _PantallaLoginState();
}

class _PantallaLoginState extends ConsumerState<PantallaLogin> {
  final _formulario = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();

  bool _enviando = false;
  bool _verPassword = false;
  String? _errorGeneral;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _entrar() async {
    setState(() => _errorGeneral = null);
    if (!_formulario.currentState!.validate()) return;

    setState(() => _enviando = true);
    try {
      await ref.read(sesionProvider.notifier).iniciarSesion(_email.text, _password.text);
      // Sin navegacion imperativa: el router redirige solo al cambiar la sesion.
    } catch (e) {
      if (!mounted) return;
      setState(() => _errorGeneral = comoErrorApi(e).mensaje);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;

    return Scaffold(
      backgroundColor: OviColores.superficie,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _formulario,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Center(child: LogoOviApp(tamano: 76)),
                    const SizedBox(height: 10),
                    Text(
                      'Monitoreo y gestión del rebaño',
                      textAlign: TextAlign.center,
                      style: texto.bodySmall,
                    ),
                    const SizedBox(height: 36),

                    Text('Correo', style: texto.titleSmall),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      autocorrect: false,
                      autofillHints: const [AutofillHints.email],
                      decoration: const InputDecoration(hintText: 'tu@correo.cl'),
                      validator: (v) {
                        final valor = (v ?? '').trim();
                        if (valor.isEmpty) return 'Escribe tu correo.';
                        if (!valor.contains('@') || !valor.contains('.')) {
                          return 'Ese correo no parece válido.';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 20),

                    Text('Contraseña', style: texto.titleSmall),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: _password,
                      obscureText: !_verPassword,
                      textInputAction: TextInputAction.done,
                      autofillHints: const [AutofillHints.password],
                      onFieldSubmitted: (_) => _enviando ? null : _entrar(),
                      decoration: InputDecoration(
                        hintText: 'Tu contraseña',
                        suffixIcon: IconButton(
                          onPressed: () => setState(() => _verPassword = !_verPassword),
                          icon: Icon(
                            _verPassword
                                ? Icons.visibility_off_outlined
                                : Icons.visibility_outlined,
                          ),
                          tooltip: _verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña',
                        ),
                      ),
                      validator: (v) =>
                          (v ?? '').isEmpty ? 'Escribe tu contraseña.' : null,
                    ),

                    if (_errorGeneral != null) ...[
                      const SizedBox(height: 20),
                      _AvisoError(mensaje: _errorGeneral!),
                    ],

                    const SizedBox(height: 28),
                    FilledButton(
                      onPressed: _enviando ? null : _entrar,
                      child: _enviando
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.4,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Entrar'),
                    ),
                    const SizedBox(height: 20),
                    Text(
                      'Si no tienes cuenta, pídele al productor del predio que te cree una.',
                      textAlign: TextAlign.center,
                      style: texto.bodySmall,
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
              style: const TextStyle(fontSize: 13.5, color: Color(0xFFC2381C), height: 1.35),
            ),
          ),
        ],
      ),
    );
  }
}

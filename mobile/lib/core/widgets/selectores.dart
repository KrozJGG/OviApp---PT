import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../formato.dart';
import '../proveedores.dart';
import '../red/api.dart';
import '../tema/ovi_colores.dart';
import '../tema/ovi_tema.dart';
import 'ovi_estados.dart';
import 'ovi_widgets.dart';

/// Selectores multiples de animales y de usuarios.
///
/// Viven en el nucleo porque los comparten dos features: un evento selecciona
/// animales (RF_07) y una tarea selecciona responsables y, opcionalmente,
/// animales (RF_11, H10). Traen sus propios datos para no acoplar una feature a
/// otra.

// ─────────────────────────────────────────────────────────────────────────────
// Modelos minimos de seleccion
// ─────────────────────────────────────────────────────────────────────────────

class AnimalSeleccionable {
  const AnimalSeleccionable({
    required this.id,
    required this.numeroOreja,
    required this.sexo,
    this.raza,
  });

  final String id;
  final String numeroOreja;
  final String sexo;
  final String? raza;

  factory AnimalSeleccionable.desdeJson(Map<String, dynamic> j) => AnimalSeleccionable(
        id: j['id'] as String,
        numeroOreja: j['numeroOreja'] as String,
        sexo: (j['sexo'] as String?) ?? 'HEMBRA',
        raza: j['raza'] as String?,
      );
}

class UsuarioSeleccionable {
  const UsuarioSeleccionable({required this.id, required this.nombre, required this.rol});

  final String id;
  final String nombre;
  final String rol;

  factory UsuarioSeleccionable.desdeJson(Map<String, dynamic> j) => UsuarioSeleccionable(
        id: j['id'] as String,
        nombre: j['nombre'] as String,
        rol: (j['rol'] as String?) ?? 'TRABAJADOR',
      );
}

/// Animales ACTIVOS del predio. RF_07 solo permite eventos sobre animales
/// activos, asi que el selector nunca ofrece uno dado de baja.
final animalesActivosProvider = FutureProvider<List<AnimalSeleccionable>>((ref) async {
  final dio = ref.watch(dioProvider);
  final r = await dio.traerPaginado(
    '/animales',
    AnimalSeleccionable.desdeJson,
    consulta: {'estado': 'ACTIVO', 'tamano': 100},
  );
  return r.datos;
});

/// Usuarios HABILITADOS del predio, para asignar responsables de una tarea.
final usuariosHabilitadosProvider = FutureProvider<List<UsuarioSeleccionable>>((ref) async {
  final dio = ref.watch(dioProvider);
  final r = await dio.traerPaginado(
    '/usuarios',
    UsuarioSeleccionable.desdeJson,
    consulta: {'estado': 'HABILITADO', 'tamano': 100},
  );
  return r.datos;
});

// ─────────────────────────────────────────────────────────────────────────────
// Campo de formulario
// ─────────────────────────────────────────────────────────────────────────────

/// Campo que resume la seleccion y abre una hoja para modificarla.
class CampoSeleccion extends StatelessWidget {
  const CampoSeleccion({
    super.key,
    required this.etiqueta,
    required this.resumen,
    required this.alTocar,
    this.icono = Icons.checklist_rounded,
    this.error,
    this.obligatorio = false,
  });

  final String etiqueta;
  final String resumen;
  final VoidCallback alTocar;
  final IconData icono;
  final String? error;
  final bool obligatorio;

  @override
  Widget build(BuildContext context) {
    final texto = Theme.of(context).textTheme;
    final hayError = error != null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text.rich(
          TextSpan(
            text: etiqueta,
            style: texto.titleSmall,
            children: obligatorio
                ? const [TextSpan(text: ' *', style: TextStyle(color: OviColores.peligro))]
                : null,
          ),
        ),
        const SizedBox(height: 8),
        Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: alTocar,
            borderRadius: BorderRadius.circular(OviTema.radioControl),
            child: Container(
              constraints: const BoxConstraints(minHeight: OviTema.alturaMinimaControl),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(OviTema.radioControl),
                border: Border.all(
                  color: hayError ? OviColores.peligro : OviColores.borde,
                  width: hayError ? 1.4 : 1,
                ),
              ),
              child: Row(
                children: [
                  Icon(icono, size: 19, color: OviColores.textoSecundario),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      resumen,
                      style: texto.bodyMedium?.copyWith(fontWeight: FontWeight.w500),
                    ),
                  ),
                  const Icon(Icons.chevron_right_rounded, color: OviColores.textoSecundario),
                ],
              ),
            ),
          ),
        ),
        if (hayError) ...[
          const SizedBox(height: 6),
          Text(
            error!,
            style: texto.bodySmall?.copyWith(color: OviColores.peligro),
          ),
        ],
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hojas de seleccion
// ─────────────────────────────────────────────────────────────────────────────

/// Abre la seleccion de animales activos. Devuelve `null` si se cancela.
Future<List<String>?> elegirAnimales(
  BuildContext context, {
  required Set<String> seleccionados,
  String titulo = 'Animales involucrados',
}) {
  return showModalBottomSheet<List<String>>(
    context: context,
    isScrollControlled: true,
    backgroundColor: OviColores.superficie,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => _HojaSeleccion<AnimalSeleccionable>(
      titulo: titulo,
      proveedor: animalesActivosProvider,
      seleccionInicial: seleccionados,
      idDe: (a) => a.id,
      buscarEn: (a) => '${a.numeroOreja} ${a.raza ?? ''}',
      construir: (a) => _FilaAnimal(animal: a),
      mensajeVacio: 'No hay animales activos en el predio.',
      detalleVacio: 'Registra animales en el módulo Rebaño para poder asociarlos.',
    ),
  );
}

/// Abre la seleccion de usuarios habilitados. Devuelve `null` si se cancela.
Future<List<String>?> elegirUsuarios(
  BuildContext context, {
  required Set<String> seleccionados,
  String titulo = 'Responsables',
}) {
  return showModalBottomSheet<List<String>>(
    context: context,
    isScrollControlled: true,
    backgroundColor: OviColores.superficie,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => _HojaSeleccion<UsuarioSeleccionable>(
      titulo: titulo,
      proveedor: usuariosHabilitadosProvider,
      seleccionInicial: seleccionados,
      idDe: (u) => u.id,
      buscarEn: (u) => u.nombre,
      construir: (u) => _FilaUsuario(usuario: u),
      mensajeVacio: 'No hay usuarios habilitados.',
      detalleVacio: 'El productor del predio puede crear usuarios desde Más › Usuarios.',
    ),
  );
}

class _HojaSeleccion<T> extends ConsumerStatefulWidget {
  const _HojaSeleccion({
    required this.titulo,
    required this.proveedor,
    required this.seleccionInicial,
    required this.idDe,
    required this.buscarEn,
    required this.construir,
    required this.mensajeVacio,
    required this.detalleVacio,
  });

  final String titulo;
  final ProviderListenable<AsyncValue<List<T>>> proveedor;
  final Set<String> seleccionInicial;
  final String Function(T) idDe;
  final String Function(T) buscarEn;
  final Widget Function(T) construir;
  final String mensajeVacio;
  final String detalleVacio;

  @override
  ConsumerState<_HojaSeleccion<T>> createState() => _HojaSeleccionState<T>();
}

class _HojaSeleccionState<T> extends ConsumerState<_HojaSeleccion<T>> {
  late final Set<String> _elegidos = {...widget.seleccionInicial};
  final _busqueda = TextEditingController();
  String _filtro = '';

  @override
  void dispose() {
    _busqueda.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final valor = ref.watch(widget.proveedor);
    final alto = MediaQuery.sizeOf(context).height * 0.82;

    return SizedBox(
      height: alto,
      child: Column(
        children: [
          const SizedBox(height: 10),
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: OviColores.borde,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 12, 12),
            child: Row(
              children: [
                Expanded(
                  child: Text(widget.titulo, style: Theme.of(context).textTheme.titleMedium),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded),
                  tooltip: 'Cerrar sin cambios',
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: TextField(
              controller: _busqueda,
              onChanged: (v) => setState(() => _filtro = v.trim().toLowerCase()),
              decoration: const InputDecoration(
                hintText: 'Buscar…',
                prefixIcon: Icon(Icons.search_rounded),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: OviAsync<List<T>>(
              valor: valor,
              estaVacio: (lista) => lista.isEmpty,
              vacio: OviEstadoVacio(
                mensaje: widget.mensajeVacio,
                detalle: widget.detalleVacio,
              ),
              enDatos: (lista) {
                final visibles = _filtro.isEmpty
                    ? lista
                    : lista
                        .where((e) => widget.buscarEn(e).toLowerCase().contains(_filtro))
                        .toList(growable: false);

                if (visibles.isEmpty) {
                  return const OviEstadoVacio(
                    mensaje: 'Sin resultados',
                    detalle: 'Prueba con otro texto de búsqueda.',
                    icono: Icons.search_off_rounded,
                  );
                }

                return ListView.separated(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                  itemCount: visibles.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (_, i) {
                    final elemento = visibles[i];
                    final id = widget.idDe(elemento);
                    final elegido = _elegidos.contains(id);

                    return OviTarjeta(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      color: elegido ? OviColores.superficieSecundaria : null,
                      alTocar: () => setState(
                        () => elegido ? _elegidos.remove(id) : _elegidos.add(id),
                      ),
                      child: Row(
                        children: [
                          Expanded(child: widget.construir(elemento)),
                          Icon(
                            elegido
                                ? Icons.check_circle_rounded
                                : Icons.radio_button_unchecked_rounded,
                            color: elegido ? OviColores.primary : OviColores.borde,
                          ),
                        ],
                      ),
                    );
                  },
                );
              },
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      _elegidos.isEmpty
                          ? 'Ninguno seleccionado'
                          : '${_elegidos.length} seleccionado${_elegidos.length == 1 ? '' : 's'}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
                  // El tema da a los botones ancho infinito (ocupan toda la
                  // fila en los formularios); dentro de un Row eso rompe el
                  // layout y la hoja no llega a pintarse.
                  FilledButton(
                    style: FilledButton.styleFrom(
                      minimumSize: const Size(140, OviTema.alturaMinimaControl),
                    ),
                    onPressed: () =>
                        Navigator.of(context).pop(_elegidos.toList(growable: false)),
                    child: const Text('Confirmar'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FilaAnimal extends StatelessWidget {
  const _FilaAnimal({required this.animal});

  final AnimalSeleccionable animal;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        OviIconoSexo(sexo: animal.sexo, tamano: 34),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '#${animal.numeroOreja}',
                style: Theme.of(context).textTheme.titleSmall,
              ),
              Text(
                '${Fmt.oGuion(animal.raza)} · ${Etiquetas.sexo(animal.sexo)}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _FilaUsuario extends StatelessWidget {
  const _FilaUsuario({required this.usuario});

  final UsuarioSeleccionable usuario;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 34,
          height: 34,
          decoration: const BoxDecoration(
            color: OviColores.superficieSecundaria,
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.person_rounded, size: 19, color: OviColores.primary),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(usuario.nombre, style: Theme.of(context).textTheme.titleSmall),
              Text(
                Etiquetas.rol(usuario.rol),
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

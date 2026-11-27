import 'package:flutter_test/flutter_test.dart';
import 'package:oviapp/features/vigilancia/datos/alerta.dart';
import 'package:oviapp/features/vigilancia/vigilancia_proveedores.dart';

void main() {
  group('AlertaVigilancia', () {
    test('parsea alerta pendiente normalizada (posible oclusion)', () {
      final alerta = AlertaVigilancia.desdeJson({
        'id': 'alerta-1',
        'idDispositivoEdge': 'disp-1',
        'dispositivo': {'id': 'disp-1', 'nombre': 'Cámara Norte'},
        'tipo': 'CONTEO',
        'estado': 'PENDIENTE',
        'conteoDetectado': 38,
        'conteoEsperado': 40,
        'descripcion': 'Faltan 2 ovejas: 38 de 40 detectadas',
        'fechaDeteccion': '2026-11-27T14:30:00.000Z',
        'normalizadaEn': '2026-11-27T14:31:00.000Z',
        'revisadoPor': null,
        'fechaRevision': null,
      });

      expect(alerta.id, 'alerta-1');
      expect(alerta.dispositivo.nombre, 'Cámara Norte');
      expect(alerta.esPendiente, isTrue);
      expect(alerta.esNormalizada, isTrue);
      expect(alerta.conteoDetectado, 38);
      expect(alerta.conteoEsperado, 40);
      expect(alerta.revisadoPor, isNull);
    });

    test('parsea alerta resuelta con auditoria de revision', () {
      final alerta = AlertaVigilancia.desdeJson({
        'id': 'alerta-2',
        'idDispositivoEdge': 'disp-1',
        'dispositivo': {'id': 'disp-1', 'nombre': 'Cámara Norte'},
        'tipo': 'CONTEO',
        'estado': 'RESUELTA',
        'conteoDetectado': 35,
        'conteoEsperado': 40,
        'descripcion': 'Faltan 5 ovejas: 35 de 40 detectadas',
        'fechaDeteccion': '2026-11-27T14:30:00.000Z',
        'normalizadaEn': null,
        'revisadoPor': {'id': 'u-1', 'nombre': 'Juan Pérez'},
        'fechaRevision': '2026-11-27T14:40:00.000Z',
      });

      expect(alerta.esPendiente, isFalse);
      expect(alerta.esNormalizada, isFalse);
      expect(alerta.revisadoPor?.nombre, 'Juan Pérez');
      expect(alerta.fechaRevision, isNotNull);
    });

    test('FiltroHistorialAlertas serializa query solo con filtros activos', () {
      final filtro = FiltroHistorialAlertas(
        estado: 'RESUELTA',
        desde: DateTime(2026, 11, 1),
        hasta: DateTime(2026, 11, 27),
        pagina: 2,
      );

      expect(filtro.aConsulta(), {
        'estado': 'RESUELTA',
        'desde': '2026-11-01',
        'hasta': '2026-11-27',
        'pagina': 2,
        'tamano': 20,
      });
    });
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:oviapp/core/tema/ovi_tema.dart';
import 'package:oviapp/features/vigilancia/datos/alerta.dart';
import 'package:oviapp/features/vigilancia/datos/region_interes.dart';
import 'package:oviapp/features/vigilancia/widgets/editor_roi.dart';

void main() {
  group('RegionInteres', () {
    test('serializa y deserializa correctamente rectángulos y polígonos', () {
      const original = RegionInteres(
        tipo: TipoRegionInteres.poligono,
        puntos: [
          PuntoNormalizado(0.1, 0.2),
          PuntoNormalizado(0.8, 0.15),
          PuntoNormalizado(0.75, 0.85),
          PuntoNormalizado(0.2, 0.8),
        ],
      );

      final json = original.aJson();
      final restaurada = RegionInteres.desdeJsonNula(json);

      expect(restaurada, equals(original));
      expect(restaurada!.resumen, 'Polígono (4 puntos)');
    });

    test('desdeRectangulo construye 4 vértices y aPoligono los conserva', () {
      final rect = RegionInteres.desdeRectangulo(
        const Rect.fromLTRB(0.8, 0.7, 0.2, 0.1),
      );

      expect(rect.tipo, TipoRegionInteres.rectangulo);
      expect(rect.puntos, const [
        PuntoNormalizado(0.2, 0.1),
        PuntoNormalizado(0.8, 0.1),
        PuntoNormalizado(0.8, 0.7),
        PuntoNormalizado(0.2, 0.7),
      ]);
      expect(rect.areaNormalizada, closeTo(0.36, 1e-6));
      expect(rect.esValida, isTrue);
      expect(rect.resumen, 'Rectángulo');

      final poli = rect.aPoligono();
      expect(poli.tipo, TipoRegionInteres.poligono);
      expect(poli.puntos, equals(rect.puntos));
    });

    test('valida cantidad de puntos, área mínima y auto-intersección', () {
      const pocosPuntos = RegionInteres(
        tipo: TipoRegionInteres.poligono,
        puntos: [
          PuntoNormalizado(0.1, 0.1),
          PuntoNormalizado(0.5, 0.5),
        ],
      );
      expect(pocosPuntos.esValida, isFalse);
      expect(pocosPuntos.mensajeValidacion, contains('al menos 3 puntos'));

      final muchosPuntos = RegionInteres(
        tipo: TipoRegionInteres.poligono,
        puntos: List.generate(
          21,
          (i) => PuntoNormalizado(0.1 + i * 0.03, i.isEven ? 0.2 : 0.7),
        ),
      );
      expect(muchosPuntos.esValida, isFalse);
      expect(muchosPuntos.mensajeValidacion, contains('20 puntos'));

      final areaMuyChica = RegionInteres.desdeRectangulo(
        const Rect.fromLTRB(0.1, 0.1, 0.16, 0.16),
      );
      expect(areaMuyChica.esValida, isFalse);
      expect(areaMuyChica.mensajeValidacion, contains('demasiado pequeña'));

      const cruzado = RegionInteres(
        tipo: TipoRegionInteres.poligono,
        puntos: [
          PuntoNormalizado(0.1, 0.1),
          PuntoNormalizado(0.9, 0.9),
          PuntoNormalizado(0.9, 0.1),
          PuntoNormalizado(0.1, 0.9),
        ],
      );
      expect(cruzado.tieneAutoInterseccion, isTrue);
      expect(cruzado.esValida, isFalse);
      expect(cruzado.mensajeValidacion, contains('cruzarse'));
    });
  });

  group('DispositivoEdge.desdeJson con ROI', () {
    test('tolera regionInteres nula y lee regionInteres presente', () {
      final sinRoi = DispositivoEdge.desdeJson(const {
        'id': 'd1',
        'nombre': 'Cámara Norte',
        'enLinea': true,
        'regionInteres': null,
        'regionInteresUpdatedAt': null,
      });
      expect(sinRoi.tieneRoi, isFalse);
      expect(sinRoi.resumenRoi, 'Imagen completa');

      final conRoi = DispositivoEdge.desdeJson(const {
        'id': 'd1',
        'nombre': 'Cámara Norte',
        'enLinea': true,
        'regionInteres': {
          'tipo': 'RECTANGULO',
          'puntos': [
            {'x': 0.1, 'y': 0.1},
            {'x': 0.9, 'y': 0.1},
            {'x': 0.9, 'y': 0.9},
            {'x': 0.1, 'y': 0.9},
          ],
        },
        'regionInteresUpdatedAt': '2026-11-19T00:00:00.000Z',
      });
      expect(conRoi.tieneRoi, isTrue);
      expect(conRoi.resumenRoi, 'Rectángulo');
      expect(conRoi.regionInteresUpdatedAt, isNotNull);
    });
  });

  group('Widgets ROI', () {
    testWidgets('CapaRoi renderiza sin errores sobre un área acotada', (tester) async {
      final roi = RegionInteres.desdeRectangulo(
        const Rect.fromLTRB(0.2, 0.2, 0.8, 0.8),
      );

      await tester.pumpWidget(
        MaterialApp(
          theme: OviTema.claro(),
          home: Scaffold(
            body: SizedBox(
              width: 320,
              height: 180,
              child: CapaRoi(region: roi),
            ),
          ),
        ),
      );

      expect(find.byType(CapaRoi), findsOneWidget);
    });

    testWidgets('EditorRoiInteractivo agrega vértices al tocar en modo polígono', (tester) async {
      var puntos = <PuntoNormalizado>[];

      await tester.pumpWidget(
        MaterialApp(
          theme: OviTema.claro(),
          home: Scaffold(
            body: Center(
              child: SizedBox(
                width: 400,
                height: 200,
                child: StatefulBuilder(
                  builder: (context, setState) => EditorRoiInteractivo(
                    modo: TipoRegionInteres.poligono,
                    puntos: puntos,
                    valido: false,
                    alCambiar: (nuevos) => setState(() => puntos = nuevos),
                  ),
                ),
              ),
            ),
          ),
        ),
      );

      final origen = tester.getTopLeft(find.byType(EditorRoiInteractivo));
      await tester.tapAt(origen + const Offset(40, 40));
      await tester.pump();
      await tester.tapAt(origen + const Offset(300, 40));
      await tester.pump();
      await tester.tapAt(origen + const Offset(200, 160));
      await tester.pump();

      expect(puntos, hasLength(3));
      expect(puntos[0].x, closeTo(0.1, 0.01));
      expect(puntos[0].y, closeTo(0.2, 0.01));
    });

    testWidgets('EditorRoiInteractivo genera 4 puntos al arrastrar en modo rectángulo', (tester) async {
      var puntos = <PuntoNormalizado>[];

      await tester.pumpWidget(
        MaterialApp(
          theme: OviTema.claro(),
          home: Scaffold(
            body: Center(
              child: SizedBox(
                width: 400,
                height: 200,
                child: StatefulBuilder(
                  builder: (context, setState) => EditorRoiInteractivo(
                    modo: TipoRegionInteres.rectangulo,
                    puntos: puntos,
                    valido: false,
                    alCambiar: (nuevos) => setState(() => puntos = nuevos),
                  ),
                ),
              ),
            ),
          ),
        ),
      );

      final origen = tester.getTopLeft(find.byType(EditorRoiInteractivo));
      await tester.dragFrom(origen + const Offset(40, 20), const Offset(240, 120));
      await tester.pump();

      expect(puntos, hasLength(4));
      final roi = RegionInteres(tipo: TipoRegionInteres.rectangulo, puntos: puntos);
      expect(roi.esValida, isTrue);
      expect(roi.boundingBox.left, closeTo(0.1, 0.02));
      expect(roi.boundingBox.top, closeTo(0.1, 0.02));
      expect(roi.boundingBox.right, closeTo(0.7, 0.02));
      expect(roi.boundingBox.bottom, closeTo(0.7, 0.02));
    });
  });
}

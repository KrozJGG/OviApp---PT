import unittest

from ia_engine.roi import (
    RegionInteres,
    calcular_bbox_recorte,
    contar_en_roi,
    parsear_roi,
    punto_en_poligono,
    recortar_frame,
)


class _FrameSimulado:
    """Simula un ndarray 2D/3D con `.shape` y slicing `frame[y1:y2, x1:x2]`."""

    def __init__(self, alto: int, ancho: int) -> None:
        self.shape = (alto, ancho, 3)

    def __getitem__(self, item: tuple[slice, slice]) -> "_FrameSimulado":
        sy, sx = item
        alto_rec = (sy.stop or self.shape[0]) - (sy.start or 0)
        ancho_rec = (sx.stop or self.shape[1]) - (sx.start or 0)
        return _FrameSimulado(alto_rec, ancho_rec)


class TestRegionInteres(unittest.TestCase):
    def test_parsear_roi_payload_completo_y_nulo(self) -> None:
        self.assertIsNone(parsear_roi(None))
        self.assertIsNone(parsear_roi({"regionInteres": None, "regionInteresUpdatedAt": None}))

        roi = parsear_roi(
            {
                "regionInteres": {
                    "tipo": "RECTANGULO",
                    "puntos": [
                        {"x": 0.1, "y": 0.2},
                        {"x": 0.8, "y": 0.2},
                        {"x": 0.8, "y": 0.8},
                        {"x": 0.1, "y": 0.8},
                    ],
                },
                "regionInteresUpdatedAt": "2026-11-19T00:00:00Z",
            }
        )
        self.assertIsNotNone(roi)
        assert roi is not None
        self.assertEqual(roi.tipo, "RECTANGULO")
        self.assertEqual(len(roi.puntos), 4)
        self.assertEqual(roi.updated_at, "2026-11-19T00:00:00Z")

    def test_parsear_roi_rechaza_datos_invalidos(self) -> None:
        self.assertIsNone(parsear_roi({"regionInteres": {"tipo": "POLIGONO", "puntos": [{"x": 0.1, "y": 0.1}]}}))
        self.assertIsNone(
            parsear_roi(
                {
                    "regionInteres": {
                        "tipo": "RECTANGULO",
                        "puntos": [{"x": 0.1, "y": 0.1}, {"x": 0.9, "y": 0.1}, {"x": 0.9, "y": 0.9}],
                    }
                }
            )
        )
        self.assertIsNone(
            parsear_roi(
                {
                    "regionInteres": {
                        "tipo": "POLIGONO",
                        "puntos": [{"x": -0.1, "y": 0.1}, {"x": 0.5, "y": 0.1}, {"x": 0.5, "y": 0.5}],
                    }
                }
            )
        )

    def test_calcular_bbox_recorte_con_margen_y_clamping(self) -> None:
        roi = RegionInteres(
            tipo="RECTANGULO",
            puntos=((0.25, 0.25), (0.75, 0.25), (0.75, 0.75), (0.25, 0.75)),
        )
        x1, y1, x2, y2 = calcular_bbox_recorte(roi, ancho=1000, alto=1000, margen=0.03)
        self.assertEqual((x1, y1, x2, y2), (220, 220, 780, 780))

        roi_borde = RegionInteres(
            tipo="RECTANGULO",
            puntos=((0.0, 0.0), (0.5, 0.0), (0.5, 1.0), (0.0, 1.0)),
        )
        bx1, by1, bx2, by2 = calcular_bbox_recorte(roi_borde, ancho=1920, alto=1080, margen=0.05)
        self.assertEqual(bx1, 0)
        self.assertEqual(by1, 0)
        self.assertEqual(by2, 1080)
        self.assertGreater(bx2, 960)

    def test_recortar_frame(self) -> None:
        frame = _FrameSimulado(alto=1080, ancho=1920)
        roi = RegionInteres(
            tipo="RECTANGULO",
            puntos=((0.25, 0.25), (0.75, 0.25), (0.75, 0.75), (0.25, 0.75)),
        )
        recorte, bbox = recortar_frame(frame, roi, margen=0.0)
        self.assertEqual(bbox, (480, 270, 1440, 810))
        self.assertEqual(recorte.shape[:2], (540, 960))

    def test_punto_en_poligono_rectangulo_y_concavo(self) -> None:
        rect = ((0.2, 0.2), (0.8, 0.2), (0.8, 0.8), (0.2, 0.8))
        self.assertTrue(punto_en_poligono(0.5, 0.5, rect))
        self.assertTrue(punto_en_poligono(0.2, 0.5, rect))  # sobre el borde
        self.assertFalse(punto_en_poligono(0.1, 0.5, rect))
        self.assertFalse(punto_en_poligono(0.9, 0.9, rect))

        # Polígono cóncavo en forma de L
        forma_l = (
            (0.1, 0.1),
            (0.4, 0.1),
            (0.4, 0.6),
            (0.8, 0.6),
            (0.8, 0.9),
            (0.1, 0.9),
        )
        self.assertTrue(punto_en_poligono(0.25, 0.3, forma_l))
        self.assertTrue(punto_en_poligono(0.6, 0.75, forma_l))
        self.assertFalse(punto_en_poligono(0.6, 0.3, forma_l))  # hueco superior derecho de la L

    def test_contar_en_roi_con_offset_de_recorte(self) -> None:
        # Polígono diagonal dentro de un recorte de 1920x1080
        roi = RegionInteres(
            tipo="POLIGONO",
            puntos=((0.5, 0.2), (0.8, 0.8), (0.2, 0.8)),
        )
        # Supongamos recorte desde offset (384, 216) en una imagen 1920x1080:
        # - Centro 1 en recorte: (576, 432) -> original (960, 648) -> norm (0.5, 0.6) -> DENTRO
        # - Centro 2 en recorte: (64, 50)   -> original (448, 266) -> norm (0.233, 0.246) -> FUERA del triángulo
        # - Centro 3 en recorte: (576, 600) -> original (960, 816) -> norm (0.5, 0.755) -> DENTRO
        boxes = [
            [576.0, 432.0, 40.0, 30.0],
            [64.0, 50.0, 40.0, 30.0],
            [576.0, 600.0, 40.0, 30.0],
        ]
        conteo = contar_en_roi(boxes, ancho_orig=1920, alto_orig=1080, roi=roi, offset=(384, 216))
        self.assertEqual(conteo, 2)

        # Sin offset (modo filtro sobre frame completo)
        boxes_full = [
            [960.0, 648.0, 40.0, 30.0],
            [448.0, 266.0, 40.0, 30.0],
        ]
        self.assertEqual(contar_en_roi(boxes_full, 1920, 1080, roi, offset=(0, 0)), 1)


if __name__ == "__main__":
    unittest.main()

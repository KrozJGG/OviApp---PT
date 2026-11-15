-- Eliminación completa del sistema de alertas y amenazas.
-- El módulo de IA únicamente reporta el conteo actualizado de ovejas en cada heartbeat.

DROP TABLE IF EXISTS "alerta";
DROP TYPE IF EXISTS "tipo_alerta";
DROP TYPE IF EXISTS "nivel_alerta";
DROP TYPE IF EXISTS "estado_alerta";

ALTER TABLE "dispositivo_edge" DROP COLUMN IF EXISTS "conteo_esperado";

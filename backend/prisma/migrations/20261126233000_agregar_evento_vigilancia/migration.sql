-- Historial liviano de eventos de vigilancia IA para el Modulo 8 (Reportes y Paneles - RF23/RF24).

CREATE TYPE "tipo_evento_vigilancia" AS ENUM ('DISCREPANCIA_CONTEO', 'DESCONEXION');

CREATE TABLE "evento_vigilancia" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_predio" UUID NOT NULL,
    "id_dispositivo" UUID,
    "tipo" "tipo_evento_vigilancia" NOT NULL,
    "conteo_detectado" INTEGER,
    "animales_activos" INTEGER NOT NULL,
    "diferencia" INTEGER NOT NULL DEFAULT 0,
    "ocurrido_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evento_vigilancia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "evento_vigilancia_id_predio_ocurrido_en_idx" ON "evento_vigilancia"("id_predio", "ocurrido_en");
CREATE INDEX "evento_vigilancia_id_dispositivo_tipo_ocurrido_en_idx" ON "evento_vigilancia"("id_dispositivo", "tipo", "ocurrido_en");

ALTER TABLE "evento_vigilancia"
    ADD CONSTRAINT "evento_vigilancia_id_predio_fkey"
    FOREIGN KEY ("id_predio") REFERENCES "predio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "evento_vigilancia"
    ADD CONSTRAINT "evento_vigilancia_id_dispositivo_fkey"
    FOREIGN KEY ("id_dispositivo") REFERENCES "dispositivo_edge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

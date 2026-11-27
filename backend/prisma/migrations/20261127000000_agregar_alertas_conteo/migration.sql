-- CreateEnum
CREATE TYPE "tipo_alerta" AS ENUM ('CONTEO');

-- CreateEnum
CREATE TYPE "estado_alerta" AS ENUM ('PENDIENTE', 'RESUELTA', 'DESCARTADA');

-- CreateTable
CREATE TABLE "alerta" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_predio" UUID NOT NULL,
    "id_dispositivo_edge" UUID NOT NULL,
    "tipo" "tipo_alerta" NOT NULL DEFAULT 'CONTEO',
    "estado" "estado_alerta" NOT NULL DEFAULT 'PENDIENTE',
    "conteo_detectado" INTEGER NOT NULL,
    "conteo_esperado" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fecha_deteccion" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "normalizada_en" TIMESTAMPTZ(6),
    "id_revisado_por" UUID,
    "fecha_revision" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "alerta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alerta_id_predio_fecha_deteccion_idx" ON "alerta"("id_predio", "fecha_deteccion" DESC);

-- CreateIndex
CREATE INDEX "alerta_id_predio_estado_idx" ON "alerta"("id_predio", "estado");

-- CreateIndex
CREATE INDEX "alerta_id_dispositivo_edge_tipo_estado_idx" ON "alerta"("id_dispositivo_edge", "tipo", "estado");

-- Indice unico parcial: garantiza a lo sumo una alerta PENDIENTE por dispositivo y tipo.
CREATE UNIQUE INDEX "uq_alerta_pendiente_dispositivo_tipo"
ON "alerta"("id_dispositivo_edge", "tipo")
WHERE "estado" = 'PENDIENTE';

-- AddForeignKey
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_id_predio_fkey"
FOREIGN KEY ("id_predio") REFERENCES "predio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_id_dispositivo_edge_fkey"
FOREIGN KEY ("id_dispositivo_edge") REFERENCES "dispositivo_edge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_id_revisado_por_fkey"
FOREIGN KEY ("id_revisado_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Agrega la configuracion de Region de Interes (ROI) por dispositivo edge.
ALTER TABLE "dispositivo_edge"
  ADD COLUMN "region_interes" JSONB,
  ADD COLUMN "region_interes_updated_at" TIMESTAMPTZ(6);

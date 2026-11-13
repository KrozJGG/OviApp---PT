-- Se elimina la deteccion de dispersion del rebano.
--
-- El ia-engine ya no la calcula: solo cuenta ovejas y envia la mediana del
-- conteo en el heartbeat. PostgreSQL no permite quitar un valor de un enum,
-- asi que se recrea el tipo sin DISPERSION.

-- Las alertas de dispersion existentes ya no tienen un tipo valido.
DELETE FROM "alerta" WHERE "tipo_alerta" = 'DISPERSION';

ALTER TYPE "tipo_alerta" RENAME TO "tipo_alerta_old";
CREATE TYPE "tipo_alerta" AS ENUM ('CONTEO', 'AMENAZA');

ALTER TABLE "alerta"
  ALTER COLUMN "tipo_alerta" TYPE "tipo_alerta"
  USING ("tipo_alerta"::text::"tipo_alerta");

DROP TYPE "tipo_alerta_old";

